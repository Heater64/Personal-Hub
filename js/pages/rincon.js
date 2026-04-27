// ==========================================
// rincon.js · galeria, memes, gustos y SPB
// ==========================================
let currentFolder = null;
let currentMemeFolder = 'Favoritos ⭐';
let currentGalleryItems = [];
let currentGalleryIndex = 0;
let activeGalleryType = '';
let currentVideoElement = null;

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

    if (item.type === 'video') {
        const wrapper = document.createElement('div');
        wrapper.className = 'video-player-wrapper';

        const video = document.createElement('video');
        video.className = 'reel-media';
        video.preload = 'metadata';
        video.playsInline = true;
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

        controls.appendChild(playPauseBtn);
        controls.appendChild(muteBtn);
        controls.appendChild(progressContainer);
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
        video.addEventListener('loadedmetadata', updateProgress);
        video.addEventListener('play', refreshPlayIcon);
        video.addEventListener('pause', refreshPlayIcon);
        video.addEventListener('volumechange', refreshMuteIcon);
        wrapper.addEventListener('fullscreenchange', refreshFullscreenIcon);

        currentVideoElement = video;
        if (typeof lucide !== 'undefined') lucide.createIcons({ root: wrapper });

        requestAnimationFrame(() => {
            video.play().then(refreshPlayIcon).catch(() => {
                refreshPlayIcon();
            });
        });
    } else {
        const image = document.createElement('img');
        image.className = 'reel-media';
        image.src = item.src;
        image.alt = item.caption || '';
        image.loading = 'eager';
        content.appendChild(image);
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
    box.classList.add('open');
    document.body.classList.add('reel-lightbox-open');
    renderMediaLightboxItem();
}

function closeMediaLightbox() {
    const box = document.getElementById('reelLightbox');
    const content = document.getElementById('reelLightboxContent');
    cleanupActiveVideo();
    if (content) content.innerHTML = '';
    if (box) {
        box.classList.remove('open');
        box.setAttribute('aria-hidden', 'true');
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

function buildFolderGalleryItems(folderName) {
    const images = window.galleryFoldersData?.[folderName] || [];
    return images.map((src, index) => ({
        type: 'image',
        src,
        caption: `${folderName} - ${index + 1}`
    }));
}

function renderGallery() {
    const grid = document.getElementById('galleryGrid');
    if (!grid || !window.galleryFoldersData) return;

    grid.innerHTML = `
        <div class="pinterest-grid">
            ${Object.entries(window.galleryFoldersData).map(([name, images]) => `
                <div class="pinterest-item folder-card" data-folder="${escapeHtml(name)}">
                    <img src="${escapeHtml(images[0] || '')}" alt="${escapeHtml(name)}" loading="lazy">
                    <div class="overlay"><span><i data-lucide="folder"></i> ${escapeHtml(name)} · ${images.length} fotos</span></div>
                </div>
            `).join('')}
        </div>
    `;

    grid.querySelectorAll('.folder-card').forEach((item) => {
        item.addEventListener('click', () => {
            showFolderContents(item.dataset.folder);
        });
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
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

    if (nav) {
        nav.innerHTML = Object.keys(window.memeImagesData).map((folder) => `
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

function renderGustos() {
    const panel = document.getElementById('gustosPanel');
    const data = window.gustosData;
    if (!panel || !data) return;

    const podioHTML = data.podio.map((item) => `
        <div class="planner-step" style="margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
                <span style="font-size:1.8rem;line-height:1;">${escapeHtml(item.medalla)}</span>
                <div>
                    <strong style="font-family:'Playfair Display',serif;font-size:1.1rem;font-weight:500;display:block;">${escapeHtml(item.titulo)}</strong>
                    <span style="font-size:0.72rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--accent-coral);">${escapeHtml(item.tipo)}</span>
                </div>
            </div>
            <p style="font-size:0.85rem;line-height:1.7;color:var(--umbra-ash);">${escapeHtml(item.descripcion)}</p>
        </div>
    `).join('');

    panel.innerHTML = `
        <div style="margin-bottom:28px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;">
                <i data-lucide="trophy"></i>
                <h4 style="margin:0;font-family:'Playfair Display',serif;font-size:1.2rem;">Series y películas favoritas</h4>
            </div>
            ${podioHTML}
        </div>
        <div style="border-top:var(--border-subtle);padding-top:24px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
                <i data-lucide="sparkles"></i>
                <h4 style="margin:0;font-family:'Playfair Display',serif;font-size:1.2rem;">Más cosas sobre ti</h4>
            </div>
            <div class="planner-grid" style="margin-top:8px;">
                <div class="planner-step">
                    <h4 style="margin-bottom:10px;font-size:0.9rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--umbra-ash);">Personal</h4>
                    <ul style="padding-left:18px;color:var(--umbra-ash);line-height:2;font-size:0.85rem;">
                        ${data.personal.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
                    </ul>
                </div>
                <div class="planner-step">
                    <h4 style="margin-bottom:10px;font-size:0.9rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--umbra-ash);">Comida favorita</h4>
                    <ul style="padding-left:18px;color:var(--umbra-ash);line-height:2;font-size:0.85rem;">
                        ${data.food.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
                    </ul>
                </div>
            </div>
        </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderCatFacts() {
    const list = document.getElementById('catFacts');
    if (!list || !window.catFactsData) return;

    list.style.listStyle = 'none';
    list.style.padding = '0';
    list.innerHTML = `
        <p style="font-size:0.88rem;line-height:1.7;color:var(--umbra-ash);margin-bottom:20px;">
            Los gatos son mascotas fascinantes con comportamientos y capacidades que llevan siglos sorprendiendo a los humanos. Aquí van algunos datos que quizá no sabías.
        </p>
        <div style="display:grid;gap:14px;">
            ${window.catFactsData.map((fact) => `
                <div class="planner-step" style="display:flex;gap:14px;align-items:flex-start;">
                    <span style="font-size:1.4rem;line-height:1;flex-shrink:0;margin-top:2px;">${escapeHtml(fact.icon)}</span>
                    <div>
                        <strong style="display:block;font-weight:500;margin-bottom:4px;">${escapeHtml(fact.titulo)}</strong>
                        <p style="font-size:0.85rem;line-height:1.7;color:var(--umbra-ash);margin:0;">${escapeHtml(fact.texto)}</p>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
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
}

function initSPBSection() {
    const accordions = document.querySelectorAll('#rincon-spb .accordion-item');
    accordions.forEach((item) => {
        const header = item.querySelector('.accordion-header');
        if (!header) return;
        header.addEventListener('click', () => {
            item.classList.toggle('open');
        });
    });

    const curiosidades = window.spbData?.curiosidades || [
        { icon: 'droplets', titulo: 'Río San Juan', texto: 'Aguas frescas y cristalinas que atraviesan la comunidad. Centro de recreación y diversión para todos.' },
        { icon: 'scroll-text', titulo: 'Nombre original', texto: 'Se llamaba "San Juan Caite" (caite = sandalia) por estar alejado de San Juan Benque.' },
        { icon: 'wind', titulo: 'Huracán Fifí', texto: 'En 1974 devastó la región pero provocó un repoblamiento masivo, especialmente de personas del occidente de Honduras.' },
        { icon: 'activity', titulo: 'Enjambre sísmico 2013', texto: '36 sismos entre 3.1 y 5.6. 140 casas destruidas, 66 dañadas, cero víctimas mortales.' },
        { icon: 'building-2', titulo: 'Tres intentos fallidos', texto: 'Desde 1996 quieren ser municipio, pero necesitan 30,000 hab. y 40 km².' },
        { icon: 'languages', titulo: 'Significado tolupán', texto: '"Xantun" o "Xan" = "río entre montañas".' }
    ];

    const curiosidadesContainer = document.getElementById('spbCuriosidades');
    if (curiosidadesContainer) {
        curiosidadesContainer.innerHTML = curiosidades.map((item) => `
            <div class="planner-step curiosity-card" style="background: rgba(255,215,0,0.05); transition: all 0.2s ease; text-align: center;">
                <i data-lucide="${item.icon}" style="width: 40px; height: 40px; display: block; margin-bottom: 12px; color: #FFD966;"></i>
                <strong style="font-size: 1.1rem;">${escapeHtml(item.titulo)}</strong>
                <p style="margin-top: 8px; font-size: 0.85rem; line-height: 1.6;">${escapeHtml(item.texto)}</p>
            </div>
        `).join('');
    }

    const galeriaFotos = [
        { src: 'https://res.cloudinary.com/dcsent4fs/image/upload/v1777139714/RioSanjuan_hby0wz.jpg', caption: 'Río San Juan' },
        { src: 'https://res.cloudinary.com/dcsent4fs/image/upload/v1777139715/SanJuan_hbfrrb.jpg', caption: 'Paisaje del pueblo' },
        { src: 'https://res.cloudinary.com/dcsent4fs/image/upload/v1777139823/2jnguoiwhtlinyh_ncbyju.jpg', caption: 'Vistas de la comunidad' }
    ];

    const galleryContainer = document.getElementById('spbGallery');
    if (galleryContainer) {
        galleryContainer.innerHTML = galeriaFotos.map((item, index) => `
            <div class="pinterest-item" data-index="${index}" style="cursor:pointer;">
                <img src="${item.src}" alt="${escapeHtml(item.caption)}" loading="lazy">
                <div class="overlay"><span><i data-lucide="eye"></i> ${escapeHtml(item.caption)}</span></div>
            </div>
        `).join('');

        const items = galeriaFotos.map((item) => ({ type: 'image', src: item.src, caption: item.caption }));
        galleryContainer.querySelectorAll('.pinterest-item').forEach((item) => {
            item.addEventListener('click', () => {
                openMediaLightbox(items, Number(item.dataset.index), 'spb-gallery');
            });
        });
    }

    const counterEl = document.getElementById('habitantesCounter');
    if (counterEl) {
        let start = 0;
        const end = 15000;
        const duration = 2000;
        const step = Math.ceil(end / (duration / 30));
        const timer = setInterval(() => {
            start += step;
            if (start >= end) {
                counterEl.innerText = end.toLocaleString();
                clearInterval(timer);
            } else {
                counterEl.innerText = start.toLocaleString();
            }
        }, 30);
    }

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
}

function initRincon() {
    if (!document.getElementById('rincon')) return;

    renderGallery();
    renderMemes();
    renderGustos();
    renderCatFacts();
    initSPBSection();
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
}

document.addEventListener('DOMContentLoaded', initRincon);

window.renderGallery = renderGallery;
window.showFolderContents = showFolderContents;
window.renderMemes = renderMemes;
window.showMemeFolder = showMemeFolder;
window.renderGustos = renderGustos;
window.renderCatFacts = renderCatFacts;
window.showSubview = showSubview;
window.openMediaLightbox = openMediaLightbox;
window.closeMediaLightbox = closeMediaLightbox;
window.nextMedia = nextMedia;
window.prevMedia = prevMedia;
