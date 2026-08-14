import { userStore } from '../stores/user.store.js';
import { showToast } from '../components/Toast.js';
import {
  MULTIPLAYER_GAMES,
  ONLINE_GAMES_ENABLED,
  SCORE_GAME_IDS,
  RACE_GAME_IDS,
  LOWER_SCORE_WINS,
  createGameInitialState,
  listGameInviteTargets,
  createGameInvitation,
  getGameRoom,
  getGamePlayerState,
  submitGameMove,
  submitBattleshipMove,
  submitScoreMove,
  submitRaceResult,
  forfeitGameRoom,
  requestGameRematch,
  rejectGameRematch,
  cancelGameRoom,
  subscribeToGameRoom,
  joinRaceProgress,
  leaveRaceProgress,
  sendRaceProgress,
  SHIP_SIZES,
  BOARD_SIZE
} from '../services/games.service.js';
import { gameCover } from '../utils/gameCovers.js';

/** Instrucciones cortas por juego para el modo reto. */
const SCORE_INSTRUCTIONS = {
  '2048': 'Desliza las baldosas y suma hasta llegar lo más lejos posible.',
  'agujero-negro': 'Esquiva la atracción y aguanta todo lo que puedas.',
  'ahorcado': 'Adivina la palabra con el mayor número de aciertos.',
  'breakout': 'Rompe todos los ladrillos. Más puntos, mejor.',
  'buscaminas': 'Descubre el máximo de casillas sin pisar una mina.',
  'cuchillos': 'Lanza cuchillos con precisión. Cada acierto suma.',
  'invaders': 'Dispara a las oleadas y consigue la mayor puntuación.',
  'laberinto': 'Llega al nivel más alto del laberinto.',
  'memoria': 'Encuentra todas las parejas en el menor número de movimientos.',
  'meteoritos': 'Sobrevive esquivando meteoritos y suma puntos.',
  'pong': 'Juega contra la CPU. Tu marcador es el que cuenta.',
  'simon': 'Repite la secuencia hasta la ronda más alta.',
  'snake': 'Come y crece sin chocar. Más longitud, más puntos.',
  'tetris': 'Completa líneas y consigue la mejor puntuación.',
  'tiroarco': 'Encesta y gana puntos. La precisión lo es todo.',
  'torre': 'Construye la torre más alta y suma puntos.'
};

/** Instrucciones cortas por juego para el modo carrera (quien termina antes gana). */
const RACE_INSTRUCTIONS = {
  'memoria': 'Encuentra todas las parejas lo antes posible. El reloj corre desde tu primera jugada.'
};

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

/**
 * Traduce errores técnicos de Supabase a mensajes que la princesa entienda.
 * Los errores de sesión/token (401, JWT inválido, API key) son incomprensibles
 * crudos ("No suitable key or wrong key type") — aquí se convierten en algo útil.
 */
function friendlyError(error) {
  const raw = String(error?.message || error || '');
  const lower = raw.toLowerCase();
  if (/no suitable key|wrong key type|invalid api key|invalid jwt|jwt expired|jwt malformed|401/i.test(lower)) {
    return 'No se pudo conectar con tu sesión. Cierra sesión y entra de nuevo para jugar online.';
  }
  if (/row-level security|violates row-level|permission denied|not authorized|forbidden/i.test(lower)) {
    return 'No tienes permiso para esa acción.';
  }
  if (/network|fetch failed|failed to fetch|load failed|timed? ?out/i.test(lower)) {
    return 'Sin conexión. Comprueba internet y vuelve a intentarlo.';
  }
  return raw;
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
  if (RACE_GAME_IDS.has(gameId)) {
    return Array.isArray(state.scores) && state.scores.length === 2
      && state.scores.every(score => score === null || (Number.isInteger(score) && score >= 0))
      && Array.isArray(state.times) && state.times.length === 2
      && state.times.every(time => time === null || (Number.isInteger(time) && time >= 0));
  }
  if (SCORE_GAME_IDS.has(gameId)) {
    return Array.isArray(state.scores) && state.scores.length === 2
      && state.scores.every(score => score === null || (Number.isInteger(score) && score >= 0));
  }
  return Array.isArray(state.shots) && state.shots.length === 2
    && state.shots.every(shots => validGrid(shots, BOARD_SIZE, BOARD_SIZE, [0, 1, 2]))
    && Array.isArray(state.shipsAlive) && state.shipsAlive.length === 2
    && state.shipsAlive.every(value => Number.isInteger(value) && value >= 0 && value <= SHIP_SIZES.length);
}

export function OnlineGamePage(router) {
  const page = document.createElement('div');
  page.className = 'online-page';

  let gameId = router.currentRoute?.params?.gameId;
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
  let scoreFrame = null;
  let scoreMessageHandler = null;
  let progressMessageHandler = null;
  let myProgress = null;
  let rivalProgress = null;
  let raceJoined = false;
  let raceLeaveProgress = null;

  // Modo online oculto temporalmente: no se entra ni por URL directa.
  if (!ONLINE_GAMES_ENABLED) {
    page.innerHTML = `
      <div class="online-shell glass-card">
        <div class="online-panel online-waiting">
          <div class="online-waiting__visual" aria-hidden="true"><span class="online-waiting__spinner"></span><span class="online-waiting__badge">🎮</span></div>
          <div class="online-waiting__content">
            <div class="online-status"><span class="online-status__dot"></span><span>El modo online estará disponible pronto</span></div>
            <p class="online-subtitle">Estamos puliendo la experiencia multijugador. Vuelve en unos días. 💛</p>
          </div>
          <div class="online-actions"><button type="button" class="online-btn online-btn--primary" data-action="back">← Volver a Juegos</button></div>
        </div>
      </div>`;
    page.querySelector('[data-action="back"]').addEventListener('click', () => router.navigate('/juegos'));
    return page;
  }

  if (!user || !MULTIPLAYER_GAMES[gameId]) {
    page.innerHTML = '<div class="online-shell glass-card"><p>Esta partida no está disponible.</p></div>';
    return page;
  }

  function gameInfo() { return MULTIPLAYER_GAMES[gameId]; }
  function scoreMode() { return SCORE_GAME_IDS.has(gameId); }
  function raceMode() { return RACE_GAME_IDS.has(gameId); }

  function coverSrc() {
    const game = gameInfo();
    return gameCover(gameId, game.color, game.accent);
  }

  /** Modal de confirmación al salir en mitad de una partida activa. */
  function confirmExit() {
    const overlay = document.createElement('div');
    overlay.className = 'online-exit-overlay';
    overlay.setAttribute('role', 'presentation');
    overlay.innerHTML = `
      <div class="online-exit-card" role="dialog" aria-modal="true" aria-label="¿Salir de la partida?">
        <h2>¿Seguro que quieres salir?</h2>
        <p>Si sales ahora abandonarás la partida y <strong>tu rival ganará automáticamente</strong>.</p>
        <div class="online-actions online-exit-card__actions">
          <button type="button" class="online-btn" data-exit="cancel">Seguir jugando</button>
          <button type="button" class="online-btn online-btn--primary" data-exit="confirm">Sí, salir</button>
        </div>
      </div>`;
    overlay.querySelector('[data-exit="cancel"]').addEventListener('click', () => overlay.remove());
    overlay.querySelector('[data-exit="confirm"]').addEventListener('click', async () => {
      const confirmButton = overlay.querySelector('[data-exit="confirm"]');
      confirmButton.disabled = true;
      try { await forfeitGameRoom(room.id); }
      catch (error) { showToast(friendlyError(error.message), 'info'); }
      overlay.remove();
      router.navigate('/juegos');
    });
    page.appendChild(overlay);
    const focusTarget = overlay.querySelector('[data-exit="cancel"]');
    if (focusTarget) focusTarget.focus();
  }

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
        try { await cancelGameRoom(room.id); } catch (error) { showToast(friendlyError(error.message), 'info'); }
        router.navigate('/juegos');
        return;
      }
      if (mode === 'room' && room?.status === 'active') {
        confirmExit();
        return;
      }
      router.navigate('/juegos');
    });
  }

  function renderError(message) {
    shell('<div class="online-panel"><p class="online-status"></p><div class="online-actions"><button class="online-btn online-btn--primary" data-action="retry">Reintentar</button></div></div>');
    page.querySelector('.online-status').textContent = friendlyError(message);
    page.querySelector('[data-action="retry"]').addEventListener('click', () => loadRoom());
  }

  async function loadTargets() {
    try { targets = await listGameInviteTargets(); }
    catch (error) { renderError(error.message); return false; }
    return true;
  }

  function renderLobby() {
    mode = 'lobby';
    const gameChoices = Object.entries(MULTIPLAYER_GAMES).map(([id, game]) =>
      `<button type="button" class="online-game-chip${id === gameId ? ' is-selected' : ''}" data-game="${id}">
        <img class="online-game-chip__cover" src="${gameCover(id, game.color, game.accent)}" alt="" loading="lazy">
        <span>${game.title}</span>
      </button>`
    ).join('');
    const choices = targets.length
      ? targets.map(target => `<button type="button" class="online-choice" data-target="${escapeHtml(target.id)}"><span class="online-avatar"></span><span class="online-target-name"></span></button>`).join('')
      : '<p class="online-status">No hay otro usuario habilitado disponible.</p>';
    shell(`
      <div class="online-panel">
        <p>Elige el juego y a quién quieres invitar.</p>
        <div class="online-field"><label>Juego</label><div class="online-game-chips">${gameChoices}</div></div>
        <div class="online-field"><label>Tu rival</label><div class="online-targets">${choices}</div></div>
        <div class="online-actions"><button type="button" class="online-btn online-btn--primary" data-action="invite" disabled>Enviar invitación</button></div>
      </div>`);
    const inviteButton = page.querySelector('[data-action="invite"]');
    page.querySelectorAll('[data-game]').forEach(button => {
      button.addEventListener('click', () => {
        gameId = button.dataset.game;
        page.querySelectorAll('[data-game]').forEach(item => item.classList.toggle('is-selected', item === button));
        page.querySelector('.online-title').textContent = `${gameInfo().emoji} ${gameInfo().title}`;
      });
    });
    page.querySelectorAll('[data-target]').forEach(button => {
      const target = targets.find(item => item.id === button.dataset.target);
      const avatarEl = button.querySelector('.online-avatar');
      avatarEl.textContent = '';
      if (target?.avatar_url) {
        const img = document.createElement('img');
        img.className = 'online-avatar-img';
        img.src = target.avatar_url;
        img.alt = '';
        img.onerror = () => { img.remove(); avatarEl.textContent = (target?.name || '?').charAt(0).toUpperCase(); };
        avatarEl.appendChild(img);
      } else {
        avatarEl.textContent = (target?.name || '?').charAt(0).toUpperCase();
      }
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
      const created = await createGameInvitation(gameId, selectedTarget, createGameInitialState(gameId, user.id));
      showToast(`Invitación enviada a ${targetName}.`, 'success');
      router.navigate(`/juegos/online/${gameId}?room=${created.room_id}`);
    } catch (error) {
      button.disabled = false;
      showToast(friendlyError(error.message) || 'No se pudo enviar la invitación.', 'error');
    }
  }

  function playerIndex() { return room.host_id === user.id ? 0 : 1; }
  function isMyTurn() { return room?.turn_user_id === user.id; }

  function scoreOf(index) {
    const scores = room?.state?.scores;
    return Array.isArray(scores) && typeof scores[index] === 'number' ? scores[index] : null;
  }

  /** Modo carrera: tiempo en segundos del jugador (null = aún sin terminar). */
  function timeOf(index) {
    const times = room?.state?.times;
    return Array.isArray(times) && typeof times[index] === 'number' ? times[index] : null;
  }

  async function commit(state, status = 'active', winnerId = null, result = {}) {
    try {
      const saved = await submitGameMove({
        roomId: room.id, expectedRevision: room.revision, state,
        turnUserId: state.turn || room.turn_user_id, status, winnerId, result
      });
      room = saved;
      renderRoom();
    } catch (error) {
      showToast(friendlyError(error.message) || 'El rival ha movido primero. Sincronizando…', 'info');
      try { room = await getGameRoom(room.id); renderRoom(); } catch (reloadError) { renderError(reloadError.message); }
    }
  }

  /** Modo reto: envía la puntuación del turno actual. */
  async function submitScore(score) {
    if (disposed || !room) return;
    try {
      room = await submitScoreMove({
        roomId: room.id,
        expectedRevision: room.revision,
        score,
        result: { score },
        higherWins: !LOWER_SCORE_WINS.has(gameId)
      });
      showToast('Puntuación enviada ✓', 'success');
      renderRoom();
    } catch (error) {
      showToast(friendlyError(error.message) || 'El rival ha terminado antes. Sincronizando…', 'info');
      try {
        room = await getGameRoom(room.id);
        renderRoom();
      } catch (reloadError) { renderError(reloadError.message); }
    }
  }

  /** Modo carrera: envía el resultado (puntuación + tiempo) al terminar. */
  async function submitRace(score, time) {
    if (disposed || !room) return;
    try {
      room = await submitRaceResult({
        roomId: room.id,
        expectedRevision: room.revision,
        score,
        time,
        result: { score, time }
      });
      renderRoom();
    } catch (error) {
      showToast(friendlyError(error.message) || 'Tu rival ha terminado antes. Sincronizando…', 'info');
      try {
        room = await getGameRoom(room.id);
        // Si la carrera ya terminó por el envío del rival pero mi resultado
        // aún no consta (los dos terminaron casi a la vez), reintento con la
        // revisión nueva para que la pantalla compare los dos tiempos.
        const recorded = scoreOf(playerIndex()) !== null;
        if (!recorded && room?.status === 'finished' && room?.result?.race === true) {
          try {
            room = await submitRaceResult({
              roomId: room.id,
              expectedRevision: room.revision,
              score,
              time,
              result: { score, time }
            });
          } catch (retryError) {
            showToast(friendlyError(retryError.message) || 'No se pudo guardar tu resultado.', 'error');
          }
        }
        renderRoom();
      } catch (reloadError) { renderError(reloadError.message); }
    }
  }

  /** Modo reto: pantalla de juego (iframe del juego individual). */
  function renderScorePlay() {
    const me = playerIndex();
    const rival = me === 0 ? 1 : 0;
    const myScore = scoreOf(me);
    const rivalScore = scoreOf(rival);
    const game = gameInfo();
    const src = `${game.href}?accent=${game.color.replace('#', '')}&online=1&game=${encodeURIComponent(gameId)}`;
    shell(`
      <div class="online-panel online-score">
        <div class="online-score__head">
          <div class="online-score__cover"><img src="${coverSrc()}" alt="Portada de ${escapeHtml(game.title)}"></div>
          <div>
            <p class="online-turn">Tu turno · consigue la mejor puntuación</p>
            <p class="online-subtitle">${escapeHtml(SCORE_INSTRUCTIONS[gameId] || 'Juega tu ronda. La puntuación se envía sola al terminar.')}</p>
            <div class="online-score-mini">
              <div class="online-score-mini__row"><span>Tú</span><strong>${myScore ?? '—'}</strong></div>
              <div class="online-score-mini__row"><span>Rival</span><strong>${rivalScore ?? 'pendiente'}</strong></div>
            </div>
          </div>
        </div>
        <div class="online-score__frame-wrap">
          <iframe class="online-score__frame" title="${escapeHtml(game.title)}" src="${escapeHtml(src)}" allow="autoplay; fullscreen"></iframe>
        </div>
        <p class="online-score__hint">Cuando tu ronda termine, la puntuación se enviará automáticamente.</p>
      </div>`);
    scoreFrame = page.querySelector('.online-score__frame');
    if (!scoreMessageHandler) {
      scoreMessageHandler = (event) => {
        if (!scoreFrame || event.source !== scoreFrame.contentWindow) return;
        const data = event.data;
        if (!data || data.type !== 'ph-score' || data.game !== gameId) return;
        if (typeof data.score !== 'number') {
          showToast('No se pudo leer tu puntuación. Juega la ronda de nuevo.', 'error');
          return;
        }
        submitScore(data.score);
      };
      window.addEventListener('message', scoreMessageHandler);
    }
  }

  /* ==========================================================
     MODO CARRERA — HUD de duelo en vivo
     Los dos juegan a la vez. El iframe emite su progreso
     (ph-progress) ~1×/s; lo reenviamos al rival por broadcast y
     actualizamos las tarjetas SIN reconstruir el iframe (si no,
     la partida se reiniciaría en cada tick).
     ========================================================== */
  function duelCard(side, name, avatarUrl) {
    const initial = escapeHtml((name || (side === 'me' ? 'Tú' : 'Rival')).charAt(0).toUpperCase());
    const avatar = avatarUrl
      ? `<img src="${escapeHtml(avatarUrl)}" alt="" data-avatar-img>`
      : initial;
    return `
      <div class="duel-player duel-player--${side}" data-player="${side}">
        <div class="duel-player__top">
          <span class="duel-player__avatar">${avatar}</span>
          <div class="duel-player__id">
            <span class="duel-player__name">${escapeHtml(name)}</span>
            <span class="duel-player__state" data-state>Calentando…</span>
          </div>
        </div>
        <div class="duel-player__metrics">
          <div class="duel-player__metric"><span>Parejas</span><strong data-metric="pairs">—</strong></div>
          <div class="duel-player__metric"><span>Movimientos</span><strong data-metric="moves">—</strong></div>
          <div class="duel-player__metric"><span>Tiempo</span><strong data-metric="time">—</strong></div>
        </div>
        <div class="duel-player__track"><span class="duel-player__bar" data-bar style="width:0%"></span></div>
      </div>`;
  }

  /** Actualiza una tarjeta del HUD sin tocar el iframe (progreso en vivo). */
  function updateDuelPlayer(side, progress) {
    const card = page.querySelector(`.duel-player[data-player="${side}"]`);
    if (!card) return;
    const started = !!(progress && (progress.pairs > 0 || progress.moves > 0));
    const stateEl = card.querySelector('[data-state]');
    if (stateEl) stateEl.textContent = started ? 'Jugando…' : 'Calentando…';
    const pairs = progress?.pairs ?? 0;
    const total = progress?.totalPairs ?? 0;
    const pairsEl = card.querySelector('[data-metric="pairs"]');
    if (pairsEl) pairsEl.textContent = total > 0 ? `${pairs}/${total}` : '—';
    const movesEl = card.querySelector('[data-metric="moves"]');
    if (movesEl) movesEl.textContent = progress?.moves != null ? String(progress.moves) : '—';
    const timeEl = card.querySelector('[data-metric="time"]');
    if (timeEl) timeEl.textContent = progress?.seconds != null ? `${progress.seconds}s` : '—';
    const bar = card.querySelector('[data-bar]');
    if (bar) bar.style.width = `${total > 0 ? Math.min(100, Math.round((pairs / total) * 100)) : 0}%`;
  }

  function leaveRace() {
    raceJoined = false;
    if (raceLeaveProgress) { try { raceLeaveProgress(); } catch { /* canal ya cerrado */ } raceLeaveProgress = null; }
    myProgress = null;
    rivalProgress = null;
  }

  function ensureRaceJoined() {
    if (raceJoined || !room || !raceMode()) return;
    raceJoined = true;
    raceLeaveProgress = joinRaceProgress(room.id, (payload) => {
      if (disposed || !room || room.status !== 'active') return;
      // Ignora broadcasts propios (p.ej. otra pestaña del mismo usuario):
      // solo nos interesa el progreso del rival.
      if (payload && payload.player === playerIndex()) return;
      const progress = payload && payload.progress;
      if (progress && typeof progress === 'object') {
        rivalProgress = progress;
        updateDuelPlayer('rival', rivalProgress);
      }
    });
  }

  /**
   * Modo carrera: los DOS jugadores ven esta pantalla a la vez. Cada uno
   * juega su propia partida en el iframe; el primero en terminar envía su
   * tiempo y la carrera se cierra para ambos.
   */
  function renderRacePlay() {
    const game = gameInfo();
    const src = `${game.href}?accent=${game.color.replace('#', '')}&online=1&game=${encodeURIComponent(gameId)}&race=1`;
    const myName = user.name || 'Tú';
    shell(`
      <div class="online-panel duel">
        <p class="duel-state">⚡ ¡Carrera! El primero en terminar gana</p>
        <div class="duel-players">
          ${duelCard('me', myName, user.avatar || '')}
          <div class="duel-vs">VS</div>
          ${duelCard('rival', 'Rival', '')}
        </div>
        <div class="duel-board">
          <iframe class="duel-board__frame" title="${escapeHtml(game.title)}" src="${escapeHtml(src)}" allow="autoplay; fullscreen"></iframe>
        </div>
        <p class="online-score__hint">${escapeHtml(RACE_INSTRUCTIONS[gameId] || 'El reloj corre desde tu primera jugada. Cuando termines, tu tiempo se envía automáticamente.')}</p>
      </div>`);
    // Avatar propio con fallback a la inicial si la carga falla.
    const meAvatar = page.querySelector('.duel-player[data-player="me"] .duel-player__avatar');
    if (meAvatar && user.avatar) {
      const img = meAvatar.querySelector('img');
      if (img) img.onerror = () => { img.remove(); meAvatar.textContent = myName.charAt(0).toUpperCase(); };
    }
    scoreFrame = page.querySelector('.duel-board__frame');
    myProgress = null;
    rivalProgress = null;
    ensureRaceJoined();
    if (!scoreMessageHandler) {
      scoreMessageHandler = (event) => {
        if (!scoreFrame || event.source !== scoreFrame.contentWindow) return;
        const data = event.data;
        if (!data || data.type !== 'ph-race' || data.game !== gameId) return;
        if (typeof data.score !== 'number' || typeof data.time !== 'number') {
          showToast('No se pudo leer tu resultado. Juega la ronda de nuevo.', 'error');
          return;
        }
        submitRace(data.score, data.time);
      };
      window.addEventListener('message', scoreMessageHandler);
    }
    if (!progressMessageHandler) {
      progressMessageHandler = (event) => {
        if (!scoreFrame || event.source !== scoreFrame.contentWindow) return;
        const data = event.data;
        if (!data || data.type !== 'ph-progress' || data.game !== gameId) return;
        if (!data.progress || typeof data.progress !== 'object') return;
        myProgress = data.progress;
        updateDuelPlayer('me', myProgress);
        sendRaceProgress(data.progress, playerIndex());
      };
      window.addEventListener('message', progressMessageHandler);
    }
  }

  /** Modo reto: esperar mientras el rival juega su turno. */
  function renderScoreWaiting() {
    const me = playerIndex();
    const rival = me === 0 ? 1 : 0;
    const myScore = scoreOf(me);
    const rivalScore = scoreOf(rival);
    shell(`
      <div class="online-panel online-waiting">
        <div class="online-waiting__visual" aria-hidden="true">
          <span class="online-waiting__spinner"></span>
          <span class="online-waiting__badge"><img class="online-waiting__cover" src="${coverSrc()}" alt=""></span>
        </div>
        <div class="online-waiting__content">
          <div class="online-status"><span class="online-status__dot"></span><span>Tu rival está jugando su turno…</span></div>
          <p class="online-subtitle">Cuando termine verás el resultado. Quédate en esta pantalla.</p>
          <div class="online-score-mini">
            <div class="online-score-mini__row"><span>Tú</span><strong>${myScore ?? '—'}</strong></div>
            <div class="online-score-mini__row"><span>Rival</span><strong>${rivalScore ?? 'jugando…'}</strong></div>
          </div>
        </div>
      </div>`);
  }

  function renderResult() {
    const forfeited = room.result?.forfeit === true;
    let title;
    let outcome;
    if (forfeited) {
      const loserIsMe = String(room.result.loser_id || '') === String(user.id);
      title = loserIsMe ? 'Has abandonado la partida' : 'Tu rival abandonó la partida';
      outcome = loserIsMe ? 'loss' : 'win';
    } else {
      const result = getGameResult(gameId, room.state, user.id, room.host_id, room.guest_id);
      outcome = result === 'draw' ? 'draw' : result === 'win' ? 'win' : 'loss';
      title = result === 'draw' ? 'Empate' : result === 'win' ? '¡Has ganado!' : 'Ha ganado tu rival';
      if (raceMode()) {
        title = result === 'draw' ? 'Empate' : result === 'win' ? '¡Has sido el más rápido!' : 'Tu rival fue más rápido';
      }
    }
    const emblems = {
      win: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
      loss: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
      draw: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M10 9l-2 3 2 3"/><path d="M14 9l2 3-2 3"/></svg>'
    };
    const iRequested = room.host_id === user.id ? room.rematch_host : room.rematch_guest;
    const rivalRequested = room.host_id === user.id ? room.rematch_guest : room.rematch_host;
    const statusText = forfeited
      ? 'Puedes buscar otra partida cuando quieras.'
      : iRequested
        ? 'Esperando a que tu rival confirme la revancha…'
        : rivalRequested
          ? 'Tu rival quiere la revancha. ¿Jugamos otra?'
          : '¿Seguimos con otra partida?';
    const requestBtn = iRequested
      ? `<button type="button" class="online-btn" data-action="cancel-rematch">Cancelar petición</button>`
      : `<button type="button" class="online-btn online-btn--primary" data-action="rematch">Revancha</button>`;
    const rivalActions = rivalRequested
      ? `<button type="button" class="online-btn" data-action="reject-rematch">Rechazar</button>`
      : '';
    const scoreBoard = scoreMode() && !raceMode() && !forfeited
      ? (() => {
          const mine = playerIndex(), rivalIndex = mine === 0 ? 1 : 0;
          const myScore = scoreOf(mine), rivalScore = scoreOf(rivalIndex);
          const label = LOWER_SCORE_WINS.has(gameId) ? 'movimientos' : 'puntos';
          const note = LOWER_SCORE_WINS.has(gameId) ? '<p class="online-score-board__note">Menos movimientos gana</p>' : '';
          return `
          <div class="online-score-board">
            <div class="online-score-board__row"><span>Tú</span><strong>${myScore ?? '—'} ${label}</strong></div>
            <div class="online-score-board__row"><span>Rival</span><strong>${rivalScore ?? '—'} ${label}</strong></div>
            ${note}
          </div>`;
        })()
      : '';
    const raceBoard = raceMode() && !forfeited
      ? (() => {
          const mine = playerIndex(), rivalIndex = mine === 0 ? 1 : 0;
          const rows = [
            { label: 'Tú', time: timeOf(mine), score: scoreOf(mine) },
            { label: 'Rival', time: timeOf(rivalIndex), score: scoreOf(rivalIndex) }
          ].sort((a, b) =>
            (a.time === null ? 1 : 0) - (b.time === null ? 1 : 0)
            || (a.time ?? Infinity) - (b.time ?? Infinity)
          );
          const medals = ['🥇', '🥈'];
          const bothFinished = rows.every(row => row.time !== null);
          return `
          <div class="podium">
            ${rows.map((row, i) => `
              <div class="podium__row${i === 0 ? ' podium__row--winner' : ''}">
                <span class="podium__medal">${medals[i]}</span>
                <div class="podium__who">
                  <strong>${row.label}</strong>
                  <span>${row.time === null ? 'no terminó' : `${row.score ?? '—'} movimientos`}</span>
                </div>
                <div class="podium__stats">
                  <strong>${row.time === null ? '—' : `${row.time}s`}</strong>
                  <span>${row.time === null ? '' : 'tiempo'}</span>
                </div>
              </div>`).join('')}
          </div>
          <p class="podium__note">${bothFinished ? 'El que consiguió el mejor tiempo gana' : 'El primero en terminar gana la carrera'}</p>`;
        })()
      : '';
    shell(`
      <div class="online-result online-result--${outcome}">
        <div class="online-result__emblem">${emblems[outcome]}</div>
        <div class="online-kicker">${raceMode() && !forfeited ? 'Resultado de la carrera' : 'Resultado'}</div>
        <h2>${title}</h2>
        ${scoreBoard}
        ${raceBoard}
        <p>${statusText}</p>
        <div class="online-actions">${requestBtn}${rivalActions}<button type="button" class="online-btn" data-action="change">Cambiar de juego</button></div>
      </div>`);
    const requestRematch = async (button) => {
      button.disabled = true;
      try {
        room = await requestGameRematch(room.id, createGameInitialState(gameId, room.host_id));
        if (gameId === 'battleship') playerState = await getGamePlayerState(room.id);
        renderRoom();
      }
      catch (error) { button.disabled = false; showToast(friendlyError(error.message), 'error'); }
    };
    const rejectRematch = async (button) => {
      button.disabled = true;
      try {
        room = await rejectGameRematch(room.id);
        renderRoom();
      }
      catch (error) { button.disabled = false; showToast(friendlyError(error.message), 'error'); }
    };
    page.querySelector('[data-action="rematch"]')?.addEventListener('click', (e) => requestRematch(e.currentTarget));
    page.querySelector('[data-action="cancel-rematch"]')?.addEventListener('click', (e) => rejectRematch(e.currentTarget));
    page.querySelector('[data-action="reject-rematch"]')?.addEventListener('click', (e) => rejectRematch(e.currentTarget));
    page.querySelector('[data-action="change"]').addEventListener('click', async () => {
      selectedTarget = room.host_id === user.id ? room.guest_id : room.host_id;
      targetName = 'tu rival';
      if (await loadTargets()) renderLobby();
    });
  }

  function renderWaiting() {
    shell(`
      <div class="online-panel online-waiting">
        <div class="online-waiting__visual" aria-hidden="true">
          <span class="online-waiting__spinner"></span>
          <span class="online-waiting__badge"><img class="online-waiting__cover" src="${coverSrc()}" alt=""></span>
        </div>
        <div class="online-waiting__content">
          <div class="online-status"><span class="online-status__dot"></span><span>Esperando a que ${escapeHtml(targetName || 'tu rival')} acepte la invitación…</span></div>
          <p class="online-subtitle">Puedes seguir en esta pantalla. Te avisaremos en cuanto la sala esté lista.</p>
        </div>
        <div class="online-actions"><button type="button" class="online-btn" data-action="back">Cancelar y volver</button></div>
      </div>`);
  }

  function renderRoom() {
    if (disposed || !room) return;
    if (room.status === 'waiting') { renderWaiting(); return; }
    if (room.status === 'finished') {
      if (raceMode()) leaveRace();
      if (!validGameState(gameId, room.state) || (gameId === 'battleship' && !validBattleshipPrivateState(playerState))) { renderError('La partida devolvió un estado no válido.'); return; }
      renderResult(); return;
    }
    if (room.status !== 'active') { renderError('Esta sala ya no está disponible.'); return; }
    if (!validGameState(gameId, room.state) || (gameId === 'battleship' && !validBattleshipPrivateState(playerState))) {
      renderError('La partida devolvió un estado no válido.'); return;
    }
    if (raceMode()) {
      renderRacePlay();
      return;
    }
    if (scoreMode()) {
      if (isMyTurn()) renderScorePlay(); else renderScoreWaiting();
      return;
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
          showToast(friendlyError(error.message) || 'El rival ha movido primero. Sincronizando…', 'info');
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
      // Battleship: el tablero privado solo existe cuando la sala está activa.
      // En 'waiting' el RPC devuelve null y no hay nada que mostrar todavía;
      // la suscripción Realtime lo cargará al aceptar el rival.
      if (gameId === 'battleship' && room.status !== 'waiting') playerState = await getGamePlayerState(room.id);
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
    leaveRace();
    if (scoreMessageHandler) {
      window.removeEventListener('message', scoreMessageHandler);
      scoreMessageHandler = null;
    }
    if (progressMessageHandler) {
      window.removeEventListener('message', progressMessageHandler);
      progressMessageHandler = null;
    }
    scoreFrame = null;
  };
  return page;
}
