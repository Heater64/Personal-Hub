/* ==========================================
   presence.service.js — Quién está conectado de verdad.

   El "en línea" de un chat no se puede inventar. Cada cliente escribe un
   latido cada 30 s y el otro lo lee por polling: si el último latido tiene
   más de 75 s, la persona está desconectada.

   El mismo latido lleva el aviso de "escribiendo": `setTyping()` escribe la
   marca y el otro lado la considera vigente 5 s. No hay cambio de esquema;
   es el mismo JSON de siempre con un campo más.

   Sin cambios de esquema. La tabla `user_progress` ya es genérica y su RLS
   deja al admin leer las filas de la otra persona
   (`user_progress_select_own` incluye `OR public.is_admin()`), pero la
   usuaria no puede leer las del admin. Por eso cada rol late donde el otro
   SÍ puede leer:
     · admin    → `content` id `presence_admin` (lectura abierta a todos)
     · usuaria  → `user_progress` type `presence` (el admin la lee por RLS)

   El latido lleva también nombre y foto. La RLS de `profiles` solo deja
   leer la fila propia (o al admin), así que sin esto la usuaria no podría
   pintar la foto del admin en Mal Día.
   ========================================== */

import { supabase } from './supabase.js';

const BEAT_MS = 30000;
const STALE_MS = 75000;       // sin latido en 75 s → desconectado
const TYPING_MS = 5000;       // "escribiendo…" dura 5 s desde el último aviso
const TYPING_WRITE_MS = 2500; // no escribir en red más de una vez cada 2,5 s
const ADMIN_ROW_ID = 'presence_admin';

let beatTimer = null;
let self = null;             // { userId, isAdmin }
let onVisible = null;
let typingAt = null;         // ISO del último "escribiendo" de este lado
let lastTypingWrite = 0;

const isDbReady = () => !!supabase;

/** Escribe la fila de presencia con el latido y, si toca, el "escribiendo". */
async function writePresence() {
  if (!self?.userId || !isDbReady()) return;
  const at = new Date().toISOString();
  // Nombre y foto viajan con el latido: el otro lado no puede leer `profiles`.
  const data = { at, name: self.name || '', avatar: self.avatar || '' };
  if (typingAt) data.typing_at = typingAt;
  try {
    if (self.isAdmin) {
      await supabase.from('content').upsert(
        { id: ADMIN_ROW_ID, data: { ...data, user_id: self.userId }, updated_at: at },
        { onConflict: 'id' }
      );
    } else {
      await supabase.from('user_progress').upsert(
        { user_id: self.userId, type: 'presence', data, updated_at: at },
        { onConflict: 'user_id,type' }
      );
    }
  } catch { /* sin conexión: el siguiente latido lo reintenta */ }
}

function beat() { writePresence(); }

/** Empieza a latir (idempotente). Se llama al iniciar sesión. */
export function startPresence({ userId, isAdmin, name = '', avatar = '' } = {}) {
  if (!userId || !isDbReady()) return;
  stopPresence();
  self = { userId: String(userId), isAdmin: !!isAdmin, name, avatar };
  typingAt = null;
  lastTypingWrite = 0;
  beat();
  beatTimer = setInterval(beat, BEAT_MS);
  onVisible = () => { if (document.visibilityState === 'visible') beat(); };
  document.addEventListener('visibilitychange', onVisible);
}

/**
 * Refresca el nombre y la foto del latido, y lo escribe en el acto.
 *
 * El latido es la única vía por la que la otra cuenta ve la foto de quien no
 * puede leer en `profiles`: si la copia no se refresca, la foto anterior se
 * queda pegada hasta reiniciar sesión.
 */
export function updatePresenceIdentity({ name, avatar } = {}) {
  if (!self) return;
  if (typeof name === 'string' && name) self.name = name;
  if (typeof avatar === 'string') self.avatar = avatar;
  writePresence();
}

/** Deja de latir (logout o cambio de cuenta). */
export function stopPresence() {
  if (beatTimer) { clearInterval(beatTimer); beatTimer = null; }
  if (onVisible) { document.removeEventListener('visibilitychange', onVisible); onVisible = null; }
  self = null;
  typingAt = null;
  lastTypingWrite = 0;
}

/**
 * Avisa de que esta persona está escribiendo (`setTyping()`), o de que ha
 * dejado de hacerlo (`setTyping(false)`). El aviso viaja en el mismo latido
 * que ya se escribe cada 30 s, así que no hay peticiones de más.
 */
export function setTyping(active = true) {
  if (!self?.userId || !isDbReady()) return;
  const now = Date.now();
  if (!active) {
    if (!typingAt) return;          // no había nada que apagar
    typingAt = null;
    lastTypingWrite = 0;
    writePresence();
    return;
  }
  if (now - lastTypingWrite < TYPING_WRITE_MS) return; // throttle
  lastTypingWrite = now;
  typingAt = new Date(now).toISOString();
  writePresence();
}

/** Lee el último latido de la otra persona: { at, typingAt, userId } o null. */
export async function fetchPartnerPresence() {
  if (!self?.userId || !isDbReady()) return null;
  try {
    if (self.isAdmin) {
      // La otra persona es la usuaria: su latido vive en user_progress.
      const { data, error } = await supabase
        .from('user_progress')
        .select('user_id, data, updated_at')
        .eq('type', 'presence')
        .neq('user_id', self.userId)
        .order('updated_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const row = data?.[0];
      return row
        ? {
          at: row.data?.at || row.updated_at,
          typingAt: row.data?.typing_at || null,
          userId: row.user_id,
          name: row.data?.name || '',
          avatar: row.data?.avatar || '',
        }
        : null;
    }
    // La otra persona es el admin: su latido vive en content.
    const { data, error } = await supabase
      .from('content')
      .select('data, updated_at')
      .eq('id', ADMIN_ROW_ID)
      .maybeSingle();
    if (error) throw error;
    return data
      ? {
        at: data.data?.at || data.updated_at,
        typingAt: data.data?.typing_at || null,
        userId: data.data?.user_id || null,
        name: data.data?.name || '',
        avatar: data.data?.avatar || '',
      }
      : null;
  } catch {
    return null;
  }
}

/**
 * Nombre y foto de la otra persona: su perfil de verdad (tabla `profiles`,
 * la misma que usan Inicio y el mapa). El id sale del latido, que cada rol
 * escribe donde el otro puede leerlo.
 */
export async function fetchPartnerProfile(userId = null) {
  if (!isDbReady()) return null;
  try {
    let id = userId || (await fetchPartnerPresence())?.userId;
    // Sin latido (recién instalado, o nunca abrió la app) se busca su perfil
    // por descarte: cualquier perfil que no sea el mío.
    if (!id && self?.userId) {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .neq('id', self.userId)
        .limit(1);
      id = data?.[0]?.id || null;
    }
    if (!id) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('name, avatar_url')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (data?.avatar_url) return { name: data.name || '', avatar: data.avatar_url || '' };

    // La RLS de `profiles` deja a cada cuenta leer solo su fila (o al admin):
    // ella no puede leer la del admin. Nombre y foto viajan en el latido.
    const beat = await fetchPartnerPresence();
    if (beat && (!beat.userId || beat.userId === id) && (beat.avatar || beat.name)) {
      return { name: beat.name || data?.name || '', avatar: beat.avatar || '' };
    }

    // Y también con la última ubicación compartida (fila que los dos leen).
    if (!self?.isAdmin) {
      const { data: row } = await supabase
        .from('content')
        .select('data')
        .eq('id', 'location_admin')
        .maybeSingle();
      const loc = row?.data;
      if (loc && (!loc.user_id || loc.user_id === id) && (loc.avatar || loc.name)) {
        return { name: loc.name || data?.name || '', avatar: loc.avatar || '' };
      }
    }
    return data ? { name: data.name || '', avatar: data.avatar_url || '' } : null;
  } catch {
    return null;
  }
}

/** ¿Ese latido es lo bastante reciente para llamarlo "en línea"? */
export function isRecent(iso) {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && Date.now() - t < STALE_MS;
}

/** ¿Ese aviso de "escribiendo" sigue vigente? */
export function isTyping(iso) {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && Date.now() - t < TYPING_MS;
}

/**
 * Vigila la presencia de la otra persona y avisa con { online, at, typing }:
 * una vez al empezar, cada `intervalMs` y al volver a la pestaña.
 * Devuelve la función para dejar de vigilar (page.cleanup).
 */
export function watchPartnerPresence(handler, { intervalMs = 20000 } = {}) {
  let alive = true;
  const tick = async () => {
    const partner = await fetchPartnerPresence();
    if (!alive) return;
    handler({
      online: isRecent(partner?.at),
      at: partner?.at || null,
      typing: isTyping(partner?.typingAt),
      userId: partner?.userId || null
    });
  };
  tick();
  const timer = setInterval(tick, intervalMs);
  const onVis = () => { if (document.visibilityState === 'visible') tick(); };
  document.addEventListener('visibilitychange', onVis);
  return () => {
    alive = false;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVis);
  };
}
