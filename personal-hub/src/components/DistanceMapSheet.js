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
import 'leaflet/dist/leaflet.css';

const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTR = '© OpenStreetMap';

const NET_NAMES = {
  wifi: 'Wi-Fi',
  ethernet: 'Cable',
  cellular: 'Datos',
  '4g': '4G',
  '3g': '3G',
  '2g': '2G',
  slow2g: '2G',
};

function netLabel(person) {
  const key = String(person.net || '').toLowerCase();
  const base = NET_NAMES[key] || (key ? key.toUpperCase() : '');
  return Number.isFinite(person.mbps) && person.mbps > 0
    ? `${base} · ${Math.round(person.mbps)} Mbps`
    : base;
}

/** Una fila con la cara y los datos que ese móvil comparte. */
function cardHTML(person, fallbackName) {
  if (!person) return '';
  const bits = [];
  if (Number.isFinite(person.battery))
    bits.push(`${person.charging ? '⚡' : '🔋'} ${person.battery}%`);
  const net = netLabel(person);
  if (net) bits.push(net);
  if (Number.isFinite(person.speed)) bits.push(`${person.speed} km/h`);

  return `
    <article class="distmap__card">
      <span class="distmap__ava">
        ${person.avatar ? `<img src="${escapeHtml(person.avatar)}" alt="">` : '<span aria-hidden="true">♥</span>'}
      </span>
      <div class="distmap__body">
        <strong>${escapeHtml(person.name || fallbackName)}</strong>
        <span>${bits.length ? escapeHtml(bits.join(' · ')) : 'sin datos del móvil'}</span>
      </div>
    </article>`;
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
        <p class="distmap__note">Las posiciones son las últimas que compartió cada móvil al abrir la app.</p>
      `;
  requestAnimationFrame(() => void paint(wrap, me, partner));
  return wrap;
}

/** Abre la hoja del mapa (desde el panel de la portada). */
export function openDistanceMap({ me, partner, km, meName } = {}) {
  openSheet(
    'Dónde estáis',
    () => distanceMapBody({ me, partner, km, meName }),
    () => {
      const map = document.querySelector('.distmap')?._map;
      map?.remove();
    }
  );
}
