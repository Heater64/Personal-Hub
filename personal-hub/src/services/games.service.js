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
  conecta4: { title: 'Conecta 4', emoji: '🔴', href: '/games/conecta4.html' },
  tresenraya: { title: 'Tres en Raya', emoji: '❌', href: '/games/tresenraya.html' },
  battleship: { title: 'Hundir la Flota', emoji: '🚢', href: '/games/battleship.html' }
};

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

export async function requestGameRematch(roomId, initialState) {
  assertConfigured();
  const response = await supabase.rpc('request_game_rematch', {
    p_room_id: roomId,
    p_initial_state: initialState || {}
  });
  return validateRoom(unwrap(response, 'No se pudo solicitar la revancha.'));
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
