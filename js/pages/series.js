// ==========================================
// series.js · seguimiento de series
// ==========================================
let series = [];

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

function loadSeries() {
    const stored = localStorage.getItem('misSeries');
    if (stored) {
        series = JSON.parse(stored);
    } else {
        series = [
            { id: Date.now(), name: 'DragonBall-Nino', url: 'https://tioanime.com/anime/dragon-ball', total: 153, watched: 0 }
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
    const total = parseInt(document.getElementById('serieTotal').value, 10);
    if (!name || !url || isNaN(total) || total <= 0) {
        showMessage('Completa todos los campos correctamente', true);
        return;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        showMessage('El enlace debe comenzar con http:// o https://', true);
        return;
    }

    const newSerie = { id: Date.now(), name, url, total, watched: 0 };
    series.push(newSerie);
    saveSeries();
    renderSeries();
    document.getElementById('serieName').value = '';
    document.getElementById('serieUrl').value = '';
    document.getElementById('serieTotal').value = '';
    showMessage(`"${name}" anadida`);
    document.getElementById('seriesForm').classList.remove('open');
    document.getElementById('toggleIcon').setAttribute('data-lucide', 'chevron-down');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function deleteSerie(id) {
    const serie = series.find(item => item.id === id);
    if (!serie) return;
    confirmAction(`Eliminar "${serie.name}"?`, () => {
        series = series.filter(item => item.id !== id);
        saveSeries();
        renderSeries();
        showMessage(`"${serie.name}" eliminada`);
    });
}

function incrementWatched(id) {
    const serie = series.find(item => item.id === id);
    if (serie && serie.watched < serie.total) {
        serie.watched++;
        saveSeries();
        renderSeries();
        if (serie.watched === serie.total) showMessage(`Completaste ${serie.name}`);
    } else if (serie && serie.watched === serie.total) {
        showMessage(`Ya viste todos los capitulos de ${serie.name}`);
    }
}

function decrementWatched(id) {
    const serie = series.find(item => item.id === id);
    if (serie && serie.watched > 0) {
        serie.watched--;
        saveSeries();
        renderSeries();
    }
}

function resetAllProgress() {
    confirmAction('Reiniciar el progreso de TODAS las series?', () => {
        series = series.map(item => ({ ...item, watched: 0 }));
        saveSeries();
        renderSeries();
        showMessage('Progreso reiniciado en todas las series');
    });
}

function renderSeries() {
    const container = document.getElementById('seriesList');
    if (!container) return;

    if (series.length === 0) {
        container.innerHTML = '<div class="empty-state"><i data-lucide="tv-off" style="width:40px;height:40px;"></i><p>Aun no hay series anadidas.</p></div>';
    } else {
        container.innerHTML = series.map(item => {
            const percent = (item.watched / item.total) * 100;
            return `
                <div class="series-card" data-id="${item.id}" data-url="${item.url}">
                    <div class="series-header">
                        <h3>${escapeHtml(item.name)}</h3>
                        <button class="delete-serie" data-id="${item.id}" title="Eliminar"><i data-lucide="trash-2"></i></button>
                    </div>
                    <div class="series-url">
                        <span><i data-lucide="external-link"></i> ${escapeHtml(item.url.length > 40 ? item.url.substring(0, 40) + '...' : item.url)}</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-fill-serie" style="width: ${percent}%;"></div>
                    </div>
                    <div class="series-counter">
                        <button class="counter-btn dec" data-id="${item.id}"><i data-lucide="minus"></i></button>
                        <span>${item.watched} / ${item.total}</span>
                        <button class="counter-btn inc" data-id="${item.id}"><i data-lucide="plus"></i></button>
                    </div>
                </div>
            `;
        }).join('');
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();

    document.querySelectorAll('.series-card').forEach(card => {
        card.addEventListener('click', function (event) {
            if (event.target.closest('.counter-btn') || event.target.closest('.delete-serie')) return;
            openSafeUrl(card.dataset.url, 'Enlace no valido o inseguro');
        });
    });
    document.querySelectorAll('.counter-btn.inc').forEach(btn => btn.addEventListener('click', incHandler));
    document.querySelectorAll('.counter-btn.dec').forEach(btn => btn.addEventListener('click', decHandler));
    document.querySelectorAll('.delete-serie').forEach(btn => btn.addEventListener('click', deleteHandler));
}

function incHandler(event) {
    event.stopPropagation();
    incrementWatched(Number(event.currentTarget.dataset.id));
}

function decHandler(event) {
    event.stopPropagation();
    decrementWatched(Number(event.currentTarget.dataset.id));
}

function deleteHandler(event) {
    event.stopPropagation();
    deleteSerie(Number(event.currentTarget.dataset.id));
}

function initSeries() {
    if (!document.getElementById('seriesList')) return;
    loadSeries();
    const toggleBtn = document.getElementById('toggleFormBtn');
    const form = document.getElementById('seriesForm');
    const icon = document.getElementById('toggleIcon');
    const addBtn = document.getElementById('addSerieBtn');
    const resetBtn = document.getElementById('resetAllBtn');

    if (toggleBtn && form && icon) {
        toggleBtn.addEventListener('click', function () {
            form.classList.toggle('open');
            icon.setAttribute('data-lucide', form.classList.contains('open') ? 'chevron-up' : 'chevron-down');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        });
    }
    if (addBtn) addBtn.addEventListener('click', addSerie);
    if (resetBtn) resetBtn.addEventListener('click', resetAllProgress);
}

document.addEventListener('DOMContentLoaded', initSeries);
