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

function normalizeSerie(item) {
    return {
        id: item.id || Date.now(),
        name: item.name || 'Serie sin nombre',
        url: item.url || '',
        total: Number(item.total) > 0 ? Number(item.total) : 1,
        watched: Math.max(0, Number(item.watched) || 0),
        cover: typeof item.cover === 'string' ? item.cover : ''
    };
}

function loadSeries() {
    const stored = localStorage.getItem('misSeries');
    if (stored) {
        series = JSON.parse(stored).map(normalizeSerie);
    } else {
        series = [
            {
                id: Date.now(),
                name: 'DragonBall-Nino',
                url: 'https://tioanime.com/anime/dragon-ball',
                total: 153,
                watched: 0,
                cover: ''
            }
        ];
        saveSeries();
    }
    renderSeries();
}

function saveSeries() {
    localStorage.setItem('misSeries', JSON.stringify(series));
}

function clearSerieForm() {
    document.getElementById('serieName').value = '';
    document.getElementById('serieUrl').value = '';
    document.getElementById('serieTotal').value = '';
    document.getElementById('serieCover').value = '';
}

function closeSerieForm() {
    const form = document.getElementById('seriesForm');
    const icon = document.getElementById('toggleIcon');
    if (!form || !icon) return;
    form.classList.remove('open');
    icon.setAttribute('data-lucide', 'chevron-down');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function addSerie() {
    const name = document.getElementById('serieName').value.trim();
    const url = document.getElementById('serieUrl').value.trim();
    const total = parseInt(document.getElementById('serieTotal').value, 10);
    const cover = document.getElementById('serieCover').value.trim();

    if (!name || !url || isNaN(total) || total <= 0) {
        showMessage('Completa todos los campos obligatorios', true);
        return;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        showMessage('El enlace debe comenzar con http:// o https://', true);
        return;
    }
    if (cover && !cover.startsWith('http://') && !cover.startsWith('https://')) {
        showMessage('La portada debe comenzar con http:// o https://', true);
        return;
    }

    const newSerie = { id: Date.now(), name, url, total, watched: 0, cover };
    series.push(newSerie);
    saveSeries();
    renderSeries();
    clearSerieForm();
    closeSerieForm();
    showMessage(`"${name}" añadida`);
}

function deleteSerie(id) {
    const serie = series.find((item) => item.id === id);
    if (!serie) return;
    confirmAction(`Eliminar "${serie.name}"?`, () => {
        series = series.filter((item) => item.id !== id);
        saveSeries();
        renderSeries();
        showMessage(`"${serie.name}" eliminada`);
    });
}

function celebrateSerie(buttonSource) {
    if (typeof launchParticles === 'function') {
        launchParticles({
            amount: 18,
            symbols: ['❤', '✦', '★'],
            colors: ['#c65a3a', '#ffb347', '#ff8aa1'],
            spread: 160,
            source: buttonSource || null
        });
    }
}

function incrementWatched(id, sourceButton = null) {
    const serie = series.find((item) => item.id === id);
    if (serie && serie.watched < serie.total) {
        serie.watched++;
        saveSeries();
        renderSeries();
        if (serie.watched === serie.total) {
            showMessage(`Completaste ${serie.name}`);
            celebrateSerie(sourceButton);
        }
    } else if (serie && serie.watched === serie.total) {
        showMessage(`Ya viste todos los capítulos de ${serie.name}`);
    }
}

function decrementWatched(id, sourceButton = null) {
    const serie = series.find((item) => item.id === id);
    if (serie && serie.watched > 0) {
        serie.watched--;
        saveSeries();
        renderSeries();
        if (typeof pulseElement === 'function') pulseElement(sourceButton);
    }
}

function resetAllProgress() {
    confirmAction('Reiniciar el progreso de TODAS las series?', () => {
        series = series.map((item) => ({ ...item, watched: 0 }));
        saveSeries();
        renderSeries();
        showMessage('Progreso reiniciado en todas las series');
    });
}

function formatSeriesUrl(url) {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, '');
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts.length === 0) return host;
        const shortPath = parts.slice(0, 2).join('/');
        return `${host}/${shortPath}${parts.length > 2 ? '/...' : ''}`;
    } catch (error) {
        return url.length > 34 ? `${url.slice(0, 34)}...` : url;
    }
}

function createCoverMarkup(item) {
    if (item.cover) {
        return `
            <div class="series-cover">
                <img src="${escapeHtml(item.cover)}" alt="Portada de ${escapeHtml(item.name)}" loading="lazy">
            </div>
        `;
    }

    return `
        <div class="series-cover series-cover-placeholder">
            <i data-lucide="tv-2"></i>
            <span>${escapeHtml(item.name.slice(0, 2).toUpperCase())}</span>
        </div>
    `;
}

function renderSeries() {
    const container = document.getElementById('seriesList');
    if (!container) return;

    if (series.length === 0) {
        container.innerHTML = '<div class="empty-state"><i data-lucide="tv-off" style="width:40px;height:40px;"></i><p>Aún no hay series añadidas.</p></div>';
    } else {
        container.innerHTML = series.map((item) => {
            const percent = Math.max(0, Math.min(100, (item.watched / item.total) * 100));
            return `
                <article class="series-card ${item.watched === item.total ? 'completed' : ''}" data-id="${item.id}" data-url="${escapeHtml(item.url)}">
                    ${createCoverMarkup(item)}
                    <div class="series-body">
                        <div class="series-meta">
                            <div class="series-title-row">
                                <i data-lucide="clapperboard" class="series-title-icon"></i>
                                <h3>${escapeHtml(item.name)}</h3>
                            </div>
                            <div class="series-link">
                                <i data-lucide="external-link"></i>
                                <span>${escapeHtml(formatSeriesUrl(item.url))}</span>
                            </div>
                            <p class="series-count">${item.watched} / ${item.total} capítulos</p>
                            <div class="series-progress" aria-hidden="true">
                                <div class="series-progress-fill" style="width:${percent}%;"></div>
                            </div>
                        </div>
                        <div class="series-controls">
                            <div class="series-counter">
                                <button class="counter-btn dec" data-id="${item.id}" title="Restar capítulo">
                                    <i data-lucide="minus"></i>
                                </button>
                                <span class="series-counter-text">${item.watched} / ${item.total} capítulos</span>
                                <button class="counter-btn inc" data-id="${item.id}" title="Sumar capítulo">
                                    <i data-lucide="plus"></i>
                                </button>
                            </div>
                            <button class="delete-serie" data-id="${item.id}" title="Eliminar serie">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    </div>
                </article>
            `;
        }).join('');
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();

    document.querySelectorAll('.series-cover img').forEach((image) => {
        image.addEventListener('error', () => {
            const parent = image.parentElement;
            if (!parent) return;
            const card = parent.closest('.series-card');
            const title = card ? card.querySelector('.series-meta h3')?.textContent || 'TV' : 'TV';
            parent.classList.add('series-cover-placeholder');
            parent.innerHTML = `
                <i data-lucide="tv-2"></i>
                <span>${escapeHtml(title.slice(0, 2).toUpperCase())}</span>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }, { once: true });
    });

    document.querySelectorAll('.series-card').forEach((card) => {
        card.addEventListener('click', (event) => {
            if (event.target.closest('.counter-btn') || event.target.closest('.delete-serie')) return;
            openSafeUrl(card.dataset.url, 'Enlace no válido o inseguro');
        });
    });

    document.querySelectorAll('.counter-btn.inc').forEach((btn) => btn.addEventListener('click', incHandler));
    document.querySelectorAll('.counter-btn.dec').forEach((btn) => btn.addEventListener('click', decHandler));
    document.querySelectorAll('.delete-serie').forEach((btn) => btn.addEventListener('click', deleteHandler));
}

function incHandler(event) {
    event.stopPropagation();
    if (typeof pulseElement === 'function') pulseElement(event.currentTarget);
    incrementWatched(Number(event.currentTarget.dataset.id), event.currentTarget);
}

function decHandler(event) {
    event.stopPropagation();
    decrementWatched(Number(event.currentTarget.dataset.id), event.currentTarget);
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
            if (typeof pulseElement === 'function') pulseElement(toggleBtn);
        });
    }

    if (addBtn) addBtn.addEventListener('click', function () {
        if (typeof pulseElement === 'function') pulseElement(addBtn);
        addSerie();
    });
    if (resetBtn) resetBtn.addEventListener('click', function () {
        if (typeof pulseElement === 'function') pulseElement(resetBtn);
        resetAllProgress();
    });
}

document.addEventListener('DOMContentLoaded', initSeries);
