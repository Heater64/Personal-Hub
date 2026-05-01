// ==========================================
// series.js · Lógica de series (diseño imagen referencia)
// ==========================================
let series = [];
const ITEMS_PER_PAGE = 6;
let currentPage = 1;

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
        name: 'DragonBall',
        url: 'https://tioanime.com/anime/dragon-ball',
        total: 153,
        watched: 0,
        cover: 'https://tioanime.com/uploads/portadas/509.jpg'
    },
    {
        id: Date.now() + 1,
        name: 'DragonBall-Z',
        url: 'https://tioanime.com/anime/dragon-ball-z',
        total: 291,
        watched: 0,
        cover: 'https://tioanime.com/uploads/portadas/37.jpg'
    },
    {
        id: Date.now() + 2,
        name: 'DragonBall-Super',
        url: 'https://dragonballlatino.net/season/dragon-ball-super-1/',
        total: 131,
        watched: 0,
        cover: 'assets/dragon-ball-super.jpg'
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
    const form = document.getElementById('addFormDropdown');
    const btn = document.getElementById('addSeriesBtn');
    if (!form) return;
    form.classList.remove('open');
    if (btn) btn.querySelector('.chevron-icon')?.setAttribute('data-lucide', 'chevron-down');
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
    currentPage = Math.ceil(series.length / ITEMS_PER_PAGE);
    renderSeries();
    clearSerieForm();
    closeSerieForm();
    showMessage(`"${name}" añadida`);
}

function deleteSerie(id) {
    const serie = series.find((item) => item.id === id);
    if (!serie) return;
    confirmAction(`¿Eliminar "${serie.name}"?`, () => {
        series = series.filter((item) => item.id !== id);
        saveSeries();
        const totalPages = Math.max(1, Math.ceil(series.length / ITEMS_PER_PAGE));
        if (currentPage > totalPages) currentPage = totalPages;
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
            showMessage(`¡Completaste ${serie.name}! ❤`);
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
    confirmAction('¿Reiniciar el progreso de TODAS las series?', () => {
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
        return `<img src="${escapeHtml(item.cover)}" alt="Portada de ${escapeHtml(item.name)}" loading="lazy">`;
    }
    return `
        <div class="card-cover-placeholder">
            <i data-lucide="tv-2"></i>
            <span>${escapeHtml(item.name.slice(0, 2).toUpperCase())}</span>
        </div>
    `;
}

function renderPagination(total) {
    const container = document.getElementById('seriesPagination');
    if (!container) return;
    const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    let html = `
        <button class="page-btn arrow" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>
            <i data-lucide="chevron-left"></i>
        </button>
    `;
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    html += `
        <button class="page-btn arrow" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>
            <i data-lucide="chevron-right"></i>
        </button>
    `;
    container.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    container.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => {
            const p = parseInt(btn.dataset.page);
            if (p >= 1 && p <= totalPages) {
                currentPage = p;
                renderSeries();
            }
        });
    });
}

function renderSeries() {
    const container = document.getElementById('seriesList');
    if (!container) return;
    const totalPages = Math.max(1, Math.ceil(series.length / ITEMS_PER_PAGE));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageSeries = series.slice(start, start + ITEMS_PER_PAGE);
    if (series.length === 0) {
        container.innerHTML = `
            <div class="empty-state-new">
                <i data-lucide="tv-off"></i>
                <p>Aún no hay series añadidas.</p>
            </div>
        `;
    } else {
        container.innerHTML = pageSeries.map((item) => {
            const percent = Math.max(0, Math.min(100, (item.watched / item.total) * 100));
            return `
                <article class="series-card-new ${item.watched === item.total ? 'completed' : ''}" data-id="${item.id}" data-url="${escapeHtml(item.url)}">
                    <div class="card-cover">
                        ${createCoverMarkup(item)}
                    </div>
                    <div class="card-content">
                        <h3 class="card-title">${escapeHtml(item.name)}</h3>
                        <div class="card-link">
                            <i data-lucide="external-link"></i>
                            <span>${escapeHtml(formatSeriesUrl(item.url))}</span>
                        </div>
                        <div class="card-progress-bar">
                            <div class="card-progress-fill" style="width:${percent}%"></div>
                        </div>
                        <p class="card-count">
                            <span class="watched-num">${item.watched}</span> / ${item.total} capítulos
                        </p>
                    </div>
                    <div class="card-controls">
                        <div class="ctrl-group">
                            <button class="ctrl-btn inc" data-id="${item.id}" title="Sumar capítulo">
                                <i data-lucide="plus"></i>
                            </button>
                            <button class="ctrl-btn dec" data-id="${item.id}" title="Restar capítulo">
                                <i data-lucide="minus"></i>
                            </button>
                        </div>
                        <button class="ctrl-btn del" data-id="${item.id}" title="Eliminar">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </article>
            `;
        }).join('');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
    // Manejo de errores de imágenes
    container.querySelectorAll('.card-cover img').forEach((image) => {
        image.addEventListener('error', () => {
            const parent = image.parentElement;
            if (!parent) return;
            const card = parent.closest('.series-card-new');
            const title = card ? card.querySelector('.card-title')?.textContent || 'TV' : 'TV';
            parent.innerHTML = `
                <div class="card-cover-placeholder">
                    <i data-lucide="tv-2"></i>
                    <span>${escapeHtml(title.slice(0, 2).toUpperCase())}</span>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }, { once: true });
    });
    // Click en tarjeta → abrir enlace
    container.querySelectorAll('.series-card-new').forEach((card) => {
        card.addEventListener('click', (event) => {
            if (event.target.closest('.ctrl-btn')) return;
            openSafeUrl(card.dataset.url, 'Enlace no válido o inseguro');
        });
    });
    // Eventos de botones
    container.querySelectorAll('.ctrl-btn.inc').forEach(btn => btn.addEventListener('click', incHandler));
    container.querySelectorAll('.ctrl-btn.dec').forEach(btn => btn.addEventListener('click', decHandler));
    container.querySelectorAll('.ctrl-btn.del').forEach(btn => btn.addEventListener('click', deleteHandler));
    renderPagination(series.length);
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
    const addBtn = document.getElementById('addSeriesBtn');
    const form = document.getElementById('addFormDropdown');
    if (addBtn && form) {
        addBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            form.classList.toggle('open');
            const chevron = addBtn.querySelector('.chevron-icon');
            if (chevron) {
                chevron.setAttribute('data-lucide', form.classList.contains('open') ? 'chevron-up' : 'chevron-down');
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
            if (typeof pulseElement === 'function') pulseElement(addBtn);
        });
    }
    const saveBtn = document.getElementById('addSerieBtn');
    if (saveBtn) saveBtn.addEventListener('click', function () {
        if (typeof pulseElement === 'function') pulseElement(saveBtn);
        addSerie();
    });
    const resetBtn = document.getElementById('resetAllBtn');
    if (resetBtn) resetBtn.addEventListener('click', function () {
        if (typeof pulseElement === 'function') pulseElement(resetBtn);
        resetAllProgress();
    });
}

document.addEventListener('DOMContentLoaded', initSeries);