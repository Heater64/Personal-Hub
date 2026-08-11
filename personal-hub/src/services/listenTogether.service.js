/* ==========================================
   Personal Hub — Escuchar juntos (sincronización de música)
   Canal broadcast de Supabase Realtime (sin tabla nueva):
   - 'hello' / 'bye' → quién está escuchando contigo (presencia)
   - 'listen'        → { action: 'song'|'playpause'|'seek', key, t, playing }
   El estado de reproducción vive en Canciones.js; aquí solo vive
   el canal, el envío y la suscripción. Si Supabase no está
   disponible, todo degrada a no-op sin romper la reproducción.
   ========================================== */

import { supabase } from './supabase.js';
import { db } from './db.service.js';

const CHANNEL = 'ph-listen-together';

let channel = null;
let started = false;
const subs = new Set();

function emit(type, payload) {
  subs.forEach(fn => {
    try { fn({ type, payload }); } catch (err) { console.warn('[listen] handler error:', err.message); }
  });
}

function broadcast(event, payload) {
  if (!channel) return;
  try {
    channel.send({ type: 'broadcast', event, payload });
  } catch (err) {
    console.warn('[listen] No se pudo enviar:', err.message);
  }
}

/** Activa la sesión compartida (idempotente). name = nombre visible para el otro. */
export function startListenTogether(name = '') {
  if (started) return;
  started = true;
  if (!db.isSupabaseConfigured()) return;
  try {
    channel = supabase
      .channel(CHANNEL)
      .on('broadcast', { event: 'listen' }, ({ payload }) => emit('listen', payload))
      .on('broadcast', { event: 'hello' }, ({ payload }) => emit('hello', payload))
      .on('broadcast', { event: 'bye' }, ({ payload }) => emit('bye', payload))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') broadcast('hello', { name });
      });
  } catch (err) {
    console.warn('[listen] Realtime no disponible:', err.message);
  }
}

/** Desactiva la sesión y avisa de que te marchas. */
export function stopListenTogether() {
  started = false;
  if (channel) {
    try { broadcast('bye', {}); } catch { /* no-op */ }
    try { supabase.removeChannel(channel); } catch { /* ya eliminado */ }
    channel = null;
  }
}

export function isListenTogetherActive() {
  return started;
}

/** Envía un evento de reproducción a quien esté en la sesión. */
export function sendListenEvent(payload) {
  broadcast('listen', payload);
}

/** Suscripción: handler({ type: 'listen'|'hello'|'bye', payload }). */
export function onListenTogether(handler) {
  subs.add(handler);
  return () => subs.delete(handler);
}
