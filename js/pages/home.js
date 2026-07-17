// js/pages/home.js
import { initHubGrid } from '../ui/hubGrid.js';
import { HOME_DATA } from '../data/homeData.js';
import { escapeHtml } from '../modules/shared/dom.js';

async function boot() {
    // Cargar grid de secciones
    initHubGrid('#hubGrid');

    // Contador de días
    if (typeof initDayCounter === 'function') {
        initDayCounter('homeDayCounter', '2025-07-03', 'días juntos🤍👑');
    }

    // ========== SKELETON mientras cargan noticias ==========
    var newsContainer = document.getElementById('newsContent');
    if (window.Skeleton && newsContainer) {
        Skeleton.mostrar(newsContainer, Skeleton.lista(2, { lineas: 2 }));
    }

    // ========== CARGAR NOTICIAS (desde Firestore si existe) ==========
    await loadNewsFromFirestore();

    // ========== CARGAR DATOS CURIOSOS ==========
    if (window.Skeleton) {
        var curContainer = document.getElementById('curiositiesGrid');
        if (curContainer) Skeleton.mostrar(curContainer, Skeleton.lista(3, { lineas: 2 }));
    }
    renderCuriosities();

    // ========== TOGGLE DE NOTICIAS ==========
    setupNewsToggle();

    // ========== PULL TO REFRESH ==========
    var page = document.querySelector('.page');
    if (window.PullToRefresh && page) {
        PullToRefresh.init(page, async function () {
            await loadNewsFromFirestore();
            renderCuriosities();
        });
    }

    // ========== NOTIFICACIÓN DIARIA ==========
    if (window.Notifications) {
        window.Notifications.diaria('home.bienvenida', '✨ Hola de nuevo, mi princesa. ¿Vemos qué hay nuevo hoy?', 'exito');
    }
}

async function loadNewsFromFirestore() {
    if (!window.db) {
        renderNews(HOME_DATA.news);
        return;
    }
    try {
        var snap = await window.db.collection('config_noticias').doc('data').get();
        if (snap.exists && snap.data().news && snap.data().news.length > 0) {
            renderNews(snap.data().news);
            return;
        }
    } catch (e) {
        console.warn('No se pudieron cargar noticias de Firestore, usando locales:', e);
    }
    renderNews(HOME_DATA.news);
}

function renderNews(newsData) {
    const container = document.getElementById('newsContent');
    if (!container) return;

    const news = newsData || HOME_DATA.news || [];
    
    if (news.length === 0) {
        container.innerHTML = `
            <div class="news-empty">
                <span>✨ No hay novedades por ahora. ¡Vuelve pronto!</span>
            </div>
        `;
        return;
    }

    // Contar cuántas noticias reales hay (excluyendo separadores)
    const realNews = news.filter(item => item.type !== 'separator');
    const visibleCount = 3;
    const hasMore = realNews.length > visibleCount;

    let renderedCount = 0;

    container.innerHTML = news.map((item) => {
        // Si es un separador
        if (item.type === 'separator') {
            return `
                <div class="news-separator">
                    <span class="news-separator-line"></span>
                    <span class="news-separator-label">${escapeHtml(item.label || '—')}</span>
                    <span class="news-separator-line"></span>
                </div>
            `;
        }

        // Si es una noticia normal
        const isHidden = renderedCount >= visibleCount;
        renderedCount++;

        const hasLocation = item.location && item.location.section;
        
        return `
            <div class="news-item ${isHidden ? 'news-hidden' : ''}" data-index="${item.id}">
                <div class="news-item-top">
                    <span class="news-date">${escapeHtml(item.date)}</span>
                    ${hasLocation ? `
                        <span class="news-location">
                            <span class="news-location-icon">${escapeHtml(item.location.icon || '📍')}</span>
                            <span class="news-location-text">${escapeHtml(item.location.section)} → ${escapeHtml(item.location.subSection || '')}</span>
                        </span>
                    ` : ''}
                </div>
                <span class="news-item-title">${escapeHtml(item.title)}</span>
                <p class="news-item-desc">${escapeHtml(item.description)}</p>
                ${hasLocation && item.location.href ? `
                    <a href="${escapeHtml(item.location.href)}" class="news-go-btn">
                        <i data-lucide="arrow-right"></i> Ir a la sección
                    </a>
                ` : ''}
            </div>
        `;
    }).join('');

    // Mostrar/ocultar el botón de toggle
    const toggleBtn = document.getElementById('newsToggle');
    if (toggleBtn) {
        toggleBtn.style.display = hasMore ? 'flex' : 'none';
        toggleBtn.dataset.expanded = 'false';
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons({ root: container });
    }
}

// --- Toggle de noticias ---
function setupNewsToggle() {
    const toggleBtn = document.getElementById('newsToggle');
    if (!toggleBtn) return;

    const news = HOME_DATA.news.filter(item => item.type !== 'separator');
    const visibleCount = 3;

    toggleBtn.addEventListener('click', () => {
        const isExpanded = toggleBtn.dataset.expanded === 'true';
        const allItems = document.querySelectorAll('.news-item');

        allItems.forEach((el, i) => {
            if (i >= visibleCount) {
                el.classList.toggle('news-hidden', isExpanded);
            }
        });

        toggleBtn.innerHTML = isExpanded
            ? '<i data-lucide="chevron-down"></i>'
            : '<i data-lucide="chevron-up"></i>';
        toggleBtn.dataset.expanded = isExpanded ? 'false' : 'true';

        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ root: toggleBtn });
        }
    });
}

// --- Renderizar datos curiosos ---
function renderCuriosities() {
    const container = document.getElementById('curiositiesGrid');
    if (!container) return;

    const curiosities = HOME_DATA.curiosities || [];

    container.innerHTML = curiosities.map(item => `
        <div class="curiosity-card">
            <div class="curiosity-icon">${escapeHtml(item.icon)}</div>
            <div class="curiosity-body">
                <h4>${escapeHtml(item.title)}</h4>
                <p>${escapeHtml(item.description)}</p>
            </div>
        </div>
    `).join('');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons({ root: container });
    }
}

// Ejecutar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}