/* ==========================================
   Personal Hub v2 — Rincón Page
   Hub: Bienvenida + tarjetas de navegación
   Secciones internas: Galería+Memes, Curiosidades
   Secciones externas: Juegos, Canciones, ThoseEyes, Series
   ========================================== */

import { GALLERY_FOLDERS, MEME_FOLDERS, SPB_DATA, CURIOSIDADES_DATA, isVideo, buildMediaItems, getVideoPoster } from '../services/rincon-data.js';
import { createLightbox, openLightbox } from '../components/MediaLightbox.js';

// ==========================================
// STATE
// ==========================================
const state = {
  view: 'landing', // 'landing' | 'galeria-memes' | 'curiosidades'
  galeriaFolder: Object.keys(GALLERY_FOLDERS)[0] || 'Atardeceres',
  memeFolder: Object.keys(MEME_FOLDERS)[0] || 'Gatos',
  renderToken: 0,
  curiosidadTab: 'spb' // 'spb' | 'sanpetersburgo' | 'gatos'
};

const BATCH = 12;

const SECTIONS = [
  {
    id: 'galeria-memes',
    icon: 'image',
    title: 'Galería y Memes',
    desc: 'Atardeceres, gatos, memes y videos graciosos.',
    color: '#d4a574',
    internal: true
  },
  {
    id: 'juegos',
    icon: 'gamepad-2',
    title: 'Juegos',
    desc: 'Snake, ahorcado, memoria y más.',
    color: '#7eb8e0',
    href: '/juegos'
  },
  {
    id: 'curiosidades',
    icon: 'globe',
    title: 'Curiosidades',
    desc: 'San Juan Pueblo, San Petersburgo y datos gatunos.',
    color: '#6bcb9e',
    internal: true
  },
  {
    id: 'canciones',
    icon: 'music',
    title: 'Canciones',
    desc: 'Las canciones que me recuerdan a ti.',
    color: '#e8a0c8',
    href: '/canciones'
  },
  {
    id: 'thoseeyes',
    icon: 'eye',
    title: 'Those Eyes',
    desc: 'Esa canción que es simplemente especial.',
    color: '#a78bfa',
    href: '/thoseeyes'
  },
  {
    id: 'series',
    icon: 'tv',
    title: 'Series',
    desc: 'Seguimiento de series y películas.',
    color: '#f0b060',
    href: '/series'
  }
];

// Icon SVG map for Lucide icons
const ICON_SVGS = {
  'image': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  'gamepad-2': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="6 11 6 8 3 8"/><path d="M15.5 12a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"/><path d="M8.5 12a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"/><path d="M12 2a4 4 0 0 1 4 4v1H8V6a4 4 0 0 1 4-4Z"/><path d="M2 17v3a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-3"/></svg>',
  'globe': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  'music': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  'eye': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  'tv': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>',
  'crown': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M2 20h20"/></svg>',
  'chevron-right': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>',
  'chevron-left': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>',
  'eye-open': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  'play': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  'landmark': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  'ship': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.5 0 2.5 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.38 11.38 0 0 0 21 12l-8.19-2.47a2.38 2.38 0 0 0-1.62 0L3 12a11.38 11.38 0 0 0 1.62 8M12 2v10"/></svg>',
  'cat': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3.1-9-6.56c0-1.2.43-2.37 1-3.44 0 0-1.82-6.42-.42-7 1.4-.58 4.64.26 6.42 2.26.65-.17 1.33-.26 2-.26z"/><path d="M8 14v.5"/><path d="M16 14v.5"/><path d="M11.25 16.25h1.5L12 17l-.75-.75z"/></svg>',
  'mountain': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>',
  'calendar-days': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  'users': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  'wind': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>',
  'flame': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
  'message-square': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  'sun': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  'palette': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="13.5" cy="6.5" r="0.5" fill="currentColor"/><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor"/><circle cx="8.5" cy="7.5" r="0.5" fill="currentColor"/><circle cx="6.5" cy="12.5" r="0.5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-1 0-.82.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-5.5-4.5-10-10-10z"/></svg>',
  'train': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="14" rx="2"/><path d="M3 12h18"/><path d="M9 3v10"/><path d="M15 3v10"/><path d="M7 21l2-4"/><path d="M17 21l-2-4"/></svg>',
  'snowflake': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="2" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="19.78" y2="19.78"/><line x1="4.22" y1="19.78" x2="19.78" y2="4.22"/></svg>',
  'moon': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
  'heart': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  'sparkles': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3a6 6 0 0 0 9 9 6 6 0 1 0-9-9Z"/><path d="M20 12v6"/><path d="M17 15h-3"/><path d="M14 3v6"/><path d="M6.5 17.5 3 21"/><path d="M5 12H2"/><path d="M8 8V5"/></svg>',
  'soccer-ball': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 2v20"/><path d="M2 12h20"/><path d="m7 5 8 14"/><path d="m17 5-8 14"/><path d="m5 7 14 10"/><path d="m5 17 14-10"/></svg>',
  'ear': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 5-4 7-4 7"/><path d="M15 15.5a3.5 3.5 0 1 1-7 0"/><path d="M12 22v-4"/></svg>',
  'tooth': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 5.5C10.5 3 7 3 5 5s-1.5 6 1 9c1.5 1.5 3 4 5 7 2-3 4-5.5 5.5-7 2.5-3 3-7 1-9s-5.5-2.5-7 0z"/></svg>',
  'footprints': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 16v-2.5a2.5 2.5 0 0 1 5 0V16"/><path d="M10 16v-2.5a2.5 2.5 0 0 1 5 0V16"/><path d="M4 20v-1.5"/><path d="M10 20v-1.5"/><path d="M16 19.5V16a2.5 2.5 0 0 1 5 0v3.5"/><path d="M6 11V6a3 3 0 0 1 6 0v5"/><path d="M12 11V6a3 3 0 0 1 6 0v5"/></svg>',
  'baby': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M12 2a4 4 0 0 1 3.464 6"/><path d="M19 9c1.5 1.5 3 3.5 3 6a10 10 0 0 1-20 0c0-2.5 1.5-4.5 3-6"/></svg>',
  'folder': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  'smile': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
  'map-pin': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  'history': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  'utensils-crossed': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 2v10.5M18 2v10.5M3 5.5C3 3.57 4.57 2 6.5 2S10 3.57 10 5.5V8H3V5.5z"/><path d="M3 12h14v2c0 2.21-1.79 4-4 4H7c-2.21 0-4-1.79-4-4v-2z"/></svg>',
  'camera': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>'
};

// ==========================================
// MAIN PAGE
// ==========================================

export function RinconPage(router) {
  createLightbox();

  const page = document.createElement('div');
  page.className = 'rincon-page';

  // Reset state on each mount
  state.view = 'landing';
  state.curiosidadTab = 'spb';

  // ===== RENDER =====
  function render() {
    switch (state.view) {
      case 'galeria-memes':
        renderGaleriaMemes();
        break;
      case 'curiosidades':
        renderCuriosidades();
        break;
      default:
        renderLanding();
    }
  }

  // ==========================================
  // 1. LANDING — Bienvenida + Tarjetas
  // ==========================================
  function renderLanding() {
    const daysSince = Math.floor((Date.now() - new Date('2025-07-03').getTime()) / 86400000);

    page.innerHTML = `
      <!-- Hero / Bienvenida -->
      <div class="rincon-hero glass-card">
        <div class="rincon-hero-inner">
          <div class="rincon-avatar-wrap">
            <span class="rincon-avatar">${ICON_SVGS['crown']}</span>
          </div>
          <h2>Tu Rincón Favorito</h2>
          <p class="text-muted">Tu espacio especial con todo lo que te gusta.</p>
          <div class="rincon-day-counter">
            <span class="rincon-day-heart">${ICON_SVGS['eye']}</span>
            <span class="rincon-day-num">${daysSince}</span>
            <span class="rincon-day-label">días juntos</span>
          </div>
        </div>
      </div>

      <!-- Grid de tarjetas -->
      <div class="rincon-sections-grid">
        ${SECTIONS.map(section => `
          <button class="rincon-section-card glass-card" data-section="${section.id}" ${section.href ? `data-href="${section.href}"` : ''} style="--card-accent: ${section.color}">
            <div class="rsc-icon">${ICON_SVGS[section.icon] || ''}</div>
            <div class="rsc-body">
              <h3 class="rsc-title">${section.title}</h3>
              <p class="rsc-desc">${section.desc}</p>
            </div>
            <div class="rsc-arrow">
              ${ICON_SVGS['chevron-right']}
            </div>
          </button>
        `).join('')}
      </div>
    `;

    // Bind section card clicks
    page.querySelectorAll('.rincon-section-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.section;
        const section = SECTIONS.find(s => s.id === id);
        if (!section) return;

        if (section.internal) {
          state.view = id;
          render();
        } else if (section.href) {
          router.navigate(section.href);
        }
      });
    });
  }

  // ==========================================
  // 2. GALERÍA + MEMES (combinados)
  // ==========================================
  function renderGaleriaMemes() {
    page.innerHTML = `
      <div class="rincon-subpage">
        <button class="rincon-back-btn" data-back="landing">
          ${ICON_SVGS['chevron-left']}
          Volver al Rincón
        </button>

        <nav class="rincon-subnav">
          <button class="rincon-subnav__btn active" data-sub="galeria">
            <span style="width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;">${ICON_SVGS['image']}</span> Galería
          </button>
          <button class="rincon-subnav__btn" data-sub="memes">
            <span style="width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;">${ICON_SVGS['smile']}</span> Memes
          </button>
        </nav>

        <div class="rinco-section glass-card" id="galeriaMemesContent">
          ${renderGaleriaContent()}
        </div>
      </div>
    `;

    // Back button
    page.querySelector('[data-back="landing"]').addEventListener('click', () => {
      state.view = 'landing';
      render();
    });

    // Sub-nav tabs
    page.querySelectorAll('.rincon-subnav__btn').forEach(btn => {
      btn.addEventListener('click', () => {
        page.querySelectorAll('.rincon-subnav__btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const sub = btn.dataset.sub;
        const content = document.getElementById('galeriaMemesContent');
        if (sub === 'galeria') {
          content.innerHTML = renderGaleriaContent();
          bindGaleriaEvents(content);
        } else {
          content.innerHTML = renderMemesContent();
          bindMemesEvents(content);
        }
      });
    });

    bindGaleriaEvents(page.querySelector('#galeriaMemesContent'));
  }

  function renderGaleriaContent() {
    const folders = Object.keys(GALLERY_FOLDERS);
    return `
      <h3><i data-lucide="image" style="width:18px;height:18px;vertical-align:middle;"></i> Cielos y Atardeceres</h3>
      <nav class="rincon-folders">${folders.map(f =>
        `<button class="folder-btn${f === state.galeriaFolder ? ' active' : ''}" data-folder="${f}"><i data-lucide="folder" style="width:14px;height:14px;"></i> ${f} <span class="folder-count">${GALLERY_FOLDERS[f].length}</span></button>`
      ).join('')}</nav>
      <div class="rincon-grid gallery-grid" id="galeriaGrid"></div>
    `;
  }

  function renderMemesContent() {
    const folders = Object.keys(MEME_FOLDERS);
    if (!folders.includes(state.memeFolder)) state.memeFolder = folders[0];
    return `
      <h3><i data-lucide="smile" style="width:18px;height:18px;vertical-align:middle;"></i> Memes y Videos</h3>
      <p class="text-muted" style="margin-bottom:12px">Elige una carpeta y disfruta.</p>
      <nav class="rincon-folders">${folders.map(f =>
        `<button class="folder-btn${f === state.memeFolder ? ' active' : ''}" data-folder="${f}"><i data-lucide="folder" style="width:14px;height:14px;"></i> ${f} <span class="folder-count">${MEME_FOLDERS[f].length}</span></button>`
      ).join('')}</nav>
      <div class="rincon-grid" id="memesGrid"></div>
    `;
  }

  function _renderLucideIcons(root) {
    if (!root) return;
    root.querySelectorAll('[data-lucide]').forEach(el => {
      const icon = el.getAttribute('data-lucide');
      const svg = ICON_SVGS[icon];
      if (svg) {
        const wrapper = document.createElement('span');
        wrapper.innerHTML = svg;
        el.replaceWith(wrapper.firstElementChild);
      }
    });
  }

  function bindGaleriaEvents(container) {
    if (!container) return;
    _renderLucideIcons(container);

    container.querySelectorAll('.folder-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.folder-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.galeriaFolder = btn.dataset.folder;
        const grid = document.getElementById('galeriaGrid');
        if (!grid) return;
        renderGalleryGrid(grid);
      });
    });

    const grid = document.getElementById('galeriaGrid');
    if (grid) renderGalleryGrid(grid);
  }

  function bindMemesEvents(container) {
    if (!container) return;
    _renderLucideIcons(container);

    container.querySelectorAll('.folder-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.folder-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.memeFolder = btn.dataset.folder;
        const grid = document.getElementById('memesGrid');
        if (!grid) return;
        renderMemeGrid(grid);
      });
    });

    const grid = document.getElementById('memesGrid');
    if (grid) renderMemeGrid(grid);
  }

  function renderGalleryGrid(grid) {
    // Eliminar listener delegado anterior para evitar fugas
    if (grid._galHandler) grid.removeEventListener('click', grid._galHandler);

    const items = GALLERY_FOLDERS[state.galeriaFolder] || [];
    if (!items.length) { grid.innerHTML = '<div class="empty-state">No hay fotos en esta carpeta</div>'; return; }

    const mediaItems = buildMediaItems(items, state.galeriaFolder);
    const token = ++state.renderToken;
    grid.innerHTML = '';

    // Event delegation: maneja clicks de TODOS los items (presentes y futuros)
    grid._galHandler = (e) => {
      const item = e.target.closest('.grid-item');
      if (item) {
        openLightbox(mediaItems, Number(item.dataset.index));
      }
    };
    grid.addEventListener('click', grid._galHandler);

    function append(start) {
      if (token !== state.renderToken) return;
      const batch = items.slice(start, start + BATCH);
      if (!batch.length) return;
      grid.insertAdjacentHTML('beforeend', batch.map((src, i) => {
        const idx = start + i;
        return `<article class="grid-item" data-index="${idx}">
          <img src="${src}" alt="Foto ${idx + 1}" loading="lazy" decoding="async">
          <div class="grid-item-overlay">${ICON_SVGS['eye-open']}</div>
        </article>`;
      }).join(''));
      if (start + BATCH < items.length) setTimeout(() => append(start + BATCH), 60);
    }
    append(0);
  }

  function renderMemeGrid(grid) {
    // Eliminar listener delegado anterior para evitar fugas
    if (grid._memeHandler) grid.removeEventListener('click', grid._memeHandler);

    const items = MEME_FOLDERS[state.memeFolder] || [];
    if (!items.length) { grid.innerHTML = '<div class="empty-state">No hay memes en esta carpeta</div>'; return; }

    const mediaItems = buildMediaItems(items, state.memeFolder);
    grid.innerHTML = items.map((src, i) => {
      const video = isVideo(src);
      const poster = video ? getVideoPoster(src) : src;
      return `<article class="grid-item" data-index="${i}">
        <img src="${poster}" alt="Meme ${i + 1}" loading="lazy">
        <div class="grid-item-overlay">${video ? ICON_SVGS['play'] : ICON_SVGS['eye-open']}</div>
      </article>`;
    }).join('');

    // Event delegation (guardamos referencia para poder limpiar)
    grid._memeHandler = (e) => {
      const item = e.target.closest('.grid-item');
      if (item) {
        openLightbox(mediaItems, Number(item.dataset.index));
      }
    };
    grid.addEventListener('click', grid._memeHandler);
  }

  // ==========================================
  // 3. CURIOSIDADES
  // ==========================================
  function renderCuriosidades() {
    const tabs = [
      { id: 'spb', icon: 'landmark', label: 'San Juan Pueblo' },
      { id: 'sanpetersburgo', icon: 'ship', label: 'San Petersburgo' },
      { id: 'gatos', icon: 'cat', label: 'Gatos' }
    ];

    page.innerHTML = `
      <div class="rincon-subpage">
        <button class="rincon-back-btn" data-back="landing">
          ${ICON_SVGS['chevron-left']}
          Volver al Rincón
        </button>

        <div class="rinco-section glass-card" style="padding:0;background:transparent;border:none;">
          <nav class="curio-tabs">
            ${tabs.map(t => `
              <button class="curio-tab${t.id === state.curiosidadTab ? ' active' : ''}" data-curio="${t.id}">
                <span class="curio-tab-icon">${ICON_SVGS[t.icon] || ''}</span>
                <span class="curio-tab-label">${t.label}</span>
              </button>
            `).join('')}
          </nav>
        </div>

        <div class="rinco-section glass-card" id="curioContent">
          ${renderCurioContent(state.curiosidadTab)}
        </div>
      </div>
    `;

    // Back button
    page.querySelector('[data-back="landing"]').addEventListener('click', () => {
      state.view = 'landing';
      render();
    });

    // Tab binding
    page.querySelectorAll('.curio-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        page.querySelectorAll('.curio-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.curiosidadTab = tab.dataset.curio;
        document.getElementById('curioContent').innerHTML = renderCurioContent(state.curiosidadTab);
        bindCurioEvents();
      });
    });

    bindCurioEvents();
  }

  function renderCurioContent(tabId) {
    switch (tabId) {
      case 'spb':
        return renderSPB();
      case 'sanpetersburgo':
        return renderSanPetersburgo();
      case 'gatos':
        return renderGatos();
      default:
        return '<p>Selecciona una sección</p>';
    }
  }

  function renderSPB() {
    const data = SPB_DATA;
    return `
      <div class="curio-section-inner">
        <!-- Header -->
        <div class="spb-header">
          <div class="spb-header-badge">
            <h3><i data-lucide="map-pin" style="width:20px;height:20px;vertical-align:middle;"></i> San Juan Pueblo, Atlántida</h3>
            <p class="text-muted">Río entre montañas · Corazón hondureño</p>
          </div>
        </div>

        <!-- Quick Stats -->
        <div class="spb-quick-grid">
          ${data.quickStats.map(s => `
            <div class="spb-quick-card"><span class="spb-qc-icon">${ICON_SVGS[s.icon] || s.icon}</span><strong>${s.label}</strong><small>${s.sub}</small></div>
          `).join('')}
        </div>

        <!-- Timeline -->
        <div class="spb-section">
          <h4><i data-lucide="history" style="width:18px;height:18px;vertical-align:middle;"></i> Historia</h4>
          <div class="spb-timeline">${data.timeline.map(t =>
            `<div class="spb-tl-item"><span class="spb-tl-year">${t.year}</span><span class="spb-tl-desc">${t.desc}</span></div>`
          ).join('')}</div>
        </div>

        <!-- Comidas -->
        <div class="spb-section">
          <h4><i data-lucide="utensils-crossed" style="width:18px;height:18px;vertical-align:middle;"></i> Comida típica hondureña</h4>
          <div class="spb-food-grid">${data.comidas.map(c =>
            `<span class="spb-food-chip">${c}</span>`
          ).join('')}</div>
        </div>

        <!-- Curiosidades (acordeones) -->
        <div class="spb-section">
          <h4><i data-lucide="sparkles" style="width:18px;height:18px;vertical-align:middle;"></i> Curiosidades</h4>
          ${data.curiosidades.map((c, i) => `
            <div class="spb-accordion">
              <button class="spb-acc-header" data-acc="${i}">
                <span>${ICON_SVGS[c.icon] || c.icon} ${c.titulo}</span>
                <span class="spb-acc-arrow">▸</span>
              </button>
              <div class="spb-acc-body" id="accBody${i}"><p>${c.texto}</p></div>
            </div>
          `).join('')}
        </div>

        <!-- SPB Gallery -->
        <div class="spb-section">
          <h4><i data-lucide="camera" style="width:18px;height:18px;vertical-align:middle;"></i> Galería SPB</h4>
          <div class="spb-gallery-grid" id="spbGalleryGrid">${data.galeriaSPB.map((g, i) =>
            `<div class="grid-item" data-index="${i}"><img src="${g.src}" alt="${g.caption}" loading="lazy"><div class="grid-item-overlay">${ICON_SVGS['eye-open']}</div></div>`
          ).join('')}</div>
        </div>
      </div>
    `;
  }

  function renderSanPetersburgo() {
    const data = CURIOSIDADES_DATA.sanPetersburgo;
    return `
      <div class="curio-section-inner">
        <div class="spb-header" style="background:linear-gradient(135deg, rgba(0,60,150,0.15), rgba(0,100,200,0.08));border-color:rgba(0,60,150,0.25);">
          <div class="spb-header-badge">
            <h3><i data-lucide="ship" style="width:20px;height:20px;vertical-align:middle;"></i> ${data.title}</h3>
            <p class="text-muted">${data.subtitle}</p>
          </div>
        </div>

        <p style="margin-bottom:16px;font-size:var(--fs-sm);color:var(--theme-text-secondary);line-height:1.6;">${data.intro}</p>

        <div class="spb-quick-grid">
          ${data.quickStats.map(s => `
            <div class="spb-quick-card"><span class="spb-qc-icon">${ICON_SVGS[s.icon] || s.icon}</span><strong>${s.label}</strong><small>${s.sub}</small></div>
          `).join('')}
        </div>

        <div class="spb-section">
          <h4><i data-lucide="sparkles" style="width:18px;height:18px;vertical-align:middle;"></i> Datos curiosos</h4>
          ${data.datos.map((d, i) => `
            <div class="spb-accordion">
              <button class="spb-acc-header" data-acc="sp${i}">
                <span>${ICON_SVGS[d.icon] || d.icon} ${d.titulo}</span>
                <span class="spb-acc-arrow">▸</span>
              </button>
              <div class="spb-acc-body" id="accBodySP${i}"><p>${d.texto}</p></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderGatos() {
    const data = CURIOSIDADES_DATA.gatos;
    return `
      <div class="curio-section-inner">
        <div class="spb-header" style="background:linear-gradient(135deg, rgba(200,100,50,0.12), rgba(240,150,80,0.06));border-color:rgba(200,100,50,0.2);">
          <div class="spb-header-badge">
            <h3><i data-lucide="cat" style="width:20px;height:20px;vertical-align:middle;"></i> ${data.title}</h3>
            <p class="text-muted">${data.subtitle}</p>
          </div>
        </div>

        <p style="margin-bottom:16px;font-size:var(--fs-sm);color:var(--theme-text-secondary);line-height:1.6;">${data.intro}</p>

        <div class="spb-quick-grid">
          ${data.quickStats.map(s => `
            <div class="spb-quick-card"><span class="spb-qc-icon">${ICON_SVGS[s.icon] || s.icon}</span><strong>${s.label}</strong><small>${s.sub}</small></div>
          `).join('')}
        </div>

        <div class="spb-section">
          <h4><i data-lucide="sparkles" style="width:18px;height:18px;vertical-align:middle;"></i> Datos curiosos</h4>
          ${data.datos.map((d, i) => `
            <div class="spb-accordion">
              <button class="spb-acc-header" data-acc="g${i}">
                <span>${ICON_SVGS[d.icon] || d.icon} ${d.titulo}</span>
                <span class="spb-acc-arrow">▸</span>
              </button>
              <div class="spb-acc-body" id="accBodyG${i}"><p>${d.texto}</p></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function bindCurioEvents() {
    // Convert data-lucide icons in curio content
    const container = document.getElementById('curioContent');
    if (!container) return;
    _renderLucideIcons(container);

    // Accordion bindings
    container.querySelectorAll('.spb-acc-header').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('open');
        const body = document.getElementById(`accBody${btn.dataset.acc}`);
        if (body) body.classList.toggle('open');
        const arrow = btn.querySelector('.spb-acc-arrow');
        if (arrow) arrow.textContent = btn.classList.contains('open') ? '▾' : '▸';
      });
    });

    // SPB Gallery lightbox
    const spbGrid = document.getElementById('spbGalleryGrid');
    if (spbGrid) {
      const spbMedia = SPB_DATA.galeriaSPB.map(g => ({ type: 'image', src: g.src, caption: g.caption }));
      spbGrid.querySelectorAll('.grid-item').forEach(el => {
        el.addEventListener('click', () => openLightbox(spbMedia, Number(el.dataset.index)));
      });
    }
  }

  // ==========================================
  // INIT
  // ==========================================
  render();

  return page;
}
