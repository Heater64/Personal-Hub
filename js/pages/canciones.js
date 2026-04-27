// ==========================================
// canciones.js · reproductor y letras
// ==========================================
let currentSong = 0;
let isPlaying = false;
let audioPlayer = null;
let lyricsVisible = true;
let currentLyricsHTML = '';

function formatTime(seconds) {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

function loadSong(index) {
    currentSong = index;
    const song = window.songsData[index];
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
    expandedDiv.innerHTML = currentLyricsHTML || '<em>No hay letra disponible para esta cancion</em>';
    lightbox.classList.add('open');
}

function closeLyricsLightbox() {
    const lightbox = document.getElementById('lyricsLightbox');
    if (lightbox) lightbox.classList.remove('open');
}

function renderSongsList() {
    const list = document.getElementById('songsList');
    if (!list) return;
    list.innerHTML = window.songsData.map((song, index) => `
        <button class="song-row ${index === currentSong ? 'active' : ''}" data-index="${index}">
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
}

function prevSong() {
    loadSong((currentSong - 1 + window.songsData.length) % window.songsData.length);
    if (isPlaying && audioPlayer) audioPlayer.play().catch(() => {});
}

function nextSong() {
    loadSong((currentSong + 1) % window.songsData.length);
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

function initCanciones() {
    audioPlayer = document.getElementById('audioPlayer');
    if (!audioPlayer || !window.songsData) return;

    setupProgressClick();
    loadSong(0);

    audioPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('loadedmetadata', updateProgress);
    audioPlayer.addEventListener('ended', nextSong);

    const playBtn = document.getElementById('playBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const songsList = document.getElementById('songsList');
    const toggleLyricsBtn = document.getElementById('toggleLyricsBtn');
    const expandLyricsBtn = document.getElementById('expandLyricsBtn');
    const lyricsLightbox = document.getElementById('lyricsLightbox');

    if (playBtn) playBtn.addEventListener('click', togglePlay);
    if (prevBtn) prevBtn.addEventListener('click', prevSong);
    if (nextBtn) nextBtn.addEventListener('click', nextSong);
    if (toggleLyricsBtn) toggleLyricsBtn.addEventListener('click', toggleLyricsPanel);
    if (expandLyricsBtn) expandLyricsBtn.addEventListener('click', expandLyricsLightbox);

    if (songsList) {
        songsList.addEventListener('click', function (event) {
            const row = event.target.closest('.song-row');
            if (!row) return;
            loadSong(Number(row.dataset.index));
            if (audioPlayer) {
                audioPlayer.play().catch(() => {});
                isPlaying = true;
                if (playBtn) playBtn.innerHTML = '<i data-lucide="pause"></i>';
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        });
    }

    if (lyricsLightbox) {
        lyricsLightbox.addEventListener('click', function (event) {
            if (event.target === lyricsLightbox) {
                closeLyricsLightbox();
            }
        });
    }

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            closeLyricsLightbox();
        }
    });
}

document.addEventListener('DOMContentLoaded', initCanciones);

window.closeLyricsLightbox = closeLyricsLightbox;
window.toggleLyricsPanel = toggleLyricsPanel;
window.expandLyricsLightbox = expandLyricsLightbox;
