// sentimientos.js - Navegación entre pestañas (como en TuRincónFav)

function showSentimentSubview(viewId) {
    // Cambiar clases de las pestañas
    document.querySelectorAll('.sentiment-tabs .sub-tab').forEach(tab => {
        if (tab.dataset.subview === viewId) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    // Cambiar clases de las vistas
    document.querySelectorAll('.sub-view').forEach(view => {
        if (view.id === viewId) {
            view.classList.add('active');
        } else {
            view.classList.remove('active');
        }
    });
    
    // Guardar la última vista en localStorage
    localStorage.setItem('sentimientos_last_view', viewId);
}

// Cargar estadísticas para la página de inicio
function updateHeroStats() {
    const statsContainer = document.getElementById('heroStats');
    if (!statsContainer) return;
    
    // Valores estáticos o podrías obtenerlos dinámicamente
    statsContainer.innerHTML = `
        <div class="stat-card">
            <div class="stat-number">10</div>
            <div class="stat-label">Razones</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">6</div>
            <div class="stat-label">Cartas</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">31</div>
            <div class="stat-label">Sorpresas</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" id="statsKind">0</div>
            <div class="stat-label">Halagos</div>
        </div>
    `;
}

// Inicializar
function initSentimientos() {
    // Configurar eventos de las pestañas
    document.querySelectorAll('.sentiment-tabs .sub-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const viewId = tab.dataset.subview;
            if (viewId) {
                showSentimentSubview(viewId);
            }
        });
    });
    
    // Cargar estadísticas
    updateHeroStats();
    
    // Restaurar última vista si existe
    const lastView = localStorage.getItem('sentimientos_last_view');
    if (lastView && document.getElementById(lastView)) {
        showSentimentSubview(lastView);
    } else {
        showSentimentSubview('inicio');
    }
    
    // Inicializar Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSentimientos);
} else {
    initSentimientos();
}

// Funciones globales necesarias
window.closeLightbox = function() {
    const lightbox = document.getElementById('lightbox');
    if (lightbox) lightbox.classList.remove('active');
};