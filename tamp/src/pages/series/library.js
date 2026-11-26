/* ==========================================
   Videoteca Tamp — Biblioteca
   Solo títulos guardados. Separación explícita entre importados y manuales.
   ========================================== */

import { escapeHtml } from '../../utils/escape.js';
import { icon } from '../../components/ui.js';
import {
  getItemStatus,
  getProgressPosition,
  isImported,
  normalizeSeriesText,
  getOrigin
} from '../../services/seriesData.js';
import { state, isAdmin, toggleFavorite } from './store.js';
import {
  gridCardHTML,
  libraryRowHTML,
  emptyHTML,
  sectionHeadHTML
} from './cards.js';

const TYPE_FILTERS = [
  { id: 'todo', label: 'Todas' },
  { id: 'serie', label: 'Series' },
  { id: 'pelicula', label: 'Películas' }
];

const STATUS_FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'sin_empezar', label: 'Sin empezar' },
  { id: 'pendiente', label: 'Pendiente' },
  { id: 'en_curso', label: 'En curso' },
  { id: 'terminada', label: 'Terminada' },
  { id: 'abandonada', label: 'Abandonada' }
];

const ORIGIN_FILTERS = [
  { id: 'todas', label: 'Todas' },
  { id: 'api', label: 'Importados' },
  { id: 'manual', label: 'Manuales' }
];

const SORTS = [
  { id: 'recent', label: 'Añadidos recientemente' },
  { id: 'az', label: 'Título A–Z' },
  { id: 'progress', label: 'Más avanzados' },
  { id: 'rating', label: 'Mejor valorados' },
  { id: 'year', label: 'Más nuevos' }
];

function applyFilters(catalog) {
  const { q, tipo, estado, origen, favoritas, sort } = state.library;
  const query = normalizeSeriesText(q);
  let list = catalog.filter(item => {
    if (tipo !== 'todo' && item.tipo !== tipo) return false;
    if (estado !== 'todos' && getItemStatus(item) !== estado) return false;
    if (origen !== 'todas' && getOrigin(item) !== origen) return false;
    if (favoritas && !state.favorites.has(item.id)) return false;
    if (!query) return true;
    const haystack = [
      item.titulo,
      item.descripcion,
      item.anio,
      ...(Array.isArray(item.generos) ? item.generos : [])
    ].map(normalizeSeriesText).join(' ');
    return haystack.includes(query);
  });

  const sorters = {
    recent: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
    az: (a, b) => String(a.titulo || '').localeCompare(String(b.titulo || ''), 'es', { sensitivity: 'base' }),
    progress: (a, b) => getProgressPosition(b).percent - getProgressPosition(a).percent,
    rating: (a, b) => (Number(b.valoracion) || 0) - (Number(a.valoracion) || 0),
    year: (a, b) => (parseInt(b.anio, 10) || 0) - (parseInt(a.anio, 10) || 0)
  };
  list = [...list].sort(sorters[sort] || sorters.recent);
  return list;
}

function cardsOrRows(list) {
  if (!list.length) return '';
  return state.library.view === 'list'
    ? `<div class="sx-rows">${list.map(item => libraryRowHTML(item)).join('')}</div>`
    : `<div class="sx-grid">${list.map(item => gridCardHTML(item)).join('')}</div>`;
}

function groupsHTML(list) {
  const imported = list.filter(item => isImported(item));
  const manual = list.filter(item => !isImported(item));

  if (state.library.origen === 'api') {
    return imported.length
      ? `<div class="sx-group">${cardsOrRows(imported)}</div>`
      : emptyHTML({ title: 'Sin títulos importados con estos filtros', text: 'Prueba a quitar el filtro de estado o de origen.' });
  }
  if (state.library.origen === 'manual') {
    return manual.length
      ? `<div class="sx-group">${cardsOrRows(manual)}</div>`
      : emptyHTML({ title: 'Sin títulos manuales con estos filtros', text: 'Aquí quedan las fichas creadas a mano que aún no tienen origen API.' });
  }

  const parts = [];
  if (imported.length) {
    parts.push(`
      <div class="sx-group">
        ${sectionHeadHTML('Importados del catálogo', { count: imported.length, hint: 'Fichas que vienen de TMDB.' })}
        ${cardsOrRows(imported)}
      </div>
    `);
  }
  if (manual.length) {
    parts.push(`
      <div class="sx-group">
        ${sectionHeadHTML('Añadidos manualmente', { count: manual.length, hint: 'Fichas propias, también editables desde la API.' })}
        ${cardsOrRows(manual)}
      </div>
    `);
  }
  if (!parts.length) {
    return emptyHTML({
      title: state.catalog.length ? 'Nada coincide con los filtros' : 'La biblioteca está vacía',
      text: state.catalog.length
        ? 'Limpia la búsqueda o cambia los filtros para volver a verlo todo.'
        : 'Añade un título manual o impórtalo desde Descubrir.',
      actionLabel: state.catalog.length ? 'Limpiar filtros' : '',
      actionAttr: 'data-clear-filters'
    });
  }
  return parts.join('');
}

function chipsHTML(items, active, attr) {
  return items.map(item => `
    <button type="button" class="sx-chip${active === item.id ? ' is-on' : ''}" ${attr}="${item.id}">${escapeHtml(item.label)}</button>
  `).join('');
}

function activeFilterCount() {
  return (state.library.tipo !== 'todo' ? 1 : 0)
    + (state.library.estado !== 'todos' ? 1 : 0)
    + (state.library.origen !== 'todas' ? 1 : 0);
}

export function renderLibrary(root, ctx) {
  const total = state.catalog.length;
  const filterCount = activeFilterCount();
  root.innerHTML = `
    <div class="sx-library">
      <header class="sx-screen-head">
        <div>
          <p class="sx-kicker">Biblioteca</p>
          <h1 class="sx-title">Todo lo guardado</h1>
          <p class="sx-sub">${total} ${total === 1 ? 'título' : 'títulos'} · ${state.favorites.size} ${state.favorites.size === 1 ? 'favorito' : 'favoritos'}</p>
        </div>
        ${isAdmin() ? `<div class="sx-head-actions">
          <button type="button" class="sx-icon-btn" data-open-link aria-label="Vincular título manual con la API" title="Vincular con la API">${icon('link', 18)}</button>
          <button type="button" class="sx-icon-btn sx-icon-btn--accent" data-add-title aria-label="Añadir contenido" title="Añadir contenido">${icon('plus', 18)}</button>
        </div>` : ''}
      </header>

      <div class="sx-toolbar">
        <label class="sx-search">
          ${icon('search', 16)}
          <input type="search" id="sxLibrarySearch" placeholder="Buscar por título, género o año" autocomplete="off" value="${escapeHtml(state.library.q)}" aria-label="Buscar en la biblioteca">
          ${state.library.q ? `<button type="button" class="sx-search-clear" data-clear-search aria-label="Limpiar búsqueda">${icon('x', 14)}</button>` : ''}
        </label>

        <details class="sx-filters"${filterCount ? ' open' : ''}>
          <summary class="sx-filters-head">
            ${icon('filter', 15)}
            <span class="sx-filters-title">Filtros</span>
            <span class="sx-filters-count" data-filter-count${filterCount ? '' : ' hidden'}>${filterCount}</span>
            <span class="sx-filters-chev">${icon('chev', 14)}</span>
          </summary>
          <div class="sx-filters-body">
            <div class="sx-filter-block">
              <span class="sx-filter-label">Tipo</span>
              <div class="sx-chips">${chipsHTML(TYPE_FILTERS, state.library.tipo, 'data-lib-tipo')}</div>
            </div>
            <div class="sx-filter-block">
              <span class="sx-filter-label">Estado</span>
              <div class="sx-chips sx-chips--scroll">${chipsHTML(STATUS_FILTERS, state.library.estado, 'data-lib-estado')}</div>
            </div>
            <div class="sx-filter-block">
              <span class="sx-filter-label">Origen</span>
              <div class="sx-chips">${chipsHTML(ORIGIN_FILTERS, state.library.origen, 'data-lib-origen')}</div>
            </div>
          </div>
        </details>

        <div class="sx-toolbar-row">
          <button type="button" class="sx-chip sx-chip--fav${state.library.favoritas ? ' is-on' : ''}" data-lib-fav aria-pressed="${state.library.favoritas}">${icon('star', 13)} Solo favoritos</button>
          <label class="sx-select">
            <span class="sr-only">Ordenar</span>
            <select id="sxLibrarySort">
              ${SORTS.map(sort => `<option value="${sort.id}"${state.library.sort === sort.id ? ' selected' : ''}>${sort.label}</option>`).join('')}
            </select>
          </label>
          <div class="sx-view-toggle" role="group" aria-label="Vista">
            <button type="button" class="${state.library.view === 'grid' ? 'is-on' : ''}" data-lib-view="grid" aria-label="Cuadrícula">${icon('grid', 16)}</button>
            <button type="button" class="${state.library.view === 'list' ? 'is-on' : ''}" data-lib-view="list" aria-label="Lista compacta">${icon('list', 16)}</button>
          </div>
        </div>
      </div>

      ${isAdmin() ? `<div class="sx-admin-strip">
        <span>Gestión de títulos</span>
        <button type="button" class="sx-link" data-open-link>Vincular con API</button>
        <button type="button" class="sx-link" data-open-manage>Duplicados y pendientes</button>
      </div>` : ''}

      <div id="sxLibraryResults" class="sx-library-results"></div>
    </div>
  `;

  const results = root.querySelector('#sxLibraryResults');
  const searchInput = root.querySelector('#sxLibrarySearch');

  const paint = () => {
    results.innerHTML = groupsHTML(applyFilters(state.catalog));
    bindResults();
  };

  const bindResults = () => {
    results.querySelectorAll('[data-open]').forEach(element => {
      const open = () => ctx.openDetail(element.dataset.open);
      element.addEventListener('click', event => {
        if (event.target.closest('button')) return;
        open();
      });
      element.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
      });
    });
    results.querySelectorAll('[data-fav]').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        toggleFavorite(button.dataset.fav);
        const card = button.closest('.sx-card');
        const isOn = state.favorites.has(button.dataset.fav);
        button.classList.toggle('is-on', isOn);
        button.setAttribute('aria-pressed', String(isOn));
        if (card) card.classList.toggle('is-fav', isOn);
      });
    });
    results.querySelector('[data-clear-filters]')?.addEventListener('click', () => {
      state.library = { ...state.library, q: '', tipo: 'todo', estado: 'todos', origen: 'todas', favoritas: false };
      renderLibrary(root, ctx);
    });
  };

  // Búsqueda (debounce corto: filtra en memoria, no gasta red).
  let searchTimer = null;
  searchInput?.addEventListener('input', () => {
    state.library.q = searchInput.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      paint();
      const clear = root.querySelector('[data-clear-search]');
      const wrap = searchInput.closest('.sx-search');
      if (state.library.q && !clear) {
        wrap?.insertAdjacentHTML('beforeend', `<button type="button" class="sx-search-clear" data-clear-search aria-label="Limpiar búsqueda">${icon('x', 14)}</button>`);
        wrap?.querySelector('[data-clear-search]')?.addEventListener('click', clearSearch);
      } else if (!state.library.q && clear) {
        clear.remove();
      }
    }, 140);
  });

  const clearSearch = () => {
    state.library.q = '';
    searchInput.value = '';
    root.querySelector('[data-clear-search]')?.remove();
    paint();
    searchInput.focus();
  };
  root.querySelector('[data-clear-search]')?.addEventListener('click', clearSearch);

  // Filtros
  const bindChips = (attr, key) => {
    root.querySelectorAll(`[${attr}]`).forEach(button => {
      button.addEventListener('click', () => {
        state.library[key] = button.getAttribute(attr);
        root.querySelectorAll(`[${attr}]`).forEach(other => other.classList.toggle('is-on', other === button));
        const count = activeFilterCount();
        const badge = root.querySelector('[data-filter-count]');
        if (badge) {
          badge.textContent = String(count);
          badge.hidden = count === 0;
        }
        paint();
      });
    });
  };
  bindChips('data-lib-tipo', 'tipo');
  bindChips('data-lib-estado', 'estado');
  bindChips('data-lib-origen', 'origen');

  root.querySelector('[data-lib-fav]')?.addEventListener('click', button => {
    state.library.favoritas = !state.library.favoritas;
    button.currentTarget.classList.toggle('is-on', state.library.favoritas);
    button.currentTarget.setAttribute('aria-pressed', String(state.library.favoritas));
    paint();
  });

  root.querySelector('#sxLibrarySort')?.addEventListener('change', event => {
    state.library.sort = event.target.value;
    paint();
  });

  root.querySelectorAll('[data-lib-view]').forEach(button => {
    button.addEventListener('click', () => {
      state.library.view = button.dataset.libView;
      root.querySelectorAll('[data-lib-view]').forEach(other => other.classList.toggle('is-on', other === button));
      paint();
    });
  });

  root.querySelectorAll('[data-add-title]').forEach(button => button.addEventListener('click', () => ctx.openEditor(null)));
  root.querySelectorAll('[data-open-link]').forEach(button => button.addEventListener('click', () => ctx.openLinkTool()));
  root.querySelectorAll('[data-open-manage]').forEach(button => button.addEventListener('click', () => ctx.openManageTool()));

  paint();
}

/** Número de títulos totales por origen (para otras vistas). */
export function originCounts() {
  return state.catalog.reduce((acc, item) => {
    const origin = getOrigin(item);
    acc[origin] = (acc[origin] || 0) + 1;
    return acc;
  }, { api: 0, manual: 0 });
}
