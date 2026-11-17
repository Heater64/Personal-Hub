/* ==========================================
   DistanceMapSheet.js — el mapa de verdad.

   El panel de la portada es un dibujo (ligero, siempre visible). Al tocarlo se
   abre esta hoja: un mapa real de OpenStreetMap con las dos fotos clavadas en
   su posición, la línea entre ellas y, debajo, lo que cada móvil cuenta de sí
   mismo (batería, red, velocidad).

   Leaflet se importa aquí dentro: quien no abra el mapa no paga su peso, y la
   web sigue cargando igual que antes.
   ========================================== */

import { openSheet } from './ui.js';
import { escapeHtml } from '../utils/escape.js';
import { formatDistance } from '../services/location.service.js';
import {
  getDeviceStatus,
  onDeviceStatus,
  networkLabel,
  timeAgo,
  isStale,
  enableBackgroundTracking,
  disableBackgroundTracking,
  openDeviceSettings,
  refreshBackgroundStatus,
} from '../services/device.service.js';
import { isNative } from '../services/native.service.js';
import 'leaflet/dist/leaflet.css';

const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTR = '© OpenStreetMap';

/** Una fila con la cara y los datos que ese móvil comparte. */
function cardHTML(person, fallbackName) {
  if (!person) return '';
  const bits = [];
  if (Number.isFinite(person.battery))
    bits.push(`${person.charging ? '⚡' : '🔋'} ${person.battery}%`);
  const net = networkLabel(person);
  if (net) bits.push(net);
  if (Number.isFinite(person.speed)) bits.push(`${person.speed} km/h`);
  if (Number.isFinite(person.accuracy)) bits.push(`±${Math.round(person.accuracy)} m`);

  const updated = timeAgo(person.at);
  const stale = isStale(person.at);
  const stamp = updated
    ? stale
      ? `Última vez ${updated}`
      : `${person.bg ? 'Seguimiento activo' : 'Al abrir la app'} · ${updated}`
    : '';

  return `
    <article class="distmap__card${stale ? ' is-stale' : ''}">
      <span class="distmap__ava">
        ${person.avatar ? `<img src="${escapeHtml(person.avatar)}" alt="">` : '<span aria-hidden="true">♥</span>'}
      </span>
      <div class="distmap__body">
        <strong>${escapeHtml(person.name || fallbackName)}</strong>
        <span>${bits.length ? escapeHtml(bits.join(' · ')) : 'sin datos del móvil'}</span>
        ${stamp ? `<span class="distmap__stamp${stale ? ' is-stale' : ''}">${escapeHtml(stamp)}</span>` : ''}
      </div>
    </article>`;
}

/** Control del seguimiento en segundo plano (solo tiene sentido en el APK). */
function trackingPanelHTML() {
  if (!isNative()) {
    return `<p class="distmap__note">En el navegador el estado solo se actualiza con la app abierta. En la app de Android puedes mantenerlo siempre.</p>`;
  }
  return `
    <section class="distmap__track" aria-label="Seguimiento en segundo plano">
      <div class="distmap__track-head">
        <span class="distmap__dot" data-bg-dot></span>
        <b>Seguimiento siempre</b>
        <span class="distmap__track-state" data-bg-state>…</span>
      </div>
      <p class="distmap__track-note" data-bg-note>Batería, conexión y ubicación también con la app cerrada.</p>
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

  const render = status => {
    const bg = status?.background || {};
    const on = !!bg.enabled;
    toggle.textContent = on ? 'Desactivar' : 'Activar';
    stateEl.textContent = on ? 'Activo' : 'Inactivo';
    dot.classList.toggle('is-on', on);

    const items = [];
    if (Number.isFinite(status?.battery))
      items.push(`${status.charging ? '⚡' : '🔋'} ${status.battery}%`);
    const net = networkLabel(status || {});
    if (net) items.push(`📶 ${net}`);
    if (status?.online === false) items.push('Sin conexión');
    if (status?.locationPermission === 'denied') items.push('Ubicación bloqueada');
    chips.innerHTML = items.map(text => `<li>${escapeHtml(text)}</li>`).join('');

    const needsPermission = on && bg.background !== 'granted';
    settings.hidden = !needsPermission;
    if (needsPermission) {
      note.textContent =
        'Para seguir con la app cerrada, concede «Permitir todo el tiempo» en los ajustes de la app.';
    } else if (on && bg.batteryUnrestricted === false) {
      note.textContent =
        'Activo. Android puede pausarlo para ahorrar batería; quita la optimización en los ajustes para que no lo haga.';
    } else {
      note.textContent = on
        ? 'Batería, conexión y ubicación se actualizan también con la app cerrada.'
        : 'Se actualiza solo con la app abierta. Actívalo para que siga en segundo plano.';
    }
  };

  render(getDeviceStatus());
  const off = onDeviceStatus(render);

  toggle.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    toggle.disabled = true;
    try {
      if (getDeviceStatus().background.enabled) {
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

  settings.addEventListener('click', () => void openDeviceSettings());

  return off;
}

/** Chincheta circular con la foto. */
function avatarPin(L, person) {
  return L.divIcon({
    className: 'distmap__pin',
    html: `<span class="distmap__pin-ring">${
      person.avatar ? `<img src="${escapeHtml(person.avatar)}" alt="">` : '<span>♥</span>'
    }</span>`,
    iconSize: [56, 56],
    iconAnchor: [28, 28],
  });
}

async function paint(wrap, me, partner) {
  const canvas = wrap.querySelector('#distmapCanvas');
  if (!canvas) return;

  const points = [me, partner].filter(p => Number.isFinite(p?.lat) && Number.isFinite(p?.lng));

  if (!points.length) {
    canvas.classList.add('is-empty');
    canvas.textContent = 'Todavía no hay ubicación. Abre la app con el permiso concedido.';
    return;
  }

  const mod = await import('leaflet');
  const L = mod.default || mod;

  const map = L.map(canvas, {
    zoomControl: false,
    scrollWheelZoom: false,
    attributionControl: true,
  });

  L.tileLayer(TILES, { maxZoom: 19, attribution: ATTR }).addTo(map);

  for (const person of points) {
    L.marker([person.lat, person.lng], {
      icon: avatarPin(L, person),
      keyboard: false,
    }).addTo(map);
  }

  if (points.length > 1) {
    L.polyline(
      points.map(p => [p.lat, p.lng]),
      { color: '#ff9db3', weight: 2, dashArray: '5 7', opacity: 0.9 }
    ).addTo(map);
    map.fitBounds(
      points.map(p => [p.lat, p.lng]),
      { padding: [52, 52], maxZoom: 13 }
    );
  } else {
    map.setView([points[0].lat, points[0].lng], 13);
  }

  // La hoja termina de montarse después de crear el mapa: sin este empujón
  // Leaflet mide 0×0 y las teselas salen a medias.
  setTimeout(() => map.invalidateSize(), 150);

  wrap._map = map;
}

/**
 * El contenido del mapa (sin hoja): lo usan la hoja de la portada y la
 * pantalla /mapa que abre el widget de distancia.
 * `me` y `partner` son `{ lat, lng, name, avatar, battery, charging, net, mbps, speed }`.
 */
export function distanceMapBody({ me, partner, km, meName } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'distmap';
  wrap.innerHTML = `
        <p class="distmap__km">${
          Number.isFinite(km)
            ? `${escapeHtml(formatDistance(km))} de distancia`
            : 'Sin distancia todavía'
        }</p>
        <div class="distmap__canvas" id="distmapCanvas"></div>
        <div class="distmap__cards">
          ${cardHTML(me, meName || 'Tú')}
          ${cardHTML(partner, 'La otra persona')}
        </div>
        ${trackingPanelHTML()}
      `;
  wrap._offStatus = wireTracking(wrap);
  requestAnimationFrame(() => void paint(wrap, me, partner));
  return wrap;
}

/** Abre la hoja del mapa (desde el panel de la portada). */
export function openDistanceMap({ me, partner, km, meName } = {}) {
  openSheet(
    'Dónde estáis',
    () => distanceMapBody({ me, partner, km, meName }),
    () => {
      const body = document.querySelector('.distmap');
      body?._offStatus?.();
      body?._map?.remove();
    }
  );
}
