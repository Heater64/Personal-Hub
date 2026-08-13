/* ==========================================
   Personal Hub — Escuchar juntos (sincronización de música)

   DOS capas:
   1. PRESENCIA + INVITACIONES (canal broadcast de Supabase Realtime):
      - 'request'     → alguien quiere escuchar contigo { name, avatar }
      - 'response'    → respuesta a una solicitud { approved, name, avatar }
      - 'hello' / 'bye' → quién está escuchando contigo (presencia)

   2. ESTADO DE REPRODUCCIÓN (SERVIDOR AUTORITATIVO, tabla listen_sessions):
      Cada dispositivo envía su estado a submit_listen_state() y el SERVIDOR
      valida y decide qué se aplica (elimina el ping-pong del broadcast:
      antes cada uno empujaba su estado y se pisaban). Devuelve el estado
      autoritativo, que el cliente aplica. El servidor solo permite:
      · acciones explícitas (cambiar canción / play / pausa / seek)
      · heartbeats del LÍDER actual que avancen la posición en la MISMA
        canción con el MISMO estado.
      Un seguidor NUNCA puede arrastrar el reloj hacia atrás.

   Si Supabase no está disponible, todo degrada a no-op.
   ========================================== */

import { supabase } from './supabase.js';
import { db } from './db.service.js';

const CHANNEL = 'ph-listen-together';
const LISTEN_CHANNEL = 'ph-listen-state';

let channel = null;
let listenChannel = null; // canal de postgres_changes para listen_sessions
let subscribed = false;   // el canal está escuchando (solicitudes incluidas)
let listenSubscribed = false; // suscripción a cambios de estado en tiempo real
let active = false;       // la sesión compartida está activa
let pending = false;      // hay una solicitud enviada esperando respuesta
let myName = '';
let myAvatar = '';
let peerName = '';        // quién está escuchando conmigo
let peerAvatar = '';
let lastHello = null;     // último 'hello' recibido (evita perder el nombre
                          // si llega antes de que nuestra sesión esté activa)
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
      .on('broadcast', { event: 'request' }, ({ payload }) => emit('request', payload))
      .on('broadcast', { event: 'response' }, ({ payload }) => {
        pending = false;
        emit('state', {});
        emit('response', payload);
      })
      .on('broadcast', { event: 'hello' }, ({ payload }) => {
        if (payload?.name) {
          lastHello = { name: payload.name, avatar: typeof payload.avatar === 'string' ? payload.avatar : '' };
          if (!active) return;
          peerName = payload.name;
          peerAvatar = lastHello.avatar;
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

/** Suscribe a cambios en listen_sessions vía postgres_changes (push instantáneo).
 *  Cuando el líder escribe vía RPC, el seguidor recibe la notificación al
 *  instante en lugar de esperar al próximo tick de sondeo (~333ms). */
export function initListenStateRealtime() {
  if (listenSubscribed || !db.isSupabaseConfigured()) return;
  listenSubscribed = true;
  try {
    listenChannel = supabase
      .channel(LISTEN_CHANNEL)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'listen_sessions' }, (payload) => {
        const row = payload.new;
        if (row && row.song_key) {
          emit('listen', row);
        }
      })
      .subscribe();
  } catch (err) {
    console.warn('[listen] Realtime state no disponible:', err.message);
  }
}

/** Detiene la suscripción a cambios de estado en tiempo real. */
export function stopListenStateRealtime() {
  if (listenChannel) {
    try { supabase.removeChannel(listenChannel); } catch { /* ya eliminado */ }
    listenChannel = null;
  }
  listenSubscribed = false;
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
  // Si el 'hello' del otro llegó antes de activar la sesión (carrera típica
  // en la aceptación mutua), no se pierde: se aplica ahora.
  if (lastHello && !peerName) {
    peerName = lastHello.name;
    peerAvatar = lastHello.avatar;
  }
  emit('state', {});
  if (lastHello && peerName) {
    emit('hello', { name: peerName, avatar: peerAvatar });
  }
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

/** Envía el estado local de reproducción al servidor autoritativo.
 *  El servidor valida (acciones explícitas vs heartbeats del líder) y
 *  devuelve el estado decidido. Devuelve null si Supabase no está.
 *  payload: { song_key, title, artist, playing, position, is_action } */
export async function submitListenState(payload = {}) {
  if (!db.isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabase.rpc('submit_listen_state', {
      p_song_key: String(payload.song_key || ''),
      p_title: String(payload.title || ''),
      p_artist: String(payload.artist || ''),
      p_playing: Boolean(payload.playing),
      p_position: Number.isFinite(payload.position) ? payload.position : 0,
      p_is_action: Boolean(payload.is_action)
    });
    if (error) { console.warn('[listen] submit:', error.message); return null; }
    return data;
  } catch (err) {
    console.warn('[listen] submit:', err.message);
    return null;
  }
}

/** Lee el estado autoritativo actual del servidor (sondeo ~3x/s). */
export async function fetchListenState() {
  if (!db.isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabase.rpc('get_listen_state');
    if (error) { console.warn('[listen] fetch:', error.message); return null; }
    return data;
  } catch (err) {
    console.warn('[listen] fetch:', err.message);
    return null;
  }
}

/** Suscripción: handler({ type: 'listen'|'request'|'response'|'hello'|'bye'|'state', payload }). */
export function onListenTogether(handler) {
  subs.add(handler);
  return () => subs.delete(handler);
}
