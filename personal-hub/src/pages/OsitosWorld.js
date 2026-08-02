/* ==========================================
   Personal Hub v2 — OsitosWorld Page
   Versión completa con capítulos, personajes,
   lugares, noticias y sistema de favoritos
   SIN navegación principal (sidebar/bottom-nav ocultos)
   ========================================== */

import { escapeHtml } from '../utils/escape.js';

// ==========================================
// DATOS COMPLETOS
// ==========================================

const CHAPTERS = [
  { id: 1, saga: 1, title: '.', summary: '.', pdfUrl: '.', previous: null, next: 2, characters: ['.', '.'], places: ['', '.'] },
];

const CHARACTERS = [
  {
    id: 'baton-gordito', name: 'Batón Gordito', role: 'heroe',
    image: 'https://res.cloudinary.com/dcsent4fs/image/upload/v1783491042/ChatGPT_Image_6_jul_2026_19_05_44-Photoroom_tsg4yb.png',
    emoji: '🧸',
    description: 'Descripción',
    personality: '.',
    curiosities: '.',
    color: '#e8a0b4', friends: ['.', '.'], home: '.'
  },
  {
    id: 'lila-y-lolo', name: 'Lili y Lolo', role: 'aliado',
    image: 'https://res.cloudinary.com/dcsent4fs/image/upload/v1783491103/ChatGPT_Image_6_jul_2026_19_05_52-Photoroom_mvhimf.png',
    emoji: '🐰',
    description: 'Descripción',
    personality: '.',
    curiosities: '.',
    color: '#a8d8ea', friends: ['.', '.'], home: '.'
  },
  {
    id: 'vaca', name: 'Vaca Lola', role: 'aliado',
    image: 'https://res.cloudinary.com/dcsent4fs/image/upload/v1783491109/ChatGPT_Image_6_jul_2026_19_06_21-Photoroom_rhv6de.png',
    emoji: '🐿️',
    description: 'Descripción',
    personality: '.',
    curiosities: '.',
    color: '#80ced6', friends: ['.', '.'], home: '.'
  },
  {
    id: 'rey-esqueleto', name: 'Rey Esqueleto', role: 'villano',
    image: 'https://res.cloudinary.com/dcsent4fs/image/upload/v1783358108/ChatGPT_Image_6_jul_2026_19_05_29-Photoroom_tnbedt.png',
    emoji: '💀',
    description: 'Descripción',
    personality: '.',
    curiosities: '.',
    color: '#6b5b95', friends: ['.'], home: '.'
  },
];

const PLACES = [
  { id: 1, name: '.', description: '.', curiosities: '.', pdfUrl: '', characters: ['.', '.', '.', '.'] },
];

const NEWS = [
  { id: 1, date: '.', title: '.', content: '.', relatedCharacters: [], relatedPlaces: [] },
];

// ==========================================
// CONSTANTES
// ==========================================

const FAVORITES_KEY = 'ositosWorld.favorites';
const ACTIVE_SECTION_KEY = 'ositosWorld.activeSection';

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
// SVG ICONS (inline, sin dependencia de Lucide)
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
};

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export function OsitosWorldPage(router) {
  const page = document.createElement('div');
  page.className = 'ositos-page';

  let activeSection = localStorage.getItem(ACTIVE_SECTION_KEY) || 'home';
  let activeFilter = 'todos';
  let favorites = new Set();

  try {
    const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    favorites = new Set(saved);
  } catch { favorites = new Set(); }

  function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
  }

  function isFav(id) { return favorites.has(id); }
  function toggleFav(id) {
    if (favorites.has(id)) favorites.delete(id);
    else favorites.add(id);
    saveFavorites();
    renderContent();
    updateSidebarFavs();
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
  }// ==========================================
// MODAL
// ==========================================
  function openModal(html) {
    const modal = page.querySelector('#ositosModal');
    const body = page.querySelector('#ositosModalBody');
    if (!modal || !body) return;
    body.innerHTML = html;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const modal = page.querySelector('#ositosModal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  // Expose modal functions globally for inline onclick handlers
  window.__ositos = window.__ositos || {};
  window.__ositos.closeModal = closeModal;
  window.__ositos.openModal = openModal;
  window.__ositos.openChapter = (id) => openChapter(id);
  window.__ositos.openCharacter = (id) => openCharacter(id);
  window.__ositos.openPlace = (id) => openPlace(id);
  window.__ositos.openNews = (id) => openNews(id);
  window.__ositos.toggleFav = (id) => toggleFav(id);

  // ==========================================
  // RENDER: HOME
  // ==========================================
  function renderHome() {
    const heroes = CHARACTERS.filter(c => c.role === 'heroe').length;
    const villanos = CHARACTERS.filter(c => c.role === 'villano').length;
    const aliados = CHARACTERS.filter(c => c.role === 'aliado').length;

    return `
      <div class="ositos-page-content active">
        <div class="ositos-hero-section">
          <span class="hero-icon">🧸</span>
          <h1>Bienvenida a <span>Ositos World</span></h1>
          <p>Un pequeño lugar lleno de aventuras, personajes curiosos y muchas historias por descubrir.</p>
          <div class="ositos-hero-buttons">
            <button class="ositos-btn-primary" data-nav="historia">📖 Empezar a leer</button>
            <button class="ositos-btn-secondary" data-nav="personajes">🧸 Conocer personajes</button>
          </div>
        </div>

        <div class="ositos-stats">
          <div class="ositos-stat-item"><div class="ositos-stat-icon">📖</div><div class="ositos-stat-number">${CHAPTERS.length}</div><div class="ositos-stat-label">Capítulos</div></div>
          <div class="ositos-stat-item"><div class="ositos-stat-icon">🧸</div><div class="ositos-stat-number">${CHARACTERS.length}</div><div class="ositos-stat-label">Personajes</div></div>
          <div class="ositos-stat-item"><div class="ositos-stat-icon">🏰</div><div class="ositos-stat-number">${PLACES.length}</div><div class="ositos-stat-label">Lugares</div></div>
          <div class="ositos-stat-item"><div class="ositos-stat-icon">❤️</div><div class="ositos-stat-number">${favorites.size}</div><div class="ositos-stat-label">Favoritos</div></div>
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
                  ? `<div class="ositos-featured-img" style="background-image:url('${c.image}')"></div>`
                  : `<div class="ositos-featured-emoji">${c.emoji}</div>`
                }
                <h3>${escapeHtml(c.name)}</h3>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // RENDER: HISTORIA
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
          <h2 class="ositos-section-title">📖 Biblioteca de Capítulos</h2>
          <span class="ositos-orange-curl"></span>
        </div>
    `;

    Object.keys(sagas).sort((a, b) => a - b).forEach(sagaKey => {
      const sagaChapters = sagas[sagaKey];
      html += `
        <div class="ositos-saga-block">
          <div class="ositos-saga-header">
            <span class="ositos-saga-icon">📜</span>
            <h3 class="ositos-saga-title">Ositos World ${sagaKey}</h3>
            <span class="ositos-saga-count">${sagaChapters.length} capítulos</span>
          </div>
          <div class="ositos-grid-3">
            ${sagaChapters.map(ch => `
              <div class="ositos-card-home" onclick="__ositos.openChapter(${ch.id})">
                <div class="card-image"><span>📖</span></div>
                <span class="tag">Capítulo ${ch.id}</span>
                <h3>${escapeHtml(ch.title)}</h3>
                <p>${escapeHtml(ch.summary)}</p>
                <button class="ositos-btn-sm gold" onclick="event.stopPropagation();__ositos.openChapter(${ch.id})">📖 Leer capítulo</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });

    html += `</div>`;
    return html;
  }

  function openChapter(id) {
    const ch = CHAPTERS.find(c => c.id === id);
    if (!ch) return;

    const prev = ch.previous ? CHAPTERS.find(c => c.id === ch.previous) : null;
    const next = ch.next ? CHAPTERS.find(c => c.id === ch.next) : null;

    const charLinks = (ch.characters || []).filter(Boolean).map(name => {
      const char = CHARACTERS.find(c => c.name === name);
      return char ? `<span class="ositos-chip clickable" onclick="__ositos.closeModal();__ositos.openCharacter(${char.id})">${getEmojiForCharacter(char.name)} ${escapeHtml(name)}</span>` : `<span class="ositos-chip">${name}</span>`;
    }).join('');

    const placeLinks = (ch.places || []).filter(Boolean).map(name => {
      const place = PLACES.find(p => p.name === name);
      return place ? `<span class="ositos-chip clickable" onclick="__ositos.closeModal();__ositos.openPlace(${place.id})">${getEmojiForPlace(place.name)} ${escapeHtml(name)}</span>` : `<span class="ositos-chip">${name}</span>`;
    }).join('');

    const html = `
      <div class="ositos-modal-image"><span>📖</span></div>
      <h2 class="ositos-modal-name">Capítulo ${ch.id}: ${escapeHtml(ch.title)}</h2>
      ${charLinks ? `<div class="ositos-modal-section"><h4>🧸 Personajes</h4><div>${charLinks}</div></div>` : ''}
      ${placeLinks ? `<div class="ositos-modal-section"><h4>🏰 Lugares</h4><div>${placeLinks}</div></div>` : ''}
      <div class="ositos-modal-nav">
        <button ${!prev ? 'disabled' : ''} class="ositos-modal-nav-btn ${prev ? '' : 'disabled'}" onclick="          ${prev ? `__ositos.closeModal();__ositos.openChapter(${prev.id})` : ''}">← Anterior</button>
        <button ${!next ? 'disabled' : ''} class="ositos-modal-nav-btn ${next ? '' : 'disabled'}" onclick="          ${next ? `__ositos.closeModal();__ositos.openChapter(${next.id})` : ''}">Siguiente →</button>
      </div>
    `;
    openModal(html);
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
              return `<div class="ositos-card ${isFav(c.id) ? 'selected' : ''}" onclick="__ositos.openCharacter('${c.id}')">
                <button class="ositos-card-fav ${isFav(c.id) ? 'active' : ''}" onclick="event.stopPropagation();__ositos.toggleFav('${c.id}')" title="${isFav(c.id) ? 'Quitar favorito' : 'Añadir favorito'}">
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

  function openCharacter(id) {
    const char = CHARACTERS.find(c => c.id === id);
    if (!char) return;

    const fav = isFav(char.id);
    const hasImage = char.image && char.image.length > 0;

    const friendLinks = (char.friends || []).filter(Boolean).map(name => {
      const friend = CHARACTERS.find(c => c.name === name);
      return friend ? `<span class="ositos-chip clickable" onclick="__ositos.closeModal();__ositos.openCharacter('${friend.id}')">${getEmojiForCharacter(friend.name)} ${escapeHtml(friend.name)}</span>` : `<span class="ositos-chip">${name}</span>`;
    }).join('');

    const homePlace = char.home ? PLACES.find(p => p.name === char.home) : null;
    const homeHtml = homePlace
      ? `<span class="ositos-chip clickable" onclick="__ositos.closeModal();__ositos.openPlace('${homePlace.id}')">${getEmojiForPlace(homePlace.name)} ${escapeHtml(homePlace.name)}</span>`
      : (char.home ? `<span class="ositos-chip">${escapeHtml(char.home)}</span>` : '');

    const html = `
      <div style="display:flex;justify-content:space-between;align-items:center;width:100%;margin-bottom:4px;">
        <div></div>
        <button class="ositos-modal-fav-toggle" onclick="__ositos.toggleFav('${char.id}')" title="${fav ? 'Quitar favorito' : 'Añadir favorito'}">${fav ? '❤️' : '🤍'}</button>
      </div>
      <div class="ositos-modal-image" style="aspect-ratio:1/1;max-width:180px;border-radius:50%;margin:0 auto;">
        ${hasImage
          ? `<img src="${char.image}" alt="${escapeHtml(char.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
          : `<span style="font-size:4rem;">${char.emoji}</span>`
        }
      </div>
      <h2 class="ositos-modal-name">${escapeHtml(char.name)}</h2>
      <span class="ositos-modal-role ${char.role}">${getRoleLabel(char.role)}</span>
      <div class="ositos-modal-details">
        ${char.description ? `<p><strong>Descripción:</strong> ${escapeHtml(char.description)}</p>` : ''}
        ${char.personality ? `<p><strong>Personalidad:</strong> ${escapeHtml(char.personality)}</p>` : ''}
        ${char.curiosities ? `<p><strong>Curiosidad:</strong> ${escapeHtml(char.curiosities)}</p>` : ''}
      </div>
      ${homeHtml ? `<div class="ositos-modal-section"><h4>🏠 Hogar</h4><div>${homeHtml}</div></div>` : ''}
      ${friendLinks ? `<div class="ositos-modal-section"><h4>🤝 Amigos</h4><div>${friendLinks}</div></div>` : ''}
    `;
    openModal(html);
  }

  // ==========================================
  // RENDER: MUNDO
  // ==========================================
  function renderWorld() {
    return `
      <div class="ositos-page-content active">
        <div class="ositos-section-header">
          <h2 class="ositos-section-title">🏰 Lugares del Mundo</h2>
          <span class="ositos-orange-curl"></span>
        </div>
        <div class="ositos-grid-3">
          ${PLACES.map(p => `
            <div class="ositos-card-home" onclick="__ositos.openPlace(${p.id})">
              <div class="card-image"><span>${getEmojiForPlace(p.name)}</span></div>
              <h3>${escapeHtml(p.name)}</h3>
              <p>${escapeHtml(p.description)}</p>
              <button class="ositos-btn-sm" onclick="event.stopPropagation();__ositos.openPlace(${p.id})">🔍 Explorar</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function openPlace(id) {
    const place = PLACES.find(p => p.id === id);
    if (!place) return;

    const charLinks = (place.characters || []).filter(Boolean).map(name => {
      const char = CHARACTERS.find(c => c.name === name);
      return char ? `<span class="ositos-chip clickable" onclick="__ositos.closeModal();__ositos.openCharacter(${char.id})">${getEmojiForCharacter(char.name)} ${escapeHtml(char.name)}</span>` : `<span class="ositos-chip">${name}</span>`;
    }).join('');

    const html = `
      <div class="ositos-modal-image"><span style="font-size:4rem;">${getEmojiForPlace(place.name)}</span></div>
      <h2 class="ositos-modal-name">${escapeHtml(place.name)}</h2>
      <div class="ositos-modal-details">
        <p>${escapeHtml(place.description)}</p>
        ${place.curiosities ? `<p><strong>Curiosidad:</strong> ${escapeHtml(place.curiosities)}</p>` : ''}
      </div>
      ${charLinks ? `<div class="ositos-modal-section"><h4>🧸 Personajes que viven aquí</h4><div>${charLinks}</div></div>` : ''}
    `;
    openModal(html);
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
      <div class="ositos-card-home" onclick="__ositos.openNews(${n.id})">
        <div class="card-image"><span>📰</span></div>
        <span class="ositos-news-date-label">${n.date}</span>
        <h3>${n.title}</h3>
        <p>${n.content.substring(0, 100)}${n.content.length > 100 ? '...' : ''}</p>
        <button class="ositos-btn-sm" onclick="event.stopPropagation();__ositos.openNews(${n.id})">📰 Leer noticia</button>
      </div>
    `;
  }

  function openNews(id) {
    const item = NEWS.find(n => n.id === id);
    if (!item) return;

    const charLinks = (item.relatedCharacters || []).filter(Boolean).map(name => {
      const char = CHARACTERS.find(c => c.name === name);
      return char ? `<span class="ositos-chip clickable" onclick="__ositos.closeModal();__ositos.openCharacter(${char.id})">${getEmojiForCharacter(char.name)} ${escapeHtml(char.name)}</span>` : `<span class="ositos-chip">${name}</span>`;
    }).join('');

    const placeLinks = (item.relatedPlaces || []).filter(Boolean).map(name => {
      const place = PLACES.find(p => p.name === name);
      return place ? `<span class="ositos-chip clickable" onclick="__ositos.closeModal();__ositos.openPlace(${place.id})">${getEmojiForPlace(place.name)} ${escapeHtml(place.name)}</span>` : `<span class="ositos-chip">${name}</span>`;
    }).join('');

    const html = `
      <div class="ositos-modal-image"><span style="font-size:3rem;">📰</span></div>
      <h2 class="ositos-modal-name">${item.title}</h2>
      <div class="ositos-modal-date">${item.date}</div>
      <div class="ositos-modal-details">${item.content}</div>
      ${charLinks ? `<div class="ositos-modal-section"><h4>🧸 Personajes</h4><div>${charLinks}</div></div>` : ''}
      ${placeLinks ? `<div class="ositos-modal-section"><h4>🏰 Lugares</h4><div>${placeLinks}</div></div>` : ''}
    `;
    openModal(html);
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
      <div class="ositos-fav-header">${I.heartFilled}<span>FAVORITO</span></div>
      <p class="ositos-fav-desc">Marca tus personajes favoritos para verlos rápido siempre.</p>
      ${favItems ? `<div class="ositos-sidebar-fav-list">${favItems}</div>` : '<p class="ositos-fav-desc">No hay favoritos aún.</p>'}
      <button class="ositos-fav-btn" id="showFavoritesBtn">❤️ ${favorites.size > 0 ? `FAVORITOS (${favorites.size})` : 'FAVORITOS'}</button>
    `;

    favSection.querySelectorAll('.ositos-sidebar-fav-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.charId;
        const char = CHARACTERS.find(c => c.id === id);
        if (char) openCharacter(id);
      });
    });

    favSection.querySelector('#showFavoritesBtn')?.addEventListener('click', () => {
      activeSection = 'personajes';
      activeFilter = 'favoritos';
      localStorage.setItem(ACTIVE_SECTION_KEY, activeSection);
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
    localStorage.setItem(ACTIVE_SECTION_KEY, section);

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
    switch (activeSection) {
      case 'home': html = renderHome(); break;
      case 'historia': html = renderHistory(); break;
      case 'personajes': html = renderCharacters(); break;
      case 'mundo': html = renderWorld(); break;
      case 'noticias': html = renderNews(); break;
      default: html = renderHome();
    }

    content.innerHTML = html;

    // Expose helper functions on content for onclick handlers
    content.__openChapter = openChapter;
    content.__openCharacter = openCharacter;
    content.__openPlace = openPlace;
    content.__openNews = openNews;
    content.__toggleFav = (id) => toggleFav(id);

    // Bind hero section buttons
    content.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.nav));
    });

    // Bind featured cards
    content.querySelectorAll('.ositos-featured-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.charId;
        const char = CHARACTERS.find(c => c.id === id);
        if (char) openCharacter(id);
      });
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
      <div class="ositos-fullscreen">
        <header class="ositos-navbar">
          <div class="ositos-navbar-inner">
            <button class="ositos-nav-back" id="ositosBack" aria-label="Volver">${I.back}<span>Volver</span></button>
            <div class="ositos-logo">
              <div class="ositos-logo-text"><span class="ositos-logo-title">OSITOSWORLD</span> <span class="ositos-logo-heart">❤️❤️</span></div>
              <span class="ositos-logo-sub">Donde toda tu creatividad no tiene límites.</span>
            </div>
            <button class="ositos-hamburger" id="ositosHamburger" aria-label="Menú"><span></span><span></span><span></span></button>
          </div>

          <nav class="ositos-nav-links" id="ositosNavLinks">
            <button class="ositos-nav-link ${activeSection === 'home' ? 'active' : ''}" data-section="home">${I.home}<span>INICIO</span></button>
            <button class="ositos-nav-link ${activeSection === 'historia' ? 'active' : ''}" data-section="historia">${I.book}<span>HISTORIA</span></button>
            <button class="ositos-nav-link ${activeSection === 'personajes' ? 'active' : ''}" data-section="personajes">${I.users}<span>PERSONAJES</span></button>
            <button class="ositos-nav-link ${activeSection === 'mundo' ? 'active' : ''}" data-section="mundo">${I.map}<span>MUNDO</span></button>
            <button class="ositos-nav-link ${activeSection === 'noticias' ? 'active' : ''}" data-section="noticias">${I.news}<span>NOTICIAS</span></button>
          </nav>

          <div class="ositos-mobile-menu" id="ositosMobileMenu">
            <button class="ositos-mobile-nav-link ${activeSection === 'home' ? 'active' : ''}" data-section="home">${I.home}<span>INICIO</span></button>
            <button class="ositos-mobile-nav-link ${activeSection === 'historia' ? 'active' : ''}" data-section="historia">${I.book}<span>HISTORIA</span></button>
            <button class="ositos-mobile-nav-link ${activeSection === 'personajes' ? 'active' : ''}" data-section="personajes">${I.users}<span>PERSONAJES</span></button>
            <button class="ositos-mobile-nav-link ${activeSection === 'mundo' ? 'active' : ''}" data-section="mundo">${I.map}<span>MUNDO</span></button>
            <button class="ositos-mobile-nav-link ${activeSection === 'noticias' ? 'active' : ''}" data-section="noticias">${I.news}<span>NOTICIAS</span></button>
          </div>
        </header>

        <div class="ositos-body">
          <aside class="ositos-sidebar">
            <h2 class="ositos-sidebar-title">🤍Reina🤍</h2>
            <div class="ositos-sidebar-underline">~~~~~~</div>
            <p class="ositos-sidebar-desc">Imagina tu mundo,<br>diseña a los personajes<br>y diviertete con su historia.</p>
            <p class="ositos-sidebar-desc">El límite es tu imaginación.</p>

            <nav class="ositos-sidebar-filters">
              <button class="ositos-filter-btn ${activeFilter === 'todos' ? 'active' : ''}" data-filter="todos">${I.list}<span>TODOS</span><span class="ositos-filter-count">${CHARACTERS.length}</span></button>
              <button class="ositos-filter-btn ${activeFilter === 'heroe' ? 'active' : ''}" data-filter="heroe">${I.sword}<span>HÉROES</span><span class="ositos-filter-count">${heroes}</span></button>
              <button class="ositos-filter-btn ${activeFilter === 'villano' ? 'active' : ''}" data-filter="villano">${I.skull}<span>VILLANOS</span><span class="ositos-filter-count">${villanos}</span></button>
              <button class="ositos-filter-btn ${activeFilter === 'aliado' ? 'active' : ''}" data-filter="aliado">${I.heart}<span>ALIADOS</span><span class="ositos-filter-count">${aliados}</span></button>
            </nav>

            <div class="ositos-sidebar-fav">
              <div class="ositos-fav-header">${I.heartFilled}<span>FAVORITO</span></div>
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

      <div class="ositos-modal" id="ositosModal">
        <div class="ositos-modal-content">
          <button class="ositos-modal-close" id="ositosModalClose">${I.close}</button>
          <div class="ositos-modal-body" id="ositosModalBody"></div>
        </div>
      </div>
    `;

    // Expose modal toggle fav globally for inline onclick (legacy compatibility)
    window.toggleFavInModal = (id) => {
      toggleFav(id);
      closeModal();
      const char = CHARACTERS.find(c => c.id === id);
      if (char) openCharacter(id);
    };
    window.__ositos.toggleFavInModal = window.toggleFavInModal;
  }

  // ==========================================
  // BIND LAYOUT EVENTS
  // ==========================================
  function bindLayoutEvents() {
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
        localStorage.setItem(ACTIVE_SECTION_KEY, activeSection);
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

    // Modal
    const modal = page.querySelector('#ositosModal');
    const modalClose = page.querySelector('#ositosModalClose');
    modalClose?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // Keyboard Escape (bound once)
    if (!window.__ositos._escapeBound) {
      window.__ositos._escapeBound = true;
      const onKeyDown = (e) => { if (e.key === 'Escape') closeModal(); };
      page.cleanup = () => {
        document.removeEventListener('keydown', onKeyDown);
        window.__ositos._escapeBound = false;
        document.body.style.overflow = '';
        // Libera el puente global para no retener closures de esta página
        delete window.toggleFavInModal;
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
