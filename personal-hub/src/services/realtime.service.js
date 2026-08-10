/* ==========================================
   realtime.service.js — Sincronización en tiempo real.

   Cuando el Admin edita contenido (tabla `content` de Supabase),
   todos los usuarios deben ver los cambios lo antes posible:

   1. Supabase Realtime (postgres_changes sobre la tabla `content`)
      → entrega instantánea cuando la tabla está en la publicación
        supabase_realtime (ver supabase-schema.sql).
   2. Polling de seguridad cada 25s + al volver a la pestaña
      (visibilitychange / focus): cubre el caso de que Realtime no
      esté habilitado, la conexión se haya caído o el cambio ocurriera
      mientras la pestaña estaba en segundo plano.

   Al detectar un cambio:
   · refresca el espejo local (ph.config.<id>) para lecturas offline
   · invalida cachés en memoria (p. ej. el catálogo de regalos)
   · dispara el evento window 'ph:content-updated' { detail: { id } }
     para que las páginas montadas se re-rendericen al instante.
   ========================================== */

import { supabase } from './supabase.js';
import { db } from './db.service.js';
import { invalidateGiftsCache } from './gifts.service.js';

const POLL_INTERVAL = 25000;

let channel = null;
let pollTimer = null;
let lastSeen = {};   // id -> updated_at (para detectar cambios por polling)
let started = false;
let warned = false;

/** Procesa un cambio real de contenido: espejo local + cachés + evento. */
function handleChange(id, eventType, newData) {
  if (!id) return;

  // 1. Espejo local (misma clave que db.service: ph.config.<id>)
  try {
    if (eventType === 'DELETE') {
      localStorage.removeItem('ph.config.' + id);
    } else if (newData !== undefined) {
      localStorage.setItem('ph.config.' + id, JSON.stringify(newData));
    }
  } catch { /* cuota llena: ignorar */ }

  // 2. Cachés en memoria que dependen de contenido del Admin
  if (id === 'gifts') invalidateGiftsCache();

  // 3. Avisa a las páginas montadas (cada página decide cómo re-renderizar)
  window.dispatchEvent(new CustomEvent('ph:content-updated', { detail: { id } }));
}

/**
 * Inicia la sincronización (idempotente). Se llama al iniciar sesión.
 * En modo local (Supabase no configurado) no hace nada: no hay nada que
 * sincronizar entre usuarios.
 */
export function initRealtime() {
  if (started) return;
  started = true;
  if (!db.isSupabaseConfigured()) return;

  try {
    channel = supabase
      .channel('ph-content-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content' }, (payload) => {
        const id = payload.new?.id ?? payload.old?.id;
        // Actualiza lastSeen para que el polling no re-dispare el mismo cambio
        if (payload.new?.updated_at) lastSeen[id] = payload.new.updated_at;
        else if (payload.eventType === 'DELETE') delete lastSeen[id];
        handleChange(id, payload.eventType === 'DELETE' ? 'DELETE' : 'UPDATE', payload.new?.data);
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' && !warned) {
          console.warn('[realtime] Realtime no disponible (¿la tabla content está en la publicación supabase_realtime?). Se usará polling.');
          warned = true;
        }
      });
  } catch (err) {
    console.warn('[realtime] No se pudo suscribir a cambios:', err.message);
  }

  startPolling();
}

/** Polling: compara updated_at con la última vista conocida. */
async function pollOnce() {
  if (!started) return;
  try {
    const { data, error } = await supabase.from('content').select('id, updated_at');
    if (error) throw error;

    const now = {};
    (data || []).forEach(r => { if (r.id) now[r.id] = r.updated_at; });

    const changed = Object.keys(now).filter(id => lastSeen[id] && lastSeen[id] !== now[id]);
    const deleted = Object.keys(lastSeen).filter(id => !(id in now));
    lastSeen = now;

    if (changed.length) {
      // Recupera el data completo de los ids cambiados para refrescar el espejo
      const { data: rows, error: rowsError } = await supabase
        .from('content').select('id, data').in('id', changed);
      if (!rowsError) {
        const found = new Set((rows || []).map(r => r.id));
        (rows || []).forEach(r => handleChange(r.id, 'UPDATE', r.data));
        changed.filter(id => !found.has(id)).forEach(id => handleChange(id, 'DELETE'));
      } else {
        changed.forEach(id => handleChange(id, 'UPDATE'));
      }
    }
    deleted.forEach(id => handleChange(id, 'DELETE'));
  } catch { /* offline: reintentar en el siguiente tick */ }
}

function onVisibility() {
  if (document.visibilityState === 'visible') pollOnce();
}
function onFocus() {
  pollOnce();
}

function startPolling() {
  pollOnce(); // siembra lastSeen sin disparar cambios
  pollTimer = setInterval(pollOnce, POLL_INTERVAL);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('focus', onFocus);
}

/** Detiene la sincronización (logout). Se puede volver a iniciar tras login. */
export function stopRealtime() {
  started = false;
  if (channel) {
    try { supabase.removeChannel(channel); } catch { /* ya eliminado */ }
    channel = null;
  }
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  document.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('focus', onFocus);
  lastSeen = {};
  warned = false;
}

/**
 * Suscripción para páginas: llama a handler(id) cuando cambia un id de la
 * lista. Devuelve una función para desuscribirse (llamar en page.cleanup).
 */
export function onContentChange(ids, handler) {
  const wrapped = (e) => {
    const id = e.detail?.id;
    if (id && ids.includes(id)) handler(id);
  };
  window.addEventListener('ph:content-updated', wrapped);
  return () => window.removeEventListener('ph:content-updated', wrapped);
}
