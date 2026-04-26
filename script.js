// ==========================================
// script.js · Archivo principal del proyecto
// Unifica: reproductor, galería, memes, notas, series, etc.
// ==========================================

// ========== 1. VARIABLES GLOBALES ==========
let currentSong = 0;
let isPlaying = false;
let audioPlayer = null;
let currentMemeFolder = "Favoritos ⭐";
let isSPA = true;
let lyricsVisible = true;
let currentLyricsHTML = '';
let currentFolder = null;
let currentEditNoteIndex = null;
let currentGalleryItems = [];
let currentGalleryIndex = 0;
let activeGalleryType = '';

// ========== 2. FUNCIONES AUXILIARES ==========
function navigateToPage(page) {
    window.location.href = page + '.html';
}

function formatTime(seconds) {
    if (!isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function showMessage(text, isError = false) {
    let existingToast = document.querySelector('.toast-message');
    if(existingToast) existingToast.remove();
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.innerHTML = text;
    if(isError) toast.style.borderLeftColor = '#ff4d4d';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ========== 3. LIGHTBOX GENERAL ==========
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

    if (item.type === 'video') {
        const posterAttr = item.poster ? ` poster="${escapeHtml(item.poster)}"` : '';
        // Estructura personalizada del reproductor
        content.innerHTML = `
            <div class="video-player-wrapper">
                <video id="lightboxVideo" class="lightbox-video" preload="metadata"${posterAttr}>
                    <source src="${escapeHtml(item.src)}" type="video/mp4">
                    Tu navegador no soporta videos.
                </video>
                <div class="video-controls">
                    <button class="video-btn play-pause" id="videoPlayPauseBtn">
                        <i data-lucide="play"></i>
                    </button>
                    <div class="video-progress-bar">
                        <div class="video-progress-track">
                            <div class="video-progress-fill" id="videoProgressFill"></div>
                        </div>
                    </div>
                    <div class="video-time">
                        <span id="videoCurrentTime">0:00</span> / <span id="videoDuration">0:00</span>
                    </div>
                    <button class="video-btn" id="videoMuteBtn">
                        <i data-lucide="volume-2"></i>
                    </button>
                    <button class="video-btn" id="videoFullscreenBtn">
                        <i data-lucide="maximize-2"></i>
                    </button>
                </div>
            </div>
        `;
        // Inicializar el reproductor personalizado
        initVideoPlayer();
    } else {
        content.innerHTML = `<img class="reel-media" src="${escapeHtml(item.src)}" alt="${escapeHtml(item.caption || '')}" loading="eager">`;
    }

    if (captionEl) captionEl.textContent = item.caption || '';
    if (counterEl) counterEl.textContent = `${currentGalleryIndex + 1} / ${currentGalleryItems.length}`;

    const prevBtn = document.getElementById('reelPrevBtn');
    const nextBtn = document.getElementById('reelNextBtn');
    if (prevBtn) prevBtn.disabled = currentGalleryItems.length <= 1;
    if (nextBtn) nextBtn.disabled = currentGalleryItems.length <= 1;
}

function initVideoPlayer() {
    const video = document.getElementById('lightboxVideo');
    if (!video) return;

    const playPauseBtn = document.getElementById('videoPlayPauseBtn');
    const progressFill = document.getElementById('videoProgressFill');
    const progressTrack = document.querySelector('.video-progress-track');
    const currentTimeSpan = document.getElementById('videoCurrentTime');
    const durationSpan = document.getElementById('videoDuration');
    const muteBtn = document.getElementById('videoMuteBtn');
    const fullscreenBtn = document.getElementById('videoFullscreenBtn');

    let isPlaying = false;
    let controlsTimeout;

    function formatTime(seconds) {
        if (isNaN(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function updateProgress() {
        if (video.duration) {
            const percent = (video.currentTime / video.duration) * 100;
            progressFill.style.width = percent + '%';
            currentTimeSpan.textContent = formatTime(video.currentTime);
        }
    }

    function togglePlay() {
        if (video.paused) {
            video.play();
            playPauseBtn.innerHTML = '<i data-lucide="pause"></i>';
            isPlaying = true;
        } else {
            video.pause();
            playPauseBtn.innerHTML = '<i data-lucide="play"></i>';
            isPlaying = false;
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function setProgress(e) {
        const rect = progressTrack.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        video.currentTime = percent * video.duration;
        updateProgress();
    }

    function toggleMute() {
        video.muted = !video.muted;
        muteBtn.innerHTML = video.muted ? '<i data-lucide="volume-x"></i>' : '<i data-lucide="volume-2"></i>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            const wrapper = video.closest('.video-player-wrapper');
            wrapper.requestFullscreen().catch(err => console.log(err));
        } else {
            document.exitFullscreen();
        }
    }

    function showControls() {
        const controls = document.querySelector('.video-controls');
        if (controls) {
            controls.style.opacity = '1';
            controls.style.pointerEvents = 'auto';
            clearTimeout(controlsTimeout);
            controlsTimeout = setTimeout(() => {
                if (isPlaying) {
                    controls.style.opacity = '0';
                    controls.style.pointerEvents = 'none';
                }
            }, 3000);
        }
    }

    video.addEventListener('loadedmetadata', () => {
        durationSpan.textContent = formatTime(video.duration);
    });
    video.addEventListener('timeupdate', updateProgress);
    video.addEventListener('play', () => {
        playPauseBtn.innerHTML = '<i data-lucide="pause"></i>';
        isPlaying = true;
        showControls();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    });
    video.addEventListener('pause', () => {
        playPauseBtn.innerHTML = '<i data-lucide="play"></i>';
        isPlaying = false;
        showControls();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    });
    video.addEventListener('click', togglePlay);
    video.addEventListener('mousemove', showControls);
    video.addEventListener('mouseleave', () => {
        if (isPlaying) {
            const controls = document.querySelector('.video-controls');
            if (controls) {
                controls.style.opacity = '0';
                controls.style.pointerEvents = 'none';
            }
        }
    });

    playPauseBtn.addEventListener('click', togglePlay);
    progressTrack.addEventListener('click', setProgress);
    muteBtn.addEventListener('click', toggleMute);
    fullscreenBtn.addEventListener('click', toggleFullscreen);

    // Auto-play inicial
    video.play().catch(() => {});
}

function playActiveReelVideo() {
    const content = document.getElementById('reelLightboxContent');
    const video = content ? content.querySelector('video') : null;
    if (!video) return;
    video.load();
    video.play().catch(() => {});
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

function openLightbox(src, caption = '') {
    const reelBox = document.getElementById('reelLightbox');
    if (reelBox) {
        openMediaLightbox([{ type: 'image', src, caption }], 0, 'single-image');
        return;
    }
    const content = document.getElementById('lightboxContent');
    const captionEl = document.getElementById('lightboxCaption');
    if (content) content.innerHTML = `<img src="${escapeHtml(src)}" alt="${escapeHtml(caption)}">`;
    if (captionEl) captionEl.textContent = caption;
    const box = document.getElementById('lightbox');
    if (box) box.classList.add('open');
}

function closeLightbox() {
    closeMediaLightbox();
    const box = document.getElementById('lightbox');
    if (box) box.classList.remove('open');
}

// ========== 4. NAVEGACIÓN ENTRE VISTAS (SPA opcional) ==========
function navigateTo(page) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.page === page) btn.classList.add('active');
    });
    document.querySelectorAll('.page-section').forEach(section => {
        section.classList.add('hidden');
        if (section.id === page) section.classList.remove('hidden');
    });
    const url = page === 'home' ? '/' : `/${page}`;
    history.pushState({ page }, '', url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========== 5. REPRODUCTOR DE MÚSICA ==========
function loadSong(index) {
    currentSong = index;
    const song = window.songsData[index];
    const coverEl = document.getElementById('currentCover');
    const titleEl = document.getElementById('currentTitle');
    const subtitleEl = document.getElementById('currentSubtitle');
    if (coverEl) coverEl.src = song.cover;
    if (titleEl) titleEl.textContent = song.title;
    if (subtitleEl) subtitleEl.textContent = song.artist + ' · ' + song.album;
    if (audioPlayer) audioPlayer.src = song.audio;
    renderLyrics(song.lyrics);
    renderSongsList();
    if (isPlaying && audioPlayer) audioPlayer.play();
}

function renderLyrics(lyrics) {
    const panel = document.getElementById('lyricsPanel');
    if (!panel) return;
    currentLyricsHTML = lyrics;
    if (!lyricsVisible) return;
    panel.classList.add('fade-out');
    setTimeout(() => {
        panel.innerHTML = lyrics;
        panel.classList.remove('fade-out');
        if (lyricsVisible) panel.classList.remove('hidden-panel');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }, 200);
}

function toggleLyricsPanel() {
    const panel = document.getElementById('lyricsPanel');
    const btn = document.getElementById('toggleLyricsBtn');
    if (!panel) return;
    lyricsVisible = !lyricsVisible;
    if (lyricsVisible) {
        panel.classList.remove('hidden-panel');
        if (currentLyricsHTML) panel.innerHTML = currentLyricsHTML;
        if (btn) btn.innerHTML = '<i data-lucide="eye"></i>';
    } else {
        panel.classList.add('hidden-panel');
        if (btn) btn.innerHTML = '<i data-lucide="eye-off"></i>';
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function expandLyricsLightbox() {
    const lightbox = document.getElementById('lyricsLightbox');
    const expandedDiv = document.getElementById('expandedLyricsText');
    if (!lightbox || !expandedDiv) return;
    expandedDiv.innerHTML = currentLyricsHTML || '<em>No hay letra disponible para esta canción</em>';
    lightbox.classList.add('open');
}

function closeLyricsLightbox() {
    const lightbox = document.getElementById('lyricsLightbox');
    if (lightbox) lightbox.classList.remove('open');
}

function renderSongsList() {
    const list = document.getElementById('songsList');
    if (!list) return;
    list.innerHTML = window.songsData.map((song, i) => `
        <button class="song-row ${i === currentSong ? 'active' : ''}" data-index="${i}">
            <img src="${song.cover}" alt="${song.title}">
            <div class="song-info">
                <strong>${escapeHtml(song.title)}</strong>
                <span>${escapeHtml(song.artist)}</span>
            </div>
            <i data-lucide="play"></i>
        </button>
    `).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function togglePlay() {
    if (!audioPlayer) return;
    const btn = document.getElementById('playBtn');
    if (isPlaying) {
        audioPlayer.pause();
        if (btn) btn.innerHTML = '<i data-lucide="play"></i>';
    } else {
        audioPlayer.play();
        if (btn) btn.innerHTML = '<i data-lucide="pause"></i>';
    }
    isPlaying = !isPlaying;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function prevSong() {
    loadSong((currentSong - 1 + window.songsData.length) % window.songsData.length);
    if (isPlaying && audioPlayer) audioPlayer.play();
}

function nextSong() {
    loadSong((currentSong + 1) % window.songsData.length);
    if (isPlaying && audioPlayer) audioPlayer.play();
}

function updateProgress() {
    if (!audioPlayer) return;
    const pct = (audioPlayer.currentTime / (audioPlayer.duration || 1)) * 100;
    const fill = document.getElementById('progressFill');
    if (fill) fill.style.width = pct + '%';
    const currentSpan = document.getElementById('currentTime');
    if (currentSpan) currentSpan.textContent = formatTime(audioPlayer.currentTime);
    const totalSpan = document.getElementById('totalTime');
    if (totalSpan && audioPlayer.duration) totalSpan.textContent = formatTime(audioPlayer.duration);
}

function setupProgressClick() {
    const track = document.querySelector('.progress-track');
    if (!track || !audioPlayer) return;
    track.addEventListener('click', function(e) {
        if (!audioPlayer.duration) return;
        const rect = track.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audioPlayer.currentTime = percent * audioPlayer.duration;
        updateProgress();
    });
}

// ========== 6. GALERÍA (RINCON) ==========
function renderGallery() {
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;
    grid.innerHTML = `
        <div class="pinterest-grid">
            ${Object.entries(window.galleryFoldersData).map(([name, images]) => `
                <div class="pinterest-item" onclick="showFolderContents('${escapeHtml(name)}')">
                    <img src="${escapeHtml(images[0])}" alt="${escapeHtml(name)}" loading="lazy">
                    <div class="overlay"><span><i data-lucide="folder"></i> ${escapeHtml(name)} · ${images.length} fotos</span></div>
                </div>
            `).join('')}
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function buildFolderGalleryItems(folderName) {
    const images = window.galleryFoldersData[folderName] || [];
    return images.map((src, i) => ({
        type: 'image',
        src,
        caption: `${folderName} - ${i + 1}`
    }));
}

function showFolderContents(folderName) {
    currentFolder = folderName;
    const images = window.galleryFoldersData[folderName];
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;
    grid.innerHTML = `
        <button class="back-btn" onclick="renderGallery()" style="margin-bottom:16px;">
            <i data-lucide="arrow-left"></i> Volver a carpetas
        </button>
        <div class="pinterest-grid">
            ${images.map((src, i) => `
                <div class="pinterest-item folder-media-item" data-folder="${escapeHtml(folderName)}" data-index="${i}">
                    <img src="${escapeHtml(src)}" alt="${escapeHtml(folderName)} ${i+1}" loading="lazy">
                    <div class="overlay"><span><i data-lucide="eye"></i> Ver ${i+1}</span></div>
                </div>
            `).join('')}
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    grid.querySelectorAll('.folder-media-item').forEach(item => {
        item.addEventListener('click', () => {
            const startIndex = Number(item.dataset.index);
            openMediaLightbox(buildFolderGalleryItems(folderName), startIndex, `gallery:${folderName}`);
        });
    });
}

// ========== 7. MEMES (CUADRÍCULA Y VIDEOS) ==========
function isVideoMeme(src) {
    return /\.(mp4|webm|mov)$/i.test(src || '');
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

function renderMemes() {
    const nav = document.getElementById('memesFoldersNav');
    if (nav) {
        nav.innerHTML = Object.keys(window.memeImagesData).map(folder => `
            <button class="memes-folder-btn ${folder === currentMemeFolder ? 'active' : ''}" onclick="showMemeFolder('${escapeHtml(folder)}')">
                <i data-lucide="folder"></i> ${escapeHtml(folder)}
                <span class="folder-count">${window.memeImagesData[folder].length}</span>
            </button>
        `).join('');
    }

    const grid = document.getElementById('memesGrid');
    if (!grid) return;
    grid.className = 'insta-grid';

    const items = window.memeImagesData[currentMemeFolder];
    if (!items || items.length === 0) {
        grid.className = '';
        grid.innerHTML = '<div class="empty-state">Elije una carpeta para ver sus memes</div>';
        return;
    }

    grid.innerHTML = items.map((src, i) => {
        const isVideo = isVideoMeme(src);
        const caption = `${currentMemeFolder} - ${i + 1}`;

        if (isVideo) {
            const posterUrl = getVideoPosterUrl(src);
            return `
                <article class="insta-item" tabindex="0" role="button" aria-label="Abrir video ${i + 1}" data-index="${i}" data-type="video" data-src="${escapeHtml(src)}" data-caption="${escapeHtml(caption)}" data-poster="${escapeHtml(posterUrl)}">
                    <img src="${escapeHtml(posterUrl || src)}" alt="Miniatura del meme ${i + 1}" loading="lazy">
                    <div class="insta-overlay"><i data-lucide="play-circle"></i></div>
                </article>
            `;
        }

        return `
            <article class="insta-item" tabindex="0" role="button" aria-label="Abrir imagen ${i + 1}" data-index="${i}" data-type="image" data-src="${escapeHtml(src)}" data-caption="${escapeHtml(caption)}">
                <img src="${escapeHtml(src)}" alt="Meme ${i + 1}" loading="lazy">
                <div class="insta-overlay"><i data-lucide="eye"></i></div>
            </article>
        `;
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();

    const memeGalleryItems = items.map((src, i) => ({
        type: isVideoMeme(src) ? 'video' : 'image',
        src,
        caption: `${currentMemeFolder} - ${i + 1}`,
        poster: isVideoMeme(src) ? getVideoPosterUrl(src) : ''
    }));

    grid.querySelectorAll('.insta-item').forEach(item => {
        const startIndex = Number(item.dataset.index || item.getAttribute('data-index'));

        item.addEventListener('click', (e) => {
            e.stopPropagation();
            openMediaLightbox(memeGalleryItems, startIndex, `memes:${currentMemeFolder}`);
        });

        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openMediaLightbox(memeGalleryItems, startIndex, `memes:${currentMemeFolder}`);
            }
        });
    });
}

function showMemeFolder(folder) {
    currentMemeFolder = folder;
    renderMemes();
}

function openVideoLightbox(videoSrc, caption) {
    openMediaLightbox([{
        type: 'video',
        src: videoSrc,
        caption,
        poster: getVideoPosterUrl(videoSrc)
    }], 0, 'single-video');
}

function renderGustos() {
    const panel = document.getElementById('gustosPanel');
    if (!panel) return;
    const d = window.gustosData;
    const podioHTML = d.podio.map(item => `
        <div class="planner-step" style="margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
                <span style="font-size:1.8rem;line-height:1;">${item.medalla}</span>
                <div>
                    <strong style="font-family:'Playfair Display',serif;font-size:1.1rem;font-weight:500;display:block;">${escapeHtml(item.titulo)}</strong>
                    <span style="font-size:0.72rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--accent-coral);">${escapeHtml(item.tipo)}</span>
                </div>
            </div>
            <p style="font-size:0.85rem;line-height:1.7;color:var(--umbra-ash);">${escapeHtml(item.descripcion)}</p>
        </div>
    `).join('');
    const personalHTML = `
        <div class="planner-grid" style="margin-top:8px;">
            <div class="planner-step">
                <h4 style="margin-bottom:10px;font-size:0.9rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--umbra-ash);">Personal</h4>
                <ul style="padding-left:18px;color:var(--umbra-ash);line-height:2;font-size:0.85rem;">
                    ${d.personal.map(i => `<li>${escapeHtml(i)}</li>`).join('')}
                </ul>
            </div>
            <div class="planner-step">
                <h4 style="margin-bottom:10px;font-size:0.9rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--umbra-ash);">Comida favorita</h4>
                <ul style="padding-left:18px;color:var(--umbra-ash);line-height:2;font-size:0.85rem;">
                    ${d.food.map(i => `<li>${escapeHtml(i)}</li>`).join('')}
                </ul>
            </div>
        </div>
    `;
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
            ${personalHTML}
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}
/* DATOS DE GATOS */
function renderCatFacts() {
    const list = document.getElementById('catFacts');
    if (!list) return;
    list.style.listStyle = 'none';
    list.style.padding = '0';
    list.innerHTML = `
        <p style="font-size:0.88rem;line-height:1.7;color:var(--umbra-ash);margin-bottom:20px;">
            Los gatos son mascotas fascinantes con comportamientos y capacidades que llevan siglos sorprendiendo a los humanos. Aquí van algunos datos que quizás no sabías.
        </p>
        <div style="display:grid;gap:14px;">
            ${window.catFactsData.map(f => `
                <div class="planner-step" style="display:flex;gap:14px;align-items:flex-start;">
                    <span style="font-size:1.4rem;line-height:1;flex-shrink:0;margin-top:2px;">${f.icon}</span>
                    <div>
                        <strong style="display:block;font-weight:500;margin-bottom:4px;">${escapeHtml(f.titulo)}</strong>
                        <p style="font-size:0.85rem;line-height:1.7;color:var(--umbra-ash);margin:0;">${escapeHtml(f.texto)}</p>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderSPB() {
    const panel = document.getElementById('spbPanel');
    if (!panel) return;
    const spb = window.spbData;
    panel.innerHTML = `
        <p style="font-size:0.9rem;line-height:1.8;color:var(--umbra-ash);margin-bottom:28px;border-left:2px solid var(--accent-coral);padding-left:16px;">
            ${escapeHtml(spb.intro)}
        </p>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
            <i data-lucide="sparkles"></i>
            <h4 style="margin:0;font-family:'Playfair Display',serif;font-size:1.2rem;">Curiosidades</h4>
        </div>
        <div style="display:grid;gap:14px;margin-bottom:32px;">
            ${spb.curiosidades.map(c => `
                <div class="planner-step" style="display:flex;gap:14px;align-items:flex-start;">
                    <span style="font-size:1.4rem;line-height:1;flex-shrink:0;margin-top:2px;">${c.icon}</span>
                    <div>
                        <strong style="display:block;font-weight:500;margin-bottom:4px;">${escapeHtml(c.titulo)}</strong>
                        <p style="font-size:0.85rem;line-height:1.7;color:var(--umbra-ash);margin:0;">${escapeHtml(c.texto)}</p>
                    </div>
                </div>
            `).join('')}
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
            <i data-lucide="utensils"></i>
            <h4 style="margin:0;font-family:'Playfair Display',serif;font-size:1.2rem;">Gastronomía típica</h4>
        </div>
        <div class="planner-grid" style="margin-bottom:32px;">
            ${spb.foods.map(food => `
                <div class="planner-step">
                    <img src="${escapeHtml(food[1])}" alt="${escapeHtml(food[0])}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--radius-md);margin-bottom:10px;">
                    <strong style="font-family:'Playfair Display',serif;">${escapeHtml(food[0])}</strong>
                </div>
            `).join('')}
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
            <i data-lucide="map-pin"></i>
            <h4 style="margin:0;font-family:'Playfair Display',serif;font-size:1.2rem;">Lugares imprescindibles</h4>
        </div>
        <div class="pinterest-grid" style="margin-bottom:32px;">
            ${spb.places.map(src => `
                <div class="pinterest-item" onclick="openLightbox('${escapeHtml(src)}', 'San Petersburgo')">
                    <img src="${escapeHtml(src)}" alt="San Petersburgo" loading="lazy">
                    <div class="overlay"><span><i data-lucide="eye"></i> Ver</span></div>
                </div>
            `).join('')}
        </div>
        <div class="planner-grid">
            <div class="planner-step">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
                    <i data-lucide="star"></i>
                    <h4 style="margin:0;font-family:'Playfair Display',serif;">Tradiciones</h4>
                </div>
                <ul style="padding-left:18px;color:var(--umbra-ash);line-height:2;font-size:0.85rem;">
                    ${spb.traditions.map(t => `<li>${escapeHtml(t)}</li>`).join('')}
                </ul>
            </div>
            <div class="planner-step">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
                    <i data-lucide="message-circle"></i>
                    <h4 style="margin:0;font-family:'Playfair Display',serif;">Frases en ruso</h4>
                </div>
                <ul style="padding-left:18px;color:var(--umbra-ash);line-height:2;font-size:0.85rem;">
                    ${spb.phrases.map(p => `<li>${escapeHtml(p)}</li>`).join('')}
                </ul>
            </div>
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ========== 9. SUBVISTAS (RINCON) ==========
function showSubview(viewId) {
    const parent = document.getElementById('rincon');
    if (!parent) return;
    parent.querySelectorAll('.sub-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.subview === viewId) tab.classList.add('active');
    });
    parent.querySelectorAll('.sub-view').forEach(view => {
        view.classList.remove('active');
        if (view.id === viewId) view.classList.add('active');
    });
}

// ========== 10. NOTAS (PLANNER) ==========
function loadNotes() {
    const container = document.getElementById('notesList');
    if (!container) return;
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    if (notes.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: var(--space-lg); color: var(--umbra-ash);"><i data-lucide="inbox"></i><p>No hay notas aún. Escribe una.</p></div>';
    } else {
        container.innerHTML = notes.map((note, index) => `
            <div class="note-item" data-index="${index}">
                <div class="note-item-preview">${escapeHtml(note.text.substring(0, 100))}${note.text.length > 100 ? '…' : ''}</div>
                <div class="note-item-footer">
                    <span>${new Date(note.date).toLocaleDateString()}</span>
                    <div class="note-item-actions">
                        <button class="edit-note-btn" data-index="${index}" title="Editar"><i data-lucide="edit-2"></i></button>
                        <button class="delete-note-btn" data-index="${index}" title="Eliminar"><i data-lucide="trash-2"></i></button>
                        <button class="expand-note-btn" data-index="${index}" title="Expandir"><i data-lucide="maximize-2"></i></button>
                    </div>
                </div>
            </div>
        `).join('');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();

    document.querySelectorAll('.edit-note-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            editNote(idx);
        });
    });
    document.querySelectorAll('.delete-note-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            deleteNote(idx);
        });
    });
    document.querySelectorAll('.expand-note-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            expandNote(idx);
        });
    });
    document.querySelectorAll('.note-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                const idx = parseInt(item.dataset.index);
                expandNote(idx);
            }
        });
    });
}

function addNote() {
    const textarea = document.getElementById('noteInput');
    if (!textarea || !textarea.value.trim()) return;
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    notes.unshift({
        text: textarea.value.trim(),
        date: new Date().toISOString()
    });
    localStorage.setItem('notes', JSON.stringify(notes));
    textarea.value = '';
    loadNotes();
    showMessage('✅ Nota guardada');
}

function deleteNote(index) {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    notes.splice(index, 1);
    localStorage.setItem('notes', JSON.stringify(notes));
    loadNotes();
    closeNoteLightbox();
    showMessage('🗑️ Nota eliminada');
}

function editNote(index) {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    const note = notes[index];
    if (!note) return;
    currentEditNoteIndex = index;
    const textarea = document.getElementById('expandedNoteText');
    if (textarea) textarea.value = note.text;
    const lightbox = document.getElementById('noteLightbox');
    if (lightbox) lightbox.classList.add('open');
}

function expandNote(index) {
    editNote(index);
}

function saveNoteEdit() {
    if (currentEditNoteIndex === null) return;
    const textarea = document.getElementById('expandedNoteText');
    if (!textarea) return;
    const newText = textarea.value.trim();
    if (!newText) return;
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    if (notes[currentEditNoteIndex]) {
        notes[currentEditNoteIndex].text = newText;
        notes[currentEditNoteIndex].date = new Date().toISOString();
        localStorage.setItem('notes', JSON.stringify(notes));
        showMessage('✏️ Nota actualizada');
    }
    closeNoteLightbox();
    loadNotes();
}

function deleteCurrentNoteFromLightbox() {
    if (currentEditNoteIndex !== null) {
        deleteNote(currentEditNoteIndex);
    }
    closeNoteLightbox();
}

function closeNoteLightbox() {
    const lightbox = document.getElementById('noteLightbox');
    if (lightbox) lightbox.classList.remove('open');
    currentEditNoteIndex = null;
    const textarea = document.getElementById('expandedNoteText');
    if (textarea) textarea.value = '';
}

function setupNotesEvents() {
    const addBtn = document.getElementById('addNoteBtn');
    if (addBtn) addBtn.addEventListener('click', addNote);
    const noteInput = document.getElementById('noteInput');
    if (noteInput) noteInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') addNote();
    });
    const saveEditBtn = document.getElementById('saveNoteEditBtn');
    if (saveEditBtn) saveEditBtn.addEventListener('click', saveNoteEdit);
    const deleteFromLightboxBtn = document.getElementById('deleteNoteFromLightboxBtn');
    if (deleteFromLightboxBtn) deleteFromLightboxBtn.addEventListener('click', deleteCurrentNoteFromLightbox);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeNoteLightbox();
    });
    const lightbox = document.getElementById('noteLightbox');
    if (lightbox) lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeNoteLightbox();
    });
}

// ========== 11. INICIALIZACIÓN PRINCIPAL ==========
function init() {
    console.log('Inicializando Personal Hub...');
    audioPlayer = document.getElementById('audioPlayer');
    if (audioPlayer) setupProgressClick();

    if (document.getElementById('canciones') && window.songsData) loadSong(0);
    if (document.getElementById('galleryGrid')) renderGallery();
    if (document.getElementById('memesGrid')) renderMemes();
    if (document.getElementById('gustosPanel')) renderGustos();
    if (document.getElementById('catFacts')) renderCatFacts();
    if (document.getElementById('spbPanel')) renderSPB();
    if (document.getElementById('notesList')) {
        loadNotes();
        setupNotesEvents();
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ========== 12. EVENT LISTENERS GLOBALES ==========
document.addEventListener('DOMContentLoaded', function() {
    init();

    if (audioPlayer) {
        audioPlayer.addEventListener('timeupdate', updateProgress);
        audioPlayer.addEventListener('loadedmetadata', updateProgress);
        audioPlayer.addEventListener('ended', nextSong);
    }

    document.querySelectorAll('.sub-tab[data-subview]').forEach(tab => {
        tab.addEventListener('click', function() {
            showSubview(this.dataset.subview);
        });
    });

    const playBtn = document.getElementById('playBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    if (playBtn) playBtn.addEventListener('click', togglePlay);
    if (prevBtn) prevBtn.addEventListener('click', prevSong);
    if (nextBtn) nextBtn.addEventListener('click', nextSong);

    const songsList = document.getElementById('songsList');
    if (songsList) {
        songsList.addEventListener('click', function(e) {
            const row = e.target.closest('.song-row');
            if (row) {
                loadSong(Number(row.dataset.index));
                if (audioPlayer) {
                    audioPlayer.play();
                    isPlaying = true;
                    const playIcon = document.getElementById('playBtn');
                    if (playIcon) playIcon.innerHTML = '<i data-lucide="pause"></i>';
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }
            }
        });
    }

    const toggleLyricsBtn = document.getElementById('toggleLyricsBtn');
    const expandLyricsBtn = document.getElementById('expandLyricsBtn');
    if (toggleLyricsBtn) toggleLyricsBtn.addEventListener('click', toggleLyricsPanel);
    if (expandLyricsBtn) expandLyricsBtn.addEventListener('click', expandLyricsLightbox);

    const reelLightbox = document.getElementById('reelLightbox');
    const reelCloseBtn = document.getElementById('reelCloseBtn');
    const reelPrevBtn = document.getElementById('reelPrevBtn');
    const reelNextBtn = document.getElementById('reelNextBtn');
    if (reelCloseBtn) reelCloseBtn.addEventListener('click', closeMediaLightbox);
    if (reelPrevBtn) reelPrevBtn.addEventListener('click', prevMedia);
    if (reelNextBtn) reelNextBtn.addEventListener('click', nextMedia);
    if (reelLightbox) {
        reelLightbox.addEventListener('click', function(e) {
            if (e.target === reelLightbox || e.target.classList.contains('lightbox-reel-backdrop')) {
                closeMediaLightbox();
            }
        });
    }

    document.addEventListener('keydown', function(e) {
        if (isMediaLightboxOpen()) {
            if (e.key === 'Escape') {
                closeMediaLightbox();
            } else if (e.key === 'ArrowRight') {
                nextMedia();
            } else if (e.key === 'ArrowLeft') {
                prevMedia();
            }
            return;
        }
        if (e.key === 'Escape') {
            closeLyricsLightbox();
            closeLightbox();
        }
    });
    const lyricsLightbox = document.getElementById('lyricsLightbox');
    if (lyricsLightbox) {
        lyricsLightbox.addEventListener('click', function(e) {
            if (e.target === lyricsLightbox) closeLyricsLightbox();
        });
    }

    const giftInput = document.getElementById('giftInput');
    if (giftInput) giftInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') addGift();
    });

    const lightbox = document.getElementById('lightbox');
    if (lightbox) lightbox.addEventListener('click', function(e) {
        if (e.target.id === 'lightbox') closeLightbox();
    });
});

// ========== 13. EXPOSICIÓN DE FUNCIONES GLOBALES ==========
window.showFolderContents = showFolderContents;
window.showMemeFolder = showMemeFolder;
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.openMediaLightbox = openMediaLightbox;
window.closeMediaLightbox = closeMediaLightbox;
window.nextMedia = nextMedia;
window.prevMedia = prevMedia;
window.closeLyricsLightbox = closeLyricsLightbox;
window.toggleLyricsPanel = toggleLyricsPanel;
window.expandLyricsLightbox = expandLyricsLightbox;
window.openVideoLightbox = openVideoLightbox;