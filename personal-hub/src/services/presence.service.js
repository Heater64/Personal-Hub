/* ==========================================
   presence.service.js — Quién está conectado de verdad.

   El "en línea" de un chat no se puede inventar. Cada cliente escribe un
   latido cada 30 s y el otro lo lee por polling: si el último latido tiene
   más de 75 s, la persona está desconectada.

   Sin cambios de esquema. La tabla `user_progress` ya es genérica y su RLS
   deja al admin leer las filas de la otra persona
   (`user_progress_select_own` incluye `OR public.is_admin()`), pero la
   usuaria no puede leer las del admin. Por eso cada rol late donde el otro
   SÍ puede leer:
     · admin    → `content` id `presence_admin` (lectura abierta a todos)
     · usuaria  → `user_progress` type `presence` (el admin la lee por RLS)
   ========================================== */

import { supabase } from './supabase.js';

const BEAT_MS = 30000;
const STALE_MS = 75000;      // sin latido en 75 s → desconectado
const ADMIN_ROW_ID = 'presence_admin';

let beatTimer = null;
let self = null;             // { userId, isAdmin }
let onVisible = null;

const isDbReady = () => !!supabase;

/** Escribe el latido de este dispositivo donde el otro puede leerlo. */
async function beat() {
  if (!self?.userId || !isDbReady()) return;
  const at = new Date().toISOString();
  try {
    if (self.isAdmin) {
      await supabase.from('content').upsert(
        { id: ADMIN_ROW_ID, data: { at, user_id: self.userId }, updated_at: at },
        { onConflict: 'id' }
      );
    } else {
      await supabase.from('user_progress').upsert(
        { user_id: self.userId, type: 'presence', data: { at }, updated_at: at },
        { onConflict: 'user_id,type' }
      );
    }
  } catch { /* sin conexión: el siguiente latido lo reintenta */ }
}

/** Empieza a latir (idempotente). Se llama al iniciar sesión. */
export function startPresence({ userId, isAdmin } = {}) {
  if (!userId || !isDbReady()) return;
  stopPresence();
  self = { userId: String(userId), isAdmin: !!isAdmin };
  beat();
  beatTimer = setInterval(beat, BEAT_MS);
  onVisible = () => { if (document.visibilityState === 'visible') beat(); };
  document.addEventListener('visibilitychange', onVisible);
}

/** Deja de latir (logout o cambio de cuenta). */
export function stopPresence() {
  if (beatTimer) { clearInterval(beatTimer); beatTimer = null; }
  if (onVisible) { document.removeEventListener('visibilitychange', onVisible); onVisible = null; }
  self = null;
}

/** Lee el último latido de la otra persona: { at, userId } o null. */
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
      return row ? { at: row.data?.at || row.updated_at, userId: row.user_id } : null;
    }
    // La otra persona es el admin: su latido vive en content.
    const { data, error } = await supabase
      .from('content')
      .select('data, updated_at')
      .eq('id', ADMIN_ROW_ID)
      .maybeSingle();
    if (error) throw error;
    return data ? { at: data.data?.at || data.updated_at, userId: data.data?.user_id || null } : null;
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

/**
 * Vigila la presencia de la otra persona y avisa con { online, at }:
 * una vez al empezar, cada `intervalMs` y al volver a la pestaña.
 * Devuelve la función para dejar de vigilar (page.cleanup).
 */
export function watchPartnerPresence(handler, { intervalMs = 20000 } = {}) {
  let alive = true;
  const tick = async () => {
    const partner = await fetchPartnerPresence();
    if (!alive) return;
    handler({ online: isRecent(partner?.at), at: partner?.at || null });
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
