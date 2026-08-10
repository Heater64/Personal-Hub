import { userStore } from '../stores/user.store.js';
import { showToast } from '../components/Toast.js';
import {
  MULTIPLAYER_GAMES,
  listGameInviteTargets,
  createGameInvitation,
  getGameRoom,
  getGamePlayerState,
  submitGameMove,
  submitBattleshipMove,
  requestGameRematch,
  cancelGameRoom,
  subscribeToGameRoom
} from '../services/games.service.js';

const SHIP_SIZES = [5, 4, 3, 3, 2];
const BOARD_SIZE = 10;

function emptyGrid(size = BOARD_SIZE) {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>\"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;'
  }[character]));
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
      // Separación de barcos para que la flota sea legible.
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

function initialState(gameId, hostId) {
  if (gameId === 'conecta4') {
    return { board: Array.from({ length: 6 }, () => Array(7).fill(0)), turn: hostId, winner: null, draw: false };
  }
  if (gameId === 'tresenraya') {
    return { board: Array(9).fill(0), turn: hostId, winner: null, draw: false };
  }
  const first = placeFleet();
  const second = placeFleet();
  return {
    boards: [first.board, second.board], ships: [first.ships, second.ships], shots: [emptyGrid(), emptyGrid()],
    shipsAlive: [SHIP_SIZES.length, SHIP_SIZES.length], turn: hostId, winner: null, draw: false
  };
}

function winningLine(board, size) {
  if (size === 3) {
    const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    return lines.find(([a, b, c]) => board[a] && board[a] === board[b] && board[a] === board[c]) || null;
  }
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < board.length; r++) for (let c = 0; c < board[r].length; c++) {
    const player = board[r][c];
    if (!player) continue;
    for (const [dr, dc] of dirs) {
      let count = 1;
      for (let step = 1; step < 4; step++) {
        const nr = r + dr * step, nc = c + dc * step;
        if (nr < 0 || nr >= board.length || nc < 0 || nc >= board[0].length || board[nr][nc] !== player) break;
        count++;
      }
      if (count >= 4) return true;
    }
  }
  return false;
}

function getGameResult(gameId, state, playerId, hostId, guestId) {
  const winnerIndex = state.winner;
  if (winnerIndex === null || winnerIndex === undefined) return state.draw ? 'draw' : null;
  const winnerId = winnerIndex === 0 ? hostId : guestId;
  return winnerId === playerId ? 'win' : 'lose';
}

function validGrid(grid, rows, columns, allowedValues) {
  return Array.isArray(grid) && grid.length === rows
    && grid.every(row => Array.isArray(row) && row.length === columns
      && row.every(value => allowedValues.includes(value)));
}

function validBattleshipPrivateState(state) {
  return !!state && typeof state === 'object'
    && validGrid(state.board, BOARD_SIZE, BOARD_SIZE, [0, 1])
    && validGrid(state.shots, BOARD_SIZE, BOARD_SIZE, [0, 1, 2])
    && Array.isArray(state.ships) && state.ships.length === SHIP_SIZES.length;
}

function validGameState(gameId, state) {
  if (!state || typeof state !== 'object') return false;
  if (gameId === 'conecta4') return validGrid(state.board, 6, 7, [0, 1, 2]);
  if (gameId === 'tresenraya') return Array.isArray(state.board) && state.board.length === 9 && state.board.every(value => [0, 1, 2].includes(value));
  return Array.isArray(state.shots) && state.shots.length === 2
    && state.shots.every(shots => validGrid(shots, BOARD_SIZE, BOARD_SIZE, [0, 1, 2]))
    && Array.isArray(state.shipsAlive) && state.shipsAlive.length === 2
    && state.shipsAlive.every(value => Number.isInteger(value) && value >= 0 && value <= SHIP_SIZES.length);
}

export function OnlineGamePage(router) {
  const page = document.createElement('div');
  page.className = 'online-page';

  const gameId = router.currentRoute?.params?.gameId;
  const query = router.currentRoute?.query || {};
  const roomId = query.room || '';
  const user = userStore.getUser();
  let room = null;
  let playerState = null;
  let targets = [];
  let selectedTarget = '';
  let targetName = '';
  let roomUnsubscribe = null;
  let expiryTimer = null;
  let disposed = false;
  let mode = roomId ? 'room' : 'lobby';

  if (!user || !MULTIPLAYER_GAMES[gameId]) {
    page.innerHTML = '<div class="online-shell glass-card"><p>Esta partida no está disponible.</p></div>';
    return page;
  }

  function gameInfo() { return MULTIPLAYER_GAMES[gameId]; }

  function shell(content) {
    page.innerHTML = `
      <section class="online-shell glass-card">
        <header class="online-header">
          <div><p class="online-kicker">🎮 Partida entre vosotros</p><h1 class="online-title"></h1><p class="online-subtitle">Sin IA · sincronizada en tiempo real</p></div>
          <button type="button" class="online-btn" data-action="back">← Juegos</button>
        </header>
        <div class="online-content"></div>
      </section>`;
    page.querySelector('.online-title').textContent = `${gameInfo().emoji} ${gameInfo().title}`;
    page.querySelector('.online-content').innerHTML = content;
    page.querySelector('[data-action="back"]').addEventListener('click', async () => {
      if (mode === 'room' && room?.status === 'waiting' && room.host_id === user.id) {
        try { await cancelGameRoom(room.id); } catch (error) { showToast(error.message, 'info'); }
      }
      router.navigate('/juegos');
    });
  }

  function renderError(message) {
    shell('<div class="online-panel"><p class="online-status"></p><div class="online-actions"><button class="online-btn online-btn--primary" data-action="retry">Reintentar</button></div></div>');
    page.querySelector('.online-status').textContent = message;
    page.querySelector('[data-action="retry"]').addEventListener('click', () => loadRoom());
  }

  async function loadTargets() {
    try { targets = await listGameInviteTargets(); }
    catch (error) { renderError(error.message); return false; }
    return true;
  }

  function renderLobby() {
    mode = 'lobby';
    const choices = targets.length
      ? targets.map(target => `<button type="button" class="online-choice" data-target="${escapeHtml(target.id)}"><span class="online-avatar"></span><span class="online-target-name"></span></button>`).join('')
      : '<p class="online-status">No hay otro usuario habilitado disponible.</p>';
    shell(`
      <div class="online-panel">
        <p>Elige a quién quieres invitar a una partida de <strong>${gameInfo().title}</strong>.</p>
        <div class="online-field"><label>Tu rival</label><div class="online-targets">${choices}</div></div>
        <div class="online-actions"><button type="button" class="online-btn online-btn--primary" data-action="invite" disabled>Enviar invitación</button></div>
      </div>`);
    const inviteButton = page.querySelector('[data-action="invite"]');
    page.querySelectorAll('[data-target]').forEach(button => {
      const target = targets.find(item => item.id === button.dataset.target);
      button.querySelector('.online-avatar').textContent = (target?.name || '?').charAt(0).toUpperCase();
      button.querySelector('.online-target-name').textContent = target?.name || 'Usuario';
      button.addEventListener('click', () => {
        selectedTarget = target.id;
        targetName = target.name || 'tu rival';
        page.querySelectorAll('[data-target]').forEach(item => item.classList.toggle('is-selected', item === button));
        inviteButton.disabled = false;
      });
      if (target.id === selectedTarget) button.classList.add('is-selected');
    });
    inviteButton.addEventListener('click', sendInvitation);
  }

  async function sendInvitation() {
    const button = page.querySelector('[data-action="invite"]');
    if (!selectedTarget) return;
    button.disabled = true;
    try {
      const created = await createGameInvitation(gameId, selectedTarget, initialState(gameId, user.id));
      showToast(`Invitación enviada a ${targetName}.`, 'success');
      router.navigate(`/juegos/online/${gameId}?room=${created.room_id}`);
    } catch (error) {
      button.disabled = false;
      showToast(error.message || 'No se pudo enviar la invitación.', 'error');
    }
  }

  function playerIndex() { return room.host_id === user.id ? 0 : 1; }
  function isMyTurn() { return room?.turn_user_id === user.id; }

  async function commit(state, status = 'active', winnerId = null, result = {}) {
    try {
      const saved = await submitGameMove({
        roomId: room.id, expectedRevision: room.revision, state,
        turnUserId: state.turn || room.turn_user_id, status, winnerId, result
      });
      room = saved;
      renderRoom();
    } catch (error) {
      showToast(error.message || 'El rival ha movido primero. Sincronizando…', 'info');
      try { room = await getGameRoom(room.id); renderRoom(); } catch (reloadError) { renderError(reloadError.message); }
    }
  }

  function renderResult() {
    const result = getGameResult(gameId, room.state, user.id, room.host_id, room.guest_id);
    const title = result === 'draw' ? '🤝 Empate' : result === 'win' ? '🎉 ¡Has ganado!' : '💛 Ha ganado tu rival';
    const waiting = room.host_id === user.id ? room.rematch_host : room.rematch_guest;
    shell(`
      <div class="online-result"><div class="online-kicker">Resultado</div><h2>${title}</h2><p>${waiting ? 'Esperando a que tu rival confirme la revancha…' : '¿Seguimos con otra partida?'}</p>
        <div class="online-actions"><button type="button" class="online-btn online-btn--primary" data-action="rematch" ${waiting ? 'disabled' : ''}>${waiting ? 'Revancha solicitada' : 'Revancha'}</button><button type="button" class="online-btn" data-action="change">Cambiar de juego</button></div>
      </div>`);
    page.querySelector('[data-action="rematch"]').addEventListener('click', async () => {
      const button = page.querySelector('[data-action="rematch"]');
      button.disabled = true;
      try {
        room = await requestGameRematch(room.id, initialState(gameId, room.host_id));
        if (gameId === 'battleship') playerState = await getGamePlayerState(room.id);
        renderRoom();
      }
      catch (error) { button.disabled = false; showToast(error.message, 'error'); }
    });
    page.querySelector('[data-action="change"]').addEventListener('click', async () => {
      selectedTarget = room.host_id === user.id ? room.guest_id : room.host_id;
      targetName = 'tu rival';
      if (await loadTargets()) renderLobby();
    });
  }

  function renderWaiting() {
    shell(`<div class="online-panel"><div class="online-status"><span class="online-status__dot"></span><span>Esperando a que ${escapeHtml(targetName || 'tu rival')} acepte la invitación…</span></div><p class="online-subtitle">Puedes seguir en esta pantalla. Te avisaremos en cuanto la sala esté lista.</p><div class="online-actions"><button type="button" class="online-btn" data-action="back">Cancelar y volver</button></div></div>`);
  }

  function renderRoom() {
    if (disposed || !room) return;
    if (room.status === 'waiting') { renderWaiting(); return; }
    if (room.status === 'finished') {
      if (!validGameState(gameId, room.state) || (gameId === 'battleship' && !validBattleshipPrivateState(playerState))) { renderError('La partida devolvió un estado no válido.'); return; }
      renderResult(); return;
    }
    if (room.status !== 'active') { renderError('Esta sala ya no está disponible.'); return; }
    if (!validGameState(gameId, room.state) || (gameId === 'battleship' && !validBattleshipPrivateState(playerState))) {
      renderError('La partida devolvió un estado no válido.'); return;
    }
    if (gameId === 'conecta4') renderConnect4();
    else if (gameId === 'tresenraya') renderTtt();
    else renderBattleship();
  }

  function submitFinished(state, winnerIndex, draw = false) {
    state.winner = draw ? null : winnerIndex;
    state.draw = draw;
    const winnerId = draw ? null : (winnerIndex === 0 ? room.host_id : room.guest_id);
    return commit(state, 'finished', winnerId, { draw, winnerIndex });
  }

  function renderConnect4() {
    const state = room.state;
    shell(`<div class="online-panel"><p class="online-turn"></p><div class="online-game__board online-game__board--connect4"></div><p class="online-subtitle">Pulsa una columna para soltar tu ficha.</p></div>`);
    page.querySelector('.online-turn').textContent = isMyTurn() ? 'Tu turno' : 'Turno de tu rival';
    const board = page.querySelector('.online-game__board');
    state.board.flat().forEach((value, index) => {
      const cell = document.createElement('button'); cell.className = 'online-game__cell'; cell.dataset.value = value; cell.setAttribute('aria-label', `Fila ${Math.floor(index / 7) + 1}, columna ${index % 7 + 1}`); cell.textContent = value ? (value === 1 ? '🔴' : '🟡') : '';
      cell.disabled = !isMyTurn() || Boolean(value);
      cell.addEventListener('click', () => {
        const col = index % 7; const next = clone(state); let row = 5;
        while (row >= 0 && next.board[row][col]) row--;
        if (row < 0) return;
        next.board[row][col] = playerIndex() + 1;
        next.turn = room.host_id === user.id ? room.guest_id : room.host_id;
        const won = winningLine(next.board, 7);
        const draw = !won && next.board.every(rowData => rowData.every(Boolean));
        if (won) submitFinished(next, playerIndex()); else if (draw) submitFinished(next, null, true); else commit(next);
      });
      board.appendChild(cell);
    });
  }

  function renderTtt() {
    const state = room.state;
    shell(`<div class="online-panel"><p class="online-turn"></p><div class="online-game__board online-game__board--ttt"></div><p class="online-subtitle">X juega primero. Cada jugador ve el mismo tablero.</p></div>`);
    page.querySelector('.online-turn').textContent = isMyTurn() ? 'Tu turno' : 'Turno de tu rival';
    const board = page.querySelector('.online-game__board');
    state.board.forEach((value, index) => {
      const cell = document.createElement('button'); cell.className = 'online-game__cell'; cell.dataset.value = value === 1 ? 'X' : value === 2 ? 'O' : ''; cell.textContent = cell.dataset.value; cell.disabled = !isMyTurn() || Boolean(value); cell.setAttribute('aria-label', `Casilla ${index + 1}`);
      cell.addEventListener('click', () => {
        const next = clone(state); next.board[index] = playerIndex() + 1; next.turn = room.host_id === user.id ? room.guest_id : room.host_id;
        const won = winningLine(next.board, 3); const draw = !won && next.board.every(Boolean);
        if (won) submitFinished(next, playerIndex()); else if (draw) submitFinished(next, null, true); else commit(next);
      });
      board.appendChild(cell);
    });
  }

  function renderBattleship() {
    const state = room.state; const me = playerIndex(); const enemy = me === 0 ? 1 : 0;
    shell(`<div class="online-panel"><p class="online-turn"></p><div class="online-fleet-wrap"><div><p class="online-fleet-title">Tus barcos</p><div class="online-fleet" data-fleet="own"></div></div><div><p class="online-fleet-title">Disparos al rival</p><div class="online-fleet" data-fleet="enemy"></div></div></div><p class="online-subtitle">Un acierto conserva el turno; un fallo lo pasa al rival.</p></div>`);
    page.querySelector('.online-turn').textContent = isMyTurn() ? 'Tu turno' : 'Turno de tu rival';
    renderFleet(page.querySelector('[data-fleet="own"]'), playerState.board, state.shots[enemy], false);
    renderFleet(page.querySelector('[data-fleet="enemy"]'), emptyGrid(), state.shots[me], true);
  }

  function renderFleet(container, board, shots, canShoot) {
    for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = document.createElement('button'); const shot = shots[r][c];
      cell.className = 'online-game__cell'; cell.textContent = shot === 2 ? '✹' : shot === 1 ? '·' : '';
      if (!canShoot && board[r][c]) cell.classList.add('is-ship');
      if (shot === 2) cell.classList.add('is-shot'); else if (shot === 1) cell.classList.add('is-miss');
      cell.disabled = !canShoot || !isMyTurn() || Boolean(shot);
      cell.setAttribute('aria-label', `${String.fromCharCode(65 + r)}${c + 1}`);
      cell.addEventListener('click', async () => {
        if (!canShoot || !isMyTurn()) return;
        try {
          const result = await submitBattleshipMove(room.id, r, c, room.revision);
          room = result.room;
          playerState = await getGamePlayerState(room.id);
          renderRoom();
        } catch (error) {
          showToast(error.message || 'El rival ha movido primero. Sincronizando…', 'info');
          try {
            room = await getGameRoom(room.id);
            playerState = await getGamePlayerState(room.id);
            renderRoom();
          } catch (reloadError) { renderError(reloadError.message); }
        }
      });
      container.appendChild(cell);
    }
  }

  async function loadRoom() {
    if (!roomId) {
      if (await loadTargets()) renderLobby();
      return;
    }
    try {
      if (roomUnsubscribe) { roomUnsubscribe(); roomUnsubscribe = null; }
      room = await getGameRoom(roomId);
      if (!room || (room.host_id !== user.id && room.guest_id !== user.id)) throw new Error('No tienes acceso a esta sala.');
      if (room.game_id !== gameId) throw new Error('El juego de esta sala no coincide.');
      if (gameId === 'battleship') playerState = await getGamePlayerState(room.id);
      if (room.status === 'waiting') {
        targetName = room.host_id === user.id ? 'tu rival' : 'el anfitrión';
        clearTimeout(expiryTimer);
        const expiresIn = new Date(room.expires_at).getTime() - Date.now();
        if (Number.isFinite(expiresIn) && expiresIn > 0) {
          expiryTimer = setTimeout(() => {
            if (!disposed && room?.status === 'waiting') renderError('La invitación ha caducado.');
          }, expiresIn + 1000);
        }
      }
      renderRoom();
      roomUnsubscribe = subscribeToGameRoom(room.id, async (updated) => {
        room = updated;
        if (gameId === 'battleship' && updated.status === 'active') {
          try { playerState = await getGamePlayerState(updated.id); }
          catch (error) { if (!disposed) { renderError(error.message); return; } }
        }
        if (!disposed) renderRoom();
      });
    } catch (error) { renderError(error.message || 'No se pudo cargar la sala.'); }
  }

  loadRoom();

  page.cleanup = () => {
    disposed = true;
    clearTimeout(expiryTimer);
    if (roomUnsubscribe) roomUnsubscribe();
  };
  return page;
}
