// ==========================================
// series.js · Mapa emocional audiovisual
// ==========================================

let currentType = 'serie';
let currentEstado = 'viendo';
let allSeries = [];
let allPeliculas = [];
let editingItemId = null;
let editingItemType = null;
const seriesRef = db.collection('seriesData').doc('list');
const peliculasRef = db.collection('peliculasData').doc('list');

async function loadData() {
    try {
        const [seriesSnap, peliculasSnap] = await Promise.all([
            seriesRef.get(),
            peliculasRef.get()
        ]);

        if (seriesSnap.exists) {
            allSeries = seriesSnap.data().series || [];
        } else {
            allSeries = window.seriesData || [];
            await seriesRef.set({ series: allSeries });
        }

        if (peliculasSnap.exists) {
            allPeliculas = peliculasSnap.data().peliculas || [];
        } else {
            allPeliculas = window.peliculasData || [];
            await peliculasRef.set({ peliculas: allPeliculas });
        }
    } catch (error) {
        console.error('Error al cargar datos de Firestore:', error);
        allSeries = window.seriesData || [];
        allPeliculas = window.peliculasData || [];
        showMessage('Usando datos locales (sin conexion)', true);
    }
}

function getCurrentList() {
    return currentType === 'serie' ? allSeries : allPeliculas;
}

function getFilteredList() {
    return getCurrentList().filter((item) => item.estado === currentEstado);
}

async function saveData() {
    try {
        if (currentType === 'serie') {
            await seriesRef.set({ series: allSeries }, { merge: true });
        } else {
            await peliculasRef.set({ peliculas: allPeliculas }, { merge: true });
        }
    } catch (error) {
        console.error('Error al guardar en Firestore:', error);
        showMessage('No se pudo guardar en la nube', true);
    }
}

function renderList() {
    const container = document.getElementById('seriesList');
    if (!container) return;

    const items = getFilteredList();
    if (items.length === 0) {
        const emptyIcon = currentType === 'serie' ? 'tv' : 'film';
        container.innerHTML = `<div class="empty-state-new"><i data-lucide="${emptyIcon}"></i><p>No hay nada aqui todavia.</p></div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    container.innerHTML = items.map((item) => {
        const esViendo = item.estado === 'viendo';
        const esVisto = item.estado === 'visto';
        const percent = item.total > 0 ? Math.round((item.watched / item.total) * 100) : 0;
        const placeholderIcon = currentType === 'serie' ? 'tv-2' : 'film';

        return `
        <article class="series-card-new estado-${item.estado}" data-id="${item.id}" data-url="${escapeHtml(item.url)}">
            <div class="card-cover">
                ${item.cover ? `<img src="${escapeHtml(item.cover)}" alt="${escapeHtml(item.name)}">` : `<div class="card-cover-placeholder"><i data-lucide="${placeholderIcon}"></i></div>`}
            </div>
            <div class="card-content">
                <h3 class="card-title">${escapeHtml(item.name)}</h3>
                <div class="card-link"><i data-lucide="external-link"></i> <span>${item.url ? 'Ver' : 'Sin enlace'}</span></div>
                ${esViendo ? `
                <div class="card-progress-bar"><div class="card-progress-fill" style="width:${percent}%"></div></div>
                <p class="card-count"><span class="watched-num">${item.watched}</span> / ${item.total} capitulos</p>
                ` : ''}
            </div>
            <div class="card-controls">
                ${esVisto ? `<div class="completed-badge"><i data-lucide="check-circle"></i></div>` : `
                <div class="ctrl-group">
                    ${esViendo
                        ? `
                        <button class="ctrl-btn dec" data-id="${item.id}" type="button" title="Restar">
                            <i data-lucide="minus"></i>
                        </button>
                        <button class="ctrl-btn inc" data-id="${item.id}" type="button" title="Sumar">
                            <i data-lucide="plus"></i>
                        </button>
                        `
                        : `<button class="ctrl-btn inc" data-id="${item.id}" type="button" title="Empezar"><i data-lucide="play"></i></button>`}
                </div>`}
                <button class="ctrl-btn edit" data-id="${item.id}" type="button" title="Editar"><i data-lucide="pencil"></i></button>
                <button class="ctrl-btn del" data-id="${item.id}" type="button"><i data-lucide="trash-2"></i></button>
            </div>
        </article>`;
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();

    container.querySelectorAll('.ctrl-btn.inc').forEach((btn) => {
        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            incrementWatched(Number(btn.dataset.id));
        });
    });

    container.querySelectorAll('.ctrl-btn.dec').forEach((btn) => {
        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            decrementWatched(Number(btn.dataset.id));
        });
    });

    container.querySelectorAll('.ctrl-btn.del').forEach((btn) => {
        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            deleteItem(Number(btn.dataset.id));
        });
    });

    container.querySelectorAll('.ctrl-btn.edit').forEach((btn) => {
        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            startEditItem(Number(btn.dataset.id));
        });
    });

    container.querySelectorAll('.series-card-new').forEach((card) => {
        card.addEventListener('click', function (event) {
            if (event.target.closest('button') || event.target.closest('.card-controls')) return;

            const url = this.dataset.url;
            if (url) {
                window.open(url, '_blank', 'noopener,noreferrer');
            }
        });
    });
}

async function incrementWatched(id) {
    const list = getCurrentList();
    const item = list.find((entry) => entry.id === id);
    if (!item) return;

    if (item.estado === 'quiero_ver') {
        item.estado = 'viendo';
        item.watched = 0;
    } else if (item.estado === 'viendo' && item.watched < item.total) {
        item.watched++;
        if (item.watched === item.total) {
            item.estado = 'visto';
            showMessage(`Terminaste "${item.name}"`);
        }
    }

    await saveData();
    renderList();
}

async function decrementWatched(id) {
    const list = getCurrentList();
    const item = list.find((entry) => entry.id === id);
    if (!item) return;

    if (item.estado === 'viendo' && item.watched > 0) {
        item.watched--;
    }

    await saveData();
    renderList();
}

async function deleteItem(id) {
    const list = getCurrentList();
    const index = list.findIndex((entry) => entry.id === id);
    if (index === -1) return;

    const name = list[index].name;
    list.splice(index, 1);
    await saveData();
    renderList();
    showMessage(`"${name}" eliminado`);
}

function getItemById(id, type = currentType) {
    const list = type === 'serie' ? allSeries : allPeliculas;
    return list.find((entry) => entry.id === id) || null;
}

function startEditItem(id) {
    const item = getItemById(id);
    if (!item) return;

    editingItemId = id;
    editingItemType = currentType;

    document.getElementById('serieName').value = item.name || '';
    document.getElementById('serieUrl').value = item.url || '';
    document.getElementById('serieTotal').value = item.total || 1;
    document.getElementById('serieCover').value = item.cover || '';
    document.getElementById('serieTipo').value = currentType;
    document.getElementById('serieEstado').value = item.estado || 'viendo';

    document.getElementById('addSerieBtn').textContent = 'Guardar cambios';
    document.getElementById('addFormDropdown')?.classList.add('open');
}

async function addItem() {
    const name = document.getElementById('serieName').value.trim();
    const url = document.getElementById('serieUrl').value.trim();
    const total = parseInt(document.getElementById('serieTotal').value, 10) || 1;
    const cover = document.getElementById('serieCover').value.trim();
    const tipo = document.getElementById('serieTipo').value;
    const estado = document.getElementById('serieEstado').value;

    if (!name) {
        showMessage('Falta el nombre', true);
        return;
    }

    if (editingItemId !== null) {
        const sourceType = editingItemType || currentType;
        const sourceList = sourceType === 'serie' ? allSeries : allPeliculas;
        const targetList = tipo === 'serie' ? allSeries : allPeliculas;
        const itemIndex = sourceList.findIndex((entry) => entry.id === editingItemId);

        if (itemIndex === -1) {
            showMessage('No se pudo editar el elemento', true);
            clearForm();
            return;
        }

        const currentItem = sourceList[itemIndex];
        const updatedItem = {
            ...currentItem,
            name,
            url,
            total,
            cover,
            estado
        };

        if (estado === 'visto') {
            updatedItem.watched = total;
        } else if (estado === 'quiero_ver') {
            updatedItem.watched = 0;
        } else {
            updatedItem.watched = Math.min(currentItem.watched || 0, total);
        }

        sourceList.splice(itemIndex, 1);
        targetList.push(updatedItem);

        currentType = tipo;
        currentEstado = estado;
        await saveData();
        clearForm();
        document.getElementById('addFormDropdown')?.classList.remove('open');
        updateActiveTabs();
        renderList();
        showMessage(`"${name}" actualizado`);
        return;
    }

    const newItem = {
        id: Date.now(),
        name,
        url,
        total,
        watched: estado === 'visto' ? total : 0,
        cover,
        estado
    };

    if (tipo === 'serie') {
        allSeries.push(newItem);
    } else {
        allPeliculas.push(newItem);
    }

    await saveData();
    clearForm();
    document.getElementById('addFormDropdown')?.classList.remove('open');
    renderList();
    showMessage(`"${name}" anadido`);
}

function clearForm() {
    ['serieName', 'serieUrl', 'serieTotal', 'serieCover'].forEach((id) => {
        const input = document.getElementById(id);
        if (input) input.value = '';
    });

    const estado = document.getElementById('serieEstado');
    if (estado) estado.value = 'viendo';

    const tipo = document.getElementById('serieTipo');
    if (tipo) tipo.value = currentType;

    editingItemId = null;
    editingItemType = null;

    const submitBtn = document.getElementById('addSerieBtn');
    if (submitBtn) submitBtn.textContent = 'Guardar';
}

function switchMainTab(type) {
    currentType = type;
    updateActiveTabs();
    renderList();
}

function switchEstadoTab(estado) {
    currentEstado = estado;
    updateActiveTabs();
    renderList();
}

function updateActiveTabs() {
    document.querySelectorAll('.main-tab').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.type === currentType);
    });

    document.querySelectorAll('.sub-tab').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.estado === currentEstado);
    });
}

async function initSeries() {
    allSeries = window.seriesData || [];
    allPeliculas = window.peliculasData || [];
    updateActiveTabs();
    await loadData();
    renderList();

    document.querySelectorAll('.main-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            switchMainTab(tab.dataset.type);
        });
    });

    document.querySelectorAll('.sub-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            switchEstadoTab(tab.dataset.estado);
        });
    });

    document.getElementById('addSeriesBtn')?.addEventListener('click', () => {
        document.getElementById('addFormDropdown')?.classList.toggle('open');
    });

    document.getElementById('addSerieBtn')?.addEventListener('click', addItem);
}

document.addEventListener('DOMContentLoaded', initSeries);
