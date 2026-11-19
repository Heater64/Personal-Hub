/* ==========================================
   location.service.js — Dónde está cada uno.

   Misma idea que presence.service.js, y por la misma razón: la RLS de esta
   app solo deja leer al admin, así que cada rol escribe donde el otro SÍ
   puede leer, sin tocar el esquema.

     · admin    → `content` id `location_admin` (lectura abierta a todos)
     · usuaria  → `user_progress` type `location` (el admin la lee por RLS)

   La web pide la posición al abrir la portada y al volver a primer plano.
   Dentro del APK, `DeviceStatusService` sigue enviando batería, red y
   ubicación con la app cerrada, en la misma fila que esto.
   ========================================== */

import { supabase } from './supabase.js';
import { isNative } from './native.service.js';
import { deviceFactsSnapshot } from './device.service.js';

const ADMIN_ROW_ID = 'location_admin';
const SHARE_MS = 120000; // repite tu posición cada 2 min en uso
const STALE_MS = 30 * 60000; // 30 min sin actualizar: no se muestra

let self = null; // { userId, isAdmin }
let shareTimer = null;
let onVisible = null;
let myLocation = null; // { lat, lng } de este dispositivo

/** ¿La fila está lo bastante fresca para usarla? */
export function isFresh(at) {
  const t = at ? Date.parse(at) : NaN;
  return Number.isFinite(t) && Date.now() - t < STALE_MS;
}

/**
 * Posición actual del dispositivo.
 *
 * enableHighAccuracy va apagado a propósito: para una distancia entre dos
 * ciudades sobra con la antena y gasta mucha menos batería que el GPS.
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
      if (perm?.location === 'granted' || perm?.location === 'denied') return perm.location;
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
    if (mod) {
      const { Geolocation } = mod;
      try {
        let perm = await Geolocation.checkPermissions();
        // El diálogo del sistema solo sale si la persona lo pidió (su botón).
        // Abrir la portada no debe abrir permisos por su cuenta.
        if (perm.location !== 'granted' && prompt) perm = await Geolocation.requestPermissions();
        if (perm.location !== 'granted') throw deniedError(perm.location !== 'denied');
        return await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 12000,
          maximumAge: 60000,
        });
      } catch (err) {
        if (err?.code === 1) throw err;
        // Cualquier otro fallo cae al navegador antes de rendirse.
      }
    }
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
async function push({ userId, isAdmin, coupleId }, setStatus) {
  if (!userId || !supabase) return;
  try {
    const pos = await currentPosition();
    const at = new Date().toISOString();
    const data = {
      lat: Number(pos.coords.latitude.toFixed(5)),
      lng: Number(pos.coords.longitude.toFixed(5)),
      at,
      user_id: userId,
      // El nombre y la foto viajan con la posición: la cuenta de ella no
      // puede leer la fila de `profiles` del admin (RLS), así que si esto
      // dependiera de esa lectura el mapa se quedaría sin nombre ni cara.
      name: self?.name || '',
      avatar: self?.avatar || '',
      ...(await deviceFacts(pos)),
    };

    if (coupleId) {
      const { error } = await supabase.from('couple_locations').upsert(
        {
          couple_id: coupleId,
          user_id: userId,
          data,
          location_at: data.at,
          sent_at: at,
          updated_at: at,
        },
        { onConflict: 'couple_id,user_id' }
      );
      if (error) throw error;
    } else if (isAdmin) {
      await supabase
        .from('content')
        .upsert({ id: ADMIN_ROW_ID, data, updated_at: at }, { onConflict: 'id' });
    } else {
      await supabase
        .from('user_progress')
        .upsert(
          { user_id: userId, type: 'location', data, updated_at: at },
          { onConflict: 'user_id,type' }
        );
    }
    // La propia se guarda entera en memoria: el panel calcula con ella sin
    // volver a encender el GPS cada minuto y el mapa enseña tus datos.
    myLocation = data;
    setStatus?.('ok');
  } catch (err) {
    // 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT.
    // «prompt» es distinto de «denied»: todavía se puede pedir, con un botón.
    setStatus?.(err?.code === 1 ? (err?.needsPrompt ? 'prompt' : 'denied') : 'error');
  }
}

/**
 * Empieza a compartir tu posición (idempotente).
 * Se llama al montar la portada; `stopLocationSharing` al salir.
 */
export function startLocationSharing({ userId, isAdmin, name, avatar } = {}, onStatus) {
  stopLocationSharing();
  if (!userId || !supabase) return;
  // La otra persona puede cambiar de sesión en este móvil: el id cacheado
  // dejaría de ser suyo y acabaría pintando mi foto en los dos círculos.
  cachedPartnerId = null;
  self = { userId: String(userId), isAdmin: !!isAdmin, coupleId: null, name: name || '', avatar: avatar || '' };

  // La pareja es el contrato definitivo. Se conserva la ruta heredada solo
  // mientras una instalación antigua aún no haya aplicado 029/030.
  void supabase
    .from('couple_members')
    .select('couple_id')
    .eq('user_id', self.userId)
    .maybeSingle()
    .then(({ data }) => {
      if (!self || data?.couple_id == null) return;
      self.coupleId = data.couple_id;
      void push(self, onStatus);
    })
    .catch(() => {});

  push(self, onStatus);
  shareTimer = setInterval(() => push(self, onStatus), SHARE_MS);
  onVisible = () => {
    if (document.visibilityState === 'visible') push(self, onStatus);
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
  if (!self) return false;

  if (isNative()) {
    const mod = await import('@capacitor/geolocation').catch(() => null);
    if (mod) {
      try {
        const perm = await mod.Geolocation.requestPermissions();
        const granted = perm.location === 'granted';
        if (granted) await push(self, onStatus);
        onStatus?.(granted ? 'ok' : 'denied');
        return granted;
      } catch {
        /* cae al camino del navegador */
      }
    }
  }

  try {
    // Con gesto de por medio sí se puede abrir el diálogo del navegador.
    await currentPosition({ prompt: true });
    await push(self, onStatus);
    return true;
  } catch (err) {
    onStatus?.(err?.code === 1 ? (err?.needsPrompt ? 'prompt' : 'denied') : 'error');
    return false;
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
}

/** Última posición conocida de la otra persona: { lat, lng, at, userId } o null. */
export async function fetchPartnerLocation() {
  if (!self?.userId || !supabase) return null;
  try {
    if (self.coupleId) {
      const { data, error } = await supabase
        .from('couple_locations')
        .select('user_id, data, location_at, sent_at')
        .eq('couple_id', self.coupleId)
        .neq('user_id', self.userId)
        .order('sent_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const row = data?.[0];
      if (!row?.data) return null;
      return toLocation({ ...row.data, location_at: row.location_at || row.data.location_at }, row.user_id);
    }
    if (self.isAdmin) {
      const { data, error } = await supabase
        .from('user_progress')
        .select('user_id, data, updated_at')
        .eq('type', 'location')
        .neq('user_id', self.userId)
        .order('updated_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const row = data?.[0];
      if (!row?.data) return null;
      return toLocation(row.data, row.user_id);
    }

    const { data, error } = await supabase
      .from('content')
      .select('data, updated_at')
      .eq('id', ADMIN_ROW_ID)
      .maybeSingle();
    if (error) throw error;
    const loc = data?.data ? toLocation(data.data, data.data.user_id) : null;
    // Si la fila dice ser de esta misma cuenta, se escribió por error desde
    // este móvil: no es la otra persona y no debe pintarse como pareja.
    if (loc && loc.userId && loc.userId === self.userId) return null;
    return loc;
  } catch {
    return null;
  }
}

function toLocation(data, userId) {
  const lat = Number(data?.lat);
  const lng = Number(data?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    // `at` es el momento de envío de la batería/red. Si existe, el mapa usa
    // la hora real de GPS: una última ubicación no puede aparentar actualidad
    // solo porque el servicio siguió enviando el porcentaje de batería.
    at: data?.location_at || data?.at || null,
    sentAt: data?.at || null,
    locationAgeMs: Number.isFinite(Number(data?.location_age_ms)) ? Number(data.location_age_ms) : null,
    userId: data?.user_id || userId || null,
    name: data?.name || '',
    avatar: data?.avatar || '',
    // Datos del dispositivo: viajan con la posición, si el móvil los da.
    battery: Number.isFinite(Number(data?.battery)) ? Number(data.battery) : null,
    charging: data?.charging === true,
    net: data?.net || '',
    mbps: Number.isFinite(Number(data?.mbps)) ? Number(data.mbps) : null,
    speed: Number.isFinite(Number(data?.speed)) ? Number(data.speed) : null,
    accuracy: Number.isFinite(Number(data?.accuracy)) ? Math.round(Number(data.accuracy)) : null,
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
  if (!self?.userId || !supabase) return null;
  if (cachedPartnerId) return cachedPartnerId;

  const located = await fetchPartnerLocation();
  if (located?.userId) {
    cachedPartnerId = located.userId;
    return cachedPartnerId;
  }

  try {
    if (self.coupleId) {
      const { data } = await supabase
        .from('couple_members')
        .select('user_id')
        .eq('couple_id', self.coupleId)
        .neq('user_id', self.userId)
        .limit(1);
      if (data?.[0]?.user_id) {
        cachedPartnerId = data[0].user_id;
        return cachedPartnerId;
      }
    }
    if (self.isAdmin) {
      const { data } = await supabase
        .from('user_progress')
        .select('user_id')
        .neq('user_id', self.userId)
        .limit(1);
      if (data?.[0]?.user_id) {
        cachedPartnerId = data[0].user_id;
        return cachedPartnerId;
      }
    } else {
      const { data } = await supabase
        .from('content')
        .select('data')
        .eq('id', 'presence_admin')
        .maybeSingle();
      if (data?.data?.user_id) {
        cachedPartnerId = data.data.user_id;
        return cachedPartnerId;
      }
    }
  } catch {
    /* sin latido legible: se prueba con los perfiles */
  }

  try {
    const { data } = await supabase.from('profiles').select('id').neq('id', self.userId).limit(1);
    if (data?.[0]?.id) cachedPartnerId = data[0].id;
  } catch {
    /* RLS sin acceso: el círculo se queda con el corazón */
  }

  // Nunca devolver mi propio id: acabaría pintando mi foto como la pareja.
  return cachedPartnerId && cachedPartnerId !== self.userId ? cachedPartnerId : null;
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
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
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

  const tick = async () => {
    const partner = await fetchPartnerLocation();
    if (!alive) return;
    if (!partner) {
      handler({ km: null, partner: null, partnerId: null, stale: false });
      return;
    }
    // La primera vez el GPS puede tardar más que la lectura del otro lado:
    // se le da un margen antes de aceptar que no hay distancia.
    let me = fetchMyLocation();
    if (!me) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      if (!alive) return;
      me = fetchMyLocation();
    }
    const km = me ? distanceKm(me, partner) : null;
    handler({
      km,
      partner,
      partnerId: partner.userId,
      stale: !isFresh(partner.at),
    });
  };

  tick();
  const timer = setInterval(tick, intervalMs);
  const onVis = () => {
    if (document.visibilityState === 'visible') tick();
  };
  document.addEventListener('visibilitychange', onVis);

  return () => {
    alive = false;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVis);
  };
}

/** Tu propia posición, la última que se escribió. */
export function fetchMyLocation() {
  return myLocation;
}
