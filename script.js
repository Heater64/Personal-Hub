// ==========================================
// SCRIPT - LógicaSPA para Personal Hub
// ==========================================

// ========== STATE ==========
let currentSong = 0;
let isPlaying = false;
let currentMemeFolder = "Favoritos ⭐";
let isSPA = true;

// ========== NAVEGACIÓN EXTERNA DESDE WIDGETS ==========
function navigateToPage(page) {
    window.location.href = page + '.html';
}

// ========== AUDIO ==========
let audioPlayer = null;

// ========== FORMAT TIME ==========
function formatTime(seconds) {
    if (!isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
}

// ========== NAVIGACIÓN ==========
function navigateTo(page) {
    // Actualizar botones de navegación
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.page === page) {
            btn.classList.add('active');
        }
    });

    // Mostrar sección对应的
    document.querySelectorAll('.page-section').forEach(section => {
        section.classList.add('hidden');
        if (section.id === page) {
            section.classList.remove('hidden');
        }
    });

    // Actualizar URL
    const url = page === 'home' ? '/' : `/${page}`;
    history.pushState({ page }, '', url);

    // Scroll arriba
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========== SUB-NAVIGATION (RINCÓN) ==========
function showSubview(viewId) {
    const parent = document.getElementById('rincon');
    if (!parent) return;

    parent.querySelectorAll('.sub-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.subview === viewId) {
            tab.classList.add('active');
        }
    });

    parent.querySelectorAll('.sub-view').forEach(view => {
        view.classList.remove('active');
        if (view.id === viewId) {
            view.classList.add('active');
        }
    });
}

// ========== REPRODUCTOR DE CANCIONES ==========
function loadSong(index) {
    currentSong = index;
    const song = window.songsData[index];

    // Actualizar cover, título, subtítulo
    const coverEl = document.getElementById('currentCover');
    const titleEl = document.getElementById('currentTitle');
    const subtitleEl = document.getElementById('currentSubtitle');

    if (coverEl) coverEl.src = song.cover;
    if (titleEl) titleEl.textContent = song.title;
    if (subtitleEl) subtitleEl.textContent = song.artist + ' · ' + song.album;

    // Actualizar audio
    if (audioPlayer) {
        audioPlayer.src = song.audio;
    }

    // Actualizar letra
    renderLyrics(song.lyrics);

    // Actualizar lista
    renderSongsList();
}

function renderLyrics(lyrics) {
    const panel = document.getElementById('lyricsPanel');
    if (panel) {
        panel.innerHTML = lyrics;
    }
}

function renderSongsList() {
    const list = document.getElementById('songsList');
    if (!list) return;

    list.innerHTML = window.songsData.map((song, i) => `
        <button class="song-row ${i === currentSong ? 'active' : ''}" data-index="${i}">
            <img src="${song.cover}" alt="${song.title}">
            <div class="song-info">
                <strong>${song.title}</strong>
                <span>${song.artist}</span>
            </div>
            <span>▶</span>
        </button>
    `).join('');
}

function togglePlay() {
    const btn = document.getElementById('playBtn');
    const currentTimeEl = document.getElementById('currentTime');
    const progressFillEl = document.getElementById('progressFill');

    if (!audioPlayer) return;

    if (isPlaying) {
        audioPlayer.pause();
        if (btn) btn.textContent = '▶';
    } else {
        audioPlayer.play();
        if (btn) btn.textContent = '⏸';
    }
    isPlaying = !isPlaying;
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
    const currentTimeEl = document.getElementById('currentTime');
    const totalTimeEl = document.getElementById('totalTime');
    const progressFillEl = document.getElementById('progressFill');

    if (!audioPlayer) return;

    const pct = (audioPlayer.currentTime / (audioPlayer.duration || 1)) * 100;
    if (progressFillEl) progressFillEl.style.width = pct + '%';
    if (currentTimeEl) currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
    if (totalTimeEl && audioPlayer.duration) {
        totalTimeEl.textContent = formatTime(audioPlayer.duration);
    }
}

// ========== BARRA DE PROGRESO - CLICK PARA SALTAR ==========
function setupProgressClick() {
    const progressTrack = document.querySelector('.progress-track');
    if (!progressTrack || !audioPlayer) return;

    progressTrack.addEventListener('click', function(e) {
        if (!audioPlayer.duration) return;

        const rect = progressTrack.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        const newTime = percentage * audioPlayer.duration;

        audioPlayer.currentTime = newTime;
        updateProgress();
    });
}

// ========== GALLERÍA (PINTEREST STYLE) ==========
let currentFolder = null;

function renderGallery() {
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;

    grid.innerHTML = `
        <div class="pinterest-grid">
            ${Object.entries(window.galleryFoldersData).map(([name, images]) => `
                <div class="pinterest-item" onclick="showFolderContents('${name}')">
                    <img src="${images[0]}" alt="${name}" loading="lazy">
                    <div class="overlay"><span>📁 ${name} · ${images.length} fotos</span></div>
                </div>
            `).join('')}
        </div>
    `;
}

function showFolderContents(folderName) {
    currentFolder = folderName;
    const images = window.galleryFoldersData[folderName];
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;

    grid.innerHTML = `
        <button class="back-btn" onclick="renderGallery()" style="margin-bottom:16px;">
            ← Volver a carpetas
        </button>
        <div class="pinterest-grid">
            ${images.map((src, i) => `
                <div class="pinterest-item" onclick="openLightbox('${src}', '${folderName} - ${i+1}')">
                    <img src="${src}" alt="${folderName} ${i+1}" loading="lazy">
                    <div class="overlay"><span>Ver ${i + 1}</span></div>
                </div>
            `).join('')}
        </div>
    `;
}

// ========== MEMES (INSTAGRAM STYLE) ==========
function renderMemes() {
    // Render navegación de carpetas
    const nav = document.getElementById('memesFoldersNav');
    if (nav) {
        nav.innerHTML = Object.keys(window.memeImagesData).map(folder => `
            <button class="memes-folder-btn ${folder === currentMemeFolder ? 'active' : ''}" onclick="showMemeFolder('${folder}')">
                📁 ${folder}
                <span class="folder-count">${window.memeImagesData[folder].length}</span>
            </button>
        `).join('');
    }

    // Render grid de la carpeta actual
    const grid = document.getElementById('memesGrid');
    if (!grid) return;

    const images = window.memeImagesData[currentMemeFolder];
    grid.innerHTML = `
        <div class="insta-grid">
            ${images.map((src, i) => `
                <div class="insta-item" onclick="openLightbox('${src}', '${currentMemeFolder} - ${i + 1}')">
                    <img src="${src}" alt="Meme ${i + 1}" loading="lazy">
                    <div class="insta-overlay"><span>♥</span></div>
                </div>
            `).join('')}
        </div>
    `;
}

function showMemeFolder(folder) {
    currentMemeFolder = folder;
    renderMemes();
}

// ========== GUSTOS ==========
function renderGustos() {
    const panel = document.getElementById('gustosPanel');
    if (!panel) return;

    panel.innerHTML = Object.entries(window.gustosData).map(([cat, items]) => `
        <div style="margin-bottom: 16px;">
            <h4 style="text-transform:capitalize;margin-bottom:8px;">${cat}</h4>
            <ul style="padding-left:20px;color:var(--text-secondary);">
                ${items.map(i => `<li>${i}</li>`).join('')}
            </ul>
        </div>
    `).join('');
}

// ========== DATOS DE GATOS ==========
function renderCatFacts() {
    const list = document.getElementById('catFacts');
    if (!list) return;

    list.innerHTML = window.catFactsData.map(f => `
        <li style="margin-bottom:8px;">🐱 ${f}</li>
    `).join('');
}

// ========== SAN PETERSBURGO ==========
function renderSPB() {
    const panel = document.getElementById('spbPanel');
    if (!panel) return;

    const spb = window.spbData;

    panel.innerHTML = `
        <div style="margin-bottom:16px;">
            <h4 style="margin-bottom:12px;">🍽️ Comida</h4>
            <div class="planner-grid">
                ${spb.foods.map(food => `
                    <div class="planner-step">
                        <img src="${food[1]}" alt="${food[0]}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;margin-bottom:8px;">
                        <strong>${food[0]}</strong>
                    </div>
                `).join('')}
            </div>
        </div>
        <div style="margin-bottom:16px;">
            <h4 style="margin-bottom:12px;">📍 Lugares</h4>
            <div class="pinterest-grid">
                ${spb.places.map(src => `
                    <div class="pinterest-item" onclick="openLightbox('${src}', 'San Petersburgo')">
                        <img src="${src}" alt="San Petersburgo" loading="lazy">
                        <div class="overlay"><span>Ver</span></div>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="planner-grid" style="margin-top:16px;">
            <div class="planner-step">
                <h4>✨ Tradiciones</h4>
                <ul style="padding-left:20px;color:var(--text-secondary);margin-top:8px;">
                    ${spb.traditions.map(t => `<li>${t}</li>`).join('')}
                </ul>
            </div>
            <div class="planner-step">
                <h4>💬 Frases en ruso</h4>
                <ul style="padding-left:20px;color:var(--text-secondary);margin-top:8px;">
                    ${spb.phrases.map(p => `<li>${p}</li>`).join('')}
                </ul>
            </div>
        </div>
    `;
}

// ========== PLANNER (GIFTS) ==========
function loadGifts() {
    const list = document.getElementById('giftList');
    if (!list) return;

    const gifts = JSON.parse(localStorage.getItem('gifts') || '[]');
    list.innerHTML = gifts.map((g, i) => `
        <li class="planner-item">
            <input type="checkbox" ${g.done ? 'checked' : ''} onchange="toggleGift(${i})">
            <span style="flex:1; text-decoration: ${g.done ? 'line-through' : 'none'}; opacity: ${g.done ? 0.5 : 1}">
                ${g.text}
            </span>
            <button onclick="deleteGift(${i})" style="opacity:0.5">✕</button>
        </li>
    `).join('');
}

function addGift() {
    const input = document.getElementById('giftInput');
    if (!input || !input.value.trim()) return;

    const gifts = JSON.parse(localStorage.getItem('gifts') || '[]');
    gifts.push({ text: input.value, done: false });
    localStorage.setItem('gifts', JSON.stringify(gifts));
    input.value = '';
    loadGifts();
}

function toggleGift(index) {
    const gifts = JSON.parse(localStorage.getItem('gifts') || '[]');
    gifts[index].done = !gifts[index].done;
    localStorage.setItem('gifts', JSON.stringify(gifts));
    loadGifts();
}

function deleteGift(index) {
    const gifts = JSON.parse(localStorage.getItem('gifts') || '[]');
    gifts.splice(index, 1);
    localStorage.setItem('gifts', JSON.stringify(gifts));
    loadGifts();
}

// ========== LIGHTBOX ==========
function openLightbox(src, caption = '') {
    const content = document.getElementById('lightboxContent');
    const captionEl = document.getElementById('lightboxCaption');

    if (content) {
        content.innerHTML = `<img src="${src}" alt="${caption}">`;
    }
    if (captionEl) {
        captionEl.textContent = caption;
    }

    const box = document.getElementById('lightbox');
    if (box) {
        box.classList.add('open');
    }
}

function closeLightbox() {
    const box = document.getElementById('lightbox');
    if (box) {
        box.classList.remove('open');
    }
}

// ========== INICIALIZAR ==========
function init() {
    console.log('Inicializando Personal Hub...');

    // Obtener audio
    audioPlayer = document.getElementById('audioPlayer');

    // Configurar click en barra de progreso
    if (audioPlayer) {
        setupProgressClick();
    }

    // Deep linking - leer URL
    const path = window.location.pathname.slice(1);
    if (path && ['home', 'canciones', 'rincon', 'planner'].includes(path)) {
        navigateTo(path);
    }

    // Renderizar contenido
    const songsCountEl = document.getElementById('songsCount');
    if (songsCountEl && window.songsData) {
        songsCountEl.textContent = String(window.songsData.length).padStart(2, '0');
    }

    // Renderizar secciones
    if (document.getElementById('canciones')) {
        loadSong(0);
        setupProgressClick();
    }

    if (document.getElementById('galleryGrid')) {
        renderGallery();
    }

    if (document.getElementById('memesGrid')) {
        renderMemes();
    }

    if (document.getElementById('gustosPanel')) {
        renderGustos();
    }

    if (document.getElementById('catFacts')) {
        renderCatFacts();
    }

    if (document.getElementById('spbPanel')) {
        renderSPB();
    }

    if (document.getElementById('giftList')) {
        loadGifts();
    }

    console.log('Personal Hub inicializado correctamente');
}

// ========== EVENT LISTENERS ==========
document.addEventListener('DOMContentLoaded', function() {
    init();
});

// Event listener para navegación (solo en modo SPA)
if (isSPA) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const page = this.dataset.page;
            if (page) navigateTo(page);
        });
    });
}

// Event listeners de sub-navigation
document.querySelectorAll('.sub-tab[data-subview]').forEach(tab => {
    tab.addEventListener('click', function() {
        const viewId = this.dataset.subview;
        if (viewId) showSubview(viewId);
    });
});

// Player controls
document.getElementById('playBtn')?.addEventListener('click', togglePlay);
document.getElementById('prevBtn')?.addEventListener('click', prevSong);
document.getElementById('nextBtn')?.addEventListener('click', nextSong);

// Songs list click
document.getElementById('songsList')?.addEventListener('click', function(e) {
    const row = e.target.closest('.song-row');
    if (row) {
        loadSong(Number(row.dataset.index));
        if (audioPlayer) {
            audioPlayer.play();
            isPlaying = true;
            document.getElementById('playBtn').textContent = '⏸';
        }
    }
});

// Audio events & real-time progress
if (audioPlayer) {
    audioPlayer.addEventListener('loadedmetadata', function() {
        const totalTimeEl = document.getElementById('totalTime');
        if (totalTimeEl) {
            totalTimeEl.textContent = formatTime(audioPlayer.duration);
        }
    });
    audioPlayer.addEventListener('ended', nextSong);
}

function startProgressLoop() {
    if (audioPlayer && isPlaying && !audioPlayer.paused) {
        updateProgress();
    }
    requestAnimationFrame(startProgressLoop);
}
if (audioPlayer) startProgressLoop();

// Gift input
document.getElementById('giftInput')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') addGift();
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeLightbox();
    }
});

// Lightbox close on background click
document.getElementById('lightbox')?.addEventListener('click', function(e) {
    if (e.target.id === 'lightbox') closeLightbox();
});

// Browser back/forward
window.addEventListener('popstate', function(e) {
    const page = e.state?.page || 'home';
    navigateTo(page);
});