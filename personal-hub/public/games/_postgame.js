/* ==========================================================
   GAMES — POSTGAME ENHANCER "Personal Hub"
   Shared by /games/*.html. Improves the post-game modal:
   - Parses #msgText "Etiqueta: valor · Etiqueta: valor" into
     stat chips (re-rendered on every show).
   - Keeps the post-game action focused on replay; navigation lives in the game topbar.
   - Victory badge + confetti on wins (🏆 🎉 🌟 👑).
   - Applies the game accent from ?accent=HEX (set by the
     Juegos page so each game matches its cover color).
   ========================================================== */
(function () {
  'use strict';

  /* ---- Accent desde la query string (?accent=HEX) ---- */
  try {
    let accent = new URLSearchParams(location.search).get('accent') || '';
    accent = accent.charAt(0) === '#' ? accent : '#' + accent;
    if (/^#[0-9a-fA-F]{6}$/.test(accent)) {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      // En light se tira hacia la frambuesa del tema para mantener contraste AA
      const base = isLight ? `color-mix(in srgb, ${accent} 72%, #a5124b)` : accent;
      const root = document.documentElement;
      root.style.setProperty('--coral', base);
      root.style.setProperty('--coral-hover', `color-mix(in srgb, ${base} 84%, #ffffff)`);
      root.style.setProperty('--coral-dark', `color-mix(in srgb, ${base} 70%, #000000)`);
      root.style.setProperty('--glow', `0 0 22px color-mix(in srgb, ${base} 26%, transparent)`);
      root.style.setProperty('--msg-accent-bg', `color-mix(in srgb, ${base} 14%, transparent)`);
      root.style.setProperty('--msg-accent-ring', `color-mix(in srgb, ${base} 24%, transparent)`);
    }
  } catch (e) { /* sin query param: usa el acento del tema */ }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  var WIN_RE = /🏆|🎉|🌟|👑/;

  /* ---- Chips de estadísticas desde #msgText ---- */
  function refreshStats(content) {
    const textEl = content.querySelector('#msgText') || content.querySelector('p');
    if (!textEl) return;
    const raw = textEl.textContent.trim();
    if (!raw) return;

    let stats = content.querySelector('.msg-stats');
    if (!stats) {
      stats = document.createElement('div');
      stats.className = 'msg-stats';
      textEl.insertAdjacentElement('afterend', stats);
    }

    const parts = raw.split('·').map(s => s.trim()).filter(Boolean);
    const hasStats = parts.some(part => /^.+?:\s*.+$/.test(part));
    if (!hasStats) { // frase normal: se queda como párrafo
      stats.remove();
      return;
    }

    textEl.style.display = 'none';
    stats.innerHTML = parts.map(part => {
      const m = part.match(/^(.+?):\s*(.+)$/);
      if (m) {
        return `<div class="msg-stat"><span class="msg-stat-label">${esc(m[1])}</span><span class="msg-stat-value">${esc(m[2])}</span></div>`;
      }
      return `<div class="msg-stat msg-stat--full"><span class="msg-stat-value">${esc(part)}</span></div>`;
    }).join('');
  }

  /* ---- Fila de acciones: solo repetir la partida ---- */
  function ensureActions(content) {
    if (content.querySelector('.msg-actions')) return;

    const btn = content.querySelector('#msgBtn');
    const stayBtn = content.querySelector('[data-postgame-stay]');
    const actionNodes = [btn, stayBtn].filter(Boolean);
    if (!actionNodes.length) return;

    const actions = document.createElement('div');
    actions.className = 'msg-actions';
    actionNodes[0].parentNode.insertBefore(actions, actionNodes[0]);
    actionNodes.forEach(node => actions.appendChild(node));
  }

  /* ---- Insignia de victoria + confeti ---- */
  function celebrate(content) {
    const icon = content.querySelector('#msgIcon') || content.querySelector('.icon');
    if (!icon || !WIN_RE.test(icon.textContent)) return;

    if (!content.querySelector('.msg-record')) {
      const badge = document.createElement('span');
      badge.className = 'msg-record';
      badge.textContent = '🎉 ¡Bien jugado!';
      const h2 = content.querySelector('h2');
      if (h2) h2.insertAdjacentElement('afterend', badge);
    }
    launchConfetti();
  }

  function launchConfetti() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#e8735a', '#ffd166', '#ff8aa1', '#4ade80', '#60a5fa', '#f8edf0'];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 70; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      const size = 6 + Math.random() * 7;
      p.style.width = size + 'px';
      p.style.height = (size * 1.5) + 'px';
      p.style.left = (Math.random() * 100) + 'vw';
      p.style.background = colors[i % colors.length];
      p.style.borderRadius = Math.random() > 0.6 ? '50%' : '2px';
      p.style.animationDuration = (2.2 + Math.random() * 1.8) + 's';
      p.style.animationDelay = (Math.random() * 0.5) + 's';
      frag.appendChild(p);
    }
    document.body.appendChild(frag);
    setTimeout(() => {
      if (frag.parentNode) frag.parentNode.removeChild(frag);
    }, 4800);
  }

  /* ---- Barra superior contextual de cada juego ---- */
  function ensureGameTopbar() {
    const container = document.querySelector('.game-container');
    if (!container || container.querySelector('.game-topbar')) return;

    // Los enlaces antiguos al pie dejan de duplicar la navegación.
    container.querySelectorAll('.game-back-nav').forEach(el => el.remove());

    const titleEl = container.querySelector('.game-header h1, .game-container > h1, .game-container > h2');
    const title = titleEl ? titleEl.textContent.trim() : 'Juego';
    const nav = document.createElement('nav');
    nav.className = 'game-topbar';
    nav.setAttribute('aria-label', 'Navegación del juego');
    nav.innerHTML = `
      <a class="game-topbar__link game-topbar__link--games" href="/#/juegos" aria-label="Volver a Juegos">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        <span>Juegos</span>
      </a>
      <span class="game-topbar__title">${esc(title)}</span>
      <a class="game-topbar__link game-topbar__link--calendar" href="/#/calendario" aria-label="Volver al Calendario">
        <span>Calendario</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 9h18"/></svg>
      </a>
    `;
    container.insertBefore(nav, container.firstChild);
  }

  ensureGameTopbar();

  /* ---- Observar el modal postjuego (#gameMessage) ---- */
  const modal = document.getElementById('gameMessage');
  if (!modal) return;

  const enhance = () => {
    const content = modal.querySelector('.game-message-content');
    if (!content) return;
    refreshStats(content);
    ensureActions(content);
    celebrate(content);
  };

  if (window.MutationObserver) {
    const obs = new MutationObserver(() => {
      if (modal.classList.contains('show')) enhance();
    });
    obs.observe(modal, { attributes: true, attributeFilter: ['class'] });
  }

  if (modal.classList.contains('show')) enhance();
})();
