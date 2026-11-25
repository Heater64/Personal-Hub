/* ==========================================
   location/places.js — «Nuestros lugares».

   Una lista limpia (icono, nombre y radio) con un menú de tres puntos para
   editar o eliminar: sin dos botones permanentes por fila. El formulario vive
   en una hoja aparte, con vista previa real del área en el mapa.

   El icono de cada lugar se guarda en las preferencias de este dispositivo
   (`placeIcons`): la tabla `couple_places` no tiene columna de icono y no se
   toca el esquema desde la interfaz.
   ========================================== */

import { icon, openSheet, closeSheets, toast } from '../ui.js';
import { escapeHtml } from '../../utils/escape.js';
import { getUserPref, setUserPref } from '../../utils/userStorage.js';
import {
  fetchSharedPlaces,
  watchSharedPlaces,
  addSharedPlace,
  updateSharedPlace,
  removeSharedPlace,
  fetchMyLocation,
} from '../../services/location.service.js';
import {
  RADIUS_OPTIONS, RADIUS_MIN, RADIUS_MAX, PLACE_ICONS, placeIcon, radiusLabel, clampRadius,
} from './state.js';
import { createLocationMap } from './map.js';

function iconPrefs() {
  try {
    const parsed = JSON.parse(getUserPref('placeIcons', '{}') || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function savePlaceIcon(placeId, iconName) {
  if (!placeId) return;
  const map = iconPrefs();
  map[placeId] = iconName;
  try { setUserPref('placeIcons', JSON.stringify(map)); } catch { /* solo afecta al icono */ }
}

function countLabel(total) {
  if (!total) return 'Todavía no hay ninguno';
  return total === 1 ? '1 lugar guardado' : `${total} lugares guardados`;
}

/* ==========================================
   Editor de lugar (hoja independiente)
   ========================================== */

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

/**
 * Busca direcciones en el mismo OpenStreetMap del mapa (Nominatim).
 *
 * Solo viaja el texto escrito; ni la posición ni nada de la pareja. Si la
 * búsqueda falla, el editor sigue funcionando: se puede tocar el mapa o pegar
 * unas coordenadas a mano.
 */
async function searchAddress(query, signal) {
  const url = new URL(NOMINATIM);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '4');
  url.searchParams.set('accept-language', 'es');
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('search-failed');
  const rows = await response.json();
  return (Array.isArray(rows) ? rows : []).map(row => ({
    lat: Number(row.lat),
    lng: Number(row.lon),
    name: row.name || String(row.display_name || '').split(',')[0],
    address: row.display_name || '',
  })).filter(row => Number.isFinite(row.lat) && Number.isFinite(row.lng));
}

/** «40.4168, -3.7038» también es una ubicación personalizada. */
function parseCoordinates(text) {
  const match = String(text || '').trim()
    .match(/^(-?\d{1,3}(?:[.,]\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:[.,]\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1].replace(',', '.'));
  const lng = Number(match[2].replace(',', '.'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

async function ownPosition() {
  const known = fetchMyLocation();
  if (known && Number.isFinite(known.lat)) return { lat: known.lat, lng: known.lng };
  if (!navigator.geolocation) return null;
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 60000 },
    );
  });
}

/**
 * Abre la hoja de creación/edición. `onSaved(place)` y `onDeleted(id)` avisan
 * a la lista para que se actualice sin recargar la pantalla.
 */
export function openPlaceEditor({ place = null, onSaved } = {}) {
  const editing = !!place;
  const prefs = iconPrefs();
  const savedRadius = Number(place?.radius_m) || 150;
  const state = {
    coordinates: place
      ? { lat: Number(place.latitude), lng: Number(place.longitude) }
      : null,
    radius: savedRadius,
    // Un lugar con un radio que no está entre los atajos se abre directamente
    // en «Personalizado», con su valor ya escrito.
    customRadius: !RADIUS_OPTIONS.includes(savedRadius),
    icon: placeIcon(place?.name, prefs[place?.id]),
  };

  const overlay = openSheet(editing ? 'Editar lugar' : 'Nuevo lugar', () => {
    // Tiene que ser un <form> de verdad: el guardado escucha el evento `submit`
    // y un div nunca lo emite, así que el botón no hacía nada.
    const body = document.createElement('form');
    body.className = 'placeform';
    body.noValidate = true;
    body.innerHTML = `
      <label class="placeform__field">
        <span>Nombre</span>
        <input name="name" maxlength="48" required placeholder="Casa, trabajo, el parque…" value="${escapeHtml(place?.name || '')}" autocomplete="off">
      </label>

      <fieldset class="placeform__group">
        <legend>Icono</legend>
        <div class="placeform__icons" data-icons>
          ${PLACE_ICONS.map(name => `
            <button type="button" class="placeform__icon${name === state.icon ? ' is-on' : ''}" data-icon="${name}"
              aria-pressed="${name === state.icon}" aria-label="${name}">${icon(name, 18)}</button>`).join('')}
        </div>
      </fieldset>

      <fieldset class="placeform__group">
        <legend>Radio del aviso</legend>
        <div class="placeform__radii" data-radii>
          ${RADIUS_OPTIONS.map(meters => `
            <button type="button" class="placeform__radius${!state.customRadius && meters === state.radius ? ' is-on' : ''}" data-radius="${meters}"
              aria-pressed="${!state.customRadius && meters === state.radius}">${radiusLabel(meters)}</button>`).join('')}
          <button type="button" class="placeform__radius${state.customRadius ? ' is-on' : ''}" data-radius="custom"
            aria-pressed="${state.customRadius}">Personalizado</button>
        </div>
        <div class="placeform__custom" data-custom ${state.customRadius ? '' : 'hidden'}>
          <label class="placeform__field">
            <span>Radio exacto en metros (${RADIUS_MIN}–${RADIUS_MAX})</span>
            <input type="number" inputmode="numeric" data-radius-input min="${RADIUS_MIN}" max="${RADIUS_MAX}" step="10"
              value="${state.radius}" aria-label="Radio exacto en metros">
          </label>
          <span class="placeform__hint" data-radius-hint>Se ajusta al rango permitido: de ${RADIUS_MIN} m a ${radiusLabel(RADIUS_MAX)}.</span>
        </div>
      </fieldset>

      <div class="placeform__group">
        <label class="placeform__label" for="placeformSearch">O busca una dirección</label>
        <div class="placeform__search">
          <input id="placeformSearch" type="search" data-search autocomplete="off" enterkeyhint="search"
            placeholder="Calle, plaza, ciudad o «40.4168, -3.7038»">
          <button type="button" class="placeform__search-go" data-search-go>Buscar</button>
        </div>
        <ul class="placeform__results" data-results hidden></ul>
        <span class="placeform__hint">O toca directamente el punto en el mapa.</span>
      </div>

      <div class="placeform__map" data-map></div>
      <div class="placeform__coords">
        <span data-coords>${state.coordinates
          ? `${state.coordinates.lat.toFixed(5)}, ${state.coordinates.lng.toFixed(5)}`
          : 'Elige un punto en el mapa.'}</span>
        <button type="button" class="placeform__locate" data-locate>${icon('map', 14)}Mi ubicación</button>
      </div>

      <p class="placeform__note" data-note role="status" aria-live="polite"></p>
      <div class="placeform__actions">
        <button type="button" class="placeform__cancel" data-cancel>Cancelar</button>
        <button type="submit" class="placeform__save" data-save>${editing ? 'Guardar cambios' : 'Guardar lugar'}</button>
      </div>
    `;
    return body;
  });

  const form = overlay.querySelector('.placeform');
  const nameInput = form.querySelector('input[name="name"]');
  const coordsEl = form.querySelector('[data-coords]');
  const note = form.querySelector('[data-note]');
  const save = form.querySelector('[data-save]');
  const iconsBox = form.querySelector('[data-icons]');
  const radiiBox = form.querySelector('[data-radii]');
  const mapHost = form.querySelector('[data-map]');

  const mapView = createLocationMap({
    picker: true,
    onPick: ({ lat, lng }) => {
      state.coordinates = { lat, lng };
      coordsEl.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      note.textContent = '';
      mapView.setPick({ lat, lng, radius: state.radius });
    },
  });
  mapHost.append(mapView.el);

  const paintSelection = () => {
    if (state.coordinates) mapView.setPick({ ...state.coordinates, radius: state.radius });
  };

  const applyPoint = ({ lat, lng }, label = '') => {
    state.coordinates = { lat, lng };
    coordsEl.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    note.textContent = '';
    mapView.focus(lat, lng, 15);
    mapView.setPick({ lat, lng, radius: state.radius });
    if (label && !nameInput.value.trim()) nameInput.value = label.slice(0, 48);
  };

  // El mapa se pinta en cuanto se abre la hoja. Esperar al GPS dejaría la
  // vista previa en negro y parecería que solo se pueden elegir los puntos
  // que ya existen.
  void mapView.render({ showNames: true }).then(async () => {
    if (state.coordinates) {
      mapView.focus(state.coordinates.lat, state.coordinates.lng, 15);
      mapView.setPick({ ...state.coordinates, radius: state.radius });
      return;
    }
    const own = await ownPosition();
    if (!own || state.coordinates) return;
    applyPoint(own);
  });

  iconsBox.addEventListener('click', event => {
    const button = event.target.closest('[data-icon]');
    if (!button) return;
    state.icon = button.dataset.icon;
    for (const item of iconsBox.querySelectorAll('[data-icon]')) {
      const on = item === button;
      item.classList.toggle('is-on', on);
      item.setAttribute('aria-pressed', String(on));
    }
  });

  const customBox = form.querySelector('[data-custom]');
  const radiusInput = form.querySelector('[data-radius-input]');
  const radiusHint = form.querySelector('[data-radius-hint]');

  const syncRadiusButtons = () => {
    for (const item of radiiBox.querySelectorAll('[data-radius]')) {
      const custom = item.dataset.radius === 'custom';
      const on = custom
        ? state.customRadius
        : !state.customRadius && Number(item.dataset.radius) === state.radius;
      item.classList.toggle('is-on', on);
      item.setAttribute('aria-pressed', String(on));
    }
    customBox.hidden = !state.customRadius;
  };

  radiiBox.addEventListener('click', event => {
    const button = event.target.closest('[data-radius]');
    if (!button) return;
    if (button.dataset.radius === 'custom') {
      state.customRadius = true;
      state.radius = clampRadius(radiusInput.value || state.radius);
      radiusInput.value = String(state.radius);
      if (radiusHint) radiusHint.textContent = `Se guardará como ${radiusLabel(state.radius)}.`;
      syncRadiusButtons();
      paintSelection();
      radiusInput.focus({ preventScroll: true });
      radiusInput.select?.();
      return;
    }
    state.customRadius = false;
    state.radius = Number(button.dataset.radius);
    syncRadiusButtons();
    paintSelection();
  });

  // Mientras se escribe no se reescribe el campo: se avisa del valor que se
  // guardará y la vista previa del área ya se ajusta.
  radiusInput.addEventListener('input', () => {
    const typed = Number(radiusInput.value);
    if (!radiusInput.value || !Number.isFinite(typed)) return;
    state.radius = clampRadius(typed);
    if (radiusHint) {
      radiusHint.textContent = state.radius !== Math.round(typed)
        ? `Se guardará como ${radiusLabel(state.radius)} (de ${RADIUS_MIN} m a ${radiusLabel(RADIUS_MAX)}).`
        : `Se guardará como ${radiusLabel(state.radius)}.`;
    }
    paintSelection();
  });

  radiusInput.addEventListener('blur', () => {
    state.radius = clampRadius(radiusInput.value || state.radius);
    radiusInput.value = String(state.radius);
    if (radiusHint) radiusHint.textContent = `Se guardará como ${radiusLabel(state.radius)}.`;
    paintSelection();
  });

  form.querySelector('[data-locate]')?.addEventListener('click', async () => {
    const own = await ownPosition();
    if (!own) { note.textContent = 'No se pudo leer tu ubicación.'; return; }
    applyPoint(own);
  });

  /* ---------- Búsqueda de una ubicación cualquiera ---------- */

  const searchInput = form.querySelector('[data-search]');
  const searchButton = form.querySelector('[data-search-go]');
  const resultsEl = form.querySelector('[data-results]');
  let searchTimer = null;
  let searchController = null;

  const closeResults = () => {
    resultsEl.hidden = true;
    resultsEl.replaceChildren();
  };

  const showResults = rows => {
    resultsEl.replaceChildren();
    if (!rows.length) {
      resultsEl.hidden = false;
      resultsEl.innerHTML = '<li class="placeform__empty">Sin resultados. Prueba con la calle y la ciudad.</li>';
      return;
    }
    resultsEl.hidden = false;
    for (const row of rows) {
      const item = document.createElement('li');
      item.innerHTML = `<button type="button"><b>${escapeHtml(row.name)}</b><small>${escapeHtml(row.address)}</small></button>`;
      item.querySelector('button').addEventListener('click', () => {
        applyPoint({ lat: row.lat, lng: row.lng }, row.name);
        searchInput.value = row.name;
        closeResults();
      });
      resultsEl.append(item);
    }
  };

  const runSearch = async () => {
    const query = searchInput.value.trim();
    if (query.length < 3) { note.textContent = 'Escribe al menos tres letras para buscar.'; return; }

    // Coordenadas pegadas a mano: no hace falta salir a la red.
    const typed = parseCoordinates(query);
    if (typed) {
      applyPoint(typed);
      closeResults();
      return;
    }

    searchController?.abort();
    searchController = new AbortController();
    searchButton.disabled = true;
    searchButton.textContent = 'Buscando…';
    note.textContent = '';
    try {
      showResults(await searchAddress(query, searchController.signal));
    } catch (error) {
      if (error?.name === 'AbortError') return;
      closeResults();
      note.textContent = 'No se pudo buscar. Puedes tocar el mapa o pegar las coordenadas.';
    } finally {
      searchButton.disabled = false;
      searchButton.textContent = 'Buscar';
    }
  };

  searchButton.addEventListener('click', () => void runSearch());
  searchInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); void runSearch(); }
  });
  // Mientras se escribe se busca solo, pero sin lanzar una petición por tecla.
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const query = searchInput.value.trim();
    if (query.length < 3) { closeResults(); return; }
    if (parseCoordinates(query)) return;
    searchTimer = setTimeout(() => void runSearch(), 700);
  });
  resultsEl.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeResults();
  });

  form.querySelector('[data-cancel]')?.addEventListener('click', () => closeSheets());

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) { note.textContent = 'Ponle un nombre al lugar.'; nameInput.focus(); return; }
    if (!state.coordinates) { note.textContent = 'Marca primero el punto en el mapa.'; return; }
    save.disabled = true;
    save.textContent = 'Guardando…';
    try {
      const payload = {
        name,
        latitude: Number(state.coordinates.lat),
        longitude: Number(state.coordinates.lng),
        radius_m: clampRadius(state.radius),
      };
      const saved = place
        ? await updateSharedPlace(place.id, payload)
        : await addSharedPlace(payload);
      savePlaceIcon(saved?.id || place?.id, state.icon);
      closeSheets();
      toast(place ? 'Lugar actualizado para los dos' : 'Lugar compartido');
      onSaved?.(saved);
    } catch {
      note.textContent = 'No se pudo guardar. Comprueba la conexión y vuelve a intentarlo.';
      save.disabled = false;
      save.textContent = editing ? 'Guardar cambios' : 'Guardar lugar';
    }
  });

  // La hoja se cierra de varias formas (botón, Escape, Atrás, tocar fuera):
  // el mapa de la vista previa se destruye siempre con ella.
  const observer = new MutationObserver(() => {
    if (!overlay.isConnected) {
      observer.disconnect();
      mapView.dispose();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

/* ==========================================
   Panel de lugares
   ========================================== */

export function createPlacesPanel({ onPlacesChange } = {}) {
  const el = document.createElement('div');
  el.className = 'places';
  el.innerHTML = `
    <header class="places__head">
      <div>
        <h2 class="places__title">Nuestros lugares</h2>
        <p class="places__count" data-count>Todavía no hay ninguno</p>
      </div>
      <button type="button" class="places__add" data-add>${icon('plus', 16)}Añadir lugar</button>
    </header>
    <ul class="places__list" data-list></ul>
    <p class="places__note" data-note role="status" aria-live="polite"></p>
  `;

  const list = el.querySelector('[data-list]');
  const countEl = el.querySelector('[data-count]');
  const note = el.querySelector('[data-note]');
  let places = [];
  let loaded = false;
  let openMenu = null;
  let disposed = false;

  const closeMenu = () => {
    openMenu?.remove();
    openMenu = null;
    for (const button of el.querySelectorAll('[data-more]')) button.setAttribute('aria-expanded', 'false');
  };

  const draw = list_ => {
    if (disposed) return;
    if (list_) { places = list_; loaded = true; }
    const prefs = iconPrefs();
    countEl.textContent = countLabel(places.length);
    if (!loaded) {
      list.innerHTML = Array.from({ length: 2 }, () => `
        <li class="places__skeleton" aria-hidden="true"><span></span><span></span></li>`).join('');
      return;
    }
    if (!places.length) {
      list.innerHTML = `
        <li class="places__empty">
          <span class="places__empty-ico">${icon('pin', 22)}</span>
          <b>Aún no habéis marcado ningún lugar</b>
          <p>Casa, trabajo, donde quedáis… Cualquier sitio al que os avisáis al llegar.</p>
          <button type="button" class="places__empty-cta" data-add-empty>Añadir el primero</button>
        </li>`;
      return;
    }
    list.innerHTML = places.map(place => `
      <li class="place" data-id="${escapeHtml(place.id)}">
        <span class="place__ico">${icon(placeIcon(place.name, prefs[place.id]), 18)}</span>
        <span class="place__txt">
          <b>${escapeHtml(place.name)}</b>
          <small>Radio ${radiusLabel(Number(place.radius_m))}</small>
        </span>
        <button type="button" class="place__more" data-more aria-haspopup="menu" aria-expanded="false"
          aria-label="Opciones de ${escapeHtml(place.name)}">${icon('more', 18)}</button>
      </li>`).join('');
    onPlacesChange?.(places);
  };

  const openMenuFor = (button, place) => {
    closeMenu();
    const menu = document.createElement('div');
    menu.className = 'place__menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = `
      <button type="button" role="menuitem" data-edit>${icon('pencil', 15)}Editar</button>
      <button type="button" role="menuitem" class="is-danger" data-delete>${icon('trash', 15)}Eliminar</button>`;
    button.setAttribute('aria-expanded', 'true');
    button.closest('.place').append(menu);
    openMenu = menu;
    menu.addEventListener('click', async event => {
      const edit = event.target.closest('[data-edit]');
      const remove = event.target.closest('[data-delete]');
      if (edit) {
        closeMenu();
        openPlaceEditor({
          place,
          onSaved: saved => {
            const next = saved ? places.map(item => (item.id === saved.id ? saved : item)) : places;
            draw(next);
          },
        });
        return;
      }
      if (!remove) return;
      remove.disabled = true;
      try {
        await removeSharedPlace(place.id);
        closeMenu();
        draw(places.filter(item => item.id !== place.id));
        note.textContent = 'Lugar eliminado para los dos.';
        toast('Lugar eliminado');
      } catch {
        remove.disabled = false;
        note.textContent = 'No se pudo eliminar el lugar.';
      }
    });
    menu.querySelector('[data-edit]')?.focus({ preventScroll: true });
  };

  el.addEventListener('click', event => {
    if (event.target.closest('[data-add]') || event.target.closest('[data-add-empty]')) {
      openPlaceEditor({ onSaved: saved => draw(saved ? [...places, saved] : places) });
      return;
    }
    const more = event.target.closest('[data-more]');
    if (more) {
      const place = places.find(item => item.id === more.closest('.place')?.dataset.id);
      if (!place) return;
      if (openMenu && more.getAttribute('aria-expanded') === 'true') { closeMenu(); return; }
      openMenuFor(more, place);
      return;
    }
    if (openMenu && !event.target.closest('.place__menu')) closeMenu();
  });

  const onKey = event => { if (event.key === 'Escape') closeMenu(); };
  document.addEventListener('keydown', onKey);

  void fetchSharedPlaces().then(draw).catch(() => {
    loaded = true;
    draw([]);
    note.textContent = 'Los lugares compartidos estarán disponibles al aplicar la migración 040.';
  });
  let stopWatch = () => {};
  void watchSharedPlaces(draw)
    .then(stop => { if (disposed) stop(); else stopWatch = stop; })
    .catch(() => { /* la consulta inicial ya avisa si falta la migración */ });

  return {
    el,
    refresh() { void fetchSharedPlaces().then(draw).catch(() => {}); },
    dispose() {
      disposed = true;
      stopWatch();
      document.removeEventListener('keydown', onKey);
      closeMenu();
    },
  };
}
