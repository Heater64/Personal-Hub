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
import {
  formatDistance,
  requestLocationPermission,
  locationPermissionState,
  togetherInfo,
  TOGETHER_M,
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
  refreshBackgroundStatus,
} from '../services/device.service.js';
import { isNative } from '../services/native.service.js';
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
function batteryTile(person) {
  const level = Math.max(0, Math.min(100, Math.round(person.battery)));
  const tone = level <= 15 ? 'low' : level <= 40 ? 'mid' : 'ok';
  const hint = person.charging
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

  const stale = isStale(person.at);
  const updated = timeAgo(person.at);
  const stats = [];

  if (Number.isFinite(person.battery)) stats.push(batteryTile(person));

  const net = netName(person);
  if (net) {
    const mbps = Number.isFinite(person.mbps) && person.mbps > 0 ? `${Math.round(person.mbps)} Mbps` : '';
    const quality = netQuality(person);
    stats.push(
      tile(netIcon(person), 'Conexión', net, [mbps, quality].filter(Boolean).join(' · ') || 'sin medir')
    );
  }

  if (Number.isFinite(person.speed)) {
    stats.push(tile('speed', 'Velocidad', `${person.speed} km/h`, person.speed < 2 ? 'parado' : 'en marcha'));
  }

  if (Number.isFinite(person.accuracy)) {
    stats.push(
      tile('map', 'Precisión', `±${Math.round(person.accuracy)} m`, `señal ${accuracyQuality(person.accuracy)}`)
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
          <span class="distmap__stamp">
            ${icon('clock', 11)}${escapeHtml(updated || 'sin hora')}
          </span>
        </div>
        <span class="distmap__live${stale ? ' is-stale' : ''}">
          <i aria-hidden="true"></i>${stale ? 'Sin señal' : person.bg ? 'En vivo' : 'Al abrir'}
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

  const chip = (ic, text) => `<li>${icon(ic, 13)}<span>${escapeHtml(text)}</span></li>`;

  const render = status => {
    const bg = status?.background || {};
    // `enabled` es la intención guardada; `running` confirma que Android ya
    // mantiene el foreground service. Tras reiniciar la app puede llegar
    // antes el segundo y no debemos pedir activar algo que ya está vivo.
    const on = !!(bg.enabled || bg.running);
    toggle.textContent = on ? 'Desactivar' : 'Activar';
    stateEl.textContent = on ? 'Activo' : 'Inactivo';
    dot.classList.toggle('is-on', on);

    const items = [];
    if (Number.isFinite(status?.battery)) items.push(chip(status.charging ? 'bolt' : 'battery', `${status.battery}%`));
    const net = netName(status || {});
    if (net) items.push(chip(netIcon(status || {}), net));
    if (status?.online === false) items.push(chip('wifi', 'Sin conexión'));
    if (status?.locationPermission === 'denied') items.push(chip('shield', 'Ubicación bloqueada'));
    chips.innerHTML = items.join('');

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
      const current = getDeviceStatus().background;
      if (current.enabled || current.running) {
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

/** Aviso con botón para cuando falta el permiso de ubicación. */
function permissionHTML() {
  return `
    <section class="distmap__perm" data-perm hidden>
      <span class="distmap__perm-ico">${icon('map', 18)}</span>
      <div class="distmap__perm-txt">
        <b>Falta tu ubicación</b>
        <p data-perm-note>Sin permiso no hay distancia ni mapa. Solo se comparte mientras la app está abierta.</p>
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

  if (!points.length) {
    canvas.classList.add('is-empty');
    canvas.innerHTML = `${icon('map', 26)}<span>Todavía no hay ninguna ubicación que enseñar.</span>`;
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

  // Con tu posición en el mapa, el aviso de permiso ya no pinta nada.
  if (points.some(p => p.__role === 'me')) {
    const perm = wrap.querySelector('[data-perm]');
    if (perm) perm.hidden = true;
  }

  const mine = points.find(p => p.__role === 'me');
  const theirs = points.find(p => p.__role === 'them');
  const near = togetherInfo(mine, theirs);

  if (near?.together) {
    // Si comparten sitio, dos chinchetas se taparían: una sola con las dos
    // caras y la etiqueta «Juntos», en el punto medio.
    const mid = [(mine.lat + theirs.lat) / 2, (mine.lng + theirs.lng) / 2];
    L.marker(mid, {
      icon: pairPin(L, mine, theirs),
      keyboard: false,
      zIndexOffset: 500,
    }).addTo(map);
    map.setView(mid, 17);
  } else {
    for (const person of points) {
      // Halo de precisión: dice «está por aquí», no una chincheta más.
      if (Number.isFinite(person.accuracy) && person.accuracy < 800) {
        L.circle([person.lat, person.lng], {
          radius: person.accuracy,
          color: person.__role === 'me' ? '#b0616f' : '#c65a3a',
          weight: 0,
          fillOpacity: 0.12,
        }).addTo(map);
      }
      L.marker([person.lat, person.lng], {
        icon: avatarPin(L, person, person.__role, person.__label),
        keyboard: false,
        zIndexOffset: person.__role === 'me' ? 200 : 400,
      }).addTo(map);
    }

    if (points.length > 1) {
      const line = points.map(p => [p.lat, p.lng]);
      L.polyline(line, { color: '#ffffff', weight: 5, opacity: 0.7 }).addTo(map);
      L.polyline(line, { color: '#c65a3a', weight: 2, dashArray: '6 8', opacity: 0.95 }).addTo(map);
      map.fitBounds(line, { padding: [64, 64], maxZoom: 13 });
    } else {
      map.setView([points[0].lat, points[0].lng], 13);
    }
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

  const near = togetherInfo(me, partner);
  const distance = near?.together
    ? `<p class="distmap__km distmap__km--together" title="La distancia es menor que el error del GPS (±${Math.round(near.margin)} m)">
            ${icon('heart', 15)}
            <span>Estáis juntos</span>
            <small>a menos de ${TOGETHER_M} m</small>
          </p>`
    : `<p class="distmap__km">
            ${icon('map', 15)}
            <span>${Number.isFinite(km) ? escapeHtml(formatDistance(km)) : '—'}</span>
            <small>de distancia</small>
          </p>`;

  wrap.innerHTML = `
        <div class="distmap__head">
          ${distance}
          <span class="distmap__persons">
            <i class="distmap__swatch distmap__swatch--me" aria-hidden="true"></i>Tú
            <i class="distmap__swatch distmap__swatch--them" aria-hidden="true"></i>${escapeHtml(partner?.name || 'Ella')}
          </span>
        </div>
        <div class="distmap__frame">
          <div class="distmap__canvas" id="distmapCanvas"></div>
        </div>
        ${permissionHTML()}
        <section class="distmap__devices" aria-label="Los móviles">
          <h2 class="distmap__devices-title">${icon('phone', 14)}Los móviles</h2>
          ${cardHTML(me, meName || 'Tú')}
          ${cardHTML(partner, 'La otra persona')}
          <p class="distmap__foot">${icon('info', 13)}Batería, conexión y precisión las envía cada móvil con su posición. Si falta una, ese dispositivo no la comparte.</p>
        </section>
        ${trackingPanelHTML()}
      `;
  wirePermission(wrap);
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
