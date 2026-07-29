/* ==========================================
   Personal Hub v2 — Series Page
   Catálogo de series y películas con CRUD, podio,
   episodios, progreso, vista detalle y más
   ========================================== */

import { showToast } from '../components/Toast.js';

const STORAGE_KEY = 'personalHub.seriesCatalog';
const PODIO_KEY = 'personalHub.seriesPodio';
const PROGRESS_KEY = 'personalHub.seriesProgress';

let catalog = [];
let podioData = { series: [], movies: [] };
let currentFilter = 'todo';
let searchTerm = '';
let currentPodiumType = 'series';
let currentView = 'catalog';

function loadData() {
  try {
    catalog = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    podioData = JSON.parse(localStorage.getItem(PODIO_KEY) || '{"series":[],"movies":[]}');
  } catch { catalog = []; podioData = { series: [], movies: [] }; }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
  localStorage.setItem(PODIO_KEY, JSON.stringify(podioData));
}

function loadProgress(itemId) {
  try {
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    return all[itemId] || {};
  } catch { return {}; }
}

function saveProgressForItem(itemId, data) {
  try {
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    all[itemId] = data;
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
  } catch {}
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : m === '>' ? '&gt;' : m === '"' ? '&quot;' : '&#39;');
}

function getTotal(item) {
  return item.totalEpisodios || (item.episodios ? item.episodios.length : 0);
}

function getCompleted(itemId, total) {
  const prog = loadProgress(itemId);
  const watched = prog.watched || [];
  return Math.min(watched.length, total);
}

function getPercent(item) {
  const total = getTotal(item);
  if (total <= 0) return 0;
  const done = getCompleted(item.id, total);
  return total > 0 ? (done / total) * 100 : 0;
}

function getStatusText(item) {
  const total = getTotal(item);
  if (total <= 0) return '';
  const done = getCompleted(item.id, total);
  if (done >= total) return 'Completado';
  if (done > 0) return `${done}/${total} vistos`;
  return `${total} episodios`;
}

function generateEpisodes(total) {
  const eps = [];
  for (let i = 1; i <= total; i++) {
    eps.push({ num: i, title: `Episodio ${i}` });
  }
  return eps;
}

export function SeriesPage(router) {
  const page = document.createElement('div');
  page.className = 'series-page';

  loadData();

  function cardHTML(item) {
    const total = getTotal(item);
    const percent = getPercent(item);
    const isCompleted = total > 0 && getCompleted(item.id, total) >= total;
    const hasCover = !!item.portada;
    const firstLetter = item.titulo ? item.titulo[0] : '?';

    return `
      <div class="series-card" data-id="${escapeHtml(item.id)}" data-tipo="${item.tipo}">
        <div class="series-card-cover">
          ${hasCover
            ? `<img src="${escapeHtml(item.portada)}" alt="${escapeHtml(item.titulo)}" class="series-card-img" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : ''
          }
          <div class="series-card-fallback" style="${hasCover ? 'display:none' : 'display:flex'}">${escapeHtml(firstLetter)}</div>
          ${isCompleted ? '<span class="series-card-badge completed" title="Completado">✓</span>' : ''}
          ${!isCompleted && getCompleted(item.id, total) > 0 ? '<span class="series-card-badge watching" title="En progreso">▶</span>' : ''}
          <button class="series-card-action" data-action="episodes" title="Gestionar episodios">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="6"/><line x1="17" y1="2" x2="17" y2="6"/><line x1="2" y1="7" x2="22" y2="7"/></svg>
          </button>
        </div>
        <div class="series-card-info">
          <div class="series-card-title">${escapeHtml(item.titulo || 'Sin título')}</div>
          ${item.tipo === 'serie' && total > 0 ? `
            <div class="series-card-progress"><div class="series-card-progress-fill" style="width:${percent}%"></div></div>
            <div class="series-card-status">${getStatusText(item)}</div>
          ` : ''}
          ${item.tipo === 'pelicula' ? '<div class="series-card-status">Película</div>' : ''}
        </div>
      </div>
    `;
  }

  function renderGrid() {
    const grid = page.querySelector('#seriesGrid');
    if (!grid) return;

    let filtered = [...catalog];
    if (searchTerm) filtered = filtered.filter(i => (i.titulo || '').toLowerCase().includes(searchTerm));
    if (currentFilter === 'serie') filtered = filtered.filter(i => i.tipo === 'serie');
    else if (currentFilter === 'pelicula') filtered = filtered.filter(i => i.tipo === 'pelicula');

    if (filtered.length === 0) {
      grid.innerHTML = `<div class="series-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="6"/><line x1="17" y1="2" x2="17" y2="6"/><line x1="2" y1="7" x2="22" y2="7"/></svg>
        <p>No hay contenido. Añade tu primera serie o película.</p>
      </div>`;
      return;
    }

    grid.innerHTML = filtered.map(cardHTML).join('');
  }

  function renderPodium() {
    const pGrid = page.querySelector('#podiumGrid');
    const pEmpty = page.querySelector('#podiumEmpty');
    if (!pGrid) return;

    const items = podioData[currentPodiumType] || [];
    const sorted = [...items].sort((a, b) => a.position - b.position);

    if (sorted.length === 0) {
      pGrid.innerHTML = '';
      if (pEmpty) pEmpty.style.display = 'block';
      return;
    }
    if (pEmpty) pEmpty.style.display = 'none';

    pGrid.innerHTML = sorted.map((item, idx) => {
      const rank = item.position;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
      return `
        <div class="series-podium-card">
          <div class="series-podium-rank">${medal}</div>
          <div class="series-podium-info">
            <div class="series-podium-title">${escapeHtml(item.titulo)}</div>
            <div class="series-podium-sub">Puesto #${rank}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function openViewModal(itemId) {
    const item = catalog.find(i => i.id === itemId);
    if (!item) return;
    const modal = page.querySelector('#viewModal');
    const total = getTotal(item);
    const prog = loadProgress(itemId);
    const watched = prog.watched || [];
    const hasVideo = !!item.videoUrl;

    modal.querySelector('#viewCover').src = item.portada || '';
    modal.querySelector('#viewCover').style.display = item.portada ? 'block' : 'none';
    modal.querySelector('#viewTitle').textContent = item.titulo || '—';
    modal.querySelector('#viewTipo').textContent = item.tipo === 'serie' ? 'Serie' : 'Película';

    // Player wrapper
    const pw = modal.querySelector('#playerWrapper');
    if (hasVideo) {
      pw.style.display = 'block';
      const vp = modal.querySelector('#videoPlayer');
      vp.src = item.videoUrl;
    } else {
      pw.style.display = 'none';
    }

    // Bulk actions
    const ba = modal.querySelector('#bulkActions');
    if (item.tipo === 'serie' && total > 0) {
      ba.style.display = 'flex';
    } else {
      ba.style.display = 'none';
    }

    // Web link
    const webLink = modal.querySelector('#viewWebLink');
    if (item.webUrl) {
      webLink.style.display = 'inline-flex';
      webLink.href = item.webUrl;
    } else {
      webLink.style.display = 'none';
    }

    // Episodes list
    const list = modal.querySelector('#viewEpisodiosList');
    if (item.tipo === 'serie' && total > 0) {
      const eps = generateEpisodes(total);
      list.innerHTML = eps.map(ep => {
        const isWatched = watched.includes(ep.num);
        return `
          <div class="ep-row ${isWatched ? 'is-watched' : ''}" data-num="${ep.num}">
            <button class="ep-toggle" data-num="${ep.num}" title="${isWatched ? 'Marcar no visto' : 'Marcar visto'}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="${isWatched ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
            <span class="ep-num">${ep.num}.</span>
            <span class="ep-title">${escapeHtml(ep.title)}</span>
            <span class="ep-status">${isWatched ? 'Visto' : ''}</span>
          </div>
        `;
      }).join('');
    } else {
      list.innerHTML = `<div class="ep-empty">${item.tipo === 'pelicula' ? 'Película — sin episodios' : 'No hay episodios configurados'}</div>`;
    }

    modal.style.display = 'flex';
    bindViewModalEvents(itemId);
  }

  // Helper: reemplaza un botón por su clon (elimina listeners viejos)
  function freshBtn(container, sel, handler) {
    const btn = container.querySelector(sel);
    if (!btn) return;
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);
    clone.addEventListener('click', handler);
  }

  function bindViewModalEvents(itemId) {
    const item = catalog.find(i => i.id === itemId);
    if (!item) return;
    const modal = page.querySelector('#viewModal');
    const total = getTotal(item);

    // Episode toggle (elementos dentro de #viewEpisodiosList, se reemplazan cada vez — seguro)
    modal.querySelectorAll('.ep-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const num = parseInt(btn.dataset.num);
        const prog = loadProgress(itemId);
        const watched = prog.watched || [];
        const idx = watched.indexOf(num);
        if (idx >= 0) watched.splice(idx, 1);
        else watched.push(num);
        saveProgressForItem(itemId, { ...prog, watched });
        renderGrid();
        openViewModal(itemId);
      });
    });

    // Mark all watched
    freshBtn(modal, '#markAllWatchedBtn', () => {
      if (total <= 0) return;
      const nums = [];
      for (let i = 1; i <= total; i++) nums.push(i);
      saveProgressForItem(itemId, { watched: nums });
      renderGrid();
      openViewModal(itemId);
      showToast('Todos marcados como vistos ✓', 'success');
    });

    // Unmark all
    freshBtn(modal, '#unmarkAllBtn', () => {
      saveProgressForItem(itemId, { watched: [] });
      renderGrid();
      openViewModal(itemId);
      showToast('Todos desmarcados ✓', 'info');
    });

    // Edit from view
    freshBtn(modal, '#viewEditBtn', () => {
      modal.style.display = 'none';
      openEditModal(itemId);
    });

    // Delete from view
    freshBtn(modal, '#viewDeleteBtn', () => {
      if (confirm(`¿Eliminar "${item.titulo}"?`)) {
        catalog = catalog.filter(i => i.id !== itemId);
        saveData();
        modal.style.display = 'none';
        renderGrid();
        showToast('Eliminado ✓', 'success');
      }
    });
  }

  function openEpisodeProgressModal(itemId) {
    const item = catalog.find(i => i.id === itemId);
    if (!item) return;
    const modal = page.querySelector('#episodeProgressModal');
    const total = getTotal(item);
    const prog = loadProgress(itemId);
    const watched = prog.watched || [];

    modal.querySelector('#epProgressTitle').textContent = item.titulo;

    if (total <= 0) {
      modal.querySelector('#epProgressList').innerHTML = '<div class="ep-empty">No hay episodios configurados.</div>';
    } else {
      const eps = generateEpisodes(total);
      modal.querySelector('#epProgressList').innerHTML = eps.map(ep => {
        const isWatched = watched.includes(ep.num);
        return `
          <div class="ep-progress-row ${isWatched ? 'is-watched' : ''}" data-num="${ep.num}">
            <label class="ep-check-label">
              <input type="checkbox" class="ep-check" data-num="${ep.num}" ${isWatched ? 'checked' : ''}>
              <span class="ep-check-text">${ep.num}. ${escapeHtml(ep.title)}</span>
            </label>
          </div>
        `;
      }).join('');

      // Bind checkboxes
      modal.querySelectorAll('.ep-check').forEach(cb => {
        cb.addEventListener('change', () => {
          const num = parseInt(cb.dataset.num);
          const prog2 = loadProgress(itemId);
          const w = prog2.watched || [];
          if (cb.checked) { if (!w.includes(num)) w.push(num); }
          else { const idx = w.indexOf(num); if (idx >= 0) w.splice(idx, 1); }
          saveProgressForItem(itemId, { ...prog2, watched: w });
          updateEpSummary();
          renderGrid();
        });
      });
    }

    modal.style.display = 'flex';

    function updateEpSummary() {
      const p = loadProgress(itemId);
      const w = p.watched || [];
      modal.querySelector('#epProgressSummary').textContent = `${w.length}/${total}`;
    }

    updateEpSummary();

    // Mark all
    freshBtn(modal, '#epMarkAllBtn', () => {
      const nums = [];
      for (let i = 1; i <= total; i++) nums.push(i);
      saveProgressForItem(itemId, { watched: nums });
      modal.querySelector('#epProgressList').querySelectorAll('.ep-check').forEach(cb => cb.checked = true);
      renderGrid();
      updateEpSummary();
    });

    // Unmark all
    freshBtn(modal, '#epUnmarkAllBtn', () => {
      saveProgressForItem(itemId, { watched: [] });
      modal.querySelector('#epProgressList').querySelectorAll('.ep-check').forEach(cb => cb.checked = false);
      renderGrid();
      updateEpSummary();
    });
  }

  function openEditModal(itemId) {
    const item = catalog.find(i => i.id === itemId);
    const modal = page.querySelector('#seriesModal');
    modal.querySelector('#editId').value = item ? itemId : '';
    modal.querySelector('#seriesModalTitle').textContent = item ? 'Editar contenido' : 'Añadir contenido';
    modal.querySelector('#fTitulo').value = item ? item.titulo : '';
    modal.querySelector('#fTipo').value = item ? item.tipo : 'serie';
    modal.querySelector('#fPortada').value = item ? (item.portada || '') : '';
    modal.querySelector('#fWeb').value = item ? (item.webUrl || '') : '';
    modal.querySelector('#fTotalEpisodios').value = item ? getTotal(item) : '0';
    modal.style.display = 'flex';
  }

  function render() {
    const seriesCount = catalog.filter(i => i.tipo === 'serie').length;
    const movieCount = catalog.filter(i => i.tipo === 'pelicula').length;

    page.innerHTML = `
      <div class="series-content">
        <div class="series-header">
          <div class="series-header-top">
            <h2>Series y Películas</h2>
            <div class="series-header-actions">
              <button class="btn-secondary btn-sm" id="addBtn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                Añadir
              </button>
              <button class="btn-danger btn-sm" id="deleteAllBtn" title="Eliminar todo">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
          <div class="series-toolbar">
            <div class="series-search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="series-search-icon"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" id="searchInput" placeholder="Buscar título..." class="series-search-input">
            </div>
            <div class="series-filter-chips" id="filterBtns">
              <button class="series-chip active" data-filter="todo">Todo (${seriesCount + movieCount})</button>
              <button class="series-chip" data-filter="serie">Series (${seriesCount})</button>
              <button class="series-chip" data-filter="pelicula">Películas (${movieCount})</button>
            </div>
          </div>
        </div>

        <div class="series-view-tabs">
          <button class="series-view-tab active" data-view="catalog">Catálogo</button>
          <button class="series-view-tab" data-view="podium">Podio</button>
        </div>

        <div id="seriesGrid" class="series-catalog-grid"></div>

        <!-- Podium section -->
        <div id="podiumSection" style="display:none;">
          <div class="series-podium-header">
            <h3>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 6 9 6 9"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 18 9 18 9"/><path d="M4 22h16"/><path d="M10 22V2h4v20"/></svg>
              Top 5
            </h3>
            <button class="btn-secondary btn-sm" id="editPodiumBtn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Editar
            </button>
          </div>
          <div class="series-podium-tabs">
            <button class="series-podium-tab active" data-podium="series">Series</button>
            <button class="series-podium-tab" data-podium="movies">Películas</button>
          </div>
          <div id="podiumGrid" class="series-podium-grid"></div>
          <div id="podiumEmpty" class="series-podium-empty" style="display:none;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 6 9 6 9"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 18 9 18 9"/><path d="M4 22h16"/><path d="M10 22V2h4v20"/></svg>
            <p>Aún no has elegido tu top 5. ¡Edita el podio!</p>
          </div>
        </div>
      </div>

      <!-- Add/Edit Modal -->
      <div class="modal-overlay" id="seriesModal" style="display:none;">
        <div class="modal-content modal-form">
          <button class="close-modal" id="closeSeriesModal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <h2 id="seriesModalTitle">Añadir contenido</h2>
          <input type="hidden" id="editId">
          <div class="form-group"><label>Título *</label><input type="text" id="fTitulo" class="form-input" required></div>
          <div class="form-group">
            <label>Tipo</label>
            <select id="fTipo" class="form-input">
              <option value="serie">Serie</option>
              <option value="pelicula">Película</option>
            </select>
          </div>
          <div class="form-group"><label>URL de portada</label><input type="url" id="fPortada" class="form-input" placeholder="https://..."></div>
          <div class="form-group"><label>URL web (JustWatch, oficial, etc.)</label><input type="url" id="fWeb" class="form-input" placeholder="https://..."></div>
          <div class="form-group"><label>Episodios totales (solo series)</label><input type="number" id="fTotalEpisodios" class="form-input" value="0" min="0"></div>
          <div class="form-actions">
            <button class="btn-secondary" id="cancelSeriesBtn">Cancelar</button>
            <button class="btn-primary" id="saveSeriesBtn">Guardar</button>
          </div>
        </div>
      </div>

      <!-- Podio editor modal -->
      <div class="modal-overlay" id="podiumEditModal" style="display:none;">
        <div class="modal-content modal-form">
          <button class="close-modal" id="closePodiumModal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <h2>Gestionar Podio</h2>
          <div id="podiumEditList"></div>
          <div class="form-actions">
            <button class="btn-secondary" id="cancelPodiumBtn">Cancelar</button>
            <button class="btn-primary" id="savePodiumBtn">Guardar</button>
          </div>
        </div>
      </div>

      <!-- View Modal (detalle con episodios) -->
      <div class="modal-overlay" id="viewModal" style="display:none;">
        <div class="modal-content modal-view">
          <button class="close-modal" id="closeViewBtn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <div class="view-header">
            <img id="viewCover" class="view-cover" src="" alt="" style="display:none;">
            <div class="view-info">
              <h2 id="viewTitle">—</h2>
              <span class="view-badge" id="viewTipo">Serie</span>
              <div class="view-actions">
                <a id="viewWebLink" href="#" target="_blank" rel="noopener" class="view-link-btn" style="display:none;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Ver web
                </a>
                <button class="view-action-btn" id="viewEditBtn" title="Editar">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="view-action-btn danger" id="viewDeleteBtn" title="Eliminar">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          </div>

          <div class="player-wrapper" id="playerWrapper" style="display:none;">
            <video id="videoPlayer" class="video-player" controls playsinline></video>
          </div>

          <div class="bulk-actions" id="bulkActions" style="display:none;">
            <button class="bulk-btn" id="markAllWatchedBtn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              Marcar todos vistos
            </button>
            <button class="bulk-btn" id="unmarkAllBtn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3l18 18"/><path d="M21 12A9 9 0 0 0 6.3 5.3"/><path d="M21 12A9 9 0 0 1 3 12"/></svg>
              Desmarcar todos
            </button>
          </div>

          <div class="episodes-list" id="viewEpisodiosList"></div>
        </div>
      </div>

      <!-- Episode Progress Modal -->
      <div class="modal-overlay" id="episodeProgressModal" style="display:none;">
        <div class="modal-content modal-form ep-progress-modal">
          <button class="close-modal" id="closeEpProgressBtn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <h2 id="epProgressTitle">Episodios</h2>
          <div class="ep-progress-actions">
            <button id="epMarkAllBtn" class="btn-secondary btn-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              Marcar todos
            </button>
            <button id="epUnmarkAllBtn" class="btn-secondary btn-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><square x="3" y="3" width="18" height="18" rx="2"/></svg>
              Desmarcar todos
            </button>
          </div>
          <div id="epProgressList" class="ep-progress-list"></div>
          <div class="ep-progress-footer">
            <span id="epProgressSummary">0/0</span>
            <button class="btn-primary btn-sm" id="closeEpProgressModalBtn">Cerrar</button>
          </div>
        </div>
      </div>

      <!-- Delete All Confirmation Modal -->
      <div class="modal-overlay" id="deleteConfirmModal" style="display:none;">
        <div class="modal-content modal-form">
          <button class="close-modal" id="closeConfirmBtn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <h2 class="series-delete-title">¿Eliminar todo?</h2>
          <p style="margin: 16px 0;color:var(--theme-text-secondary);">¿Estás seguro de que quieres eliminar TODAS las series y películas?<br>Esta acción no se puede deshacer.</p>
          <div class="form-actions">
            <button class="btn-secondary" id="cancelDeleteBtn">Cancelar</button>
            <button class="btn-danger" id="confirmDeleteBtn">Eliminar todo</button>
          </div>
        </div>
      </div>
    `;
  }

  render();
  renderGrid();

  // Bind events
  requestAnimationFrame(() => {
    // View toggle (catálogo / podio)
    page.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        page.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentView = btn.dataset.view;
        const isPodium = currentView === 'podium';
        page.querySelector('#seriesGrid').style.display = isPodium ? 'none' : '';
        page.querySelector('#podiumSection').style.display = isPodium ? 'block' : 'none';
        if (isPodium) renderPodium();
      });
    });

    // Filter
    page.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        page.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderGrid();
      });
    });

    // Search
    page.querySelector('#searchInput')?.addEventListener('input', (e) => {
      searchTerm = e.target.value.toLowerCase();
      renderGrid();
    });

    // Podium type tabs
    page.querySelectorAll('[data-podium]').forEach(btn => {
      btn.addEventListener('click', () => {
        page.querySelectorAll('[data-podium]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPodiumType = btn.dataset.podium;
        renderPodium();
      });
    });

    // Add button
    page.querySelector('#addBtn')?.addEventListener('click', () => {
      openEditModal(null);
    });

    // Save
    page.querySelector('#saveSeriesBtn')?.addEventListener('click', () => {
      const titulo = page.querySelector('#fTitulo').value.trim();
      if (!titulo) { showToast('El título es obligatorio', 'error'); return; }
      const editId = page.querySelector('#editId').value;
      const payload = {
        id: editId || 's_' + Date.now(),
        titulo,
        tipo: page.querySelector('#fTipo').value,
        portada: page.querySelector('#fPortada').value.trim(),
        webUrl: page.querySelector('#fWeb').value.trim(),
        totalEpisodios: parseInt(page.querySelector('#fTotalEpisodios').value) || 0,
        progreso: 0
      };
      if (editId) {
        const idx = catalog.findIndex(i => i.id === editId);
        if (idx >= 0) { catalog[idx] = { ...catalog[idx], ...payload }; }
      } else {
        catalog.push(payload);
      }
      saveData();
      renderGrid();
      page.querySelector('#seriesModal').style.display = 'none';
      showToast(editId ? 'Actualizado ✓' : 'Añadido ✓', 'success');
    });

    // Close modals
    page.querySelector('#closeSeriesModal')?.addEventListener('click', () => {
      page.querySelector('#seriesModal').style.display = 'none';
    });
    page.querySelector('#cancelSeriesBtn')?.addEventListener('click', () => {
      page.querySelector('#seriesModal').style.display = 'none';
    });
    page.querySelector('#closeViewBtn')?.addEventListener('click', () => {
      page.querySelector('#viewModal').style.display = 'none';
    });
    page.querySelector('#closeEpProgressBtn')?.addEventListener('click', () => {
      page.querySelector('#episodeProgressModal').style.display = 'none';
    });
    page.querySelector('#closeEpProgressModalBtn')?.addEventListener('click', () => {
      page.querySelector('#episodeProgressModal').style.display = 'none';
    });
    page.querySelector('#closeConfirmBtn')?.addEventListener('click', () => {
      page.querySelector('#deleteConfirmModal').style.display = 'none';
    });
    page.querySelector('#cancelDeleteBtn')?.addEventListener('click', () => {
      page.querySelector('#deleteConfirmModal').style.display = 'none';
    });

    // Click on card: view detail (except click on action buttons)
    page.querySelector('#seriesGrid')?.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('.series-card-action');
      if (actionBtn) {
        const card = actionBtn.closest('.series-card');
        if (card) openEpisodeProgressModal(card.dataset.id);
        return;
      }
      const card = e.target.closest('.series-card');
      if (!card) return;
      const id = card.dataset.id;
      const item = catalog.find(i => i.id === id);
      if (!item) return;
      openViewModal(id);
    });

    // Podium edit
    page.querySelector('#editPodiumBtn')?.addEventListener('click', () => {
      const list = page.querySelector('#podiumEditList');
      const tipo = currentPodiumType === 'series' ? 'serie' : 'pelicula';
      const filtered = catalog.filter(item => item.tipo === tipo);
      const podioItems = podioData[currentPodiumType] || [];

      if (filtered.length === 0) {
        list.innerHTML = `<div class="series-empty"><p>No hay ${currentPodiumType} en tu catálogo.</p></div>`;
      } else {
        list.innerHTML = filtered.map(item => {
          const current = podioItems.find(p => p.itemId === item.id);
          return `
            <div class="series-podium-row">
              <span class="series-podium-row-title">${escapeHtml(item.titulo)}</span>
              <select class="series-podium-select" data-item-id="${item.id}" data-titulo="${escapeHtml(item.titulo)}" data-portada="${escapeHtml(item.portada || '')}">
                <option value="">—</option>
                <option value="1" ${current?.position === 1 ? 'selected' : ''}>#1</option>
                <option value="2" ${current?.position === 2 ? 'selected' : ''}>#2</option>
                <option value="3" ${current?.position === 3 ? 'selected' : ''}>#3</option>
                <option value="4" ${current?.position === 4 ? 'selected' : ''}>#4</option>
                <option value="5" ${current?.position === 5 ? 'selected' : ''}>#5</option>
              </select>
            </div>
          `;
        }).join('');
      }
      page.querySelector('#podiumEditModal').style.display = 'flex';
    });

    page.querySelector('#savePodiumBtn')?.addEventListener('click', () => {
      const selects = page.querySelectorAll('.series-podium-select');
      const items = [];
      selects.forEach(sel => {
        if (sel.value) {
          items.push({
            itemId: sel.dataset.itemId,
            position: parseInt(sel.value),
            titulo: sel.dataset.titulo,
            portada: sel.dataset.portada
          });
        }
      });
      const positions = items.map(i => i.position);
      if (new Set(positions).size !== positions.length) {
        showToast('No puedes repetir posiciones', 'error');
        return;
      }
      podioData[currentPodiumType] = items;
      saveData();
      renderPodium();
      page.querySelector('#podiumEditModal').style.display = 'none';
      showToast('Podio guardado ✓', 'success');
    });

    page.querySelector('#closePodiumModal')?.addEventListener('click', () => {
      page.querySelector('#podiumEditModal').style.display = 'none';
    });
    page.querySelector('#cancelPodiumBtn')?.addEventListener('click', () => {
      page.querySelector('#podiumEditModal').style.display = 'none';
    });

    // Delete all
    page.querySelector('#deleteAllBtn')?.addEventListener('click', () => {
      page.querySelector('#deleteConfirmModal').style.display = 'flex';
    });

    page.querySelector('#confirmDeleteBtn')?.addEventListener('click', () => {
      catalog = [];
      podioData = { series: [], movies: [] };
      saveData();
      page.querySelector('#deleteConfirmModal').style.display = 'none';
      renderGrid();
      showToast('Todo eliminado ✓', 'info');
    });

    // Close modals on overlay click
    page.querySelectorAll('.modal-overlay').forEach(m => {
      m.addEventListener('click', (e) => {
        if (e.target === m) m.style.display = 'none';
      });
    });
  });

  return page;
}
