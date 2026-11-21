import { openSheet, icon } from './ui.js';
import { escapeHtml } from '../utils/escape.js';
import {
  distanceKm,
  fetchMyLocation,
  fetchProfile,
  formatDistance,
  isFresh,
  requestLocationPermission,
  locationPermissionState,
  togetherInfo,
  watchDistance,
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
import '../styles/distance-map.css';

const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function hasPosition(person) {
  return Number.isFinite(person?.lat) && Math.abs(person.lat) <= 90
    && Number.isFinite(person?.lng) && Math.abs(person.lng) <= 180;
}

function hasFreshPosition(person) {
  return hasPosition(person) && isFresh(person.location_at || person.at);
}

function togetherAtCurrentPosition(me, partner) {
  return hasFreshPosition(me) && hasFreshPosition(partner) && togetherInfo(me, partner)?.together;
}

/** Icono de la red que usa ese móvil. */
function netIcon(person) {
  const key = String(person.net || '').toLowerCase();
  if (key === 'wifi') return 'wifi';
  if (key === 'ethernet') return 'cloud';
  return 'signal';
}

/** Nombre de la red sin la velocidad, que va aparte y con su propia etiqueta. */
function netName(person) {
  if (person.net === 'offline') return 'Sin conexión';
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
    ? 'En carga'
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
function cardHTML(person, fallbackName, local = false) {
  const at = person.location_at || person.at;
  const known = hasPosition(person);
  const stale = !hasFreshPosition(person);
  const updated = known && timeAgo(at);
  const sentAt = person.sentAt || person.at;
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
    stats.push(tile('speed', 'Velocidad', `${person.speed} km/h`, stale ? 'última lectura' : ''));
  }

  if (Number.isFinite(person.accuracy)) {
    stats.push(
      tile('map', 'Precisión', `±${Math.round(person.accuracy)} m`, `señal ${accuracyQuality(person.accuracy)}`)
    );
  }

  const initial = (person.name || fallbackName || '').trim().charAt(0).toUpperCase();

  return `
    <article class="distmap__card">
      <header class="distmap__card-head">
        <span class="distmap__ava">
          ${person.avatar ? `<img src="${escapeHtml(person.avatar)}" alt="" loading="lazy">` : `<span aria-hidden="true">${escapeHtml(initial || '♥')}</span>`}
        </span>
        <div class="distmap__who">
          <strong>${escapeHtml(person.name || fallbackName)}</strong>
          <span class="distmap__stamp">${updated ? `Ubicación ${escapeHtml(updated)}` : 'Sin ubicación recibida'}</span>
        </div>
        <span class="distmap__live${stale ? ' is-stale' : ''}">
          <i aria-hidden="true"></i>${known ? (stale ? 'Última conocida' : 'Reciente') : 'Pendiente'}
        </span>
      </header>
      ${stats.length ? `<div class="distmap__stats">${stats.join('')}</div>` : ''}
      ${!local && (Number.isFinite(person.battery) || net)
        ? `<p class="distmap__stamp">Batería y conexión ${escapeHtml(timeAgo(sentAt) || 'sin hora de envío')}${sentAt && isStale(sentAt) ? ' · última lectura' : ''}</p>`
        : ''}
    </article>`;
}

/** Control del seguimiento en segundo plano (solo tiene sentido en el APK). */
function trackingPanelHTML() {
  if (!isNative()) {
    return `<p class="distmap__note">${icon('info', 15)}En el navegador, tu ubicación se actualiza mientras la app está visible.</p>`;
  }
  return `
    <section class="distmap__track" aria-label="Seguimiento en segundo plano">
      <div class="distmap__track-head">
        <span class="distmap__dot" data-bg-dot></span>
        <b>Seguimiento en segundo plano</b>
        <span class="distmap__track-state" data-bg-state role="status">Comprobando…</span>
      </div>
      <p class="distmap__track-note" data-bg-note></p>
      <p class="distmap__track-note distmap__track-error" data-bg-error role="status" hidden></p>
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
  const error = wrap.querySelector('[data-bg-error]');
  const settings = wrap.querySelector('[data-bg-settings]');
  let busy = false;
  let previousRunning = false;

  const showError = message => {
    error.hidden = !message;
    error.textContent = message;
  };

  const render = status => {
    const bg = status?.background || {};
    const on = !!(bg.enabled || bg.running);
    const noLocation = bg.location === 'denied' || bg.locationServices === 'disabled';
    const needsPermission = on && bg.background !== 'granted';
    toggle.textContent = on ? 'Desactivar' : 'Activar';
    const liveLabel = status?.online === false ? 'Sin conexión' : 'En marcha';
    const label = bg.running ? liveLabel : on ? 'En pausa' : 'Desactivado';
    if (stateEl.textContent !== label) stateEl.textContent = label;
    dot.classList.toggle('is-on', bg.running && status?.online !== false && !noLocation);
    settings.hidden = !on || (!needsPermission && bg.location !== 'denied');
    if (bg.running && !previousRunning) showError('');
    previousRunning = bg.running;

    if (!on) {
      note.textContent = 'Mantén al día la ubicación, la batería y la conexión al salir de la app.';
    } else if (bg.locationServices === 'disabled') {
      note.textContent = 'Activa Ubicación en los ajustes rápidos de Android para actualizar tu posición.';
    } else if (needsPermission || bg.location === 'denied') {
      note.textContent = 'En los ajustes de Android, elige Ubicación y «Permitir todo el tiempo».';
    } else if (status?.online === false) {
      note.textContent = 'Los datos volverán a enviarse al recuperar la conexión.';
    } else if (!bg.running) {
      note.textContent = 'Android ha detenido el seguimiento. Puedes desactivarlo y volver a activarlo.';
    } else if (bg.lastError === 'waiting-location') {
      note.textContent = 'Esperando la primera ubicación de Android.';
    } else if (bg.lastError === 'session') {
      note.textContent = 'Vuelve a iniciar sesión para reanudar los envíos.';
    } else if (bg.lastError === 'upload-failed') {
      note.textContent = 'El último envío falló. La app volverá a intentarlo.';
    } else if (bg.lastAt) {
      note.textContent = `Último envío confirmado ${timeAgo(bg.lastAt)}.`;
    } else {
      note.textContent = 'Comparte tu ubicación, tu batería y tu conexión en segundo plano.';
    }
  };

  const off = onDeviceStatus(render);

  toggle.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    toggle.disabled = true;
    showError('');
    try {
      const current = getDeviceStatus().background;
      if (current.enabled || current.running) {
        if (!(await disableBackgroundTracking())) showError('No se pudo desactivar. Inténtalo otra vez.');
      } else {
        const result = await enableBackgroundTracking();
        if (!result.ok) {
          const messages = {
            denied: 'Concede el permiso de ubicación para activar el seguimiento.',
            'location-disabled': 'Activa Ubicación en los ajustes rápidos de Android.',
            session: 'Se necesita una sesión activa y conexión para activar el seguimiento.',
          };
          showError(messages[result.reason] || 'No se pudo activar el seguimiento. Inténtalo otra vez.');
        }
      }
      await refreshBackgroundStatus();
    } catch {
      showError('No se pudo cambiar el seguimiento. Inténtalo otra vez.');
    } finally {
      busy = false;
      toggle.disabled = false;
    }
  });

  settings.addEventListener('click', async () => {
    if (!(await openDeviceSettings())) showError('Abre el permiso de ubicación en los ajustes de Android.');
  });

  return off;
}

/** Aviso con botón para cuando falta el permiso de ubicación. */
function permissionHTML() {
  return `
    <section class="distmap__perm" data-perm hidden>
      <span class="distmap__perm-ico">${icon('map', 18)}</span>
      <div class="distmap__perm-txt">
        <b data-perm-title>Comparte tu ubicación</b>
        <p data-perm-note role="status"></p>
      </div>
      <button class="distmap__perm-btn" type="button" data-perm-btn>Permitir</button>
    </section>`;
}

function wirePermission(wrap) {
  const btn = wrap.querySelector('[data-perm-btn]');
  const card = wrap.querySelector('[data-perm]');
  const title = wrap.querySelector('[data-perm-title]');
  const note = wrap.querySelector('[data-perm-note]');
  let state = 'unknown';
  let pending = false;
  let disposed = false;
  let checked = 0;

  const render = () => {
    const disabled = isNative() && getDeviceStatus().background.locationServices === 'disabled';
    const denied = state === 'denied';
    card.hidden = !pending && !disabled && !['prompt', 'denied', 'error'].includes(state);
    btn.disabled = pending;
    btn.hidden = denied && !isNative();
    if (pending) {
      btn.textContent = 'Comprobando…';
      title.textContent = 'Comparte tu ubicación';
      note.textContent = 'Esperando el permiso y una lectura de ubicación.';
      return;
    }
    if (denied) {
      btn.textContent = 'Ajustes';
      title.textContent = 'Ubicación bloqueada';
      note.textContent = isNative()
        ? 'Permite el acceso a la ubicación en los ajustes de la app.'
        : 'Permite la ubicación en los ajustes del sitio de tu navegador y recarga.';
      return;
    }
    if (disabled || state === 'error') {
      btn.textContent = 'Reintentar';
      title.textContent = 'Ubicación no disponible';
      note.textContent = disabled
        ? 'Activa Ubicación en los ajustes rápidos de Android y vuelve a intentarlo.'
        : 'Comprueba la ubicación y la conexión antes de reintentar.';
      return;
    }
    btn.textContent = 'Permitir';
    title.textContent = 'Comparte tu ubicación';
    note.textContent = 'Permite el acceso para mostrar tu posición y la distancia.';
  };

  const set = next => {
    if (!next || disposed) return;
    checked++;
    state = next === 'ok' ? 'granted' : next;
    render();
  };

  const refresh = async () => {
    if (pending || disposed) return;
    const current = ++checked;
    const next = await locationPermissionState();
    if (disposed || checked !== current || next === 'unknown') return;
    if (next === 'granted' && state === 'error') {
      render();
      return;
    }
    set(next);
  };
  const resume = () => {
    if (!document.hidden) void refresh();
  };
  document.addEventListener('visibilitychange', resume);
  void refresh();

  btn.addEventListener('click', async () => {
    if (pending || disposed) return;
    if (state === 'denied') {
      if (!(await openDeviceSettings())) note.textContent = 'Abre el permiso de ubicación en los ajustes de Android.';
      return;
    }
    checked++;
    pending = true;
    render();
    let result;
    try {
      const granted = await requestLocationPermission(status => { result = status; });
      set(result || (granted ? 'granted' : 'prompt'));
    } catch {
      set('error');
    } finally {
      pending = false;
      if (!disposed) render();
    }
  });

  return {
    set,
    render,
    cleanup() {
      disposed = true;
      document.removeEventListener('visibilitychange', resume);
    },
  };
}

/** Las dos caras juntas, para cuando comparten sitio. */
function pairPin(L, me, partner, current) {
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
    html: `<span class="distmap__pair">${face(me, 'me')}${face(partner, 'them')}<span class="distmap__pin-tag">${current ? 'Juntos' : 'Últimas ubicaciones'}</span></span>`,
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
    className: `distmap__pin distmap__pin--${role}${hasFreshPosition(person) ? '' : ' is-stale'}`,
    html: `
      <span class="distmap__pin-wrap">
        <span class="distmap__pin-ring">${inner}</span>
        <span class="distmap__pin-tag">${escapeHtml(person.name || label)}</span>
      </span>`,
    iconSize: [64, 64],
    iconAnchor: [32, 32],
  });
}

function createMap(wrap) {
  const canvas = wrap.querySelector('[data-map-canvas]');
  const placeholder = wrap.querySelector('[data-map-empty]');
  const fitButton = wrap.querySelector('[data-map-fit]');
  const failure = wrap.querySelector('[data-map-error]');
  const failureText = failure.querySelector('span');
  const retry = failure.querySelector('button');
  let points = [];
  let overlap = false;
  let together = false;
  let L;
  let map;
  let tiles;
  let pins;
  let resize;
  let disposed = false;
  let loading = false;
  let signature = '';
  let pointRoles = '';

  const fit = () => {
    if (!map || !points.length) return;
    map.invalidateSize({ animate: false });
    const coords = points.map(point => [point.lat, point.mapLng]);
    if (overlap) {
      const center = [(coords[0][0] + coords[1][0]) / 2, (coords[0][1] + coords[1][1]) / 2];
      map.setView(center, 17, { animate: false });
    } else if (coords.length > 1) {
      map.fitBounds(coords, { padding: [44, 57], maxZoom: 15, animate: false });
    } else {
      map.setView(coords[0], 14, { animate: false });
    }
  };

  const showFailure = message => {
    failure.hidden = !message;
    failureText.textContent = message;
  };

  const paint = () => {
    const next = JSON.stringify([together, ...points.map(point => [
      point.role, point.lat, point.mapLng, point.accuracy, point.name, point.avatar, hasFreshPosition(point),
    ])]);
    if (next === signature) return;
    signature = next;
    pins.clearLayers();
    if (overlap) {
      const [me, partner] = points;
      const center = [(me.lat + partner.lat) / 2, (me.mapLng + partner.mapLng) / 2];
      L.marker(center, { icon: pairPin(L, me, partner, together), interactive: false, keyboard: false }).addTo(pins);
    } else {
      for (const point of points) {
        const coords = [point.lat, point.mapLng];
        if (Number.isFinite(point.accuracy) && point.accuracy > 0 && point.accuracy < 800) {
          const color = getComputedStyle(wrap).getPropertyValue(point.role === 'me' ? '--dm-you' : '--dm-her').trim();
          L.circle(coords, { radius: point.accuracy, color, weight: 0, fillOpacity: 0.16, interactive: false }).addTo(pins);
        }
        L.marker(coords, {
          icon: avatarPin(L, point, point.role, point.label),
          interactive: false,
          keyboard: false,
          zIndexOffset: point.role === 'me' ? 200 : 400,
        }).addTo(pins);
      }
      if (points.length > 1) {
        const line = points.map(point => [point.lat, point.mapLng]);
        const color = getComputedStyle(wrap).getPropertyValue('--dm-her').trim();
        L.polyline(line, { color: '#fff', weight: 5, opacity: 0.8, interactive: false }).addTo(pins);
        L.polyline(line, { color, weight: 2, dashArray: '6 8', interactive: false }).addTo(pins);
      }
    }
    const roles = points.map(point => point.role).join('/');
    if (roles !== pointRoles) {
      pointRoles = roles;
      fit();
    }
  };

  const load = async () => {
    if (loading || disposed || map || !points.length) return;
    loading = true;
    try {
      const mod = await import('leaflet');
      if (disposed || !points.length) return;
      L = mod.default || mod;
      map = L.map(canvas, { zoomControl: false, scrollWheelZoom: false });
      L.control.zoom({ zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(map);
      map.attributionControl.setPrefix(false);
      tiles = L.tileLayer(TILES, { maxZoom: 19, attribution: ATTR });
      let tileLoaded = false;
      tiles.on('loading', () => { tileLoaded = false; });
      tiles.on('tileload', () => { tileLoaded = true; });
      tiles.on('load', () => showFailure(tileLoaded ? '' : 'Mapa base no disponible.'));
      tiles.addTo(map);
      pins = L.layerGroup().addTo(map);
      paint();
      resize = new ResizeObserver(() => {
        if (canvas.clientWidth) map.invalidateSize({ debounceMoveend: true });
      });
      resize.observe(canvas);
      retry.hidden = false;
      fitButton.hidden = false;
    } catch {
      resize?.disconnect();
      map?.remove();
      map = null;
      tiles = null;
      signature = '';
      pointRoles = '';
      showFailure('No se pudo abrir el mapa.');
    } finally {
      loading = false;
    }
  };

  fitButton.addEventListener('click', fit);
  retry.addEventListener('click', () => {
    showFailure('');
    if (tiles) tiles.redraw();
    else void load();
  });
  const onOnline = () => {
    if (!failure.hidden && !canvas.hidden) retry.click();
  };
  window.addEventListener('online', onOnline);

  return {
    render(me, partner) {
      overlap = hasPosition(me) && hasPosition(partner) && !!togetherInfo(me, partner)?.together;
      together = overlap && hasFreshPosition(me) && hasFreshPosition(partner);
      points = [];
      if (hasPosition(me)) points.push({ ...me, mapLng: me.lng, role: 'me', label: 'Tú' });
      if (hasPosition(partner)) {
        // Elige la copia del meridiano que queda cerca de la otra posición.
        const delta = partner.lng - (me?.lng ?? partner.lng);
        const mapLng = hasPosition(me) && Math.abs(delta) > 180 ? partner.lng - 360 * Math.sign(delta) : partner.lng;
        points.push({ ...partner, mapLng, role: 'them', label: 'Tu pareja' });
      }
      canvas.hidden = !points.length;
      placeholder.hidden = !!points.length;
      fitButton.hidden = !map || !points.length;
      if (!points.length) showFailure('');
      if (map) paint();
      else void load();
    },
    cleanup() {
      disposed = true;
      window.removeEventListener('online', onOnline);
      resize?.disconnect();
      map?.remove();
    },
  };
}

function distanceHTML(me, partner) {
  if (togetherAtCurrentPosition(me, partner)) {
    return `<p class="distmap__km distmap__km--together">${icon('heart', 15)}Estáis juntos</p>`;
  }
  if (!hasPosition(me) || !hasPosition(partner)) {
    return `<p class="distmap__km">${icon('map', 15)}Distancia pendiente</p>`;
  }
  const current = hasFreshPosition(me) && hasFreshPosition(partner);
  const km = distanceKm(me, partner);
  const text = km === 0 ? '0 m' : km < 0.01 ? 'Menos de 10 m' : formatDistance(km);
  return `<p class="distmap__km">
    ${icon('map', 15)}<strong>${escapeHtml(text)}</strong>
    <span>${current ? 'de distancia' : 'entre las últimas ubicaciones'}</span>
  </p>`;
}

/** Contenido compartido por la hoja de Inicio y /mapa. */
export function distanceMapBody({ me: initialMe, partner: initialPartner, meName, meAvatar } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'distmap';
  wrap.innerHTML = `
    <div class="distmap__head" data-map-distance></div>
    <div class="distmap__frame">
      <div class="distmap__canvas" data-map-canvas aria-label="Mapa de ubicaciones" hidden></div>
      <div class="distmap__placeholder" data-map-empty>${icon('map', 26)}<span>Esperando ubicaciones compartidas</span></div>
      <button class="distmap__fit" type="button" data-map-fit aria-label="Centrar el mapa en las ubicaciones" hidden>${icon('map', 18)}</button>
      <div class="distmap__tile-error" data-map-error hidden>
        <span role="status"></span>
        <button type="button">Reintentar</button>
      </div>
    </div>
    ${permissionHTML()}
    <section class="distmap__devices" aria-label="Los móviles">
      <h2 class="distmap__devices-title">${icon('phone', 15)}Los móviles</h2>
      <div class="distmap__people" data-map-people></div>
    </section>
    ${trackingPanelHTML()}
  `;

  const map = createMap(wrap);
  const permission = wirePermission(wrap);
  const offTracking = wireTracking(wrap);
  const distance = wrap.querySelector('[data-map-distance]');
  const people = wrap.querySelector('[data-map-people]');
  let shownDistance;
  let shownPeople;
  let me = initialMe;
  let partner = initialPartner;
  let partnerProfile;
  let requestedProfileId;
  let stopWatch;
  let frame;
  let disposed = false;

  const render = () => {
    const status = getDeviceStatus();
    const mine = {
      ...me,
      name: me?.name || meName || 'Tú',
      avatar: me?.avatar || meAvatar || '',
      battery: status.battery ?? me?.battery,
      charging: Number.isFinite(status.battery) ? status.charging : me?.charging,
      net: status.online === false ? 'offline' : status.net || me?.net,
      mbps: status.online === false ? null : status.mbps ?? me?.mbps,
    };
    const theirs = partner && {
      ...partner,
      name: partner.name || partnerProfile?.name,
      avatar: partner.avatar || partnerProfile?.avatar,
    };
    const nextDistance = distanceHTML(mine, theirs);
    if (shownDistance !== nextDistance) distance.innerHTML = shownDistance = nextDistance;
    const nextPeople = cardHTML(mine, 'Tú', true) + cardHTML(theirs || {}, 'Tu pareja');
    if (shownPeople !== nextPeople) people.innerHTML = shownPeople = nextPeople;
    map.render(mine, theirs);
    permission.render();
  };
  const schedule = () => {
    if (frame != null || disposed) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      render();
    });
  };
  const offStatus = onDeviceStatus(schedule);

  wrap.setLocationStatus = permission.set;
  wrap.watch = () => {
    stopWatch = watchDistance(({ partner: next, partnerId }) => {
      me = fetchMyLocation();
      partner = next;
      if (partnerId !== requestedProfileId) {
        requestedProfileId = partnerId;
        partnerProfile = null;
        if (partnerId && (!next?.avatar || !next?.name)) {
          void fetchProfile(partnerId).then(profile => {
            if (disposed || requestedProfileId !== partnerId) return;
            partnerProfile = profile;
            schedule();
          });
        }
      }
      schedule();
    });
  };
  wrap.cleanup = () => {
    disposed = true;
    if (frame != null) cancelAnimationFrame(frame);
    stopWatch?.();
    offStatus();
    offTracking();
    permission.cleanup();
    map.cleanup();
  };
  return wrap;
}

/** Abre la hoja del mapa (desde el panel de la portada). */
export function openDistanceMap(options) {
  const body = distanceMapBody(options);
  openSheet('Dónde estáis', () => body, body.cleanup);
  body.watch();
}
