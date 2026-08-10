/* ==========================================================
   GAMES — POSTGAME ENHANCER "Personal Hub"
   Shared by /games/*.html. Improves the post-game modal:
   - Parses #msgText "Etiqueta: valor · Etiqueta: valor" into
     stat chips (re-rendered on every show).
   - Adds a "← Juegos" ghost button next to the primary action.
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

  /* ---- Fila de acciones: botón principal + volver a Juegos ---- */
  function ensureActions(content) {
    if (content.querySelector('.msg-actions')) return;
    const btn = content.querySelector('#msgBtn');
    if (!btn) return;

    const actions = document.createElement('div');
    actions.className = 'msg-actions';

    const back = document.createElement('a');
    back.className = 'msg-back';
    back.href = '/#/juegos';
    back.textContent = '← Juegos';

    btn.parentNode.insertBefore(actions, btn);
    actions.appendChild(btn);
    actions.appendChild(back);
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
