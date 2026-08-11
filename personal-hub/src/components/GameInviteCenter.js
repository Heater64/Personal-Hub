import { userStore } from '../stores/user.store.js';
import { supabase } from '../services/supabase.js';
import { showToast } from './Toast.js';

/** Iconos SVG finos (mismo lenguaje visual que el resto de la app). */
const ICON = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>',
  headphones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Z"/><path d="M21 14h-3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-5Z"/><path d="M3 14v-2a9 9 0 0 1 18 0v2"/></svg>',
  gamepad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect width="20" height="12" x="2" y="6" rx="2"/></svg>'
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>\"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;'
  }[character]));
}
import {
  MULTIPLAYER_GAMES,
  respondGameInvitation,
  subscribeToGameInvitations,
  subscribeToRematchRequests,
  requestGameRematch,
  rejectGameRematch
} from '../services/games.service.js';
import {
  initListenTogether, startListenTogether, stopListenTogether, respondListenTogether, onListenTogether
} from '../services/listenTogether.service.js';
import { playInviteChime } from '../services/sounds.service.js';
import '../styles/online-games.css';

/** Traduce errores técnicos de Supabase a mensajes legibles (misma utilidad que OnlineGame). */
function friendlyError(error) {
  const raw = String(error?.message || error || '');
  const lower = raw.toLowerCase();
  if (/no suitable key|wrong key type|invalid api key|invalid jwt|jwt expired|jwt malformed|401/i.test(lower)) {
    return 'No se pudo conectar con tu sesión. Cierra sesión y entra de nuevo.';
  }
  if (/row-level security|violates row-level|permission denied|not authorized|forbidden/i.test(lower)) {
    return 'No tienes permiso para esa acción.';
  }
  if (/network|fetch failed|failed to fetch|load failed|timed? ?out/i.test(lower)) {
    return 'Sin conexión. Comprueba internet y vuelve a intentarlo.';
  }
  return raw;
}

/**
 * Centro global de invitaciones.
 * Vive fuera del router para no desmontarse al cambiar de sección.
 */
export function GameInviteCenter(router) {
  const root = document.createElement('div');
  root.className = 'game-invite-center';
  root.setAttribute('aria-live', 'polite');

  let invitations = [];
  let rematches = [];
  let listenRequest = null;      // solicitud de escuchar juntos pendiente
  let unsubscribe = null;
  let subscribedUserId = null;
  let expiryTimer = null;
  let offListen = null;
  const known = new Set();       // ids ya mostrados: la entrada con rebote solo suena la primera vez

  function render() {
    clearTimeout(expiryTimer);
    root.innerHTML = '';
    if (!invitations.length && !rematches.length && !listenRequest) return;
    if (listenRequest) {
      renderListenRequest(listenRequest);
      return;
    }
    if (invitations.length) {
      renderInvitation(invitations[0]);
      return;
    }
    renderRematch(rematches[0]);
  }

  /** Tarjeta de invitación clásica (nueva partida). */
  function renderInvitation(current) {
    const game = MULTIPLAYER_GAMES[current.game_id] || { title: 'un juego', emoji: '🎮' };
    const inviterName = current.inviter_name || 'Tu compañero';
    const inviterAvatar = current.inviter_avatar || '';

    const nextExpiry = Math.min(...invitations.map(item => new Date(item.expires_at).getTime()).filter(Number.isFinite));
    if (Number.isFinite(nextExpiry)) {
      expiryTimer = setTimeout(() => {
        const now = Date.now();
        invitations = invitations.filter(item => new Date(item.expires_at).getTime() > now);
        render();
      }, Math.max(1000, nextExpiry - Date.now() + 250));
    }

    const fresh = !known.has(current.id);
    known.add(current.id);

    const bell = document.createElement('button');
    bell.type = 'button';
    bell.className = 'game-invite-bell';
    bell.setAttribute('aria-label', `${invitations.length} invitación${invitations.length > 1 ? 'es' : ''} de juego`);
    bell.innerHTML = `<span class="game-invite-bell__icon">${ICON.gamepad}</span><span class="game-invite-bell__count">${invitations.length}</span>`;
    if (fresh) bell.classList.add('is-fresh');

    const card = document.createElement('section');
    card.className = 'game-invite-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Invitación a jugar');
    card.innerHTML = `
      <div class="game-invite-card__glow" aria-hidden="true"></div>
      <header class="game-invite-card__head">
        <span class="game-invite-card__emblem">${game.emoji}</span>
        <div>
          <div class="game-invite-card__eyebrow">Invitación para jugar</div>
          <h2>${escapeHtml(game.title)}</h2>
        </div>
      </header>
      <div class="game-invite-card__inviter">
        <span class="game-invite-card__avatar">
          ${inviterAvatar
            ? `<img class="game-invite-card__avatar-img" src="${escapeHtml(inviterAvatar)}" alt="" onerror="this.style.display='none';var f=this.nextElementSibling;if(f)f.style.display='grid';">`
            : ''}
          <span class="game-invite-card__avatar-fallback" style="${inviterAvatar ? 'display:none' : ''}">${(inviterName || 'T').charAt(0).toUpperCase()}</span>
        </span>
        <p><strong class="game-invite-card__inviter-name">${escapeHtml(inviterName)}</strong> quiere jugar contigo.</p>
      </div>
      <div class="game-invite-card__meta"><span class="game-invite-card__meta-icon">${ICON.clock}</span>La invitación caduca en unos minutos.</div>
      <div class="game-invite-card__actions">
        <button type="button" class="game-invite-card__reject"><span class="game-invite-card__btn-icon">${ICON.x}</span>Rechazar</button>
        <button type="button" class="game-invite-card__accept"><span class="game-invite-card__btn-icon">${ICON.check}</span>Aceptar partida</button>
      </div>
    `;

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
        showToast(friendlyError(error) || 'No se pudo aceptar la invitación.', 'error');
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
        showToast(friendlyError(error) || 'No se pudo rechazar la invitación.', 'error');
      }
    });

    bell.addEventListener('click', () => card.classList.toggle('is-visible'));
    root.append(bell, card);
    requestAnimationFrame(() => {
      card.classList.add('is-visible');
      if (fresh) card.classList.add('is-fresh');
    });

    // Nombre/foto SIEMPRE frescos desde profiles: si el invitador cambió su
    // nombre o avatar, la tarjeta lo refleja aunque la invitación guardara el viejo.
    if (current.inviter_id) {
      updateInviterFromProfiles(card, current.inviter_id, inviterName, inviterAvatar);
    }
  }

  /** Refresca nombre/foto del invitador desde profiles (best effort). */
  function updateInviterFromProfiles(card, inviterId, fallbackName, fallbackAvatar) {
    supabase.from('profiles').select('name, avatar_url').eq('id', inviterId).maybeSingle()
        .then(({ data }) => {
          if (!data || !card.isConnected) return;
          const fresh = (data.name && String(data.name).trim()) ? String(data.name) : '';
          const freshAvatar = data.avatar_url ? String(data.avatar_url) : '';
          const nameEl = card.querySelector('.game-invite-card__inviter-name');
          let imgEl = card.querySelector('.game-invite-card__avatar-img');
          const fallbackEl = card.querySelector('.game-invite-card__avatar-fallback');
          const avatarEl = card.querySelector('.game-invite-card__avatar');
          if (fresh && nameEl) nameEl.textContent = fresh;
          if (freshAvatar && avatarEl && !imgEl) {
            // La invitación nació sin foto: crea el <img> y oculta la inicial.
            imgEl = document.createElement('img');
            imgEl.className = 'game-invite-card__avatar-img';
            imgEl.alt = '';
            avatarEl.prepend(imgEl);
            if (fallbackEl) fallbackEl.style.display = 'none';
          }
          if (imgEl) {
            imgEl.src = freshAvatar;
            imgEl.style.display = freshAvatar ? '' : 'none';
            if (fallbackEl) fallbackEl.style.display = freshAvatar ? 'none' : '';
          } else if (fallbackEl) {
            fallbackEl.textContent = (fresh || inviterName).charAt(0).toUpperCase();
          }
        })
        .catch(() => { /* se queda con los valores de la invitación */ });
  }

  /** Tarjeta de solicitud de escuchar juntos (música en tiempo real). */
  function renderListenRequest(current) {
    // Las solicitudes de música solo se renderizan al llegar (o al aceptar/rechazar),
    // así que siempre es una aparición fresca con rebote.
    const fresh = true;
    const bell = document.createElement('button');
    bell.type = 'button';
    bell.className = 'game-invite-bell';
    bell.setAttribute('aria-label', 'Solicitud para escuchar juntos');
    bell.innerHTML = `<span class="game-invite-bell__icon">${ICON.headphones}</span>`;
    if (fresh) bell.classList.add('is-fresh');

    const card = document.createElement('section');
    card.className = 'game-invite-card game-invite-card--music';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Escuchar juntos');
    card.innerHTML = `
      <div class="game-invite-card__glow" aria-hidden="true"></div>
      <header class="game-invite-card__head">
        <span class="game-invite-card__emblem"><span class="game-invite-card__emblem-icon">${ICON.headphones}</span></span>
        <div>
          <div class="game-invite-card__eyebrow">Escuchar juntos</div>
          <h2>${escapeHtml(current.name || 'Tu pareja')}</h2>
        </div>
      </header>
      <p class="game-invite-card__body">Quiere escuchar la música contigo en tiempo real.</p>
      <div class="game-invite-card__meta"><span class="game-invite-card__meta-icon">${ICON.refresh}</span>Lo que pongas se escuchará en los dos dispositivos.</div>
      <div class="game-invite-card__actions">
        <button type="button" class="game-invite-card__reject"><span class="game-invite-card__btn-icon">${ICON.x}</span>Rechazar</button>
        <button type="button" class="game-invite-card__accept"><span class="game-invite-card__btn-icon">${ICON.check}</span>Aceptar</button>
      </div>
    `;

    card.querySelector('.game-invite-card__accept').addEventListener('click', () => {
      const user = userStore.getUser();
      listenRequest = null;
      respondListenTogether(true, user?.name || 'Tu pareja', user?.avatar || '');
      startListenTogether(user?.name || 'Tu pareja', user?.avatar || '');
      showToast('Solicitud aprobada. Escuchando juntos 🎧', 'success');
      render();
    });

    card.querySelector('.game-invite-card__reject').addEventListener('click', () => {
      listenRequest = null;
      respondListenTogether(false);
      showToast('Solicitud rechazada.', 'info');
      render();
    });

    bell.addEventListener('click', () => card.classList.toggle('is-visible'));
    root.append(bell, card);
    requestAnimationFrame(() => {
      card.classList.add('is-visible');
      if (fresh) card.classList.add('is-fresh');
    });
  }

  /** Tarjeta de revancha: el rival quiere repetir partida. */
  function renderRematch(current) {
    const fresh = !known.has(current.id);
    known.add(current.id);
    const game = MULTIPLAYER_GAMES[current.game_id] || { title: 'un juego', emoji: '🎮' };
    const bell = document.createElement('button');
    bell.type = 'button';
    bell.className = 'game-invite-bell';
    bell.setAttribute('aria-label', 'Petición de revancha');
    bell.innerHTML = `<span class="game-invite-bell__icon">${ICON.refresh}</span><span class="game-invite-bell__count">${rematches.length}</span>`;
    if (fresh) bell.classList.add('is-fresh');

    const card = document.createElement('section');
    card.className = 'game-invite-card game-invite-card--rematch';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Revancha');
    card.innerHTML = `
      <div class="game-invite-card__glow" aria-hidden="true"></div>
      <header class="game-invite-card__head">
        <span class="game-invite-card__emblem"><span class="game-invite-card__emblem-icon">${ICON.refresh}</span></span>
        <div>
          <div class="game-invite-card__eyebrow">Revancha</div>
          <h2>${escapeHtml(game.title)}</h2>
        </div>
      </header>
      <p class="game-invite-card__body"><strong>Tu rival</strong> quiere la revancha. ¿Jugamos otra?</p>
      <div class="game-invite-card__meta"><span class="game-invite-card__meta-icon">${ICON.gamepad}</span>Podéis cambiar de juego o seguir con la misma partida.</div>
      <div class="game-invite-card__actions">
        <button type="button" class="game-invite-card__reject" data-rematch="reject"><span class="game-invite-card__btn-icon">${ICON.x}</span>Rechazar</button>
        <button type="button" class="game-invite-card__accept" data-rematch="accept"><span class="game-invite-card__btn-icon">${ICON.check}</span>Aceptar revancha</button>
      </div>
    `;

    card.querySelector('[data-rematch="accept"]').addEventListener('click', async () => {
      const btn = card.querySelector('[data-rematch="accept"]');
      btn.disabled = true;
      try {
        await requestGameRematch(current.room_id, {});
        rematches = rematches.filter(item => item.id !== current.id);
        showToast('Revancha aceptada. ¡A por otra!', 'success');
        router.navigate(`/juegos/online/${current.game_id}?room=${current.room_id}`);
      } catch (error) {
        btn.disabled = false;
        showToast(friendlyError(error) || 'No se pudo aceptar la revancha.', 'error');
      }
      render();
    });

    card.querySelector('[data-rematch="reject"]').addEventListener('click', async () => {
      const btn = card.querySelector('[data-rematch="reject"]');
      btn.disabled = true;
      try {
        await rejectGameRematch(current.room_id);
        rematches = rematches.filter(item => item.id !== current.id);
        showToast('Revancha rechazada.', 'info');
      } catch (error) {
        btn.disabled = false;
        showToast(friendlyError(error) || 'No se pudo rechazar la revancha.', 'error');
      }
      render();
    });

    bell.addEventListener('click', () => card.classList.toggle('is-visible'));
    root.append(bell, card);
    requestAnimationFrame(() => {
      card.classList.add('is-visible');
      if (fresh) card.classList.add('is-fresh');
    });
  }

  function attach(user) {
    if (subscribedUserId === user?.id) return;
    if (unsubscribe) unsubscribe();
    clearTimeout(expiryTimer);
    unsubscribe = null;
    subscribedUserId = user?.id || null;
    invitations = [];
    rematches = [];
    listenRequest = null;
    if (!user) { render(); return; }
    initListenTogether();
    if (offListen) offListen();
    offListen = onListenTogether(({ type, payload }) => {
      if (type === 'request') {
        // Ignora la propia solicitud (no llega por broadcast al mismo canal de quien la envía)
        listenRequest = { name: payload?.name || 'Tu pareja', avatar: payload?.avatar || '' };
        playInviteChime('listen');
        showToast(`🎧 ${listenRequest.name} quiere escuchar juntos`, 'info', 6000);
        render();
      } else if (type === 'response') {
        const approved = payload?.approved;
        if (approved) {
          const user = userStore.getUser();
          startListenTogether(user?.name || 'Tu pareja', user?.avatar || '');
          showToast('Solicitud aprobada. Escuchando juntos 🎧', 'success');
        } else {
          stopListenTogether();
          showToast('Solicitud rechazada.', 'info');
        }
      }
    });
    try {
      unsubscribe = subscribeToGameInvitations(user.id, (items) => {
        const hadNone = invitations.length === 0;
        invitations = items || [];
        if (!hadNone && invitations.length > 0) {
          playInviteChime('invite');
          showToast('Tienes una nueva invitación para jugar 🎮', 'info', 6000);
        }
        render();
      });
    } catch (error) {
      console.warn('[games] Centro de invitaciones no disponible:', friendlyError(error));
    }
    try {
      const rematchUnsub = subscribeToRematchRequests(user.id, (items) => {
        const hadNone = rematches.length === 0;
        rematches = items || [];
        if (!hadNone && rematches.length > 0) {
          playInviteChime('rematch');
          showToast('Tu rival quiere la revancha 🎮', 'info', 6000);
        }
        render();
      });
      const previousUnsub = unsubscribe;
      unsubscribe = () => { previousUnsub(); rematchUnsub(); };
    } catch (error) {
      console.warn('[games] Notificaciones de revancha no disponibles:', friendlyError(error));
    }
    render();
  }

  userStore.onChange(attach);
  attach(userStore.getUser());
  return root;
}
