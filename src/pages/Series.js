/**
 * Series Page — Series/Movies catalog with progress, podio, and CRUD
 */
(function() {
  const STORAGE_KEY = 'personalHub.seriesCatalog';
  const PODIO_KEY = 'personalHub.seriesPodio';
  const PROGRESS_KEY = 'personalHub.seriesProgress';

  let catalog = [];
  let podioData = { series: [], movies: [] };
  let currentFilter = 'todo';
  let searchTerm = '';
  let currentPodiumType = 'series';

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

  function getTotal(item) {
    return item.totalEpisodios || (item.episodios ? item.episodios.length : 0);
  }

  function cardHTML(item) {
    const total = getTotal(item);
    const prog = item.progreso || 0;
    const percent = total > 0 ? (prog / total) * 100 : 0;
    const isCompleted = total > 0 && prog >= total;
    const hasCover = !!item.portada;
    const firstLetter = item.titulo ? item.titulo[0] : '?';

    return `
      <div class="movie-card" data-id="${Utils.escapeHtml(item.id)}" data-tipo="${item.tipo}">
        <div class="card-cover">
          ${hasCover
            ? `<img src="${Utils.escapeHtml(item.portada)}" alt="${Utils.escapeHtml(item.titulo)}" class="card-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : ''
          }
          <div class="card-cover-fallback" style="${hasCover ? 'display:none' : 'display:flex'}">${Utils.escapeHtml(firstLetter)}</div>
          ${isCompleted ? '<div class="card-badge completed">✓</div>' : ''}
          ${!isCompleted && prog > 0 ? '<div class="card-badge watching">▶</div>' : ''}
        </div>
        <div class="movie-info">
          <div class="card-title">${Utils.escapeHtml(item.titulo || 'Sin título')}</div>
          ${item.tipo === 'serie' && total > 0 ? `
            <div class="card-progress"><div class="card-progress-fill" style="width:${percent}%"></div></div>
          ` : ''}
        </div>
      </div>
    `;
  }

  function renderGrid() {
    const grid = document.getElementById('seriesGrid');
    const empty = document.getElementById('seriesEmpty');
    if (!grid) return;

    let filtered = [...catalog];
    if (searchTerm) filtered = filtered.filter(i => (i.titulo || '').toLowerCase().includes(searchTerm));
    if (currentFilter === 'serie') filtered = filtered.filter(i => i.tipo === 'serie');
    else if (currentFilter === 'pelicula') filtered = filtered.filter(i => i.tipo === 'pelicula');

    if (filtered.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="display:flex;flex-direction:column;align-items:center;padding:60px;color:var(--umbra-ash);">
        <i data-lucide="clapperboard" style="width:48px;height:48px;margin-bottom:16px;"></i>
        <p>No hay contenido. Añade tu primera serie o película.</p>
      </div>`;
      return;
    }

    grid.innerHTML = filtered.map(cardHTML).join('');
  }

  function renderPodium() {
    const pGrid = document.getElementById('podiumGrid');
    const pEmpty = document.getElementById('podiumEmpty');
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
        <div class="podium-card">
          <div class="podium-rank podium-rank-${rank}">${medal}</div>
          <div class="podium-card-info">
            <div class="podium-card-title">${Utils.escapeHtml(item.titulo)}</div>
            <div class="podium-card-sub">Puesto #${rank}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  const page = {
    name: 'series',

    mount(container) {
      loadData();
      container.innerHTML = this.render();
      this.afterMount(container);
    },

    render() {
      const seriesCount = catalog.filter(i => i.tipo === 'serie').length;
      const movieCount = catalog.filter(i => i.tipo === 'pelicula').length;

      return `
        <div class="series-page">
          <div class="cine-header">
            <div class="cine-header-top">
              <h2 style="margin:0;"><i data-lucide="clapperboard"></i> Series y Películas</h2>
              <button class="btn-secondary btn-sm" id="addBtn"><i data-lucide="plus"></i> Añadir</button>
            </div>
            <div class="cine-header-bar">
              <div class="search-wrapper">
                <i data-lucide="search" class="search-icon"></i>
                <input type="text" id="searchInput" class="form-input" placeholder="Buscar título..." style="padding-left:36px;border-radius:40px;">
              </div>
              <div class="filter-chips" id="filterBtns">
                <button class="filter-chip active" data-filter="todo">Todo (${seriesCount + movieCount})</button>
                <button class="filter-chip" data-filter="serie">Series (${seriesCount})</button>
                <button class="filter-chip" data-filter="pelicula">Películas (${movieCount})</button>
              </div>
            </div>
          </div>

          <div class="cine-view-tabs" style="display:flex;gap:8px;margin-bottom:20px;">
            <button class="sub-tab active" data-view="catalog">Catálogo</button>
            <button class="sub-tab" data-view="podium">Podio</button>
          </div>

          <div id="seriesGrid" class="catalog-grid"></div>

          <!-- Podium section -->
          <div id="podiumSection" style="display:none;">
            <div class="podium-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
              <h3><i data-lucide="trophy"></i> Top 5</h3>
              <button class="btn-secondary btn-sm" id="editPodiumBtn"><i data-lucide="pencil"></i> Editar</button>
            </div>
            <div class="podium-tabs" style="display:flex;gap:8px;margin-bottom:16px;">
              <button class="sub-tab active" data-podium="series">Series</button>
              <button class="sub-tab" data-podium="movies">Películas</button>
            </div>
            <div id="podiumGrid" class="podium-grid"></div>
            <div id="podiumEmpty" class="podium-empty" style="display:none;text-align:center;padding:40px;color:var(--umbra-ash);">
              <i data-lucide="trophy" style="width:32px;height:32px;margin-bottom:12px;"></i>
              <p>Aún no has elegido tu top 5. ¡Edita el podio!</p>
            </div>
          </div>
        </div>

        <!-- Add/Edit Modal -->
        <div class="modal-overlay" id="seriesModal" style="display:none;">
          <div class="modal-content modal-form" style="width:min(92vw,560px);padding:28px;">
            <button class="close-modal" id="closeSeriesModal">&times;</button>
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
            <div class="form-group"><label>Episodios totales (solo series)</label><input type="number" id="fTotalEpisodios" class="form-input" value="0" min="0"></div>
            <div class="form-actions" style="display:flex;gap:12px;justify-content:flex-end;margin-top:24px;">
              <button class="btn-secondary" id="cancelSeriesBtn">Cancelar</button>
              <button class="btn-primary" id="saveSeriesBtn">Guardar</button>
            </div>
          </div>
        </div>

        <!-- Podio editor modal -->
        <div class="modal-overlay" id="podiumEditModal" style="display:none;">
          <div class="modal-content modal-form" style="width:min(92vw,560px);padding:28px;">
            <button class="close-modal" id="closePodiumModal">&times;</button>
            <h2>Gestionar Podio</h2>
            <div id="podiumEditList"></div>
            <div class="form-actions" style="display:flex;gap:12px;justify-content:flex-end;margin-top:24px;">
              <button class="btn-secondary" id="cancelPodiumBtn">Cancelar</button>
              <button class="btn-primary" id="savePodiumBtn">Guardar</button>
            </div>
          </div>
        </div>
      `;
    },

    afterMount(container) {
      renderGrid();

      // View toggle
      container.querySelectorAll('[data-view]').forEach(btn => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const isPodium = btn.dataset.view === 'podium';
          document.getElementById('seriesGrid').style.display = isPodium ? 'none' : '';
          document.getElementById('podiumSection').style.display = isPodium ? 'block' : 'none';
          if (isPodium) renderPodium();
        });
      });

      // Filter
      container.querySelectorAll('[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          currentFilter = btn.dataset.filter;
          renderGrid();
        });
      });

      // Search
      document.getElementById('searchInput')?.addEventListener('input', (e) => {
        searchTerm = e.target.value.toLowerCase();
        renderGrid();
      });

      // Podium type tabs
      container.querySelectorAll('[data-podium]').forEach(btn => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('[data-podium]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          currentPodiumType = btn.dataset.podium;
          renderPodium();
        });
      });

      // Add button
      document.getElementById('addBtn')?.addEventListener('click', () => {
        document.getElementById('editId').value = '';
        document.getElementById('seriesModalTitle').textContent = 'Añadir contenido';
        document.getElementById('fTitulo').value = '';
        document.getElementById('fTipo').value = 'serie';
        document.getElementById('fPortada').value = '';
        document.getElementById('fTotalEpisodios').value = '0';
        document.getElementById('seriesModal').style.display = 'flex';
      });

      // Save
      document.getElementById('saveSeriesBtn')?.addEventListener('click', () => {
        const titulo = document.getElementById('fTitulo').value.trim();
        if (!titulo) { Utils.showToast('El título es obligatorio', true); return; }
        const editId = document.getElementById('editId').value;
        const payload = {
          id: editId || 's_' + Date.now(),
          titulo,
          tipo: document.getElementById('fTipo').value,
          portada: document.getElementById('fPortada').value.trim(),
          totalEpisodios: parseInt(document.getElementById('fTotalEpisodios').value) || 0,
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
        document.getElementById('seriesModal').style.display = 'none';
        Utils.showToast(editId ? 'Actualizado ✓' : 'Añadido ✓');
      });

      // Close modals
      document.getElementById('closeSeriesModal')?.addEventListener('click', () => {
        document.getElementById('seriesModal').style.display = 'none';
      });
      document.getElementById('cancelSeriesBtn')?.addEventListener('click', () => {
        document.getElementById('seriesModal').style.display = 'none';
      });

      // Click on card to edit/delete
      document.getElementById('seriesGrid')?.addEventListener('click', (e) => {
        const card = e.target.closest('.movie-card');
        if (!card) return;
        const id = card.dataset.id;
        const item = catalog.find(i => i.id === id);
        if (!item) return;

        if (e.target.closest('.card-cover') && !e.target.closest('.card-badge')) {
          // Quick action: toggle progress
          item.progreso = item.progreso > 0 ? 0 : (getTotal(item) || 1);
          saveData();
          renderGrid();
          return;
        }

        // Show context menu with edit/delete
        const action = confirm(`¿Qué quieres hacer con "${item.titulo}"?\n\nOK = Editar\nCancelar = Eliminar`);
        if (action) {
          // Edit
          document.getElementById('editId').value = id;
          document.getElementById('seriesModalTitle').textContent = 'Editar contenido';
          document.getElementById('fTitulo').value = item.titulo;
          document.getElementById('fTipo').value = item.tipo;
          document.getElementById('fPortada').value = item.portada || '';
          document.getElementById('fTotalEpisodios').value = getTotal(item) || '';
          document.getElementById('seriesModal').style.display = 'flex';
        } else {
          if (confirm(`¿Eliminar "${item.titulo}"?`)) {
            catalog = catalog.filter(i => i.id !== id);
            saveData();
            renderGrid();
            Utils.showToast('Eliminado ✓');
          }
        }
      });

      // Podium edit
      document.getElementById('editPodiumBtn')?.addEventListener('click', () => {
        const list = document.getElementById('podiumEditList');
        const tipo = currentPodiumType === 'series' ? 'serie' : 'pelicula';
        const filtered = catalog.filter(item => item.tipo === tipo);
        const podioItems = podioData[currentPodiumType] || [];

        if (filtered.length === 0) {
          list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--umbra-ash);"><p>No hay ${currentPodiumType} en tu catálogo.</p></div>`;
        } else {
          list.innerHTML = filtered.map(item => {
            const current = podioItems.find(p => p.itemId === item.id);
            return `
              <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                <span style="flex:1;">${Utils.escapeHtml(item.titulo)}</span>
                <select class="form-input podium-select" style="width:80px;" data-item-id="${item.id}" data-titulo="${Utils.escapeHtml(item.titulo)}" data-portada="${Utils.escapeHtml(item.portada || '')}">
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
        document.getElementById('podiumEditModal').style.display = 'flex';
      });

      document.getElementById('savePodiumBtn')?.addEventListener('click', () => {
        const selects = document.querySelectorAll('.podium-select');
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
          Utils.showToast('No puedes repetir posiciones', true);
          return;
        }
        podioData[currentPodiumType] = items;
        saveData();
        renderPodium();
        document.getElementById('podiumEditModal').style.display = 'none';
        Utils.showToast('Podio guardado ✓');
      });

      document.getElementById('closePodiumModal')?.addEventListener('click', () => {
        document.getElementById('podiumEditModal').style.display = 'none';
      });
      document.getElementById('cancelPodiumBtn')?.addEventListener('click', () => {
        document.getElementById('podiumEditModal').style.display = 'none';
      });

      // Close modals on overlay click
      document.querySelectorAll('.modal-overlay').forEach(m => {
        m.addEventListener('click', (e) => {
          if (e.target === m) m.style.display = 'none';
        });
      });
    }
  };

  if (window.AppRouter) {
    AppRouter.register('series', () => page);
  }
})();
