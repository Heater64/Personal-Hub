/* ==========================================
   location/settings.js — «Ajustes» del módulo de ubicación.

   Todo lo que decide qué se comparte vive aquí, y todo lo decide el dueño de
   ese móvil: nada de esta pantalla puede activar la ubicación de la otra
   persona ni reactivar la tuya después de haberla apagado.

   Reutiliza los servicios reales (permisos, seguimiento nativo, batería) y
   solo guarda en preferencias lo que es visual o de privacidad: el estado de
   los sensores lo sigue mandando Android.
   ========================================== */

import { icon, toast } from '../ui.js';
import { escapeHtml } from '../../utils/escape.js';
import { getUserPref, setUserPref } from '../../utils/userStorage.js';
import { timeAgo, isStale } from '../../services/device.service.js';
import {
  getDeviceStatus,
  onDeviceStatus,
  refreshBackgroundStatus,
  enableBackgroundTracking,
  disableBackgroundTracking,
  openBatteryOptimizationSettings,
  openDeviceSettings,
  openLocationSettings,
} from '../../services/device.service.js';
import { locationPermissionState, requestLocationPermission } from '../../services/location.service.js';
import { isNative } from '../../services/native.service.js';

const PREF_SHARE = 'shareLocation';
const PREF_ARRIVALS = 'placeArrivalAlerts';
const DEVICE_PREFS = [
  { key: 'shareDeviceBattery', icon: 'battery', label: 'Batería', hint: 'Porcentaje y si está cargando.' },
  { key: 'shareDeviceNetwork', icon: 'wifi', label: 'Conexión', hint: 'Wi-Fi o datos, sin nombre de la red.' },
  { key: 'shareDeviceSpeed', icon: 'speed', label: 'Velocidad', hint: 'Cuánto te mueves, en km/h.' },
  { key: 'shareDeviceAccuracy', icon: 'map', label: 'Precisión', hint: 'El margen en metros de tu posición.' },
];

const readPref = key => getUserPref(key, 'true') !== 'false';
const writePref = (key, on) => {
  try { setUserPref(key, on ? 'true' : 'false'); } catch { /* queda solo en esta sesión */ }
};

function switchRow({ iconName, label, hint, checked, data }) {
  return `
    <div class="locrow">
      <span class="locrow__ico">${icon(iconName, 17)}</span>
      <span class="locrow__txt">
        <b>${escapeHtml(label)}</b>
        ${hint ? `<small>${escapeHtml(hint)}</small>` : ''}
      </span>
      <button type="button" class="locswitch" role="switch" aria-checked="${checked ? 'true' : 'false'}"
        ${data} aria-label="${escapeHtml(label)}"><i aria-hidden="true"></i></button>
    </div>`;
}

/**
 * @param {{ onSharingChange?: (sharing: boolean) => void }} options
 */
export function createLocationSettings({ onSharingChange } = {}) {
  const el = document.createElement('div');
  el.className = 'locset';

  el.innerHTML = `
    <section class="locsec">
      <h2 class="locsec__title">Compartir</h2>
      ${switchRow({
        iconName: 'eye', label: 'Compartir mi ubicación',
        hint: 'Solo tú puedes activarlo o desactivarlo en este móvil.',
        checked: readPref(PREF_SHARE), data: 'data-share',
      })}
      <div class="locrow" data-permission-row>
        <span class="locrow__ico">${icon('shield', 17)}</span>
        <span class="locrow__txt">
          <b>Permiso de ubicación</b>
          <small data-permission-note>Comprobando…</small>
        </span>
        <button type="button" class="locrow__action" data-permission-action hidden>Permitir</button>
      </div>
      ${switchRow({
        iconName: 'bell', label: 'Avisos de llegada',
        hint: 'Voluntario: decide si tu móvil avisa al llegar a vuestros lugares.',
        checked: readPref(PREF_ARRIVALS), data: 'data-arrivals',
      })}
      <p class="locsec__note">Los avisos de llegada los genera el móvil de quien llega, nunca el de la otra persona.</p>
    </section>

    <section class="locsec">
      <h2 class="locsec__title">Qué comparto</h2>
      <p class="locsec__note">Se aplica a lo que envía la app mientras está abierta. El servicio en segundo plano de Android envía batería y conexión por su cuenta.</p>
      ${DEVICE_PREFS.map(pref => switchRow({
        iconName: pref.icon, label: pref.label, hint: pref.hint,
        checked: readPref(pref.key), data: `data-pref="${pref.key}"`,
      })).join('')}
    </section>

    <section class="locsec">
      <h2 class="locsec__title">Servicio y batería</h2>
      <div class="locrow" data-service-row>
        <span class="locrow__ico">${icon('phone', 17)}</span>
        <span class="locrow__txt">
          <b>Seguimiento siempre</b>
          <small data-service-note>Comprobando el estado de Android…</small>
        </span>
        <button type="button" class="locrow__action" data-service-action hidden>Activar</button>
      </div>
      <p class="locsec__note" data-service-extra hidden></p>
      <div class="locrow">
        <span class="locrow__ico">${icon('battery', 17)}</span>
        <span class="locrow__txt">
          <b>Ahorro de batería</b>
          <small data-battery-note>Android puede pausar el servicio para ahorrar batería.</small>
        </span>
        <button type="button" class="locrow__action" data-battery-action>Ajustes</button>
      </div>
    </section>

    <section class="locsec">
      <h2 class="locsec__title">Estado</h2>
      <div class="locrow">
        <span class="locrow__ico">${icon('clock', 17)}</span>
        <span class="locrow__txt">
          <b>Última actualización</b>
          <small data-updated>Sin datos todavía</small>
        </span>
      </div>
    </section>
  `;

  const shareSwitch = el.querySelector('[data-share]');
  const arrivalsSwitch = el.querySelector('[data-arrivals]');
  const permissionRow = el.querySelector('[data-permission-row]');
  const permissionNote = el.querySelector('[data-permission-note]');
  const permissionAction = el.querySelector('[data-permission-action]');
  const serviceRow = el.querySelector('[data-service-row]');
  const serviceNote = el.querySelector('[data-service-note]');
  const serviceAction = el.querySelector('[data-service-action]');
  const serviceExtra = el.querySelector('[data-service-extra]');
  const batteryNote = el.querySelector('[data-battery-note]');
  const batteryAction = el.querySelector('[data-battery-action]');
  const updatedEl = el.querySelector('[data-updated]');

  const onSwitch = (button, key, extra) => {
    const on = button.getAttribute('aria-checked') !== 'true';
    button.setAttribute('aria-checked', String(on));
    writePref(key, on);
    extra?.(on);
  };

  shareSwitch.addEventListener('click', () => onSwitch(shareSwitch, PREF_SHARE, sharing => {
    onSharingChange?.(sharing);
    toast(sharing ? 'Compartiendo tu ubicación' : 'Has dejado de compartir tu ubicación');
  }));
  arrivalsSwitch.addEventListener('click', () => onSwitch(arrivalsSwitch, PREF_ARRIVALS));

  el.addEventListener('click', event => {
    const prefButton = event.target.closest('[data-pref]');
    if (!prefButton) return;
    onSwitch(prefButton, prefButton.dataset.pref);
  });

  /* ---------- Permiso ---------- */

  let permissionState = 'unknown';
  const renderPermission = async () => {
    permissionState = await locationPermissionState();
    if (permissionState === 'granted') {
      permissionNote.textContent = 'Concedido. Tu posición se comparte mientras la app está abierta.';
      permissionAction.hidden = true;
    } else if (permissionState === 'denied') {
      permissionNote.textContent = 'Bloqueado en los ajustes del móvil.';
      permissionAction.hidden = false;
      permissionAction.textContent = 'Ajustes';
      permissionAction.dataset.mode = 'settings';
    } else {
      permissionNote.textContent =
        'Sin permiso no se comparte tu ubicación ni se calcula la distancia. El mapa puede seguir mostrando los datos de tu pareja.';
      permissionAction.hidden = false;
      permissionAction.textContent = 'Permitir';
      delete permissionAction.dataset.mode;
    }
    permissionRow.classList.toggle('is-off', permissionState === 'denied');
  };
  void renderPermission();

  permissionAction.addEventListener('click', async () => {
    if (permissionAction.dataset.mode === 'settings') {
      void openDeviceSettings();
      return;
    }
    permissionAction.disabled = true;
    permissionAction.textContent = 'Pidiendo…';
    await requestLocationPermission();
    await renderPermission();
    permissionAction.disabled = false;
  });

  /* ---------- Servicio de Android ---------- */

  let busy = false;
  const renderService = status => {
    const bg = status?.background || {};
    const running = bg.running === true;
    const enabled = bg.enabled === true;
    const paused = bg.batteryPaused === true;
    const locationOff = bg.locationServices === 'disabled' && !paused;
    const native = isNative();

    serviceAction.hidden = !native;
    serviceAction.textContent = running ? 'Desactivar' : enabled ? 'Reanudar' : 'Activar';
    serviceAction.disabled = busy;

    if (!native) {
      serviceNote.textContent = 'En el navegador la ubicación solo se comparte con la app abierta.';
    } else if (paused) {
      serviceNote.textContent = 'En pausa por batería baja. Se reanuda sola al llegar al 30%.';
    } else if (locationOff) {
      serviceNote.textContent = 'La ubicación del sistema está apagada.';
      serviceAction.hidden = true;
    } else if (running) {
      serviceNote.textContent = 'En marcha: comparte también con la app cerrada.';
    } else if (enabled) {
      serviceNote.textContent = 'Activado, pero Android no lo tiene en marcha.';
    } else {
      serviceNote.textContent = 'Inactivo: solo se actualiza con la app abierta.';
    }
    serviceRow.classList.toggle('is-on', running && !paused && !locationOff);

    const warnings = [];
    if (locationOff) warnings.push('Activa la ubicación del sistema para volver a compartir.');
    if (enabled && bg.background !== 'granted') warnings.push('Concede «Permitir todo el tiempo» en los ajustes de la app.');
    if (enabled && (bg.notifications === 'denied' || bg.partnerNotificationsEnabled === false)) {
      warnings.push('Las notificaciones están bloqueadas: actívalas para ver el servicio activo.');
    }
    if (bg.geofenceAccuracyWarning) warnings.push('La última posición no tuvo precisión suficiente: no se pudieron comprobar los lugares compartidos.');
    const manufacturer = String(bg.manufacturer || '').toLowerCase();
    if (enabled && !running && ['xiaomi', 'redmi', 'poco'].some(name => manufacturer.includes(name))) {
      warnings.push('Xiaomi puede cerrar Tamp al limpiar Recientes. Activa «Inicio automático».');
    }
    serviceExtra.textContent = warnings[0] || '';
    serviceExtra.hidden = !warnings[0];

    batteryNote.textContent = bg.batteryUnrestricted === false
      ? 'Android puede pausar el servicio para ahorrar batería.'
      : 'Sin restricciones de batería para el servicio.';
  };

  serviceAction.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    serviceAction.disabled = true;
    try {
      const current = getDeviceStatus().background;
      if (current.running) await disableBackgroundTracking();
      else {
        const result = await enableBackgroundTracking();
        if (!result.ok) {
          serviceExtra.hidden = false;
          serviceExtra.textContent = result.reason === 'denied'
            ? 'Sin permiso de ubicación no se puede compartir la posición.'
            : result.reason === 'web'
              ? 'El seguimiento en segundo plano solo existe en la app de Android.'
              : 'No se pudo activar el seguimiento. Inténtalo otra vez.';
        }
      }
      await refreshBackgroundStatus();
    } finally {
      busy = false;
      renderService(getDeviceStatus());
    }
  });

  batteryAction.addEventListener('click', () => {
    const bg = getDeviceStatus().background;
    if (bg.locationServices === 'disabled' && !bg.batteryPaused) void openLocationSettings();
    else void openBatteryOptimizationSettings();
  });

  renderService(getDeviceStatus());
  const off = onDeviceStatus(renderService);

  return {
    el,
    /** Datos propios para la fila «Última actualización». */
    setMe(me) {
      if (!me) { updatedEl.textContent = 'Sin datos todavía'; return; }
      const at = me.at || me.sentAt;
      if (!at) { updatedEl.textContent = 'Sin datos todavía'; return; }
      updatedEl.textContent = isStale(me.at)
        ? `Última posición ${timeAgo(at)}`
        : `Actualizada ${timeAgo(at)}`;
    },
    refresh() { void renderPermission(); renderService(getDeviceStatus()); },
    dispose() { off?.(); },
  };
}
