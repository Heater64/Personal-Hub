// js/pages/home.js
import { initHubGrid } from '../ui/hubGrid.js';
import { HOME_DATA } from '../data/homeData.js';

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

    // Mostrar solo las 3 primeras inicialmente
    const visibleCount = 3;
    const hasMore = news.length > visibleCount;

    container.innerHTML = news.map((item, index) => {
        // Verificar si tiene ubicación
        const hasLocation = item.location && item.location.section;
        
        return `
            <div class="news-item ${index >= visibleCount ? 'news-hidden' : ''}" data-index="${index}">
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

    toggleBtn.addEventListener('click', () => {
        const isExpanded = toggleBtn.dataset.expanded === 'true';
        const hiddenItems = document.querySelectorAll('.news-item.news-hidden');
        
        if (isExpanded) {
            // Colapsar
            hiddenItems.forEach(el => el.classList.add('news-hidden'));
            toggleBtn.innerHTML = '<i data-lucide="chevron-down"></i>';
            toggleBtn.dataset.expanded = 'false';
        } else {
            // Expandir
            hiddenItems.forEach(el => el.classList.remove('news-hidden'));
            toggleBtn.innerHTML = '<i data-lucide="chevron-up"></i>';
            toggleBtn.dataset.expanded = 'true';
        }
        
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

// --- Utilidad ---
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

// Ejecutar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}