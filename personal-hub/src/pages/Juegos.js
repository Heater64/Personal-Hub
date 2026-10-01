/* ==========================================
   Personal Hub v2 — Juegos Page
   Sala recreativa — cada juego es un mundo
   ========================================== */

import '../styles/juegos.css';
import { getUserPref, setUserPref } from '../utils/userStorage.js';
import { gameCover } from '../utils/gameCovers.js';
import { loadGiftsCatalog, getGiftsCatalog, getGiftTodayStr } from '../services/gifts.service.js';
import { MULTIPLAYER_GAMES, ONLINE_GAMES_ENABLED } from '../services/games.service.js';
import { isCalendarAllOpen, isCalendarAllLocked } from '../utils/calendarOverrides.js';

import { GAMES } from '../data/games.catalog.js';
export { GAMES };


const ICONS = {
  'brain':    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a4 4 0 0 1 4 4c0 1.1-.4 2.1-1 2.8l.2 3.2a3 3 0 0 1-3 3h-.4a3 3 0 0 1-3-3l.2-3.2A4 4 0 0 1 8 6a4 4 0 0 1 4-4z"/><path d="M12 12v10"/><path d="M8 16a4 4 0 0 1-4-4c0-1.1.4-2.1 1-2.8"/><path d="M16 16a4 4 0 0 0 4-4c0-1.1-.4-2.1-1-2.8"/></svg>',
  'skull':    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M8 20v-1a4 4 0 0 1 4-4 4 4 0 0 1 4 4v1"/><path d="M12 2C8 2 4 5 4 10c0 3.5 2 5.5 3 7l1 3h8l1-3c1-1.5 3-3.5 3-7 0-5-4-8-8-8z"/></svg>',
  'snake':    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12h4l3-9 4 18 3-9h4"/></svg>',
  'landmine': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="16" r="4"/><path d="M12 2v6"/><path d="M12 8a4 4 0 0 1 4 4"/><path d="M5 12a2 2 0 0 1 2-2"/><path d="M17 12a2 2 0 0 0-2-2"/></svg>',
  'blocks':   '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="6" width="20" height="12" rx="2"/><rect x="6" y="3" width="4" height="4" rx="1"/><rect x="14" y="3" width="4" height="4" rx="1"/></svg>',
  'maze':     '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9h4V3h5v6h4v5h-4v7H7v-7H3V9z"/><path d="M7 9h5"/><path d="M12 14v3"/></svg>',
  'asteroid': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="9" r="1.5" fill="currentColor"/><circle cx="15" cy="14" r="1" fill="currentColor"/><path d="M8 16c1.5 1 3 1.5 5 1 2-.5 3-2 3.5-3"/></svg>',
  'knife':    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="8" y1="2" x2="8" y2="22"/><line x1="8" y1="2" x2="14" y2="8"/><path d="M8 22c0 0 2-5 7-5s7 5 7 5"/></svg>',
  'blackhole':'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/><path d="M12 2v3"/><path d="M19 12h-3"/><path d="M12 19v3"/><path d="M5 12H2"/></svg>',
  'target':   '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  'building': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="6" x2="9" y2="8"/><line x1="15" y1="6" x2="15" y2="8"/><line x1="9" y1="10" x2="9" y2="12"/><line x1="15" y1="10" x2="15" y2="12"/></svg>',
  'blocks2':  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="3" width="6" height="6" rx="1.5"/><rect x="6" y="11" width="6" height="6" rx="1.5"/><rect x="14" y="11" width="6" height="6" rx="1.5"/><rect x="14" y="19" width="6" height="6" rx="1.5"/></svg>',
  'grid':     '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg>',
  'connect':  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="16" rx="3"/><circle cx="6.5" cy="11" r="1.6" fill="currentColor"/><circle cx="10" cy="14" r="1.6" fill="currentColor"/><circle cx="13.5" cy="9" r="1.6" fill="currentColor"/><circle cx="17" cy="16" r="1.6" fill="currentColor"/></svg>',
  'xo':       '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 3v18"/><path d="M15 3v18"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="m7 7 4 4"/><path d="m11 7-4 4"/><circle cx="17" cy="17" r="2.2"/></svg>',
  'ufo':      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12c0-3 3.1-5 7-5s7 2 7 5-3.1 5-7 5-7-2-7-5z"/><path d="M12 17v4"/><path d="m8 21 4-3 4 3"/></svg>',
  'pong':     '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="7" width="3" height="10" rx="1.5"/><rect x="18" y="7" width="3" height="10" rx="1.5"/><path d="M12 5v14" stroke-dasharray="2 4"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>',
  'simon':    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 12 12 5A7 7 0 0 1 19 12Z"/><path d="M12 12 19 12A7 7 0 0 1 12 19Z"/><path d="M12 12 12 19A7 7 0 0 1 5 12Z"/></svg>',
  'fleet':    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 18h18"/><path d="M5 18l2-6h10l2 6"/><rect x="9" y="5" width="2.5" height="7" rx="1"/><rect x="12.5" y="5" width="2.5" height="7" rx="1"/><path d="M9 9h7"/></svg>',
  'chevron-right': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>',
  'gamepad': '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/></svg>',
  'trophy': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 22V8c0-1.1.9-2 2-2s2 .9 2 2v14"/></svg>',
  'sparkles': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a9 9 0 0 0 9 9 9 9 0 0 0-9 9 9 9 0 0 0-9-9 9 9 0 0 0 9-9Z"/><path d="M8 8a5 5 0 0 0 5 5 5 5 0 0 0-5 5 5 5 0 0 0-5-5 5 5 0 0 0 5-5Z"/></svg>',
  'play': '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  'heart': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  'clock': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  'star-filled': '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
};

// ==========================================
// HELPERS
// ==========================================
function lastPlayedId() {
  return getUserPref('lastPlayedGame', '');
}
function setLastPlayed(id) {
  setUserPref('lastPlayedGame', id);
}
function favGameId() {
  return getUserPref('favGame', '');
}
function setFavGame(id) {
  const current = favGameId();
  setUserPref('favGame', current === id ? '' : id);
}

// Enlace al juego con su color de portada (?accent=HEX) para que la
// página del juego use el mismo acento que su tarjeta en la web.
function gameHref(game) {
  return `${game.href}?accent=${game.color.replace('#', '')}`;
}

/**
 * Juegos bloqueados por el calendario: su fecha de desbloqueo aún no ha
 * llegado, así que no deben aparecer en la sala. Devuelve un Set de ids.
 * Si el catálogo no está disponible, no se bloquea nada (fail-open).
 */
function blockedGameIds() {
  // Overrides LOCALES (solo este navegador): el modo todo-abierto desbloquea
  // todos los juegos y todo-bloqueado los bloquea todos, para testear el
  // bloqueo en producción sin tocar la BD ni las fechas reales.
  if (isCalendarAllOpen()) return new Set();
  if (isCalendarAllLocked()) return new Set(GAMES.map(g => g.id));
  const catalog = getGiftsCatalog();
  if (!catalog?.gifts) return new Set();
  const today = getGiftTodayStr();
  const blocked = new Set();
  for (const gift of catalog.gifts) {
    if (gift?.type !== 'game') continue;
    const url = gift.redirectUrl || gift.data?.redirectUrl || '';
    const match = url.match(/games\/([^/?#]+)\.html/i);
    if (!match) continue;
    if (gift.unlock?.value && today < gift.unlock.value) blocked.add(decodeURIComponent(match[1]));
  }
  return blocked;
}

// ==========================================
// MAIN PAGE
// ==========================================
export async function JuegosPage(router) {
  await loadGiftsCatalog();
  const visibleGames = GAMES.filter(game => !blockedGameIds().has(game.id));

  const page = document.createElement('div');
  page.className = 'juegos-page';

  const totalGames = visibleGames.length;
  const lastId = lastPlayedId();
  const lastGame = lastId ? visibleGames.find(g => g.id === lastId) : null;
  const favId = favGameId();
  const favGame = favId ? visibleGames.find(g => g.id === favId) : null;

  page.innerHTML = `
    <!-- ===== HERO ===== -->
    <header class="juegos-header glass-card">
      <div class="juegos-header-bg">
        <span class="juegos-header-particle" style="top:8%;left:3%">${ICONS['gamepad']}</span>
        <span class="juegos-header-particle" style="top:15%;left:88%">${ICONS['sparkles']}</span>
        <span class="juegos-header-particle" style="top:55%;left:92%">${ICONS['trophy']}</span>
        <span class="juegos-header-particle" style="top:72%;left:4%">${ICONS['star-filled']}</span>
        <span class="juegos-header-particle" style="top:40%;left:48%">${ICONS['sparkles']}</span>
      </div>
      <div class="juegos-header-content">
        <span class="juegos-header-badge">${ICONS['gamepad']} Sala recreativa</span>
        <h1 class="juegos-header-title">Zona de Juegos</h1>
        <p class="juegos-header-sub">Un lugar para jugar, reír y pasar un buen rato juntos.</p>
      </div>
    </header>

    <!-- ===== STATS BAR ===== -->
    <div class="juegos-stats">
      <div class="juegos-stat">
        <span class="juegos-stat-num">${totalGames}</span>
        <span class="juegos-stat-label">disponibles</span>
      </div>
      ${lastGame ? `
      <div class="juegos-stat">
        <span class="juegos-stat-num juegos-stat-num--sm">${ICONS['gamepad']} ${lastGame.title}</span>
        <span class="juegos-stat-label">último jugado</span>
      </div>` : ''}
      ${favGame ? `
      <div class="juegos-stat">
        <span class="juegos-stat-num juegos-stat-num--sm">${ICONS['heart']} ${favGame.title}</span>
        <span class="juegos-stat-label">favorito</span>
      </div>` : ''}
    </div>

    <!-- ===== SECTION HEADER ===== -->
    <div class="juegos-section-header">
      <span class="juegos-section-chip">${ICONS['gamepad']}</span>
      <h3 class="juegos-section-title">Todos los juegos</h3>
      <span class="juegos-section-line"></span>
    </div>

    <!-- ===== GAME GRID ===== -->
    <div class="juegos-grid">
      ${visibleGames.map((game, i) => {
        const isFav = favGameId() === game.id;
        return `
        <div class="juego-card glass-card card" role="link" tabindex="0" data-href="${gameHref(game)}" data-id="${game.id}" style="--game-color:${game.color};--game-accent:${game.accent};--enter-delay:${i * 50}ms">
          ${isFav ? `<span class="juego-card-fav-badge" title="Tu favorito">${ICONS['heart']}</span>` : ''}
          <div class="juego-card-glow"></div>
          <div class="juego-card-cover" style="--game-color:${game.color};--game-accent:${game.accent}">
            <img src="${gameCover(game.id, game.color, game.accent)}" alt="Portada de ${game.title}" loading="lazy">
            <span class="juego-card-shade"></span>
            <h3 class="juego-card-title">${game.title}</h3>
          </div>
          ${ONLINE_GAMES_ENABLED && MULTIPLAYER_GAMES[game.id] ? `<a class="juego-card-online" href="#/juegos/online/${game.id}" aria-label="Invitar a jugar ${game.title}"><span class="juego-card-online__icon">${ICONS['gamepad']}</span><span>Jugar online</span></a>` : ''}
        </div>
      `}).join('')}
    </div>

    <!-- ===== FOOTER ===== -->
    <footer class="juegos-footer">
      <p>🎮 Más juegos próximamente · Hecho con amor</p>
    </footer>
  `;

  // ===== BIND EVENTS =====
  const playGame = (gameId, href) => {
    setLastPlayed(gameId);
    window.location.assign(href);
  };

  // Game cards
  page.querySelectorAll('.juego-card').forEach(card => {
    card.addEventListener('click', (event) => {
      if (event.target.closest('.juego-card-online')) return;
      playGame(card.dataset.id, card.dataset.href);
    });
    card.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('.juego-card-online')) {
        event.preventDefault();
        playGame(card.dataset.id, card.dataset.href);
      }
    });
    // Right-click / long-press to toggle favorite
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const id = card.dataset.id;
      setFavGame(id);
      // Re-render to update fav badge
      const currentFav = favGameId();
      const badge = card.querySelector('.juego-card-fav-badge');
      if (currentFav === id) {
        if (!badge) card.insertAdjacentHTML('afterbegin', `<span class="juego-card-fav-badge" title="Tu favorito">${ICONS['heart']}</span>`);
      } else {
        if (badge) badge.remove();
      }
      // Update stats bar
      const statsEl = page.querySelector('.juegos-stats');
      if (statsEl) {
        const statsFav = statsEl.querySelector('.juegos-stat:last-child');
        if (currentFav === id && !statsFav) {
          const g = visibleGames.find(g => g.id === id);
          if (g) {
            const favDiv = document.createElement('div');
            favDiv.className = 'juegos-stat';
            favDiv.innerHTML = `<span class="juegos-stat-num juegos-stat-num--sm">${ICONS['heart']} ${g.title}</span><span class="juegos-stat-label">favorito</span>`;
            statsEl.appendChild(favDiv);
          }
        } else if (currentFav !== id && statsFav && favGameId() === '') {
          statsFav.remove();
        }
      }
    });
  });

  // Staggered entrance
  requestAnimationFrame(() => {
    page.querySelectorAll('.juego-card').forEach(el => el.classList.add('visible'));
  });

  return page;
}
