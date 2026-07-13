// js/pages/home.js
import { initHubGrid } from '../ui/hubGrid.js';
import { HOME_DATA } from '../data/homeData.js';
import { escapeHtml } from '../modules/shared/dom.js';

function boot() {
    // Cargar grid de secciones
    initHubGrid('#hubGrid');
    
    // Contador de días
    if (typeof initDayCounter === 'function') {
        initDayCounter('homeDayCounter', '2025-07-03', 'días juntos🤍👑');
    }

    // ========== CARGAR NOTICIAS ==========
    renderNews();

    // ========== CARGAR DATOS CURIOSOS ==========
    renderCuriosities();

    // ========== TOGGLE DE NOTICIAS ==========
    setupNewsToggle();
}

// js/pages/home.js - Función renderNews con separador

function renderNews() {
    const container = document.getElementById('newsContent');
    if (!container) return;

    const news = HOME_DATA.news || [];
    
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