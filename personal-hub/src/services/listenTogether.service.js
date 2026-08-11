/* ==========================================
   Personal Hub — Escuchar juntos (sincronización de música)
   Canal broadcast de Supabase Realtime (sin tabla nueva):
   - 'request'     → alguien quiere escuchar contigo { name, avatar }
   - 'response'    → respuesta a una solicitud { approved, name, avatar }
   - 'hello' / 'bye' → quién está escuchando contigo (presencia)
   - 'listen'      → { action: 'song'|'playpause'|'seek', key, t, playing }
   El estado de la sesión (activa + con quién) vive aquí, para que la
   solicitud y la aceptación funcionen desde cualquier página. El estado
   de reproducción vive en Canciones.js; aquí solo vive el canal, el envío
   y la suscripción. Si Supabase no está disponible, todo degrada a no-op.
   ========================================== */

import { supabase } from './supabase.js';
import { db } from './db.service.js';

const CHANNEL = 'ph-listen-together';

let channel = null;
let subscribed = false;   // el canal está escuchando (solicitudes incluidas)
let active = false;       // la sesión compartida está activa
let pending = false;      // hay una solicitud enviada esperando respuesta
let myName = '';
let myAvatar = '';
let peerName = '';        // quién está escuchando conmigo
let peerAvatar = '';
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

/** Suscribe el canal globalmente (idempotente). Permite recibir solicitudes
 *  de 'escuchar juntos' estando en cualquier página de la web. */
export function initListenTogether() {
  if (subscribed || !db.isSupabaseConfigured()) return;
  subscribed = true;
  try {
    channel = supabase
      .channel(CHANNEL)
      .on('broadcast', { event: 'listen' }, ({ payload }) => emit('listen', payload))
      .on('broadcast', { event: 'request' }, ({ payload }) => emit('request', payload))
      .on('broadcast', { event: 'response' }, ({ payload }) => {
        pending = false;
        emit('state', {});
        emit('response', payload);
      })
      .on('broadcast', { event: 'hello' }, ({ payload }) => {
        if (!active) return;
        if (payload?.name) {
          peerName = payload.name;
          peerAvatar = typeof payload.avatar === 'string' ? payload.avatar : '';
          emit('hello', { name: peerName, avatar: peerAvatar });
        }
      })
      .on('broadcast', { event: 'bye' }, ({ payload }) => {
        if (!active) return;
        if (peerName) {
          peerName = '';
          peerAvatar = '';
          emit('bye', {});
        }
      })
      .subscribe();
  } catch (err) {
    console.warn('[listen] Realtime no disponible:', err.message);
  }
}

/** Activa la sesión compartida y avisa al otro (presencia). */
export function startListenTogether(name = '', avatar = '') {
  initListenTogether();
  active = true;
  pending = false;
  myName = name;
  myAvatar = avatar;
  if (channel) {
    try { channel.send({ type: 'broadcast', event: 'hello', payload: { name, avatar } }); } catch { /* no-op */ }
  }
  emit('state', {});
}

/** Desactiva la sesión y avisa de que te marchas. */
export function stopListenTogether() {
  active = false;
  pending = false;
  myName = '';
  myAvatar = '';
  if (channel) {
    try { broadcast('bye', {}); } catch { /* no-op */ }
  }
  emit('state', {});
}

/** Envía una solicitud para escuchar juntos. */
export function requestListenTogether(name = '', avatar = '') {
  initListenTogether();
  if (active) return;
  pending = true;
  broadcast('request', { name, avatar });
  emit('state', {});
}

/** Cancela una solicitud pendiente sin desactivar la sesión activa. */
export function cancelListenRequest() {
  if (!pending) return;
  pending = false;
  emit('state', {});
}

/** Responde a una solicitud de escuchar juntos. */
export function respondListenTogether(approved, name = '', avatar = '') {
  initListenTogether();
  broadcast('response', { approved: Boolean(approved), name, avatar });
}

export function isListenTogetherActive() {
  return active;
}

/** Estado actual de la sesión: { active, pending, peerName, peerAvatar }. */
export function getListenTogetherState() {
  return { active, pending, peerName, peerAvatar };
}

/** Envía un evento de reproducción a quien esté en la sesión. */
export function sendListenEvent(payload) {
  if (!active) return;
  broadcast('listen', payload);
}

/** Suscripción: handler({ type: 'listen'|'request'|'response'|'hello'|'bye'|'state', payload }). */
export function onListenTogether(handler) {
  subs.add(handler);
  return () => subs.delete(handler);
}
