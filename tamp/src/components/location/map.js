/* ==========================================
   location/map.js — el mapa real del módulo de ubicación.

   Una sola implementación de Leaflet para las dos cosas que lo necesitan:
   la pestaña «Mapa» y la vista previa del editor de lugares. Las teselas son
   las de CARTO en modo oscuro (mismo OpenStreetMap, otro estilo), así el mapa
   no desentona con Tamp ni fuerza el oscurecimiento del WebView.

   Los controles son botones flotantes compactos de 44 px, apilados a la
   derecha: no tapan las chinchetas y dejan el mapa como protagonista.
   ========================================== */

import 'leaflet/dist/leaflet.css';
import { icon } from '../ui.js';
import { escapeHtml } from '../../utils/escape.js';

// OpenStreetMap estándar + un filtro oscuro en CSS (solo sobre la capa de
// teselas): nada de proveedores con clave ni de mapas que desentonen.
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTR = '&copy; OpenStreetMap';
const START = [40.4, -3.7];

function initialOf(person, fallback = '♥') {
  return (person?.name || '').trim().charAt(0).toUpperCase() || fallback;
}

/** Chincheta con la foto, el color de cada uno y su nombre debajo. */
function avatarPin(L, person, role) {
  const inner = person.avatar
    ? `<img src="${escapeHtml(person.avatar)}" alt="">`
    : `<span class="locmap__pin-initial">${escapeHtml(initialOf(person))}</span>`;
  return L.divIcon({
    className: `locmap__pin locmap__pin--${role}${person.stale ? ' is-stale' : ''}`,
    html: `
      <span class="locmap__pin-wrap">
        <span class="locmap__pin-ring">${inner}</span>
        <span class="locmap__pin-tag">${escapeHtml(person.name || (role === 'me' ? 'Tú' : 'Tu pareja'))}</span>
      </span>`,
    iconSize: [64, 64],
    iconAnchor: [32, 32],
  });
}

/** Las dos caras juntas, para cuando comparten sitio. */
function pairPin(L, me, partner) {
  const face = (person, role) => `<span class="locmap__pair-face locmap__pair-face--${role}">${
    person.avatar
      ? `<img src="${escapeHtml(person.avatar)}" alt="">`
      : `<span>${escapeHtml(initialOf(person))}</span>`
  }</span>`;
  const stale = me.stale || partner.stale;
  return L.divIcon({
    className: `locmap__pin locmap__pin--pair${stale ? ' is-stale' : ''}`,
    html: `<span class="locmap__pair">${face(me, 'me')}${face(partner, 'them')}<span class="locmap__pin-tag">Juntos</span></span>`,
    iconSize: [86, 64],
    iconAnchor: [43, 32],
  });
}

/**
 * Crea el mapa. Devuelve un objeto con `el` y métodos; nada se pinta hasta
 * el primer `render`, así el import de Leaflet sigue siendo perezoso.
 *
 * @param {{ picker?: boolean, onPick?: (latlng: {lat: number, lng: number}) => void }} options
 */
export function createLocationMap({ picker = false, onPick = null } = {}) {
  const el = document.createElement('div');
  el.className = `locmap${picker ? ' locmap--picker' : ''}`;
  el.innerHTML = `
    <div class="locmap__canvas" data-canvas></div>
    <p class="locmap__state" data-state role="status" aria-live="polite" hidden></p>
    ${picker
      ? '<p class="locmap__hint" data-hint>Toca el mapa para colocar el lugar</p>'
      : `<p class="locmap__toast" data-toast role="status" aria-live="polite" hidden></p>
        <div class="locmap__controls" role="group" aria-label="Controles del mapa">
          <button type="button" class="locmap__ctl" data-act="both" aria-label="Ver las dos ubicaciones" title="Ver las dos ubicaciones">${icon('compass', 17)}<span>Ambos</span></button>
          <button type="button" class="locmap__ctl" data-act="me" aria-label="Centrar en mi ubicación" title="Centrar en mi ubicación">${icon('map', 17)}<span>Yo</span></button>
          <button type="button" class="locmap__ctl" data-act="places" aria-label="Ver los lugares compartidos" title="Ver los lugares compartidos">${icon('pin', 17)}<span>Lugares</span></button>
          <button type="button" class="locmap__ctl" data-act="names" aria-pressed="true" aria-label="Ocultar los nombres" title="Mostrar u ocultar los nombres">${icon('tag', 17)}<span>Nombres</span></button>
        </div>`}
  `;

  const canvas = el.querySelector('[data-canvas]');
  const stateEl = el.querySelector('[data-state]');
  const toastEl = el.querySelector('[data-toast]');
  const hint = el.querySelector('[data-hint]');

  // Aviso pasajero para saber que el botón ha hecho algo (o por qué no).
  let toastTimer = null;
  const flash = (text, tone = '') => {
    if (!toastEl) return;
    clearTimeout(toastTimer);
    toastEl.textContent = text;
    toastEl.hidden = !text;
    toastEl.classList.toggle('is-warn', tone === 'warn');
    if (text) toastTimer = setTimeout(() => { toastEl.hidden = true; }, 5000);
  };

  let L = null;
  let map = null;
  let layers = null;
  let resizeObserver = null;
  let me = null;
  let partner = null;
  let places = [];
  let showNames = true;
  let centeredOnce = false;
  let movedByUser = false;
  let tileError = false;
  let tilesReady = false;
  let pickSelection = null;
  let disposed = false;

  const setState = () => {
    const message = tileError
      ? 'No se pudieron cargar los mosaicos del mapa. Comprueba la conexión.'
      : !tilesReady
        ? 'Cargando mapa…'
        // En el editor de lugares no hay posiciones que esperar: el aviso
        // tapaba la propia indicación de «toca el mapa».
        : picker
          ? ''
          : !me && !partner && !places.length
            ? 'Esperando ubicaciones compartidas…'
            : '';
    if (!stateEl) return;
    stateEl.textContent = message;
    stateEl.hidden = !message;
  };

  const invalidateSize = () => {
    if (!map || !canvas.isConnected || !canvas.clientWidth || !canvas.clientHeight) return;
    const size = map.getSize();
    if (size.x !== canvas.clientWidth || size.y !== canvas.clientHeight) {
      map.invalidateSize({ pan: false });
    }
  };

  // Un solo mapa por contenedor: dos renders en paralelo (el de la página y
  // el del primer watch) compartían esta promesa en vez de inicializar dos
  // veces el mismo nodo, que Leaflet rechaza.
  let mapPromise = null;

  function ensureMap() {
    if (map || disposed) return Promise.resolve(map);
    if (!mapPromise) mapPromise = createMap();
    return mapPromise;
  }

  async function createMap() {
    const mod = await import('leaflet');
    if (disposed) return null;
    L = mod.default || mod;
    canvas.replaceChildren();
    map = L.map(canvas, {
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: true,
      dragging: true,
      touchZoom: true,
    });
    const tileLayer = L.tileLayer(TILES, { maxZoom: 19, attribution: ATTR });
    tileLayer.on('loading', () => { tilesReady = false; tileError = false; setState(); });
    tileLayer.on('tileerror', () => { tileError = true; setState(); });
    tileLayer.on('load', () => { tilesReady = true; setState(); });
    tileLayer.addTo(map);
    // Zoom arriba a la derecha: abajo el sitio es de la barra de acciones.
    L.control.zoom({ position: 'topright' }).addTo(map);
    layers = L.layerGroup().addTo(map);
    map.setView(START, 5);

    map.on('click', event => onPick?.({ lat: event.latlng.lat, lng: event.latlng.lng }));
    map.on('dragstart zoomstart', event => {
      if (event.originalEvent) movedByUser = true;
    });
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(invalidateSize);
      resizeObserver.observe(canvas);
    }
    requestAnimationFrame(() => requestAnimationFrame(invalidateSize));
    return map;
  }

  function drawPickSelection() {
    if (!map || !L || !pickSelection) return;
    for (const layer of [pickSelection.marker, pickSelection.area]) {
      if (layer) map.removeLayer(layer);
    }
    const ring = L.circleMarker([pickSelection.lat, pickSelection.lng], {
      radius: 9, color: '#e8735a', fillColor: '#e8735a', fillOpacity: 0.9, weight: 2,
    }).addTo(map);
    const area = Number.isFinite(pickSelection.radius)
      ? L.circle([pickSelection.lat, pickSelection.lng], {
        radius: pickSelection.radius, color: '#e8735a', weight: 2, fillOpacity: 0.1, interactive: false,
      }).addTo(map)
      : null;
    pickSelection.marker = ring;
    pickSelection.area = area;
  }

  async function render() {
    const mapInstance = await ensureMap();
    if (!mapInstance || disposed) return;
    layers.clearLayers();
    setState();

    // El botón de nombres cuenta lo mismo que su preferencia guardada: si
    // estaba desactivada, no puede aparecer encendido.
    const namesButton = el.querySelector('[data-act="names"]');
    if (namesButton) {
      namesButton.setAttribute('aria-pressed', String(showNames));
      namesButton.setAttribute('aria-label', showNames ? 'Ocultar los nombres' : 'Mostrar los nombres');
    }

    const points = [
      me && Number.isFinite(me.lat) && Number.isFinite(me.lng) ? { ...me, __role: 'me' } : null,
      partner && Number.isFinite(partner.lat) && Number.isFinite(partner.lng) && partner.sharing !== false
        ? { ...partner, __role: 'them' }
        : null,
    ].filter(Boolean);

    const mine = points.find(p => p.__role === 'me');
    const theirs = points.find(p => p.__role === 'them');
    const together = mine && theirs && !mine.stale && !theirs.stale
      ? Math.abs(mine.lat - theirs.lat) < 0.0002 && Math.abs(mine.lng - theirs.lng) < 0.0002
      : false;

    if (!points.length) {
      if (!movedByUser && !centeredOnce) {
        if (places.length) mapInstance.setView([places[0].latitude, places[0].longitude], 14);
        else mapInstance.setView(START, 5);
      }
    } else if (together) {
      const mid = [(mine.lat + theirs.lat) / 2, (mine.lng + theirs.lng) / 2];
      L.marker(mid, { icon: pairPin(L, mine, theirs), keyboard: false, zIndexOffset: 500 }).addTo(layers);
      if (!centeredOnce && !movedByUser) { mapInstance.setView(mid, 16); centeredOnce = true; }
    } else {
      for (const person of points) {
        if (Number.isFinite(person.accuracy) && person.accuracy < 800) {
          L.circle([person.lat, person.lng], {
            radius: person.accuracy,
            color: person.__role === 'me' ? '#e8735a' : '#9aa4b2',
            weight: 0,
            fillOpacity: 0.12,
          }).addTo(layers);
        }
        L.marker([person.lat, person.lng], {
          icon: avatarPin(L, person, person.__role),
          keyboard: false,
          zIndexOffset: person.__role === 'me' ? 200 : 400,
        }).addTo(layers);
      }
      if (points.length > 1) {
        const line = points.map(p => [p.lat, p.lng]);
        L.polyline(line, { color: '#0c0c0e', weight: 6, opacity: 0.55 }).addTo(layers);
        L.polyline(line, { color: '#e8735a', weight: 2, dashArray: '6 8', opacity: 0.95 }).addTo(layers);
        if (!centeredOnce && !movedByUser) {
          mapInstance.fitBounds(line, { padding: [72, 72], maxZoom: 15 });
          centeredOnce = true;
        }
      } else if (!centeredOnce && !movedByUser) {
        mapInstance.setView([points[0].lat, points[0].lng], 14);
        centeredOnce = true;
      }
    }

    for (const place of places) {
      L.circle([place.latitude, place.longitude], {
        radius: place.radius_m, color: '#e8735a', weight: 2, fillOpacity: 0.08, interactive: false,
      }).addTo(layers);
      if (showNames) {
        const labelIcon = L.divIcon({
          className: 'locmap__place-label-icon',
          html: `<span class="locmap__place-label">${escapeHtml(place.name)}</span>`,
          iconSize: [1, 1],
          iconAnchor: [0, 0],
        });
        L.marker([place.latitude, place.longitude], {
          icon: labelIcon, interactive: false, keyboard: false, zIndexOffset: 600,
        }).addTo(layers);
      }
    }
  }

  /* ---------- acciones ---------- */

  const centerBoth = () => {
    if (!map) return;
    const coordinates = [me, partner]
      .filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.sharing !== false)
      .map(p => [p.lat, p.lng]);
    if (coordinates.length > 1) map.fitBounds(coordinates, { padding: [72, 72], maxZoom: 15 });
    else if (coordinates.length === 1) map.setView(coordinates[0], 14);
    else if (places.length) map.fitBounds(places.map(p => [p.latitude, p.longitude]), { padding: [64, 64], maxZoom: 14 });
  };

  const centerMe = () => {
    if (!map) return;
    if (me && Number.isFinite(me.lat)) map.setView([me.lat, me.lng], Math.max(map.getZoom(), 15));
    else if (partner && Number.isFinite(partner.lat)) map.setView([partner.lat, partner.lng], Math.max(map.getZoom(), 13));
  };

  const centerPlaces = () => {
    if (!map) return;
    if (!places.length) { map.flyTo(START, 5); return; }
    map.fitBounds(places.map(p => [p.latitude, p.longitude]), { padding: [64, 64], maxZoom: 15 });
  };

  /** Ubicaciones que de verdad se pueden encuadrar. */
  const mappablePoints = () => [me, partner]
    .filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.sharing !== false);

  if (!picker) {
    const namesButton = el.querySelector('[data-act="names"]');

    el.querySelector('[data-act="both"]')?.addEventListener('click', () => {
      const points = mappablePoints();
      if (!points.length) { flash('Todavía no hay ninguna ubicación', 'warn'); return; }
      centerBoth();
      flash(points.length === 1
        ? 'Solo hay una ubicación: se centra en ella'
        : 'Centrando en las dos ubicaciones');
    });

    el.querySelector('[data-act="me"]')?.addEventListener('click', () => {
      if (me?.sharing === false) { flash('Has dejado de compartir tu ubicación', 'warn'); return; }
      if (!me || !Number.isFinite(me.lat)) { flash('Todavía no hay tu ubicación', 'warn'); return; }
      centerMe();
      flash('Centrando en tu ubicación');
    });

    el.querySelector('[data-act="places"]')?.addEventListener('click', () => {
      if (!places.length) { flash('No habéis guardado ningún lugar', 'warn'); return; }
      centerPlaces();
      flash(places.length === 1 ? 'Mostrando 1 lugar' : `Mostrando ${places.length} lugares`);
    });

    namesButton?.addEventListener('click', () => {
      showNames = !showNames;
      namesButton.setAttribute('aria-pressed', String(showNames));
      namesButton.setAttribute('aria-label', showNames ? 'Ocultar los nombres' : 'Mostrar los nombres');
      el.dispatchEvent(new CustomEvent('names-change', { detail: showNames, bubbles: true }));
      void render();
      flash(showNames ? 'Nombres visibles' : 'Nombres ocultos');
    });
  }

  return {
    el,
    /** Tamaño definitivo cuando el contenedor se acaba de mostrar. */
    invalidate() { invalidateSize(); requestAnimationFrame(invalidateSize); },
    async render(model = {}) {
      if ('me' in model) me = model.me;
      if ('partner' in model) partner = model.partner;
      if ('places' in model) places = model.places || [];
      if ('showNames' in model) showNames = model.showNames !== false;
      await render();
    },
    /** Vista previa del editor: punto elegido + su área. */
    setPick(point) {
      for (const layer of [pickSelection?.marker, pickSelection?.area]) {
        if (layer && map) map.removeLayer(layer);
      }
      if (!point) { pickSelection = null; return; }
      if (hint) hint.hidden = true;
      pickSelection = { lat: point.lat, lng: point.lng, radius: point.radius, marker: null, area: null };
      if (map) drawPickSelection();
      else void ensureMap().then(() => drawPickSelection());
    },
    focus(lat, lng, zoom = 15) { map?.setView([lat, lng], zoom); },
    dispose() {
      disposed = true;
      resizeObserver?.disconnect();
      resizeObserver = null;
      map?.remove();
      map = null;
      mapPromise = null;
    },
  };
}
