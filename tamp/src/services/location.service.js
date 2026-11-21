/* ==========================================
   location.service.js — Dónde está cada uno.

   La ubicación se comparte dentro de la pareja en `couple_locations`.
   Las instalaciones anteriores a la migración 029 conservan su ruta antigua.
   La web pide la posición al abrir la portada y al volver a primer plano.
   Dentro del APK, `DeviceStatusService` sigue enviando batería, red y
   ubicación con la app cerrada, en la misma fila que esto.
   ========================================== */

import { supabase } from './supabase.js';
import { isNative } from './native.service.js';
import { deviceFactsSnapshot, getDeviceStatus, onDeviceStatus, refreshBackgroundStatus } from './device.service.js';

const ADMIN_ROW_ID = 'location_admin';
const SHARE_MS = 120000; // repite tu posición cada 2 min en uso
const STALE_MS = 30 * 60000; // 30 min sin actualizar: no se muestra

let self = null; // { userId, isAdmin }
let shareTimer = null;
let onVisible = null;
let myLocation = null; // { lat, lng } de este dispositivo
const distanceListeners = new Set();
let nextDistanceWatch = 0;

const hasNativePermission = perm =>
  perm?.location === 'granted' || perm?.coarseLocation === 'granted';

/** ¿La fila está lo bastante fresca para usarla? */
export function isFresh(at) {
  const t = at ? Date.parse(at) : NaN;
  return Number.isFinite(t) && Date.now() - t < STALE_MS;
}

/**
 * Posición actual del dispositivo.
 *
 * Dentro del APK, `navigator.geolocation` no pide el permiso de Android por sí
 * solo: el plugin nativo sí, y además devuelve el error tipado que el panel
 * necesita para distinguir «denegado» de «sin cobertura».
 */
function deniedError(needsPrompt) {
  const err = new Error('permiso de ubicación no concedido');
  err.code = 1;
  err.needsPrompt = !!needsPrompt;
  return err;
}

/**
 * Estado del permiso sin abrir ningún diálogo.
 * Devuelve 'granted' | 'prompt' | 'denied' | 'unknown'.
 *
 * En el APK manda el plugin nativo (el WebView no conoce los permisos de
 * Android); en la web se pregunta al navegador, que sí sabe si el sitio ya
 * está autorizado o si todavía toca preguntar.
 */
export async function locationPermissionState() {
  if (isNative()) {
    const mod = await import('@capacitor/geolocation').catch(() => null);
    try {
      const perm = await mod?.Geolocation?.checkPermissions();
      if (hasNativePermission(perm)) return 'granted';
      if (perm?.location === 'denied') return 'denied';
      return 'prompt';
    } catch {
      return 'unknown';
    }
  }
  try {
    const res = await navigator.permissions?.query({ name: 'geolocation' });
    return res?.state || 'unknown';
  } catch {
    return 'unknown';
  }
}

async function currentPosition({ prompt = false } = {}) {
  if (isNative()) {
    const mod = await import('@capacitor/geolocation').catch(() => null);
    if (!mod) throw new Error('sin geolocalización nativa');
    const { Geolocation } = mod;
    let perm = await Geolocation.checkPermissions();
    if (!hasNativePermission(perm) && prompt) {
      perm = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] });
    }
    if (!hasNativePermission(perm)) throw deniedError(perm.location !== 'denied');
    return Geolocation.getCurrentPosition({
      enableHighAccuracy: perm.location === 'granted',
      timeout: 12000,
      maximumAge: 60000,
    });
  }

  // En la web, `getCurrentPosition` abre el diálogo del sitio si aún no hay
  // respuesta. Se consulta antes para no dispararlo solo por cargar la página.
  try {
    const res = await navigator.permissions?.query({ name: 'geolocation' });
    if (res?.state === 'denied') throw deniedError(false);
    if (res?.state === 'prompt' && !prompt) throw deniedError(true);
  } catch (err) {
    if (err?.code === 1) throw err;
  }

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('sin geolocalización'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 60000,
    });
  });
}

/**
 * Lo que acompaña a la posición: batería, tipo de red y velocidad.
 *
 * Todo es opcional y best-effort. En un WebView puede faltar el sensor de
 * batería o la Network Information API; si falta, el campo no viaja y la otra
 * persona ve menos datos, nunca un cero inventado.
 */
async function deviceFacts(pos) {
  const facts = {};

  const speed = pos?.coords?.speed;
  if (Number.isFinite(speed) && speed >= 0) facts.speed = Math.round(speed * 3.6); // km/h
  if (Number.isFinite(pos?.coords?.accuracy)) facts.accuracy = Math.round(pos.coords.accuracy);

  // La fuente es el monitor compartido (device.service): así la posición y el
  // panel cuentan exactamente lo mismo, sin leer dos veces los sensores.
  const shared = deviceFactsSnapshot();
  if (Number.isFinite(shared.battery)) {
    facts.battery = shared.battery;
    facts.charging = shared.charging;
  }
  if (shared.net) facts.net = shared.net;
  if (Number.isFinite(shared.mbps)) facts.mbps = shared.mbps;

  // Si el monitor aún no ha arrancado, se pregunta al navegador una vez.
  if (!Number.isFinite(facts.battery)) {
    try {
      const battery = await navigator.getBattery?.();
      if (battery) {
        facts.battery = Math.round(battery.level * 100);
        facts.charging = !!battery.charging;
      }
    } catch {
      /* sin Battery Status API */
    }
  }

  if (!facts.net) {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      const type = conn.type && conn.type !== 'unknown' ? conn.type : conn.effectiveType;
      if (type) facts.net = String(type);
      if (Number.isFinite(conn.downlink)) facts.mbps = conn.downlink;
    }
  }

  return facts;
}

/** Escribe tu posición donde la otra persona puede leerla. */
function setMyLocation(location) {
  if (!location || (location.at === myLocation?.at && location.sentAt === myLocation?.sentAt)) return;
  myLocation = location;
  for (const notify of distanceListeners) notify();
}

function statusFor(error) {
  return error?.code === 1 ? (error.needsPrompt ? 'prompt' : 'denied') : 'error';
}

async function push(account, setStatus = account?.onStatus, position) {
  if (!account || self !== account) return;
  if (account.sending && !position) return account.sending;
  if (account.sending) await account.sending;
  if (self !== account) return;
  account.sending = publish(account, setStatus, position).finally(() => { account.sending = null; });
  return account.sending;
}

async function publish(account, setStatus, position) {
  const { userId, isAdmin } = account;
  const report = status => { if (self === account) setStatus?.(status); };
  try {
    const { coupleId, legacy } = await account.scope;
    if (self !== account) return;
    if (isNative() && getDeviceStatus().background.running) {
      const mine = fetchMyLocation();
      report(mine && isFresh(mine.at) ? 'ok' : 'error');
      return;
    }
    const pos = position || await currentPosition();
    const at = new Date().toISOString();
    const locationAt = Number.isFinite(pos.timestamp) && pos.timestamp > 0
      ? new Date(pos.timestamp).toISOString()
      : at;
    const data = {
      lat: Number(pos.coords.latitude.toFixed(5)),
      lng: Number(pos.coords.longitude.toFixed(5)),
      at,
      location_at: locationAt,
      user_id: userId,
      // El nombre y la foto viajan con la posición: la cuenta de ella no
      // puede leer la fila de `profiles` del admin (RLS), así que si esto
      // dependiera de esa lectura el mapa se quedaría sin nombre ni cara.
      name: account.name,
      avatar: account.avatar,
      ...(await deviceFacts(pos)),
    };
    if (self !== account) return;
    setMyLocation(toLocation(data, userId));

    if (coupleId) {
      const { error } = await supabase.from('couple_locations').upsert(
        {
          couple_id: coupleId,
          user_id: userId,
          data,
          location_at: locationAt,
          sent_at: at,
          updated_at: at,
        },
        { onConflict: 'couple_id,user_id' }
      );
      if (error) throw error;
    } else if (legacy && isAdmin) {
      const { error } = await supabase
        .from('content')
        .upsert({ id: ADMIN_ROW_ID, data, updated_at: at }, { onConflict: 'id' });
      if (error) throw error;
    } else if (legacy) {
      const { error } = await supabase
        .from('user_progress')
        .upsert(
          { user_id: userId, type: 'location', data, updated_at: at },
          { onConflict: 'user_id,type' }
        );
      if (error) throw error;
    }
    report('ok');
  } catch (err) {
    report(statusFor(err));
  }
}

async function loadScope(account) {
  try {
    const { data, error } = await supabase
      .from('couple_members')
      .select('couple_id')
      .eq('user_id', account.userId)
      .maybeSingle();
    const legacy = ['42P01', 'PGRST205'].includes(error?.code);
    return { coupleId: data?.couple_id || null, legacy, retry: !!error && !legacy };
  } catch {
    return { coupleId: null, legacy: false, retry: true };
  }
}

/**
 * Empieza a compartir tu posición (idempotente).
 * Se llama al montar la portada; `stopLocationSharing` al salir.
 */
export function startLocationSharing({ userId, isAdmin, name, avatar } = {}, onStatus) {
  stopLocationSharing();
  if (!userId || !supabase) return;
  const account = { userId: String(userId), isAdmin: !!isAdmin, name: name || '', avatar: avatar || '', onStatus, sending: null };
  self = account;
  account.scope = loadScope(account);
  const tick = async () => {
    if (document.visibilityState === 'hidden') return;
    if ((await account.scope).retry && self === account) account.scope = loadScope(account);
    if (isNative()) await refreshBackgroundStatus();
    await push(account);
  };
  void tick();
  shareTimer = setInterval(tick, SHARE_MS);
  onVisible = () => {
    if (document.visibilityState === 'visible') void tick();
  };
  document.addEventListener('visibilitychange', onVisible);
}

/**
 * Refresca el nombre y la foto que viajan dentro de la posición.
 *
 * La otra cuenta no puede leer `profiles` (la RLS solo deja ver la fila
 * propia, o al admin), así que la cara que pinta en el mapa sale de esta fila.
 * Esa copia se tomaba una sola vez al empezar a compartir: cambiar la foto no
 * llegaba nunca al otro dispositivo hasta que esta pantalla se volvía a montar.
 */
export function updateSharedIdentity({ name, avatar } = {}) {
  if (!self) return;
  if (typeof name === 'string' && name) self.name = name;
  if (typeof avatar === 'string') self.avatar = avatar;
  // Se escribe ya: la otra persona lo lee de aquí en su siguiente consulta.
  push(self);
}

/**
 * Pide el permiso de ubicación de forma explícita y, si lo concede, comparte
 * la posición en el acto.
 *
 * En el APK lo pide el plugin nativo (el WebView no sabe hacerlo solo); en el
 * navegador basta con llamar a getCurrentPosition, que es lo que abre el
 * diálogo del sitio. Devuelve true si quedó concedido.
 */
export async function requestLocationPermission(onStatus) {
  const account = self;
  if (!account) return false;
  try {
    const pos = await currentPosition({ prompt: true });
    if (self !== account) return false;
    await push(account, onStatus, pos);
    return self === account;
  } catch (err) {
    if (self === account) onStatus?.(statusFor(err));
    return self === account && err?.code !== 1 && await locationPermissionState() === 'granted';
  }
}

export function stopLocationSharing() {
  if (shareTimer) {
    clearInterval(shareTimer);
    shareTimer = null;
  }
  if (onVisible) {
    document.removeEventListener('visibilitychange', onVisible);
    onVisible = null;
  }
  self = null;
  myLocation = null;
  cachedPartnerId = null;
}

/** Última posición conocida de la otra persona: { lat, lng, at, userId } o null. */
export async function fetchPartnerLocation() {
  return self ? queryPartnerLocation(self).catch(() => null) : null;
}

async function queryPartnerLocation(account) {
  const { coupleId, legacy, retry } = await account.scope;
  if (self !== account) return null;
  if (retry) throw new Error('ubicación temporalmente no disponible');
  if (coupleId) {
    const { data, error } = await supabase
      .from('couple_locations')
      .select('user_id, data, location_at, sent_at')
      .eq('couple_id', coupleId)
      .neq('user_id', account.userId)
      .order('sent_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    const row = data?.[0];
    if (!row?.data || self !== account) return null;
    return toLocation({ ...row.data, location_at: row.location_at || row.data.location_at }, row.user_id, row.sent_at);
  }
  if (!legacy) return null;
  if (account.isAdmin) {
    const { data, error } = await supabase
      .from('user_progress')
      .select('user_id, data, updated_at')
      .eq('type', 'location')
      .neq('user_id', account.userId)
      .order('updated_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    const row = data?.[0];
    if (!row?.data || self !== account) return null;
    return toLocation(row.data, row.user_id, row.updated_at);
  }

  const { data, error } = await supabase
    .from('content')
    .select('data, updated_at')
    .eq('id', ADMIN_ROW_ID)
    .maybeSingle();
  if (error) throw error;
  if (self !== account || !data?.data || data.data.user_id === account.userId) return null;
  return toLocation(data.data, data.data.user_id, data.updated_at);
}

const optionalNumber = value => {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

function toLocation(data, userId, sentAt) {
  const lat = optionalNumber(data?.lat);
  const lng = optionalNumber(data?.lng);
  if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return {
    lat,
    lng,
    // `at` es el momento de envío de la batería/red. Si existe, el mapa usa
    // la hora real de GPS: una última ubicación no puede aparentar actualidad
    // solo porque el servicio siguió enviando el porcentaje de batería.
    at: data?.location_at || data?.at || null,
    sentAt: sentAt || data?.at || null,
    locationAgeMs: optionalNumber(data?.location_age_ms),
    userId: data?.user_id || userId || null,
    name: data?.name || '',
    avatar: data?.avatar || '',
    // Datos del dispositivo: viajan con la posición, si el móvil los da.
    battery: optionalNumber(data?.battery),
    charging: data?.charging === true,
    net: data?.net || '',
    mbps: optionalNumber(data?.mbps),
    speed: optionalNumber(data?.speed),
    accuracy: optionalNumber(data?.accuracy),
    // true = la fila la escribió el servicio en segundo plano del APK.
    bg: data?.bg === true,
  };
}

/** Nombre y foto de un perfil: lo que se pinta en cada círculo. */
export async function fetchProfile(userId) {
  if (!userId || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('name, avatar_url')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return data ? { name: data.name || '', avatar: data.avatar_url || '' } : null;
  } catch {
    return null;
  }
}

let cachedPartnerId = null;

/**
 * Quién es la otra persona.
 *
 * La foto tiene que verse SIEMPRE, no solo cuando la otra cuenta comparte
 * ubicación, así que el id se busca por capas: su fila de ubicación, luego su
 * latido de presencia y, si no, cualquier perfil que no sea el mío. Los ids
 * salen de filas que los dos roles ya pueden leer.
 */
export async function fetchPartnerIdentity() {
  const account = self;
  if (!account) return null;
  if (cachedPartnerId) return cachedPartnerId;

  const located = await fetchPartnerLocation();
  if (self !== account) return null;
  if (located?.userId) {
    cachedPartnerId = located.userId;
    return cachedPartnerId;
  }

  try {
    const { coupleId, legacy } = await account.scope;
    if (self !== account) return null;
    if (coupleId) {
      const { data } = await supabase
        .from('couple_members')
        .select('user_id')
        .eq('couple_id', coupleId)
        .neq('user_id', account.userId)
        .limit(1);
      if (self === account) cachedPartnerId = data?.[0]?.user_id || null;
      return self === account ? cachedPartnerId : null;
    }
    if (!legacy) return null;
    if (account.isAdmin) {
      const { data } = await supabase
        .from('user_progress')
        .select('user_id')
        .neq('user_id', account.userId)
        .limit(1);
      if (self === account && data?.[0]?.user_id) {
        cachedPartnerId = data[0].user_id;
        return cachedPartnerId;
      }
    } else {
      const { data } = await supabase
        .from('content')
        .select('data')
        .eq('id', 'presence_admin')
        .maybeSingle();
      if (self === account && data?.data?.user_id) {
        cachedPartnerId = data.data.user_id;
        return cachedPartnerId;
      }
    }
  } catch {
    /* sin latido legible: se prueba con los perfiles */
  }

  try {
    if (self !== account) return null;
    const { data } = await supabase.from('profiles').select('id').neq('id', account.userId).limit(1);
    if (self === account && data?.[0]?.id) cachedPartnerId = data[0].id;
  } catch {
    /* RLS sin acceso: el círculo se queda con el corazón */
  }

  // Nunca devolver mi propio id: acabaría pintando mi foto como la pareja.
  return self === account && cachedPartnerId !== account.userId ? cachedPartnerId : null;
}

/** Distancia en km entre dos coordenadas (haversine). */
export function distanceKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const rad = deg => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 0.85 → «850 m»; 3.2 → «3,2 km»; 42.6 → «43 km». */
export function formatDistance(km) {
  if (!Number.isFinite(km)) return '—';
  if (km < 0.01) return km === 0 ? '0 m' : '<10 m';
  if (km < 1) return `${Math.round((km * 1000) / 10) * 10} m`;
  const value = km < 10 ? km.toFixed(1).replace('.', ',') : String(Math.round(km));
  return `${value.replace(/,0$/, '')} km`;
}

// Los datos del widget los guarda widgets.service.js: aquí solo se calcula la
// distancia. Tenerlo en un único sitio evita que dos escritores se pisen.

/**
 * Vigila la distancia y avisa con `{ km, partner, stale }`.
 *
 * Una vez al empezar, cada `intervalMs` y al volver a la pestaña. Devuelve la
 * función para dejar de vigilar (page.cleanup).
 */
/* ==========================================
   «JUNTOS» — el mismo sitio, con el margen del GPS
   ==========================================
   El umbral es 10 m, pero un móvil nunca sabe su sitio con más precisión que
   la que declara: se suma la mitad de la peor precisión de los dos y se limita
   a 15 m, así que nunca se dice «juntos» más allá de 25 m. */
export const TOGETHER_M = 10;

/** Distancia en metros entre dos posiciones (Haversine). */
export function metersBetween(a, b) {
  if (!Number.isFinite(a?.lat) || !Number.isFinite(b?.lat)) return null;
  if (!Number.isFinite(a?.lng) || !Number.isFinite(b?.lng)) return null;
  const rad = v => (v * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** ¿Están en el mismo sitio? Devuelve metros, margen y la respuesta. */
export function togetherInfo(me, partner) {
  const meters = metersBetween(me, partner);
  if (meters == null) return null;
  const worst = Math.max(Number(me.accuracy) || 0, Number(partner.accuracy) || 0);
  const margin = Math.min(15, Math.round(worst / 2));
  return { meters, margin, together: meters <= TOGETHER_M + margin };
}

export function watchDistance(handler, { intervalMs = 60000 } = {}) {
  let alive = true;
  let querying = false;
  let again = false;
  let partner = null;
  let channel = null;
  const account = self;
  const emitDistance = () => {
    if (!alive || self !== account) return;
    const me = fetchMyLocation();
    const stale = !!partner && !isFresh(partner.at);
    const km = me && isFresh(me.at) && !stale ? distanceKm(me, partner) : null;
    handler({ km, partner, partnerId: partner?.userId || null, stale });
  };

  const tick = async () => {
    if (!alive || !account || self !== account || document.visibilityState === 'hidden') return;
    if (querying) {
      again = true;
      return;
    }
    querying = true;
    try {
      const { coupleId } = await account.scope;
      if (!alive || self !== account) return;
      if (coupleId && !channel) {
        channel = supabase.channel(`location:${coupleId}:${++nextDistanceWatch}`)
          .on('postgres_changes', {
            event: '*', schema: 'public', table: 'couple_locations', filter: `couple_id=eq.${coupleId}`,
          }, payload => {
            const userId = payload.new?.user_id || payload.old?.user_id;
            if (userId !== account.userId) void tick();
          }).subscribe();
      }
      partner = await queryPartnerLocation(account);
    } catch {
      // Un corte de red conserva el último dato y el reloj indica si ha caducado.
    } finally {
      querying = false;
      emitDistance();
      if (again) {
        again = false;
        void tick();
      }
    }
  };

  distanceListeners.add(emitDistance);
  const offDevice = isNative() ? onDeviceStatus(({ background }) => {
    const row = background.data;
    if (row?.user_id !== account?.userId || !self || self !== account) return;
    const parsed = toLocation(row, row.user_id);
    if (parsed && Date.parse(parsed.at) >= (Date.parse(myLocation?.at) || 0)) {
      setMyLocation(parsed);
    }
  }) : null;
  void tick();
  const timer = setInterval(tick, intervalMs);
  const onVis = () => {
    if (document.visibilityState === 'visible') tick();
  };
  document.addEventListener('visibilitychange', onVis);

  return () => {
    alive = false;
    distanceListeners.delete(emitDistance);
    offDevice?.();
    if (channel) void supabase.removeChannel(channel);
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVis);
  };
}

/** Tu propia posición, la última que se escribió. */
export function fetchMyLocation() {
  const row = getDeviceStatus().background.data;
  if (self && row?.user_id === self.userId) {
    const location = toLocation(row, row.user_id);
    if (location && Date.parse(location.at) >= (Date.parse(myLocation?.at) || 0)) return location;
  }
  return myLocation;
}
