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

import { saveTabScroll, restoreTabScroll } from '../utils/scrollMemory.js';
import { prepareMedia, storageUrlsIn } from '../services/media.service.js';
import { renderPageHeader } from '../components/PageHeader.js';
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
import { createAudiosView, loadAudios, pauseSharedAudio } from './rincon/audios.js';

// Las cuatro vistas de Galería comparten cabecera y pestañas: al movernos entre
// ellas el reproductor de Audios sigue vivo, pero al salir de la familia se para.
const GALLERY_FAMILY = new Set(['/galeria', '/memes', '/audios', '/minecraft']);

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

  // La landing calienta portadas; las pestañas de Galería no las necesitan y
  // cargarlas solo retrasaba el cambio de pestaña.
  let songCoversPainted = false;
  if (state.view === 'landing') {
    warmSongCovers().then((covers) => {
      if (!covers.length || songCoversPainted || !page.isConnected) return;
      if (state.view === 'landing') {
        songCoversPainted = true;
        render();
      }
    });
  }

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
  else if (_rinconBase === '/audios') {
    state.view = 'audios';
    // Volver a Audios devuelve al mes que tenías abierto; una entrada nueva
    // (o una recarga) empieza en la lista de meses.
    if (state.audiosView !== 'detail' || !state.audiosMonth) {
      state.audiosView = 'months';
      state.audiosMonth = null;
    }
  }
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

  async function render() {
    try {
      switch (state.view) {
        case 'galeria-memes':
        case 'memes':
        case 'audios': await renderGaleriaMemes(); break;
        case 'curiosidades': curiosidades.renderCuriosidades(); break;
        default: landing.renderLanding();
      }
    } catch (error) {
      // Un fallo al pintar no puede tumbar la navegación.
      console.error('[rincon] no se pudo pintar la vista:', error);
    }
  }

  async function renderGaleriaMemes() {
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
    const buildContent = () =>
      activeTab === 'memes' ? galeria.renderMemesContent() :
      activeTab === 'audios' ? audios.renderAudiosTabContent() : galeria.renderGaleriaContent();

    // Las fotos, memes y audios subidos viven en Supabase Storage. La primera
    // pasada delata sus URLs: se firman antes de pintar y la segunda ya las
    // recibe firmadas. Con el bucket público —o si la firma falla— el HTML es
    // exactamente el de antes, así que no cambia nada para quien no migre.
    let content = buildContent();
    const storageUrls = storageUrlsIn(content);
    if (storageUrls.length) {
      const { signed } = await prepareMedia(storageUrls);
      if (signed) content = buildContent();
    }

    page.innerHTML = `
      ${renderPageHeader({
        title: current.label,
        subtitle: current.sub,
        back: true,
        backLabel: 'Volver al Rincón',
        className: 'rincon-subhead',
      })}
      <nav class="chips rincon-tabs" aria-label="Secciones">
        ${TABS.map(t => `<button class="chip${t.id === activeTab ? ' chip--active' : ''}" data-sub="${t.id}"${t.id === activeTab ? ' aria-current="page"' : ''}>
          ${t.emoji ? `<span class="rincon-tab-emoji">${t.emoji}</span>` : `<span class="rincon-tab-ic">${ICON_SVGS[t.icon]}</span>`}${t.label}
        </button>`).join('')}
      </nav>
      <div id="galeriaMemesContent">${content}</div>
    `;

    page.querySelector('.rincon-subhead [data-back]')?.addEventListener('click', () => router.navigate('/rincon'));
    page.querySelectorAll('[data-sub]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sub = btn.dataset.sub;
        const target = sub === 'memes' ? '/memes'
          : sub === 'audios' ? '/audios'
          : sub === 'minecraft' ? '/minecraft'
          : '/galeria';
        if (target === currentBase) { router.scrollToTop(); return; }
        // Cada pestaña guarda su altura al salir (cleanup) y la recupera al
        // volver; aquí solo se navega.
        router.navigate(target);
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

  // Cada pestaña carga solo lo suyo: portadas para la landing y audios para la
  // cápsula. Antes se pedían ambas en cualquier vista y el cambio de pestaña se
  // notaba lento.
  if (state.view === 'landing') {
    db.getRinconCovers().then(async c => {
      state.covers = c || {};
      // Las portadas pueden estar en Storage (subidas desde el panel) o ser
      // enlaces externos: `prepareMedia` firma solo las primeras.
      await prepareMedia(Object.values(state.covers || {}));
      if (state.view === 'landing') render();
    }).catch(() => {});
  }
  if (state.view === 'audios') {
    loadAudios()
      .then(() => { if (state.view === 'audios' && page.isConnected) render(); })
      .catch(() => {});
  }

  // Restaura la altura de la pestaña de Galería desde la que se viene.
  restoreTabScroll(_rinconBase);

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
    // Posición de esta pestaña, para recuperarla al volver a ella.
    const scrollerEl = page.closest('main.main') || document.querySelector('main.main');
    saveTabScroll(_rinconBase, scrollerEl ? scrollerEl.scrollTop : 0);
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
    // El reproductor de Audios vive fuera de la página para sobrevivir a los
    // cambios de pestaña; solo se calla al abandonar la sección Galería.
    const nextPath = (window.location.hash || '').replace(/^#/, '').split('?')[0];
    if (!GALLERY_FAMILY.has(nextPath)) pauseSharedAudio();
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
