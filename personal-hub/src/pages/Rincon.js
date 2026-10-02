/* ==========================================
   Personal Hub v2 — Rincón Page (orquestador)
   Aquí solo vive el enrutado interno, el ciclo de vida de la página y el
   contexto que comparten las vistas. Cada sección tiene su módulo en
   ./rincon/: landing, galeria, memes, curiosities y audios.
   Sub-pages: Galería+Memes, Curiosidades (preserved)
   External: Juegos, Canciones, ThoseEyes, Series
   ========================================== */

import '../styles/rincon.css';
import { loadGiftsCatalog, getGiftsCatalog } from '../services/gifts.service.js';
import { createLightbox, closeLightbox, pauseSlideshow } from '../components/MediaLightbox.js';
import { db } from '../services/db.service.js';
import { showToast } from '../components/Toast.js';
import { escapeHtml } from '../utils/escape.js';
import { userStore } from '../stores/user.store.js';
import { onContentChange } from '../services/realtime.service.js';
import { player } from '../services/player.service.js';
import { GAMES } from '../data/games.catalog.js';

import { state } from './rincon/state.js';
import { ICON_SVGS } from './rincon/icons.js';
import { gradientPoster, MASONRY_RATIOS } from './rincon/media.data.js';
import { loadFavPhotos } from '../services/galleryData.js';
import { loadMemeFavs } from '../services/memesData.js';
import { loadCurioFavs } from './rincon/curiosities.js';

import { createLanding } from './rincon/landing.js';
import { warmSongCovers, getSongCovers } from './rincon/songCovers.js';
import { createGaleria } from './rincon/galeria.js';
import { createMemes } from './rincon/memes.js';
import { createCuriosities } from './rincon/curiosities.js';
import { createAudiosView, loadAudios } from './rincon/audios.js';

// ==========================================
// MAIN PAGE
// ==========================================
export function RinconPage(router) {
  createLightbox();
  const page = document.createElement('div');
  page.className = 'rincon-page';

  state.view = 'landing';
  state.curiosidadTab = 'spb';
  // Cargar favoritas persistentes del usuario (user-scoped)
  state.galeriaFavs = loadFavPhotos();
  state.memeFavs = loadMemeFavs();
  state.curioFavs = loadCurioFavs();
  const isAdmin = userStore.isAdmin;

  // Calienta portadas de Canciones en paralelo (import diferido). Si llegan
  // después del primer paint de la landing, re-render una sola vez.
  let songCoversPainted = false;
  warmSongCovers().then((covers) => {
    if (!covers.length || songCoversPainted || !page.isConnected) return;
    if (state.view === 'landing') {
      songCoversPainted = true;
      render();
    }
  });

  // Rotación de portadas de las tarjetas (Series, Canciones, Juegos, Curiosidades).
  // Se detiene al re-render o al salir de la página.
  const cardRotations = new Map();
  let offPlayerCard = () => {};
  const stopAllRotations = () => {
    cardRotations.forEach(stop => { try { stop(); } catch { /* no-op */ } });
    cardRotations.clear();
  };

  // Deep-link desde el Inicio (p. ej. /rincon?tab=memes o ?tab=curiosidades)
  if (router?.currentRoute?.query?.tab === 'memes') {
    state.view = 'memes';
  } else if (router?.currentRoute?.query?.tab === 'curiosidades') {
    state.view = 'curiosidades';
    state.curiosidadTab = 'landing';
  }

  // Secciones independientes del Rincón: cada ruta abre su contenido directo
  // (Galería, Memes, Audios y Curiosidades viven fuera de la landing).
  const _rinconBase = (router.getCurrentPath() || '').split('?')[0];
  if (_rinconBase === '/galeria') { state.view = 'galeria-memes'; }
  else if (_rinconBase === '/memes') { state.view = 'memes'; }
  else if (_rinconBase === '/audios') { state.view = 'audios'; state.audiosView = 'months'; state.audiosMonth = null; }
  else if (_rinconBase === '/curiosidades') { state.view = 'curiosidades'; state.curiosidadTab = 'landing'; }

  // Colecciones de curiosidades desde la sidebar: /curiosidades?cat=spb|sp|gatos
  if (_rinconBase === '/curiosidades' && ['spb', 'sp', 'gatos'].includes(router?.currentRoute?.query?.cat)) {
    state.curiosidadTab = router.currentRoute.query.cat;
  }

  // Mapa de secciones internas del Rincón → rutas independientes
  const RINCON_SECTION_ROUTES = {
    'galeria-memes': '/galeria',
    'memes': '/memes',
    'audios': '/audios',
    'curiosidades': '/curiosidades'
  };

  // El contexto que cada módulo recibe: la página, el router y las piezas de
  // estado que el orquestador es dueño (rotaciones, teclado, render).
  const ctx = {
    page,
    router,
    isAdmin,
    state,
    RINCON_SECTION_ROUTES,
    cardRotations,
    stopAllRotations,
    setOffPlayerCard: (fn) => { offPlayerCard = fn; },
    getOffPlayerCard: () => offPlayerCard,
    datoViewerKeyHandler: null,
    getDatoViewerKeyHandler: () => ctx.datoViewerKeyHandler,
    setDatoViewerKeyHandler: (fn) => { ctx.datoViewerKeyHandler = fn; },
    render: () => render()
  };

  const galeria = createGaleria(ctx);
  // Memes comparte la zona de masonry y de bindings con la Galeria, asi que
  // recibe su API ya montada (de ahí el orden: galeria antes que memes).
  const memes = createMemes({ ...ctx, ...galeria });
  // Y Galeria necesita el binding de Memes para repintarse: se enlaza al revés.
  ctx.getBindGaleriaEvents = () => memes.bindGaleriaEvents;
  const landing = createLanding(ctx);
  const curiosidades = createCuriosities(ctx);
  const audios = createAudiosView(ctx);
  ctx.galeria = galeria;
  ctx.memes = memes;

  function render() {
    switch (state.view) {
      case 'galeria-memes':
      case 'memes':
      case 'audios': renderGaleriaMemes(); break;
      case 'curiosidades': curiosidades.renderCuriosidades(); break;
      default: landing.renderLanding();
    }
  }

  function renderGaleriaMemes() {
    // Cabecera única (volver + título) y pestañas compactas: las cuatro
    // secciones (Galería, Memes, Audios, Minecraft) son rutas independientes.
    const currentBase = (router.getCurrentPath() || '').split('?')[0];
    const activeTab = currentBase === '/memes' ? 'memes' : currentBase === '/audios' ? 'audios' : 'galeria';
    const TABS = [
      { id: 'galeria', label: 'Galería', icon: 'image', sub: 'Cada foto guarda un recuerdo' },
      { id: 'memes', label: 'Memes', icon: 'smile', sub: 'Tu colección de Humor' },
      { id: 'audios', label: 'Audios', icon: 'mic', sub: 'Nuestra cápsula del día 3' },
      { id: 'minecraft', label: 'Minecraft', emoji: '⛏️', sub: 'Los mundos que construimos' }
    ];
    const current = TABS.find(t => t.id === activeTab) || TABS[0];
    page.innerHTML = `
      <header class="rincon-subhead">
        <button class="icon-btn" type="button" data-back="rincon" aria-label="Volver al Rincón">${ICON_SVGS['chevron-left']}</button>
        <div class="rincon-subhead-copy">
          <h1 class="scr-title">${current.label}</h1>
          <p class="sub">${current.sub}</p>
        </div>
      </header>
      <nav class="chips rincon-tabs" aria-label="Secciones">
        ${TABS.map(t => `<button class="chip${t.id === activeTab ? ' chip--active' : ''}" data-sub="${t.id}"${t.id === activeTab ? ' aria-current="page"' : ''}>
          ${t.emoji ? `<span class="rincon-tab-emoji">${t.emoji}</span>` : `<span class="rincon-tab-ic">${ICON_SVGS[t.icon]}</span>`}${t.label}
        </button>`).join('')}
      </nav>
      <div id="galeriaMemesContent">${
        activeTab === 'memes' ? galeria.renderMemesContent() :
        activeTab === 'audios' ? audios.renderAudiosTabContent() : galeria.renderGaleriaContent()
      }</div>
    `;

    page.querySelector('[data-back="rincon"]').addEventListener('click', () => router.navigate('/rincon'));
    page.querySelectorAll('[data-sub]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sub = btn.dataset.sub;
        if (sub === 'memes') router.navigate('/memes');
        else if (sub === 'audios') router.navigate('/audios');
        else if (sub === 'minecraft') router.navigate('/minecraft');
        else router.navigate('/galeria');
      });
    });
    if (activeTab === 'memes') memes.bindMemesEvents(page.querySelector('#galeriaMemesContent'));
    else if (activeTab === 'audios') audios.bindAudiosEvents(page.querySelector('#galeriaMemesContent'));
    else memes.bindGaleriaEvents(page.querySelector('#galeriaMemesContent'));
    // Sincroniza los vídeos desbloqueados del calendario cuando el catálogo llegue
    if (!getGiftsCatalog()) galeria.syncCalendarGallery();
  }

  // ==========================================
  // INIT
  // ==========================================
  render();

  // Carga las portadas personalizadas de las tarjetas (async, se sincronizan)
  db.getRinconCovers().then(c => {
    state.covers = c || {};
    if (state.view === 'landing') render();
  }).catch(() => {});

  // Carga los audios del día 3 (una sola vez, se cachean en state)
  loadAudios().catch(() => {});

  // ==========================================
  // RECARGAS EN CALIENTE
  // ==========================================
  const offGallery = onContentChange(['gallery_uploads'], () => {
    memes.rerenderGallery();
  });
  const offMemes = onContentChange(['meme_data'], () => {
    memes.rerenderMemes();
  });
  const offContent = onContentChange(['rincon_covers', 'gifts', 'audios'], (id) => {
    if (id === 'rincon_covers') {
      db.getRinconCovers().then(c => {
        state.covers = c || {};
        if (state.view === 'landing') render();
      }).catch(() => {});
    } else if (id === 'gifts') {
      // La galería muestra los vídeos desbloqueados del calendario
      if (state.view === 'galeria-memes' && !document.getElementById('mediaLightbox')?.classList.contains('open')) {
        renderGaleriaMemes();
      }
    } else if (id === 'audios') {
      // Los audios cambiaron (Admin): recarga y re-renderiza si estamos en Audios
      state.audiosLoaded = false;
      loadAudios(true).then(() => {
        if (state.view === 'audios') render();
      }).catch(() => {});
    }
  });

  // Escape cierra modales de memes (photo-menu-overlay) y menús abiertos
  const memeKeyHandler = (e) => {
    if (e.key !== 'Escape') return;
    const overlay = document.querySelector('.photo-menu-overlay');
    if (overlay) overlay.remove();
  };
  document.addEventListener('keydown', memeKeyHandler);

  // Cleanup al salir de la página: rotaciones, slideshow y teclado
  page.cleanup = () => {
    stopAllRotations();
    offPlayerCard();
    offContent();
    offGallery();
    offMemes();
    // Al salir del Rincón se destruyen todos sus medios, incluido el visor.
    closeLightbox();
    page.querySelectorAll('audio, video').forEach(media => {
      try { media.pause(); media.currentTime = 0; } catch { /* ignorar */ }
    });
    pauseSlideshow();
    document.removeEventListener('keydown', memeKeyHandler);
    if (ctx.datoViewerKeyHandler) {
      document.removeEventListener('keydown', ctx.datoViewerKeyHandler);
      ctx.datoViewerKeyHandler = null;
    }
    const viewerOverlay = document.querySelector('.disco-viewer-overlay');
    if (viewerOverlay) viewerOverlay.remove();
    document.body.classList.remove('sheet-locked');
  };

  return page;
}

// ==========================================
// MODAL REUTILIZABLE — Añadir por enlace
// (fotos/vídeos/audios desde una URL directa,
//  varias a la vez, una por línea)
// ==========================================

/** Extrae URLs válidas de un texto pegado (una por línea o separadas por espacios/comas). */
export function extractLinkUrls(text) {
  const raw = (text || '').split(/[\s,;]+/).filter(Boolean);
  return [...new Set(raw.filter(u => /^https?:\/\//i.test(u)))];
}

/**
 * Abre un modal para pegar URLs de fotos/vídeos/audios.
 * @param {object} opts
 *  - title: texto del título (p. ej. "Añadir por enlace")
 *  - hint: texto de ayuda bajo el título
 *  - placeholder: placeholder del textarea
 *  - accept: qué tipo espera ("image" | "video" | "audio" | "image,audio" ...) para el texto del botón
 *  - onAdd(urls): callback con el array de URLs extraídas
 */
export function openLinkUrlsModal(opts) {
  const {
    title = 'Añadir por enlace',
    hint = 'Pega las URLs (una por línea). Funcionan enlaces directos, p. ej. de Cloudinary.',
    placeholder = 'https://...\nhttps://...',
    accept = '',
    onAdd
  } = opts || {};
  const overlay = document.createElement('div');
  overlay.className = 'photo-menu-overlay mc-editor-overlay';
  overlay.innerHTML = `
    <div class="photo-menu-sheet mc-editor">
      <div class="mc-editor-head">
        <h3>🔗 ${escapeHtml(title)}</h3>
        <button class="photo-menu-close" aria-label="Cerrar">✕</button>
      </div>
      <p class="mc-confirm-text">${escapeHtml(hint)}</p>
      <label class="mc-field">
        <span>URLs</span>
        <textarea class="mc-link-textarea" rows="5" placeholder="${escapeHtml(placeholder)}" aria-label="URLs"></textarea>
      </label>
      <div class="mc-editor-actions">
        <button class="mc-btn" data-mc-close>Cancelar</button>
        <button class="mc-btn mc-btn--primary" data-mc-add>Añadir</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('.photo-menu-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('[data-mc-close]').addEventListener('click', close);
  overlay.querySelector('[data-mc-add]').addEventListener('click', () => {
    const urls = extractLinkUrls(overlay.querySelector('.mc-link-textarea').value);
    if (!urls.length) { showToast('Pega al menos una URL válida (https://…)', 'error'); return; }
    close();
    onAdd?.(urls);
  });
  setTimeout(() => overlay.querySelector('.mc-link-textarea').focus(), 50);
}
