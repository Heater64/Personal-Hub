/* ==========================================
   device.service.js — el estado del móvil, siempre.

   Conexión, batería, ubicación y permisos en una sola fuente: la app entera
   lee de aquí (antes cada panel recalculaba lo suyo) y los cambios llegan
   solos a quien esté suscrito.

   Dentro del APK, el seguimiento lo mantiene `DeviceStatusService`
   (Android), un servicio en primer plano: batería, red y ubicación se
   actualizan también con la app cerrada. En el navegador solo puede
   actualizarse mientras la app está abierta, y el panel lo dice.
   ========================================== */

import { isNative } from './native.service.js';
import { supabase } from './supabase.js';
import { userStore } from '../stores/user.store.js';

const POLL_MS = 30000;
const STALE_MS = 30 * 60000;

const listeners = new Set();

let started = false;
let pollTimer = null;
let batteryCleanup = null;
let networkCleanup = null;
const permissionCleanups = [];

const state = {
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  net: '',
  mbps: null,
  rtt: null,
  saveData: false,
  battery: null,
  charging: false,
  locationPermission: 'unknown',
  notificationsPermission: 'unknown',
};

const background = {
  native: false,
  enabled: false,
  location: 'unknown',
  background: 'unknown',
  notifications: 'unknown',
  batteryUnrestricted: null,
  data: null,
  session: null,
};

const plugin = () =>
  typeof window !== 'undefined' ? (window.Capacitor?.Plugins?.DeviceStatus ?? null) : null;

function emit() {
  const snapshot = getDeviceStatus();
  for (const fn of listeners) {
    try {
      fn(snapshot);
    } catch {
      /* un suscriptor roto no frena a los demás */
    }
  }
}

/** Estado actual, ya combinado con lo que sabe el servicio nativo. */
export function getDeviceStatus() {
  return { ...state, background: { ...background } };
}

/** Escucha cualquier cambio de estado. Devuelve la función para dejar de escuchar. */
export function onDeviceStatus(fn) {
  if (typeof fn !== 'function') return () => {};
  listeners.add(fn);
  try {
    fn(getDeviceStatus());
  } catch {
    /* suscriptor roto */
  }
  return () => listeners.delete(fn);
}

/* ==========================================
   CONEXIÓN
   ========================================== */

function connectionInfo() {
  if (typeof navigator === 'undefined') return null;
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
}

function syncNetwork() {
  state.online = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const conn = connectionInfo();
  if (conn) {
    const type = conn.type && conn.type !== 'unknown' ? conn.type : conn.effectiveType;
    state.net = type ? String(type) : '';
    state.mbps = Number.isFinite(conn.downlink) ? conn.downlink : null;
    state.rtt = Number.isFinite(conn.rtt) ? conn.rtt : null;
    state.saveData = !!conn.saveData;
  }
  emit();
}

function attachNetwork() {
  window.addEventListener('online', syncNetwork);
  window.addEventListener('offline', syncNetwork);
  const conn = connectionInfo();
  conn?.addEventListener?.('change', syncNetwork);
  networkCleanup = () => {
    window.removeEventListener('online', syncNetwork);
    window.removeEventListener('offline', syncNetwork);
    conn?.removeEventListener?.('change', syncNetwork);
  };
  syncNetwork();
}

/* ==========================================
   BATERÍA
   ========================================== */

async function attachBattery() {
  // En un WebView sin Battery Status API no hay forma de leerla: el campo se
  // queda vacío y nadie inventa un porcentaje.
  if (typeof navigator === 'undefined' || !navigator.getBattery) return;
  try {
    const battery = await navigator.getBattery();
    const sync = () => {
      state.battery = Math.round(battery.level * 100);
      state.charging = !!battery.charging;
      emit();
    };
    battery.addEventListener('levelchange', sync);
    battery.addEventListener('chargingchange', sync);
    batteryCleanup = () => {
      battery.removeEventListener('levelchange', sync);
      battery.removeEventListener('chargingchange', sync);
    };
    sync();
  } catch {
    /* sin Battery Status API */
  }
}

/* ==========================================
   PERMISOS (ubicación y notificaciones)
   ========================================== */

async function watchPermission(name, key) {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return;
  try {
    const status = await navigator.permissions.query({ name });
    state[key] = status.state;
    const onChange = () => {
      state[key] = status.state;
      emit();
    };
    status.addEventListener('change', onChange);
    permissionCleanups.push(() => status.removeEventListener('change', onChange));
  } catch {
    /* el WebView no deja consultarlo: se queda en «unknown» */
  }
}

/* ==========================================
   SERVICIO EN SEGUNDO PLANO (APK)
   ========================================== */

/** Relee del plugin el estado del servicio: activo, permisos y último envío. */
export async function refreshBackgroundStatus() {
  const api = plugin();
  if (!isNative() || !api?.status) {
    Object.assign(background, { native: false, enabled: false });
    emit();
    return background;
  }
  try {
    const res = await api.status();
    Object.assign(background, {
      native: true,
      enabled: !!res?.enabled,
      location: res?.location || 'unknown',
      background: res?.background || 'unknown',
      notifications: res?.notifications || 'unknown',
      batteryUnrestricted: res?.batteryUnrestricted === true,
      data: res?.data || null,
      session: res?.session || null,
    });
    // Si el servicio renovó la sesión mientras la app estaba cerrada, la web
    // se queda con la más nueva: compartir un refresh token ya usado dejaría
    // la sesión inválida en cuanto la renovara cualquiera de los dos.
    await adoptSession(background.session);
  } catch {
    /* el plugin no respondió: se conserva lo último conocido */
  }
  emit();
  return background;
}

/**
 * Adopta la sesión del servicio nativo cuando es más reciente que la local.
 * Devuelve true si la web se quedó con ella.
 */
let adopting = false;

async function adoptSession(session) {
  if (adopting || !session?.accessToken || !session?.refreshToken || !session?.userId) return false;
  adopting = true;
  try {
    const { data } = await supabase.auth.getSession();
    const local = data?.session;
    if (local && local.user?.id !== session.userId) return false;
    const localExpiry = (local?.expires_at || 0) * 1000;
    if ((session.expiresAt || 0) <= localExpiry + 5000) return false;

    const { error } = await supabase.auth.setSession({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
    });
    return !error;
  } catch {
    return false;
  } finally {
    adopting = false;
  }
}

/**
 * Credenciales que necesita el servicio nativo para escribir donde el otro
 * puede leerlo. El token de acceso caduca; el servicio lo renueva con el
 * refresh token, así que el seguimiento no se cae a la hora.
 */
async function nativeConfig() {
  const user = userStore.getUser();
  if (!user) return null;

  let session;
  try {
    const { data } = await supabase.auth.getSession();
    session = data?.session || null;
  } catch {
    return null;
  }
  if (!session?.access_token) return null;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  return {
    url,
    anonKey,
    accessToken: session.access_token,
    refreshToken: session.refresh_token || '',
    expiresAt: (session.expires_at || 0) * 1000,
    userId: user.id,
    isAdmin: userStore.isAdmin,
    name: user.name || '',
    avatar: user.avatar || '',
  };
}

/**
 * Activa el seguimiento siempre. Antes pide el permiso de ubicación en
 * primer plano (Android lo exige para arrancar el servicio); el «todo el
 * tiempo» se concede desde los ajustes del sistema y el panel lo indica.
 */
export async function enableBackgroundTracking() {
  const api = plugin();
  if (!isNative() || !api?.start) return { ok: false, reason: 'web' };

  const geo = await import('@capacitor/geolocation').catch(() => null);
  if (geo) {
    try {
      let perm = await geo.Geolocation.checkPermissions();
      if (perm.location !== 'granted') perm = await geo.Geolocation.requestPermissions();
      if (perm.location !== 'granted') return { ok: false, reason: 'denied' };
    } catch {
      /* El servicio arranca igual: batería y red no necesitan ubicación. */
    }
  }

  const config = await nativeConfig();
  if (!config) return { ok: false, reason: 'session' };

  try {
    await api.start(config);
  } catch {
    return { ok: false, reason: 'error' };
  }

  const current = await refreshBackgroundStatus();
  return {
    ok: true,
    needsBackground: current.background !== 'granted',
    batteryUnrestricted: current.batteryUnrestricted,
  };
}

/** Lo apaga y borra la configuración: deja de escribir en segundo plano. */
export async function disableBackgroundTracking() {
  const api = plugin();
  if (!isNative() || !api?.stop) return false;
  try {
    await api.stop();
  } catch {
    return false;
  }
  await refreshBackgroundStatus();
  return true;
}

/**
 * Tras iniciar sesión: si el usuario ya lo había activado, se refrescan las
 * credenciales para que el servicio pueda seguir enviando (Android reinicia
 * los servicios y el token caduca).
 */
export async function syncBackgroundTracking() {
  if (!isNative()) return false;
  await refreshBackgroundStatus();
  if (!background.enabled) return false;

  const config = await nativeConfig();
  if (!config) return false;
  try {
    await plugin()?.start?.(config);
    await refreshBackgroundStatus();
    return true;
  } catch {
    return false;
  }
}

/** Abre los ajustes de la app para conceder ubicación «todo el tiempo». */
export async function openDeviceSettings() {
  const api = plugin();
  if (!api?.openSettings) return false;
  try {
    await api.openSettings();
    return true;
  } catch {
    return false;
  }
}

/* ==========================================
   ARRANQUE / PARADA
   ========================================== */

/** Idempotente: se llama una vez al montar la app, no en cada pantalla. */
export function startDeviceMonitor() {
  if (started || typeof window === 'undefined') return;
  started = true;
  attachNetwork();
  void attachBattery();
  void watchPermission('geolocation', 'locationPermission');
  void watchPermission('notifications', 'notificationsPermission');
  if (isNative()) {
    void refreshBackgroundStatus();
    pollTimer = setInterval(() => void refreshBackgroundStatus(), POLL_MS);
    // Cada vez que la web renueva su sesión, el servicio recibe la nueva:
    // así ninguno de los dos se queda con un refresh token caducado.
    supabase.auth.onAuthStateChange(event => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') void syncBackgroundTracking();
    });
  }
}

export function stopDeviceMonitor() {
  if (!started) return;
  started = false;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  batteryCleanup?.();
  batteryCleanup = null;
  networkCleanup?.();
  networkCleanup = null;
  for (const off of permissionCleanups.splice(0)) {
    try {
      off();
    } catch {
      /* nada que soltar */
    }
  }
}

/* ==========================================
   LO QUE SE COMPARTE CON LA OTRA PERSONA
   ========================================== */

/** Batería y red, tal cual, para adjuntarlas a la posición. */
export function deviceFactsSnapshot() {
  const facts = {};
  if (Number.isFinite(state.battery)) {
    facts.battery = state.battery;
    facts.charging = state.charging;
  }
  if (state.net) facts.net = state.net;
  if (Number.isFinite(state.mbps)) facts.mbps = state.mbps;
  return facts;
}

const NET_NAMES = {
  wifi: 'Wi-Fi',
  ethernet: 'Cable',
  cellular: 'Datos',
  '4g': '4G',
  '3g': '3G',
  '2g': '2G',
  slow2g: '2G',
};

/** «wifi» + 42 Mbps → «Wi-Fi · 42 Mbps». */
export function networkLabel(person = {}) {
  const key = String(person.net || '').toLowerCase();
  const base = NET_NAMES[key] || (key ? key.toUpperCase() : '');
  if (!base) return '';
  return Number.isFinite(person.mbps) && person.mbps > 0
    ? `${base} · ${Math.round(person.mbps)} Mbps`
    : base;
}

/** «hace 2 min», «hace 3 h»… */
export function timeAgo(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const seconds = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (seconds < 45) return 'ahora mismo';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

/** ¿El dato es demasiado viejo para presentarlo como actual? */
export function isStale(iso) {
  const t = Date.parse(iso);
  return !Number.isFinite(t) || Date.now() - t > STALE_MS;
}
