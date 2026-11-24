/* ==========================================
   DistanceMapSheet.js — el mapa de verdad.

   El panel de la portada es un dibujo (ligero, siempre visible). Al tocarlo se
   abre esta hoja: un mapa real de OpenStreetMap con las dos fotos clavadas en
   su posición, la línea entre ellas y, debajo, lo que cada móvil cuenta de sí
   mismo (batería, red, velocidad) en fichas con iconos, no en una lista de
   símbolos.

   Leaflet se importa aquí dentro: quien no abra el mapa no paga su peso, y la
   web sigue cargando igual que antes.
   ========================================== */

import { openSheet, icon } from './ui.js';
import { escapeHtml } from '../utils/escape.js';
import { getUserPref, setUserPref } from '../utils/userStorage.js';
import {
  formatDistance,
  requestLocationPermission,
  locationPermissionState,
  togetherInfo,
  TOGETHER_M,
  watchDistance,
  refreshBothLocations,
  fetchSharedPlaces,
  addSharedPlace,
  removeSharedPlace,
  updateSharedPlace,
  watchSharedPlaces,
} from '../services/location.service.js';
import {
  getDeviceStatus,
  onDeviceStatus,
  networkLabel,
  timeAgo,
  isStale,
  enableBackgroundTracking,
  disableBackgroundTracking,
  openDeviceSettings,
  openBatteryOptimizationSettings,
  openLocationSettings,
  refreshBackgroundStatus,
} from '../services/device.service.js';
import { isNative } from '../services/native.service.js';
import '../styles/distance-map.css';
import 'leaflet/dist/leaflet.css';

const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTR = '© OpenStreetMap';

/** Icono de la red que usa ese móvil. */
function netIcon(person) {
  const key = String(person.net || '').toLowerCase();
  if (key === 'wifi') return 'wifi';
  if (key === 'ethernet') return 'cloud';
  return 'signal';
}

/** Nombre de la red sin la velocidad, que va aparte y con su propia etiqueta. */
function netName(person) {
  return networkLabel({ ...person, mbps: undefined });
}

/** Cómo de buena es la conexión, en palabras. */
function netQuality(person) {
  if (!Number.isFinite(person.mbps) || person.mbps <= 0) return '';
  if (person.mbps >= 25) return 'rápida';
  if (person.mbps >= 8) return 'normal';
  return 'lenta';
}

/** Cómo de precisa es la posición. */
function accuracyQuality(meters) {
  if (!Number.isFinite(meters)) return '';
  if (meters <= 30) return 'alta';
  if (meters <= 150) return 'media';
  return 'baja';
}

/** Una ficha con icono, etiqueta y valor. */
function tile(ic, label, value, hint = '') {
  return `
    <div class="distmap__stat">
      ${icon(ic, 17)}
      <div class="distmap__stat-txt">
        <span class="distmap__stat-label">${escapeHtml(label)}</span>
        <strong class="distmap__stat-value">${escapeHtml(value)}</strong>
        ${hint ? `<span class="distmap__stat-hint">${escapeHtml(hint)}</span>` : ''}
      </div>
    </div>`;
}

/** Ficha de batería: número grande y barra de nivel. */
function batteryTile(person, stale, updated) {
  const level = Math.max(0, Math.min(100, Math.round(person.battery)));
  const tone = level <= 15 ? 'low' : level <= 40 ? 'mid' : 'ok';
  const hint = stale
    ? `Última lectura ${updated || 'antigua'}`
    : person.charging
    ? 'Cargando ahora'
    : level <= 15
      ? 'Muy baja'
      : level <= 40
        ? 'Justa'
        : 'Con margen';
  return `
    <div class="distmap__stat distmap__stat--battery">
      <div class="distmap__stat-top">
        ${icon(person.charging ? 'bolt' : 'battery', 17)}
        <span class="distmap__stat-label">Batería</span>
        <strong class="distmap__stat-value">${level}%</strong>
      </div>
      <span class="distmap__meter distmap__meter--${tone}" aria-hidden="true"><i style="width:${level}%"></i></span>
      <span class="distmap__stat-hint">${escapeHtml(hint)}</span>
    </div>`;
}

/** Una fila con la cara, cuándo se supo de ella y lo que comparte su móvil. */
function cardHTML(person, fallbackName) {
  if (!person) return '';

  const stale = isStale(person.sentAt || person.at);
  const locationStale = isStale(person.at);
  const locationDisabled = person.locationServices === 'disabled';
  const updated = timeAgo(person.sentAt || person.at);
  const locationUpdated = timeAgo(person.at);
  const locationAge = locationStale ? ' · ubicación desactualizada' : '';
  const stats = [];

  if (Number.isFinite(person.battery)) stats.push(batteryTile(person, stale, updated));

  const net = netName(person);
  if (net) {
    const mbps = Number.isFinite(person.mbps) && person.mbps > 0 ? `${Math.round(person.mbps)} Mbps estimados` : '';
    const quality = netQuality(person);
    stats.push(
      tile(netIcon(person), 'Conexión', net, stale
        ? `Última lectura ${updated || 'antigua'}`
        : [mbps, quality].filter(Boolean).join(' · ') || 'sin medir')
    );
  }

  if (Number.isFinite(person.speed)) {
    stats.push(tile('speed', 'Velocidad', `${person.speed} km/h`, stale
      ? `Última lectura ${updated || 'antigua'}`
      : locationStale ? `Última ubicación ${locationUpdated || 'antigua'}`
      : person.speed < 2 ? 'parado' : 'en marcha'));
  }

  if (Number.isFinite(person.accuracy)) {
    stats.push(
      tile('map', 'Precisión', `±${Math.round(person.accuracy)} m`, stale
        ? `Última lectura ${updated || 'antigua'}`
        : locationStale ? `Última ubicación ${locationUpdated || 'antigua'}`
        : `señal ${accuracyQuality(person.accuracy)}`)
    );
  }

  const initial = (person.name || fallbackName || '').trim().charAt(0).toUpperCase();

  return `
    <article class="distmap__card${stale ? ' is-stale' : ''}">
      <header class="distmap__card-head">
        <span class="distmap__ava">
          ${person.avatar ? `<img src="${escapeHtml(person.avatar)}" alt="" loading="lazy">` : `<span aria-hidden="true">${escapeHtml(initial || '♥')}</span>`}
        </span>
        <div class="distmap__who">
          <strong>${escapeHtml(person.name || fallbackName)}</strong>
          <span class="distmap__stamp" title="Último dato recibido del móvil">
            ${icon('clock', 11)}Datos ${escapeHtml(updated || 'sin señal')}${escapeHtml(locationAge)}
          </span>
        </div>
        <span class="distmap__live${stale ? ' is-stale' : locationDisabled ? ' is-location-off' : ''}">
          <i aria-hidden="true"></i>${stale ? 'Sin señal' : person.batteryPaused ? 'Ubicación en pausa' : locationDisabled ? 'Ubicación desactivada' : person.bg ? 'Siempre activo' : 'Al abrir'}
        </span>
      </header>
      ${stats.length ? `<div class="distmap__stats">${stats.join('')}</div>` : '<p class="distmap__empty">Este móvil no comparte batería ni conexión.</p>'}
    </article>`;
}

/** Control del seguimiento en segundo plano (solo tiene sentido en el APK). */
function trackingPanelHTML() {
  if (!isNative()) {
    return `<p class="distmap__note">${icon('info', 13)}En el navegador los datos solo se actualizan con la app abierta. En Android puedes mantenerlos siempre.</p>`;
  }
  return `
    <section class="distmap__track" aria-label="Seguimiento en segundo plano">
      <div class="distmap__track-head">
        <span class="distmap__dot" data-bg-dot></span>
        <b>Seguimiento siempre</b>
        <span class="distmap__track-state" data-bg-state>…</span>
      </div>
      <p class="distmap__track-note" data-bg-note>Estado real del servicio de Android.</p>
      <ul class="distmap__track-chips" data-bg-chips></ul>
      <div class="distmap__track-actions">
        <button class="distmap__track-btn" type="button" data-bg-toggle>Activar</button>
        <button class="distmap__track-link" type="button" data-bg-settings hidden>Ajustes de Android</button>
      </div>
    </section>`;
}

/** Pinta el panel con el estado real y conecta el botón de activar/parar. */
function wireTracking(wrap) {
  const toggle = wrap.querySelector('[data-bg-toggle]');
  if (!toggle) return () => {};

  const dot = wrap.querySelector('[data-bg-dot]');
  const stateEl = wrap.querySelector('[data-bg-state]');
  const note = wrap.querySelector('[data-bg-note]');
  const chips = wrap.querySelector('[data-bg-chips]');
  const settings = wrap.querySelector('[data-bg-settings]');
  let busy = false;

  const chip = (ic, text) => `<li>${icon(ic, 13)}<span>${escapeHtml(text)}</span></li>`;

  const render = status => {
    const bg = status?.background || {};
    // `enabled` es la intención guardada; `running` confirma que Android ya
    // mantiene el foreground service. Tras reiniciar la app puede llegar
    // antes el segundo y no debemos pedir activar algo que ya está vivo.
    const running = bg.running === true;
    const enabled = bg.enabled === true;
    const locationDisabled = bg.locationServices === 'disabled' && !bg.batteryPaused;
    toggle.textContent = running ? 'Desactivar' : enabled ? 'Reanudar' : 'Activar';
    stateEl.textContent = bg.batteryPaused ? 'Ubicación en pausa' : locationDisabled ? 'Ubicación desactivada' : running ? 'En marcha' : enabled ? 'Detenido' : 'Inactivo';
    dot.classList.toggle('is-on', running && !bg.batteryPaused && !locationDisabled);

    const items = [];
    if (Number.isFinite(status?.battery)) items.push(chip(status.charging ? 'bolt' : 'battery', `${status.battery}%`));
    const net = netName(status || {});
    if (net) items.push(chip(netIcon(status || {}), net));
    if (status?.online === false) items.push(chip('wifi', 'Sin conexión'));
    if (status?.locationPermission === 'denied') items.push(chip('shield', 'Ubicación bloqueada'));
    chips.innerHTML = items.join('');

    const needsPermission = enabled && bg.background !== 'granted';
    const needsLocationSettings = locationDisabled;
    const needsNotifications = enabled && bg.notifications === 'denied';
    const needsBatteryOptimization = enabled && running && bg.batteryUnrestricted === false;
    settings.hidden = !(needsLocationSettings || needsPermission || needsNotifications || needsBatteryOptimization);
    settings.textContent = needsLocationSettings ? 'Activar ubicación' : needsPermission ? 'Ajustes de Android' : needsNotifications ? 'Ajustes de notificaciones' : 'Optimización de batería';
    if (needsLocationSettings) {
      note.textContent = 'La ubicación del sistema está apagada. Actívala para volver a compartir posiciones.';
    } else if (needsPermission) {
      note.textContent =
        'Para seguir con la app cerrada, concede «Permitir todo el tiempo» en los ajustes de la app.';
    } else if (needsNotifications) {
      note.textContent = 'Android tiene bloqueadas las notificaciones de esta app. Actívalas para recibir avisos de tu pareja y ver el servicio activo.';
    } else if (bg.batteryPaused) {
      note.textContent = 'Batería al 20% o menos: ubicación en pausa. Se reanuda automáticamente al llegar al 30%.';
    } else if (bg.geofenceAccuracyWarning) {
      note.textContent = 'La última ubicación no tuvo precisión suficiente para comprobar los lugares compartidos. Activa la ubicación precisa o espera a una mejor señal GPS.';
    } else if (running && bg.batteryUnrestricted === false) {
      note.textContent =
        'Activo. Android puede pausarlo para ahorrar batería; quita la optimización en los ajustes para que no lo haga.';
    } else {
      note.textContent = running
        ? 'Batería, conexión y ubicación se actualizan también con la app cerrada.'
        : enabled
          ? 'El seguimiento está activado, pero Android no tiene el servicio en marcha. Reanúdalo.'
          : 'Se actualiza solo con la app abierta. Activa el seguimiento para que siga en segundo plano.';
    }
  };

  render(getDeviceStatus());
  const off = onDeviceStatus(render);

  toggle.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    toggle.disabled = true;
    try {
      const current = getDeviceStatus().background;
      if (current.running) {
        await disableBackgroundTracking();
      } else {
        const result = await enableBackgroundTracking();
        if (!result.ok) {
          note.textContent =
            result.reason === 'denied'
              ? 'Sin permiso de ubicación no se puede compartir la posición.'
              : result.reason === 'web'
                ? 'El seguimiento en segundo plano solo existe en la app de Android.'
                : 'No se pudo activar el seguimiento. Inténtalo otra vez.';
        }
      }
      await refreshBackgroundStatus();
      render(getDeviceStatus());
    } finally {
      busy = false;
      toggle.disabled = false;
    }
  });

  settings.addEventListener('click', () => {
    const bg = getDeviceStatus().background;
    if (bg.locationServices === 'disabled' && !bg.batteryPaused) {
      void openLocationSettings();
    } else if (bg.background !== 'granted' || bg.notifications === 'denied') {
      void openDeviceSettings();
    } else if (bg.background === 'granted' && bg.batteryUnrestricted === false) {
      void openBatteryOptimizationSettings();
    } else {
      void openDeviceSettings();
    }
  });

  return off;
}

/** Aviso con botón para cuando falta el permiso de ubicación. */
function permissionHTML() {
  return `
    <section class="distmap__perm" data-perm hidden>
      <span class="distmap__perm-ico">${icon('map', 18)}</span>
      <div class="distmap__perm-txt">
        <b>Falta tu ubicación</b>
        <p data-perm-note>Sin permiso no se comparte tu ubicación ni se calcula la distancia. El mapa puede seguir mostrando los datos de tu pareja.</p>
      </div>
      <button class="distmap__perm-btn" type="button" data-perm-btn>Permitir</button>
    </section>`;
}

async function wirePermission(wrap) {
  const btn = wrap.querySelector('[data-perm-btn]');
  const card = wrap.querySelector('[data-perm]');
  if (!btn || !card) return;
  const note = wrap.querySelector('[data-perm-note]');

  // El aviso solo sale si de verdad falta el permiso: mientras el navegador
  // busca la posición no hay nada que pedir todavía.
  const state = await locationPermissionState();
  if (state === 'prompt' || state === 'denied') {
    card.hidden = false;
    if (state === 'denied') {
      btn.textContent = 'Ajustes';
      btn.dataset.mode = 'settings';
      note.textContent =
        'Está bloqueada en los ajustes del móvil. Actívala ahí y vuelve a abrir el mapa.';
    }
  }
  btn.addEventListener('click', async () => {
    // Si ya está bloqueada, el diálogo no vuelve a salir: solo quedan ajustes.
    if (btn.dataset.mode === 'settings') {
      void openDeviceSettings();
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Pidiendo…';
    const granted = await requestLocationPermission(status => {
      if (status === 'denied') {
        note.textContent = 'Está bloqueada en los ajustes del móvil: actívala ahí y vuelve a abrir el mapa.';
        btn.textContent = 'Ajustes';
        btn.disabled = false;
        btn.dataset.mode = 'settings';
      } else if (status === 'error') {
        note.textContent = 'No se pudo leer la ubicación. Prueba otra vez en un momento.';
        btn.textContent = 'Reintentar';
        btn.disabled = false;
      }
    });
    if (granted) {
      btn.textContent = 'Listo';
      note.textContent = 'Permiso concedido. Tu posición aparecerá en el mapa en unos segundos.';
    }
  });
}

/** Las dos caras juntas, para cuando comparten sitio. */
function pairPin(L, me, partner) {
  const face = (person, role) => {
    const initial = (person.name || '').trim().charAt(0).toUpperCase();
    return `<span class="distmap__pair-face distmap__pair-face--${role}">${
      person.avatar
        ? `<img src="${escapeHtml(person.avatar)}" alt="">`
        : `<span>${escapeHtml(initial || '♥')}</span>`
    }</span>`;
  };
  return L.divIcon({
    className: 'distmap__pin distmap__pin--pair',
    html: `<span class="distmap__pair">${face(me, 'me')}${face(partner, 'them')}<span class="distmap__pin-tag">Juntos</span></span>`,
    iconSize: [86, 64],
    iconAnchor: [43, 32],
  });
}

/** Chincheta con la foto, el color de cada uno y su nombre debajo. */
function avatarPin(L, person, role, label) {
  const initial = (person.name || label || '').trim().charAt(0).toUpperCase();
  const inner = person.avatar
    ? `<img src="${escapeHtml(person.avatar)}" alt="">`
    : `<span class="distmap__pin-initial">${escapeHtml(initial || '♥')}</span>`;
  return L.divIcon({
    className: `distmap__pin distmap__pin--${role}`,
    html: `
      <span class="distmap__pin-wrap">
        <span class="distmap__pin-ring">${inner}</span>
        <span class="distmap__pin-tag">${escapeHtml(person.name || label)}</span>
      </span>`,
    iconSize: [64, 64],
    iconAnchor: [32, 32],
  });
}

async function paint(wrap, me, partner) {
  const canvas = wrap.querySelector('#distmapCanvas');
  if (!canvas) return;

  const points = [
    me && Number.isFinite(me.lat) && Number.isFinite(me.lng) ? { ...me, __role: 'me', __label: 'Tú' } : null,
    partner && Number.isFinite(partner.lat) && Number.isFinite(partner.lng)
      ? { ...partner, __role: 'them', __label: 'Tu pareja' }
      : null,
  ].filter(Boolean);

  const places = wrap._places || [];
  wrap._hasLocationData = points.length > 0 || places.length > 0;

  const mod = await import('leaflet');
  const L = mod.default || mod;
  wrap._leaflet = L;
  const isNewMap = !wrap._map;
  if (isNewMap) {
    // Quita el estado vacío antes de que Leaflet cree panes, controles y tile
    // layer. Limpiarlo después elimina todo el árbol interno y deja un mapa
    // interactivo pero completamente negro.
    canvas.classList.remove('is-empty');
    canvas.replaceChildren();
  }
  const map = wrap._map || L.map(canvas, {
    zoomControl: false,
    scrollWheelZoom: false,
    attributionControl: true,
    dragging: true,
    touchZoom: true,
  });
  wrap._map = map;
  if (isNewMap) {
    const tileLayer = L.tileLayer(TILES, { maxZoom: 19, attribution: ATTR });
    wrap._mapReady = false;
    wrap._tileError = false;
    tileLayer.on('loading', () => {
      wrap._mapReady = false;
      wrap._tileError = false;
      updateMapState(wrap);
    });
    tileLayer.on('tileerror', () => {
      wrap._tileError = true;
      updateMapState(wrap);
    });
    tileLayer.on('load', () => {
      wrap._mapReady = true;
      updateMapState(wrap);
    });
    tileLayer.addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    wrap._layers = L.layerGroup().addTo(map);
  }
  const layers = wrap._layers;
  layers.clearLayers();
  updateMapState(wrap);

  // No centraremos España genérica encima de la primera posición recibida.
  // Si el usuario ya movió el mapa antes de que llegaran datos, respetamos su
  // vista y dejamos que use «Ver ambos» cuando quiera volver a centrar.
  const centerOnFirstLocation = !wrap._hasCenteredOnData && !wrap._userMovedMap;

  // Con tu posición en el mapa, el aviso de permiso ya no pinta nada.
  if (points.some(p => p.__role === 'me')) {
    const perm = wrap.querySelector('[data-perm]');
    if (perm) perm.hidden = true;
  }

  const mine = points.find(p => p.__role === 'me');
  const theirs = points.find(p => p.__role === 'them');
  const near = togetherInfo(mine, theirs);

  if (!points.length) {
    // La vista genérica ya muestra el mapa base mientras llegan ubicaciones.
  } else if (near?.together) {
    // Si comparten sitio, dos chinchetas se taparían: una sola con las dos
    // caras y la etiqueta «Juntos», en el punto medio.
    const mid = [(mine.lat + theirs.lat) / 2, (mine.lng + theirs.lng) / 2];
    L.marker(mid, {
      icon: pairPin(L, mine, theirs),
      keyboard: false,
      zIndexOffset: 500,
    }).addTo(layers);
    if (isNewMap || centerOnFirstLocation) map.setView(mid, 17);
  } else {
    for (const person of points) {
      // Halo de precisión: dice «está por aquí», no una chincheta más.
      if (Number.isFinite(person.accuracy) && person.accuracy < 800) {
        L.circle([person.lat, person.lng], {
          radius: person.accuracy,
          color: person.__role === 'me' ? '#b0616f' : '#c65a3a',
          weight: 0,
          fillOpacity: 0.12,
        }).addTo(layers);
      }
      L.marker([person.lat, person.lng], {
        icon: avatarPin(L, person, person.__role, person.__label),
        keyboard: false,
        zIndexOffset: person.__role === 'me' ? 200 : 400,
      }).addTo(layers);
    }

    if (points.length > 1) {
      const line = points.map(p => [p.lat, p.lng]);
      L.polyline(line, { color: '#ffffff', weight: 5, opacity: 0.7 }).addTo(layers);
      L.polyline(line, { color: '#c65a3a', weight: 2, dashArray: '6 8', opacity: 0.95 }).addTo(layers);
      if (isNewMap || centerOnFirstLocation) map.fitBounds(line, { padding: [64, 64], maxZoom: 13 });
    } else {
      if (isNewMap || centerOnFirstLocation) map.setView([points[0].lat, points[0].lng], 13);
    }
    wrap._hasCenteredOnData = true;
  }
  if (isNewMap && !points.length) {
    if (places.length) map.setView([places[0].latitude, places[0].longitude], 14);
    else map.setView([40.4, -3.7], 5);
  }

  for (const place of places) {
    L.circle([place.latitude, place.longitude], {
      radius: place.radius_m,
      color: '#e8735a',
      weight: 2,
      fillOpacity: 0.08,
      interactive: false,
    }).addTo(layers);
    if (wrap._showPlaceNames) {
      const labelIcon = L.divIcon({
        className: 'distmap__place-label-icon',
        html: `<span class="distmap__place-label">${escapeHtml(place.name)}</span>`,
        iconSize: [1, 1],
        iconAnchor: [0, 0],
      });
      L.marker([place.latitude, place.longitude], { icon: labelIcon, interactive: false, keyboard: false, zIndexOffset: 600 }).addTo(layers);
    }
  }

  wrap._points = points;
  wrap._centerBoth = () => {
    const coordinates = wrap._points.map(point => [point.lat, point.lng]);
    if (coordinates.length > 1) map.fitBounds(coordinates, { padding: [64, 64], maxZoom: 15 });
    else if (coordinates.length === 1) map.setView(coordinates[0], 13);
    else if (wrap._places.length) map.setView([wrap._places[0].latitude, wrap._places[0].longitude], 14);
  };
  wrap._centerMe = () => {
    const own = wrap._points.find(point => point.__role === 'me');
    if (own) map.setView([own.lat, own.lng], Math.max(map.getZoom(), 15));
  };
  if (!wrap._mapClickBound) {
    map.on('click', event => wrap._onMapClick?.(event.latlng));
    const trackManualMovement = event => {
      if (event.originalEvent) wrap._userMovedMap = true;
    };
    map.on('dragstart zoomstart', trackManualMovement);
    wrap._mapClickBound = true;
  }

  // La hoja/ruta puede seguir cambiando de tamaño después de crear Leaflet.
  // Recalcula solo cuando el tamaño medido y el real difieren, y observa
  // cambios de layout para corregir transiciones en web y Android WebView.
  const invalidateMapSize = () => {
    if (!canvas.isConnected || !canvas.clientWidth || !canvas.clientHeight) return;
    const size = map.getSize();
    if (size.x !== canvas.clientWidth || size.y !== canvas.clientHeight) {
      map.invalidateSize({ pan: false });
    }
  };
  if (!wrap._mapResizeObserver && typeof ResizeObserver !== 'undefined') {
    wrap._mapResizeObserver = new ResizeObserver(invalidateMapSize);
    wrap._mapResizeObserver.observe(canvas);
  }
  requestAnimationFrame(() => requestAnimationFrame(invalidateMapSize));
  setTimeout(invalidateMapSize, 150);

}

function updateMapState(wrap) {
  const state = wrap.querySelector('[data-map-state]');
  if (!state) return;
  const message = wrap._tileError
    ? 'No se pudieron cargar los mosaicos del mapa. Comprueba tu conexión.'
    : !wrap._mapReady
      ? 'Cargando mapa…'
      : !wrap._hasLocationData
        ? 'Esperando ubicaciones compartidas…'
        : '';
  state.textContent = message;
  state.hidden = !message;
}

/**
 * El contenido del mapa (sin hoja): lo usan la hoja de la portada y la
 * pantalla /mapa que abre el widget de distancia.
 * `me` y `partner` son `{ lat, lng, name, avatar, battery, charging, net, mbps, speed }`.
 */
export function distanceMapBody({ me, partner, km, meName } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'distmap';
  try {
    wrap._showPlaceNames = getUserPref('mapPlaceNames', 'true') !== 'false';
  } catch {
    wrap._showPlaceNames = true;
  }

  const header = () => {
    const near = togetherInfo(wrap._model.me, wrap._model.partner);
    const distance = near?.together
      ? `<p class="distmap__km distmap__km--together" title="La distancia es menor que el error del GPS (±${Math.round(near.margin)} m)">
            ${icon('heart', 15)}
            <span>Estáis juntos</span>
            <small>a menos de ${TOGETHER_M} m</small>
          </p>`
      : `<p class="distmap__km">
            ${icon('map', 15)}
            <span>${Number.isFinite(wrap._model.km) ? escapeHtml(formatDistance(wrap._model.km)) : '—'}</span>
            <small>de distancia</small>
          </p>`;
    return `
      <div class="distmap__head">
        ${distance}
        <span class="distmap__persons">
          <i class="distmap__swatch distmap__swatch--me" aria-hidden="true"></i>Tú
          <i class="distmap__swatch distmap__swatch--them" aria-hidden="true"></i>${escapeHtml(wrap._model.partner?.name || 'Tu pareja')}
        </span>
        <button class="distmap__refresh" type="button" data-refresh-locations>Actualizar ahora</button>
      </div>`;
  };

  wrap._model = { me, partner, km, meName };
  wrap.innerHTML = `
        ${header()}
        <div class="distmap__frame">
          <div class="distmap__canvas" id="distmapCanvas"></div>
          <p class="distmap__map-state" data-map-state role="status" aria-live="polite" hidden></p>
          <div class="distmap__mapbar" role="group" aria-label="Controles del mapa">
            <button type="button" data-map-both>Ver ambos</button>
            <button type="button" data-map-me>Mi ubicación</button>
            <button type="button" data-map-pick>Elegir lugar</button>
            <button type="button" data-place-names-toggle aria-pressed="${wrap._showPlaceNames}">${wrap._showPlaceNames ? 'Ocultar nombres' : 'Mostrar nombres'}</button>
          </div>
        </div>
        <p class="distmap__refresh-note" data-refresh-note aria-live="polite"></p>
        ${permissionHTML()}
        <section class="distmap__devices" aria-label="Los móviles">
          <h2 class="distmap__devices-title">${icon('phone', 14)}Los móviles</h2>
          <div data-device-cards>${cardHTML(me, meName || 'Tú')}${cardHTML(partner, 'Tu pareja')}</div>
          <p class="distmap__foot">${icon('info', 13)}Batería, conexión y precisión las envía cada móvil con su posición. Si falta una, ese dispositivo no la comparte.</p>
        </section>
        <section class="distmap__places" aria-label="Lugares compartidos">
          <div class="distmap__places-head"><div><h2>Lugares compartidos</h2><p>Avisa a tu pareja cuando llegues.</p></div></div>
          <form data-place-form>
            <label>Nombre del lugar<input name="name" maxlength="48" required placeholder="Casa, trabajo…"></label>
            <label>Distancia<select name="radius_m"><option value="10">10 m</option><option value="20">20 m</option><option value="50">50 m</option><option value="75">75 m</option><option value="150" selected>150 m</option><option value="300">300 m</option><option value="500">500 m</option><option value="1000">1 km</option></select></label>
            <button type="button" data-place-pick>Marcar en el mapa</button>
            <span data-place-coords>Elige un punto en el mapa.</span>
            <button type="submit">Guardar lugar</button>
          </form>
          <p class="distmap__place-note" data-place-note aria-live="polite"></p>
          <ul data-place-list></ul>
        </section>
        ${trackingPanelHTML()}
      `;
  const renderCards = () => {
    const target = wrap.querySelector('[data-device-cards]');
    if (target) target.innerHTML = `${cardHTML(wrap._model.me, wrap._model.meName || 'Tú')}${cardHTML(wrap._model.partner, 'Tu pareja')}`;
  };
  wrap._refresh = next => {
    wrap._model = { ...wrap._model, ...next };
    const head = wrap.querySelector('.distmap__head');
    if (head) head.outerHTML = header();
    renderCards();
    void paint(wrap, wrap._model.me, wrap._model.partner);
  };

  const refreshNote = wrap.querySelector('[data-refresh-note]');
  wrap.addEventListener('click', async event => {
    const refreshButton = event.target.closest('[data-refresh-locations]');
    if (!refreshButton) return;
    refreshButton.disabled = true;
    refreshButton.textContent = 'Actualizando…';
    refreshNote.textContent = 'Leyendo tu ubicación y pidiendo la de tu pareja…';
    try {
      const result = await refreshBothLocations();
      if (result.requested && !result.ownUpdated) {
        refreshNote.textContent = 'Petición enviada a tu pareja. Para actualizar tu ubicación, revisa el permiso y la señal GPS.';
      } else if (result.requested) {
        refreshNote.textContent = 'Petición enviada. El mapa se actualizará en cuanto responda su móvil.';
      } else if (result.requestError && result.ownUpdated) {
        refreshNote.textContent = 'Tu ubicación se actualizó, pero no se pudo pedir la del otro móvil. Comprueba la conexión.';
      } else if (result.requestError) {
        refreshNote.textContent = 'No se pudieron actualizar los móviles. Comprueba la conexión y los permisos de ubicación.';
      } else if (result.ok) {
        refreshNote.textContent = 'Tu ubicación está actualizada. El otro móvil no tiene seguimiento activo.';
      } else if (result.reason === 'prompt') {
        refreshNote.textContent = 'Permite el acceso a tu ubicación y vuelve a intentarlo.';
      } else if (result.reason === 'denied') {
        refreshNote.textContent = 'Activa el permiso de ubicación en los ajustes del navegador o del móvil.';
      } else {
        refreshNote.textContent = result.reason === 'location-unavailable'
          ? 'No se pudo obtener una ubicación nueva. Revisa el permiso y la señal GPS.'
          : 'No se pudo actualizar. Comprueba la conexión y vuelve a intentarlo.';
      }
      if (result.location) wrap._refresh({ me: { ...wrap._model.me, ...result.location } });
    } finally {
      refreshButton.disabled = false;
      refreshButton.textContent = 'Actualizar ahora';
    }
  });

  const pickButton = wrap.querySelector('[data-place-pick]');
  const coordinates = wrap.querySelector('[data-place-coords]');
  const placeNote = wrap.querySelector('[data-place-note]');
  const placeList = wrap.querySelector('[data-place-list]');
  const placeForm = wrap.querySelector('[data-place-form]');
  const radiusSelect = placeForm?.elements.radius_m;
  const submitPlace = placeForm?.querySelector('[type="submit"]');
  const cancelEdit = document.createElement('button');
  cancelEdit.type = 'button';
  cancelEdit.dataset.cancelPlaceEdit = '';
  cancelEdit.textContent = 'Cancelar edición';
  cancelEdit.hidden = true;
  submitPlace?.insertAdjacentElement('afterend', cancelEdit);
  const resetPlaceEditor = () => {
    placeForm.reset();
    delete placeForm.dataset.editId;
    submitPlace.textContent = 'Guardar lugar';
    cancelEdit.hidden = true;
    wrap._placeCoordinates = null;
    coordinates.textContent = 'Elige un punto en el mapa.';
  };
  const drawPlaceList = places => {
    if (disposed) return;
    wrap._places = places || [];
    placeList.innerHTML = wrap._places.map(place => `
      <li><span><b>${escapeHtml(place.name)}</b><small>Radio ${Number(place.radius_m)} m</small></span>
      <button type="button" data-edit-place="${escapeHtml(place.id)}" aria-label="Editar ${escapeHtml(place.name)}">Editar</button>
      <button type="button" data-remove-place="${escapeHtml(place.id)}" aria-label="Eliminar ${escapeHtml(place.name)}">Quitar</button></li>`).join('');
    void paint(wrap, wrap._model.me, wrap._model.partner);
  };
  wrap._onMapClick = latlng => {
    if (!wrap._pickMode) return;
    wrap._placeCoordinates = { latitude: latlng.lat, longitude: latlng.lng };
    coordinates.textContent = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
    wrap._pickMode = false;
    pickButton.textContent = 'Marcar en el mapa';
    placeNote.textContent = 'Punto seleccionado. Guarda el lugar para compartirlo.';
    const mod = wrap._leaflet;
    if (wrap._selectionMarker) wrap._map.removeLayer(wrap._selectionMarker);
    if (mod) wrap._selectionMarker = mod.circleMarker(latlng, { radius: 9, color: '#e8735a', fillOpacity: 0.9 }).addTo(wrap._map);
  };
  pickButton?.addEventListener('click', () => {
    wrap._pickMode = !wrap._pickMode;
    pickButton.textContent = wrap._pickMode ? 'Toca el mapa…' : 'Marcar en el mapa';
    placeNote.textContent = wrap._pickMode ? 'Mueve el mapa y toca el punto que quieras guardar.' : '';
  });
  wrap.querySelector('[data-map-pick]')?.addEventListener('click', () => pickButton?.click());
  wrap.querySelector('[data-map-both]')?.addEventListener('click', () => wrap._centerBoth?.());
  wrap.querySelector('[data-map-me]')?.addEventListener('click', () => wrap._centerMe?.());
  const placeNamesToggle = wrap.querySelector('[data-place-names-toggle]');
  placeNamesToggle?.addEventListener('click', () => {
    wrap._showPlaceNames = !wrap._showPlaceNames;
    placeNamesToggle.textContent = wrap._showPlaceNames ? 'Ocultar nombres' : 'Mostrar nombres';
    placeNamesToggle.setAttribute('aria-pressed', String(wrap._showPlaceNames));
    try { setUserPref('mapPlaceNames', String(wrap._showPlaceNames)); } catch { /* La preferencia visual sigue activa durante esta sesión. */ }
    void paint(wrap, wrap._model.me, wrap._model.partner);
  });
  placeForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const name = placeForm.elements.name.value.trim();
    if (!wrap._placeCoordinates) { placeNote.textContent = 'Marca primero un punto en el mapa.'; return; }
    const submit = placeForm.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const payload = { name, ...wrap._placeCoordinates, radius_m: Number(radiusSelect.value) };
      const editingId = placeForm.dataset.editId;
      const place = editingId
        ? await updateSharedPlace(editingId, payload)
        : await addSharedPlace(payload);
      drawPlaceList(editingId ? wrap._places.map(item => item.id === editingId ? place : item) : [...wrap._places, place]);
      resetPlaceEditor();
      placeNote.textContent = editingId ? 'Lugar actualizado para los dos.' : 'Lugar compartido. Tu pareja recibirá un aviso al entrar o salir del radio.';
      if (wrap._selectionMarker) { wrap._map?.removeLayer(wrap._selectionMarker); wrap._selectionMarker = null; }
    } catch {
      placeNote.textContent = 'No se pudo guardar. Comprueba la conexión y que la migración 040 esté aplicada.';
    } finally { submit.disabled = false; }
  });
  placeList?.addEventListener('click', async event => {
    const editButton = event.target.closest('[data-edit-place]');
    if (editButton) {
      const place = wrap._places.find(item => item.id === editButton.dataset.editPlace);
      if (!place) return;
      placeForm.dataset.editId = place.id;
      placeForm.elements.name.value = place.name;
      radiusSelect.value = String(place.radius_m);
      wrap._placeCoordinates = { latitude: Number(place.latitude), longitude: Number(place.longitude) };
      coordinates.textContent = `${Number(place.latitude).toFixed(5)}, ${Number(place.longitude).toFixed(5)}`;
      submitPlace.textContent = 'Guardar cambios';
      cancelEdit.hidden = false;
      placeNote.textContent = 'Puedes actualizar el nombre, el radio o marcar otro punto en el mapa.';
      wrap._map?.setView([place.latitude, place.longitude], Math.max(wrap._map.getZoom(), 15));
      return;
    }
    const button = event.target.closest('[data-remove-place]');
    if (!button) return;
    button.disabled = true;
    try {
      await removeSharedPlace(button.dataset.removePlace);
      drawPlaceList(wrap._places.filter(place => place.id !== button.dataset.removePlace));
      placeNote.textContent = 'Lugar eliminado para los dos.';
    } catch {
      button.disabled = false;
      placeNote.textContent = 'No se pudo eliminar el lugar.';
    }
  });
  cancelEdit.addEventListener('click', resetPlaceEditor);
  let stopPlaces = () => {};
  let disposed = false;
  void fetchSharedPlaces().then(drawPlaceList).catch(() => {
    placeNote.textContent = 'Los lugares compartidos estarán disponibles al aplicar la migración 040.';
  });
  // La pareja ve los lugares nuevos sin recargar la pantalla.
  void watchSharedPlaces(drawPlaceList)
    .then(stop => { if (disposed) stop(); else stopPlaces = stop; })
    .catch(() => { /* La consulta inicial ya comunica si falta la migración. */ });

  wirePermission(wrap);
  wrap._offStatus = wireTracking(wrap);
  requestAnimationFrame(() => void paint(wrap, me, partner));
  wrap._dispose = () => {
    disposed = true;
    stopPlaces();
    wrap._offLocations?.();
    wrap._offStatus?.();
    wrap._mapResizeObserver?.disconnect();
    wrap._mapResizeObserver = null;
    wrap._map?.remove();
  };
  return wrap;
}

/** Abre la hoja del mapa (desde el panel de la portada). */
export function openDistanceMap({ me, partner, km, meName } = {}) {
  let mapBody = null;
  let stopWatch = null;
  openSheet(
    'Dónde estáis',
    () => {
      mapBody = distanceMapBody({ me, partner, km, meName });
      stopWatch = watchDistance(({ me: own, partner: other, km: distance }) => {
        mapBody?._refresh({ me: own, partner: other, km: distance });
      });
      mapBody._offLocations = stopWatch;
      return mapBody;
    },
    () => {
      const body = document.querySelector('.distmap');
      body?._dispose?.();
    }
  );
}
