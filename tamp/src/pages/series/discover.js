/* ==========================================
   Videoteca Tamp — Descubrir
   Todo el contenido externo vive aquí. No importa nada solo por aparecer:
   solo se guarda cuando el usuario lo confirma.
   ========================================== */

import { escapeHtml } from '../../utils/escape.js';
import { icon } from '../../components/ui.js';
import {
  searchTmdbTitles,
  getTrendingTmdbTitles,
  getUpcomingTmdbTitles,
  discoverTmdbTitles,
  TMDB_GENRES
} from '../../services/tmdb.service.js';
import { state, findMatch, watchlistEntryFor } from './store.js';
import {
  externalCardHTML,
  skeletonCardsHTML,
  emptyHTML
} from './cards.js';

const TYPE_OPTIONS = [
  { id: 'todo', label: 'Todo' },
  { id: 'serie', label: 'Series' },
  { id: 'pelicula', label: 'Películas' }
];

function visibleGenres() {
  const tipo = state.discover.tipo;
  return TMDB_GENRES.filter(genre => genre.tipo === 'todo' || tipo === 'todo' || genre.tipo === tipo);
}

function filterByType(items) {
  const tipo = state.discover.tipo;
  if (tipo === 'todo') return items;
  return items.filter(item => item.tipo === tipo);
}

function resultsHTML() {
  const discover = state.discover;
  if (discover.loading) return skeletonCardsHTML(10);
  if (discover.error) {
    return `
      <div class="sx-error" role="alert">
        <h3>No se pudo cargar el catálogo</h3>
        <p>${escapeHtml(discover.error)}</p>
        <button type="button" class="sx-btn" data-retry>${icon('refresh', 16)} Reintentar</button>
      </div>
    `;
  }
  const items = filterByType(discover.items);
  if (!items.length) {
    const query = discover.q.trim();
    return emptyHTML({
      title: query ? `Sin resultados para «${query}»` : 'Nada que mostrar aquí',
      text: query ? 'Prueba con otro título o cambia de tipo.' : 'Prueba a cambiar de tendencia, género o tipo.'
    });
  }
  return `<div class="sx-grid sx-grid--discover">${items.map((title, index) => {
    const inLibrary = !!findMatch(title);
    const inWatchlist = !!watchlistEntryFor(title);
    return externalCardHTML(title, { inLibrary, inWatchlist, index });
  }).join('')}</div>`;
}

async function fetchDiscover() {
  const discover = state.discover;
  const query = discover.q.trim();
  const requestId = ++discover.requestId;
  discover.loading = true;
  discover.error = '';
  paintResults();
  try {
    let data;
    if (query.length >= 2) {
      data = await searchTmdbTitles(query);
    } else if (discover.genre) {
      if (discover.tipo === 'todo') {
        const [series, movies] = await Promise.all([
          discoverTmdbTitles('serie', discover.genre),
          discoverTmdbTitles('pelicula', discover.genre)
        ]);
        data = { results: [...(series.results || []), ...(movies.results || [])] };
      } else {
        data = await discoverTmdbTitles(discover.tipo, discover.genre);
      }
    } else if (discover.mode === 'upcoming') {
      data = await getUpcomingTmdbTitles();
    } else {
      data = await getTrendingTmdbTitles();
    }
    if (requestId !== discover.requestId) return;
    discover.items = Array.isArray(data?.results) ? data.results : [];
    discover.error = '';
  } catch (error) {
    if (requestId !== discover.requestId) return;
    discover.items = [];
    discover.error = error?.status === 503
      ? 'La búsqueda de TMDB todavía no está activada en el servidor.'
      : error?.message || 'No se pudo conectar con TMDB.';
  } finally {
    if (requestId === discover.requestId) {
      discover.loading = false;
      paintResults();
    }
  }
}

let resultsHost = null;

function paintResults() {
  if (!resultsHost || !resultsHost.isConnected) return;
  resultsHost.innerHTML = resultsHTML();
  bindResults();
}

function bindResults() {
  if (!resultsHost) return;
  const items = filterByType(state.discover.items);
  resultsHost.querySelectorAll('[data-external-index]').forEach(card => {
    const open = () => {
      const title = items[Number(card.dataset.externalIndex)];
      if (title) ctxRef?.openExternal(title);
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
    });
  });
  resultsHost.querySelector('[data-retry]')?.addEventListener('click', () => fetchDiscover());
}

let ctxRef = null;

export function renderDiscover(root, ctx) {
  ctxRef = ctx;
  const discover = state.discover;
  const filterCount = (discover.genre ? 1 : 0)
    + (discover.tipo !== 'todo' ? 1 : 0)
    + (!discover.genre && discover.mode !== 'trending' ? 1 : 0);
  root.innerHTML = `
    <div class="sx-discover">
      <header class="sx-screen-head">
        <div>
          <p class="sx-kicker">Descubrir</p>
          <h1 class="sx-title">Buscar fuera de casa</h1>
          <p class="sx-sub">Datos e imágenes de TMDB. Todo se guarda solo si tú quieres.</p>
        </div>
      </header>

      <label class="sx-search sx-search--big">
        ${icon('search', 17)}
        <input type="search" id="sxDiscoverSearch" placeholder="Buscar series y películas" autocomplete="off" value="${escapeHtml(discover.q)}" aria-label="Buscar en TMDB">
      </label>

      <details class="sx-filters sx-filters--discover"${filterCount ? ' open' : ''}>
        <summary class="sx-filters-head">
          ${icon('filter', 15)}
          <span class="sx-filters-title">Filtros</span>
          <span class="sx-filters-count" data-filter-count${filterCount ? '' : ' hidden'}>${filterCount}</span>
          <span class="sx-filters-chev">${icon('chev', 14)}</span>
        </summary>
        <div class="sx-filters-body">
          <div class="sx-discover-controls">
            <div class="sx-seg" role="group" aria-label="Fuente">
              <button type="button" class="${discover.mode === 'trending' && !discover.genre ? 'is-on' : ''}" data-disc-mode="trending">Tendencias</button>
              <button type="button" class="${discover.mode === 'upcoming' && !discover.genre ? 'is-on' : ''}" data-disc-mode="upcoming">Próximos estrenos</button>
            </div>
            <div class="sx-chips">
              ${TYPE_OPTIONS.map(option => `<button type="button" class="sx-chip${discover.tipo === option.id ? ' is-on' : ''}" data-disc-tipo="${option.id}">${option.label}</button>`).join('')}
            </div>
          </div>

          <div class="sx-genres" role="group" aria-label="Explorar por género">
            <button type="button" class="sx-genre${!discover.genre ? ' is-on' : ''}" data-disc-genre="">Todos</button>
            ${visibleGenres().map(genre => `<button type="button" class="sx-genre${discover.genre === genre.id ? ' is-on' : ''}" data-disc-genre="${genre.id}">${escapeHtml(genre.label)}</button>`).join('')}
          </div>
        </div>
      </details>

      <div id="sxDiscoverResults" class="sx-discover-results"></div>
      <p class="sx-attribution">Datos e imágenes proporcionados por TMDB.</p>
    </div>
  `;

  resultsHost = root.querySelector('#sxDiscoverResults');
  paintResults();

  const updateFilterBadge = () => {
    const count = (discover.genre ? 1 : 0)
      + (discover.tipo !== 'todo' ? 1 : 0)
      + (!discover.genre && discover.mode !== 'trending' ? 1 : 0);
    const badge = root.querySelector('[data-filter-count]');
    if (badge) {
      badge.textContent = String(count);
      badge.hidden = count === 0;
    }
  };

  const input = root.querySelector('#sxDiscoverSearch');
  let timer = null;
  input?.addEventListener('input', () => {
    discover.q = input.value;
    clearTimeout(timer);
    clearTimeout(discover.timer);
    timer = setTimeout(() => fetchDiscover(), discover.q.trim().length >= 2 ? 350 : 0);
    discover.timer = timer;
  });

  root.querySelectorAll('[data-disc-mode]').forEach(button => {
    button.addEventListener('click', () => {
      discover.mode = button.dataset.discMode;
      discover.genre = '';
      discover.q = '';
      if (input) input.value = '';
      root.querySelectorAll('[data-disc-mode]').forEach(other => other.classList.toggle('is-on', other === button));
      root.querySelectorAll('[data-disc-genre]').forEach(other => other.classList.toggle('is-on', other.dataset.discGenre === ''));
      updateFilterBadge();
      fetchDiscover();
    });
  });

  root.querySelectorAll('[data-disc-tipo]').forEach(button => {
    button.addEventListener('click', () => {
      discover.tipo = button.dataset.discTipo;
      root.querySelectorAll('[data-disc-tipo]').forEach(other => other.classList.toggle('is-on', other === button));
      // Si el género elegido no aplica al nuevo tipo, se limpia.
      if (discover.genre && !visibleGenres().some(genre => genre.id === discover.genre)) {
        discover.genre = '';
        renderDiscover(root, ctx);
        return;
      }
      if (discover.genre) fetchDiscover();
      else paintResults();
      updateFilterBadge();
      const genres = root.querySelector('.sx-genres');
      if (genres) {
        genres.innerHTML = `<button type="button" class="sx-genre${!discover.genre ? ' is-on' : ''}" data-disc-genre="">Todos</button>${visibleGenres().map(genre => `<button type="button" class="sx-genre${discover.genre === genre.id ? ' is-on' : ''}" data-disc-genre="${genre.id}">${escapeHtml(genre.label)}</button>`).join('')}`;
        bindGenres(genres);
      }
    });
  });

  const bindGenres = host => {
    host.querySelectorAll('[data-disc-genre]').forEach(button => {
      button.addEventListener('click', () => {
        discover.genre = button.dataset.discGenre;
        discover.q = '';
        if (input) input.value = '';
        host.querySelectorAll('[data-disc-genre]').forEach(other => other.classList.toggle('is-on', other === button));
        updateFilterBadge();
        fetchDiscover();
      });
    });
  };
  bindGenres(root.querySelector('.sx-genres'));

  // Primera carga (y reintento tras cambios de pestaña): solo si no hay datos.
  if (!discover.items.length && !discover.loading) fetchDiscover();
}
