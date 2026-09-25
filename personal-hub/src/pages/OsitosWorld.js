/* ==========================================
   OSITOSWORLD — biblioteca de personajes
   Integrada en el sistema de la app: cabecera
   del sistema, chips de sección, tarjetas con
   la librería y detalles en el sheet compartido.
   (Antes era una web-isla con navbar, sidebar,
   paleta azul/dorado y fuente propias.)
   ========================================== */

import { h, icon, openSheet, closeSheets, toast, emptyState } from '../components/ui.js';
import { buildVideoPlayer } from '../components/MediaLightbox.js';
import { escapeHtml } from '../utils/escape.js';
import { CHARACTERS } from '../data/ositos-data.js';
import { userPrefKey } from '../utils/userStorage.js';

const INTRO_VIDEO_URL = 'https://res.cloudinary.com/dcsent4fs/video/upload/v1787071569/VID_20260802_150647_233_dcsau2.mp4';

const hasText = (v) =>
  v !== undefined && v !== null && typeof v === 'string' && v.trim() !== '' && v.trim() !== '.';

const FAVORITES_KEY = () => userPrefKey('ositosWorld.favorites');

function migrateLegacyKeys() {
  // Los favoritos antiguos vivían en claves sin scope de usuario
  const base = 'ositosWorld.favorites';
  const scoped = userPrefKey(base);
  if (localStorage.getItem(base) && !localStorage.getItem(scoped)) {
    localStorage.setItem(scoped, localStorage.getItem(base));
  }
  localStorage.removeItem(base);
}

const ROLE_META = {
  heroe:  { label: 'Héroe',   tone: 'is-blue' },
  villano:{ label: 'Villano', tone: 'is-rose' },
  aliado: { label: 'Aliado',  tone: 'is-green' }
};
const roleMeta = (role) => ROLE_META[role] || { label: role || 'Personaje', tone: 'is-amber' };

const SECTIONS = [
  { id: 'inicio',     label: 'Inicio',      icon: 'home' },
  { id: 'biblioteca', label: 'Biblioteca',  icon: 'book' },
  { id: 'personajes', label: 'Personajes',  icon: 'user' },
  { id: 'favoritos',  label: 'Favoritos',   icon: 'heart' }
];

export function OsitosWorldPage(router) {
  const page = document.createElement('div');
  page.className = 'ositos-page';

  migrateLegacyKeys();

  let activeSection = 'inicio';
  let favorites = new Set();
  let searchQuery = '';

  try {
    const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY()) || '[]');
    favorites = new Set(Array.isArray(saved) ? saved : []);
  } catch { favorites = new Set(); }

  const saveFavorites = () => {
    try { localStorage.setItem(FAVORITES_KEY(), JSON.stringify([...favorites])); } catch { /* cuota */ }
  };

  const isFav = (id) => favorites.has(id);

  function toggleFav(id, name) {
    if (favorites.has(id)) {
      favorites.delete(id);
      toast('Quitado de favoritos');
    } else {
      favorites.add(id);
      toast(`${name || 'Añadido'} en favoritos ♥`);
    }
    saveFavorites();
    paintAll();
  }

  /* ==========================================
     BÚSQUEDA
     ========================================== */
  function searchAll(query) {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return CHARACTERS.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.role || '').toLowerCase().includes(q) ||
      (c.personality && c.personality.toLowerCase().includes(q)) ||
      (c.description && c.description.toLowerCase().includes(q))
    );
  }

  /* ==========================================
     TARJETA DE PERSONAJE
     ========================================== */
  function charCard(c) {
    const meta = roleMeta(c.role);
    const hasImg = hasText(c.image) && c.image.length > 0;
    const fav = isFav(c.id);

    const art = hasImg
      ? h('div', { class: 'os-char__img' }, h('img', { src: c.image, alt: '', loading: 'lazy' }))
      : h('div', { class: 'os-char__img os-char__img--emoji' }, h('span', null, c.emoji || '🧸'));

    const card = h('button', {
      class: 'os-char lift',
      type: 'button',
      'aria-label': `Abrir ${c.name}`
    },
      art,
      h('span', { class: `chip is-tone ${meta.tone} os-char__role` }, meta.label),
      h('span', { class: 'os-char__name' }, c.name)
    );
    card.addEventListener('click', () => openCharacter(c));

    // El corazón vive fuera del botón (no se anidan botones)
    const favBtn = h('button', {
      class: `os-fav${fav ? ' is-on' : ''}`,
      type: 'button',
      'data-id': c.id,
      'aria-label': fav ? 'Quitar de favoritos' : 'Añadir a favoritos',
      title: fav ? 'Quitar de favoritos' : 'Añadir a favoritos',
      html: icon('heart', 15)
    });
    favBtn.addEventListener('click', () => toggleFav(c.id, c.name));

    return h('div', { class: 'os-char-wrap' }, card, favBtn);
  }

  /* ==========================================
     VISTAS
     ========================================== */
  function renderInicio() {
    const heroes = CHARACTERS.filter(c => c.role === 'heroe').length;
    const villanos = CHARACTERS.filter(c => c.role === 'villano').length;
    const aliados = CHARACTERS.filter(c => c.role === 'aliado').length;
    const featured = CHARACTERS.slice(0, 4);

    return `
      <article class="os-hero">
        <span class="os-hero__emoji">🧸</span>
        <h2 class="os-hero__title">Bienvenida a Ositos World</h2>
        <p class="os-hero__sub">Un pequeño universo de personajes mágicos e historias por descubrir.</p>
        <div class="os-hero__actions">
          <button type="button" class="btn" data-go="biblioteca">${icon('book', 16)} Biblioteca</button>
          <button type="button" class="btn btn-secondary" data-go="personajes">${icon('user', 16)} Personajes</button>
          <button type="button" class="btn btn-secondary" data-intro>${icon('video', 16)} Vídeo</button>
        </div>
      </article>

      <div class="os-stats">
        <div class="os-stat"><b>${CHARACTERS.length}</b><span>Personajes</span></div>
        <div class="os-stat"><b>${heroes}</b><span>Héroes</span></div>
        <div class="os-stat"><b>${villanos}</b><span>Villanos</span></div>
        <div class="os-stat"><b>${aliados}</b><span>Aliados</span></div>
        <div class="os-stat is-accent"><b>${favorites.size}</b><span>Favoritos</span></div>
      </div>

      <p class="section-title">Personajes destacados</p>
      <div class="os-grid">${featured.map(charCardHTML).join('')}</div>
    `;
  }

  // Versión string para usar dentro de las plantillas
  function charCardHTML(c) {
    const meta = roleMeta(c.role);
    const hasImg = hasText(c.image) && c.image.length > 0;
    const fav = isFav(c.id);
    return `
      <div class="os-char-wrap">
        <button type="button" class="os-char lift" data-char-id="${escapeHtml(c.id)}" aria-label="Abrir ${escapeHtml(c.name)}">
          ${hasImg
            ? `<span class="os-char__img"><img src="${escapeHtml(c.image)}" alt="" loading="lazy"></span>`
            : `<span class="os-char__img os-char__img--emoji"><span>${c.emoji || '🧸'}</span></span>`}
          <span class="chip is-tone ${meta.tone} os-char__role">${meta.label}</span>
          <span class="os-char__name">${escapeHtml(c.name)}</span>
        </button>
        <button type="button" class="os-fav${fav ? ' is-on' : ''}" data-fav-id="${escapeHtml(c.id)}"
          aria-label="${fav ? 'Quitar de favoritos' : 'Añadir a favoritos'}"
          title="${fav ? 'Quitar de favoritos' : 'Añadir a favoritos'}">${icon('heart', 15)}</button>
      </div>
    `;
  }

  function renderBiblioteca() {
    // Los datos aún no traen capítulos: la biblioteca muestra el estado
    // vacío con el vídeo de introducción mientras tanto.
    return `
      <div class="card os-book">
        <div class="os-book__icon">${icon('book', 26)}</div>
        <b>La biblioteca aún está en blanco</b>
        <p>Cada saga será un libro y cada capítulo, una página por descubrir. Pronto llegarán las primeras historias.</p>
        <button type="button" class="btn" data-intro>${icon('video', 16)} Ver el vídeo de introducción</button>
      </div>
    `;
  }

  function renderPersonajes() {
    const q = searchQuery.toLowerCase().trim();
    const list = q ? searchAll(q) : CHARACTERS;

    if (!list.length) {
      return emptyState('search', q ? 'Sin resultados' : 'No hay personajes',
        q ? `No se encontró nada para “${escapeHtml(q)}”.` : 'Pronto llegará más gente a este mundo.').outerHTML;
    }

    return `
      ${q ? `<p class="section-title">Resultados <span class="section-title__aside">${list.length} para “${escapeHtml(q)}”</span></p>` : ''}
      <div class="os-grid">${list.map(charCardHTML).join('')}</div>
    `;
  }

  function renderFavoritos() {
    const list = CHARACTERS.filter(c => favorites.has(c.id));
    if (!list.length) {
      return emptyState('heart', 'Aún no tienes favoritos',
        'Marca el corazón en tus personajes para verlos aquí.').outerHTML;
    }
    return `<div class="os-grid">${list.map(charCardHTML).join('')}</div>`;
  }

  /* ==========================================
     SHEET DE PERSONAJE
     ========================================== */
  function openCharacter(c) {
    const meta = roleMeta(c.role);
    const fav = isFav(c.id);
    const friends = (c.friends || []).filter(hasText)
      .map(name => CHARACTERS.find(ch => ch.name === name))
      .filter(Boolean);

    openSheet(c.name, () => {
      const body = h('div', { class: 'os-sheet' });

      const hasImg = hasText(c.image) && c.image.length > 0;
      const art = hasImg
        ? h('div', { class: 'os-sheet__img' }, h('img', { src: c.image, alt: c.name, loading: 'lazy' }))
        : h('div', { class: 'os-sheet__img os-sheet__img--emoji' }, h('span', null, c.emoji || '🧸'));
      body.append(art);

      body.append(h('div', { class: 'os-sheet__head' },
        h('span', { class: `chip is-tone ${meta.tone}` }, meta.label),
        h('b', null, c.name)
      ));

      const section = (title, text) => {
        if (!hasText(text)) return null;
        return h('div', { class: 'os-sheet__sec' }, h('h4', null, title), h('p', null, text));
      };
      const desc = section('Descripción', c.description);
      if (desc) body.append(desc);
      const pers = section('Personalidad', c.personality);
      if (pers) body.append(pers);
      const curio = section('Curiosidad', c.curiosities);
      if (curio) body.append(curio);

      if (friends.length) {
        const chips = h('div', { class: 'os-sheet__chips' });
        friends.forEach(f => {
          const chip = h('button', { class: 'chip chip--plain', type: 'button' },
            `${f.emoji || '🧸'} ${f.name}`);
          chip.addEventListener('click', () => {
            closeSheets();
            setTimeout(() => openCharacter(f), 120);
          });
          chips.append(chip);
        });
        body.append(h('div', { class: 'os-sheet__sec' }, h('h4', null, 'Amigos'), chips));
      }

      const favBtn = h('button', {
        class: `btn btn--block${fav ? ' is-on' : ''}`,
        type: 'button'
      }, icon('heart', 16), fav ? 'Quitar de favoritos' : 'Guardar en favoritos');
      favBtn.addEventListener('click', () => {
        toggleFav(c.id, c.name);
        const now = isFav(c.id);
        favBtn.classList.toggle('is-on', now);
        favBtn.innerHTML = '';
        favBtn.append(icon('heart', 16), document.createTextNode(now ? 'Quitar de favoritos' : 'Guardar en favoritos'));
      });
      body.append(favBtn);

      return body;
    });
  }

  function openIntroVideo() {
    openSheet('Ositos World', () => {
      const body = h('div', { class: 'os-sheet' });
      const slot = h('div', { class: 'os-sheet__video' });
      const player = buildVideoPlayer({ src: INTRO_VIDEO_URL, poster: '', autoplay: true, loop: false });
      slot.appendChild(player.wrap);
      body.append(slot, h('p', { class: 'os-sheet__caption' }, 'Bienvenida a Ositos World'));
      return body;
    });
  }

  /* ==========================================
     PINTADO
     ========================================== */
  function renderHead() {
    const n = favorites.size;
    return `
      <header class="scr-head">
        <div>
          <h1 class="scr-title">OsitosWorld</h1>
          <p class="sub">${CHARACTERS.length} personajes · ${n} ${n === 1 ? 'favorito' : 'favoritos'}</p>
        </div>
        <div class="head-actions">
          <button type="button" class="icon-btn" id="osSearchBtn" aria-label="Buscar" title="Buscar">${icon('search', 19)}</button>
          <button type="button" class="icon-btn" id="osIntroBtn" aria-label="Ver vídeo de introducción" title="Vídeo de introducción">${icon('video', 19)}</button>
        </div>
      </header>

      <div class="chips os-chips" role="tablist" aria-label="Secciones de OsitosWorld">
        ${SECTIONS.filter(s => s.id !== 'favoritos' || favorites.size > 0).map(s => `
          <button type="button" class="chip os-chip${activeSection === s.id ? ' is-active' : ''}" data-section="${s.id}" role="tab" aria-selected="${activeSection === s.id}">
            ${icon(s.icon, 15)} ${s.label}${s.id === 'favoritos' ? ` <span class="os-chip__count">${n}</span>` : ''}
          </button>
        `).join('')}
      </div>

      <div class="os-searchbar" id="osSearchbar" hidden>
        <span class="os-searchbar__ic">${icon('search', 17)}</span>
        <input type="search" class="input" id="osSearchInput" placeholder="Buscar personajes..."
          value="${escapeHtml(searchQuery)}" aria-label="Buscar personajes">
        <button type="button" class="icon-btn" id="osSearchClose" aria-label="Cerrar búsqueda">${icon('x', 17)}</button>
      </div>
    `;
  }

  function currentView() {
    const q = searchQuery.trim();
    if (q) return renderPersonajes();
    switch (activeSection) {
      case 'biblioteca': return renderBiblioteca();
      case 'personajes': return renderPersonajes();
      case 'favoritos': return renderFavoritos();
      default: return renderInicio();
    }
  }

  function paintAll() {
    const prevBar = page.querySelector('#osSearchbar');
    const wasSearchOpen = !!prevBar && !prevBar.hidden; // primer render: cerrada
    page.innerHTML = renderHead() + `<section id="osContent" aria-live="polite">${currentView()}</section>`;

    // Navegación por chips
    page.querySelectorAll('.os-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        activeSection = chip.dataset.section;
        searchQuery = '';
        paintAll();
        if (activeSection === 'favoritos' || activeSection === 'personajes') {
          page.querySelector('#osContent')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    // Buscador
    const searchBtn = page.querySelector('#osSearchBtn');
    const searchbar = page.querySelector('#osSearchbar');
    const searchInput = page.querySelector('#osSearchInput');
    if (searchBtn && searchbar) {
      searchBtn.addEventListener('click', () => {
        searchbar.hidden = !searchbar.hidden;
        if (!searchbar.hidden) searchInput.focus();
      });
      page.querySelector('#osSearchClose').addEventListener('click', () => {
        searchbar.hidden = true;
        searchInput.value = '';
        searchQuery = '';
        paintAll();
      });
      let t;
      searchInput.addEventListener('input', e => {
        clearTimeout(t);
        t = setTimeout(() => {
          searchQuery = e.target.value;
          const host = page.querySelector('#osContent');
          if (host) host.innerHTML = currentView();
          bindContent();
        }, 180);
      });
      if (wasSearchOpen) { searchbar.hidden = false; if (searchQuery) searchInput.focus(); }
    }

    // Acciones de cabecera
    page.querySelector('#osIntroBtn')?.addEventListener('click', openIntroVideo);

    bindContent();
  }

  function bindContent() {
    const host = page.querySelector('#osContent');
    if (!host) return;

    host.querySelectorAll('[data-go]').forEach(btn =>
      btn.addEventListener('click', () => { activeSection = btn.dataset.go; paintAll(); }));

    host.querySelectorAll('[data-intro]').forEach(btn =>
      btn.addEventListener('click', openIntroVideo));

    host.querySelectorAll('[data-char-id]').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('.os-fav')) return;
        const c = CHARACTERS.find(x => x.id === card.dataset.charId);
        if (c) openCharacter(c);
      });
    });

    host.querySelectorAll('[data-fav-id]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const c = CHARACTERS.find(x => x.id === btn.dataset.favId);
        if (c) toggleFav(c.id, c.name);
      });
    });
  }

  /* ==========================================
     ARRANQUE
     ========================================== */
  page.cleanup = () => {
    closeSheets();
  };

  paintAll();

  return page;
}
