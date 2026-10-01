/* ==========================================
   Rincon — Galeria
   Fotos por carpetas, favoritos y los videos del calendario. El masonry y los
   bindings de esta zona los comparte con Memes (viven en memes.js y se
   reexportan aqui) para no duplicar codigo.
   ========================================== */

import { getVideoPoster, isVideo } from '../../services/rincon-data.js';
import { loadGiftsCatalog, getGiftsCatalog, unlockedCalendarVideos } from '../../services/gifts.service.js';
import { db } from '../../services/db.service.js';
import { showToast } from '../../components/Toast.js';
import { escapeHtml, safeUrl } from '../../utils/escape.js';
import { openLightbox, playSlideshow } from '../../components/MediaLightbox.js';
import {
  baseFolders, basePhotos, userPhotos, addUserPhotos,
  visiblePhotos, hiddenPhotos, hidePhoto, saveFavPhotos, toggleFavPhoto,
  albumMeta, saveAlbumMeta, photoDate, photoTs, albumYear
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
    getBindGaleriaEvents = () => () => {}
  } = ctx;

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
  
  /** Fotos visibles según filtro + ordenación (ocultas siempre excluidas) */
  function getGalleryPhotos() {
    const folders = baseFolders();
    const hidden = new Set(hiddenPhotos());
    const calVideos = calendarVideos();
    let photos = [];
    if (state.galeriaFilter === 'favoritas') {
      photos = [...state.galeriaFavs].filter(u => !hidden.has(u));
    } else if (state.galeriaFilter === 'calendario') {
      // Si ya no quedan vídeos (ocultos todos), vuelve al álbum general
      if (!calVideos.length) state.galeriaFilter = 'todas';
      else photos = calVideos.filter(u => !hidden.has(u));
    } else if (state.galeriaFilter !== 'todas' && folders.includes(state.galeriaFilter)) {
      photos = visiblePhotos(state.galeriaFilter);
    } else {
      // Todas: cada carpeta base + subidas + vídeos del calendario (sin duplicar, sin ocultas)
      const seen = new Set();
      const pushUnique = (arr) => arr.forEach(u => { if (!seen.has(u) && !hidden.has(u)) { seen.add(u); photos.push(u); } });
      pushUnique(userPhotos());
      folders.forEach(f => pushUnique(basePhotos(f)));
      pushUnique(calVideos);
    }
    // Ordenación por fecha (Cloudinary v<ts> o Supabase <ms>-hash)
    if (state.galeriaSort === 'antiguas') photos.sort((a, b) => photoTs(a) - photoTs(b));
    else photos.sort((a, b) => photoTs(b) - photoTs(a));
    // Las subidas del usuario siempre van primero en 'recientes' (son lo nuevo)
    if (state.galeriaSort !== 'antiguas') {
      const ups = userPhotos();
      photos = [...ups.filter(u => photos.includes(u)), ...photos.filter(u => !ups.includes(u))];
    }
    return photos;
  }
  
  /** Título + descripción del álbum (con meta editable del usuario) */
  function galleryAlbum() {
    const folders = baseFolders();
    const meta = albumMeta();
    let title, desc, id;
    if (state.galeriaFilter === 'favoritas') { title = 'Favoritas'; desc = 'Las fotos que más me llegan al corazón.'; id = 'favoritas'; }
    else if (state.galeriaFilter === 'calendario') { title = 'Del calendario'; desc = 'Los vídeos que se desbloquean cada día en el Calendario.'; id = 'calendario'; }
    else if (state.galeriaFilter !== 'todas' && folders.includes(state.galeriaFilter)) { title = state.galeriaFilter; desc = ''; id = state.galeriaFilter; }
    else { title = meta.titulo || 'Nuestros recuerdos'; desc = meta.descripcion || 'Momentos que el cielo pinta solo para nosotros.'; id = 'todas'; }
    return {
      id,
      title: meta[`titulo:${id}`] || title,
      desc: meta[`desc:${id}`] || desc,
      portada: meta[`portada:${id}`] || ''
    };
  }
  
  function renderGaleriaContent() {
    const photos = getGalleryPhotos();
    const album = galleryAlbum();
    const folders = baseFolders();
    const calVideos = calendarVideos();
    const filterFolders = calVideos.length ? [...folders, 'calendario'] : folders;
    const filterLabel = (f) => f === 'calendario' ? '🎁 Del calendario' : f;
    const calCovers = calendarVideoCovers();
    const galleryThumb = (s) => isVideo(s) ? (calCovers.get(s) || getVideoPoster(s) || '') : s;
    // Portada: la elegida por el usuario, siempre que siga visible
    const cover = (album.portada && photos.includes(album.portada)) ? album.portada : (photos[0] || '');
    const year = photos.length ? albumYear(photos) : new Date().getFullYear();
    const favCount = state.galeriaFavs.size;
    const vidCount = photos.filter(isVideo).length;
    const fotoCount = photos.length - vidCount;
    // El hero solo recibe recursos que realmente tienen una miniatura. Así un
    // vídeo sin póster no provoca una petición accidental a la página actual.
    const heroPhotos = photos.slice(0, 5).map(galleryThumb).filter(Boolean);
  
    return `<div class="gallery-app">
      <!-- Añadir fotos (acción primaria, solo ADMIN) -->
      ${isAdmin ? `<div class="gallery-topbar">
        <button class="gallery-add-btn" id="galleryAddBtn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span class="gallery-add-label">Añadir fotos</span>
        </button>
        <input type="file" id="galleryFileInput" accept="image/*" multiple hidden>
      </div>` : ''}
  
      <!-- Hero del álbum -->
      <div class="gallery-hero" id="galleryHero">
        ${heroPhotos.length ? `
          <div class="gallery-hero-slide is-active">
            <span class="gallery-hero-loader" aria-hidden="true"></span>
            <img src="${escapeHtml(galleryThumb(cover) || heroPhotos[0])}" alt="${escapeHtml(album.title)}" class="gallery-hero-bg" loading="eager" fetchpriority="high" decoding="async" onload="this.parentElement.classList.add('is-loaded')" onerror="this.parentElement.classList.add('is-error');this.remove()">
            <span class="gallery-hero-fallback" aria-hidden="true">${ICON_SVGS['image']}</span>
          </div>
          ${heroPhotos.slice(1).map((src, i) => `<div class="gallery-hero-slide" data-slide="${i + 1}"><span class="gallery-hero-loader" aria-hidden="true"></span><img src="${escapeHtml(src)}" alt="" class="gallery-hero-bg" loading="lazy" decoding="async" onload="this.parentElement.classList.add('is-loaded')" onerror="this.parentElement.classList.add('is-error');this.remove()"><span class="gallery-hero-fallback" aria-hidden="true">${ICON_SVGS['image']}</span></div>`).join('')}
        ` : ''}
        <div class="gallery-hero-shade"></div>
        ${isAdmin ? `
        <button class="gallery-hero-edit" id="galleryEditBtn" aria-label="Editar álbum" title="Editar álbum">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>` : ''}
        <div class="gallery-hero-body">
          <h2 class="gallery-hero-title">${escapeHtml(album.title)}${state.galeriaFilter === 'favoritas' ? ' ❤️' : ''}</h2>
          ${album.desc ? `<p class="gallery-hero-desc">${escapeHtml(album.desc)}</p>` : ''}
          <div class="gallery-hero-meta">
            <span>${ICON_SVGS['camera']} ${fotoCount} ${fotoCount === 1 ? 'foto' : 'fotos'}${vidCount ? ` · ${vidCount} ${vidCount === 1 ? 'vídeo' : 'vídeos'}` : ''}</span>
            <span>${ICON_SVGS['calendar-days']} ${year}</span>
            <span>${ICON_SVGS['lock'] || '🔒'} Privado</span>
          </div>
          <div class="gallery-hero-actions">
            <button class="gallery-hero-btn gallery-hero-btn--primary" id="viewAllGalleryBtn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              <span>Ver todas</span>
            </button>
            <button class="gallery-hero-btn gallery-hero-btn--ghost" id="gallerySlideshowBtn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <span>Presentación</span>
            </button>
          </div>
        </div>
        ${heroPhotos.length > 1 ? `
          <div class="gallery-hero-dots">
            ${heroPhotos.map((_, i) => `<button class="gallery-hero-dot${i === 0 ? ' is-active' : ''}" data-dot="${i}" aria-label="Foto ${i + 1}"></button>`).join('')}
          </div>
        ` : ''}
      </div>
  
      <h2 class="section-title">Tu colección
        <span class="gallery-toolbar-actions">
          <span class="text-3" style="text-transform:none;letter-spacing:0">${photos.length} ${photos.length === 1 ? 'momento' : 'momentos'}</span>
          <button class="btn-soft btn--sm gallery-sort-btn" id="gallerySortBtn" title="Cambiar el orden de los recuerdos">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M6 12h12M10 18h4"/></svg>
            <span id="gallerySortLabel">${state.galeriaSort === 'antiguas' ? 'Más antiguas' : 'Más recientes'}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </span>
      </h2>
  
      <!-- Filtros -->
      <div class="chips gallery-filters" id="galleryFilters">
        <button class="chip gallery-filter ${state.galeriaFilter === 'todas' ? 'is-active' : ''}" data-filter="todas"${state.galeriaFilter === 'todas' ? ' aria-current="page"' : ''}>Todas</button>
        ${filterFolders.map(f => `<button class="chip gallery-filter ${state.galeriaFilter === f ? 'is-active' : ''}" data-filter="${escapeHtml(f)}"${state.galeriaFilter === f ? ' aria-current="page"' : ''}>${escapeHtml(filterLabel(f))}</button>`).join('')}
        <button class="chip gallery-filter ${state.galeriaFilter === 'favoritas' ? 'is-active' : ''}" data-filter="favoritas"${state.galeriaFilter === 'favoritas' ? ' aria-current="page"' : ''}>❤ Favoritas${favCount ? ` (${favCount})` : ''}</button>
      </div>
  
      <div class="gallery-masonry" id="galeriaGrid"></div>
      <div class="gallery-sentinel" id="gallerySentinel" aria-hidden="true"><span class="gallery-sentinel-spin"></span></div>
    </div>`;
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
      const thumb = memePoster(src);
      const media = thumb
        ? `<span class="meme-cell-loader" aria-hidden="true"></span><img src="${escapeHtml(thumb)}" alt="" loading="${imageLoading}"${imagePriority} decoding="async" onload="this.parentElement.classList.add('is-loaded')" onerror="this.parentElement.classList.add('is-error');this.remove()"><span class="meme-cell-fallback" aria-hidden="true">${ICON_SVGS['image']}</span>`
        : `<span class="meme-cell-fallback" aria-hidden="true">${isVid ? ICON_SVGS['play'] : ICON_SVGS['image']}</span>`;
      return `<div class="meme-album-cell ${isVid ? 'is-video' : ''}${thumb ? '' : ' is-no-poster'}" data-cell-index="${i}">${media}${isVid ? `<span class="meme-cell-play" aria-hidden="true">${ICON_SVGS['play']}</span>` : ''}</div>`;
    }).join('');
    const emptyCells = [...Array(Math.max(0, 4 - previews.length))].map(() => '<div class="meme-album-cell is-empty"></div>').join('');
    const coverBadge = cover && !items.slice(0, 4).includes(cover)
      ? `<div class="meme-album-cover-mini"${memePoster(cover) ? ` style="background-image:url('${escapeHtml(memePoster(cover))}')"` : ''}></div>`
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
            return `<div class="meme-album-card card animate-in" data-album="${escapeHtml(a.id)}" data-search="${escapeHtml((a.name + ' ' + a.items.join(' ')).toLowerCase())}" style="--enter-delay:${Math.min(i, 8) * 0.05}s" role="button" tabindex="0" aria-label="Abrir álbum ${escapeHtml(a.name)}">
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
