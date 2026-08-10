import { userStore } from '../stores/user.store.js';
import { showToast } from './Toast.js';
import {
  MULTIPLAYER_GAMES,
  respondGameInvitation,
  subscribeToGameInvitations
} from '../services/games.service.js';
import '../styles/online-games.css';

/**
 * Centro global de invitaciones.
 * Vive fuera del router para no desmontarse al cambiar de sección.
 */
export function GameInviteCenter(router) {
  const root = document.createElement('div');
  root.className = 'game-invite-center';
  root.setAttribute('aria-live', 'polite');

  let invitations = [];
  let unsubscribe = null;
  let subscribedUserId = null;
  let expiryTimer = null;

  function render() {
    clearTimeout(expiryTimer);
    root.innerHTML = '';
    if (!invitations.length) return;

    const nextExpiry = Math.min(...invitations.map(item => new Date(item.expires_at).getTime()).filter(Number.isFinite));
    if (Number.isFinite(nextExpiry)) {
      expiryTimer = setTimeout(() => {
        const now = Date.now();
        invitations = invitations.filter(item => new Date(item.expires_at).getTime() > now);
        render();
      }, Math.max(1000, nextExpiry - Date.now() + 250));
    }

    const current = invitations[0];
    const game = MULTIPLAYER_GAMES[current.game_id] || { title: 'un juego', emoji: '🎮' };

    const bell = document.createElement('button');
    bell.type = 'button';
    bell.className = 'game-invite-bell';
    bell.setAttribute('aria-label', `${invitations.length} invitación${invitations.length > 1 ? 'es' : ''} de juego`);
    bell.textContent = `🎮 ${invitations.length}`;

    const card = document.createElement('section');
    card.className = 'game-invite-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Invitación a jugar');
    card.innerHTML = `
      <div class="game-invite-card__eyebrow">${game.emoji} Invitación para jugar</div>
      <h2>${game.title}</h2>
      <p><strong></strong> quiere jugar contigo.</p>
      <div class="game-invite-card__meta">La invitación caduca en unos minutos.</div>
      <div class="game-invite-card__actions">
        <button type="button" class="game-invite-card__reject">Rechazar</button>
        <button type="button" class="game-invite-card__accept">Aceptar partida</button>
      </div>
    `;
    card.querySelector('strong').textContent = current.inviter_name || 'Tu compañero';

    const accept = card.querySelector('.game-invite-card__accept');
    const reject = card.querySelector('.game-invite-card__reject');

    accept.addEventListener('click', async () => {
      accept.disabled = true;
      try {
        await respondGameInvitation(current.id, true);
        invitations = invitations.filter(item => item.id !== current.id);
        showToast('Partida aceptada. Preparando la sala…', 'success');
        router.navigate(`/juegos/online/${current.game_id}?room=${current.room_id}`);
      } catch (error) {
        accept.disabled = false;
        showToast(error.message || 'No se pudo aceptar la invitación.', 'error');
      }
      render();
    });

    reject.addEventListener('click', async () => {
      reject.disabled = true;
      try {
        await respondGameInvitation(current.id, false);
        invitations = invitations.filter(item => item.id !== current.id);
        showToast('Invitación rechazada.', 'info');
        render();
      } catch (error) {
        reject.disabled = false;
        showToast(error.message || 'No se pudo rechazar la invitación.', 'error');
      }
    });

    bell.addEventListener('click', () => card.classList.toggle('is-visible'));
    root.append(bell, card);
    requestAnimationFrame(() => card.classList.add('is-visible'));
  }

  function attach(user) {
    if (subscribedUserId === user?.id) return;
    if (unsubscribe) unsubscribe();
    clearTimeout(expiryTimer);
    unsubscribe = null;
    subscribedUserId = user?.id || null;
    invitations = [];
    if (!user) { render(); return; }
    try {
      unsubscribe = subscribeToGameInvitations(user.id, (items) => {
        const hadNone = invitations.length === 0;
        invitations = items || [];
        if (!hadNone && invitations.length > 0) showToast('Tienes una nueva invitación para jugar 🎮', 'info', 6000);
        render();
      });
    } catch (error) {
      console.warn('[games] Centro de invitaciones no disponible:', error.message);
    }
    render();
  }

  userStore.onChange(attach);
  attach(userStore.getUser());
  return root;
}
