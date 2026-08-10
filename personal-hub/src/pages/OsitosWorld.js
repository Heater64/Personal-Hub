/* ==========================================
   Personal Hub v3 — OsitosWorld Page
   Storybook universe: entry screen, living world,
   book library, character sheets, search, recommendations
   ========================================== */

import { escapeHtml } from '../utils/escape.js';
import { CHARACTERS } from '../data/ositos-data.js';
import { userPrefKey } from '../utils/userStorage.js';

// ==========================================
// DATOS DEL MUNDO
// Estos arrays se rellenan poco a poco. Mientras una sección no tenga
// contenido real, la UI muestra su estado vacío en lugar de placeholders.
// ==========================================

const CHAPTERS = [];

const PLACES = [];

const NEWS = [];

/**
 * ¿El valor es contenido real? Los placeholders de scaffolding ('.', vacío,
 * 'Descripción') no se muestran en la UI: se tratan como "aún sin rellenar".
 */
const hasText = (v) =>
  typeof v === 'string' && v.trim().length > 0 &&
  !/^\.+$/.test(v.trim()) && !/^Descripci[oó]n\.?$/.test(v.trim());

// ==========================================
// CONSTANTES
// ==========================================

// Preferencias aisladas por usuario (coherente con el resto de la app).
// Se leen a través de userPrefKey(base) → ph.<base>.<userId>.
const FAVORITES_KEY = () => userPrefKey('ositosWorld.favorites');
const ACTIVE_SECTION_KEY = () => userPrefKey('ositosWorld.activeSection');
const ENTRY_SEEN_KEY = () => userPrefKey('ositosWorld.entrySeen');

/** Migra las claves globales legacy a su versión por-usuario (una sola vez). */
function migrateLegacyKeys() {
  ['ositosWorld.favorites', 'ositosWorld.activeSection', 'ositosWorld.entrySeen'].forEach(base => {
    const scoped = userPrefKey(base);
    if (localStorage.getItem(scoped) !== null) return;
    const legacy = localStorage.getItem(base);
    if (legacy === null) return;
    localStorage.setItem(scoped, legacy);
    localStorage.removeItem(base);
  });
}

// ==========================================
// EMOJI MAPS
// ==========================================

function getEmojiForCharacter(name) {
  const c = CHARACTERS.find(ch => ch.name === name);
  return c ? c.emoji : '🧸';
}

function getEmojiForPlace(name) {
  const map = {
    'Bosque Azul': '🌳',
    'Pueblo de los Conejos': '🏘️',
    'Castillo Oscuro': '🏰',
    'Lago de los Deseos': '🌊'
  };
  return map[name] || '📍';
}

// ==========================================
// SVG ICONS
// ==========================================

const I = {
  home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  book: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  users: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  map: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  news: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0V4"/><path d="M10 8h6"/><path d="M10 12h6"/><path d="M10 16h4"/></svg>',
  list: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  sword: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  skull: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
  heart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  arrowLeft: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
  close: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  star: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  starFilled: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
  heartFilled: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#FF6B6B" stroke="#FF6B6B" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  sparkle: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z"/></svg>',
};

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export function OsitosWorldPage(router) {
  const page = document.createElement('div');
  page.className = 'ositos-page';

  migrateLegacyKeys();

  let activeSection = localStorage.getItem(ACTIVE_SECTION_KEY()) || 'home';
  let activeFilter = 'todos';
  let favorites = new Set();
  let searchQuery = '';
  let showingDetail = null; // 'character', 'place', 'chapter' — full-page detail overlay
  let detailData = null;
  let entryVisible = !localStorage.getItem(ENTRY_SEEN_KEY());

  try {
    const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY()) || '[]');
    favorites = new Set(saved);
  } catch { favorites = new Set(); }

  function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY(), JSON.stringify([...favorites]));
  }

  function isFav(id) { return favorites.has(id); }
  function toggleFav(id) {
    if (favorites.has(id)) favorites.delete(id);
    else favorites.add(id);
    saveFavorites();
    if (activeSection === 'personajes') renderContent();
    updateSidebarFavs();
    // Also update detail view if open
    if (showingDetail) renderDetailOverlay();
  }

  function getCount(role) {
    if (role === 'favoritos') return favorites.size;
    return role === 'todos' ? CHARACTERS.length : CHARACTERS.filter(c => c.role === role).length;
  }

  function getRoleColor(role) {
    return { heroe: '#4169FF', villano: '#D32F2F', aliado: '#43A047' }[role] || '#888';
  }

  function getRoleLabel(role) {
    return { heroe: 'HÉROE', villano: 'VILLANO', aliado: 'ALIADO' }[role] || role.toUpperCase();
  }

  // ==========================================
  // TOAST
  // ==========================================
  function showOsitosMsg(text) {
    const prev = document.querySelector('.ositos-temp-message');
    if (prev) prev.remove();
    const msg = document.createElement('div');
    msg.className = 'ositos-temp-message';
    msg.textContent = text;
    document.body.appendChild(msg);
    setTimeout(() => { msg.style.opacity = '0'; msg.style.transform = 'translateX(-50%) translateY(20px)'; setTimeout(() => msg.remove(), 300); }, 2500);
  }

  // ==========================================
  // GLOBAL PARTICLES — living world fireflies
  // ==========================================
  function getFirefliesHTML(count = 18) {
    const emojis = ['✨','⭐','💫','🪐','☁️'];
    let html = '';
    for (let i = 0; i < count; i++) {
      const emoji = emojis[i % emojis.length];
      const left = Math.random() * 100;
      const delay = Math.random() * 8;
      const duration = 4 + Math.random() * 7;
      const size = 0.5 + Math.random() * 1.2;
      html += `<span class="os-firefly" style="left:${left}%;animation-delay:${delay}s;animation-duration:${duration}s;font-size:${size}rem">${emoji}</span>`;
    }
    return html;
  }

  // ==========================================
  // SEARCH
  // ==========================================
  function searchAll(query) {
    const q = query.toLowerCase().trim();
    if (!q) return { characters: [], chapters: [], places: [], news: [] };

    const chars = CHARACTERS.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.role.toLowerCase().includes(q) ||
      (c.personality && c.personality.toLowerCase().includes(q))
    );

    const chaps = CHAPTERS.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.summary.toLowerCase().includes(q)
    );

    const places = PLACES.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    );

    const newsItems = NEWS.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q)
    );

    return { characters: chars, chapters: chaps, places, news: newsItems };
  }

  // ==========================================
  // RECOMMENDATIONS
  // ==========================================
  function getRecommendations(type, id) {
    const recs = [];
    if (type === 'character') {
      const char = CHARACTERS.find(c => c.id === id);
      if (char && char.friends) {
        char.friends.filter(Boolean).forEach(name => {
          const friend = CHARACTERS.find(c => c.name === name);
          if (friend && friend.id !== id) recs.push({ type: 'character', data: friend });
        });
      }
      // Also suggest places
      const relatedPlaces = PLACES.filter(p => (p.characters || []).includes(char?.name));
      relatedPlaces.forEach(p => recs.push({ type: 'place', data: p }));
    } else if (type === 'chapter') {
      const ch = CHAPTERS.find(c => c.id === id);
      if (ch && ch.characters) {
        ch.characters.filter(Boolean).forEach(name => {
          const char = CHARACTERS.find(c => c.name === name);
          if (char) recs.push({ type: 'character', data: char });
        });
      }
    } else if (type === 'place') {
      const place = PLACES.find(p => p.id === id);
      if (place && place.characters) {
        place.characters.filter(Boolean).forEach(name => {
          const char = CHARACTERS.find(c => c.name === name);
          if (char) recs.push({ type: 'character', data: char });
        });
      }
    }
    return recs.slice(0, 4);
  }

  // ==========================================
  // DETAIL OVERLAY — full-page character/place/chapter view
  // ==========================================
  function openDetail(type, data) {
    showingDetail = type;
    detailData = data;
    renderDetailOverlay();
  }

  function closeDetail() {
    showingDetail = null;
    detailData = null;
    renderContent();
    renderLayout();
    bindLayoutEvents();
  }

  function renderDetailOverlay() {
    const overlay = page.querySelector('#ositosDetailOverlay');
    if (!overlay) return;
    if (!showingDetail || !detailData) {
      overlay.classList.remove('open');
      return;
    }
    overlay.classList.add('open');

    const body = overlay.querySelector('.os-detail-body');
    if (!body) return;

    let html = '';
    const recs = getRecommendations(showingDetail, detailData.id || detailData.name);

    if (showingDetail === 'character') {
      const c = detailData;
      const fav = isFav(c.id);
      const hasImage = c.image && c.image.length > 0;
      const friendLinks = (c.friends || []).filter(hasText).map(name => {
        const friend = CHARACTERS.find(ch => ch.name === name);
        return friend
          ? `<span class="ositos-chip clickable" data-char-id="${friend.id}">${getEmojiForCharacter(friend.name)} ${escapeHtml(friend.name)}</span>`
          : `<span class="ositos-chip">${name}</span>`;
      }).join('');

      const homePlace = hasText(c.home) ? PLACES.find(p => p.name === c.home) : null;
      const homeHtml = homePlace
        ? `<span class="ositos-chip clickable" data-place-id="${homePlace.id}">${getEmojiForPlace(homePlace.name)} ${escapeHtml(homePlace.name)}</span>`
        : (hasText(c.home) ? `<span class="ositos-chip">${escapeHtml(c.home)}</span>` : '');

      // Find chapter appearances
      const appearances = CHAPTERS.filter(ch => (ch.characters || []).includes(c.name));

      html = `
        <div class="os-detail-hero" style="--char-color:${c.color}">
          <button class="os-detail-back" id="osDetailBack">${I.arrowLeft}</button>
          <button class="os-detail-fav ${fav ? 'active' : ''}" id="osDetailFav">${fav ? '❤️' : '🤍'}</button>
          <div class="os-detail-portrait">
            ${hasImage
              ? `<img src="${c.image}" alt="${escapeHtml(c.name)}" loading="lazy">`
              : `<span class="os-detail-emoji">${c.emoji}</span>`
            }
          </div>
          <h2 class="os-detail-name">${escapeHtml(c.name)}</h2>
          <span class="os-detail-badge ${c.role}">${getRoleLabel(c.role)}</span>
        </div>
        <div class="os-detail-sections">
          ${hasText(c.description) ? `<div class="os-detail-section"><h4>📝 Descripción</h4><p>${escapeHtml(c.description)}</p></div>` : ''}
          ${hasText(c.personality) ? `<div class="os-detail-section"><h4>🎭 Personalidad</h4><p>${escapeHtml(c.personality)}</p></div>` : ''}
          ${hasText(c.curiosities) ? `<div class="os-detail-section"><h4>💡 Curiosidad</h4><p>${escapeHtml(c.curiosities)}</p></div>` : ''}
          ${homeHtml ? `<div class="os-detail-section"><h4>🏠 Hogar</h4><div class="os-detail-chips">${homeHtml}</div></div>` : ''}
          ${friendLinks ? `<div class="os-detail-section"><h4>🤝 Amigos</h4><div class="os-detail-chips">${friendLinks}</div></div>` : ''}
          ${appearances.length > 0 ? `<div class="os-detail-section"><h4>📖 Apariciones</h4><div class="os-detail-chips">${appearances.map(ch => `<span class="ositos-chip clickable" data-chapter-id="${ch.id}">📖 Cap. ${ch.id}</span>`).join('')}</div></div>` : ''}
        </div>
        ${recs.length > 0 ? `
          <div class="os-detail-recs">
            <h4>Sigue explorando</h4>
            <div class="os-detail-recs-grid">${recs.map(r => recCardHTML(r)).join('')}</div>
          </div>
        ` : ''}
      `;
    } else if (showingDetail === 'chapter') {
      const ch = detailData;
      const isChFav = isFav('ch-' + ch.id);
      const prev = ch.previous ? CHAPTERS.find(c => c.id === ch.previous) : null;
      const next = ch.next ? CHAPTERS.find(c => c.id === ch.next) : null;
      const charLinks = (ch.characters || []).filter(Boolean).map(name => {
        const char = CHARACTERS.find(c => c.name === name);
        return char ? `<span class="ositos-chip clickable" data-char-id="${char.id}">${getEmojiForCharacter(char.name)} ${escapeHtml(char.name)}</span>` : '';
      }).join('');
      const placeLinks = (ch.places || []).filter(Boolean).map(name => {
        const place = PLACES.find(p => p.name === name);
        return place ? `<span class="ositos-chip clickable" data-place-id="${place.id}">${getEmojiForPlace(place.name)} ${escapeHtml(place.name)}</span>` : '';
      }).join('');

      html = `
        <div class="os-detail-hero os-detail-hero--chapter">
          <button class="os-detail-back" id="osDetailBack">${I.arrowLeft}</button>
          <button class="os-detail-fav ${isChFav ? 'active' : ''}" id="osDetailFav">${isChFav ? '❤️' : '🤍'}</button>
          <div class="os-detail-book-icon">📖</div>
          <h2 class="os-detail-name">Capítulo ${ch.id}: ${escapeHtml(ch.title)}</h2>
          <span class="os-detail-badge saga">Saga ${ch.saga}</span>
        </div>
        <div class="os-detail-sections">
          <div class="os-detail-section"><h4>📝 Resumen</h4><p>${escapeHtml(ch.summary)}</p></div>
          ${charLinks ? `<div class="os-detail-section"><h4>🧸 Personajes</h4><div class="os-detail-chips">${charLinks}</div></div>` : ''}
          ${placeLinks ? `<div class="os-detail-section"><h4>🏰 Lugares</h4><div class="os-detail-chips">${placeLinks}</div></div>` : ''}
        </div>
        <div class="os-detail-nav">
          <button ${!prev ? 'disabled' : ''} class="os-detail-nav-btn ${!prev ? 'disabled' : ''}" data-chapter-id="${prev?.id || ''}">← Anterior</button>
          <button ${!next ? 'disabled' : ''} class="os-detail-nav-btn ${!next ? 'disabled' : ''}" data-chapter-id="${next?.id || ''}">Siguiente →</button>
        </div>
        ${recs.length > 0 ? `
          <div class="os-detail-recs">
            <h4>Sigue explorando</h4>
            <div class="os-detail-recs-grid">${recs.map(r => recCardHTML(r)).join('')}</div>
          </div>
        ` : ''}
      `;
    } else if (showingDetail === 'place') {
      const p = detailData;
      const isPlFav = isFav('pl-' + p.id);
      const charLinks = (p.characters || []).filter(Boolean).map(name => {
        const char = CHARACTERS.find(c => c.name === name);
        return char ? `<span class="ositos-chip clickable" data-char-id="${char.id}">${getEmojiForCharacter(char.name)} ${escapeHtml(char.name)}</span>` : '';
      }).join('');

      html = `
        <div class="os-detail-hero os-detail-hero--place">
          <button class="os-detail-back" id="osDetailBack">${I.arrowLeft}</button>
          <button class="os-detail-fav ${isPlFav ? 'active' : ''}" id="osDetailFav">${isPlFav ? '❤️' : '🤍'}</button>
          <div class="os-detail-place-emoji">${getEmojiForPlace(p.name)}</div>
          <h2 class="os-detail-name">${escapeHtml(p.name)}</h2>
        </div>
        <div class="os-detail-sections">
          ${hasText(p.description) ? `<div class="os-detail-section"><h4>📝 Descripción</h4><p>${escapeHtml(p.description)}</p></div>` : ''}
          ${hasText(p.curiosities) ? `<div class="os-detail-section"><h4>💡 Curiosidad</h4><p>${escapeHtml(p.curiosities)}</p></div>` : ''}
          ${charLinks ? `<div class="os-detail-section"><h4>🧸 Habitantes</h4><div class="os-detail-chips">${charLinks}</div></div>` : ''}
        </div>
        ${recs.length > 0 ? `
          <div class="os-detail-recs">
            <h4>Sigue explorando</h4>
            <div class="os-detail-recs-grid">${recs.map(r => recCardHTML(r)).join('')}</div>
          </div>
        ` : ''}
      `;
    } else if (showingDetail === 'news') {
      const n = detailData;
      const charLinks = (n.relatedCharacters || []).filter(Boolean).map(name => {
        const char = CHARACTERS.find(c => c.name === name);
        return char ? `<span class="ositos-chip clickable" data-char-id="${char.id}">${getEmojiForCharacter(char.name)} ${escapeHtml(char.name)}</span>` : '';
      }).join('');
      const placeLinks = (n.relatedPlaces || []).filter(Boolean).map(name => {
        const place = PLACES.find(p => p.name === name);
        return place ? `<span class="ositos-chip clickable" data-place-id="${place.id}">${getEmojiForPlace(place.name)} ${escapeHtml(place.name)}</span>` : '';
      }).join('');

      html = `
        <div class="os-detail-hero os-detail-hero--news">
          <button class="os-detail-back" id="osDetailBack">${I.arrowLeft}</button>
          <div class="os-detail-news-icon">📰</div>
          <h2 class="os-detail-name">${escapeHtml(n.title)}</h2>
          <span class="os-detail-date">${n.date}</span>
        </div>
        <div class="os-detail-sections">
          <div class="os-detail-section"><p>${escapeHtml(n.content)}</p></div>
          ${charLinks ? `<div class="os-detail-section"><h4>🧸 Personajes</h4><div class="os-detail-chips">${charLinks}</div></div>` : ''}
          ${placeLinks ? `<div class="os-detail-section"><h4>🏰 Lugares</h4><div class="os-detail-chips">${placeLinks}</div></div>` : ''}
        </div>
      `;
    }

    body.innerHTML = html;
    bindDetailEvents();
  }

  function recCardHTML(rec) {
    if (rec.type === 'character') {
      const c = rec.data;
      return `<div class="os-recs-card" data-char-id="${c.id}"><span class="os-recs-emoji">${c.emoji}</span><span class="os-recs-label">${escapeHtml(c.name)}</span></div>`;
    } else if (rec.type === 'place') {
      const p = rec.data;
      return `<div class="os-recs-card" data-place-id="${p.id}"><span class="os-recs-emoji">${getEmojiForPlace(p.name)}</span><span class="os-recs-label">${escapeHtml(p.name)}</span></div>`;
    }
    return '';
  }

  function bindDetailEvents() {
    const overlay = page.querySelector('#ositosDetailOverlay');
    if (!overlay) return;

    // Remove previous Escape handler to avoid leaks
    if (overlay._onKey) document.removeEventListener('keydown', overlay._onKey);
    overlay._onKey = (e) => { if (e.key === 'Escape') closeDetail(); };
    document.addEventListener('keydown', overlay._onKey);

    overlay.querySelector('#osDetailBack')?.addEventListener('click', closeDetail);
    overlay.querySelector('#osDetailFav')?.addEventListener('click', () => {
      if (detailData) {
        const prefix = showingDetail === 'chapter' ? 'ch-' : showingDetail === 'place' ? 'pl-' : '';
        toggleFav(prefix + detailData.id);
      }
    });

    // Chips in detail
    overlay.querySelectorAll('.ositos-chip.clickable[data-char-id]').forEach(chip => {
      chip.addEventListener('click', () => {
        const char = CHARACTERS.find(c => c.id === chip.dataset.charId);
        if (char) openDetail('character', char);
      });
    });
    overlay.querySelectorAll('.ositos-chip.clickable[data-place-id]').forEach(chip => {
      chip.addEventListener('click', () => {
        const place = PLACES.find(p => p.id === Number(chip.dataset.placeId));
        if (place) openDetail('place', place);
      });
    });
    overlay.querySelectorAll('.ositos-chip.clickable[data-chapter-id]').forEach(chip => {
      chip.addEventListener('click', () => {
        const ch = CHAPTERS.find(c => c.id === Number(chip.dataset.chapterId));
        if (ch) openDetail('chapter', ch);
      });
    });

    // Chapter nav buttons
    overlay.querySelectorAll('.os-detail-nav-btn[data-chapter-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.chapterId);
        if (!id) return;
        const ch = CHAPTERS.find(c => c.id === id);
        if (ch) openDetail('chapter', ch);
      });
    });

    // Recommendation cards
    overlay.querySelectorAll('.os-recs-card[data-char-id]').forEach(card => {
      card.addEventListener('click', () => {
        const char = CHARACTERS.find(c => c.id === card.dataset.charId);
        if (char) openDetail('character', char);
      });
    });
    overlay.querySelectorAll('.os-recs-card[data-place-id]').forEach(card => {
      card.addEventListener('click', () => {
        const place = PLACES.find(p => p.id === Number(card.dataset.placeId));
        if (place) openDetail('place', place);
      });
    });

    // Close on Escape
    overlay._onKey = (e) => { if (e.key === 'Escape') closeDetail(); };
    document.addEventListener('keydown', overlay._onKey);
  }

  // ==========================================
  // RENDER: ENTRY SCREEN
  // ==========================================
  function renderEntryScreen() {
    const stars = [];
    for (let i = 0; i < 30; i++) {
      const left = Math.random() * 100;
      const top = Math.random() * 100;
      const delay = Math.random() * 3;
      const duration = 2 + Math.random() * 3;
      const size = 0.3 + Math.random() * 0.8;
      stars.push(`<span class="os-entry-star" aria-hidden="true" style="left:${left}%;top:${top}%;animation-delay:${delay}s;animation-duration:${duration}s;font-size:${size}rem">⭐</span>`);
    }

    return `
      <div class="os-entry-screen" id="osEntryScreen">
        <div class="os-entry-stars">${stars.join('')}</div>
        <div class="os-entry-content">
          <div class="os-entry-logo">🧸</div>
          <h2 class="os-entry-title">Ositos World</h2>
          <p class="os-entry-sub">Donde toda tu creatividad no tiene límites</p>
          <button class="os-entry-enter" id="osEntryEnter">Entrar al mundo</button>
        </div>
      </div>
    `;
  }

  // ==========================================
  // RENDER: HOME
  // ==========================================
  function renderHome() {
    const heroes = CHARACTERS.filter(c => c.role === 'heroe').length;
    const villanos = CHARACTERS.filter(c => c.role === 'villano').length;
    const aliados = CHARACTERS.filter(c => c.role === 'aliado').length;

    return `
      <div class="ositos-page-content active">
        <div class="ositos-hero-section os-hero--storybook">
          <div class="os-hero-title-wrap">
            <span class="os-hero-pretitle">Bienvenida a</span>
            <h1 class="os-hero-main-title">Ositos World</h1>
            <p class="os-hero-desc">Un pequeño universo lleno de personajes mágicos, historias por descubrir y aventuras que esperan por ti.</p>
          </div>
          <div class="ositos-hero-buttons">
            <button class="ositos-btn-primary" data-nav="historia">📖 Comenzar la aventura</button>
            <button class="ositos-btn-secondary" data-nav="personajes">🧸 Conocer personajes</button>
          </div>
        </div>

        <div class="ositos-stats">
          <div class="ositos-stat-item"><div class="ositos-stat-ring"></div><div class="ositos-stat-icon">📖</div><div class="ositos-stat-number">${CHAPTERS.length}</div><div class="ositos-stat-label">Capítulos</div></div>
          <div class="ositos-stat-item"><div class="ositos-stat-ring"></div><div class="ositos-stat-icon">🧸</div><div class="ositos-stat-number">${CHARACTERS.length}</div><div class="ositos-stat-label">Personajes</div></div>
          <div class="ositos-stat-item"><div class="ositos-stat-ring"></div><div class="ositos-stat-icon">🏰</div><div class="ositos-stat-number">${PLACES.length}</div><div class="ositos-stat-label">Lugares</div></div>
          <div class="ositos-stat-item fav"><div class="ositos-stat-ring"></div><div class="ositos-stat-icon">❤️</div><div class="ositos-stat-number">${favorites.size}</div><div class="ositos-stat-label">Favoritos</div></div>
        </div>

        <div class="ositos-featured-section">
          <div class="ositos-section-header">
            <h2 class="ositos-section-title">Personajes destacados</h2>
            <span class="ositos-orange-curl"></span>
          </div>
          <div class="ositos-featured-grid">
            ${CHARACTERS.slice(0, 4).map(c => {
              const hasImg = c.image && c.image.length > 0;
              return `
              <div class="ositos-featured-card" data-char-id="${c.id}">
                <span class="ositos-card-role ${c.role}">${getRoleLabel(c.role)}</span>
                ${hasImg
                  ? `<div class="ositos-featured-img" style="background-image:url('${c.image}')"><div class="os-featured-img-glow"></div></div>`
                  : `<div class="ositos-featured-emoji">${c.emoji}</div>`
                }
                <h3>${escapeHtml(c.name)}</h3>
              </div>`; }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // RENDER: HISTORIA — Book library
  // ==========================================
  function renderHistory() {
    const sagas = {};
    CHAPTERS.forEach(ch => {
      if (!sagas[ch.saga]) sagas[ch.saga] = [];
      sagas[ch.saga].push(ch);
    });

    let html = `
      <div class="ositos-page-content active">
        <div class="ositos-section-header">
          <h2 class="ositos-section-title">📖 Biblioteca</h2>
          <span class="ositos-orange-curl"></span>
          <p class="os-section-sub">Cada saga es un libro. Cada capítulo, una página por descubrir.</p>
        </div>
    `;

    const sagaKeys = Object.keys(sagas).sort((a, b) => a - b);
    if (sagaKeys.length === 0) {
      html += `
        <div class="ositos-empty-state">
          <span class="ositos-empty-icon">📖</span>
          <h3>La biblioteca aún está en blanco</h3>
          <p>Pronto llegarán las primeras historias de este mundo.</p>
        </div>
      `;
    } else {
      sagaKeys.forEach(sagaKey => {
        const sagaChapters = sagas[sagaKey];
        html += `
          <div class="ositos-saga-block os-saga--book">
            <div class="os-saga-cover">
              <span class="os-saga-spine">📜</span>
              <h3 class="os-saga-vol">Vol. ${sagaKey}</h3>
              <span class="os-saga-pages">${sagaChapters.length} capítulos</span>
            </div>
            <div class="os-saga-chapters">
              ${sagaChapters.map(ch => `
                <div class="os-chapter-card" data-chapter-id="${ch.id}">
                  <div class="os-chapter-page">
                    <span class="os-chapter-num">Cap. ${ch.id}</span>
                    <h4>${escapeHtml(ch.title)}</h4>
                    <p>${escapeHtml(ch.summary)}</p>
                  </div>
                  <button class="ositos-btn-sm gold" data-chapter-id="${ch.id}">📖 Leer</button>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      });
    }

    html += `</div>`;
    return html;
  }

  // ==========================================
  // RENDER: PERSONAJES
  // ==========================================
  function renderCharacters() {
    const filtered = activeFilter === 'todos'
      ? CHARACTERS
      : activeFilter === 'favoritos'
        ? CHARACTERS.filter(c => favorites.has(c.id))
        : CHARACTERS.filter(c => c.role === activeFilter);

    return `
      <div class="ositos-page-content active">
        <div class="ositos-section-header">
          <h2 class="ositos-section-title">🧸 Personajes</h2>
          <span class="ositos-orange-curl"></span>
          ${favorites.size > 0 ? `<span class="ositos-fav-count">❤️ ${favorites.size} favoritos</span>` : ''}
        </div>
        ${filtered.length === 0 ? `
          <div class="ositos-empty-state">
            <span class="ositos-empty-icon">🔍</span>
            <h3>No hay personajes</h3>
            <p>Pronto llegará más gente a este mundo.</p>
          </div>
        ` : `
          <div class="ositos-grid">
            ${filtered.map(c => {
              const hasImg = c.image && c.image.length > 0;
              return `<div class="ositos-card ${isFav(c.id) ? 'selected' : ''}" data-char-id="${c.id}">
                <button class="ositos-card-fav ${isFav(c.id) ? 'active' : ''}" data-fav-id="${c.id}" title="${isFav(c.id) ? 'Quitar favorito' : 'Añadir favorito'}">
                  ${isFav(c.id) ? '❤️' : '🤍'}
                </button>
                <span class="ositos-card-role ${c.role}">${getRoleLabel(c.role)}</span>
                <div class="ositos-card-image">
                  ${hasImg ? `<img src="${c.image}" alt="${escapeHtml(c.name)}" loading="lazy">` : `<span class="ositos-card-emoji">${c.emoji}</span>`}
                </div>
                <div class="ositos-card-name">${escapeHtml(c.name).toUpperCase()}</div>
              </div>`;
            }).join('')}
          </div>
        `}
      </div>
    `;
  }

  // ==========================================
  // RENDER: MUNDO
  // ==========================================
  function renderWorld() {
    return `
      <div class="ositos-page-content active">
        <div class="ositos-section-header">
          <h2 class="ositos-section-title">🗺️ Lugares del Mundo</h2>
          <span class="ositos-orange-curl"></span>
          <p class="os-section-sub">Cada rincón tiene su propia historia.</p>
        </div>
        ${PLACES.length ? `
          <div class="ositos-grid-3">
            ${PLACES.map(p => `
              <div class="ositos-card-home os-card--place" data-place-id="${p.id}">
                <div class="card-image"><span>${getEmojiForPlace(p.name)}</span></div>
                <h3>${escapeHtml(p.name)}</h3>
                <p>${escapeHtml(p.description)}</p>
                <button class="ositos-btn-sm" data-place-id="${p.id}">🔍 Explorar</button>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="ositos-empty-state">
            <span class="ositos-empty-icon">🗺️</span>
            <h3>Todavía no hay lugares</h3>
            <p>Cada rincón de este mundo se irá descubriendo poco a poco.</p>
          </div>
        `}
      </div>
    `;
  }

  // ==========================================
  // RENDER: NOTICIAS
  // ==========================================
  function renderNews() {
    const now = new Date();
    const weekMs = 7 * 24 * 60 * 60 * 1000;

    const withDates = NEWS.map(n => ({ ...n, dateObj: new Date(n.date) }));
    withDates.sort((a, b) => b.dateObj - a.dateObj);

    const recent = withDates.filter(n => (now - n.dateObj) < weekMs);
    const older = withDates.filter(n => (now - n.dateObj) >= weekMs);

    let html = `
      <div class="ositos-page-content active">
        <div class="ositos-section-header">
          <h2 class="ositos-section-title">📰 Periódico del Mundo</h2>
          <span class="ositos-orange-curl"></span>
          <p class="os-section-sub">Mantente al día con las últimas noticias del reino.</p>
        </div>
    `;

    if (recent.length > 0) {
      html += `
        <div class="ositos-news-block">
          <div class="ositos-news-block-header">
            <span class="ositos-news-block-icon">🆕</span>
            <h3>Noticias Recientes</h3>
            <span class="ositos-news-tag">Esta semana</span>
          </div>
          <div class="ositos-grid-3">${recent.map(n => newsCardHTML(n)).join('')}</div>
        </div>
      `;
    }

    if (older.length > 0) {
      html += `
        <div class="ositos-news-block">
          <div class="ositos-news-block-header">
            <span class="ositos-news-block-icon">📜</span>
            <h3>Noticias Anteriores</h3>
            <span class="ositos-news-tag archive">Archivo</span>
          </div>
          <div class="ositos-grid-3">${older.map(n => newsCardHTML(n)).join('')}</div>
        </div>
      `;
    }

    if (recent.length === 0 && older.length === 0) {
      html += `
        <div class="ositos-empty-state">
          <span class="ositos-empty-icon">📭</span>
          <h3>No hay noticias</h3>
          <p>Vuelve pronto para ver las últimas novedades del mundo Ositos.</p>
        </div>
      `;
    }

    html += `</div>`;
    return html;
  }

  function newsCardHTML(n) {
    return `
      <div class="ositos-card-home" data-news-id="${n.id}">
        <div class="card-image"><span>📰</span></div>
        <span class="ositos-news-date-label">${n.date}</span>
        <h3>${escapeHtml(n.title)}</h3>
        <p>${escapeHtml(n.content.substring(0, 100))}${n.content.length > 100 ? '...' : ''}</p>
        <button class="ositos-btn-sm" data-news-id="${n.id}">📰 Leer noticia</button>
      </div>
    `;
  }

  // ==========================================
  // RENDER: SEARCH RESULTS
  // ==========================================
  function renderSearchResults(results) {
    const { characters, chapters, places, news: newsResults } = results;
    const total = characters.length + chapters.length + places.length + newsResults.length;

    if (total === 0) {
      return `
        <div class="ositos-page-content active">
          <div class="ositos-empty-state">
            <span class="ositos-empty-icon">🔍</span>
            <h3>Sin resultados</h3>
            <p>No se encontró nada para "${escapeHtml(searchQuery)}".</p>
          </div>
        </div>
      `;
    }

    let html = `
      <div class="ositos-page-content active">
        <div class="ositos-section-header">
          <h2 class="ositos-section-title">🔍 Resultados</h2>
          <span class="ositos-orange-curl"></span>
          <span class="os-section-sub">${total} resultados para "${escapeHtml(searchQuery)}"</span>
        </div>
    `;

    if (characters.length > 0) {
      html += `<div class="os-search-section"><h3 class="os-search-heading">🧸 Personajes</h3><div class="ositos-grid">`;
      characters.forEach(c => {
        const hasImg = c.image && c.image.length > 0;
        html += `<div class="ositos-card" data-char-id="${c.id}">
          <span class="ositos-card-role ${c.role}">${getRoleLabel(c.role)}</span>
          <div class="ositos-card-image">
            ${hasImg ? `<img src="${c.image}" alt="${escapeHtml(c.name)}" loading="lazy">` : `<span class="ositos-card-emoji">${c.emoji}</span>`}
          </div>
          <div class="ositos-card-name">${escapeHtml(c.name).toUpperCase()}</div>
        </div>`;
      });
      html += `</div></div>`;
    }

    if (chapters.length > 0) {
      html += `<div class="os-search-section"><h3 class="os-search-heading">📖 Capítulos</h3><div class="ositos-grid-3">`;
      chapters.forEach(ch => {
        html += `<div class="ositos-card-home" data-chapter-id="${ch.id}">
          <div class="card-image"><span>📖</span></div>
          <span class="tag gold">Saga ${ch.saga}</span>
          <h3>${escapeHtml(ch.title)}</h3>
          <p>${escapeHtml(ch.summary)}</p>
        </div>`;
      });
      html += `</div></div>`;
    }

    if (places.length > 0) {
      html += `<div class="os-search-section"><h3 class="os-search-heading">🏰 Lugares</h3><div class="ositos-grid-3">`;
      places.forEach(p => {
        html += `<div class="ositos-card-home" data-place-id="${p.id}">
          <div class="card-image"><span>${getEmojiForPlace(p.name)}</span></div>
          <h3>${escapeHtml(p.name)}</h3>
          <p>${escapeHtml(p.description)}</p>
        </div>`;
      });
      html += `</div></div>`;
    }

    if (newsResults.length > 0) {
      html += `<div class="os-search-section"><h3 class="os-search-heading">📰 Noticias</h3><div class="ositos-grid-3">`;
      newsResults.forEach(n => html += newsCardHTML(n));
      html += `</div></div>`;
    }

    html += `</div>`;
    return html;
  }

  // ==========================================
  // RENDER: FAVORITES
  // ==========================================
  function renderFavorites() {
    const favChars = CHARACTERS.filter(c => favorites.has(c.id));
    const favChapters = CHAPTERS.filter(c => favorites.has(`ch-${c.id}`));
    const favPlaces = PLACES.filter(p => favorites.has(`pl-${p.id}`));

    const total = favChars.length + favChapters.length + favPlaces.length;

    if (total === 0) {
      return `
        <div class="ositos-page-content active">
          <div class="ositos-section-header">
            <h2 class="ositos-section-title">❤️ Tus Favoritos</h2>
            <span class="ositos-orange-curl"></span>
          </div>
          <div class="ositos-empty-state">
            <span class="ositos-empty-icon">💝</span>
            <h3>Aún no tienes favoritos</h3>
            <p>Marca ❤️ en personajes, lugares y capítulos para verlos aquí.</p>
          </div>
        </div>
      `;
    }

    let html = `
      <div class="ositos-page-content active">
        <div class="ositos-section-header">
          <h2 class="ositos-section-title">❤️ Tus Favoritos</h2>
          <span class="ositos-orange-curl"></span>
          <span class="os-section-sub">${total} tesoros guardados</span>
        </div>
    `;

    if (favChars.length > 0) {
      html += `<div class="os-search-section"><h3 class="os-search-heading">🧸 Personajes</h3><div class="ositos-grid">`;
      favChars.forEach(c => {
        const hasImg = c.image && c.image.length > 0;
        html += `<div class="ositos-card selected" data-char-id="${c.id}">
          <span class="ositos-card-role ${c.role}">${getRoleLabel(c.role)}</span>
          <div class="ositos-card-image">${hasImg ? `<img src="${c.image}" alt="${escapeHtml(c.name)}" loading="lazy">` : `<span class="ositos-card-emoji">${c.emoji}</span>`}</div>
          <div class="ositos-card-name">${escapeHtml(c.name).toUpperCase()}</div>
        </div>`;
      });
      html += `</div></div>`;
    }

    if (favChapters.length > 0) {
      html += `<div class="os-search-section"><h3 class="os-search-heading">📖 Capítulos</h3><div class="ositos-grid-3">`;
      favChapters.forEach(ch => {
        html += `<div class="ositos-card-home" data-chapter-id="${ch.id}">
          <div class="card-image"><span>📖</span></div>
          <span class="tag gold">Saga ${ch.saga}</span>
          <h3>${escapeHtml(ch.title)}</h3>
          <p>${escapeHtml(ch.summary)}</p>
        </div>`;
      });
      html += `</div></div>`;
    }

    if (favPlaces.length > 0) {
      html += `<div class="os-search-section"><h3 class="os-search-heading">🏰 Lugares</h3><div class="ositos-grid-3">`;
      favPlaces.forEach(p => {
        html += `<div class="ositos-card-home" data-place-id="${p.id}">
          <div class="card-image"><span>${getEmojiForPlace(p.name)}</span></div>
          <h3>${escapeHtml(p.name)}</h3>
          <p>${escapeHtml(p.description)}</p>
        </div>`;
      });
      html += `</div></div>`;
    }

    html += `</div>`;
    return html;
  }

  // ==========================================
  // UPDATE SIDEBAR FAVS
  // ==========================================
  function updateSidebarFavs() {
    const sidebar = page.querySelector('.ositos-sidebar');
    if (!sidebar) return;
    const favSection = sidebar.querySelector('.ositos-sidebar-fav');
    if (!favSection) return;

    const favItems = [...favorites].map(id => {
      const c = CHARACTERS.find(ch => ch.id === id);
      return c ? `<div class="ositos-sidebar-fav-item" data-char-id="${c.id}"><span>${c.emoji}</span><span>${escapeHtml(c.name)}</span></div>` : '';
    }).join('');

    favSection.innerHTML = `
      <div class="ositos-fav-header">${I.heartFilled}<span>FAVORITOS</span></div>
      <p class="ositos-fav-desc">Tus personajes favoritos para acceso rápido.</p>
      ${favItems ? `<div class="ositos-sidebar-fav-list">${favItems}</div>` : '<p class="ositos-fav-desc">No hay favoritos aún.</p>'}
      <button class="ositos-fav-btn" id="showFavoritesBtn">❤️ ${favorites.size > 0 ? `VER TODOS (${favorites.size})` : 'VER TODOS'}</button>
    `;

    favSection.querySelectorAll('.ositos-sidebar-fav-item').forEach(item => {
      item.addEventListener('click', () => {
        const char = CHARACTERS.find(c => c.id === item.dataset.charId);
        if (char) openDetail('character', char);
      });
    });

    favSection.querySelector('#showFavoritesBtn')?.addEventListener('click', () => {
      activeSection = 'favoritos';
      localStorage.setItem(ACTIVE_SECTION_KEY(), activeSection);
      renderLayout();
      renderContent();
      bindLayoutEvents();
    });
  }

  // ==========================================
  // UPDATE SIDEBAR COUNTERS
  // ==========================================
  function updateSidebarCounters() {
    const sidebar = page.querySelector('.ositos-sidebar');
    if (!sidebar) return;
    const counts = sidebar.querySelectorAll('.ositos-filter-count');
    if (counts.length >= 4) {
      counts[0].textContent = CHARACTERS.length;
      counts[1].textContent = CHARACTERS.filter(c => c.role === 'heroe').length;
      counts[2].textContent = CHARACTERS.filter(c => c.role === 'villano').length;
      counts[3].textContent = CHARACTERS.filter(c => c.role === 'aliado').length;
    }
  }

  // ==========================================
  // NAVIGATE
  // ==========================================
  function navigateTo(section) {
    activeSection = section;
    searchQuery = '';
    localStorage.setItem(ACTIVE_SECTION_KEY(), section);

    // Update nav links
    page.querySelectorAll('.ositos-nav-link, .ositos-mobile-nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.section === section);
    });

    // Close mobile menu
    const mobileMenu = page.querySelector('#ositosMobileMenu');
    const hamburger = page.querySelector('#ositosHamburger');
    if (mobileMenu) mobileMenu.classList.remove('open');
    if (hamburger) hamburger.classList.remove('active');
    document.body.style.overflow = '';

    // Clear search input
    const searchInput = page.querySelector('#ositosSearchInput');
    if (searchInput) searchInput.value = '';

    renderContent();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==========================================
  // RENDER CONTENT
  // ==========================================
  function renderContent() {
    const content = page.querySelector('#ositosContent');
    if (!content) return;

    let html = '';

    if (searchQuery.trim()) {
      const results = searchAll(searchQuery);
      html = renderSearchResults(results);
    } else {
      switch (activeSection) {
        case 'home': html = renderHome(); break;
        case 'historia': html = renderHistory(); break;
        case 'personajes': html = renderCharacters(); break;
        case 'mundo': html = renderWorld(); break;
        case 'noticias': html = renderNews(); break;
        case 'favoritos': html = renderFavorites(); break;
        default: html = renderHome();
      }
    }

    content.innerHTML = html;

    // Bind hero buttons
    content.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.nav));
    });

    // Bind featured cards
    content.querySelectorAll('.ositos-featured-card').forEach(card => {
      card.addEventListener('click', () => {
        const char = CHARACTERS.find(c => c.id === card.dataset.charId);
        if (char) openDetail('character', char);
      });
    });

    // Bind hero character illustrations
    content.querySelectorAll('.os-hero-char').forEach(el => {
      el.addEventListener('click', () => {
        const char = CHARACTERS.find(c => c.id === el.dataset.charId);
        if (char) openDetail('character', char);
      });
    });

    // Bind character cards
    content.querySelectorAll('.ositos-card[data-char-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.ositos-card-fav')) return;
        const char = CHARACTERS.find(c => c.id === card.dataset.charId);
        if (char) openDetail('character', char);
      });
    });

    // Bind fav buttons on cards
    content.querySelectorAll('.ositos-card-fav').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFav(btn.dataset.favId);
      });
    });

    // Bind chapter cards
    content.querySelectorAll('[data-chapter-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.ositos-card-fav')) return;
        const ch = CHAPTERS.find(c => c.id === Number(el.dataset.chapterId));
        if (ch) openDetail('chapter', ch);
      });
    });

    // Bind place cards
    content.querySelectorAll('[data-place-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.ositos-card-fav')) return;
        const place = PLACES.find(p => p.id === Number(el.dataset.placeId));
        if (place) openDetail('place', place);
      });
    });

    // Bind news cards
    content.querySelectorAll('[data-news-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.ositos-card-fav')) return;
        const newsItem = NEWS.find(n => n.id === Number(el.dataset.newsId));
        if (newsItem) openDetail('news', newsItem);
      });
    });

    // Update filter buttons active state
    page.querySelectorAll('.ositos-filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === activeFilter);
    });
  }

  // ==========================================
  // RENDER LAYOUT
  // ==========================================
  function renderLayout() {
    const heroes = CHARACTERS.filter(c => c.role === 'heroe').length;
    const villanos = CHARACTERS.filter(c => c.role === 'villano').length;
    const aliados = CHARACTERS.filter(c => c.role === 'aliado').length;

    page.innerHTML = `
      ${entryVisible ? renderEntryScreen() : ''}
      <div class="ositos-fullscreen ${entryVisible ? 'os-fullscreen--hidden' : ''}" id="ositosFullscreen">
        <div class="os-global-fireflies" id="osGlobalFireflies">${getFirefliesHTML(24)}</div>

        <header class="ositos-navbar">
          <div class="ositos-navbar-inner">
            <button class="ositos-nav-back" id="ositosBack" aria-label="Volver">${I.back}<span>Volver</span></button>
            <div class="ositos-logo">
              <div class="ositos-logo-text"><span class="ositos-logo-title">OSITOSWORLD</span> <span class="ositos-logo-heart">❤️❤️</span></div>
              <span class="ositos-logo-sub">Donde toda tu creatividad no tiene límites.</span>
            </div>
            <div class="os-nav-actions">
              <div class="os-search-wrap" id="osSearchWrap">
                <span class="os-search-icon">${I.search}</span>
                <input type="text" class="os-search-input" id="ositosSearchInput" placeholder="Buscar personajes, capítulos..." value="${escapeHtml(searchQuery)}" aria-label="Buscar personajes y capítulos">
                ${searchQuery ? '<button class="os-search-clear" id="osSearchClear">✕</button>' : ''}
              </div>
              <button class="ositos-hamburger" id="ositosHamburger" aria-label="Menú"><span></span><span></span><span></span></button>
            </div>
          </div>

          <nav class="ositos-nav-links" id="ositosNavLinks">
            <button class="ositos-nav-link ${activeSection === 'home' ? 'active' : ''}" data-section="home">${I.home}<span>INICIO</span></button>
            <button class="ositos-nav-link ${activeSection === 'historia' ? 'active' : ''}" data-section="historia">${I.book}<span>BIBLIOTECA</span></button>
            <button class="ositos-nav-link ${activeSection === 'personajes' ? 'active' : ''}" data-section="personajes">${I.users}<span>PERSONAJES</span></button>
            <button class="ositos-nav-link ${activeSection === 'mundo' ? 'active' : ''}" data-section="mundo">${I.map}<span>MUNDO</span></button>
            <button class="ositos-nav-link ${activeSection === 'noticias' ? 'active' : ''}" data-section="noticias">${I.news}<span>NOTICIAS</span></button>
            ${favorites.size > 0 ? `<button class="ositos-nav-link ${activeSection === 'favoritos' ? 'active' : ''}" data-section="favoritos">${I.heartFilled}<span>FAVORITOS</span></button>` : ''}
          </nav>

          <div class="ositos-mobile-menu" id="ositosMobileMenu">
            <button class="ositos-mobile-nav-link ${activeSection === 'home' ? 'active' : ''}" data-section="home">${I.home}<span>INICIO</span></button>
            <button class="ositos-mobile-nav-link ${activeSection === 'historia' ? 'active' : ''}" data-section="historia">${I.book}<span>BIBLIOTECA</span></button>
            <button class="ositos-mobile-nav-link ${activeSection === 'personajes' ? 'active' : ''}" data-section="personajes">${I.users}<span>PERSONAJES</span></button>
            <button class="ositos-mobile-nav-link ${activeSection === 'mundo' ? 'active' : ''}" data-section="mundo">${I.map}<span>MUNDO</span></button>
            <button class="ositos-mobile-nav-link ${activeSection === 'noticias' ? 'active' : ''}" data-section="noticias">${I.news}<span>NOTICIAS</span></button>
            ${favorites.size > 0 ? `<button class="ositos-mobile-nav-link ${activeSection === 'favoritos' ? 'active' : ''}" data-section="favoritos">${I.heartFilled}<span>FAVORITOS</span></button>` : ''}
          </div>
        </header>

        <div class="ositos-body">
          <aside class="ositos-sidebar">
            <h2 class="ositos-sidebar-title">🤍Reina🤍</h2>
            <div class="ositos-sidebar-underline">~~~~~~</div>
            <p class="ositos-sidebar-desc">Imagina tu mundo,<br>diseña a los personajes<br>y diviértete con su historia.</p>
            <p class="ositos-sidebar-desc">El límite es tu imaginación.</p>

            <nav class="ositos-sidebar-filters">
              <button class="ositos-filter-btn ${activeFilter === 'todos' ? 'active' : ''}" data-filter="todos">${I.list}<span>TODOS</span><span class="ositos-filter-count">${CHARACTERS.length}</span></button>
              <button class="ositos-filter-btn ${activeFilter === 'heroe' ? 'active' : ''}" data-filter="heroe">${I.sword}<span>HÉROES</span><span class="ositos-filter-count">${heroes}</span></button>
              <button class="ositos-filter-btn ${activeFilter === 'villano' ? 'active' : ''}" data-filter="villano">${I.skull}<span>VILLANOS</span><span class="ositos-filter-count">${villanos}</span></button>
              <button class="ositos-filter-btn ${activeFilter === 'aliado' ? 'active' : ''}" data-filter="aliado">${I.heart}<span>ALIADOS</span><span class="ositos-filter-count">${aliados}</span></button>
            </nav>

            <div class="ositos-sidebar-fav">
              <div class="ositos-fav-header">${I.heartFilled}<span>FAVORITOS</span></div>
              <p class="ositos-fav-desc">Marca tus personajes favoritos<br>para verlos rápido siempre.</p>
              <button class="ositos-fav-btn" id="showFavoritesBtn">❤️ ${favorites.size > 0 ? `FAVORITOS (${favorites.size})` : 'FAVORITOS'}</button>
            </div>

            <div class="ositos-sidebar-mascot"><span class="ositos-mascot-emoji">🧸</span></div>
          </aside>

          <section class="ositos-content" id="ositosContent"></section>
        </div>

        <footer class="ositos-footer">
          <span class="ositos-footer-text">Hecho con amor para mi princesa.</span>
          <div class="ositos-footer-social"><span class="ositos-footer-text">TE AMO</span></div>
          <span class="ositos-footer-heart">🤍</span>
        </footer>
      </div>

      <!-- Full-page detail overlay -->
      <div class="os-detail-overlay" id="ositosDetailOverlay">
        <div class="os-detail-scroll">
          <div class="os-detail-body" id="osDetailBody"></div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // BIND LAYOUT EVENTS
  // ==========================================
  function bindLayoutEvents() {
    // Entry screen
    const entryScreen = page.querySelector('#osEntryScreen');
    const entryEnter = page.querySelector('#osEntryEnter');
    const fullscreen = page.querySelector('#ositosFullscreen');

    if (entryScreen && entryEnter && fullscreen) {
      const showWorld = () => {
        entryScreen.classList.add('os-entry--fadeout');
        fullscreen.classList.remove('os-fullscreen--hidden');
        localStorage.setItem(ENTRY_SEEN_KEY(), '1');
        entryVisible = false;
        setTimeout(() => {
          if (entryScreen.parentNode) entryScreen.remove();
        }, 600);
      };
      entryEnter.addEventListener('click', showWorld);
      // Auto-dismiss after 5 seconds if user hasn't clicked
      const autoTimer = setTimeout(showWorld, 5000);
      entryEnter.addEventListener('click', () => clearTimeout(autoTimer), { once: true });
    }

    // Nav links
    page.querySelectorAll('.ositos-nav-link[data-section], .ositos-mobile-nav-link[data-section]').forEach(link => {
      link.addEventListener('click', () => {
        navigateTo(link.dataset.section);
      });
    });

    // Sidebar filters
    page.querySelectorAll('.ositos-sidebar-filters .ositos-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.filter;
        activeSection = 'personajes';
        searchQuery = '';
        localStorage.setItem(ACTIVE_SECTION_KEY(), activeSection);
        renderLayout();
        renderContent();
        bindLayoutEvents();
      });
    });

    // Hamburger
    const hamburger = page.querySelector('#ositosHamburger');
    const mobileMenu = page.querySelector('#ositosMobileMenu');
    if (hamburger) {
      hamburger.addEventListener('click', () => {
        mobileMenu?.classList.toggle('open');
        hamburger.classList.toggle('active');
        document.body.style.overflow = mobileMenu?.classList.contains('open') ? 'hidden' : '';
      });
    }

    // Back button
    page.querySelector('#ositosBack')?.addEventListener('click', () => {
      router.navigate('/');
    });

    // Search
    const searchInput = page.querySelector('#ositosSearchInput');
    const searchClear = page.querySelector('#osSearchClear');
    let searchTimeout;

    searchInput?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        searchQuery = e.target.value;
        if (searchQuery.trim()) {
          // Stay on current section but show search results
          renderContent();
        } else {
          renderContent();
        }
        // Update clear button
        const wrap = page.querySelector('#osSearchWrap');
        const existingClear = wrap?.querySelector('.os-search-clear');
        if (searchQuery.trim() && !existingClear) {
          const btn = document.createElement('button');
          btn.className = 'os-search-clear';
          btn.id = 'osSearchClear';
          btn.textContent = '✕';
          btn.addEventListener('click', () => {
            searchQuery = '';
            const si = page.querySelector('#ositosSearchInput');
            if (si) si.value = '';
            renderContent();
            btn.remove();
          });
          wrap?.appendChild(btn);
        } else if (!searchQuery.trim() && existingClear) {
          existingClear.remove();
        }
      }, 200);
    });

    searchClear?.addEventListener('click', () => {
      searchQuery = '';
      if (searchInput) searchInput.value = '';
      renderContent();
      searchClear.remove();
    });

    // Close detail overlay on click outside
    const detailOverlay = page.querySelector('#ositosDetailOverlay');
    detailOverlay?.addEventListener('click', (e) => {
      if (e.target === detailOverlay) closeDetail();
    });

    // Keyboard Escape
    if (!window.__ositos?._escapeBound) {
      if (!window.__ositos) window.__ositos = {};
      window.__ositos._escapeBound = true;
      const onKeyDown = (e) => {
        if (e.key === 'Escape') {
          if (showingDetail) closeDetail();
        }
      };
      page.cleanup = () => {
        document.removeEventListener('keydown', onKeyDown);
        if (window.__ositos) window.__ositos._escapeBound = false;
        document.body.style.overflow = '';
        delete window.__ositos;
      };
      document.addEventListener('keydown', onKeyDown);
    }

    // Update sidebar favs + counters
    updateSidebarFavs();
    updateSidebarCounters();
  }

  // ==========================================
  // INIT
  // ==========================================
  renderLayout();
  renderContent();
  bindLayoutEvents();

  return page;
}
