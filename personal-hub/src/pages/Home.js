/* ==========================================
   Personal Hub v2 — Home Page
   Bienvenida · Novedades · Datos Curiosos
   ========================================== */

import { HOME_DATA } from '../data/homeData.js';

const START_DATE = '2025-07-03';
const NEWS = HOME_DATA.news;
const CURIOSITIES = HOME_DATA.curiosities;

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    if (m === '"') return '&quot;';
    if (m === "'") return '&#39;';
    return m;
  });
}

export function HomePage(router) {
  const page = document.createElement('div');
  page.className = 'home-page';

  const daysSince = Math.floor((Date.now() - new Date(START_DATE).getTime()) / 86400000);

  const CURIOSITY_ICONS = {
    palette: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="13.5" cy="6.5" r="0.5" fill="currentColor"/><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor"/><circle cx="8.5" cy="7.5" r="0.5" fill="currentColor"/><circle cx="6.5" cy="12.5" r="0.5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-1 0-.82.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-5.5-4.5-10-10-10z"/></svg>',
    sparkles: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3a6 6 0 0 0 9 9 6 6 0 1 0-9-9Z"/><path d="M20 12v6"/><path d="M17 15h-3"/><path d="M14 3v6"/><path d="M6.5 17.5 3 21"/><path d="M5 12H2"/><path d="M8 8V5"/></svg>',
    heart: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
    'calendar-days': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/></svg>'
  };

  function getCuriosityIcon(iconKey) {
    // Try SVG first, fall back to emoji
    return CURIOSITY_ICONS[iconKey] || '<span class="curiosity-icon-emoji">✦</span>';
  }

  page.innerHTML = `
    <!-- Hero -->
    <div class="bento-hero glass-card">
      <p class="eyebrow">
        <span class="eyebrow-icon"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 3a6 6 0 0 0 9 9 6 6 0 1 0-9-9Z"/><path d="M20 12v6"/><path d="M17 15h-3"/><path d="M14 3v6"/><path d="M6.5 17.5 3 21"/><path d="M5 12H2"/><path d="M8 8V5"/></svg></span>
        centro de webs
      </p>
      <h2>Bienvenida<br> mi <em> princesa</em></h2>
      <div class="hero-divider">
        <span class="hero-divider-line"></span>
        <span class="hero-divider-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></span>
        <span class="hero-divider-line"></span>
      </div>
      <p>Explora las webs que iré subiendo a lo largo del tiempo. Cada una es diferente pero con el mismo propósito.</p>
      <div class="day-counter">
        <span class="day-counter-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></span>
        <span id="homeDayCounter">${daysSince} días juntos</span>
      </div>
    </div>

    <!-- Novedades -->
    <div class="news-banner glass-card" id="newsBanner">
      <div class="news-header">
        <span class="news-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3a6 6 0 0 0 9 9 6 6 0 1 0-9-9Z"/><path d="M20 12v6"/><path d="M17 15h-3"/><path d="M14 3v6"/><path d="M6.5 17.5 3 21"/><path d="M5 12H2"/><path d="M8 8V5"/></svg></span>
        <span class="news-title">Novedades</span>
        <span class="news-badge" id="newsBadge">Nuevo</span>
        <button type="button" class="news-hide-btn" id="newsHideBtn" aria-label="Ocultar novedades" title="Ocultar novedades">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" id="hideEyeIcon"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        </button>
      </div>
      <div class="news-content" id="newsContent">
        <div class="news-empty">Cargando novedades...</div>
      </div>
    </div>

    <!-- Datos Curiosos -->
    <div class="curiosities-section">
      <div class="curiosities-header">
        <span class="curiosities-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></span>
        <h3>Datos curiosos</h3>
      </div>
      <div class="curiosities-grid">
        ${CURIOSITIES.map((c, i) => `
          <div class="curiosity-card glass-card" style="animation-delay: ${i * 0.1}s">
            <span class="curiosity-icon">${getCuriosityIcon(c.icon)}</span>
            <h4>${escapeHtml(c.title)}</h4>
            <p>${escapeHtml(c.description)}</p>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Footer -->
    <footer class="home-footer">
      <p>Hecho con amor</p>
    </footer>
  `;

  const NEWS_HIDE_KEY = 'ph.newsHidden';
  let newsHidden = localStorage.getItem(NEWS_HIDE_KEY) === 'true';

  const EYE_ICONS = {
    show: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    hide: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
  };

  // Apply initial hidden state
  const newsBanner = page.querySelector('#newsBanner');
  const newsHideBtn = page.querySelector('#newsHideBtn');
  if (newsHidden) {
    newsBanner.classList.add('news-collapsed');
    newsHideBtn.classList.add('is-hidden');
    newsHideBtn.innerHTML = EYE_ICONS.show;
    newsHideBtn.title = 'Mostrar novedades';
    newsHideBtn.setAttribute('aria-label', 'Mostrar novedades');
  }

  // Load news from HOME_DATA into the page element (before it's in DOM)
  loadNews();

  return page;

  // ==========================================
  function loadNews() {
    const container = page.querySelector('#newsContent');
    if (!container) return;
    renderNews(NEWS, container);

    // Bind hide/show toggle (after DOM is ready)
    requestAnimationFrame(() => {
      bindNewsToggle();
    });
  }

  function bindNewsToggle() {
    const btn = page.querySelector('#newsHideBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      newsHidden = !newsHidden;
      newsBanner.classList.toggle('news-collapsed', newsHidden);
      localStorage.setItem(NEWS_HIDE_KEY, newsHidden ? 'true' : 'false');
      btn.classList.toggle('is-hidden', newsHidden);
      // Swap icon and title
      btn.innerHTML = newsHidden ? EYE_ICONS.show : EYE_ICONS.hide;
      btn.title = newsHidden ? 'Mostrar novedades' : 'Ocultar novedades';
      btn.setAttribute('aria-label', newsHidden ? 'Mostrar novedades' : 'Ocultar novedades');
    });
  }

  function renderNews(items, container) {
    if (!items || items.length === 0) {
      container.innerHTML = '<div class="news-empty">✨ No hay novedades por ahora. ¡Vuelve pronto!</div>';
      return;
    }

    let html = '';
    const MAX_VISIBLE = 5;
    let hasHidden = false;

    items.forEach((item, i) => {
      const hidden = i >= MAX_VISIBLE;
      if (hidden && !hasHidden) hasHidden = true;
      const isSeparator = item.type === 'separator';

      if (isSeparator) {
        html += `
          <div class="news-separator">
            <span class="news-separator-line"></span>
            <span class="news-separator-label">${escapeHtml(item.label || '—')}</span>
            <span class="news-separator-line"></span>
          </div>`;
      } else {
        html += `
          <div class="news-item ${hidden ? 'news-hidden' : ''}" data-index="${item.id || i}">
            <div class="news-item-top">
              <span class="news-date">${escapeHtml(item.date || '')}</span>
            </div>
            <span class="news-item-title">${escapeHtml(item.title)}</span>
            <p class="news-item-desc">${escapeHtml(item.description || '')}</p>
          </div>`;
      }
    });

    container.innerHTML = html;

    if (hasHidden) {
      const toggle = document.createElement('button');
      toggle.className = 'news-toggle';
      toggle.type = 'button';
      toggle.innerHTML = '<span>Ver más novedades</span>';
      toggle.addEventListener('click', () => {
        container.querySelectorAll('.news-hidden').forEach(el => {
          el.classList.remove('news-hidden');
        });
        toggle.remove();
      });
      container.parentNode.appendChild(toggle);
    }
  }
}
