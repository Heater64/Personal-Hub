/* ==========================================
   Rincon — Memes
   Colecciones de humor, albums, favoritos y busqueda. Comparte el masonry y
   varios bindings con la Galeria: se montan sobre el mismo contenedor, asi que
   este modulo exporta tambien lo que Galeria necesita.
   ========================================== */

import { isVideo, getVideoPoster, buildMediaItems, mediaThumb } from '../../services/rincon-data.js';
import { hapticTap } from '../../services/native.service.js';
import { db } from '../../services/db.service.js';
import { showToast } from '../../components/Toast.js';
import { escapeHtml, safeUrl } from '../../utils/escape.js';
import { openLightbox, closeLightbox, playSlideshow, pauseSlideshow } from '../../components/MediaLightbox.js';
import {
  userPhotos, addUserPhotos, hidePhoto, saveFavPhotos, toggleFavPhoto,
  albumMeta, saveAlbumMeta, photoDate
} from '../../services/galleryData.js';
import {
  memeAlbums, memeItems, addMemesToAlbum, hideMeme, memePoster,
  albumMeta as memeMeta, saveAlbumMeta as saveMemeMeta, albumCover as memeAlbumCover,
  createMemeAlbum, renameMemeAlbum, deleteMemeAlbum,
  saveMemeFavs, toggleMemeFav, albumSummary, libraryStats
} from '../../services/memesData.js';
import { ICON_SVGS } from './icons.js';
import { state } from './state.js';
import { MASONRY_RATIOS } from './media.data.js';

export function createMemes(ctx) {
  const {
    page, router, isAdmin, render, galeria,
    renderMemesContent, getGalleryPhotos, calendarVideoCovers,
    galleryAlbum, renderGaleriaContent
  } = ctx;

  // ----- Álbum: cuadrícula uniforme, la misma pieza visual que los memes -----
  function renderMasonryGrid(grid, photos) {
    if (grid._galHandler) grid.removeEventListener('click', grid._galHandler);
    grid.replaceChildren();
    grid.setAttribute('aria-busy', 'true');
    if (!photos.length) {
      const onlyFavs = state.galeriaFilter === 'favoritas';
      grid.innerHTML = `
        <div class="gallery-empty">
          <div class="gallery-empty-icon">${ICON_SVGS['image']}</div>
          <h3>${onlyFavs ? 'Todavía no hay favoritas' : 'Este álbum está vacío'}</h3>
          <p>${onlyFavs ? 'Toca el corazón de cualquier foto y aparecerá aquí.' : 'Sube tus primeras fotos para empezar.'}</p>
          ${isAdmin ? `<button class="gallery-empty-btn" id="galleryEmptyAdd">${ICON_SVGS['plus'] || '＋'} Añadir fotos</button>` : ''}
        </div>`;
      grid.querySelector('#galleryEmptyAdd')?.addEventListener('click', () => document.getElementById('galleryFileInput')?.click());
      grid.setAttribute('aria-busy', 'false');
      return;
    }
    const favs = state.galeriaFavs;
    const albumTitle = galleryAlbum().title;
    const mediaItems = buildMediaItems(photos, albumTitle).map(m => ({
      ...m,
      date: photoDate(m.src),
      fav: favs.has(m.src),
      onToggleFav: () => togglePhotoFav(m.src)
    }));
    const calCovers = calendarVideoCovers();
    grid._galHandler = (e) => {
      const card = e.target.closest('.meme-album-item');
      if (!card) return;
      const favBtn = e.target.closest('.meme-item-fav');
      const menuBtn = e.target.closest('.meme-item-menu');
      if (favBtn) { e.stopPropagation(); togglePhotoFav(favBtn.dataset.url); return; }
      if (menuBtn) { e.stopPropagation(); openPhotoMenu(menuBtn.dataset.url, menuBtn); return; }
      hapticTap('light');
      openLightbox(grid._galMediaItems, Number(card.dataset.index));
    };
    grid._galMediaItems = mediaItems;
    grid.addEventListener('click', grid._galHandler);

    grid.innerHTML = photos.map((src, i) => {
      const isVid = isVideo(src);
      const poster = isVid ? (calCovers.get(src) || getVideoPoster(src, 640)) : '';
      const thumb = mediaThumb(poster || src, 640);
      const isFav = favs.has(src);
      const media = thumb
        ? `<span class="meme-item-loader" aria-hidden="true"></span><img src="${escapeHtml(thumb)}" alt="${escapeHtml(albumTitle)} ${i + 1}" loading="${i < 6 ? 'eager' : 'lazy'}"${i < 6 ? ' fetchpriority="high"' : ''} decoding="async" onload="this.parentElement.classList.add('is-loaded')" onerror="this.parentElement.classList.add('is-error');this.remove()"><span class="meme-item-fallback" aria-hidden="true">${ICON_SVGS['image']}</span>`
        : `<div class="meme-item-posterless">${isVid ? `<span class="meme-item-play">${ICON_SVGS['play']}</span>` : '🎞️'}</div>`;
      return `<article class="meme-album-item animate-in" style="--enter-delay:${(i % 12) * 25}ms" data-index="${i}">
        ${media}
        ${isVid && thumb ? `<span class="meme-item-play" aria-hidden="true">${ICON_SVGS['play']}</span>` : ''}
        <div class="meme-item-actions">
          <button class="meme-item-fav ${isFav ? 'is-on' : ''}" data-url="${escapeHtml(src)}" aria-label="${isFav ? 'Quitar de favoritas' : 'Marcar como favorita'}">${isFav ? '♥' : '♡'}</button>
          <button class="meme-item-menu" data-url="${escapeHtml(src)}" aria-label="Opciones de la foto" title="Opciones">⋮</button>
        </div>
      </article>`;
    }).join('');
    requestAnimationFrame(() => {
      grid.querySelectorAll('.meme-album-item.animate-in:not(.visible)').forEach(el => el.classList.add('visible'));
    });
    grid.setAttribute('aria-busy', 'false');
  }

  function togglePhotoFav(url) {
    const nowFav = toggleFavPhoto(url, state.galeriaFavs);
    if (nowFav) state.galeriaFavs.add(url); else state.galeriaFavs.delete(url);
    // Actualizar botones sin re-render completo
    document.querySelectorAll(`#galeriaGrid .meme-item-fav[data-url="${CSS.escape(url)}"]`).forEach(btn => {
      btn.classList.toggle('is-on', nowFav);
      btn.setAttribute('aria-label', nowFav ? 'Quitar de favoritas' : 'Marcar como favorita');
      btn.textContent = nowFav ? '♥' : '♡';
    });
    return nowFav;
  }

  // Filtra las tarjetas de álbum sin re-render (no pierde el foco del buscador)
  function applyGallerySearch(query) {
    const grid = document.querySelector('#galleryCollections');
    if (!grid) return;
    const q = query.trim().toLowerCase();
    let visible = 0;
    grid.querySelectorAll('.meme-album-card').forEach(card => {
      const match = !q || (card.dataset.search || '').includes(q);
      card.style.display = match ? '' : 'none';
      if (match) visible++;
    });
    const emptyEl = document.querySelector('#galeriaRoot .meme-search-empty');
    if (emptyEl) emptyEl.style.display = visible ? 'none' : '';
  }

  // ----- Menú ⋮ por foto -----
  function openPhotoMenu(url, anchor) {
    const rect = anchor?.getBoundingClientRect();
    const isFav = state.galeriaFavs.has(url);
    const isUserUpload = userPhotos().includes(url);
    const body = `
      <div class="photo-menu">
        <button class="photo-menu-item" data-action="fav">${isFav ? '💔 Quitar de favoritas' : '❤️ Marcar como favorita'}</button>
        ${isAdmin ? `<button class="photo-menu-item" data-action="cover">📌 Establecer como portada</button>
        <button class="photo-menu-item is-danger" data-action="delete">🗑️ Eliminar foto</button>` : ''}
      </div>`;
    const overlay = document.createElement('div');
    overlay.className = 'photo-menu-overlay';
    overlay.innerHTML = `<div class="photo-menu-sheet">
      <button class="photo-menu-close" aria-label="Cerrar">✕</button>
      ${body}
    </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.closest('.photo-menu-close')) close(); });
    overlay.querySelector('[data-action="fav"]')?.addEventListener('click', () => { togglePhotoFav(url); close(); });
    overlay.querySelector('[data-action="cover"]')?.addEventListener('click', () => {
      const album = galleryAlbum();
      saveAlbumMeta({ [`portada:${album.id}`]: url });
      close();
      showToast('Portada actualizada ✓', 'success');
      rerenderGallery();
    });
    overlay.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
      close();
      const modal = document.createElement('div');
      modal.className = 'photo-menu-overlay';
      modal.innerHTML = `<div class="photo-menu-sheet photo-menu-sheet--confirm">
        <div class="photo-confirm-icon">🗑️</div>
        <h3>¿Eliminar esta foto?</h3>
        <p>Se quitará de tu galería${isUserUpload ? '' : ' (solo de tu vista)'}. Esta acción no se puede deshacer.</p>
        <div class="photo-confirm-actions">
          <button class="gallery-hero-btn" data-cancel>Cancelar</button>
          <button class="gallery-hero-btn gallery-hero-btn--danger" data-ok>Eliminar</button>
        </div>
      </div>`;
      document.body.appendChild(modal);
      modal.querySelector('[data-cancel]').addEventListener('click', () => modal.remove());
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
      modal.querySelector('[data-ok]').addEventListener('click', () => {
        hidePhoto(url);
        state.galeriaFavs.delete(url);
        saveFavPhotos(state.galeriaFavs);
        modal.remove();
        showToast('Foto eliminada ✓', 'success');
        rerenderGallery();
      });
    });
  }
  
  // ----- Edición del álbum -----
  function openAlbumEditor() {
    const album = galleryAlbum();
    const photos = getGalleryPhotos().slice(0, 30);
    const modal = document.createElement('div');
    modal.className = 'photo-menu-overlay gallery-editor-overlay';
    modal.innerHTML = `<div class="photo-menu-sheet gallery-editor">
      <div class="gallery-editor-head">
        <h3>Editar álbum</h3>
        <button class="photo-menu-close" aria-label="Cerrar">✕</button>
      </div>
      <label class="gallery-editor-field"><span>Nombre</span><input type="text" id="galEditTitle" maxlength="40" value="${escapeHtml(album.title)}"></label>
      <label class="gallery-editor-field"><span>Descripción</span><textarea id="galEditDesc" rows="2" maxlength="120">${escapeHtml(album.desc)}</textarea></label>
      <div class="gallery-editor-field">
        <span>Portada</span>
        <div class="gallery-editor-covers">
          ${(() => {
            const calCovers = calendarVideoCovers();
            return photos.map((src, i) => {
              const isVid = isVideo(src);
              const thumb = isVid ? (calCovers.get(src) || getVideoPoster(src) || '') : src;
              return `<button class="gallery-editor-cover ${src === album.portada || (i === 0 && !album.portada) ? 'is-active' : ''}${isVid ? ' is-video' : ''}" data-src="${escapeHtml(src)}"${thumb ? ` style="background-image:url('${escapeHtml(thumb)}')"` : ''} aria-label="Usar ${isVid ? 'vídeo' : 'foto'} ${i + 1} como portada">${isVid ? `<span class="gallery-editor-cover-play">${ICON_SVGS['play']}</span>` : ''}</button>`;
            }).join('');
          })()}
        </div>
      </div>
      <div class="gallery-editor-actions">
        <button class="gallery-hero-btn" id="galEditCancel">Cancelar</button>
        <button class="gallery-hero-btn gallery-hero-btn--primary" id="galEditSave">Guardar</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.photo-menu-close').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    modal.querySelector('#galEditCancel').addEventListener('click', close);
    let chosenCover = album.portada;
    modal.querySelectorAll('.gallery-editor-cover').forEach(c => c.addEventListener('click', () => {
      modal.querySelectorAll('.gallery-editor-cover').forEach(x => x.classList.remove('is-active'));
      c.classList.add('is-active');
      chosenCover = c.dataset.src;
    }));
    modal.querySelector('#galEditSave').addEventListener('click', () => {
      saveAlbumMeta({
        [`titulo:${album.id}`]: modal.querySelector('#galEditTitle').value.trim() || album.title,
        [`desc:${album.id}`]: modal.querySelector('#galEditDesc').value.trim(),
        [`portada:${album.id}`]: chosenCover
      });
      close();
      showToast('Álbum actualizado ✓', 'success');
      rerenderGallery();
    });
  }
  
  // ----- Subida de fotos -----
  // La subida no informa de progreso real (una subida de Storage por archivo),
  // así que se enseñan tarjetas fantasma indeterminadas: una por foto. Se
  // retiran al terminar, tanto si va bien como si falla.
  function showUploadGhosts(container, count) {
    const grid = container.querySelector('#galeriaGrid');
    if (!grid || !count) return () => {};
    const ghost = document.createElement('div');
    ghost.className = 'gallery-uploading';
    ghost.innerHTML = `<p class="gallery-uploading-label">Subiendo ${count} ${count === 1 ? 'foto' : 'fotos'}…</p>
      <div class="gallery-uploading-track">${Array.from({ length: Math.min(count, 8) }).map(() => '<span class="gallery-uploading-tile" aria-hidden="true"></span>').join('')}</div>`;
    grid.prepend(ghost);
    return () => ghost.remove();
  }

  function bindGalleryUpload(container) {
    const input = container.querySelector('#galleryFileInput');
    container.querySelector('#galleryAddBtn')?.addEventListener('click', () => input?.click());
    if (input) {
      input.addEventListener('change', async () => {
        const files = [...input.files];
        input.value = '';
        if (!files.length) return;
        const clearGhosts = showUploadGhosts(container, files.length);
        try {
          showToast('Subiendo fotos…', 'info');
          const urls = await db.uploadGalleryPhotos(files);
          if (urls.length) {
            addUserPhotos(urls);
            showToast(`${urls.length} ${urls.length === 1 ? 'foto añadida' : 'fotos añadidas'} ✓`, 'success');
            rerenderGallery();
          }
        } catch (err) {
          showToast(err?.message || 'Error al subir las fotos', 'error');
        } finally {
          clearGhosts();
        }
      });
    }
  }
  
  function rerenderGallery() {
    const content = document.getElementById('galeriaMemesContent');
    if (!content) return;
    closeLightbox();
    pauseSlideshow();
    content.querySelectorAll('audio, video').forEach(media => {
      try { media.pause(); media.currentTime = 0; } catch { /* ignorar */ }
    });
    content.innerHTML = renderGaleriaContent();
    bindGaleriaEvents(content);
  }
  
  function bindGaleriaEvents(container) {
    if (!container) return;

    // Cambiar de álbum desmonta el visor y para lo que estuviera sonando antes
    // de repintar (el nodo dueño del vídeo desaparece con el render).
    const stopGalleryPlayback = () => {
      closeLightbox();
      pauseSlideshow();
      container.querySelectorAll('audio, video').forEach(media => {
        try { media.pause(); media.currentTime = 0; } catch { /* ignorar */ }
      });
    };

    // Biblioteca: abrir álbum y buscar (igual que en Memes)
    container.querySelectorAll('.meme-album-card').forEach(card => {
      const openAlbum = () => {
        stopGalleryPlayback();
        state.galeriaFilter = card.dataset.album;
        rerenderGallery();
      };
      card.addEventListener('click', openAlbum);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAlbum(); }
      });
    });
    const searchInput = container.querySelector('#gallerySearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => applyGallerySearch(searchInput.value));
    }
    requestAnimationFrame(() => {
      container.querySelectorAll('.meme-album-card.animate-in').forEach(el => el.classList.add('visible'));
    });

    const grid = container.querySelector('#galeriaGrid');
    if (grid) renderMasonryGrid(grid, getGalleryPhotos());

    bindGalleryUpload(container);

    container.querySelector('#galleryAlbumBack')?.addEventListener('click', () => {
      stopGalleryPlayback();
      state.galeriaFilter = 'todas';
      rerenderGallery();
    });
    container.querySelector('#galleryEditBtn')?.addEventListener('click', openAlbumEditor);
    container.querySelector('#gallerySortBtn')?.addEventListener('click', () => {
      stopGalleryPlayback();
      state.galeriaSort = state.galeriaSort === 'recientes' ? 'antiguas' : 'recientes';
      rerenderGallery();
    });
    container.querySelectorAll('.memes-breadcrumb-item[data-nav="landing"]').forEach(btn => {
      btn.addEventListener('click', () => router.navigate('/rincon'));
    });
  }

  function openMemeAlbumMenu(albumId) {
    const albums = memeAlbums();
    const album = albums.find(a => a.id === albumId);
    if (!album) return;
    const items = memeItems(albumId);
    const body = `
      <div class="photo-menu">
        <button class="photo-menu-item" data-action="open">📂 Abrir álbum</button>
        ${isAdmin && album.isUser ? `<button class="photo-menu-item" data-action="edit">✏️ Editar álbum</button>` : ''}
        ${isAdmin ? `<button class="photo-menu-item" data-action="add">＋ Añadir memes</button>` : ''}
        ${isAdmin ? `<button class="photo-menu-item" data-action="cover">📌 Cambiar portada</button>` : ''}
        ${isAdmin && album.isUser ? `<button class="photo-menu-item is-danger" data-action="delete">🗑️ Eliminar álbum</button>` : ''}
      </div>`;
    const overlay = document.createElement('div');
    overlay.className = 'photo-menu-overlay';
    overlay.innerHTML = `<div class="photo-menu-sheet">
      <button class="photo-menu-close" aria-label="Cerrar">✕</button>
      ${body}
    </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.closest('.photo-menu-close')) close(); });
    overlay.querySelector('[data-action="open"]')?.addEventListener('click', () => { close(); openMemeAlbum(albumId); });
    overlay.querySelector('[data-action="edit"]')?.addEventListener('click', () => { close(); openMemeAlbumEditor(albumId); });
    overlay.querySelector('[data-action="add"]')?.addEventListener('click', () => { close(); openMemeAlbum(albumId); requestMemeUpload(); });
    overlay.querySelector('[data-action="cover"]')?.addEventListener('click', () => { close(); openMemeCoverPicker(albumId, items); });
    overlay.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
      close();
      const modal = document.createElement('div');
      modal.className = 'photo-menu-overlay';
      modal.innerHTML = `<div class="photo-menu-sheet photo-menu-sheet--confirm">
        <div class="photo-confirm-icon">🗑️</div>
        <h3>¿Eliminar el álbum?</h3>
        <p>"${escapeHtml(album.name)}" y sus memes subidos se eliminarán. Esta acción no se puede deshacer.</p>
        <div class="photo-confirm-actions">
          <button class="gallery-hero-btn" data-cancel>Cancelar</button>
          <button class="gallery-hero-btn gallery-hero-btn--danger" data-ok>Eliminar</button>
        </div>
      </div>`;
      document.body.appendChild(modal);
      modal.querySelector('[data-cancel]').addEventListener('click', () => modal.remove());
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
      modal.querySelector('[data-ok]').addEventListener('click', () => {
        deleteMemeAlbum(albumId);
        modal.remove();
        showToast('Álbum eliminado ✓', 'success');
        rerenderMemes();
      });
    });
  }
  
  function openMemeCoverPicker(albumId, items) {
    if (!items.length) { showToast('Este álbum no tiene memes todavía', 'info'); return; }
    const modal = document.createElement('div');
    modal.className = 'photo-menu-overlay gallery-editor-overlay';
    modal.innerHTML = `<div class="photo-menu-sheet gallery-editor">
      <div class="gallery-editor-head"><h3>Elegir portada</h3><button class="photo-menu-close" aria-label="Cerrar">✕</button></div>
      <p class="gallery-editor-hint">Selecciona el meme que quieres como portada del álbum.</p>
      <div class="gallery-editor-covers">
        ${items.slice(0, 24).map((src, i) => `<button class="gallery-editor-cover ${src === memeAlbumCover(albumId, items) ? 'is-active' : ''}" data-src="${escapeHtml(src)}"${memePoster(src) ? ` style="background-image:url('${escapeHtml(memePoster(src))}')"` : ' style="background:#eee;display:flex;align-items:center;justify-content:center;font-size:1.4rem"'} aria-label="Usar meme ${i + 1} como portada">${memePoster(src) ? '' : '▶'}</button>`).join('')}
      </div>
      <div class="gallery-editor-actions">
        <button class="gallery-hero-btn" id="galEditCancel">Cancelar</button>
        <button class="gallery-hero-btn gallery-hero-btn--primary" id="galEditSave">Guardar</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.photo-menu-close').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    modal.querySelector('#galEditCancel').addEventListener('click', close);
    let chosen = memeAlbumCover(albumId, items);
    modal.querySelectorAll('.gallery-editor-cover').forEach(c => c.addEventListener('click', () => {
      modal.querySelectorAll('.gallery-editor-cover').forEach(x => x.classList.remove('is-active'));
      c.classList.add('is-active');
      chosen = c.dataset.src;
    }));
    modal.querySelector('#galEditSave').addEventListener('click', () => {
      saveMemeMeta({ [`portada:${albumId}`]: chosen });
      close();
      showToast('Portada actualizada ✓', 'success');
      rerenderMemes();
    });
  }
  
  function openMemeAlbumEditor(albumId = null) {
    const albums = memeAlbums();
    const album = albumId ? albums.find(a => a.id === albumId) : null;
    const modal = document.createElement('div');
    modal.className = 'photo-menu-overlay gallery-editor-overlay';
    modal.innerHTML = `<div class="photo-menu-sheet gallery-editor">
      <div class="gallery-editor-head">
        <h3>${album ? 'Editar álbum' : 'Nuevo álbum'}</h3>
        <button class="photo-menu-close" aria-label="Cerrar">✕</button>
      </div>
      <label class="gallery-editor-field"><span>Nombre</span><input type="text" id="memeEditName" maxlength="40" placeholder="Ej. Animales, Random, Te amo…" value="${album ? escapeHtml(album.name) : ''}"></label>
      <label class="gallery-editor-field"><span>Descripción <em>(opcional)</em></span><textarea id="memeEditDesc" rows="2" maxlength="120" placeholder="Una frase que describa este álbum">${album ? escapeHtml((memeMeta()['desc:' + albumId]) || '') : ''}</textarea></label>
      <div class="gallery-editor-actions">
        <button class="gallery-hero-btn" id="galEditCancel">Cancelar</button>
        <button class="gallery-hero-btn gallery-hero-btn--primary" id="galEditSave">${album ? 'Guardar' : 'Crear álbum'}</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.photo-menu-close').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    modal.querySelector('#galEditCancel').addEventListener('click', close);
    modal.querySelector('#galEditSave').addEventListener('click', () => {
      const name = modal.querySelector('#memeEditName').value.trim();
      const desc = modal.querySelector('#memeEditDesc').value.trim();
      if (!name) { showToast('El nombre es obligatorio', 'error'); return; }
      if (album) {
        renameMemeAlbum(album.id, name, desc);
        saveMemeMeta({ [`desc:${album.id}`]: desc });
        showToast('Álbum actualizado ✓', 'success');
      } else {
        const created = createMemeAlbum(name, desc);
        saveMemeMeta({ [`desc:${created.id}`]: desc });
        showToast('Álbum creado ✓', 'success');
        close();
        rerenderMemes();
        openMemeAlbum(created.id);
        return;
      }
      close();
      rerenderMemes();
    });
  }
  
  function rerenderMemes() {
    const content = document.getElementById('galeriaMemesContent');
    if (!content) return;
    content.innerHTML = renderMemesContent();
    bindMemesEvents(content);
  }
  
  function requestMemeUpload() {
    document.getElementById('memeFileInput')?.click();
  }
  
  function bindMemeUpload(container, albumId) {
    const input = container.querySelector('#memeFileInput');
    if (!input) return;
    input.addEventListener('change', async () => {
      const files = [...input.files];
      input.value = '';
      if (!files.length) return;
      try {
        showToast('Subiendo memes…', 'info');
        const urls = await db.uploadMemes(files);
        if (urls.length) {
          addMemesToAlbum(albumId, urls);
          showToast(`${urls.length} ${urls.length === 1 ? 'meme añadido' : 'memes añadidos'} ✓`, 'success');
          // Mantener al usuario dentro del álbum tras subir
          openMemeAlbum(albumId);
        }
      } catch (err) {
        showToast(err?.message || 'Error al subir los memes', 'error');
      }
    });
  }
  
  function openMemeAlbum(albumId) {
    state.memeAlbumId = albumId;
    state.memeFilter = 'todos';
    const content = document.getElementById('galeriaMemesContent');
    if (!content) return;
    content.innerHTML = renderMemeAlbumView(albumId);
    bindMemeAlbumEvents(content, albumId);
  }
  
  function renderMemeAlbumView(albumId) {
    const albums = memeAlbums();
    const album = albums.find(a => a.id === albumId) || { id: albumId, name: albumId, isUser: false };
    const allItems = memeItems(albumId);
    let items = allItems;
    if (state.memeFilter === 'fotos') items = items.filter(u => !isVideo(u));
    if (state.memeFilter === 'videos') items = items.filter(u => isVideo(u));
    const s = albumSummary(allItems);
    const desc = (memeMeta()['desc:' + albumId]) || '';
    return `<div class="meme-album-view" id="memeAlbumRoot">
      <div class="memes-breadcrumb">
        <button class="memes-breadcrumb-item" data-nav="landing">El Rincón</button>
        <span class="memes-breadcrumb-sep">/</span>
        <button class="memes-breadcrumb-item" id="memeAlbumBackBtn">Memes</button>
        <span class="memes-breadcrumb-sep">/</span>
        <span class="memes-breadcrumb-current">${escapeHtml(album.name)}</span>
      </div>
      <header class="meme-album-head">
        <div>
          <h2 class="meme-album-title">${escapeHtml(album.name)}</h2>
          ${desc ? `<p class="meme-album-desc">${escapeHtml(desc)}</p>` : ''}
          <p class="meme-album-meta">${s.total} ${s.total === 1 ? 'meme' : 'memes'} · ${s.typeLabel}</p>
        </div>
        <div class="meme-album-actions">
          ${isAdmin ? `
          <button class="gallery-hero-btn gallery-hero-btn--primary" id="memeAlbumAddBtn">＋ Añadir</button>
          <button class="meme-album-menu-btn" id="memeAlbumMenuBtn" aria-label="Opciones del álbum">⋮</button>
          <input type="file" id="memeFileInput" accept="image/*,video/*" multiple hidden>` : ''}
        </div>
      </header>
      <div class="meme-album-filters" role="tablist" aria-label="Filtrar contenido">
        <button class="meme-filter-chip ${state.memeFilter === 'todos' ? 'is-active' : ''}" data-filter="todos">Todos (${allItems.length})</button>
        <button class="meme-filter-chip ${state.memeFilter === 'fotos' ? 'is-active' : ''}" data-filter="fotos">Fotos (${s.fotos})</button>
        <button class="meme-filter-chip ${state.memeFilter === 'videos' ? 'is-active' : ''}" data-filter="videos">Vídeos (${s.videos})</button>
      </div>
      <div class="meme-album-grid" id="memeAlbumGrid">${items.length ? '' : `<div class="meme-empty-album"><div class="meme-empty-icon">${ICON_SVGS['smile']}</div><h3>Este álbum está vacío</h3><p>Añade tus primeros memes para llenarlo de risas.</p>${isAdmin ? `<button class="meme-add-album" id="memeEmptyAddBtn">＋ Añadir memes</button>` : ''}</div>`}</div>
    </div>`;
  }
  
  function bindMemeAlbumEvents(container, albumId) {
    if (!container) return;
    const allItems = memeItems(albumId);
    let items = allItems;
    if (state.memeFilter === 'fotos') items = items.filter(u => !isVideo(u));
    if (state.memeFilter === 'videos') items = items.filter(u => isVideo(u));
    const mediaItems = buildMediaItems(items, albumId).map(m => ({
      ...m,
      fav: state.memeFavs.has(m.src),
      onToggleFav: () => toggleMemeItemFav(m.src)
    }));
    const grid = container.querySelector('#memeAlbumGrid');
    if (grid) {
      grid.setAttribute('aria-busy', 'true');
      if (grid._memeHandler) grid.removeEventListener('click', grid._memeHandler);
      grid._memeHandler = (e) => {
        const item = e.target.closest('.meme-album-item');
        if (!item) return;
        const favBtn = e.target.closest('.meme-item-fav');
        const delBtn = e.target.closest('.meme-item-del');
        if (favBtn) { e.stopPropagation(); toggleMemeItemFav(favBtn.dataset.url); return; }
        if (delBtn) { e.stopPropagation(); confirmDeleteMeme(albumId, delBtn.dataset.url); return; }
        openLightbox(mediaItems, Number(item.dataset.index));
      };
      grid.addEventListener('click', grid._memeHandler);
      // Si no hay items, el empty state ya está renderizado por renderMemeAlbumView
      if (items.length) {
      grid.innerHTML = items.map((src, i) => {
        const isVid = isVideo(src);
        const poster = memePoster(src);
        const isFav = state.memeFavs.has(src);
        const loading = i < 6 ? 'eager' : 'lazy';
        const priority = i < 6 ? ' fetchpriority="high"' : '';
        const media = poster
          ? `<span class="meme-item-loader" aria-hidden="true"></span><img src="${escapeHtml(poster)}" alt="Meme ${i + 1}" loading="${loading}"${priority} decoding="async" onload="this.parentElement.classList.add('is-loaded')" onerror="this.parentElement.classList.add('is-error');this.remove()"><span class="meme-item-fallback" aria-hidden="true">${ICON_SVGS['image']}</span>`
          : `<div class="meme-item-posterless">${isVid ? `<span class="meme-item-play">${ICON_SVGS['play']}</span>` : '🎞️'}</div>`;
        return `<article class="meme-album-item animate-in" style="--enter-delay:${(i % 12) * 25}ms" data-index="${i}">
          ${media}
          ${isVid && poster ? `<span class="meme-item-play">${ICON_SVGS['play']}</span>` : ''}
          <div class="meme-item-actions">
            <button class="meme-item-fav ${isFav ? 'is-on' : ''}" data-url="${escapeHtml(src)}" aria-label="${isFav ? 'Quitar de favoritos' : 'Marcar como favorito'}">${isFav ? '♥' : '♡'}</button>
            ${isAdmin ? `<button class="meme-item-del" data-url="${escapeHtml(src)}" aria-label="Eliminar meme" title="Eliminar">🗑</button>` : ''}
          </div>
        </article>`;
      }).join('');
        requestAnimationFrame(() => { grid.querySelectorAll('.meme-album-item.animate-in').forEach(el => el.classList.add('visible')); });
      }
      grid.setAttribute('aria-busy', 'false');
    }
    container.querySelector('#memeAlbumBackBtn')?.addEventListener('click', () => { rerenderMemes(); });
    container.querySelectorAll('.memes-breadcrumb-item[data-nav="landing"]').forEach(btn => {
      btn.addEventListener('click', () => router.navigate('/rincon'));
    });
    container.querySelector('#memeAlbumAddBtn')?.addEventListener('click', () => requestMemeUpload());
    container.querySelector('#memeEmptyAddBtn')?.addEventListener('click', () => requestMemeUpload());
    container.querySelector('#memeAlbumMenuBtn')?.addEventListener('click', () => openMemeAlbumMenu(albumId));
    container.querySelectorAll('.meme-filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        state.memeFilter = chip.dataset.filter;
        const view = container.querySelector('#memeAlbumRoot');
        if (view) {
          container.innerHTML = renderMemeAlbumView(albumId);
          bindMemeAlbumEvents(container, albumId);
        }
      });
    });
    bindMemeUpload(container, albumId);
  }
  
  function toggleMemeItemFav(url) {
    const nowFav = toggleMemeFav(url, state.memeFavs);
    if (nowFav) state.memeFavs.add(url); else state.memeFavs.delete(url);
    document.querySelectorAll(`.meme-item-fav[data-url="${CSS.escape(url)}"]`).forEach(btn => {
      btn.classList.toggle('is-on', nowFav);
      btn.textContent = nowFav ? '♥' : '♡';
      btn.setAttribute('aria-label', nowFav ? 'Quitar de favoritos' : 'Marcar como favorito');
    });
  }
  
  function confirmDeleteMeme(albumId, url) {
    const modal = document.createElement('div');
    modal.className = 'photo-menu-overlay';
    modal.innerHTML = `<div class="photo-menu-sheet photo-menu-sheet--confirm">
      <div class="photo-confirm-icon">🗑️</div>
      <h3>¿Eliminar este meme?</h3>
      <p>Se quitará del álbum. Esta acción no se puede deshacer.</p>
      <div class="photo-confirm-actions">
        <button class="gallery-hero-btn" data-cancel>Cancelar</button>
        <button class="gallery-hero-btn gallery-hero-btn--danger" data-ok>Eliminar</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-cancel]').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    modal.querySelector('[data-ok]').addEventListener('click', () => {
      hideMeme(albumId, url);
      state.memeFavs.delete(url);
      saveMemeFavs(state.memeFavs);
      modal.remove();
      showToast('Meme eliminado ✓', 'success');
      openMemeAlbum(albumId);
    });
  }
  
  // Filtra las tarjetas del grid sin re-render (no pierde el foco del buscador)
  function applyMemeSearch(query) {
    const grid = document.querySelector('.meme-albums-grid');
    if (!grid) return;
    const q = query.trim().toLowerCase();
    let visible = 0;
    grid.querySelectorAll('.meme-album-card').forEach(card => {
      const haystack = (card.textContent || '').toLowerCase();
      const show = !q || haystack.includes(q);
      card.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    const emptyEl = document.querySelector('.meme-search-empty');
    if (emptyEl) emptyEl.style.display = visible ? 'none' : '';
    const countEl = document.querySelector('.memes-library-count');
    if (countEl && visible !== grid.querySelectorAll('.meme-album-card').length) {
      const total = libraryStats();
      countEl.textContent = `${visible} de ${total.memes} memes · ${total.albums} álbumes`;
    }
  }
  
  function bindMemesEvents(container) {
    if (!container) return;
    // Breadcrumb navigation
    container.querySelectorAll('.memes-breadcrumb-item[data-nav="landing"]').forEach(btn => {
      btn.addEventListener('click', () => router.navigate('/rincon'));
    });
    // Buscador instantáneo (filtra el grid existente, sin perder el foco)
    const searchInput = container.querySelector('#memeSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        state.memeQuery = searchInput.value;
        applyMemeSearch(state.memeQuery);
      });
    }
    // Ordenación
    const sortBtn = container.querySelector('#memeSortBtn');
    if (sortBtn) {
      sortBtn.addEventListener('click', () => {
        state.memeSort = state.memeSort === 'recientes' ? 'antiguos' : state.memeSort === 'antiguos' ? 'nombre' : 'recientes';
        rerenderMemes();
      });
    }
    // Crear álbum
    container.querySelector('#memeAddAlbumBtn')?.addEventListener('click', () => openMemeAlbumEditor());
    container.querySelector('#memeEmptyAddBtn')?.addEventListener('click', () => openMemeAlbumEditor());
    container.querySelector('#memeCtaBtn')?.addEventListener('click', () => openMemeAlbumEditor());
    // Tarjetas de álbum + menú
    container.querySelectorAll('.meme-album-card').forEach(card => {
      const openIt = () => openMemeAlbum(card.dataset.album);
      card.addEventListener('click', (e) => {
        if (e.target.closest('.meme-album-menu')) return;
        openIt();
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openIt(); }
      });
    });
    container.querySelectorAll('.meme-album-menu').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openMemeAlbumMenu(btn.dataset.menu);
      });
    });
    // Entrada escalonada — las tarjetas deben recibir 'visible' para animarse
    requestAnimationFrame(() => {
      container.querySelectorAll('.meme-album-card.animate-in').forEach(el => el.classList.add('visible'));
    });
  }
  
  return {
    renderMasonryGrid,
    bindGalleryUpload,
    bindGaleriaEvents,
    togglePhotoFav,
    openPhotoMenu,
    openAlbumEditor,
    rerenderGallery,
    openMemeAlbumMenu,
    openMemeCoverPicker,
    openMemeAlbumEditor,
    rerenderMemes,
    requestMemeUpload,
    bindMemeUpload,
    openMemeAlbum,
    renderMemeAlbumView,
    bindMemeAlbumEvents,
    toggleMemeItemFav,
    confirmDeleteMeme,
    applyMemeSearch,
    applyGallerySearch,
    bindMemesEvents
  };
}
