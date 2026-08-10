/* ==========================================
   Personal Hub v2 — Media Lightbox Pro
   Zoom · Fullscreen · Thumbnail strip · Desktop-optimized
   ========================================== */

let state = {
  items: [],
  currentIndex: 0,
  rotation: 0,
  videoEl: null,
  zoom: 1,
  panX: 0,
  panY: 0,
  isPanning: false,
  lastTap: 0
};

// ==========================================
// SLIDESHOW — presentación automática
// ==========================================
let slideshowTimer = null;
let slideshowMs = 5000;
let slideshowActive = false;
let slideshowVideo = null;
let slideshowVideoEnded = null;

function clearSlideshowVideoBinding() {
  if (!slideshowVideo) return;
  if (slideshowVideoEnded) slideshowVideo.removeEventListener('ended', slideshowVideoEnded);
  // Fuera de presentación, el visor conserva su comportamiento de repetición.
  slideshowVideo.loop = true;
  slideshowVideo = null;
  slideshowVideoEnded = null;
}

function startSlideshow(ms = 5000) {
  stopSlideshow();
  slideshowMs = Number.isFinite(ms) ? Math.max(0, ms) : 5000;
  slideshowActive = true;
  scheduleSlideshow();
}

function stopSlideshow() {
  if (slideshowTimer) { clearTimeout(slideshowTimer); slideshowTimer = null; }
  slideshowActive = false;
  clearSlideshowVideoBinding();
}

/** Programa el siguiente avance según el tipo de contenido actual. */
function scheduleSlideshow() {
  if (!slideshowActive) return;
  if (!document.getElementById('mediaLightbox')?.classList.contains('open')) {
    stopSlideshow();
    return;
  }
  if (state.items.length <= 1) return;

  if (slideshowTimer) { clearTimeout(slideshowTimer); slideshowTimer = null; }
  const item = getItem();

  if (item?.type === 'video') {
    const video = state.videoEl;
    if (!video) {
      // render() aún no ha terminado de montar el reproductor.
      slideshowTimer = setTimeout(scheduleSlideshow, 50);
      return;
    }
    if (slideshowVideo === video) return;
    clearSlideshowVideoBinding();
    video.loop = false;
    slideshowVideo = video;
    slideshowVideoEnded = () => {
      slideshowVideo = null;
      slideshowVideoEnded = null;
      if (slideshowActive) nextMedia();
    };
    video.addEventListener('ended', slideshowVideoEnded, { once: true });
    return;
  }

  clearSlideshowVideoBinding();
  slideshowTimer = setTimeout(() => {
    slideshowTimer = null;
    if (slideshowActive) nextMedia();
  }, slideshowMs);
}

/** Reinicia la espera tras una navegación manual (el usuario manda). */
function pokeSlideshow() {
  if (slideshowActive) scheduleSlideshow();
}

// ==========================================
// PRELOAD — estilo TikTok: los vecinos ya cargados
// ==========================================
let preloadPool = [];

function clearPreloadPool() {
  preloadPool.forEach(p => {
    if (p && p.tagName === 'VIDEO') { try { p.pause(); p.removeAttribute('src'); p.load(); } catch (e) {} }
  });
  preloadPool = [];
}

/**
 * Precarga imágenes/vídeos vecinos (2 siguientes + 1 anterior) para que
 * al navegar ya estén listos, ahorrando esperas — patrón TikTok.
 */
function preloadAround(idx) {
  clearPreloadPool();
  const items = state.items;
  if (!items?.length) return;
  const targets = [idx + 1, idx + 2, idx - 1];
  targets.forEach(t => {
    const i = ((t % items.length) + items.length) % items.length;
    const item = items[i];
    if (!item || i === idx) return;
    if (item.type === 'video') {
      const v = document.createElement('video');
      v.preload = 'auto';
      v.muted = true;
      const s = document.createElement('source');
      s.src = item.src;
      s.type = detectMime(item.src);
      v.appendChild(s);
      try { v.load(); } catch (e) {}
      preloadPool.push(v);
    } else {
      const img = new Image();
      img.src = lightboxSrc(item.src);
      img.decoding = 'async';
      preloadPool.push(img);
    }
  });
}

// Cloudinary helper: generate optimized URL for lightbox (full quality)
function lightboxSrc(src) {
  if (!src) return src;
  if (src.includes('res.cloudinary.com') && src.includes('/image/upload/')) {
    return src.replace('/image/upload/', '/image/upload/q_auto:best,f_auto,dpr_auto,c_limit,w_1920/');
  }
  return src;
}

function detectMime(src) {
  if (/\.webm(\?.*)?$/i.test(src)) return 'video/webm';
  if (/\.mov(\?.*)?$/i.test(src)) return 'video/quicktime';
  return 'video/mp4';
}

function getItem() { return state.items[state.currentIndex]; }

// ==========================================
// VIDEO PLAYER — reutilizable (galería + calendario)
// ==========================================
const VIDEO_CTRL_HTML = `
  <button class="ml-vc-btn ml-vc-play" title="Reproducir / Pausar" aria-label="Reproducir">
    <svg class="ml-vc-play-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    <svg class="ml-vc-pause-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="display:none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
  </button>
  <span class="ml-vc-time">0:00</span>
  <div class="ml-vc-progress">
    <div class="ml-vc-progress-track">
      <div class="ml-vc-progress-fill"></div>
      <div class="ml-vc-progress-thumb"></div>
    </div>
  </div>
  <span class="ml-vc-time ml-vc-time--total">0:00</span>
  <button class="ml-vc-btn ml-vc-volume" title="Silenciar" aria-label="Silenciar">
    <svg class="ml-vc-vol-on" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
    <svg class="ml-vc-vol-off" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
  </button>
`;

/**
 * Construye un reproductor de vídeo completo con la barra de control glass
 * (play/pausa, progreso, tiempo, volumen) y overlay de play.
 * El vídeo se reproduce automáticamente con sonido (gesto del usuario).
 * Devuelve { wrap, video, playOverlay }.
 */
export function buildVideoPlayer(opts = {}) {
  const { src = '', poster = '', autoplay = true, loop = true, className = 'ml-media' } = opts;
  const wrap = document.createElement('div');
  wrap.className = 'ml-video-wrap';

  const video = document.createElement('video');
  video.className = className;
  video.preload = 'auto';
  video.playsInline = true;
  video.loop = loop;
  video.autoplay = autoplay;
  video.muted = false;
  if (poster) video.poster = poster;
  const source = document.createElement('source');
  source.src = src;
  source.type = detectMime(src);
  video.appendChild(source);

  const ctrlBar = document.createElement('div');
  ctrlBar.className = 'ml-video-controls';
  ctrlBar.innerHTML = VIDEO_CTRL_HTML;

  const playOverlay = document.createElement('button');
  playOverlay.className = 'ml-video-play-overlay';
  playOverlay.title = 'Reproducir';
  playOverlay.setAttribute('aria-label', 'Reproducir video');
  playOverlay.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  playOverlay.addEventListener('click', (e) => {
    e.stopPropagation();
    video.play();
    playOverlay.classList.add('hidden');
  });

  wrap.appendChild(video);
  wrap.appendChild(playOverlay);
  wrap.appendChild(ctrlBar);

  // Reproducción inmediata con sonido (gesto del usuario que abrió el reproductor)
  if (autoplay) {
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
  }

  bindVideoControls(video, ctrlBar, wrap, playOverlay);

  /** Libera el reproductor: pausa, suelta recursos y limpia listeners */
  function destroy() {
    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch (e) {}
    ctrlBar._calCleanupDrag?.();
  }

  return { wrap, video, playOverlay, destroy };
}

// ==========================================
// RENDER
// ==========================================
function render() {
  const box = document.getElementById('mediaLightbox');
  const content = document.getElementById('mlContent');
  const caption = document.getElementById('mlCaption');
  const counter = document.getElementById('mlCounter');
  const thumbs = document.getElementById('mlThumbs');
  const fullscreenBtn = document.getElementById('mlFullscreenBtn');
  if (!box || !content) return;

  const item = getItem();
  if (!item) return;

  // Favorito opcional — solo se muestra si los items lo soportan
  const favBtn = document.getElementById('mlFavBtn');
  if (favBtn) {
    const supportsFav = typeof item.fav === 'boolean' && typeof item.onToggleFav === 'function';
    favBtn.style.display = supportsFav ? 'flex' : 'none';
    if (supportsFav) {
      favBtn.classList.toggle('is-on', item.fav);
      favBtn.setAttribute('aria-label', item.fav ? 'Quitar de favoritas' : 'Marcar como favorita');
    }
  }

  // Cleanup old video (destruye listeners de arrastre del reproductor anterior)
  if (state._videoDestroy) { try { state._videoDestroy(); } catch(e) {} state._videoDestroy = null; }
  if (state.videoEl) { state.videoEl = null; }
  // Cleanup listeners de arrastre/zoom del render anterior (evita fugas acumuladas)
  if (state._imgCleanup) { try { state._imgCleanup(); } catch(e) {} state._imgCleanup = null; }
  content.innerHTML = '';
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  state.rotation = 0;
  box.classList.toggle('is-video', item.type === 'video');

  const updateImageTransform = (img) => {
    img.style.transform = `rotate(${state.rotation}deg) scale(${state.zoom}) translate(${state.panX}px, ${state.panY}px)`;
  };

  if (item.type === 'video') {
    const player = buildVideoPlayer({ src: item.src, loop: !slideshowActive });
    content.appendChild(player.wrap);
    state.videoEl = player.video;
    state._videoDestroy = player.destroy;
  } else {
    const wrap = document.createElement('div');
    wrap.className = 'ml-image-wrap';

    const img = document.createElement('img');
    img.className = 'ml-media';
    img.src = lightboxSrc(item.src);
    img.alt = item.caption || '';
    img.loading = 'eager';
    img.draggable = false;
    img.addEventListener('load', () => updateImageTransform(img), { once: true });
    img.addEventListener('dblclick', (e) => {
      e.preventDefault();
      toggleZoom(img);
    });

    // Zoom on scroll (desktop)
    img.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.2 : 0.2;
      state.zoom = Math.max(1, Math.min(4, state.zoom + delta));
      updateImageTransform(img);
    }, { passive: false });

    // Pan on drag (when zoomed) — listeners de window se registran una vez por
    // render y se limpian en el siguiente (state._imgCleanup) para no acumular fugas.
    let dragging = false, sx = 0, sy = 0;
    const onMove = (e) => {
      if (!dragging) return;
      state.panX = e.clientX - sx; state.panY = e.clientY - sy;
      updateImageTransform(img);
    };
    const onUp = () => {
      dragging = false; img.style.cursor = state.zoom > 1 ? 'grab' : 'default';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    state._imgCleanup = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    img.addEventListener('mousedown', (e) => {
      if (state.zoom <= 1) return;
      dragging = true; sx = e.clientX - state.panX; sy = e.clientY - state.panY;
      img.style.cursor = 'grabbing';
      e.preventDefault();
    });

    // Touch pinch zoom
    let pinchStartDist = 0, pinchStartZoom = 1;
    img.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        pinchStartDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        pinchStartZoom = state.zoom;
      }
    }, { passive: true });
    img.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && pinchStartDist > 0) {
        const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        state.zoom = Math.max(1, Math.min(4, pinchStartZoom * (dist / pinchStartDist)));
        updateImageTransform(img);
      }
    }, { passive: true });
    img.addEventListener('touchend', () => { pinchStartDist = 0; });

    // Rotate button
    const rotBtn = document.createElement('button');
    rotBtn.className = 'ml-rotate-btn';
    rotBtn.title = 'Girar';
    rotBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>';
    rotBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.rotation = (state.rotation + 90) % 360;
      updateImageTransform(img);
    });

    // Zoom buttons
    const zoomInBtn = document.createElement('button');
    zoomInBtn.className = 'ml-zoom-btn ml-zoom-in';
    zoomInBtn.title = 'Acercar';
    zoomInBtn.innerHTML = '+';
    zoomInBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.zoom = Math.min(4, state.zoom + 0.5);
      updateImageTransform(img);
    });

    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.className = 'ml-zoom-btn ml-zoom-out';
    zoomOutBtn.title = 'Alejar';
    zoomOutBtn.innerHTML = '−';
    zoomOutBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.zoom = Math.max(1, state.zoom - 0.5);
      if (state.zoom === 1) { state.panX = 0; state.panY = 0; }
      updateImageTransform(img);
    });

    const zoomLabel = document.createElement('span');
    zoomLabel.className = 'ml-zoom-label';
    zoomLabel.id = 'mlZoomLabel';
    zoomLabel.textContent = '100%';
    zoomLabel.style.display = 'none';

    const updateZoomLabel = () => {
      zoomLabel.textContent = Math.round(state.zoom * 100) + '%';
      zoomLabel.style.display = state.zoom === 1 ? 'none' : '';
      zoomOutBtn.classList.toggle('is-disabled', state.zoom <= 1);
    };
    zoomInBtn.addEventListener('click', () => setTimeout(updateZoomLabel, 50));
    zoomOutBtn.addEventListener('click', () => setTimeout(updateZoomLabel, 50));
    rotBtn.addEventListener('click', () => setTimeout(updateZoomLabel, 50));

    // Glass control cluster
    const ctrlCluster = document.createElement('div');
    ctrlCluster.className = 'ml-img-controls';
    ctrlCluster.appendChild(rotBtn);
    ctrlCluster.appendChild(zoomInBtn);
    ctrlCluster.appendChild(zoomOutBtn);

    wrap.appendChild(img);
    wrap.appendChild(ctrlCluster);
    wrap.appendChild(zoomLabel);
    content.appendChild(wrap);
  }

  // Update info
  if (caption) caption.textContent = item.caption || '';
  if (counter) counter.textContent = `${state.currentIndex + 1} / ${state.items.length}`;

  // Update thumbnail strip
  if (thumbs && state.items.length > 1) {
    thumbs.innerHTML = state.items.map((it, i) => {
      const thumbSrc = it.type === 'video'
        ? (it.src.includes('cloudinary') ? it.src.replace('/video/upload/', '/video/upload/f_jpg,so_auto,c_thumb,w_120/').replace(/\.\w+(\?.*)?$/, '.jpg') : '')
        : (it.src.includes('cloudinary') ? it.src.replace('/image/upload/', '/image/upload/c_thumb,w_120/') : it.src);
      return `<button class="ml-thumb ${i === state.currentIndex ? 'active' : ''}" data-index="${i}" title="${it.caption || ''}">
        ${thumbSrc ? `<img src="${thumbSrc}" alt="" loading="lazy">` : `<span class="ml-thumb-placeholder">${it.type === 'video' ? '▶' : '🖼'}</span>`}
      </button>`;
    }).join('');

    // Scroll active thumb into view
    const activeThumb = thumbs.querySelector('.ml-thumb.active');
    if (activeThumb) activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });

    // Bind thumb clicks
    thumbs.querySelectorAll('.ml-thumb').forEach(btn => {
      btn.addEventListener('click', () => {
        state.currentIndex = Number(btn.dataset.index);
        render();
        pokeSlideshow();
      });
    });
  }

  // Precarga de vecinos (TikTok-style) para que navegar sea instantáneo
  preloadAround(state.currentIndex);

  // Nav buttons visibility
  const prevBtn = document.getElementById('mlPrevBtn');
  const nextBtn = document.getElementById('mlNextBtn');
  if (prevBtn) prevBtn.style.display = state.items.length <= 1 ? 'none' : 'flex';
  if (nextBtn) nextBtn.style.display = state.items.length <= 1 ? 'none' : 'flex';

  // Fullscreen button
  if (fullscreenBtn) fullscreenBtn.style.display = item.type === 'video' ? 'flex' : 'flex';

  // La presentación se programa después de montar el medio actual:
  // fotos esperan 5s y vídeos avanzan en su evento "ended".
  scheduleSlideshow();
}

function toggleZoom(img) {
  if (state.zoom > 1) { state.zoom = 1; state.panX = 0; state.panY = 0; }
  else state.zoom = 2.5;
  img.style.transform = `rotate(${state.rotation}deg) scale(${state.zoom}) translate(${state.panX}px, ${state.panY}px)`;
  const zoomLabel = document.getElementById('mlZoomLabel');
  if (zoomLabel) {
    zoomLabel.textContent = Math.round(state.zoom * 100) + '%';
    zoomLabel.style.display = state.zoom === 1 ? 'none' : '';
  }
}

// ==========================================
// VIDEO CONTROLS — Custom bar: play/pause, progress, time, volume
// ==========================================
function bindVideoControls(video, ctrlBar, wrap, playOverlay) {
  const playBtn = ctrlBar.querySelector('.ml-vc-play');
  const playIcon = ctrlBar.querySelector('.ml-vc-play-icon');
  const pauseIcon = ctrlBar.querySelector('.ml-vc-pause-icon');
  const progressTrack = ctrlBar.querySelector('.ml-vc-progress-track');
  const progressFill = ctrlBar.querySelector('.ml-vc-progress-fill');
  const progressThumb = ctrlBar.querySelector('.ml-vc-progress-thumb');
  const timeEl = ctrlBar.querySelector('.ml-vc-time');
  const timeTotalEl = ctrlBar.querySelector('.ml-vc-time--total');
  const volumeBtn = ctrlBar.querySelector('.ml-vc-volume');
  const volOn = ctrlBar.querySelector('.ml-vc-vol-on');
  const volOff = ctrlBar.querySelector('.ml-vc-vol-off');

  let hideTimer = null;
  let isDragging = false;

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  }

  function updatePlayState() {
    const paused = video.paused;
    playIcon.style.display = paused ? '' : 'none';
    pauseIcon.style.display = paused ? 'none' : '';
    playBtn.setAttribute('aria-label', paused ? 'Reproducir' : 'Pausar');
  }

  function updateProgress() {
    if (!video.duration || isDragging) return;
    const pct = (video.currentTime / video.duration) * 100;
    progressFill.style.width = pct + '%';
    progressThumb.style.left = pct + '%';
    timeEl.textContent = formatTime(video.currentTime);
  }

  function seekTo(e) {
    const rect = progressTrack.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (video.duration) video.currentTime = pct * video.duration;
  }

  // Play / Pause
  playBtn.addEventListener('click', () => {
    if (video.paused) { video.play(); }
    else { video.pause(); }
  });

  // Click video to toggle play
  video.addEventListener('click', () => {
    if (video.paused) { video.play(); }
    else { video.pause(); }
  });

  // Show the big play overlay when paused
  video.addEventListener('pause', () => {
    if (playOverlay) playOverlay.classList.remove('hidden');
  });
  video.addEventListener('play', () => {
    if (playOverlay) playOverlay.classList.add('hidden');
  });

  // Progress bar — click
  progressTrack.addEventListener('click', (e) => { seekTo(e); updateProgress(); });

  // Progress bar — drag
  progressTrack.addEventListener('mousedown', (e) => {
    isDragging = true;
    seekTo(e);
    updateProgress();
  });
  progressTrack.addEventListener('touchstart', (e) => {
    isDragging = true;
    seekTo(e.touches[0]);
    updateProgress();
  }, { passive: true });

  // Volume toggle
  volumeBtn.addEventListener('click', () => {
    video.muted = !video.muted;
    volOn.style.display = video.muted ? 'none' : '';
    volOff.style.display = video.muted ? '' : 'none';
    volumeBtn.setAttribute('aria-label', video.muted ? 'Activar sonido' : 'Silenciar');
  });

  // Keyboard: space for play/pause
  const onKey = (e) => {
    if (!document.getElementById('mediaLightbox')?.classList.contains('open')) return;
    if (e.key === ' ' && e.target === document.body) {
      e.preventDefault();
      if (video.paused) video.play();
      else video.pause();
    }
    if (e.key === 'm' && e.target === document.body) {
      e.preventDefault();
      volumeBtn.click();
    }
  };
  document.addEventListener('keydown', onKey);

  // Auto-hide controls after 3s of inactivity
  function showControls() {
    ctrlBar.classList.add('ml-vc-visible');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => ctrlBar.classList.remove('ml-vc-visible'), 3000);
  }
  wrap.addEventListener('mousemove', showControls);
  wrap.addEventListener('touchstart', showControls);
  showControls();

  // Timeupdate
  video.addEventListener('timeupdate', updateProgress);
  video.addEventListener('play', updatePlayState);
  video.addEventListener('pause', updatePlayState);

  // Set total time when metadata loads
  video.addEventListener('loadedmetadata', () => {
    timeTotalEl.textContent = formatTime(video.duration);
    updateProgress();
  });

  // Cleanup on video swap
  video.addEventListener('emptied', () => {
    document.removeEventListener('keydown', onKey);
  });

  // Cleanup de listeners de arrastre al destruir (evita acumulación)
  const cleanupDrag = () => {
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragUp);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
  };
  function onDragMove(e) { if (!isDragging) return; seekTo(e); updateProgress(); }
  function onDragUp() { isDragging = false; }
  function onTouchMove(e) { if (!isDragging) return; seekTo(e.touches[0]); updateProgress(); }
  function onTouchEnd() { isDragging = false; }
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragUp);
  document.addEventListener('touchmove', onTouchMove, { passive: true });
  document.addEventListener('touchend', onTouchEnd);
  ctrlBar._calCleanupDrag = cleanupDrag;
}

// ==========================================
// PUBLIC API
// ==========================================
export function openLightbox(items, startIndex = 0) {
  const box = document.getElementById('mediaLightbox');
  if (!box || !items?.length) return;
  stopSlideshow();
  clearPreloadPool();
  // Si ya había un render abierto, libera sus listeners antes de resetear
  if (state._videoDestroy) { try { state._videoDestroy(); } catch(e) {} state._videoDestroy = null; }
  if (state._imgCleanup) { try { state._imgCleanup(); } catch(e) {} state._imgCleanup = null; }
  state = { items, currentIndex: Math.max(0, Math.min(startIndex, items.length - 1)), rotation: 0, zoom: 1, panX: 0, panY: 0, isPanning: false, lastTap: 0, videoEl: null, _videoDestroy: null, _imgCleanup: null };
  box.classList.add('open');
  box.setAttribute('aria-hidden', 'false');
  document.body.classList.add('lightbox-open');
  render();
}

export function closeLightbox() {
  const box = document.getElementById('mediaLightbox');
  if (!box) return;
  stopSlideshow();
  clearPreloadPool();
  if (state._videoDestroy) { try { state._videoDestroy(); } catch(e) {} state._videoDestroy = null; }
  if (state.videoEl) { state.videoEl = null; }
  if (state._imgCleanup) { try { state._imgCleanup(); } catch(e) {} state._imgCleanup = null; }
  box.classList.remove('open');
  box.classList.remove('is-video');
  box.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('lightbox-open');
  const content = document.getElementById('mlContent');
  if (content) { while (content.firstChild) content.removeChild(content.firstChild); }
  const thumbs = document.getElementById('mlThumbs');
  if (thumbs) thumbs.innerHTML = '';
  state.items = [];
  state.currentIndex = 0;
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  state.rotation = 0;
}

export function nextMedia() { if (state.items.length > 1) { state.currentIndex = (state.currentIndex + 1) % state.items.length; render(); pokeSlideshow(); } }
export function prevMedia() { if (state.items.length > 1) { state.currentIndex = (state.currentIndex - 1 + state.items.length) % state.items.length; render(); pokeSlideshow(); } }

/** Presentación automática — fotos 5s y vídeos hasta su evento "ended" */
export function playSlideshow(ms = 5000) { startSlideshow(ms); }
/** Detiene la presentación automática */
export function pauseSlideshow() { stopSlideshow(); }

// ==========================================
// CREATE LIGHTBOX DOM
// ==========================================
export function createLightbox() {
  if (document.getElementById('mediaLightbox')) return;
  const el = document.createElement('div');
  el.id = 'mediaLightbox';
  el.className = 'media-lightbox';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="ml-backdrop"></div>
    <div class="ml-shell">
      <!-- Top bar -->
      <div class="ml-topbar">
        <div class="ml-topbar-left">
          <span class="ml-topbar-counter" id="mlCounter">1 / 1</span>
        </div>
        <div class="ml-topbar-right">
          <button class="ml-topbar-btn ml-topbar-fav" id="mlFavBtn" title="Favorita" aria-label="Marcar como favorita" style="display:none">♡</button>
          <button class="ml-topbar-btn" id="mlFullscreenBtn" title="Pantalla completa" aria-label="Pantalla completa">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
          </button>
          <button class="ml-topbar-btn" id="mlCloseBtn" title="Cerrar" aria-label="Cerrar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      <!-- Main stage -->
      <div class="ml-stage">
        <button class="ml-nav ml-prev" id="mlPrevBtn" aria-label="Anterior">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="ml-content" id="mlContent"></div>
        <button class="ml-nav ml-next" id="mlNextBtn" aria-label="Siguiente">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <!-- Bottom bar -->
      <div class="ml-bottombar">
        <span class="ml-caption" id="mlCaption"></span>
        <div class="ml-thumbs-scroll" id="mlThumbs"></div>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  // Bind events
  el.querySelector('#mlCloseBtn').onclick = closeLightbox;
  el.querySelector('#mlPrevBtn').onclick = prevMedia;
  el.querySelector('#mlNextBtn').onclick = nextMedia;
  el.querySelector('.ml-backdrop').onclick = closeLightbox;
  el.querySelector('#mlFavBtn').onclick = () => {
    const item = getItem();
    if (item && typeof item.onToggleFav === 'function') {
      const isFav = item.onToggleFav();
      // Refleja el nuevo estado en el item para que al navegar se mantenga
      item.fav = isFav;
      if (state.items && state.items[state.currentIndex]) state.items[state.currentIndex].fav = isFav;
      const favBtn = el.querySelector('#mlFavBtn');
      if (favBtn) {
        favBtn.classList.toggle('is-on', isFav);
        favBtn.setAttribute('aria-label', isFav ? 'Quitar de favoritas' : 'Marcar como favorita');
      }
    }
  };

  // Fullscreen
  const fsBtn = el.querySelector('#mlFullscreenBtn');
  const fsIconExpand = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
  const fsIconShrink = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 8 4 3 9 3"/><polyline points="20 16 20 21 15 21"/><line x1="4" y1="3" x2="11" y2="10"/><line x1="20" y1="21" x2="13" y2="14"/></svg>';

  function updateFsIcon() {
    fsBtn.innerHTML = document.fullscreenElement ? fsIconShrink : fsIconExpand;
    fsBtn.title = document.fullscreenElement ? 'Salir de pantalla completa' : 'Pantalla completa';
  }

  fsBtn.onclick = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen().catch(() => {});
    }
  };

  el.addEventListener('fullscreenchange', updateFsIcon);
  el.addEventListener('webkitfullscreenchange', updateFsIcon);

  // Click left/right zones on stage
  const stage = el.querySelector('.ml-stage');
  stage.addEventListener('click', (e) => {
    if (e.target !== stage) return;
    const rect = stage.getBoundingClientRect();
    if (e.clientX < rect.left + rect.width * 0.2) prevMedia();
    else if (e.clientX > rect.right - rect.width * 0.2) nextMedia();
  });

  // Touch swipe
  let sx = 0, sy = 0;
  el.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }
  }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (!e.changedTouches.length || state.items.length <= 1) return;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) { dx < 0 ? nextMedia() : prevMedia(); }
  }, { passive: true });

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('mediaLightbox')?.classList.contains('open')) return;
    switch (e.key) {
      case 'Escape': closeLightbox(); break;
      case 'ArrowRight': nextMedia(); break;
      case 'ArrowLeft': prevMedia(); break;
      case 'f': el.querySelector('#mlFullscreenBtn')?.click(); break;
      case '+': case '=': {
        const zoomIn = document.querySelector('.ml-zoom-in');
        if (zoomIn) zoomIn.click();
        break;
      }
      case '-': {
        const zoomOut = document.querySelector('.ml-zoom-out');
        if (zoomOut) zoomOut.click();
        break;
      }
      case '0': {
        const img = document.querySelector('.ml-image-wrap img.ml-media');
        if (img) { state.zoom = 1; state.panX = 0; state.panY = 0; img.style.transform = `rotate(${state.rotation}deg) scale(1) translate(0, 0)`; }
        break;
      }
      case 'r': {
        const rotBtn = document.querySelector('.ml-rotate-btn');
        if (rotBtn) rotBtn.click();
        break;
      }
    }
  });
}
