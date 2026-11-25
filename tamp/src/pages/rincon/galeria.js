/* ==========================================
   Rincon — Galeria
   Fotos por carpetas, favoritos y los videos del calendario. El masonry y los
   bindings de esta zona los comparte con Memes (viven en memes.js y se
   reexportan aqui) para no duplicar codigo.
   ========================================== */

import { getVideoPoster, isVideo, cloudinaryThumb, mediaThumb } from '../../services/rincon-data.js';
import { loadGiftsCatalog, unlockedCalendarVideos } from '../../services/gifts.service.js';
import { escapeHtml } from '../../utils/escape.js';
// El estado "cargada/error" de las miniaturas se aplica con listeners
// delegados: la CSP del despliegue bloquea los handlers inline.
import '../../utils/imageReveal.js';
import {
  baseFolders, basePhotos, userPhotos,
  visiblePhotos, hiddenPhotos,
  albumMeta, photoTs
} from '../../services/galleryData.js';
import {
  memeAlbums, memeItems, memePoster, albumCover as memeAlbumCover,
  albumSummary, libraryStats
} from '../../services/memesData.js';
import { ICON_SVGS } from './icons.js';
import { state } from './state.js';

export function createGaleria(ctx) {
  const {
    page, router, isAdmin, render,
    // bindGaleriaEvents vive en memes.js (comparte la zona de bindings);
    // se inyecta despues, cuando memes ya esta montado.
    getBindGaleriaEvents: bindGaleriaEventsInjectado
  } = ctx;
  const getBindGaleriaEvents = bindGaleriaEventsInjectado || (() => () => {});

  function syncCalendarGallery() {
    loadGiftsCatalog().then(() => {
      if (state.calSynced || state.view !== 'galeria-memes') return;
      state.calSynced = true;
      const content = document.getElementById('galeriaMemesContent');
      if (!content) return;
      // El scroll de la app lo lleva .main, no el documento: hay que leerlo y
      // restaurarlo ahí, o el re-render deja al usuario arriba de la galería.
      const scroller = content.closest('main.main');
      const y = scroller ? scroller.scrollTop : window.scrollY;
      content.innerHTML = renderGaleriaContent();
      getBindGaleriaEvents()(content);
      if (y) requestAnimationFrame(() => {
        if (scroller) scroller.scrollTop = y;
        else window.scrollTo(0, y);
      });
    });
  }
  
  // ==========================================
  // GALERÍA — nueva experiencia fotográfica
  // ==========================================
  
  /** Vídeos desbloqueados del calendario (colección virtual 'Del calendario') */
  function calendarVideos() {
    return unlockedCalendarVideos().map(v => v.src);
  }
  
  /** Mapa src → cover (poster) de los vídeos del calendario con portada propia */
  function calendarVideoCovers() {
    const map = new Map();
    unlockedCalendarVideos().forEach(v => { if (v.cover) map.set(v.src, v.cover); });
    return map;
  }
  
  /** Todas las fotos visibles: subidas + carpetas + vídeos del calendario */
  function allGalleryPhotos() {
    const hidden = new Set(hiddenPhotos());
    const seen = new Set();
    const photos = [];
    const push = (list) => list.forEach(u => {
      if (!seen.has(u) && !hidden.has(u)) { seen.add(u); photos.push(u); }
    });
    push(userPhotos());
    baseFolders().forEach(folder => push(basePhotos(folder)));
    push(calendarVideos());
    return photos;
  }

  /** Orden pedido en el álbum: fecha, y las subidas siempre primero */
  function sortPhotos(photos) {
    const list = [...photos];
    if (state.galeriaSort === 'antiguas') list.sort((a, b) => photoTs(a) - photoTs(b));
    else list.sort((a, b) => photoTs(b) - photoTs(a));
    if (state.galeriaSort === 'antiguas') return list;
    const ups = userPhotos();
    return [...ups.filter(u => list.includes(u)), ...list.filter(u => !ups.includes(u))];
  }

  /** Fotos visibles según el álbum abierto (ocultas siempre excluidas) */
  function getGalleryPhotos() {
    const hidden = new Set(hiddenPhotos());
    const folders = baseFolders();
    const calVideos = calendarVideos();
    if (state.galeriaFilter === 'favoritas') {
      return sortPhotos([...state.galeriaFavs].filter(u => !hidden.has(u)));
    }
    if (state.galeriaFilter === 'calendario') {
      if (!calVideos.length) { state.galeriaFilter = 'todas'; return sortPhotos(allGalleryPhotos()); }
      return sortPhotos(calVideos.filter(u => !hidden.has(u)));
    }
    if (state.galeriaFilter !== 'todas' && state.galeriaFilter !== 'recientes' && folders.includes(state.galeriaFilter)) {
      return sortPhotos(visiblePhotos(state.galeriaFilter));
    }
    return sortPhotos(allGalleryPhotos());
  }

  /** Título + descripción del álbum (con meta editable del usuario) */
  function galleryAlbum() {
    const folders = baseFolders();
    const meta = albumMeta();
    let title, desc, id;
    if (state.galeriaFilter === 'favoritas') { title = 'Favoritas'; desc = 'Las fotos que más me llegan al corazón.'; id = 'favoritas'; }
    else if (state.galeriaFilter === 'calendario') { title = 'Del calendario'; desc = 'Los vídeos que se desbloquean cada día en el Calendario.'; id = 'calendario'; }
    else if (state.galeriaFilter === 'recientes') { title = 'Todos los recuerdos'; desc = 'Todo lo que habéis guardado, junto.'; id = 'recientes'; }
    else if (state.galeriaFilter !== 'todas' && folders.includes(state.galeriaFilter)) { title = state.galeriaFilter; desc = ''; id = state.galeriaFilter; }
    else { title = meta.titulo || 'Nuestros recuerdos'; desc = meta.descripcion || 'Momentos que el cielo pinta solo para nosotros.'; id = 'todas'; }
    return {
      id,
      title: meta[`titulo:${id}`] || title,
      desc: meta[`desc:${id}`] || desc,
      portada: meta[`portada:${id}`] || ''
    };
  }

  /** Miniatura (o póster, si es vídeo) de un recurso de la galería */
  function galleryThumb(src, width = 480) {
    if (!src) return '';
    if (!isVideo(src)) return mediaThumb(src, width);
    const cover = calendarVideoCovers().get(src) || getVideoPoster(src, width);
    return cover ? mediaThumb(cover, width) : '';
  }

  /** Colecciones de la biblioteca, con la misma forma que los álbumes de memes */
  function galleryCollections() {
    const meta = albumMeta();
    const hidden = new Set(hiddenPhotos());
    const folders = baseFolders();
    const calVideos = calendarVideos().filter(u => !hidden.has(u));
    const favs = [...state.galeriaFavs].filter(u => !hidden.has(u));
    const list = [
      { id: 'recientes', title: meta['titulo:recientes'] || 'Todos los recuerdos', photos: sortPhotos(allGalleryPhotos()) },
      { id: 'favoritas', title: meta['titulo:favoritas'] || 'Favoritas', photos: sortPhotos(favs) },
    ];
    folders.forEach(folder => {
      const photos = sortPhotos(visiblePhotos(folder));
      if (!photos.length) return;
      // La portada elegida a mano abre el collage.
      const portada = meta[`portada:${folder}`];
      if (portada && photos.includes(portada)) {
        photos.splice(photos.indexOf(portada), 1);
        photos.unshift(portada);
      }
      list.push({ id: folder, title: meta[`titulo:${folder}`] || folder, photos });
    });
    if (calVideos.length) {
      list.push({ id: 'calendario', title: meta['titulo:calendario'] || 'Del calendario', photos: sortPhotos(calVideos) });
    }
    return list;
  }

  /** Collage 2×2 de portada (mismas clases que los álbumes de memes) */
  function galleryCollage(photos, prioritize = false) {
    if (!photos.length) {
      return `<div class="meme-album-collage is-empty">
        <div class="meme-album-empty-icon">${ICON_SVGS['image']}</div>
        <span>Álbum vacío</span>
      </div>`;
    }
    const previews = photos.slice(0, 4);
    const cells = previews.map((src, i) => {
      const vid = isVideo(src);
      const thumb = galleryThumb(src, 480);
      const media = thumb
        ? `<span class="meme-cell-loader" aria-hidden="true"></span><img src="${escapeHtml(thumb)}" alt="" loading="${prioritize ? 'eager' : 'lazy'}"${prioritize ? ' fetchpriority="high"' : ''} decoding="async"><span class="meme-cell-fallback" aria-hidden="true">${ICON_SVGS['image']}</span>`
        : `<span class="meme-cell-fallback" aria-hidden="true">${vid ? ICON_SVGS['play'] : ICON_SVGS['image']}</span>`;
      return `<div class="meme-album-cell${vid ? ' is-video' : ''}${thumb ? '' : ' is-no-poster'}" data-cell-index="${i}">${media}${vid ? `<span class="meme-cell-play" aria-hidden="true">${ICON_SVGS['play']}</span>` : ''}</div>`;
    }).join('');
    const empty = Array.from({ length: Math.max(0, 4 - previews.length) }, () => '<div class="meme-album-cell is-empty"></div>').join('');
    return `<div class="meme-album-collage">${cells}${empty}</div>`;
  }

  /** Biblioteca: los álbumes, con el mismo lenguaje visual que Memes */
  function renderGalleryLibrary() {
    const collections = galleryCollections();
    const total = collections[0]?.photos.length || 0;
    return `<div class="memes-immersive" id="galeriaRoot">
      <header class="memes-library-head">
        <div class="memes-library-titles">
          <h2 class="memes-library-title">Nuestros recuerdos ❤️</h2>
          <p class="memes-library-count">${total} ${total === 1 ? 'foto' : 'fotos'} · ${collections.length} ${collections.length === 1 ? 'álbum' : 'álbumes'}</p>
        </div>
        <div class="memes-library-tools">
          <div class="memes-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="search" id="gallerySearchInput" placeholder="Buscar álbum…" aria-label="Buscar en la galería">
          </div>
          ${isAdmin ? `
          <button class="meme-add-album" id="galleryAddBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Añadir fotos</span>
          </button>` : ''}
          <input type="file" id="galleryFileInput" accept="image/*" multiple hidden>
        </div>
      </header>
      <div class="meme-albums-grid" id="galleryCollections">
        ${collections.map((album, i) => `
          <div class="meme-album-card card animate-in visible" data-album="${escapeHtml(album.id)}" data-search="${escapeHtml((album.title + ' ' + album.id).toLowerCase())}" style="--enter-delay:${Math.min(i, 8) * 0.05}s" role="button" tabindex="0" aria-label="Abrir álbum ${escapeHtml(album.title)}">
            <div class="meme-album-media">${galleryCollage(album.photos, i === 0)}</div>
            <div class="meme-album-info">
              <div class="meme-album-name-row">
                <h3 class="meme-album-name">${escapeHtml(album.title)}${album.id === 'favoritas' ? ' ❤️' : ''}</h3>
              </div>
              <p class="meme-album-sub">${album.photos.length} ${album.photos.length === 1 ? 'recuerdo' : 'recuerdos'}</p>
            </div>
          </div>`).join('')}
      </div>
      <div class="meme-search-empty" style="display:none">
        <div class="meme-empty-icon">${ICON_SVGS['image']}</div>
        <h3>Sin resultados</h3>
        <p>Prueba con otro nombre de álbum.</p>
      </div>
    </div>`;
  }

  /** Álbum abierto: cabecera y cuadrícula, igual que un álbum de memes */
  function renderGalleryAlbum() {
    const photos = getGalleryPhotos();
    const album = galleryAlbum();
    const vidCount = photos.filter(isVideo).length;
    const editables = album.id !== 'favoritas' && album.id !== 'calendario' && album.id !== 'recientes';
    return `<div class="meme-album-view" id="galeriaRoot">
      <div class="memes-breadcrumb">
        <button class="memes-breadcrumb-item" data-nav="landing">El Rincón</button>
        <span class="memes-breadcrumb-sep">/</span>
        <button class="memes-breadcrumb-item" id="galleryAlbumBack">Galería</button>
        <span class="memes-breadcrumb-sep">/</span>
        <span class="memes-breadcrumb-current">${escapeHtml(album.title)}</span>
      </div>
      <header class="meme-album-head">
        <div>
          <h2 class="meme-album-title">${escapeHtml(album.title)}${album.id === 'favoritas' ? ' ❤️' : ''}</h2>
          ${album.desc ? `<p class="meme-album-desc">${escapeHtml(album.desc)}</p>` : ''}
          <p class="meme-album-meta">${photos.length} ${photos.length === 1 ? 'recuerdo' : 'recuerdos'}${vidCount ? ` · ${vidCount} ${vidCount === 1 ? 'vídeo' : 'vídeos'}` : ''}</p>
        </div>
        <div class="meme-album-actions">
          <button class="gallery-hero-btn" id="gallerySortBtn" title="Cambiar el orden">
            <span id="gallerySortLabel">${state.galeriaSort === 'antiguas' ? 'Más antiguas' : 'Más recientes'}</span>
          </button>
          ${isAdmin ? `
          <button class="gallery-hero-btn gallery-hero-btn--primary" id="galleryAddBtn">＋ Añadir</button>
          ${editables ? `<button class="meme-album-menu-btn" id="galleryEditBtn" aria-label="Editar álbum">⋮</button>` : ''}` : ''}
          <input type="file" id="galleryFileInput" accept="image/*" multiple hidden>
        </div>
      </header>
      <div class="meme-album-grid" id="galeriaGrid"></div>
    </div>`;
  }

  function renderGaleriaContent() {
    if (state.galeriaFilter === 'todas') return renderGalleryLibrary();
    return renderGalleryAlbum();
  }
  function memeCollage(items, albumId, prioritize = false) {
    const previews = items.slice(0, 4);
    const cover = memeAlbumCover(albumId, items);
    const imageLoading = prioritize ? 'eager' : 'lazy';
    const imagePriority = prioritize ? ' fetchpriority="high"' : '';
    if (!previews.length) {
      return `<div class="meme-album-collage is-empty">
        <div class="meme-album-empty-icon">${ICON_SVGS['smile']}</div>
        <span>Álbum vacío</span>
      </div>`;
    }
    const cells = previews.map((src, i) => {
      const isVid = isVideo(src);
      const thumb = cloudinaryThumb(memePoster(src), 600);
      const media = thumb
        ? `<span class="meme-cell-loader" aria-hidden="true"></span><img src="${escapeHtml(thumb)}" alt="" loading="${imageLoading}"${imagePriority} decoding="async"><span class="meme-cell-fallback" aria-hidden="true">${ICON_SVGS['image']}</span>`
        : `<span class="meme-cell-fallback" aria-hidden="true">${isVid ? ICON_SVGS['play'] : ICON_SVGS['image']}</span>`;
      return `<div class="meme-album-cell ${isVid ? 'is-video' : ''}${thumb ? '' : ' is-no-poster'}" data-cell-index="${i}">${media}${isVid ? `<span class="meme-cell-play" aria-hidden="true">${ICON_SVGS['play']}</span>` : ''}</div>`;
    }).join('');
    const emptyCells = [...Array(Math.max(0, 4 - previews.length))].map(() => '<div class="meme-album-cell is-empty"></div>').join('');
    const coverBadge = cover && !items.slice(0, 4).includes(cover)
      ? `<div class="meme-album-cover-mini"${memePoster(cover) ? ` style="background-image:url('${escapeHtml(cloudinaryThumb(memePoster(cover), 400))}')"` : ''}></div>`
      : '';
    return `<div class="meme-album-collage">${cells}${emptyCells}${coverBadge}</div>`;
  }
  
  function memeSortAlbums(albums) {
    const list = [...albums];
    if (state.memeSort === 'nombre') {
      list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    } else if (state.memeSort === 'antiguos') {
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } else {
      // recientes: los álbumes propios primero (recién creados), luego por total
      list.sort((a, b) => (b.isUser ? 1 : 0) - (a.isUser ? 1 : 0));
    }
    return list;
  }
  
  function renderMemesContent() {
    const albums = memeSortAlbums(memeAlbums().map(a => ({ ...a, items: memeItems(a.id) })));
    const stats = libraryStats();
    return `<div class="memes-immersive" id="memesRoot">
      <header class="memes-library-head">
        <div class="memes-library-titles">
          <h2 class="memes-library-title">Mis álbumes de memes ❤️</h2>
          <p class="memes-library-count">${stats.memes} memes · ${stats.albums} álbumes</p>
        </div>
        <div class="memes-library-tools">
          <div class="memes-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="search" id="memeSearchInput" placeholder="Buscar memes o álbumes…" aria-label="Buscar memes o álbumes" value="${escapeHtml(state.memeQuery)}">
          </div>
          ${isAdmin ? `
          <button class="meme-add-album" id="memeAddAlbumBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Crear álbum</span>
          </button>` : ''}
          <div class="meme-sort">
            <button class="meme-sort-btn" id="memeSortBtn" aria-haspopup="listbox" aria-expanded="false">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M6 12h12M10 18h4"/></svg>
              <span id="memeSortLabel">${state.memeSort === 'nombre' ? 'Nombre A-Z' : state.memeSort === 'antiguos' ? 'Más antiguos' : 'Más recientes'}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
        </div>
      </header>
      ${albums.length ? `
        <div class="meme-albums-grid" id="memesCollectionsGrid">
          ${albums.map((a, i) => {
            const s = albumSummary(a.items);
            const isFavCount = a.items.filter(u => state.memeFavs.has(u)).length;
            return `<div class="meme-album-card card animate-in visible" data-album="${escapeHtml(a.id)}" data-search="${escapeHtml((a.name + ' ' + a.items.join(' ')).toLowerCase())}" style="--enter-delay:${Math.min(i, 8) * 0.05}s" role="button" tabindex="0" aria-label="Abrir álbum ${escapeHtml(a.name)}">
              <div class="meme-album-media">${memeCollage(a.items, a.id, i === 0)}</div>
              <div class="meme-album-info">
                <div class="meme-album-name-row">
                  <h3 class="meme-album-name">${escapeHtml(a.name)}${a.isUser ? ' <span class="meme-album-own">●</span>' : ''}</h3>
                  <button class="meme-album-menu" data-menu="${escapeHtml(a.id)}" aria-label="Opciones de ${escapeHtml(a.name)}" title="Opciones del álbum">⋮</button>
                </div>
                <p class="meme-album-sub">${s.total} ${s.total === 1 ? 'meme' : 'memes'} · ${s.typeLabel}${isFavCount ? ` · ❤ ${isFavCount}` : ''}</p>
              </div>
            </div>`;
          }).join('')}
        </div>
        <div class="meme-search-empty" style="display:none">
          <div class="meme-empty-icon">${ICON_SVGS['smile']}</div>
          <h3>Sin resultados para «${escapeHtml(state.memeQuery)}»</h3>
          <p>Prueba con otro nombre de álbum o contenido.</p>
        </div>
        <section class="meme-library-cta">
          <div class="meme-cta-emoji">😄</div>
          <div>
            <h3>¿Tienes más memes?</h3>
            <p>Crea un nuevo álbum y organiza tus memes favoritos.</p>
          </div>
          <button class="meme-cta-btn" id="memeCtaBtn">+ Crear álbum</button>
        </section>
      ` : `
        <div class="meme-empty-library">
          <div class="meme-empty-icon">${ICON_SVGS['smile']}</div>
          <h3>Tu colección de memes está vacía</h3>
          <p>Guarda tus memes favoritos y organízalos en álbumes.</p>
          ${isAdmin ? `
          <button class="meme-add-album" id="memeEmptyAddBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Crear álbum</span>
          </button>` : ''}
        </div>
      `}
    </div>`;
  }
  
  // Handler del visor de curiosidades — se guarda para poder limpiarlo al salir de la página
  let datoViewerKeyHandler = null;
  
  // ----- Hero manual + indicadores (sin autoplay) -----

  return {
    syncCalendarGallery,
    calendarVideos,
    calendarVideoCovers,
    getGalleryPhotos,
    galleryAlbum,
    renderGaleriaContent,
    renderMemesContent,
    memeCollage,
    memeSortAlbums
  };
}
