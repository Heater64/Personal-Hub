/* ==========================================
   Personal Hub — Servicio de juegos online

   Contrato público:
   · Las escrituras pasan por RPC con revisión optimista.
   · Las lecturas de salas/invitaciones están limitadas por RLS.
   · Realtime solo notifica; el estado recibido siempre se vuelve a leer
     desde Supabase antes de aplicarlo.
   · Hundir la Flota mantiene tablero y barcos propios en game_room_players;
     la sala pública solo contiene disparos, turno y marcador.
   ========================================== */

import { supabase } from './supabase.js';
import { db } from './db.service.js';

export const MULTIPLAYER_GAMES = {
  // Juegos de turnos clásicos (tablero compartido, validado movimiento a movimiento)
  conecta4: { title: 'Conecta 4', emoji: '🔴', href: '/games/conecta4.html', color: '#ff8a5e', accent: '#ffb08f' },
  tresenraya: { title: 'Tres en Raya', emoji: '❌', href: '/games/tresenraya.html', color: '#9ad1ff', accent: '#bce3ff' },
  battleship: { title: 'Hundir la Flota', emoji: '🚢', href: '/games/battleship.html', color: '#5aa0ff', accent: '#8ac0ff' },
  // Modo reto (batalla por puntuación: cada uno juega su turno, gana el de más puntos)
  '2048': { title: '2048', emoji: '🔢', href: '/games/2048.html', color: '#ffcf4d', accent: '#ffe59a' },
  'agujero-negro': { title: 'Agujero Negro', emoji: '🕳️', href: '/games/agujero-negro.html', color: '#b45309', accent: '#ffb347' },
  ahorcado: { title: 'Ahorcado', emoji: '💀', href: '/games/ahorcado.html', color: '#ffb347', accent: '#ffc96b' },
  breakout: { title: 'Breakout', emoji: '🧱', href: '/games/breakout.html', color: '#d4624a', accent: '#e8735a' },
  buscaminas: { title: 'Buscaminas', emoji: '💣', href: '/games/buscaminas.html', color: '#f5a05e', accent: '#ffbd85' },
  cuchillos: { title: 'Cuchillos', emoji: '🔪', href: '/games/cuchillos.html', color: '#ff8aa1', accent: '#ffa9ba' },
  invaders: { title: 'Space Invaders', emoji: '👾', href: '/games/invaders.html', color: '#5ed6d0', accent: '#8ae8e3' },
  laberinto: { title: 'Laberinto', emoji: '🌀', href: '/games/laberinto.html', color: '#e8735a', accent: '#f7a180' },
  memoria: { title: 'Memoria', emoji: '🧠', href: '/games/memoria.html', color: '#ff8aa1', accent: '#ffb3c1' },
  meteoritos: { title: 'Meteoritos', emoji: '☄️', href: '/games/meteoritos.html', color: '#ff9f6e', accent: '#ffb98f' },
  pong: { title: 'Pong', emoji: '🏓', href: '/games/pong.html', color: '#ff9f6e', accent: '#ffc08f' },
  simon: { title: 'Simon Dice', emoji: '🔔', href: '/games/simon.html', color: '#ffcf6e', accent: '#ffdf9e' },
  snake: { title: 'Snake', emoji: '🐍', href: '/games/snake.html', color: '#e8735a', accent: '#f08a70' },
  tetris: { title: 'Tetris', emoji: '🧩', href: '/games/tetris.html', color: '#7c9cff', accent: '#a5baff' },
  tiroarco: { title: 'Tiro al Arco', emoji: '🎯', href: '/games/tiroarco.html', color: '#ffc96b', accent: '#ffdd9e' },
  torre: { title: 'Torre', emoji: '🏗️', href: '/games/torre.html', color: '#f5a05e', accent: '#ffb347' }
};

/** Juegos de modo reto: cada jugador juega su turno y gana el de más puntos. */
export const SCORE_GAME_IDS = new Set([
  '2048', 'agujero-negro', 'ahorcado', 'breakout', 'buscaminas', 'cuchillos',
  'invaders', 'laberinto', 'memoria', 'meteoritos', 'pong', 'simon',
  'snake', 'tetris', 'tiroarco', 'torre'
]);

/**
 * Juegos de modo carrera: los dos jugadores juegan A LA VEZ, cada uno su
 * partida, y en cuanto UNO termina se muestra quién fue más rápido.
 * El estado es { scores: [p0, p1], times: [t0, t1], turn, winner, draw }.
 */
export const RACE_GAME_IDS = new Set(['memoria']);

/** Juegos donde gana el que tenga MENOS puntos (p.ej. Memoria: menos movimientos). */
export const LOWER_SCORE_WINS = new Set(['memoria']);

/**
 * Modo online desactivado temporalmente: los juegos multijugador aún no
 * están listos. Mientras sea false, no se muestra ningún punto de entrada
 * (enlace "Jugar online", centro de invitaciones de juego ni la sala).
 * Cuando vuelva a true, todo se reactiva sin tocar más código.
 */
export const ONLINE_GAMES_ENABLED = false;

export const SHIP_SIZES = [5, 4, 3, 3, 2];
export const BOARD_SIZE = 10;

function emptyGrid(size = BOARD_SIZE) {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

function placeFleet() {
  const board = emptyGrid();
  const ships = [];
  for (const size of SHIP_SIZES) {
    let placed = false;
    for (let attempt = 0; attempt < 500 && !placed; attempt++) {
      const horizontal = Math.random() > 0.5;
      const row = Math.floor(Math.random() * BOARD_SIZE);
      const col = Math.floor(Math.random() * BOARD_SIZE);
      const cells = Array.from({ length: size }, (_, i) => [
        row + (horizontal ? 0 : i), col + (horizontal ? i : 0)
      ]);
      if (cells.some(([r, c]) => r >= BOARD_SIZE || c >= BOARD_SIZE || board[r][c])) continue;
      const around = cells.flatMap(([r, c]) => {
        const result = [];
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) result.push([r + dr, c + dc]);
        return result;
      });
      if (around.some(([r, c]) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c])) continue;
      cells.forEach(([r, c]) => { board[r][c] = 1; });
      ships.push(cells);
      placed = true;
    }
    if (!placed) return placeFleet();
  }
  return { board, ships };
}

/** Estado inicial por juego (lo usan invitación, partida y revancha). */
export function createGameInitialState(gameId, hostId) {
  if (gameId === 'conecta4') {
    return { board: Array.from({ length: 6 }, () => Array(7).fill(0)), turn: hostId, winner: null, draw: false };
  }
  if (gameId === 'tresenraya') {
    return { board: Array(9).fill(0), turn: hostId, winner: null, draw: false };
  }
  if (RACE_GAME_IDS.has(gameId)) {
    return { scores: [null, null], times: [null, null], turn: hostId, winner: null, draw: false };
  }
  if (SCORE_GAME_IDS.has(gameId)) {
    return { scores: [null, null], turn: hostId, winner: null, draw: false };
  }
  const first = placeFleet();
  const second = placeFleet();
  return {
    boards: [first.board, second.board], ships: [first.ships, second.ships], shots: [emptyGrid(), emptyGrid()],
    shipsAlive: [SHIP_SIZES.length, SHIP_SIZES.length], turn: hostId, winner: null, draw: false
  };
}

function assertConfigured() {
  if (!db.isSupabaseConfigured()) {
    throw new Error('El multijugador necesita una conexión con Supabase.');
  }
}

function unwrap(result, fallbackMessage) {
  if (result.error) throw new Error(result.error.message || fallbackMessage);
  return result.data;
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validateRoom(room) {
  const statuses = new Set(['waiting', 'active', 'finished', 'cancelled']);
  if (!room || !isUuid(room.id) || !MULTIPLAYER_GAMES[room.game_id] || !isUuid(room.host_id)
      || !statuses.has(room.status) || !Number.isInteger(room.revision)) {
    throw new Error('La sala devolvió datos no válidos.');
  }
  return room;
}

export async function listGameInviteTargets() {
  assertConfigured();
  const result = await supabase.rpc('get_game_invite_targets');
  const targets = unwrap(result, 'No se pudieron cargar los usuarios disponibles.');
  return (Array.isArray(targets) ? targets : []).filter(target => isUuid(target?.id)).map(target => ({
    id: target.id,
    name: typeof target.name === 'string' ? target.name.slice(0, 80) : 'Usuario',
    email: typeof target.email === 'string' ? target.email.slice(0, 160) : '',
    avatar_url: typeof target.avatar_url === 'string' ? target.avatar_url : ''
  }));
}

export async function listPendingGameInvitations(userId) {
  assertConfigured();
  const result = await supabase
    .from('game_invitations')
    .select('*')
    .eq('invitee_id', userId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  const invitations = unwrap(result, 'No se pudieron cargar las invitaciones.');
  return (Array.isArray(invitations) ? invitations : []).filter(item =>
    isUuid(item?.id) && isUuid(item?.room_id) && MULTIPLAYER_GAMES[item?.game_id]
  );
}

export async function createGameInvitation(gameId, inviteeId, initialState) {
  assertConfigured();
  if (!MULTIPLAYER_GAMES[gameId]) throw new Error('Juego no disponible para multijugador.');
  const result = await supabase.rpc('create_game_invitation', {
    p_game_id: gameId,
    p_invitee_id: inviteeId,
    p_initial_state: initialState || {}
  });
  const invitation = unwrap(result, 'No se pudo enviar la invitación.');
  if (!isUuid(invitation?.id) || !isUuid(invitation?.room_id)) throw new Error('La invitación devolvió datos no válidos.');
  return invitation;
}

export async function respondGameInvitation(invitationId, accept) {
  assertConfigured();
  const result = await supabase.rpc('respond_game_invitation', {
    p_invitation_id: invitationId,
    p_accept: Boolean(accept)
  });
  return validateRoom(unwrap(result, 'No se pudo responder a la invitación.'));
}

export async function getGameRoom(roomId) {
  assertConfigured();
  const result = await supabase.from('game_rooms').select('*').eq('id', roomId).maybeSingle();
  const room = unwrap(result, 'No se pudo cargar la sala.');
  return room ? validateRoom(room) : null;
}

export async function cancelGameRoom(roomId) {
  assertConfigured();
  const response = await supabase.rpc('cancel_game_room', { p_room_id: roomId });
  return validateRoom(unwrap(response, 'No se pudo cancelar la invitación.'));
}

export async function getGamePlayerState(roomId) {
  assertConfigured();
  const response = await supabase.rpc('get_game_player_state', { p_room_id: roomId });
  const state = unwrap(response, 'No se pudo cargar tu tablero privado.');
  if (!state || typeof state !== 'object') throw new Error('El tablero privado devolvió datos no válidos.');
  return state;
}

export async function submitBattleshipMove(roomId, row, col, expectedRevision) {
  assertConfigured();
  const response = await supabase.rpc('submit_battleship_move', {
    p_room_id: roomId,
    p_row: row,
    p_col: col,
    p_expected_revision: expectedRevision
  });
  const payload = unwrap(response, 'No se pudo guardar el disparo.');
  if (!payload?.room || typeof payload.was_hit !== 'boolean') throw new Error('El disparo devolvió datos no válidos.');
  return { room: validateRoom(payload.room), wasHit: payload.was_hit, sunk: Boolean(payload.sunk) };
}

export async function submitGameMove({ roomId, expectedRevision, state, turnUserId, status = 'active', winnerId = null, result = {} }) {
  assertConfigured();
  const response = await supabase.rpc('submit_game_move', {
    p_room_id: roomId,
    p_expected_revision: expectedRevision,
    p_state: state,
    p_turn_user_id: turnUserId,
    p_status: status,
    p_winner_id: winnerId,
    p_result: result
  });
  return validateRoom(unwrap(response, 'No se pudo guardar el movimiento.'));
}

/**
 * Modo carrera: envía el resultado del jugador (puntuación + tiempo). El
 * servidor arbitra: el primero en terminar cierra la carrera y, si el rival
 * también termina, compara los tiempos para decidir quién fue más rápido.
 */
export async function submitRaceResult({ roomId, expectedRevision, score, time, result = {} }) {
  assertConfigured();
  const response = await supabase.rpc('submit_race_result', {
    p_room_id: roomId,
    p_expected_revision: expectedRevision,
    p_score: score,
    p_time: time,
    p_result: result
  });
  return validateRoom(unwrap(response, 'No se pudo guardar tu resultado.'));
}

/** Modo reto: envía la puntuación del turno actual. El servidor valida y decide. */
export async function submitScoreMove({ roomId, expectedRevision, score, result = {}, higherWins = true }) {
  assertConfigured();
  const response = await supabase.rpc('submit_score_move', {
    p_room_id: roomId,
    p_expected_revision: expectedRevision,
    p_score: score,
    p_result: result,
    p_higher_wins: Boolean(higherWins)
  });
  return validateRoom(unwrap(response, 'No se pudo guardar tu puntuación.'));
}

/** Abandona una partida activa: la sala termina y gana el rival. */
export async function forfeitGameRoom(roomId) {
  assertConfigured();
  const response = await supabase.rpc('forfeit_game_room', { p_room_id: roomId });
  return validateRoom(unwrap(response, 'No se pudo abandonar la partida.'));
}

export async function requestGameRematch(roomId, initialState) {
  assertConfigured();
  const response = await supabase.rpc('request_game_rematch', {
    p_room_id: roomId,
    p_initial_state: initialState || {}
  });
  return validateRoom(unwrap(response, 'No se pudo solicitar la revancha.'));
}

export async function rejectGameRematch(roomId) {
  assertConfigured();
  const response = await supabase.rpc('reject_game_rematch', { p_room_id: roomId });
  return validateRoom(unwrap(response, 'No se pudo rechazar la revancha.'));
}

/**
 * Revanchas pendientes para el usuario (filas de game_rematch_requests
 * donde el OTRO jugador pidió repetir). Devuelve [{ id, room_id, game_id, requester_id }].
 */
export async function listPendingRematchRequests(userId) {
  assertConfigured();
  const result = await supabase
    .from('game_rematch_requests')
    .select('*')
    .neq('requester_id', userId)
    .order('created_at', { ascending: false });
  const rows = unwrap(result, 'No se pudieron cargar las peticiones de revancha.');
  return (Array.isArray(rows) ? rows : []).filter(item =>
    isUuid(item?.id) && isUuid(item?.room_id) && MULTIPLAYER_GAMES[item?.game_id]
  );
}

/** Notifica en tiempo real (y por polling) cuando llega/desaparece una petición de revancha. */
export function subscribeToRematchRequests(userId, onChange) {
  if (!db.isSupabaseConfigured() || !isUuid(userId)) return () => {};
  let active = true;
  let lastSignature = '';
  let refreshSequence = 0;
  const refresh = async () => {
    if (!active) return;
    const sequence = ++refreshSequence;
    try {
      const items = await listPendingRematchRequests(userId);
      if (!active || sequence !== refreshSequence) return;
      const signature = items.map(item => `${item.id}:${item.created_at}`).join('|');
      if (signature === lastSignature) return;
      lastSignature = signature;
      onChange(items);
    } catch (error) {
      console.warn('[games] No se pudieron refrescar revanchas:', error.message);
    }
  };
  const channel = supabase
    .channel(`rematch-requests-${userId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'game_rematch_requests'
    }, refresh)
    .subscribe();
  const pollTimer = setInterval(refresh, 10000);
  refresh();

  return () => {
    active = false;
    clearInterval(pollTimer);
    supabase.removeChannel(channel);
  };
}

/* ==========================================
   PROGRESO EN VIVO (broadcast efímero por sala)
   Mismo patrón que listenTogether: un canal broadcast por sala para
   intercambiar el progreso del rival (movimientos, tiempo, parejas…)
   SIN escribir en la BD. El resultado final sigue yendo por RPC.
   ========================================== */
const PROGRESS_CHANNEL_PREFIX = 'race-live-';
let progressChannel = null;
let progressRoomId = '';

/**
 * Entra en el canal de progreso de una sala. `onProgress` recibe el payload
 * del rival ({ sender, game, pairs, moves, seconds, ... }). Devuelve un
 * cleanup (llamar al salir de la sala).
 */
export function joinRaceProgress(roomId, onProgress) {
  if (!db.isSupabaseConfigured() || !isUuid(roomId)) return () => {};
  leaveRaceProgress();
  progressRoomId = roomId;
  try {
    progressChannel = supabase
      .channel(PROGRESS_CHANNEL_PREFIX + roomId)
      .on('broadcast', { event: 'progress' }, ({ payload }) => {
        if (payload && payload.room === roomId && typeof onProgress === 'function') {
          onProgress(payload);
        }
      })
      .subscribe();
  } catch (err) {
    console.warn('[games] Progreso en vivo no disponible:', err.message);
  }
  return leaveRaceProgress;
}

export function leaveRaceProgress() {
  if (progressChannel) {
    try { supabase.removeChannel(progressChannel); } catch { /* ya eliminado */ }
    progressChannel = null;
  }
  progressRoomId = '';
}

/**
 * Publica el progreso local al rival (throttle en el emisor).
 * `player` es el índice del emisor (0 = host, 1 = invitado); el receptor
 * lo usa para ignorar broadcasts propios (p.ej. otra pestaña del mismo
 * usuario) y quedarse solo con el progreso del rival.
 */
export function sendRaceProgress(progress = {}, player = null) {
  if (!progressChannel || !progressRoomId) return;
  try {
    progressChannel.send({
      type: 'broadcast',
      event: 'progress',
      payload: { room: progressRoomId, progress, player }
    });
  } catch (err) {
    console.warn('[games] No se pudo enviar progreso:', err.message);
  }
}

export function subscribeToGameRoom(roomId, onChange) {
  if (!db.isSupabaseConfigured() || !isUuid(roomId)) return () => {};
  let active = true;
  let lastSignature = '';
  let lastRevision = -1;
  let lastUpdatedAt = '';
  let refreshSequence = 0;
  const refresh = async () => {
    if (!active) return;
    const sequence = ++refreshSequence;
    try {
      const room = await getGameRoom(roomId);
      if (!active || sequence !== refreshSequence || !room) return;
      const updatedAt = typeof room.updated_at === 'string' ? room.updated_at : '';
      if (room.revision < lastRevision || (room.revision === lastRevision && updatedAt <= lastUpdatedAt)) return;
      const signature = `${room.revision}:${room.status}:${updatedAt}`;
      if (signature === lastSignature) return;
      lastRevision = room.revision;
      lastUpdatedAt = updatedAt;
      lastSignature = signature;
      onChange(room);
    } catch (error) {
      console.warn('[games] No se pudo refrescar la sala:', error.message);
    }
  };
  const channel = supabase
    .channel(`game-room-${roomId}`)
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomId}`
    }, refresh)
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[games] Realtime de sala no disponible. Se usará polling.');
      }
    });
  const pollTimer = setInterval(refresh, 10000);
  refresh();

  return () => {
    active = false;
    clearInterval(pollTimer);
    supabase.removeChannel(channel);
  };
}

export function subscribeToGameInvitations(userId, onChange) {
  if (!db.isSupabaseConfigured() || !isUuid(userId)) return () => {};
  let active = true;
  let lastSignature = '';
  let refreshSequence = 0;
  const refresh = async () => {
    if (!active) return;
    const sequence = ++refreshSequence;
    try {
      const items = await listPendingGameInvitations(userId);
      if (!active || sequence !== refreshSequence) return;
      const signature = items.map(item => `${item.id}:${item.status}:${item.updated_at}`).join('|');
      if (signature === lastSignature) return;
      lastSignature = signature;
      onChange(items);
    } catch (error) {
      console.warn('[games] No se pudieron refrescar invitaciones:', error.message);
    }
  };
  const channel = supabase
    .channel(`game-invitations-${userId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'game_invitations', filter: `invitee_id=eq.${userId}`
    }, refresh)
    .subscribe();
  const pollTimer = setInterval(refresh, 10000);
  refresh();

  return () => {
    active = false;
    clearInterval(pollTimer);
    supabase.removeChannel(channel);
  };
}
