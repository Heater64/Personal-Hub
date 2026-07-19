// ==========================================
// rincon.js · galeria, memes y SPB
// ==========================================
let currentFolder = null;
let currentMemeFolder = 'Favoritos ⭐';
let currentGalleryItems = [];
let currentGalleryIndex = 0;
let activeGalleryType = '';
let currentVideoElement = null;
let reelTouchStartX = 0;
let reelTouchStartY = 0;
let currentMediaRotation = 0;

function formatMediaTime(seconds) {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

function detectVideoMime(src) {
    if (/\.webm(\?.*)?$/i.test(src)) return 'video/webm';
    if (/\.mov(\?.*)?$/i.test(src)) return 'video/quicktime';
    return 'video/mp4';
}

function cleanupActiveVideo() {
    if (!currentVideoElement) return;
    currentVideoElement.pause();
    currentVideoElement.removeAttribute('src');
    currentVideoElement.load();
    currentVideoElement = null;
}

function isMediaLightboxOpen() {
    const box = document.getElementById('reelLightbox');
    return !!(box && box.classList.contains('open'));
}

function updateMediaRotation(mediaEl) {
    if (!mediaEl) return;

    const fullscreenRoot = document.fullscreenElement;
    const stage = document.querySelector('.lightbox-reel-stage');
    const boundsRoot = fullscreenRoot && fullscreenRoot.contains(mediaEl) ? fullscreenRoot : stage;
    const stageWidth = boundsRoot?.clientWidth || window.innerWidth;
    const stageHeight = boundsRoot?.clientHeight || window.innerHeight;
    const mediaWidth = mediaEl.offsetWidth || mediaEl.videoWidth || mediaEl.naturalWidth || stageWidth;
    const mediaHeight = mediaEl.offsetHeight || mediaEl.videoHeight || mediaEl.naturalHeight || stageHeight;
    const normalizedRotation = ((currentMediaRotation % 360) + 360) % 360;
    const isSideways = normalizedRotation === 90 || normalizedRotation === 270;
    const scale = isSideways
        ? Math.min(stageWidth / mediaHeight, stageHeight / mediaWidth, 1)
        : 1;

    mediaEl.style.transform = `rotate(${normalizedRotation}deg) scale(${scale})`;
    mediaEl.style.setProperty('--media-rotation', `${normalizedRotation}deg`);
    mediaEl.style.setProperty('--media-rotation-scale', scale.toFixed(3));
}

function rotateActiveMedia() {
    const mediaEl = document.querySelector('#reelLightboxContent .reel-media');
    currentMediaRotation = (currentMediaRotation + 90) % 360;
    updateMediaRotation(mediaEl);
}

function createRotateButton(mediaEl) {
    const rotateBtn = document.createElement('button');
    rotateBtn.className = 'control-btn rotate-media-btn';
    rotateBtn.type = 'button';
    rotateBtn.title = 'Girar 90 grados';
    rotateBtn.setAttribute('aria-label', 'Girar 90 grados');
    rotateBtn.innerHTML = '<i data-lucide="rotate-cw"></i>';
    rotateBtn.addEventListener('click', () => {
        rotateActiveMedia();
        if (typeof lucide !== 'undefined') lucide.createIcons({ root: rotateBtn });
    });

    return rotateBtn;
}

function renderMediaLightboxItem() {
    const box = document.getElementById('reelLightbox');
    const content = document.getElementById('reelLightboxContent');
    const captionEl = document.getElementById('reelLightboxCaption');
    const counterEl = document.getElementById('reelLightboxCounter');
    if (!box || !content || !currentGalleryItems.length) return;

    const item = currentGalleryItems[currentGalleryIndex];
    if (!item) return;

    cleanupActiveVideo();
    content.innerHTML = '';
    currentMediaRotation = 0;
    box.classList.toggle('showing-video', item.type === 'video');

    if (item.type === 'video') {
        const wrapper = document.createElement('div');
        wrapper.className = 'video-player-wrapper';
        wrapper.tabIndex = 0;

        const video = document.createElement('video');
        video.className = 'reel-media';
        video.preload = 'metadata';
        video.playsInline = true;
        video.loop = true;
        if (item.poster) video.poster = item.poster;

        const source = document.createElement('source');
        source.src = item.src;
        source.type = detectVideoMime(item.src);
        video.appendChild(source);
        video.appendChild(document.createTextNode('Tu navegador no soporta videos.'));

        const controls = document.createElement('div');
        controls.className = 'custom-video-controls';

        const playPauseBtn = document.createElement('button');
        playPauseBtn.className = 'control-btn play-pause-btn';
        playPauseBtn.type = 'button';
        playPauseBtn.innerHTML = '<i data-lucide="play"></i>';

        const muteBtn = document.createElement('button');
        muteBtn.className = 'control-btn mute-btn';
        muteBtn.type = 'button';
        muteBtn.innerHTML = '<i data-lucide="volume-2"></i>';

        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-container';

        const progressTrack = document.createElement('div');
        progressTrack.className = 'progress-track-video';

        const progressFill = document.createElement('div');
        progressFill.className = 'progress-fill-video';
        progressTrack.appendChild(progressFill);

        const timeText = document.createElement('span');
        timeText.className = 'time-text';
        timeText.textContent = '0:00 / 0:00';

        progressContainer.appendChild(progressTrack);
        progressContainer.appendChild(timeText);

        const fullscreenBtn = document.createElement('button');
        fullscreenBtn.className = 'control-btn fullscreen-btn';
        fullscreenBtn.type = 'button';
        fullscreenBtn.innerHTML = '<i data-lucide="maximize"></i>';
        const rotateBtn = createRotateButton(video);

        controls.appendChild(playPauseBtn);
        controls.appendChild(muteBtn);
        controls.appendChild(progressContainer);
        controls.appendChild(rotateBtn);
        controls.appendChild(fullscreenBtn);

        wrapper.appendChild(video);
        wrapper.appendChild(controls);
        content.appendChild(wrapper);

        const refreshPlayIcon = () => {
            playPauseBtn.innerHTML = video.paused ? '<i data-lucide="play"></i>' : '<i data-lucide="pause"></i>';
            if (typeof lucide !== 'undefined') lucide.createIcons({ root: playPauseBtn });
        };

        const refreshMuteIcon = () => {
            muteBtn.innerHTML = video.muted ? '<i data-lucide="volume-x"></i>' : '<i data-lucide="volume-2"></i>';
            if (typeof lucide !== 'undefined') lucide.createIcons({ root: muteBtn });
        };

        const refreshFullscreenIcon = () => {
            fullscreenBtn.innerHTML = document.fullscreenElement === wrapper
                ? '<i data-lucide="minimize"></i>'
                : '<i data-lucide="maximize"></i>';
            if (typeof lucide !== 'undefined') lucide.createIcons({ root: fullscreenBtn });
        };

        const updateProgress = () => {
            if (!video.duration) return;
            const percent = (video.currentTime / video.duration) * 100;
            progressFill.style.width = `${percent}%`;
            timeText.textContent = `${formatMediaTime(video.currentTime)} / ${formatMediaTime(video.duration)}`;
        };

        playPauseBtn.addEventListener('click', () => {
            if (video.paused) {
                video.play().catch(() => {});
            } else {
                video.pause();
            }
            refreshPlayIcon();
        });

        video.addEventListener('click', () => {
            if (video.paused) {
                video.play().catch(() => {});
            } else {
                video.pause();
            }
            refreshPlayIcon();
        });

        muteBtn.addEventListener('click', () => {
            video.muted = !video.muted;
            refreshMuteIcon();
        });

        progressTrack.addEventListener('click', (event) => {
            if (!video.duration) return;
            const rect = progressTrack.getBoundingClientRect();
            const percent = (event.clientX - rect.left) / rect.width;
            video.currentTime = percent * video.duration;
            updateProgress();
        });

        fullscreenBtn.addEventListener('click', () => {
            if (document.fullscreenElement === wrapper) {
                document.exitFullscreen();
                return;
            }
            wrapper.requestFullscreen().catch(() => {});
        });

        video.addEventListener('timeupdate', updateProgress);
        video.addEventListener('loadedmetadata', () => {
            updateProgress();
            updateMediaRotation(video);
        });
        video.addEventListener('play', refreshPlayIcon);
        video.addEventListener('pause', refreshPlayIcon);
        video.addEventListener('volumechange', refreshMuteIcon);
        wrapper.addEventListener('fullscreenchange', () => {
            refreshFullscreenIcon();
            requestAnimationFrame(() => updateMediaRotation(video));
        });

        currentVideoElement = video;
        if (typeof lucide !== 'undefined') lucide.createIcons({ root: wrapper });

        requestAnimationFrame(() => {
            video.play().then(refreshPlayIcon).catch(() => {
                refreshPlayIcon();
            });
        });
    } else {
        const wrapper = document.createElement('div');
        wrapper.className = 'media-viewer-wrapper image-viewer-wrapper';
        wrapper.tabIndex = 0;

        const image = document.createElement('img');
        image.className = 'reel-media';
        image.src = item.src;
        image.alt = item.caption || '';
        image.loading = 'eager';
        image.addEventListener('load', () => updateMediaRotation(image), { once: true });

        const controls = document.createElement('div');
        controls.className = 'custom-video-controls image-media-controls';
        controls.appendChild(createRotateButton(image));

        wrapper.appendChild(image);
        wrapper.appendChild(controls);
        content.appendChild(wrapper);
        if (typeof lucide !== 'undefined') lucide.createIcons({ root: wrapper });
    }

    if (captionEl) captionEl.textContent = item.caption || '';
    if (counterEl) counterEl.textContent = `${currentGalleryIndex + 1} / ${currentGalleryItems.length}`;

    const prevBtn = document.getElementById('reelPrevBtn');
    const nextBtn = document.getElementById('reelNextBtn');
    if (prevBtn) prevBtn.disabled = currentGalleryItems.length <= 1;
    if (nextBtn) nextBtn.disabled = currentGalleryItems.length <= 1;
}

function openMediaLightbox(items, startIndex = 0, galleryType = 'media') {
    const box = document.getElementById('reelLightbox');
    if (!box || !Array.isArray(items) || !items.length) {
        showMessage('No se pudo abrir el visor', true);
        return;
    }

    currentGalleryItems = items;
    currentGalleryIndex = Math.max(0, Math.min(startIndex, items.length - 1));
    activeGalleryType = galleryType;

    box.setAttribute('aria-hidden', 'false');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.tabIndex = -1;
    box.classList.add('open');
    document.body.classList.add('reel-lightbox-open');
    renderMediaLightboxItem();
    requestAnimationFrame(() => box.focus({ preventScroll: true }));
}

function closeMediaLightbox() {
    const box = document.getElementById('reelLightbox');
    const content = document.getElementById('reelLightboxContent');
    cleanupActiveVideo();
    if (content) content.innerHTML = '';
    if (box) {
        box.classList.remove('open');
        box.classList.remove('showing-video');
        box.setAttribute('aria-hidden', 'true');
        box.removeAttribute('role');
        box.removeAttribute('aria-modal');
    }
    document.body.classList.remove('reel-lightbox-open');
    currentGalleryItems = [];
    currentGalleryIndex = 0;
    activeGalleryType = '';
}

function nextMedia() {
    if (!isMediaLightboxOpen() || currentGalleryItems.length <= 1) return;
    currentGalleryIndex = (currentGalleryIndex + 1) % currentGalleryItems.length;
    renderMediaLightboxItem();
}

function prevMedia() {
    if (!isMediaLightboxOpen() || currentGalleryItems.length <= 1) return;
    currentGalleryIndex = (currentGalleryIndex - 1 + currentGalleryItems.length) % currentGalleryItems.length;
    renderMediaLightboxItem();
}

window.addEventListener('resize', () => {
    if (!isMediaLightboxOpen()) return;
    updateMediaRotation(document.querySelector('#reelLightboxContent .reel-media'));
});

function buildFolderGalleryItems(folderName) {
    const images = window.galleryFoldersData?.[folderName] || [];
    return images.map((src, index) => ({
        type: 'image',
        src,
        caption: `${folderName} - ${index + 1}`
    }));
}

// ---------- GALERÍA (misma lógica que memes) ----------

let currentGalleryFolder = 'Atardeceres'; // carpeta por defecto
let hasGalleryRendered = false;
let galleryRenderToken = 0;
const GALLERY_BATCH_SIZE = 12;
const GALLERY_PRELOAD_LIMIT = 18;

function buildGalleryItems(folderName) {
    const images = window.galleryFoldersData?.[folderName] || [];
    return images.map((src, index) => ({
        type: 'image',
        src: src,
        caption: `${folderName} - ${index + 1}`
    }));
}

function renderGalleryFolders() {
    const nav = document.getElementById('galleryFoldersNav');
    if (!nav || !window.galleryFoldersData) return;

    nav.innerHTML = Object.keys(window.galleryFoldersData).map((folder) => `
        <button class="memes-folder-btn ${folder === currentGalleryFolder ? 'active' : ''}" data-folder="${escapeHtml(folder)}" type="button">
            <i data-lucide="folder"></i> ${escapeHtml(folder)}
            <span class="folder-count">${window.galleryFoldersData[folder].length}</span>
        </button>
    `).join('');

    nav.querySelectorAll('.memes-folder-btn').forEach((btn) => {
        btn.addEventListener('click', () => showGalleryFolder(btn.dataset.folder));
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function ensureGalleryGridInteractions() {
    const grid = document.getElementById('galleryImagesGrid');
    if (!grid || grid.dataset.bound === 'true') return;

    grid.dataset.bound = 'true';

    grid.addEventListener('click', (event) => {
        const item = event.target.closest('.gallery-masonry-item');
        if (!item) return;

        event.stopPropagation();
        const galleryItems = buildGalleryItems(currentGalleryFolder);
        openMediaLightbox(galleryItems, Number(item.dataset.index), `gallery:${currentGalleryFolder}`);
    });

    grid.addEventListener('keydown', (event) => {
        const item = event.target.closest('.gallery-masonry-item');
        if (!item) return;

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            const galleryItems = buildGalleryItems(currentGalleryFolder);
            openMediaLightbox(galleryItems, Number(item.dataset.index), `gallery:${currentGalleryFolder}`);
        }
    });
}

function warmGalleryCache() {
    const images = (window.galleryFoldersData?.[currentGalleryFolder] || []).slice(0, GALLERY_PRELOAD_LIMIT);
    let index = 0;

    function preloadBatch() {
        for (let step = 0; step < 3 && index < images.length; step += 1, index += 1) {
            const image = new Image();
            image.loading = 'eager';
            image.decoding = 'async';
            image.src = images[index];
        }

        if (index < images.length) {
            setTimeout(preloadBatch, 180);
        }
    }

    if (images.length) {
        setTimeout(preloadBatch, 500);
    }
}

function renderGalleryGrid() {
    const grid = document.getElementById('galleryImagesGrid');
    if (!grid || !window.galleryFoldersData) return;

    ensureGalleryGridInteractions();
    grid.className = 'gallery-masonry';
    const items = window.galleryFoldersData[currentGalleryFolder];
    if (!items || items.length === 0) {
        grid.className = '';
        grid.innerHTML = '<div class="empty-state">No hay fotos en esta carpeta</div>';
        return;
    }

    const countEl = document.getElementById('galleryCountText');
    if (countEl) countEl.textContent = items.length + ' foto' + (items.length !== 1 ? 's' : '');

    const renderToken = ++galleryRenderToken;
    grid.innerHTML = '';

    function appendBatch(startIndex) {
        if (renderToken !== galleryRenderToken) return;

        const batch = items.slice(startIndex, startIndex + GALLERY_BATCH_SIZE);
        if (!batch.length) {
            if (typeof lucide !== 'undefined') lucide.createIcons({ root: grid });
            observeGalleryImages(grid);
            return;
        }

        grid.insertAdjacentHTML('beforeend', batch.map((src, offset) => {
            const index = startIndex + offset;
            return `
                <article class="gallery-masonry-item loading" tabindex="0" role="button" aria-label="Abrir foto ${index + 1}" data-index="${index}">
                    <img data-src="${escapeHtml(src)}" alt="Foto ${index + 1}" loading="lazy" decoding="async">
                    <div class="gallery-overlay">
                        <div class="gallery-overlay-icon"><i data-lucide="eye"></i></div>
                        <span class="gallery-overlay-label">${escapeHtml(currentGalleryFolder)}</span>
                    </div>
                </article>
            `;
        }).join(''));

        if (typeof lucide !== 'undefined') lucide.createIcons({ root: grid });

        if (startIndex + GALLERY_BATCH_SIZE < items.length) {
            setTimeout(() => appendBatch(startIndex + GALLERY_BATCH_SIZE), 60);
        } else {
            observeGalleryImages(grid);
        }
    }

    appendBatch(0);
    hasGalleryRendered = true;
}

function observeGalleryImages(grid) {
    if (!grid || !('IntersectionObserver' in window)) {
        grid.querySelectorAll('.gallery-masonry-item.loading').forEach(item => {
            const img = item.querySelector('img[data-src]');
            if (img) { img.src = img.dataset.src; img.removeAttribute('data-src'); }
            item.classList.remove('loading');
        });
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const item = entry.target;
            const img = item.querySelector('img[data-src]');
            if (img) {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                img.onload = () => item.classList.remove('loading');
                img.onerror = () => item.classList.remove('loading');
            } else {
                item.classList.remove('loading');
            }
            observer.unobserve(item);
        });
    }, { rootMargin: '200px' });

    grid.querySelectorAll('.gallery-masonry-item.loading').forEach(item => observer.observe(item));
}

function showGalleryFolder(folder) {
    currentGalleryFolder = folder;
    renderGalleryFolders();
    renderGalleryGrid();
}

// Esta función es llamada por initRincon al cargar la página
function renderGallery() {
    renderGalleryFolders();
}

function showFolderContents(folderName) {
    currentFolder = folderName;
    const images = window.galleryFoldersData?.[folderName] || [];
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;

    grid.innerHTML = `
        <button class="back-btn" type="button" style="margin-bottom:16px;">
            <i data-lucide="arrow-left"></i> Volver a carpetas
        </button>
        <div class="pinterest-grid">
            ${images.map((src, index) => `
                <div class="pinterest-item folder-media-item" data-index="${index}">
                    <img src="${escapeHtml(src)}" alt="${escapeHtml(folderName)} ${index + 1}" loading="lazy">
                    <div class="overlay"><span><i data-lucide="eye"></i> Ver ${index + 1}</span></div>
                </div>
            `).join('')}
        </div>
    `;

    const items = buildFolderGalleryItems(folderName);
    const backBtn = grid.querySelector('.back-btn');
    if (backBtn) backBtn.addEventListener('click', renderGallery);

    grid.querySelectorAll('.folder-media-item').forEach((item) => {
        item.addEventListener('click', () => {
            openMediaLightbox(items, Number(item.dataset.index), `gallery:${folderName}`);
        });
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function isVideoMeme(src) {
    return /\.(mp4|webm|mov)(\?.*)?$/i.test(src || '');
}

function getVideoPosterUrl(src) {
    if (!src) return '';
    if (src.includes('res.cloudinary.com') && src.includes('/video/upload/')) {
        return src
            .replace('/video/upload/', '/video/upload/f_jpg,so_auto/')
            .replace(/\.(mp4|webm|mov)(\?.*)?$/i, '.jpg');
    }
    return '';
}

function buildMemeGalleryItems(folderName) {
    const items = window.memeImagesData?.[folderName] || [];
    return items.map((src, index) => ({
        type: isVideoMeme(src) ? 'video' : 'image',
        src,
        caption: `${folderName} - ${index + 1}`,
        poster: isVideoMeme(src) ? getVideoPosterUrl(src) : ''
    }));
}

function renderMemes() {
    const nav = document.getElementById('memesFoldersNav');
    const grid = document.getElementById('memesGrid');
    if (!grid || !window.memeImagesData) return;

    const memeFolders = Object.keys(window.memeImagesData);
    if (!memeFolders.length) return;
    if (!window.memeImagesData[currentMemeFolder]) {
        currentMemeFolder = memeFolders[0];
    }

    if (nav) {
        nav.innerHTML = memeFolders.map((folder) => `
            <button class="memes-folder-btn ${folder === currentMemeFolder ? 'active' : ''}" data-folder="${escapeHtml(folder)}" type="button">
                <i data-lucide="folder"></i> ${escapeHtml(folder)}
                <span class="folder-count">${window.memeImagesData[folder].length}</span>
            </button>
        `).join('');

        nav.querySelectorAll('.memes-folder-btn').forEach((btn) => {
            btn.addEventListener('click', () => showMemeFolder(btn.dataset.folder));
        });
    }

    grid.className = 'insta-grid';
    const items = window.memeImagesData[currentMemeFolder];
    if (!items || items.length === 0) {
        grid.className = '';
        grid.innerHTML = '<div class="empty-state">No hay memes en esta carpeta</div>';
        return;
    }

    grid.innerHTML = items.map((src, index) => {
        const isVideo = isVideoMeme(src);
        const caption = `${currentMemeFolder} - ${index + 1}`;

        if (isVideo) {
            const posterUrl = getVideoPosterUrl(src);
            return `
                <article class="insta-item" tabindex="0" role="button" aria-label="Abrir video ${index + 1}" data-index="${index}" data-type="video">
                    <img src="${escapeHtml(posterUrl || src)}" alt="Miniatura del meme ${index + 1}" loading="lazy">
                    <div class="insta-overlay"><i data-lucide="play-circle"></i></div>
                </article>
            `;
        }

        return `
            <article class="insta-item" tabindex="0" role="button" aria-label="Abrir imagen ${index + 1}" data-index="${index}" data-type="image">
                <img src="${escapeHtml(src)}" alt="Meme ${index + 1}" loading="lazy">
                <div class="insta-overlay"><i data-lucide="eye"></i></div>
            </article>
        `;
    }).join('');

    const memeGalleryItems = buildMemeGalleryItems(currentMemeFolder);
    grid.querySelectorAll('.insta-item').forEach((item) => {
        const openItem = () => {
            openMediaLightbox(memeGalleryItems, Number(item.dataset.index), `memes:${currentMemeFolder}`);
        };

        item.addEventListener('click', (event) => {
            event.stopPropagation();
            openItem();
        });

        item.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openItem();
            }
        });
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function showMemeFolder(folder) {
    currentMemeFolder = folder;
    renderMemes();
}

function showSubview(viewId) {
    const parent = document.getElementById('rincon');
    if (!parent) return;

    parent.querySelectorAll('.sub-tab').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.subview === viewId);
    });

    parent.querySelectorAll('.sub-view').forEach((view) => {
        view.classList.toggle('active', view.id === viewId);
    });

    if (viewId === 'rincon-galeria' && !hasGalleryRendered) {
        renderGalleryGrid();
    }
}

function initCuriosidades() {
    const container = document.getElementById('rincon-curiosidades');
    if (!container) return;

    // Dato del día
    const datoEl = document.getElementById('curiosidadDelDia');
    if (datoEl && window.curiosidadesGenerales) {
        const dayIndex = new Date().getDate() % window.curiosidadesGenerales.length;
        const dato = window.curiosidadesGenerales[dayIndex];
        datoEl.innerHTML = `
            <i data-lucide="sparkles" style="width:36px; height:36px; display:block; margin:0 auto 14px; color: var(--warm-amber);"></i>
            <p style="font-size:1.05rem; line-height:1.6; font-style:italic;">"${escapeHtml(dato)}"</p>
        `;
    }

    // Tabs
    const tabsData = [
        { key: 'san-juan', label: 'San Juan Pueblo', icon: 'map-pin' },
        { key: 'san-petersburgo', label: 'San Petersburgo', icon: 'landmark' },
        { key: 'gatos', label: 'Gatos 🐱', icon: 'cat' }
    ];

    const tabsNav = document.getElementById('curiosidadesTabsNav');
    const tabsContent = document.getElementById('curiosidadesTabContent');
    if (!tabsNav || !tabsContent) return;

    let activeTab = 'san-juan';

    function renderTabs() {
        tabsNav.innerHTML = tabsData.map(tab => `
            <button class="memes-folder-btn ${tab.key === activeTab ? 'active' : ''}" data-tab="${tab.key}" type="button">
                <i data-lucide="${tab.icon}"></i> ${tab.label}
            </button>
        `).join('');

        tabsNav.querySelectorAll('.memes-folder-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                activeTab = btn.dataset.tab;
                renderTabs();
                renderTabContent();
            });
        });

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function renderTabContent() {
        if (activeTab === 'san-juan') renderSanJuanTab();
        else if (activeTab === 'san-petersburgo') renderSanPetersburgoTab();
        else if (activeTab === 'gatos') renderGatosTab();
    }

    function renderSanJuanTab() {
        const data = window.spbData || {};
        let html = '';

        // Curiosidades
        if (data.curiosidades && data.curiosidades.length) {
            html += `<div style="padding:0 0 20px;"><h3><i data-lucide="sparkles"></i> Datos curiosos</h3>
            <div style="display:grid; gap:16px; grid-template-columns:repeat(auto-fit, minmax(260px,1fr)); margin-top:14px;">
            ${data.curiosidades.map(c => `
                <div class="curiosity-card" style="background:rgba(255,215,0,0.05); padding:20px; border-radius:14px; text-align:center; border:1px solid rgba(255,215,0,0.1);">
                    <i data-lucide="${c.icon}" style="width:36px; height:36px; display:block; margin:0 auto 10px; color:#FFD966;"></i>
                    <strong style="font-size:1rem;">${escapeHtml(c.titulo)}</strong>
                    <p style="margin-top:8px; font-size:0.85rem; line-height:1.5; color:var(--umbra-ash);">${escapeHtml(c.texto)}</p>
                </div>
            `).join('')}
            </div></div>`;
        }

        // Comida típica
        html += `<div style="padding:0 0 20px;"><h3><i data-lucide="utensils"></i> Comida típica hondureña</h3>
        <div style="display:grid; gap:10px; grid-template-columns:repeat(auto-fit, minmax(140px,1fr)); margin-top:14px;">
            <div class="food-card">Baleada</div>
            <div class="food-card">Casamiento</div>
            <div class="food-card">Taco hondureño</div>
            <div class="food-card">Frijol con pico</div>
            <div class="food-card">Sopa de Caracol</div>
            <div class="food-card">Yuca con Chicharrón</div>
            <div class="food-card">Tapado</div>
            <div class="food-card">Riguas</div>
        </div></div>`;

        // Frases
        if (data.phrases && data.phrases.length) {
            html += `<div style="padding:0 0 20px;"><h3><i data-lucide="message-circle"></i> Frases hondureñas</h3>
            <div style="display:grid; gap:10px; margin-top:14px;">
            ${data.phrases.map(p => `
                <div style="padding:12px 16px; background:rgba(255,215,0,0.06); border-radius:12px; border-left:3px solid var(--warm-amber); font-size:0.9rem;">
                    ${escapeHtml(p)}
                </div>
            `).join('')}
            </div></div>`;
        }

        tabsContent.innerHTML = `<div class="section-card" style="padding:20px 16px;">${html}</div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function renderSanPetersburgoTab() {
        const data = window.sanPetersburgoData || {};
        let html = '';

        // Curiosidades culturales
        if (data.curiosidades && data.curiosidades.length) {
            html += `<div style="padding:0 0 20px;"><h3><i data-lucide="sparkles"></i> Tradiciones y eventos</h3>
            <div style="display:grid; gap:16px; grid-template-columns:repeat(auto-fit, minmax(260px,1fr)); margin-top:14px;">
            ${data.curiosidades.map(c => `
                <div class="curiosity-card" style="background:rgba(33,150,243,0.06); padding:20px; border-radius:14px; text-align:center; border:1px solid rgba(33,150,243,0.12);">
                    <i data-lucide="${c.icon}" style="width:36px; height:36px; display:block; margin:0 auto 10px; color:#4fc3f7;"></i>
                    <strong style="font-size:1rem;">${escapeHtml(c.titulo)}</strong>
                    <p style="margin-top:8px; font-size:0.85rem; line-height:1.5; color:var(--umbra-ash);">${escapeHtml(c.texto)}</p>
                </div>
            `).join('')}
            </div></div>`;
        }

        // Comida rusa
        if (data.foods && data.foods.length) {
            html += `<div style="padding:0 0 20px;"><h3><i data-lucide="utensils"></i> Comida típica rusa</h3>
            <div style="display:grid; gap:14px; grid-template-columns:repeat(auto-fit, minmax(200px,1fr)); margin-top:14px;">
            ${data.foods.map(f => `
                <div style="background:rgba(255,255,255,0.03); border-radius:14px; overflow:hidden; border:1px solid rgba(255,255,255,0.06);">
                    <img src="${f.img}" alt="${escapeHtml(f.nombre)}" loading="lazy" style="width:100%; height:140px; object-fit:cover;">
                    <div style="padding:14px;">
                        <strong>${escapeHtml(f.nombre)}</strong>
                        <p style="margin-top:4px; font-size:0.8rem; color:var(--umbra-ash);">${escapeHtml(f.desc)}</p>
                    </div>
                </div>
            `).join('')}
            </div></div>`;
        }

        // Frases rusas
        if (data.phrases && data.phrases.length) {
            html += `<div style="padding:0 0 20px;"><h3><i data-lucide="languages"></i> Frases rusas</h3>
            <div style="display:grid; gap:10px; margin-top:14px;">
            ${data.phrases.map(p => `
                <div style="padding:12px 16px; background:rgba(33,150,243,0.06); border-radius:12px; border-left:3px solid #4fc3f7; font-size:0.9rem;">
                    ${escapeHtml(p)}
                </div>
            `).join('')}
            </div></div>`;
        }

        tabsContent.innerHTML = `<div class="section-card" style="padding:20px 16px;">${html}</div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function renderGatosTab() {
        const data = window.gatitosData || {};
        let html = '';

        // Curiosidades felinas
        if (data.curiosidades && data.curiosidades.length) {
            html += `<div style="padding:0 0 20px;"><h3><i data-lucide="sparkles"></i> Curiosidades felinas</h3>
            <div style="display:grid; gap:14px; grid-template-columns:repeat(auto-fit, minmax(260px,1fr)); margin-top:14px;">
            ${data.curiosidades.map(c => `
                <div class="curiosity-card" style="background:rgba(255,138,161,0.06); padding:18px; border-radius:14px; text-align:center; border:1px solid rgba(255,138,161,0.12);">
                    <i data-lucide="${c.icon}" style="width:32px; height:32px; display:block; margin:0 auto 8px; color:var(--warm-pink);"></i>
                    <strong style="font-size:0.95rem;">${escapeHtml(c.titulo)}</strong>
                    <p style="margin-top:6px; font-size:0.82rem; line-height:1.5; color:var(--umbra-ash);">${escapeHtml(c.texto)}</p>
                </div>
            `).join('')}
            </div></div>`;
        }

        // Anatomía
        if (data.anatomia && data.anatomia.length) {
            html += `<div style="padding:0 0 20px;"><h3><i data-lucide="bone"></i> Anatomía felina</h3>
            <div style="display:grid; gap:12px; margin-top:14px;">
            ${data.anatomia.map(a => `
                <div style="padding:16px; background:rgba(255,138,161,0.04); border-radius:12px; border:1px solid rgba(255,138,161,0.08);">
                    <strong style="color:var(--warm-pink);">${escapeHtml(a.titulo)}</strong>
                    <p style="margin-top:6px; font-size:0.85rem; line-height:1.5; color:var(--umbra-ash);">${escapeHtml(a.texto)}</p>
                </div>
            `).join('')}
            </div></div>`;
        }

        // Cuidados
        if (data.cuidados && data.cuidados.length) {
            html += `<div style="padding:0 0 10px;"><h3><i data-lucide="heart"></i> Cómo cuidarlos</h3>
            <div style="display:grid; gap:8px; margin-top:14px;">
            ${data.cuidados.map(c => `
                <div style="padding:12px 16px; background:rgba(255,138,161,0.06); border-radius:12px; border-left:3px solid var(--warm-pink); font-size:0.9rem;">
                    ${escapeHtml(c)}
                </div>
            `).join('')}
            </div></div>`;
        }

        tabsContent.innerHTML = `<div class="section-card" style="padding:20px 16px;">${html}</div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    renderTabs();
    renderTabContent();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function initReelLightbox() {
    const reelLightbox = document.getElementById('reelLightbox');
    const reelCloseBtn = document.getElementById('reelCloseBtn');
    const reelPrevBtn = document.getElementById('reelPrevBtn');
    const reelNextBtn = document.getElementById('reelNextBtn');
    if (!reelLightbox || reelLightbox.dataset.bound === 'true') return;

    reelLightbox.dataset.bound = 'true';
    if (reelCloseBtn) reelCloseBtn.addEventListener('click', closeMediaLightbox);
    if (reelPrevBtn) reelPrevBtn.addEventListener('click', prevMedia);
    if (reelNextBtn) reelNextBtn.addEventListener('click', nextMedia);

    reelLightbox.addEventListener('click', (event) => {
        if (event.target === reelLightbox || event.target.classList.contains('lightbox-reel-backdrop')) {
            closeMediaLightbox();
        }
    });

    reelLightbox.addEventListener('touchstart', (event) => {
        if (event.touches.length !== 1) return;
        reelTouchStartX = event.touches[0].clientX;
        reelTouchStartY = event.touches[0].clientY;
    }, { passive: true });

    reelLightbox.addEventListener('touchend', (event) => {
        if (!isMediaLightboxOpen() || currentGalleryItems.length <= 1 || !event.changedTouches.length) return;

        const deltaX = event.changedTouches[0].clientX - reelTouchStartX;
        const deltaY = event.changedTouches[0].clientY - reelTouchStartY;
        const isHorizontalSwipe = Math.abs(deltaX) > 58 && Math.abs(deltaX) > Math.abs(deltaY) * 1.35;

        if (!isHorizontalSwipe) return;
        if (deltaX < 0) {
            nextMedia();
        } else {
            prevMedia();
        }
    }, { passive: true });
}

function initRincon() {
    if (!document.getElementById('rincon')) return;

    const isGalleryPage = !!document.getElementById('galleryImagesGrid');
    const isMemePage = !!document.getElementById('memesGrid');
    const isCuriosidadesPage = !!document.getElementById('rincon-curiosidades');

    if (isGalleryPage) {
        renderGalleryFolders();
        renderGalleryGrid();
        warmGalleryCache();
    }

    if (isMemePage) {
        renderMemes();
    }

    if (isCuriosidadesPage) {
        initCuriosidades();
    }

    initReelLightbox();

    document.querySelectorAll('.sub-tab[data-subview]').forEach((tab) => {
        tab.addEventListener('click', function () {
            showSubview(this.dataset.subview);
        });
    });

    document.addEventListener('keydown', (event) => {
        if (!isMediaLightboxOpen()) return;

        if (event.key === 'Escape') {
            closeMediaLightbox();
        } else if (event.key === 'ArrowRight') {
            nextMedia();
        } else if (event.key === 'ArrowLeft') {
            prevMedia();
        }
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();

    if (typeof initDayCounter === 'function') {
        initDayCounter('rinconDayCounter', '2025-07-03', 'días juntos 🤍👑');
    }
}

document.addEventListener('DOMContentLoaded', initRincon);

window.renderGallery = renderGallery;
window.showFolderContents = showFolderContents;
window.renderMemes = renderMemes;
window.showMemeFolder = showMemeFolder;
window.showSubview = showSubview;
window.openMediaLightbox = openMediaLightbox;
window.closeMediaLightbox = closeMediaLightbox;
window.nextMedia = nextMedia;
window.prevMedia = prevMedia;
window.initCuriosidades = initCuriosidades;
