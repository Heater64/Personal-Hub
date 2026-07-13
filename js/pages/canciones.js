// canciones.js · reproductor con doble lista de canciones + modo aleatorio
let currentSong = 0;
let isPlaying = false;
let audioPlayer = null;
let lyricsVisible = true;
let currentLyricsHTML = '';
let shuffleMode = false;

// Lista activa: apunta a window.songsData o window.allSongsData
let activeSongList = [];

// Historial de canciones reproducidas para evitar repeticiones en modo aleatorio
let shuffleHistory = [];

function formatTime(seconds) {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

function loadSong(index) {
    currentSong = index;
    const song = activeSongList[index];
    if (!song) return;

    const coverEl = document.getElementById('currentCover');
    const titleEl = document.getElementById('currentTitle');
    const subtitleEl = document.getElementById('currentSubtitle');
    if (coverEl) coverEl.src = song.cover;
    if (titleEl) titleEl.textContent = song.title;
    if (subtitleEl) subtitleEl.textContent = `${song.artist} · ${song.album}`;
    if (audioPlayer) audioPlayer.src = song.audio;
    renderLyrics(song.lyrics);
    renderSongsList();
    if (isPlaying && audioPlayer) audioPlayer.play().catch(() => {});
}

// 🎲 Obtener índice aleatorio evitando repetir las últimas N canciones
function getRandomIndex() {
    if (activeSongList.length <= 1) return 0;
    
    const avoidCount = Math.min(3, Math.floor(activeSongList.length / 2));
    const recentSongs = shuffleHistory.slice(-avoidCount);
    
    let availableIndices = [];
    for (let i = 0; i < activeSongList.length; i++) {
        if (!recentSongs.includes(i)) {
            availableIndices.push(i);
        }
    }
    
    // Si todos están en el historial reciente, permitir cualquiera
    if (availableIndices.length === 0) {
        availableIndices = activeSongList.map((_, i) => i);
    }
    
    const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    
    // Actualizar historial
    shuffleHistory.push(randomIndex);
    if (shuffleHistory.length > 10) shuffleHistory.shift();
    
    return randomIndex;
}

// 🎲 Canción aleatoria (botón de dados)
function playRandomSong() {
    if (!activeSongList.length) return;
    
    const randomIndex = getRandomIndex();
    loadSong(randomIndex);
    
    if (audioPlayer) {
        audioPlayer.play().catch(() => {});
        isPlaying = true;
        const playBtn = document.getElementById('playBtn');
        if (playBtn) playBtn.innerHTML = '<i data-lucide="pause"></i>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    // Pequeña animación
    const randomBtn = document.getElementById('randomBtn');
    if (randomBtn && typeof pulseElement === 'function') {
        pulseElement(randomBtn);
    }
    if (typeof launchParticles === 'function') {
        launchParticles({
            amount: 8,
            symbols: ['🎵', '🎲', '✨'],
            colors: ['#c65a3a', '#ffb347', '#ff8aa1'],
            spread: 100,
            source: randomBtn
        });
    }
}

// 🔀 Activar/desactivar modo aleatorio
function toggleShuffle() {
    shuffleMode = !shuffleMode;
    const shuffleBtn = document.getElementById('shuffleBtn');
    
    if (shuffleBtn) {
        if (shuffleMode) {
            shuffleBtn.style.color = 'var(--accent-coral)';
            shuffleBtn.style.borderColor = 'var(--accent-coral)';
            shuffleBtn.title = 'Modo aleatorio activado';
            showMessage('🔀 Modo aleatorio activado');
        } else {
            shuffleBtn.style.color = '';
            shuffleBtn.style.borderColor = '';
            shuffleBtn.title = 'Modo aleatorio';
            showMessage('🔀 Modo aleatorio desactivado');
        }
    }
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
    const button = document.getElementById('toggleLyricsBtn');
    if (!panel) return;

    lyricsVisible = !lyricsVisible;
    if (lyricsVisible) {
        panel.classList.remove('hidden-panel');
        if (currentLyricsHTML) panel.innerHTML = currentLyricsHTML;
        if (button) button.innerHTML = '<i data-lucide="eye"></i>';
    } else {
        panel.classList.add('hidden-panel');
        if (button) button.innerHTML = '<i data-lucide="eye-off"></i>';
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
    list.innerHTML = activeSongList.map((song, index) => `
        <button class="song-row ${index === currentSong ? 'active' : ''}" data-index="${index}">
            <img src="${song.cover}" alt="${song.title}" loading="lazy">
            <div class="song-info">
                <strong>${escapeHtml(song.title)}</strong>
                <span>${escapeHtml(song.artist)}</span>
            </div>
            <i data-lucide="${index === currentSong && isPlaying ? 'volume-2' : 'play'}"></i>
        </button>
    `).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    // Hacer scroll hasta la canción activa
    const activeRow = list.querySelector('.song-row.active');
    if (activeRow) {
        activeRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function togglePlay() {
    if (!audioPlayer) return;
    const button = document.getElementById('playBtn');
    if (isPlaying) {
        audioPlayer.pause();
        if (button) button.innerHTML = '<i data-lucide="play"></i>';
    } else {
        audioPlayer.play().catch(() => {});
        if (button) button.innerHTML = '<i data-lucide="pause"></i>';
    }
    isPlaying = !isPlaying;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    renderSongsList();
}

function prevSong() {
    if (shuffleMode && activeSongList.length > 1) {
        playRandomSong();
        return;
    }
    loadSong((currentSong - 1 + activeSongList.length) % activeSongList.length);
    if (isPlaying && audioPlayer) audioPlayer.play().catch(() => {});
}

function nextSong() {
    if (shuffleMode && activeSongList.length > 1) {
        const randomIndex = getRandomIndex();
        loadSong(randomIndex);
    } else {
        loadSong((currentSong + 1) % activeSongList.length);
    }
    if (isPlaying && audioPlayer) audioPlayer.play().catch(() => {});
}

function updateProgress() {
    if (!audioPlayer) return;
    const pct = (audioPlayer.currentTime / (audioPlayer.duration || 1)) * 100;
    const fill = document.getElementById('progressFill');
    const currentSpan = document.getElementById('currentTime');
    const totalSpan = document.getElementById('totalTime');
    if (fill) fill.style.width = pct + '%';
    if (currentSpan) currentSpan.textContent = formatTime(audioPlayer.currentTime);
    if (totalSpan && audioPlayer.duration) totalSpan.textContent = formatTime(audioPlayer.duration);
}

function setupProgressClick() {
    const track = document.querySelector('.progress-track');
    if (!track || !audioPlayer) return;
    track.addEventListener('click', function (event) {
        if (!audioPlayer.duration) return;
        const rect = track.getBoundingClientRect();
        const percent = (event.clientX - rect.left) / rect.width;
        audioPlayer.currentTime = percent * audioPlayer.duration;
        updateProgress();
    });
}

// Cambiar entre listas
function switchSongList(listType) {
    if (audioPlayer) {
        audioPlayer.pause();
        isPlaying = false;
        const playBtn = document.getElementById('playBtn');
        if (playBtn) playBtn.innerHTML = '<i data-lucide="play"></i>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    activeSongList = (listType === 'todas') ? window.allSongsData : window.songsData;
    currentSong = 0;
    shuffleHistory = [];
    loadSong(0);
    renderSongsList();
    document.querySelectorAll('.sub-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === listType);
    });
}

async function loadSongsFromFirestore() {
    if (!window.db) return false;
    try {
        var snap = await window.db.collection('config_canciones_recuerdan').doc('data').get();
        if (snap.exists && snap.data().songs && snap.data().songs.length > 0) {
            window.songsData = snap.data().songs;
            return true;
        }
    } catch (e) {
        console.warn('No se pudieron cargar canciones de Firestore:', e);
    }
    return false;
}

async function initCanciones() {
    audioPlayer = document.getElementById('audioPlayer');

    await loadSongsFromFirestore();

    if (!audioPlayer || !window.songsData) return;

    activeSongList = window.songsData;
    setupProgressClick();
    loadSong(0);

    audioPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('loadedmetadata', updateProgress);
    audioPlayer.addEventListener('ended', nextSong);

    const playBtn = document.getElementById('playBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const shuffleBtn = document.getElementById('shuffleBtn');
    const randomBtn = document.getElementById('randomBtn');
    const songsList = document.getElementById('songsList');
    const toggleLyricsBtn = document.getElementById('toggleLyricsBtn');
    const expandLyricsBtn = document.getElementById('expandLyricsBtn');
    const lyricsLightbox = document.getElementById('lyricsLightbox');

    if (playBtn) playBtn.addEventListener('click', togglePlay);
    if (prevBtn) prevBtn.addEventListener('click', prevSong);
    if (nextBtn) nextBtn.addEventListener('click', nextSong);
    if (shuffleBtn) shuffleBtn.addEventListener('click', toggleShuffle);
    if (randomBtn) randomBtn.addEventListener('click', playRandomSong);
    if (toggleLyricsBtn) toggleLyricsBtn.addEventListener('click', toggleLyricsPanel);
    if (expandLyricsBtn) expandLyricsBtn.addEventListener('click', expandLyricsLightbox);

    if (songsList) {
        songsList.addEventListener('click', function (event) {
            const row = event.target.closest('.song-row');
            if (!row) return;
            const index = Number(row.dataset.index);
            loadSong(index);
            shuffleHistory.push(index);
            if (shuffleHistory.length > 10) shuffleHistory.shift();
            if (audioPlayer) {
                audioPlayer.play().catch(() => {});
                isPlaying = true;
                if (playBtn) playBtn.innerHTML = '<i data-lucide="pause"></i>';
                if (typeof lucide !== 'undefined') lucide.createIcons();
                renderSongsList();
            }
        });
    }

    if (lyricsLightbox) {
        lyricsLightbox.addEventListener('click', function (event) {
            if (event.target === lyricsLightbox) closeLyricsLightbox();
        });
    }

    document.querySelectorAll('.sub-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const listType = tab.dataset.tab;
            switchSongList(listType);
        });
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') closeLyricsLightbox();
    });
}

document.addEventListener('DOMContentLoaded', initCanciones);

window.closeLyricsLightbox = closeLyricsLightbox;
window.toggleLyricsPanel = toggleLyricsPanel;
window.expandLyricsLightbox = expandLyricsLightbox;
window.playRandomSong = playRandomSong;
window.toggleShuffle = toggleShuffle;