// ==========================================
// series.js · Lógica de seguimiento de series
// ==========================================

// ========== VARIABLES GLOBALES ==========
let series = [];

// ========== FUNCIONES AUXILIARES ==========
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

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : (m === '<' ? '&lt;' : '&gt;'));
}

function confirmAction(message, onConfirm) {
    const modal = document.createElement('div');
    modal.className = 'modal-confirm';
    modal.innerHTML = `
        <div class="modal-content">
            <p>${message}</p>
            <div class="modal-buttons">
                <button class="modal-btn cancel">Cancelar</button>
                <button class="modal-btn confirm">Aceptar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.cancel').addEventListener('click', () => modal.remove());
    modal.querySelector('.confirm').addEventListener('click', () => {
        modal.remove();
        onConfirm();
    });
}

// ========== CRUD DE SERIES ==========
function loadSeries() {
    const stored = localStorage.getItem('misSeries');
    if (stored) {
        series = JSON.parse(stored);
    } else {
        series = [
            { id: Date.now(), name: "DragonBall-Niño", url: "https://tioanime.com/anime/dragon-ball", total: 153, watched: 0 }
        ];
        saveSeries();
    }
    renderSeries();
}

function saveSeries() {
    localStorage.setItem('misSeries', JSON.stringify(series));
}

function addSerie() {
    const name = document.getElementById('serieName').value.trim();
    const url = document.getElementById('serieUrl').value.trim();
    const total = parseInt(document.getElementById('serieTotal').value);
    if (!name || !url || isNaN(total) || total <= 0) {
        showMessage('❌ Completa todos los campos correctamente', true);
        return;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        showMessage('❌ El enlace debe comenzar con http:// o https://', true);
        return;
    }
    const newSerie = { id: Date.now(), name, url, total, watched: 0 };
    series.push(newSerie);
    saveSeries();
    renderSeries();
    document.getElementById('serieName').value = '';
    document.getElementById('serieUrl').value = '';
    document.getElementById('serieTotal').value = '';
    showMessage(`✅ "${name}" añadida`);
    document.getElementById('seriesForm').classList.remove('open');
    document.getElementById('toggleIcon').setAttribute('data-lucide', 'chevron-down');
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

function deleteSerie(id) {
    const serie = series.find(s => s.id === id);
    if (!serie) return;
    confirmAction(`¿Eliminar "${serie.name}"?`, () => {
        series = series.filter(s => s.id !== id);
        saveSeries();
        renderSeries();
        showMessage(`🗑️ "${serie.name}" eliminada`);
    });
}

function incrementWatched(id) {
    const serie = series.find(s => s.id === id);
    if (serie && serie.watched < serie.total) {
        serie.watched++;
        saveSeries();
        renderSeries();
        if(serie.watched === serie.total) showMessage(`🎉 ¡Completaste ${serie.name}!`);
    } else if (serie && serie.watched === serie.total) {
        showMessage(`🏁 Ya viste todos los capítulos de ${serie.name}`);
    }
}

function decrementWatched(id) {
    const serie = series.find(s => s.id === id);
    if (serie && serie.watched > 0) {
        serie.watched--;
        saveSeries();
        renderSeries();
    }
}

function resetAllProgress() {
    confirmAction('¿Reiniciar el progreso de TODAS las series? Se pondrán a 0 capítulos vistos.', () => {
        series = series.map(s => ({ ...s, watched: 0 }));
        saveSeries();
        renderSeries();
        showMessage('🔄 Progreso reiniciado en todas las series');
    });
}

// ========== RENDERIZADO ==========
function renderSeries() {
    const container = document.getElementById('seriesList');
    if (!container) return;
    if (series.length === 0) {
        container.innerHTML = `<div class="empty-state"><i data-lucide="tv-off" style="width:40px;height:40px;"></i><p>Aún no hay series añadidas.</p></div>`;
    } else {
        container.innerHTML = series.map(s => {
            const percent = (s.watched / s.total) * 100;
            const safeUrl = encodeURIComponent(s.url);
            return `
                <div class="series-card" data-id="${s.id}" data-url="${safeUrl}">
                    <div class="series-header">
                        <h3>${escapeHtml(s.name)}</h3>
                        <button class="delete-serie" data-id="${s.id}" title="Eliminar"><i data-lucide="trash-2"></i></button>
                    </div>
                    <div class="series-url">
                        <span><i data-lucide="external-link"></i> ${s.url.length > 40 ? s.url.substring(0,40)+'…' : s.url}</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-fill-serie" style="width: ${percent}%;"></div>
                    </div>
                    <div class="series-counter">
                        <button class="counter-btn dec" data-id="${s.id}"><i data-lucide="minus"></i></button>
                        <span>${s.watched} / ${s.total}</span>
                        <button class="counter-btn inc" data-id="${s.id}"><i data-lucide="plus"></i></button>
                    </div>
                </div>
            `;
        }).join('');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Evento para abrir enlace al hacer clic en la tarjeta (excepto botones)
    document.querySelectorAll('.series-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if(e.target.closest('.counter-btn') || e.target.closest('.delete-serie')) return;
            const encodedUrl = card.dataset.url;
            if (encodedUrl) {
                let url = decodeURIComponent(encodedUrl);
                if (url.startsWith('http://') || url.startsWith('https://')) {
                    window.open(url, '_blank', 'noopener noreferrer');
                } else {
                    showMessage('❌ Enlace no válido o inseguro', true);
                }
            }
        });
    });

    // Manejadores de incremento/decremento/eliminación
    document.querySelectorAll('.counter-btn.inc').forEach(btn => {
        btn.removeEventListener('click', incHandler);
        btn.addEventListener('click', incHandler);
    });
    document.querySelectorAll('.counter-btn.dec').forEach(btn => {
        btn.removeEventListener('click', decHandler);
        btn.addEventListener('click', decHandler);
    });
    document.querySelectorAll('.delete-serie').forEach(btn => {
        btn.removeEventListener('click', deleteHandler);
        btn.addEventListener('click', deleteHandler);
    });
}

function incHandler(e) {
    e.stopPropagation();
    const id = parseInt(e.currentTarget.dataset.id);
    incrementWatched(id);
}
function decHandler(e) {
    e.stopPropagation();
    const id = parseInt(e.currentTarget.dataset.id);
    decrementWatched(id);
}
function deleteHandler(e) {
    e.stopPropagation();
    const id = parseInt(e.currentTarget.dataset.id);
    deleteSerie(id);
}

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', () => {
    loadSeries();
    const toggleBtn = document.getElementById('toggleFormBtn');
    const form = document.getElementById('seriesForm');
    const icon = document.getElementById('toggleIcon');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            form.classList.toggle('open');
            icon.setAttribute('data-lucide', form.classList.contains('open') ? 'chevron-up' : 'chevron-down');
            if(typeof lucide !== 'undefined') lucide.createIcons();
        });
    }
    const addBtn = document.getElementById('addSerieBtn');
    if (addBtn) addBtn.addEventListener('click', addSerie);
    const resetBtn = document.getElementById('resetAllBtn');
    if (resetBtn) resetBtn.addEventListener('click', resetAllProgress);
});