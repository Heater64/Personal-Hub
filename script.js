// ==========================================
// SCRIPT - LógicaSPA para Personal Hub
// Versión con mejoras en sección de letras
// ==========================================



// ========== STATE ==========
let currentSong = 0;
let isPlaying = false;
let currentMemeFolder = "Favoritos ⭐";
let isSPA = true;
let lyricsVisible = true;      // Estado del panel de letras (visible/oculto)
let currentLyricsHTML = '';    // Almacena la letra actual para el lightbox

// ========== FUNCIONES AUXILIARES ==========
function navigateToPage(page) {
    window.location.href = page + '.html';
}

function formatTime(seconds) {
    if (!isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
}

// ========== NAVEGACIÓN ==========
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

// ========== REPRODUCTOR ==========
let audioPlayer = null;

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
    // Si la canción ya estaba sonando, continuar reproduciendo
    if (isPlaying && audioPlayer) audioPlayer.play();
}

// ========== MEJORAS EN LETRAS ==========
function renderLyrics(lyrics) {
    const panel = document.getElementById('lyricsPanel');
    if (!panel) return;
    
    // Guardar el HTML actual para el lightbox y posibles toggles
    currentLyricsHTML = lyrics;
    
    // Si el panel está oculto, solo guardamos el contenido pero no lo mostramos
    if (!lyricsVisible) return;
    
    // Aplicar efecto fade-out
    panel.classList.add('fade-out');
    
    setTimeout(() => {
        panel.innerHTML = lyrics;
        panel.classList.remove('fade-out');
        // Asegurarse de que el panel no tenga la clase hidden-panel
        if (lyricsVisible) {
            panel.classList.remove('hidden-panel');
        }
        // Actualizar iconos Lucide por si hay algún icono dentro de la letra (no suele haber, pero por si acaso)
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }, 200);
}

function toggleLyricsPanel() {
    const panel = document.getElementById('lyricsPanel');
    const btn = document.getElementById('toggleLyricsBtn');
    if (!panel) return;
    
    lyricsVisible = !lyricsVisible;
    
    if (lyricsVisible) {
        // Mostrar panel con el contenido actual
        panel.classList.remove('hidden-panel');
        if (currentLyricsHTML) {
            panel.innerHTML = currentLyricsHTML;
        }
        if (btn) btn.innerHTML = '<i data-lucide="eye"></i>';
    } else {
        // Ocultar panel
        panel.classList.add('hidden-panel');
        if (btn) btn.innerHTML = '<i data-lucide="eye-off"></i>';
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function expandLyricsLightbox() {
    const lightbox = document.getElementById('lyricsLightbox');
    const expandedDiv = document.getElementById('expandedLyricsText');
    if (!lightbox || !expandedDiv) return;
    
    // Usar la letra actual o un mensaje por defecto
    const lyricsToShow = currentLyricsHTML || '<em>No hay letra disponible para esta canción</em>';
    expandedDiv.innerHTML = lyricsToShow;
    lightbox.classList.add('open');
}

function closeLyricsLightbox() {
    const lightbox = document.getElementById('lyricsLightbox');
    if (lightbox) lightbox.classList.remove('open');
}

// ========== LISTA DE CANCIONES ==========
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

// Función auxiliar para evitar XSS
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ========== CONTROL DEL REPRODUCTOR ==========
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

// ========== GALERÍA ==========
let currentFolder = null;

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
                <div class="pinterest-item" onclick="openLightbox('${escapeHtml(src)}', '${escapeHtml(folderName)} - ${i+1}')">
                    <img src="${escapeHtml(src)}" alt="${escapeHtml(folderName)} ${i+1}" loading="lazy">
                    <div class="overlay"><span><i data-lucide="eye"></i> Ver ${i+1}</span></div>
                </div>
            `).join('')}
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ========== MEMES ==========
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
    const images = window.memeImagesData[currentMemeFolder];
    grid.innerHTML = `
        <div class="insta-grid">
            ${images.map((src, i) => `
                <div class="insta-item" onclick="openLightbox('${escapeHtml(src)}', '${escapeHtml(currentMemeFolder)} - ${i + 1}')">
                    <img src="${escapeHtml(src)}" alt="Meme ${i + 1}" loading="lazy">
                    <div class="insta-overlay"><i data-lucide="heart"></i></div>
                </div>
            `).join('')}
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function showMemeFolder(folder) {
    currentMemeFolder = folder;
    renderMemes();
}
// ==========================================
// Sustituye SOLO las tres funciones siguientes en tu script.js
// (renderGustos, renderCatFacts, renderSPB)
// El resto del archivo permanece idéntico.
// ==========================================

// ========== GUSTOS — Podio + datos personales ==========
function renderGustos() {
    const panel = document.getElementById('gustosPanel');
    if (!panel) return;
    const d = window.gustosData;

    // --- Podio de series y películas ---
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

    // --- Datos personales y comida ---
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

// ========== GATOS — Tarjetas con icono, título y texto ==========
function renderCatFacts() {
    const list = document.getElementById('catFacts');
    if (!list) return;

    // Cambiamos el elemento de <ul> a <div> para el nuevo layout
    // Si en rincon.html el elemento sigue siendo <ul id="catFacts">, funciona igual
    list.style.listStyle = 'none';
    list.style.padding   = '0';

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

// ========== SAN PETERSBURGO — Intro + curiosidades + fotos + tradiciones ==========
function renderSPB() {
    const panel = document.getElementById('spbPanel');
    if (!panel) return;
    const spb = window.spbData;

    panel.innerHTML = `
        <!-- Intro -->
        <p style="font-size:0.9rem;line-height:1.8;color:var(--umbra-ash);margin-bottom:28px;border-left:2px solid var(--accent-coral);padding-left:16px;">
            ${escapeHtml(spb.intro)}
        </p>

        <!-- Curiosidades -->
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

        <!-- Comida -->
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

        <!-- Lugares -->
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

        <!-- Tradiciones y frases -->
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
// ========== PLANNER (REGLOS) ==========
function loadGifts() {
    const list = document.getElementById('giftList');
    if (!list) return;
    const gifts = JSON.parse(localStorage.getItem('gifts') || '[]');
    list.innerHTML = gifts.map((g, i) => `
        <li class="planner-item">
            <input type="checkbox" ${g.done ? 'checked' : ''} onchange="toggleGift(${i})">
            <span style="flex:1; text-decoration: ${g.done ? 'line-through' : 'none'}; opacity: ${g.done ? 0.5 : 1}">${escapeHtml(g.text)}</span>
            <button onclick="deleteGift(${i})"><i data-lucide="trash-2"></i></button>
        </li>
    `).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
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

// ========== LIGHTBOX GENERAL ==========
function openLightbox(src, caption = '') {
    const content = document.getElementById('lightboxContent');
    const captionEl = document.getElementById('lightboxCaption');
    if (content) content.innerHTML = `<img src="${escapeHtml(src)}" alt="${escapeHtml(caption)}">`;
    if (captionEl) captionEl.textContent = caption;
    const box = document.getElementById('lightbox');
    if (box) box.classList.add('open');
}

function closeLightbox() {
    const box = document.getElementById('lightbox');
    if (box) box.classList.remove('open');
}

// ========== INICIALIZACIÓN ==========
function init() {
    console.log('Inicializando Personal Hub...');
    audioPlayer = document.getElementById('audioPlayer');
    if (audioPlayer) setupProgressClick();

    // Cargar canciones si estamos en esa página
    if (document.getElementById('canciones') && window.songsData) {
        loadSong(0);
    }
    if (document.getElementById('galleryGrid')) renderGallery();
    if (document.getElementById('memesGrid')) renderMemes();
    if (document.getElementById('gustosPanel')) renderGustos();
    if (document.getElementById('catFacts')) renderCatFacts();
    if (document.getElementById('spbPanel')) renderSPB();
        if (document.getElementById('notesList')) {
        loadNotes();
        setupNotesEvents();
    }

    // Inicializar Lucide Icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// ========== EVENT LISTENERS ==========
document.addEventListener('DOMContentLoaded', function() {
    init();

    // Reproductor eventos
    if (audioPlayer) {
        audioPlayer.addEventListener('timeupdate', updateProgress);
        audioPlayer.addEventListener('loadedmetadata', function() {
            updateProgress();
        });
        audioPlayer.addEventListener('ended', nextSong);
    }

    // Sub-navegación (TuRincónFav)
    document.querySelectorAll('.sub-tab[data-subview]').forEach(tab => {
        tab.addEventListener('click', function() {
            showSubview(this.dataset.subview);
        });
    });

    // Controles del reproductor
    const playBtn = document.getElementById('playBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    if (playBtn) playBtn.addEventListener('click', togglePlay);
    if (prevBtn) prevBtn.addEventListener('click', prevSong);
    if (nextBtn) nextBtn.addEventListener('click', nextSong);

    // Click en lista de canciones
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

    // Botones de letras (toggle y expandir)
    const toggleLyricsBtn = document.getElementById('toggleLyricsBtn');
    const expandLyricsBtn = document.getElementById('expandLyricsBtn');
    if (toggleLyricsBtn) toggleLyricsBtn.addEventListener('click', toggleLyricsPanel);
    if (expandLyricsBtn) expandLyricsBtn.addEventListener('click', expandLyricsLightbox);

    // Cerrar lightbox de letras con Escape y clic fuera
    document.addEventListener('keydown', function(e) {
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

    // Gift input Enter
    const giftInput = document.getElementById('giftInput');
    if (giftInput) giftInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') addGift();
    });

    // Cerrar lightbox de imágenes con clic fuera
    const lightbox = document.getElementById('lightbox');
    if (lightbox) lightbox.addEventListener('click', function(e) {
        if (e.target.id === 'lightbox') closeLightbox();
    });
});

// ========== NUEVA LÓGICA DE NOTAS (reemplaza a los regalos) ==========
let currentEditNoteIndex = null; // para saber qué nota estamos editando en el lightbox

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
    // Inicializar Lucide en los nuevos iconos
    if (typeof lucide !== 'undefined') lucide.createIcons();
    // Agregar event listeners a los botones dinámicos
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
    // Al hacer clic en toda la nota, expandir
    document.querySelectorAll('.note-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // si el clic no fue en un botón
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
    notes.unshift({  // añadir al principio para verlo arriba
        text: textarea.value.trim(),
        date: new Date().toISOString()
    });
    localStorage.setItem('notes', JSON.stringify(notes));
    textarea.value = '';
    loadNotes();
}

function deleteNote(index) {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    notes.splice(index, 1);
    localStorage.setItem('notes', JSON.stringify(notes));
    loadNotes();
    // Si el lightbox está abierto y se borró la nota, cerrarlo
    closeNoteLightbox();
}

function editNote(index) {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    const note = notes[index];
    if (!note) return;
    // Abrir lightbox con el texto para editar
    currentEditNoteIndex = index;
    const textarea = document.getElementById('expandedNoteText');
    if (textarea) textarea.value = note.text;
    const lightbox = document.getElementById('noteLightbox');
    if (lightbox) lightbox.classList.add('open');
}

function expandNote(index) {
    // Similar a editNote pero solo lectura? Podemos permitir edición igual.
    editNote(index); // reutilizamos la misma función, ya que editar es lo natural.
}

function saveNoteEdit() {
    if (currentEditNoteIndex === null) return;
    const textarea = document.getElementById('expandedNoteText');
    if (!textarea) return;
    const newText = textarea.value.trim();
    if (!newText) {
        // Si está vacío, podríamos eliminar o no guardar. Por ahora no guardamos vacío.
        return;
    }
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    if (notes[currentEditNoteIndex]) {
        notes[currentEditNoteIndex].text = newText;
        notes[currentEditNoteIndex].date = new Date().toISOString();
        localStorage.setItem('notes', JSON.stringify(notes));
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

// ========== CONFIGURACIÓN DE EVENTOS ==========
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
    // Cerrar lightbox con Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeNoteLightbox();
    });
    const lightbox = document.getElementById('noteLightbox');
    if (lightbox) lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeNoteLightbox();
    });
}



// Exponer funciones globales necesarias para onclick en HTML
window.showFolderContents = showFolderContents;
window.showMemeFolder = showMemeFolder;
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.addGift = addGift;
window.toggleGift = toggleGift;
window.deleteGift = deleteGift;
window.closeLyricsLightbox = closeLyricsLightbox;
window.toggleLyricsPanel = toggleLyricsPanel; // por si se necesita desde el HTML
window.expandLyricsLightbox = expandLyricsLightbox;