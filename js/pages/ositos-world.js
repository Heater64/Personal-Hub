// js/pages/ositos-world.js
// Galería de personajes Ositos World - Estilo Brawl Stars

import { OSITOS_CHARACTERS } from '../data/ositos-characters.js';

// ==========================================
// ESTADO
// ==========================================

const state = {
    characters: OSITOS_CHARACTERS,
    currentFilter: 'todos',
    currentPage: 1,
    pageSize: 8,
    viewMode: 'grid',
    sortBy: 'name',
    favorites: [],
    selectedCharacter: null,
    currentPageContent: 'personajes'
};

// ==========================================
// PERSISTENCIA (localStorage)
// ==========================================

const STORAGE_KEY = 'ositosWorld.favorites';

function loadFavorites() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            state.favorites = JSON.parse(saved);
            state.characters.forEach(char => {
                char.favorite = state.favorites.includes(char.id);
            });
        }
    } catch (e) {
        console.warn('Error loading favorites:', e);
    }
}

function saveFavorites() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.favorites));
    } catch (e) {
        console.warn('Error saving favorites:', e);
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '"') return '&quot;';
        return m;
    });
}

// ==========================================
// NAVEGACIÓN
// ==========================================

function setupNavigation() {
    const navLinks = document.querySelectorAll('.ositos-nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const page = this.dataset.page;
            
            if (page === 'home') {
                window.location.href = '../index.html';
                return;
            }
            
            if (this.classList.contains('active')) return;
            
            e.preventDefault();
            switchPage(page);
        });
    });
}

function switchPage(page) {
    state.currentPageContent = page;
    
    document.querySelectorAll('.ositos-page-content').forEach(el => {
        el.classList.remove('active');
    });
    
    const target = document.getElementById(`page-${page}`);
    if (target) {
        target.classList.add('active');
    }
    
    document.querySelectorAll('.ositos-nav-link').forEach(l => {
        l.classList.remove('active');
        if (l.dataset.page === page) {
            l.classList.add('active');
        }
    });
    
    if (page === 'personajes') {
        renderGrid();
    } else if (page === 'historia') {
        renderHistoriaPage(historiaCurrentPage);
    } else if (page === 'noticias') {
        renderNoticiasPage(noticiasCurrentPage);
    }
    // EXTRAS no necesita renderizado adicional (ya está en HTML)
    
    document.querySelector('.ositos-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ==========================================
// SISTEMA DE TOAST
// ==========================================

function showOsitosMessage(text) {
    if (typeof showToast === 'function') {
        showToast(text);
        return;
    }
    
    const existing = document.querySelector('.ositos-temp-message');
    if (existing) existing.remove();
    
    const msg = document.createElement('div');
    msg.className = 'ositos-temp-message';
    msg.textContent = text;
    msg.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: #1A2745;
        color: white;
        padding: 12px 28px;
        border-radius: 40px;
        font-family: 'Nunito', sans-serif;
        font-weight: 700;
        font-size: 14px;
        z-index: 9999;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        border: 1px solid rgba(255,255,255,0.1);
        animation: ositosToastIn 0.3s ease;
    `;
    
    if (!document.getElementById('ositos-toast-style')) {
        const style = document.createElement('style');
        style.id = 'ositos-toast-style';
        style.textContent = `
            @keyframes ositosToastIn {
                from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
            @keyframes ositosToastOut {
                from { opacity: 1; transform: translateX(-50%) translateY(0); }
                to { opacity: 0; transform: translateX(-50%) translateY(20px); }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(msg);
    
    setTimeout(() => {
        msg.style.animation = 'ositosToastOut 0.3s ease forwards';
        setTimeout(() => msg.remove(), 300);
    }, 2000);
}

window.showOsitosMessage = showOsitosMessage;

// ==========================================
// FILTROS Y ORDENAMIENTO (personajes)
// ==========================================

function getFilteredCharacters() {
    let filtered = [...state.characters];

    if (state.currentFilter !== 'todos') {
        filtered = filtered.filter(c => c.role === state.currentFilter);
    }

    switch (state.sortBy) {
        case 'name':
            filtered.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'favorite':
            filtered.sort((a, b) => {
                if (a.favorite && !b.favorite) return -1;
                if (!a.favorite && b.favorite) return 1;
                return a.name.localeCompare(b.name);
            });
            break;
        default:
            break;
    }

    return filtered;
}

function getPaginatedCharacters(filtered) {
    const start = (state.currentPage - 1) * state.pageSize;
    const end = start + state.pageSize;
    return filtered.slice(start, end);
}

function getTotalPagesForCharacters(filtered) {
    return Math.ceil(filtered.length / state.pageSize);
}

// ==========================================
// CONTADORES
// ==========================================

function updateCounters() {
    const total = state.characters.length;
    const heroes = state.characters.filter(c => c.role === 'heroe').length;
    const villanos = state.characters.filter(c => c.role === 'villano').length;
    const aliados = state.characters.filter(c => c.role === 'aliado').length;

    document.getElementById('countTodos').textContent = total;
    document.getElementById('countHeroes').textContent = heroes;
    document.getElementById('countVillanos').textContent = villanos;
    document.getElementById('countAliados').textContent = aliados;
}

// ==========================================
// RENDERIZADO DEL GRID DE PERSONAJES
// ==========================================

function renderGrid() {
    const grid = document.getElementById('ositosGrid');
    if (!grid) return;
    
    const filtered = getFilteredCharacters();
    const totalPages = getTotalPagesForCharacters(filtered);
    const paginated = getPaginatedCharacters(filtered);

    if (state.currentPage > totalPages) {
        state.currentPage = Math.max(1, totalPages);
    }

    if (paginated.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: #5C6475;">
                <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
                <h3 style="font-size: 20px; font-weight: 800; color: #1E284B; margin: 0 0 8px;">No hay personajes</h3>
                <p style="font-size: 14px;">Pronto llegará más gente a este mundo.</p>
            </div>
        `;
        renderPagination(totalPages);
        return;
    }

    grid.innerHTML = paginated.map(char => `
        <div class="ositos-card ${char.favorite ? 'selected' : ''}" data-id="${char.id}">
            <button class="ositos-card-fav ${char.favorite ? 'active' : ''}" data-id="${char.id}" title="Favorito">
                ${char.favorite ? '❤️' : '🤍'}
            </button>
            <div class="ositos-card-image" style="background: ${char.bgColor || '#F8FAFC'}">
                ${char.image ? 
                    `<img src="${char.image}" alt="${char.name}" loading="lazy">` :
                    `<span class="ositos-card-emoji">${char.icon || '🧸'}</span>`
                }
            </div>
            <div class="ositos-card-name">${char.name.toUpperCase()}</div>
            <span class="ositos-card-role ${char.role}">${char.role.toUpperCase()}</span>
            <p class="ositos-card-desc">${char.description}</p>
        </div>
    `).join('');

    grid.querySelectorAll('.ositos-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.ositos-card-fav')) return;
            const id = card.dataset.id;
            const character = state.characters.find(c => c.id === id);
            if (character) openModal(character);
        });
    });

    grid.querySelectorAll('.ositos-card-fav').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(btn.dataset.id);
        });
    });

    renderPagination(totalPages);
}

// ==========================================
// PAGINACIÓN - PERSONAJES
// ==========================================

function renderPagination(totalPages) {
    const container = document.getElementById('ositosPagination');
    if (!container) return;
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '';
    html += `<button class="ositos-page-btn arrow ${state.currentPage === 1 ? 'disabled' : ''}" data-page="prev">‹</button>`;

    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="ositos-page-btn ${i === state.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    html += `<button class="ositos-page-btn arrow ${state.currentPage === totalPages ? 'disabled' : ''}" data-page="next">›</button>`;

    container.innerHTML = html;

    container.querySelectorAll('.ositos-page-btn:not(.disabled)').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            if (page === 'prev') {
                if (state.currentPage > 1) state.currentPage--;
            } else if (page === 'next') {
                if (state.currentPage < totalPages) state.currentPage++;
            } else {
                state.currentPage = parseInt(page);
            }
            renderGrid();
            document.querySelector('.ositos-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

// ==========================================
// FAVORITOS
// ==========================================

function toggleFavorite(id) {
    const index = state.favorites.indexOf(id);
    if (index > -1) {
        state.favorites.splice(index, 1);
    } else {
        state.favorites.push(id);
        if (typeof launchParticles === 'function') {
            launchParticles({
                amount: 12,
                symbols: ['❤️', '✨', '⭐'],
                colors: ['#FF6B6B', '#FFD44A', '#4169FF'],
                spread: 80
            });
        }
    }
    state.characters.forEach(char => {
        char.favorite = state.favorites.includes(char.id);
    });
    saveFavorites();
    renderGrid();
}

// ==========================================
// MODAL DE DETALLE
// ==========================================

function openModal(character) {
    const modal = document.getElementById('ositosModal');
    const body = document.getElementById('ositosModalBody');

    body.innerHTML = `
        <div class="ositos-modal-emoji" style="background: ${character.bgColor || '#F8FAFC'}">
            ${character.icon || '🧸'}
        </div>
        <h2 class="ositos-modal-name">${character.name.toUpperCase()}</h2>
        <span class="ositos-modal-role ${character.role}">${character.role.toUpperCase()}</span>
        <p class="ositos-modal-desc">${character.description}</p>
        
        <div class="ositos-modal-divider"></div>
        
        <h4 style="font-family: 'Fredoka', 'Baloo 2', sans-serif; font-size: 18px; color: #1E284B; margin: 8px 0 4px;">📖 Historia</h4>
        <p class="ositos-modal-story">${character.story || 'Este personaje aún no tiene una historia registrada.'}</p>
        
        <div class="ositos-modal-divider"></div>
        
        <h4 style="font-family: 'Fredoka', 'Baloo 2', sans-serif; font-size: 18px; color: #1E284B; margin: 8px 0 4px;">🧠 Personalidad</h4>
        <div class="ositos-modal-personality">
            ${(character.personality || ['Por descubrir']).map(trait => 
                `<span class="ositos-modal-trait">${trait}</span>`
            ).join('')}
        </div>
        
        <div class="ositos-modal-divider"></div>
        
        <div class="ositos-modal-skill">
            ⚡ ${character.specialSkill || 'Habilidad especial no definida'}
        </div>
        
        <button class="ositos-fav-btn" style="max-width: 200px; margin-top: 12px;" data-id="${character.id}">
            ${character.favorite ? '❤️ Quitar de favoritos' : '🤍 Añadir a favoritos'}
        </button>
    `;

    modal.classList.add('open');

    body.querySelector('.ositos-fav-btn')?.addEventListener('click', (e) => {
        toggleFavorite(character.id);
        const btn = e.target;
        const isFav = state.favorites.includes(character.id);
        btn.innerHTML = isFav ? '❤️ Quitar de favoritos' : '🤍 Añadir a favoritos';
        renderGrid();
    });
}

function closeModal() {
    document.getElementById('ositosModal').classList.remove('open');
}

// ==========================================
// FILTROS
// ==========================================

function setupFilters() {
    const filterBtns = document.querySelectorAll('.ositos-filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentFilter = btn.dataset.filter;
            state.currentPage = 1;
            
            if (state.currentPageContent !== 'personajes') {
                switchPage('personajes');
            }
            renderGrid();
        });
    });

    document.getElementById('sortSelect')?.addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        state.currentPage = 1;
        renderGrid();
    });

    document.querySelectorAll('.ositos-view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ositos-view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.viewMode = btn.dataset.view;
            if (state.viewMode === 'list') {
                document.querySelector('.ositos-grid').style.gridTemplateColumns = '1fr';
            } else {
                document.querySelector('.ositos-grid').style.gridTemplateColumns = '';
            }
        });
    });

    document.getElementById('showFavoritesBtn')?.addEventListener('click', () => {
        state.currentFilter = 'todos';
        state.sortBy = 'favorite';
        document.getElementById('sortSelect').value = 'favorite';
        document.querySelectorAll('.ositos-filter-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.ositos-filter-btn[data-filter="todos"]')?.classList.add('active');
        state.currentPage = 1;
        
        if (state.currentPageContent !== 'personajes') {
            switchPage('personajes');
        }
        renderGrid();
        document.querySelector('.ositos-grid')?.scrollIntoView({ behavior: 'smooth' });
    });
}

// ==========================================
// EXTRAS - NAVEGACIÓN POR PESTAÑAS
// ==========================================

function setupExtrasMenu() {
    const menuBtns = document.querySelectorAll('.ositos-extras-menu-btn');
    const sections = document.querySelectorAll('.ositos-extra-section');
    
    menuBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            menuBtns.forEach(b => b.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            btn.classList.add('active');
            const target = document.getElementById(`extra-${btn.dataset.extra}`);
            if (target) target.classList.add('active');
            
            document.querySelector('.ositos-extras-content')?.scrollIntoView({ behavior: 'smooth' });
        });
    });
}

// ==========================================
// EXTRAS - CURIOSIDADES ALEATORIAS
// ==========================================

const OSITOS_FACTS = [
    "Que te amo",
];

let currentFactIndex = 0;
let factInterval = null;

function updateRandomFact() {
    const factEl = document.getElementById('ositosFactText');
    if (!factEl) return;
    
    let newIndex;
    do {
        newIndex = Math.floor(Math.random() * OSITOS_FACTS.length);
    } while (newIndex === currentFactIndex && OSITOS_FACTS.length > 1);
    
    currentFactIndex = newIndex;
    factEl.style.transition = 'opacity 0.3s ease';
    factEl.style.opacity = '0';
    setTimeout(() => {
        factEl.textContent = OSITOS_FACTS[currentFactIndex];
        factEl.style.opacity = '1';
    }, 300);
}

function startFactRotation() {
    updateRandomFact();
    if (factInterval) clearInterval(factInterval);
    factInterval = setInterval(updateRandomFact, 8000);
}

// ==========================================
// DATOS DE HISTORIA (Línea del tiempo)
// ==========================================

const HISTORIA_DATA = [
    { icon: '', title: '', desc: '' },
    { icon: '', title: '', desc: '' },
    { icon: '', title: '', desc: '' },
    { icon: '', title: '', desc: '' },
    { icon: '', title: '', desc: '' },
    { icon: '', title: '', desc: '' },
];

// ==========================================
// DATOS DE NOTICIAS (con imágenes)
// ==========================================

const NOTICIAS_DATA = [
    { 
        image: '',
        title: '',
        summary: '',
        date: '',
        tag: '',
        tagClass: ''
    },
    { 
        image: '',
        title: '',
        summary: '',
        date: '',
        tag: '',
        tagClass: ''
    },
    { 
        image: '',
        title: '',
        summary: '',
        date: '',
        tag: '',
        tagClass: ''
    },
    { 
        image: '',
        title: '',
        summary: '',
        date: '',
        tag: '',
        tagClass: ''
    },
    { 
        image: '',
        title: '',
        summary: '',
        date: '',
        tag: '',
        tagClass: ''
    },
    { 
        image: '',
        title: '',
        summary: '',
        date: '',
        tag: '',
        tagClass: ''
    },
];

// ==========================================
// DATOS DE JUEGOS
// ==========================================

const JUEGOS_DATA = [
    { image: '', title: '', desc: '' },
    { image: '', title: '', desc: '' },
    { image: '', title: '', desc: '' },
    { image: '', title: '', desc: '' }
];

// ==========================================
// DATOS DE DESCARGAS
// ==========================================

const DESCARGAS_DATA = [
    { icon: '', name: '', meta: '' },
    { icon: '', name: '', meta: '' },
    { icon: '', name: '', meta: '' },
    { icon: '', name: '', meta: '' },
    { icon: '', name: '', meta: '' }
];

// ==========================================
// DATOS DE COLECCIONABLES
// ==========================================

const COLECCIONABLES_DATA = [
    { emoji: '', title: '', desc: '' },
    { emoji: '', title: '', desc: '' },
    { emoji: '', title: '', desc: '' },
    { emoji: '', title: '', desc: '' }
];

// ==========================================
// DATOS DE FONDOS
// ==========================================

const FONDOS_DATA = [
    { emoji: '', name: '', bg: '' },
    { emoji: '', name: '', bg: '' },
    { emoji: '', name: '', bg: '' },
    { emoji: '', name: '', bg: '' }
];

// ==========================================
// DATOS DE CURIOSIDADES
// ==========================================

const CURIOSIDADES_DATA = [
    { icon: '', title: '', desc: '' },
    { icon: '', title: '', desc: '' },
    { icon: '', title: '', desc: '' },
    { icon: '', title: '', desc: '' }
];

// ==========================================
// FUNCIONES DE PAGINACIÓN PARA HISTORIA Y NOTICIAS
// ==========================================

let historiaCurrentPage = 1;
let noticiasCurrentPage = 1;
const ITEMS_PER_PAGE = 6;

function getPaginatedData(data, page) {
    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return data.slice(start, end);
}

function getTotalPagesForData(data) {
    return Math.ceil(data.length / ITEMS_PER_PAGE);
}

// ==========================================
// RENDER HISTORIA
// ==========================================

function renderHistoriaPage(pageNum) {
    const container = document.getElementById('historiaGrid');
    if (!container) return;
    
    const totalPages = getTotalPagesForData(HISTORIA_DATA);
    const pageData = getPaginatedData(HISTORIA_DATA, pageNum);
    
    if (pageNum > totalPages) {
        pageNum = Math.max(1, totalPages);
    }
    
    historiaCurrentPage = pageNum;
    
    // Definir límite de caracteres para mostrar el botón "leer más"
    const CHAR_LIMIT = 100;
    
    container.innerHTML = pageData.map((item, index) => {
        const desc = item.desc || '';
        const isLong = desc.length > CHAR_LIMIT;
        const shortDesc = isLong ? desc.substring(0, CHAR_LIMIT) + '...' : desc;
        
        return `
        <div class="ositos-timeline-item" data-index="${index}" data-fulltext="${escapeHtml(desc)}">
            <div class="ositos-timeline-dot"></div>
            <span class="icon-big">${item.icon}</span>
            <h4>${item.title}</h4>
            <div class="ositos-timeline-desc">
                <span class="ositos-timeline-desc-short">${escapeHtml(shortDesc)}</span>
                ${isLong ? `<button class="ositos-timeline-readmore" data-index="${index}">▼ Leer más</button>` : ''}
            </div>
        </div>
    `}).join('');
    
    // Eventos para los botones "Leer más"
    container.querySelectorAll('.ositos-timeline-readmore').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const item = this.closest('.ositos-timeline-item');
            const fullText = item.dataset.fulltext || '';
            const title = item.querySelector('h4')?.textContent || 'Historia';
            openTimelineModal(title, fullText);
        });
    });
    
    updatePagination('historia', totalPages, historiaCurrentPage);
}

// ==========================================
// MODAL PARA TEXTO COMPLETO DE HISTORIA
// ==========================================

function openTimelineModal(title, text) {
    // Buscar o crear el modal
    let modal = document.getElementById('ositosTimelineModal');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'ositosTimelineModal';
        modal.className = 'ositos-modal-timeline';
        modal.innerHTML = `
            <div class="ositos-modal-timeline-content">
                <button class="ositos-modal-timeline-close">✕</button>
                <h3 class="ositos-modal-timeline-title"></h3>
                <div class="ositos-modal-timeline-body"></div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Cerrar al hacer clic fuera
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeTimelineModal();
            }
        });
        
        // Cerrar con el botón
        modal.querySelector('.ositos-modal-timeline-close').addEventListener('click', closeTimelineModal);
        
        // Cerrar con Escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.classList.contains('open')) {
                closeTimelineModal();
            }
        });
    }
    
    // Llenar el modal
    modal.querySelector('.ositos-modal-timeline-title').textContent = title;
    modal.querySelector('.ositos-modal-timeline-body').textContent = text;
    
    modal.classList.add('open');
}

function closeTimelineModal() {
    const modal = document.getElementById('ositosTimelineModal');
    if (modal) {
        modal.classList.remove('open');
    }
}


// ==========================================
// RENDER NOTICIAS
// ==========================================

function renderNoticiasPage(pageNum) {
    const container = document.getElementById('noticiasGrid');
    if (!container) return;
    
    const totalPages = getTotalPagesForData(NOTICIAS_DATA);
    const pageData = getPaginatedData(NOTICIAS_DATA, pageNum);
    
    if (pageNum > totalPages) {
        pageNum = Math.max(1, totalPages);
    }
    
    noticiasCurrentPage = pageNum;
    
    container.innerHTML = pageData.map(item => `
        <article class="ositos-news-card">
            <div class="ositos-news-thumb">
                <img src="${item.image}" alt="${item.title}" loading="lazy">
            </div>
            <div class="ositos-news-body">
                <span class="ositos-news-tag ${item.tagClass}">${item.tag}</span>
                <h3 class="ositos-news-title">${item.title}</h3>
                <p class="ositos-news-summary">${item.summary}</p>
                <span class="ositos-news-date">${item.date}</span>
            </div>
        </article>
    `).join('');
    
    updatePagination('noticias', totalPages, noticiasCurrentPage);
}

// ==========================================
// RENDER EXTRAS (todo en HTML, solo se llenan los grids dinámicos)
// ==========================================

function renderExtras() {
    // Juegos
    const juegosContainer = document.getElementById('juegosGrid');
    if (juegosContainer) {
        juegosContainer.innerHTML = JUEGOS_DATA.map(game => `
            <div class="ositos-game-card">
                <div class="ositos-game-thumb">
                    <img src="${game.image}" alt="${game.title}" loading="lazy">
                </div>
                <div class="ositos-game-body">
                    <h4>${game.title}</h4>
                    <p>${game.desc}</p>
                    <button class="ositos-game-btn" onclick="showOsitosMessage('🎮 ¡Próximamente!')">JUGAR</button>
                </div>
            </div>
        `).join('');
    }

    // Descargas
    const descargasContainer = document.getElementById('descargasList');
    if (descargasContainer) {
        descargasContainer.innerHTML = DESCARGAS_DATA.map(item => `
            <div class="ositos-download-item">
                <div class="ositos-download-icon">${item.icon}</div>
                <div class="ositos-download-info">
                    <div class="name">${item.name}</div>
                    <div class="meta">${item.meta}</div>
                </div>
                <button class="ositos-download-btn" onclick="showOsitosMessage('📥 Descargando...')">
                    <i data-lucide="download"></i>
                </button>
            </div>
        `).join('');
    }

    // Coleccionables
    const coleccionablesContainer = document.getElementById('coleccionablesGrid');
    if (coleccionablesContainer) {
        coleccionablesContainer.innerHTML = COLECCIONABLES_DATA.map(item => `
            <div class="ositos-collectible-card">
                <span class="ositos-collectible-emoji">${item.emoji}</span>
                <h4>${item.title}</h4>
                <p>${item.desc}</p>
            </div>
        `).join('');
    }

    // Fondos
    const fondosContainer = document.getElementById('fondosGrid');
    if (fondosContainer) {
        fondosContainer.innerHTML = FONDOS_DATA.map(item => `
            <div class="ositos-wallpaper-card" style="background: ${item.bg};">
                <span>${item.emoji}</span>
                <span class="ositos-wallpaper-name">${item.name}</span>
            </div>
        `).join('');
    }

    // Curiosidades
    const curiosidadesContainer = document.getElementById('curiosidadesGrid');
    if (curiosidadesContainer) {
        curiosidadesContainer.innerHTML = CURIOSIDADES_DATA.map(item => `
            <div class="ositos-curiosity-card">
                <span class="ositos-curiosity-icon">${item.icon}</span>
                <h4>${item.title}</h4>
                <p>${item.desc}</p>
            </div>
        `).join('');
    }

    // Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// ==========================================
// PAGINACIÓN (Historia y Noticias)
// ==========================================

function updatePagination(section, totalPages, currentPage) {
    let containerId = '';
    if (section === 'historia') {
        containerId = 'ositosPaginationHistoria';
    } else if (section === 'noticias') {
        containerId = 'ositosPaginationNoticias';
    }
    
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '';
    html += `<button class="ositos-page-btn arrow ${currentPage === 1 ? 'disabled' : ''}" data-section="${section}" data-page="prev">‹</button>`;
    
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="ositos-page-btn ${i === currentPage ? 'active' : ''}" data-section="${section}" data-page="${i}">${i}</button>`;
    }
    
    html += `<button class="ositos-page-btn arrow ${currentPage === totalPages ? 'disabled' : ''}" data-section="${section}" data-page="next">›</button>`;
    
    container.innerHTML = html;
    
    container.querySelectorAll('.ositos-page-btn:not(.disabled)').forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.section;
            const page = btn.dataset.page;
            let newPage = currentPage;
            
            if (page === 'prev') {
                newPage = Math.max(1, currentPage - 1);
            } else if (page === 'next') {
                newPage = Math.min(totalPages, currentPage + 1);
            } else {
                newPage = parseInt(page);
            }
            
            if (section === 'historia') {
                renderHistoriaPage(newPage);
            } else if (section === 'noticias') {
                renderNoticiasPage(newPage);
            }
        });
    });
}

// ==========================================
// INICIALIZACIÓN
// ==========================================

function init() {
    loadFavorites();
    updateCounters();
    setupNavigation();
    setupFilters();
    setupExtrasMenu();
    startFactRotation();

    renderGrid();
    renderHistoriaPage(1);
    renderNoticiasPage(1);
    renderExtras();

    // Asegurar que la página de personajes está visible
    switchPage('personajes');

    // Modal
    const modal = document.getElementById('ositosModal');
    document.getElementById('ositosModalClose')?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    console.log('🧸 Ositos World iniciado!', state.characters.length, 'personajes');
}

// Ejecutar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}