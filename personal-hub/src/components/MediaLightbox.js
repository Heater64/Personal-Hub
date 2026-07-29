/* ==========================================
   Personal Hub v2 — Media Lightbox
   Visor de imágenes y videos con navegación, rotación y controles
   ========================================== */

let state = {
  items: [],
  currentIndex: 0,
  rotation: 0,
  videoEl: null
};

function formatTime(s) {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function detectMime(src) {
  if (/\.webm(\?.*)?$/i.test(src)) return 'video/webm';
  if (/\.mov(\?.*)?$/i.test(src)) return 'video/quicktime';
  return 'video/mp4';
}

function getItem() { return state.items[state.currentIndex]; }

function render() {
  const box = document.getElementById('mediaLightbox');
  const content = document.getElementById('mlContent');
  const caption = document.getElementById('mlCaption');
  const counter = document.getElementById('mlCounter');
  if (!box || !content) return;

  const item = getItem();
  if (!item) return;

  // Cleanup old video
  if (state.videoEl) { state.videoEl.pause(); state.videoEl.removeAttribute('src'); state.videoEl.load(); state.videoEl = null; }
  content.innerHTML = '';
  state.rotation = 0;
  box.classList.toggle('is-video', item.type === 'video');

  const updateTransform = (el, rot) => {
    const n = ((rot % 360) + 360) % 360;
    const sideways = n === 90 || n === 270;
    const stage = content.parentElement;
    const sw = stage?.clientWidth || window.innerWidth;
    const sh = stage?.clientHeight || window.innerHeight;
    const mw = el.offsetWidth || el.videoWidth || el.naturalWidth || sw;
    const mh = el.offsetHeight || el.videoHeight || el.naturalHeight || sh;
    const scale = sideways ? Math.min(sw / mh, sh / mw, 1) : 1;
    el.style.transform = `rotate(${n}deg) scale(${scale})`;
  };

  if (item.type === 'video') {
    const wrap = document.createElement('div');
    wrap.className = 'ml-video-wrap';

    const video = document.createElement('video');
    video.className = 'ml-media';
    video.preload = 'metadata';
    video.playsInline = true;
    video.loop = true;
    video.controls = true;
    const src = document.createElement('source');
    src.src = item.src;
    src.type = detectMime(item.src);
    video.appendChild(src);

    wrap.appendChild(video);
    content.appendChild(wrap);
    state.videoEl = video;

    video.addEventListener('loadedmetadata', () => updateTransform(video, 0));
  } else {
    const wrap = document.createElement('div');
    wrap.className = 'ml-image-wrap';

    const img = document.createElement('img');
    img.className = 'ml-media';
    img.src = item.src;
    img.alt = item.caption || '';
    img.loading = 'eager';
    img.addEventListener('load', () => updateTransform(img, 0), { once: true });

    // Rotate button
    const rotBtn = document.createElement('button');
    rotBtn.className = 'ml-rotate-btn';
    rotBtn.title = 'Girar';
    rotBtn.innerHTML = '↻';
    rotBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.rotation = (state.rotation + 90) % 360;
      updateTransform(img, state.rotation);
    });

    wrap.appendChild(img);
    wrap.appendChild(rotBtn);
    content.appendChild(wrap);
  }

  if (caption) caption.textContent = item.caption || '';
  if (counter) counter.textContent = `${state.currentIndex + 1} / ${state.items.length}`;

  const prevBtn = document.getElementById('mlPrevBtn');
  const nextBtn = document.getElementById('mlNextBtn');
  if (prevBtn) prevBtn.style.display = state.items.length <= 1 ? 'none' : 'flex';
  if (nextBtn) nextBtn.style.display = state.items.length <= 1 ? 'none' : 'flex';
}

export function openLightbox(items, startIndex = 0) {
  const box = document.getElementById('mediaLightbox');
  if (!box || !items?.length) return;
  state = { items, currentIndex: Math.max(0, Math.min(startIndex, items.length - 1)), rotation: 0, videoEl: null };
  box.classList.add('open');
  box.setAttribute('aria-hidden', 'false');
  document.body.classList.add('lightbox-open');
  render();
}

export function closeLightbox() {
  const box = document.getElementById('mediaLightbox');
  if (!box) return;
  if (state.videoEl) { state.videoEl.pause(); state.videoEl.src = ''; state.videoEl = null; }
  box.classList.remove('open');
  box.classList.remove('is-video');
  box.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('lightbox-open');
  const content = document.getElementById('mlContent');
  if (content) {
    // Remove all child nodes to prevent DOM accumulation
    while (content.firstChild) content.removeChild(content.firstChild);
  }
  state.items = [];
  state.currentIndex = 0;
  state.rotation = 0;
}

export function nextMedia() { if (state.items.length > 1) { state.currentIndex = (state.currentIndex + 1) % state.items.length; render(); } }
export function prevMedia() { if (state.items.length > 1) { state.currentIndex = (state.currentIndex - 1 + state.items.length) % state.items.length; render(); } }

// Create lightbox DOM (call once)
export function createLightbox() {
  if (document.getElementById('mediaLightbox')) return;
  const el = document.createElement('div');
  el.id = 'mediaLightbox';
  el.className = 'media-lightbox';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="ml-backdrop"></div>
    <div class="ml-shell">
      <button class="ml-close" id="mlCloseBtn">✕</button>
      <button class="ml-nav ml-prev" id="mlPrevBtn">‹</button>
      <div class="ml-stage">
        <div class="ml-content" id="mlContent"></div>
      </div>
      <button class="ml-nav ml-next" id="mlNextBtn">›</button>
      <div class="ml-meta">
        <span id="mlCaption"></span>
        <span id="mlCounter"></span>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  // Bind events
  el.querySelector('#mlCloseBtn').onclick = closeLightbox;
  el.querySelector('#mlPrevBtn').onclick = prevMedia;
  el.querySelector('#mlNextBtn').onclick = nextMedia;
  el.querySelector('.ml-backdrop').onclick = closeLightbox;

  // Touch swipe
  let sx = 0, sy = 0;
  el.addEventListener('touchstart', (e) => { if (e.touches.length === 1) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; } }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (!e.changedTouches.length || state.items.length <= 1) return;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 58 && Math.abs(dx) > Math.abs(dy) * 1.35) { dx < 0 ? nextMedia() : prevMedia(); }
  }, { passive: true });

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('mediaLightbox')?.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') nextMedia();
    if (e.key === 'ArrowLeft') prevMedia();
  });
}
