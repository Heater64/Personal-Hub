/* ==========================================
   Personal Hub v3 — Series & Movies (Streaming)
   Inicio con hero destacado + carruseles ·
   Catálogo grid 2:3 · Detalle con temporadas ·
   Top 5 editable · Búsqueda agrupada ·
   Admin completo en la propia sección
   ========================================== */

import '../styles/series.css';
import { showToast } from '../components/Toast.js';
import { escapeHtml } from '../utils/escape.js';
import { userStore } from '../stores/user.store.js';
import {
  loadSharedWatchlist,
  saveSharedWatchlist,
  toggleInWatchlist,
} from '../services/pro.service.js';
import { onContentChange } from '../services/realtime.service.js';
import {
  loadCatalog, saveCatalog, loadPodio, savePodio,
  loadFavorites, saveFavorites, loadProgressFor, saveProgressFor,
  createId, getSeasons, getTotal, getCompletedCount, getPercent,
  getStatusText, detectGenres, typeLabel, deleteCatalogItem, playUrl,
  hydrateProgress, isMovieWatched, toggleMovieWatched
} from '../services/seriesData.js';
import { seasonEditorHTML, collectSeasons, emptySeasonHTML, bindSeasonEditorEvents } from '../services/seriesEditor.js';
import { isValidUrlField } from '../utils/format.js';
import { searchTmdbTitles, getTrendingTmdbTitles, getUpcomingTmdbTitles } from '../services/tmdb.service.js';

let page = null;                       // elemento raíz (asignado en SeriesPage)
let catalog = [];
let podioData = { series: [], movies: [] };
let favorites = new Set();
let currentFilter = 'todo';
let currentSort = 'recent';
let searchTerm = '';
let currentView = 'home';           // home | catalog | top5
let currentDetailId = null;
let currentTopType = 'series';      // series | movies
const collapsedDetailSeasons = new Set(); // índices de temporada colapsadas en el detalle

// Hero rotatorio: pool de títulos + temporizador de 10s
let heroTimer = null;
let heroIndex = 0;
let heroPool = [];
let heroMode = 'random';            // 'random' | 'continue' (Seguir viendo)
let tmdbItems = [];
let tmdbLoading = true;
let tmdbError = '';
let tmdbQuery = '';
let tmdbMode = 'trending';
let tmdbRequestId = 0;
let tmdbSearchTimer = null;

// ==========================================
// CARGA / PERSISTENCIA (delegada a seriesData)
// ==========================================

async function loadData() {
  // Catálogo COMPARTIDO (Supabase): ambos usuarios ven el mismo.
  catalog = await loadCatalog();
  // Progreso, favoritas y Top 5 por cuenta: lo hecho en otro dispositivo llega
  // antes de pintar (por eso se hidrata antes de leer favoritas y podio).
  await hydrateProgress().catch(() => { /* sin red: se queda lo local */ });
  podioData = loadPodio();
  favorites = loadFavorites();
}

async function saveData() { await saveCatalog(catalog); }
function savePodioData() { savePodio(podioData); }
function saveFavs() { saveFavorites(favorites); }

function getFeatured() { return catalog.find(i => i.destacado) || catalog.find(i => i.banner) || catalog[0] || null; }

// ==========================================
// CARD (portada 2:3, mínima)
// ==========================================
const initialOf = (item) => escapeHtml((item.titulo || '?')[0]);

function cardHTML(item) {
  const hasCover = !!item.portada;
  const isFav = favorites.has(item.id);
  const percent = item.tipo === 'serie' ? getPercent(item) : 0;
  // Las películas no tienen episodios: su estado se marca a mano.
  const seenMovie = item.tipo === 'pelicula' && isMovieWatched(item.id);
  // Serie terminada: se queda en el catálogo, marcada como completada.
  const doneSeries = item.tipo === 'serie' && percent >= 100;
  const coverBadge = seenMovie ? '✓ Vista' : doneSeries ? '✓ Completada' : '';
  const title = escapeHtml(item.titulo || 'Sin título');
  return `
    <div class="series-card" data-id="${escapeHtml(item.id)}" data-tipo="${escapeHtml(item.tipo)}">
      <div class="series-card-cover">
        ${hasCover ? `<img src="${escapeHtml(item.portada)}" alt="" class="series-card-img" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
        <div class="series-card-fallback" style="${hasCover ? 'display:none' : 'display:flex'}">${initialOf(item)}</div>
        <div class="series-card-shade"></div>
        ${coverBadge ? `<span class="series-card-watched">${coverBadge}</span>` : ''}
        ${item.tipo === 'serie' && percent > 0 ? `<div class="series-card-progress"><div style="width:${percent}%"></div></div>` : ''}
        <!-- Favorita siempre visible y clicable, fuera del overlay de hover -->
        <button type="button" class="series-card-heart ${isFav ? 'is-on' : ''}" data-card-fav aria-label="${isFav ? 'Quitar de favoritas' : 'Añadir a favoritas'}" title="${isFav ? 'Quitar de favoritas' : 'Añadir a favoritas'}">${isFav ? '❤' : '🤍'}</button>
      </div>
      <!-- Botón que cubre la tarjeta: mantiene el clic completo sin anidar
           botones dentro de un role="button". -->
      <button type="button" class="series-card-open" data-card-open aria-label="Abrir ${title}, ${typeLabel(item)}"></button>
      <!-- Overlay estilo Netflix: el play aparece al pasar el ratón -->
      <div class="series-card-overlay">
        <button type="button" class="series-card-play" data-card-play aria-label="Abrir ${title}" title="Abrir">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
      </div>
      <div class="series-card-meta">
        <div class="series-card-title">${title}</div>
        <div class="series-card-sub">
          <span>${typeLabel(item)}</span>
          ${item.tipo === 'serie' && getTotal(item) > 0 ? `<span class="dot">·</span><span>${getTotal(item)} ep</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * Tarjeta de "Seguir viendo": añade el siguiente capítulo y un botón para
 * marcarlo visto sin entrar a la ficha.
 */
function continueCardHTML(c) {
  const total = c.total;
  const done = c.watched;
  const complete = done >= total;
  const nextEp = Math.min(total, done + 1);
  const title = escapeHtml(c.item.titulo || 'Sin título');
  return `
    <div class="series-card series-card--continue" data-id="${escapeHtml(c.item.id)}" data-tipo="serie">
      <div class="series-card-cover">
        ${c.item.portada ? `<img src="${escapeHtml(c.item.portada)}" alt="" class="series-card-img" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
        <div class="series-card-fallback" style="${c.item.portada ? 'display:none' : 'display:flex'}">${initialOf(c.item)}</div>
        <div class="series-card-shade"></div>
        <span class="series-card-next">${complete ? 'Completa' : `Siguiente · ep. ${nextEp}`}</span>
        <div class="series-card-progress"><div style="width:${Math.max(c.percent, 3)}%"></div></div>
        <button type="button" class="series-card-heart ${favorites.has(c.item.id) ? 'is-on' : ''}" data-card-fav aria-label="${favorites.has(c.item.id) ? 'Quitar de favoritas' : 'Añadir a favoritas'}" title="Favorito">${favorites.has(c.item.id) ? '❤' : '🤍'}</button>
      </div>
      <button type="button" class="series-card-open" data-card-open aria-label="Abrir ${title}"></button>
      <div class="series-card-overlay">
        <button type="button" class="series-card-play" data-card-play aria-label="Abrir ${title}" title="Abrir">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
      </div>
      <div class="series-card-meta">
        <div class="series-card-title">${title}</div>
        <div class="series-card-sub series-card-sub--continue">
          <span>Ep. ${done} de ${total}</span>
          ${complete ? '' : `<button type="button" class="series-card-mark" data-continue-add="${escapeHtml(c.item.id)}" aria-label="Marcar capítulo ${nextEp} de ${title} como visto" title="Marcar ep. ${nextEp} como visto">✓ ${nextEp}</button>`}
        </div>
      </div>
    </div>
  `;
}

/** Fila "Seguir viendo" con sus tarjetas accionables. */
function continueSectionHTML(items) {
  if (!items.length) return '';
  return `
    <section class="sr-row" id="srContinueWatching" aria-label="Seguir viendo">
      <div class="sr-row-head">
        <h3 class="sr-row-title"><span class="sr-row-emoji">▶</span>Seguir viendo</h3>
        <span class="sr-row-count">${items.length}</span>
      </div>
      <div class="series-flat-grid">${items.map(continueCardHTML).join('')}</div>
    </section>
  `;
}

/** Marca el siguiente capítulo de una serie (desde "Seguir viendo"). */
function markNextEpisode(itemId) {
  const item = catalog.find(i => i.id === itemId);
  if (!item) return;
  const total = getTotal(item);
  const done = getCompletedCount(itemId, total);
  if (total <= 0 || done >= total) return;
  saveProgressFor(itemId, {
    ...loadProgressFor(itemId),
    watched: Array.from({ length: done + 1 }, (_, i) => i + 1)
  });
  showToast(`Episodio ${done + 1} marcado ✓`, 'success');
  if (currentDetailId === itemId) renderDetail(item);
  else renderAll();
}

// ==========================================
// SECTION — cabecera + cuadrícula estilo catálogo
// ==========================================
function gridSectionHTML(title, items, emoji, id) {
  if (!items.length) return '';
  return `
    <section class="sr-row" ${id ? `id="${escapeHtml(id)}"` : ''} aria-label="${escapeHtml(title)}">
      <div class="sr-row-head">
        <h3 class="sr-row-title">${emoji ? `<span class="sr-row-emoji">${emoji}</span>` : ''}${escapeHtml(title)}</h3>
        <span class="sr-row-count">${items.length}</span>
      </div>
      <div class="series-flat-grid">${items.map(cardHTML).join('')}</div>
    </section>
  `;
}

// ==========================================
// FEATURED HERO
// ==========================================
function renderFeatured() {
  const container = page.querySelector('#srFeatured');
  if (!container) return;
  const featured = heroPool[heroIndex] || getFeatured();
  if (!featured) { container.style.display = 'none'; return; }
  container.style.display = 'block';
  const isFav = favorites.has(featured.id);
  const isContinue = heroMode === 'continue';
  const total = featured.tipo === 'serie' ? getTotal(featured) : 0;
  const done = total > 0 ? getCompletedCount(featured.id, total) : 0;
  const nextEp = done > 0 && done < total ? done + 1 : 0;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  container.innerHTML = `
    <div class="sr-hero" data-id="${escapeHtml(featured.id)}">
      ${featured.banner || featured.portada
        ? `<img src="${escapeHtml(featured.banner || featured.portada)}" alt="" class="sr-hero-bg" loading="eager" fetchpriority="high" decoding="async" data-cover="${escapeHtml(featured.portada || '')}">`
        : ''}
      <div class="sr-hero-shade"></div>
      <div class="sr-hero-body">
        <div class="sr-hero-tags">
          ${isContinue ? '<span class="sr-hero-badge">▶ Seguir viendo</span>' : ''}
          <span class="sr-hero-badge">${typeLabel(featured)}</span>
          ${featured.tipo === 'serie' && total > 0 ? `<span class="sr-hero-badge">${total} ep</span>` : ''}
          ${isContinue && percent > 0 ? `<span class="sr-hero-badge sr-hero-badge--percent">${percent}%</span>` : ''}
        </div>
        <h2 class="sr-hero-title">${escapeHtml(featured.titulo || 'Sin título')}</h2>
        <p class="sr-hero-desc">${escapeHtml(featured.descripcion || (featured.tipo === 'serie' ? `${getStatusText(featured) || ''} — Explora esta serie y marca tus episodios vistos.` : 'Disfruta de esta película cuando quieras.'))}</p>
        <div class="sr-hero-actions">
          <button class="sr-hero-play" data-hero="play">▶ ${isContinue && nextEp ? `Continuar ep. ${nextEp}` : (featured.tipo === 'serie' && total > 0 ? 'Ver' : 'Reproducir')}</button>
          <button class="sr-hero-fav ${isFav ? 'is-on' : ''}" data-hero="fav" aria-label="Favorito">${isFav ? '❤' : '🤍'}</button>
        </div>
      </div>
    </div>
  `;

  // Imagen del hero: si el banner falla se cae a la portada (sin onerror inline).
  const heroImg = container.querySelector('.sr-hero-bg');
  if (heroImg) {
    heroImg.addEventListener('error', () => {
      const fallback = heroImg.dataset.cover;
      if (fallback && !heroImg.dataset.fb) {
        heroImg.dataset.fb = '1';
        heroImg.src = fallback;
      } else {
        heroImg.style.display = 'none';
      }
    });
  }

  // Clic en la tarjeta: en modo Seguir viendo lleva a la sección; si no, abre el detalle
  container.querySelector('.sr-hero')?.addEventListener('click', () => {
    if (isContinue) {
      page.querySelector('#srContinueWatching')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      openDetail(featured.id);
    }
  });
  container.querySelector('[data-hero="play"]')?.addEventListener('click', (e) => { e.stopPropagation(); openDetail(featured.id); });
  container.querySelector('[data-hero="fav"]')?.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(featured.id); });
}

/** Rota el hero suavemente (fade-out → cambia → fade-in) cada 10s. */
function rotateHero() {
  const container = page.querySelector('#srFeatured');
  if (!container || heroPool.length < 2) return;
  container.style.opacity = '0';
  window.setTimeout(() => {
    if (!container.isConnected) return;
    heroIndex = (heroIndex + 1) % heroPool.length;
    renderFeatured();
    container.style.opacity = '1';
  }, 600);
}

function clearHeroTimer() {
  if (heroTimer) { clearInterval(heroTimer); heroTimer = null; }
}

/** Arranca la rotación del hero solo si hay varios títulos y la pestaña está visible. */
function startHeroTimer() {
  clearHeroTimer();
  if (heroPool.length < 2) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  heroTimer = window.setInterval(rotateHero, 10000);
}

// ==========================================
// HOME (Inicio streaming)
// ==========================================
function renderHome() {
  const root = page.querySelector('#srViewHome');
  if (!root) return;
  // { item, watched, total, percent } — lo que consume la fila "Seguir viendo".
  const inProgress = catalog
    .map(item => {
      const total = getTotal(item);
      return { item, total, watched: getCompletedCount(item.id, total) };
    })
    .filter(c => c.total > 0 && c.watched > 0 && c.watched < c.total)
    .map(c => ({ ...c, percent: Math.round((c.watched / c.total) * 100) }));
  const lastAdded = [...catalog].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 12);

  const hero = document.createElement('div');
  hero.id = 'srFeatured';
  hero.className = 'sr-featured-slot';
  hero.style.display = 'none';
  root.innerHTML = '';
  root.appendChild(hero);

  // Hero rotatorio: si hay algo en progreso lo muestra (rotando entre ellos si
  // hay varios); si no, títulos aleatorios del catálogo. Cambia suavemente cada 10s.
  heroMode = inProgress.length ? 'continue' : 'random';
  heroPool = heroMode === 'continue' ? inProgress.map(c => c.item) : [...catalog].sort(() => Math.random() - 0.5);
  heroIndex = 0;
  clearHeroTimer();
  startHeroTimer();
  hero.style.transition = 'opacity 0.6s ease';
  hero.style.opacity = '1';
  renderFeatured();

  // Filas por categoría (campo `categoria`): Dragon Ball, Gravity Falls, Disney, Marvel…
  // Se muestran todas las categorías que tengan al menos un título, ordenadas
  // por la fecha del título más antiguo (estable y predecible).
  const catMap = new Map();
  catalog.forEach(i => {
    const cat = (i.categoria || '').trim();
    if (!cat) return;
    if (!catMap.has(cat)) catMap.set(cat, []);
    catMap.get(cat).push(i);
  });
  const catRows = [...catMap.entries()]
    .sort((a, b) => {
      const minA = Math.min(...a[1].map(i => i.createdAt || 0));
      const minB = Math.min(...b[1].map(i => i.createdAt || 0));
      return (minA - minB) || a[0].localeCompare(b[0]);
    })
    .map(([cat, items]) => gridSectionHTML(cat, items))
    .join('');

  root.insertAdjacentHTML('beforeend',
    continueSectionHTML(inProgress) +
    gridSectionHTML('Últimas añadidas', lastAdded) +
    catRows
  );

  if (!catalog.length) {
    const isAdmin = userStore.isAdmin;
    root.insertAdjacentHTML('beforeend', `
      <div class="sr-empty sr-empty--home">
        <div class="sr-empty-icon">🎬</div>
        <h3>Tu plataforma está esperando</h3>
        <p>${isAdmin ? 'Añade tu primera serie o película para empezar a construir tu catálogo personal.' : 'El catálogo todavía se está preparando. Vuelve pronto.'}</p>
        ${isAdmin ? `<button class="sr-empty-btn" id="emptyAddBtn">${UI.plus} Añadir contenido</button>` : ''}
      </div>
    `);
    page.querySelector('#emptyAddBtn')?.addEventListener('click', () => openEditor(null));
  }

  bindCards(root);
}

// ==========================================
// CATÁLOGO (grid + búsqueda agrupada)
// ==========================================
const SORTERS = {
  recent: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
  az: (a, b) => String(a.titulo || '').localeCompare(String(b.titulo || ''), 'es', { sensitivity: 'base' }),
  progress: (a, b) => getPercent(b) - getPercent(a),
  rating: (a, b) => (Number(b.valoracion) || 0) - (Number(a.valoracion) || 0)
};

const FILTER_LABELS = {
  todo: 'Todo',
  serie: 'Series',
  pelicula: 'Películas',
  favoritas: 'Favoritas',
  encurso: 'En curso',
  vistas: 'Vistas',
  porver: 'Películas por ver'
};

const EMPTY_COPY = {
  favoritas: ['Aún no tienes favoritas', 'Toca el corazón de cualquier título para guardarlo aquí.'],
  encurso: ['Nada en curso', 'Marca el primer capítulo de una serie y aparecerá aquí.'],
  vistas: ['Nada visto todavía', 'Termina una serie o marca una película como vista y aparecerá aquí.'],
  porver: ['No te queda ninguna película', 'Todo lo que tienes en el catálogo ya está marcado como visto.']
};

/** Minúsculas y sin acentos: «obsesion» encuentra «Obsesión». */
function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function hasProgress(item) {
  if (item.tipo !== 'serie') return false;
  const total = getTotal(item);
  const done = getCompletedCount(item.id, total);
  return total > 0 && done > 0;
}

function isInProgress(item) {
  if (!hasProgress(item)) return false;
  const total = getTotal(item);
  return getCompletedCount(item.id, total) < total;
}

/** ¿Ya se ha visto entero? Serie con todos los capítulos o película marcada. */
function isSeenItem(item) {
  if (item.tipo === 'pelicula') return isMovieWatched(item.id);
  const total = getTotal(item);
  return total > 0 && getCompletedCount(item.id, total) >= total;
}

function renderCatalog() {
  const root = page.querySelector('#srCatalogResults');
  if (!root) return;
  let filtered = [...catalog];
  const q = normalizeText(searchTerm.trim());
  if (q) {
    filtered = filtered.filter(i =>
      normalizeText(i.titulo).includes(q) ||
      normalizeText(i.descripcion).includes(q) ||
      String(i.anio || '').includes(q) ||
      normalizeText(i.categoria).includes(q) ||
      detectGenres(i).some(g => normalizeText(g).includes(q)) ||
      normalizeText(i.webUrl).includes(q)
    );
  }
  if (currentFilter === 'serie') filtered = filtered.filter(i => i.tipo === 'serie');
  else if (currentFilter === 'pelicula') filtered = filtered.filter(i => i.tipo === 'pelicula');
  else if (currentFilter === 'favoritas') filtered = filtered.filter(i => favorites.has(i.id));
  else if (currentFilter === 'encurso') filtered = filtered.filter(isInProgress);
  else if (currentFilter === 'vistas') filtered = filtered.filter(isSeenItem);
  else if (currentFilter === 'porver') filtered = filtered.filter(i => i.tipo === 'pelicula' && !isMovieWatched(i.id));

  filtered.sort(SORTERS[currentSort] || SORTERS.recent);

  const filterNote = currentFilter === 'todo' ? '' : ` · ${escapeHtml(FILTER_LABELS[currentFilter] || '')}`;

  // Resultados agrupados por tipo cuando hay búsqueda
  if (q) {
    const series = filtered.filter(i => i.tipo === 'serie');
    const movies = filtered.filter(i => i.tipo === 'pelicula');
    if (!filtered.length) {
      root.innerHTML = `
        <div class="sr-search-empty">
          <div class="sr-empty-icon">🔍</div>
          <h3>Sin resultados para «${escapeHtml(searchTerm.trim())}»</h3>
          <p>Prueba con otro título, género, año o descripción; o quita el filtro.</p>
        </div>`;
      return;
    }
    let html = `<div class="sr-search-summary">${filtered.length} resultado${filtered.length === 1 ? '' : 's'} para «${escapeHtml(searchTerm.trim())}»${filterNote}</div>`;
    if (series.length) html += `<div class="sr-group"><div class="sr-group-title">Series <span>${series.length}</span></div><div class="series-flat-grid">${series.map(cardHTML).join('')}</div></div>`;
    if (movies.length) html += `<div class="sr-group"><div class="sr-group-title">Películas <span>${movies.length}</span></div><div class="series-flat-grid">${movies.map(cardHTML).join('')}</div></div>`;
    root.innerHTML = html;
    bindCards(root);
    return;
  }

  if (!filtered.length) {
    const [title, text] = EMPTY_COPY[currentFilter] || ['Aún no hay contenido', 'Añade tu primera serie o película desde el botón +.'];
    root.innerHTML = `
      <div class="sr-empty">
        <div class="sr-empty-icon">🎞️</div>
        <h3>${title}</h3>
        <p>${text}</p>
      </div>`;
    return;
  }

  root.innerHTML = `
    <div class="sr-results-summary">${filtered.length} título${filtered.length === 1 ? '' : 's'}${filterNote}</div>
    <div class="series-flat-grid">${filtered.map(cardHTML).join('')}</div>`;
  bindCards(root);
}

function renderTmdbCatalog() {
  const root = page?.querySelector('#srTmdbResults');
  if (!root) return;
  const query = tmdbQuery.trim();
  if (tmdbLoading) {
    root.innerHTML = `<section class="sr-tmdb-panel" aria-live="polite"><div class="sr-tmdb-heading"><div><span class="sr-tmdb-kicker">Catálogo actualizado</span><h3>${query ? `Buscando «${escapeHtml(query)}»` : tmdbMode === 'upcoming' ? 'Próximamente' : 'Lo más popular esta semana'}</h3></div>${query ? '' : `<div class="sr-tmdb-modes"><button type="button" data-tmdb-mode="trending" aria-pressed="${tmdbMode === 'trending'}">Tendencias</button><button type="button" data-tmdb-mode="upcoming" aria-pressed="${tmdbMode === 'upcoming'}">Próximamente</button></div>`}</div><p class="sr-tmdb-status">Consultando TMDB…</p></section>`;
    return;
  }
  if (tmdbError) {
    root.innerHTML = `<section class="sr-tmdb-panel" aria-live="polite"><div class="sr-tmdb-heading"><div><span class="sr-tmdb-kicker">Catálogo actualizado</span><h3>${query ? 'Búsqueda externa' : 'Descubre series y películas'}</h3></div>${query ? '' : `<div class="sr-tmdb-modes"><button type="button" data-tmdb-mode="trending" aria-pressed="${tmdbMode === 'trending'}">Tendencias</button><button type="button" data-tmdb-mode="upcoming" aria-pressed="${tmdbMode === 'upcoming'}">Próximamente</button></div>`}</div><p class="sr-tmdb-status sr-tmdb-status--error">${escapeHtml(tmdbError)}</p><p class="sr-tmdb-attribution">Datos e imágenes proporcionados por TMDB.</p></section>`;
    return;
  }

  const isFiltered = ['favoritas', 'encurso', 'vistas', 'porver'].includes(currentFilter);
  if (isFiltered) {
    root.innerHTML = `<section class="sr-tmdb-panel"><p class="sr-tmdb-status">Cambia a «Todo» para ver los resultados de TMDB.</p></section>`;
    return;
  }
  const filteredItems = tmdbItems.filter(item => currentFilter === 'todo' || item.tipo === currentFilter);
  const heading = query ? `Resultados de «${escapeHtml(query)}»` : tmdbMode === 'upcoming' ? 'Próximamente en España' : 'Lo más popular esta semana';
  const cards = filteredItems.map(item => {
    const inWatchlist = sharedWatchlist.some(entry => entry.id === item.id);
    const date = item.anio ? ` · ${escapeHtml(item.anio)}` : '';
    const poster = item.portada
      ? `<img src="${escapeHtml(item.portada)}" alt="" loading="lazy" decoding="async" onerror="this.closest('.sr-tmdb-card')?.classList.add('is-no-poster')">`
      : '';
    return `<article class="sr-tmdb-card ${poster ? '' : 'is-no-poster'}">
      <div class="sr-tmdb-poster">${poster}<span aria-hidden="true">${item.tipo === 'serie' ? '▣' : '▶'}</span></div>
      <div class="sr-tmdb-copy"><div class="sr-tmdb-meta">${item.tipo === 'serie' ? 'Serie' : 'Película'}${date}${item.valoracion ? ` · ★ ${item.valoracion.toFixed(1)}` : ''}${item.generos?.length ? ` · ${escapeHtml(item.generos.slice(0, 2).join(', '))}` : ''}</div>
        <h4>${escapeHtml(item.titulo)}</h4><p>${escapeHtml(item.descripcion || 'Sin sinopsis disponible.')}</p>
        <button type="button" class="sr-tmdb-add" data-tmdb-add="${escapeHtml(item.id)}" ${inWatchlist ? 'disabled' : ''}>${inWatchlist ? 'En nuestra lista ✓' : '+ Añadir a nuestra lista'}</button>
      </div>
    </article>`;
  }).join('');
  root.innerHTML = `<section class="sr-tmdb-panel" aria-live="polite"><div class="sr-tmdb-heading"><div><span class="sr-tmdb-kicker">Catálogo actualizado</span><h3>${heading}</h3></div>${query ? `<span class="sr-tmdb-count">${filteredItems.length} títulos</span>` : `<div class="sr-tmdb-modes"><button type="button" data-tmdb-mode="trending" aria-pressed="${tmdbMode === 'trending'}">Tendencias</button><button type="button" data-tmdb-mode="upcoming" aria-pressed="${tmdbMode === 'upcoming'}">Próximamente</button></div>`}</div>${cards ? `<div class="sr-tmdb-grid">${cards}</div>` : `<p class="sr-tmdb-status">${query ? 'No se encontraron títulos en TMDB.' : 'Todavía no hay recomendaciones disponibles.'}</p>`}<p class="sr-tmdb-attribution">Datos e imágenes proporcionados por TMDB.</p></section>`;
}

async function loadTmdbCatalog(query = '') {
  const requestId = ++tmdbRequestId;
  tmdbQuery = query;
  tmdbLoading = true;
  tmdbError = '';
  renderTmdbCatalog();
  try {
    const data = query.length >= 2
      ? await searchTmdbTitles(query)
      : tmdbMode === 'upcoming' ? await getUpcomingTmdbTitles() : await getTrendingTmdbTitles();
    if (requestId !== tmdbRequestId || !page?.isConnected) return;
    tmdbItems = Array.isArray(data.results) ? data.results : [];
    tmdbError = '';
  } catch (error) {
    if (requestId !== tmdbRequestId || !page?.isConnected) return;
    tmdbItems = [];
    tmdbError = error?.message || 'No se pudo conectar con TMDB.';
  } finally {
    if (requestId === tmdbRequestId && page?.isConnected) {
      tmdbLoading = false;
      renderTmdbCatalog();
    }
  }
}

async function addTmdbTitleToWatchlist(id) {
  const item = tmdbItems.find(entry => entry.id === id);
  if (!item) return;
  if (!sharedWatchlistLoaded) {
    sharedWatchlist = await loadSharedWatchlist();
    sharedWatchlistLoaded = true;
  }
  if (sharedWatchlist.some(entry => entry.id === item.id)) {
    renderTmdbCatalog();
    return;
  }
  const previous = sharedWatchlist;
  sharedWatchlist = toggleInWatchlist(previous, {
    id: item.id,
    title: item.titulo,
    poster: item.portada,
  }, userStore.getUser()?.name || '');
  if (!(await saveSharedWatchlist(sharedWatchlist))) {
    sharedWatchlist = previous;
    showToast('No se pudo guardar en la lista compartida. Comprueba la conexión.');
    return;
  }
  showToast('Añadido a vuestra lista ✓', 'success');
  renderTmdbCatalog();
  void pintarWatchlistCompartida();
}

// ==========================================
// TOP 5
// ==========================================
function renderTop5() {
  const root = page.querySelector('#srViewTop5');
  if (!root) return;
  const tipo = currentTopType === 'series' ? 'serie' : 'pelicula';
  const list = (podioData[currentTopType] || []).sort((a, b) => a.position - b.position);
  const counts = { series: catalog.filter(i => i.tipo === 'serie').length, movies: catalog.filter(i => i.tipo === 'pelicula').length };

  root.innerHTML = `
    <div class="sr-top-head">
      <div>
        <h2 class="sr-top-title">🏆 Mi Top 5</h2>
        <p class="sr-top-sub">Tu selección personal y manual. Tú decides quién entra y en qué orden.</p>
      </div>
      <button class="sr-top-edit-btn" id="top5EditBtn">${list.length ? 'Editar ranking' : 'Crear ranking'}</button>
    </div>
    <div class="sr-top-tabs">
      <button class="sr-top-tab ${currentTopType === 'series' ? 'active' : ''}" data-top="series">Series <span>${counts.series}</span></button>
      <button class="sr-top-tab ${currentTopType === 'movies' ? 'active' : ''}" data-top="movies">Películas <span>${counts.movies}</span></button>
    </div>
    ${list.length ? `
      <ol class="sr-top-list">
        ${list.map((p, i) => {
          const ci = catalog.find(c => c.id === p.itemId);
          return `
          <li class="sr-top-item" data-id="${escapeHtml(p.itemId)}">
            <span class="sr-top-rank">${String(p.position).padStart(2, '0')}</span>
            <div class="sr-top-cover">${ci?.portada ? `<img src="${escapeHtml(ci.portada)}" alt="" loading="lazy">` : `<div class="sr-top-cover-fb">${escapeHtml((p.titulo || '?')[0])}</div>`}</div>
            <div class="sr-top-info">
              <div class="sr-top-name">${escapeHtml(p.titulo || 'Sin título')}</div>
              <div class="sr-top-type">${tipo === 'serie' ? 'Serie' : 'Película'}</div>
            </div>
            <span class="sr-top-medal">${['🥇', '🥈', '🥉', '4', '5'][i]}</span>
          </li>`;
        }).join('')}
      </ol>
    ` : `
      <div class="sr-empty sr-top-empty">
        <div class="sr-empty-icon">🏆</div>
        <h3>Tu Top 5 está vacío</h3>
        <p>Elige tus ${tipo === 'series' ? '5 series' : '5 películas'} favoritas y ordénalas del 1 al 5. Podrás cambiarlas cuando quieras.</p>
        <button class="sr-empty-btn" id="top5StartBtn">Elegir mi Top 5</button>
      </div>
    `}
  `;

  page.querySelectorAll('[data-top]').forEach(btn => btn.addEventListener('click', () => {
    page.querySelectorAll('[data-top]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTopType = btn.dataset.top;
    renderTop5();
  }));
  page.querySelector('#top5EditBtn')?.addEventListener('click', openTop5Editor);
  page.querySelector('#top5StartBtn')?.addEventListener('click', openTop5Editor);

  root.querySelectorAll('.sr-top-item').forEach(li => li.addEventListener('click', () => openDetail(li.dataset.id)));
}

// ==========================================
// TOP 5 EDITOR
// ==========================================
function openTop5Editor() {
  const tipo = currentTopType === 'series' ? 'serie' : 'pelicula';
  const available = catalog.filter(i => i.tipo === tipo);
  const current = (podioData[currentTopType] || []).slice().sort((a, b) => a.position - b.position);
  if (!available.length) {
    showToast('Añade contenido primero', 'error');
    return;
  }
  const modal = page.querySelector('#top5Modal');
  const list = modal.querySelector('#top5EditList');
  list.innerHTML = current.map((p, i) => {
    const ci = catalog.find(c => c.id === p.itemId);
    return `
      <div class="sr-top5-row" data-position="${p.position}">
        <span class="sr-top5-rank">${String(p.position).padStart(2, '0')}</span>
        <span class="sr-top5-name">${escapeHtml(p.titulo || 'Sin título')}</span>
        <button class="sr-top5-up" data-top5="up" title="Subir">↑</button>
        <button class="sr-top5-down" data-top5="down" title="Bajar">↓</button>
        <button class="sr-top5-remove" data-top5="remove" title="Quitar">✕</button>
      </div>`;
  }).join('');

  // Add slot (primer hueco libre 1-5)
  const usedPos = new Set(current.map(p => p.position));
  const freePos = [1, 2, 3, 4, 5].find(p => !usedPos.has(p));
  list.insertAdjacentHTML('beforeend', `
    <div class="sr-top5-add">
      <select id="top5Pick" ${freePos ? '' : 'disabled'}>
        <option value="">${freePos ? `Añadir en posición ${freePos}…` : 'Top 5 completo'}</option>
        ${available.map(i => `<option value="${escapeHtml(i.id)}">${escapeHtml(i.titulo)}</option>`).join('')}
      </select>
    </div>
  `);

  // Eventos
  list.querySelectorAll('[data-top5]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const row = btn.closest('.sr-top5-row');
      const pos = parseInt(row.dataset.position);
      let items = (podioData[currentTopType] || []).slice();
      const action = btn.dataset.top5;
      if (action === 'remove') {
        items = items.filter(i => i.position !== pos);
      } else if (action === 'up' || action === 'down') {
        const delta = action === 'up' ? -1 : 1;
        const idx = items.findIndex(i => i.position === pos);
        const target = items.findIndex(i => i.position === pos + delta);
        if (target >= 0) {
          items[idx].position = pos + delta;
          items[target].position = pos;
        }
      }
      // Renumerar 1..n
      items.sort((a, b) => a.position - b.position).forEach((it, i) => { it.position = i + 1; });
      podioData[currentTopType] = items;
      savePodioData();
      openTop5Editor();
    });
  });

  page.querySelector('#top5Pick')?.addEventListener('change', (e) => {
    const id = e.target.value;
    if (!id) return;
    const ci = catalog.find(c => c.id === id);
    if (!ci) return;
    const items = (podioData[currentTopType] || []).slice();
    const usedPos = new Set(items.map(i => i.position));
    const freePos = [1, 2, 3, 4, 5].find(p => !usedPos.has(p));
    if (!freePos) { showToast('Top 5 completo', 'error'); return; }
    items.push({ itemId: id, position: freePos, titulo: ci.titulo, portada: ci.portada || '' });
    podioData[currentTopType] = items;
    savePodioData();
    openTop5Editor();
    showToast(`Añadido en la posición ${freePos} ✓`, 'success');
  });

  modal.style.display = 'flex';
  modal.querySelector('#top5SaveBtn').onclick = () => {
    modal.style.display = 'none';
    renderAll();
    showToast('Top 5 guardado ✓', 'success');
  };
}

// ==========================================
// DETAIL (página completa)
// ==========================================
function openDetail(itemId) {
  const item = catalog.find(i => i.id === itemId);
  if (!item) return;
  currentDetailId = itemId;
  // Colapso por defecto: temporadas a partir de la 2ª. El usuario puede
  // expandirlas; el estado se conserva entre re-renders (marcar visto) y
  // se reinicia al salir del detalle.
  collapsedDetailSeasons.clear();
  getSeasons(item).forEach((_, si) => { if (si > 0) collapsedDetailSeasons.add(si); });
  renderDetail(item);
}

function renderDetail(item) {
  const isSeries = item.tipo === 'serie';
  const seasons = getSeasons(item);
  const total = getTotal(item);
  const percent = getPercent(item);
  const prog = loadProgressFor(item.id);
  const watched = prog.watched || [];
  const isFav = favorites.has(item.id);
  const seenMovie = !isSeries && isMovieWatched(item.id);
  const related = catalog.filter(i => i.id !== item.id && detectGenres(i).some(g => detectGenres(item).includes(g))).slice(0, 10);

  page.innerHTML = `
    <div class="sr-detail">
      <div class="sr-detail-hero">
        ${item.banner || item.portada ? `<img src="${escapeHtml(item.banner || item.portada)}" alt="" class="sr-detail-hero-bg" fetchpriority="high" decoding="async" data-cover="${escapeHtml(item.portada || '')}">` : ''}
        <div class="sr-detail-hero-shade"></div>
        <button class="sr-detail-back" id="srBackBtn" aria-label="Volver">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="sr-detail-hero-body">
          <div class="sr-detail-poster">
            ${item.portada ? `<img src="${escapeHtml(item.portada)}" alt="" decoding="async" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
            <div class="sr-detail-poster-fb" style="${item.portada ? 'display:none' : 'display:flex'}">${escapeHtml((item.titulo || '?')[0])}</div>
          </div>
          <div class="sr-detail-info">
            <div class="sr-detail-tags">
              <span class="sr-hero-badge">${typeLabel(item)}</span>
              ${item.tipo === 'serie' && total > 0 ? `<span class="sr-hero-badge">${total} ep</span>` : ''}
              ${seenMovie ? '<span class="sr-hero-badge">✓ Vista</span>' : ''}
            </div>
            <h1 class="sr-detail-title">${escapeHtml(item.titulo || 'Sin título')}</h1>
            <button class="btn sr-watch-btn" type="button" id="srWatchlistBtn">${sharedWatchlist.some(entry => entry.id === item.id) ? 'En la watchlist ✓' : '+ Watchlist compartida'}</button>
            ${item.descripcion ? `<p class="sr-detail-desc">${escapeHtml(item.descripcion)}</p>` : ''}
            ${isSeries && total > 0 ? `
              <div class="sr-detail-progress">
                <div class="sr-detail-progress-bar"><div class="sr-detail-progress-fill" style="width:${percent}%"></div></div>
                <span>${getStatusText(item)} · ${Math.round(percent)}%</span>
              </div>` : ''}
            <div class="sr-detail-actions">
              ${playUrl(item)
                ? `<a class="sr-detail-play" href="${escapeHtml(playUrl(item))}" target="_blank" rel="noopener">▶ ${isSeries ? 'Ver' : 'Reproducir'}</a>`
                : `<button class="sr-detail-play" id="srDetailNoPlay">▶ ${isSeries ? 'Ver episodios' : 'Ver'}</button>`}
              ${!isSeries ? `<button type="button" class="sr-detail-seen ${seenMovie ? 'is-on' : ''}" id="srDetailSeen" aria-pressed="${seenMovie}">${seenMovie ? '✓ Vista' : 'Marcar como vista'}</button>` : ''}
              <button class="sr-detail-fav ${isFav ? 'is-on' : ''}" id="srDetailFav" aria-label="Favorito">${isFav ? '❤' : '🤍'}</button>
              ${userStore.isAdmin ? `<button class="sr-detail-edit" id="srDetailEdit" aria-label="Editar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="sr-detail-del" id="srDetailDel" aria-label="Eliminar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>` : ''}
            </div>
          </div>
        </div>
      </div>

      ${isSeries && total > 0 ? renderStickyProgress(item, total, watched, percent) : ''}

      ${isSeries ? renderSeasonsSection(item, seasons, watched) : renderMovieSection(item)}

      ${related.length ? `
        <section class="sr-detail-section">
          <div class="sr-row-head"><h3 class="sr-row-title">También podría gustarte</h3><span class="sr-row-count">${related.length}</span></div>
          <div class="sr-detail-related">${related.map(cardHTML).join('')}</div>
        </section>` : ''}
    </div>

    <!-- Confirmación de borrado (renderDetail reemplaza todo el shell, el modal debe vivir aquí) -->
    <div class="modal-overlay" id="deleteModal" style="display:none;">
      <div class="modal-content sr-modal sr-del-modal">
        <div class="sr-del-icon">🗑️</div>
        <h2>Eliminar contenido</h2>
        <p class="sr-modal-sub">Se eliminará <strong id="srDelTitle"></strong> (<span id="srDelType"></span>) de tu catálogo, favoritos, Top 5 y progreso. Esta acción no se puede deshacer.</p>
        <div class="form-actions">
          <button class="btn-secondary" id="srDelCancel">Cancelar</button>
          <button class="btn-danger" id="srDelConfirm">Eliminar</button>
        </div>
      </div>
    </div>
  `;

  // Banner de la ficha: si falla cae a la portada (sin onerror inline).
  const detailBg = page.querySelector('.sr-detail-hero-bg');
  if (detailBg) {
    detailBg.addEventListener('error', () => {
      const fallback = detailBg.dataset.cover;
      if (fallback && !detailBg.dataset.fb) {
        detailBg.dataset.fb = '1';
        detailBg.src = fallback;
      } else {
        detailBg.style.display = 'none';
      }
    });
  }

  page.querySelector('#srBackBtn')?.addEventListener('click', () => { currentDetailId = null; collapsedDetailSeasons.clear(); render(); renderAll(); });

  // Añadir o quitar el título abierto de la watchlist compartida.
  page.querySelector('#srWatchlistBtn')?.addEventListener('click', async () => {
    const item = catalog.find(entry => entry.id === currentDetailId);
    if (!item) return;
    const prev = sharedWatchlist;
    sharedWatchlist = toggleInWatchlist(prev, {
      id: item.id,
      title: item.titulo || '',
      poster: item.portada || '',
    }, userStore.getUser()?.name || '');
    const ok = await saveSharedWatchlist(sharedWatchlist);
    sharedWatchlistLoaded = true;
    if (!ok) {
      sharedWatchlist = prev;
      showToast('No se pudo guardar la watchlist');
      return;
    }
    showToast('Watchlist actualizada');
    render();
    renderAll();
    void pintarWatchlistCompartida();
  });
  page.querySelector('#srDetailFav')?.addEventListener('click', () => toggleFavorite(item.id));
  // Películas: marcar como vista o desmarcarla (no tienen episodios).
  page.querySelector('#srDetailSeen')?.addEventListener('click', () => {
    const seen = toggleMovieWatched(item.id);
    showToast(seen ? 'Película marcada como vista ✓' : 'Película desmarcada', 'success');
    const cur = catalog.find(c => c.id === item.id);
    if (cur) renderDetail(cur);
  });
  page.querySelector('#srDetailEdit')?.addEventListener('click', () => { currentDetailId = null; render(); renderAll(); setTimeout(() => openEditor(item.id), 100); });
  page.querySelector('#srDetailDel')?.addEventListener('click', () => openDeleteConfirm(item));
  page.querySelector('#srDelCancel')?.addEventListener('click', closeDeleteConfirm);
  page.querySelector('#srDelConfirm')?.addEventListener('click', confirmDelete);
  page.querySelector('#deleteModal')?.addEventListener('click', (e) => { if (e.target.id === 'deleteModal') closeDeleteConfirm(); });
  page.querySelector('#srDetailNoPlay')?.addEventListener('click', () => {
    if (isSeries) { const f = page.querySelector('.sr-season'); f?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    else showToast('Añade un enlace de reproducción desde editar', 'info');
  });

  // Episodios: marcado acumulativo — marcar el N marca todos hasta N,
  // desmarcar el N desmarca desde N en adelante (modelo tipo Netflix)
  page.querySelectorAll('.sr-ep-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const ep = Number(btn.dataset.ep);
      const p = loadProgressFor(item.id);
      const w = p.watched || [];
      const maxWatched = w.length ? Math.max(...w) : 0;
      let next;
      if (ep > maxWatched) {
        // Marcar hasta el episodio pulsado
        next = Array.from({ length: ep }, (_, i) => i + 1);
      } else {
        // Ya estaba visto: desmarcar desde este episodio en adelante
        next = Array.from({ length: ep - 1 }, (_, i) => i + 1);
      }
      saveProgressFor(item.id, { ...p, watched: next });
      const cur = catalog.find(c => c.id === item.id);
      if (cur) renderDetail(cur);
    });
  });
  // Barra fija: marcar el siguiente capítulo sin salir de la ficha.
  page.querySelector('#srStickyMark')?.addEventListener('click', () => {
    const totalN = getTotal(item);
    const done = getCompletedCount(item.id, totalN);
    if (done >= totalN) return;
    saveProgressFor(item.id, {
      ...loadProgressFor(item.id),
      watched: Array.from({ length: done + 1 }, (_, i) => i + 1)
    });
    const cur = catalog.find(c => c.id === item.id);
    if (cur) renderDetail(cur);
    showToast(`Episodio ${done + 1} marcado ✓`, 'success');
  });
  // "Ver episodio" → salta al siguiente capítulo sin ver.
  page.querySelector('#srStickyGoNext')?.addEventListener('click', () => {
    const next = (prog.watched || []).length + 1;
    const target = page.querySelector(`.sr-ep-card[data-ep="${next}"]`) || page.querySelector('.sr-season');
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // Marcar / desmarcar una temporada completa.
  page.querySelectorAll('[data-season-mark]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const si = Number(btn.dataset.seasonMark);
      const allSeasons = getSeasons(item);
      let start = 0;
      for (let k = 0; k < si; k++) start += (allSeasons[k].episodios || []).length;
      const count = (allSeasons[si].episodios || []).length;
      if (!count) return;
      const end = start + count;
      const p = loadProgressFor(item.id);
      const w = p.watched || [];
      const maxWatched = w.length ? Math.max(...w) : 0;
      // Si la temporada ya está completa se desmarca (vuelve al inicio de ella).
      const next = maxWatched >= end
        ? Array.from({ length: start }, (_, i) => i + 1)
        : Array.from({ length: end }, (_, i) => i + 1);
      saveProgressFor(item.id, { ...p, watched: next });
      const cur = catalog.find(c => c.id === item.id);
      if (cur) renderDetail(cur);
    });
  });

  // Temporadas colapsables en el detalle (estado persistente entre re-renders)
  page.querySelectorAll('[data-season-toggle-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const season = btn.closest('.sr-season');
      const si = parseInt(season.dataset.season, 10);
      const collapsed = season.classList.toggle('is-collapsed');
      btn.setAttribute('aria-expanded', String(!collapsed));
      if (collapsed) collapsedDetailSeasons.add(si);
      else collapsedDetailSeasons.delete(si);
    });
  });

  // Bulk: marcar / desmarcar todos vistos
  page.querySelector('#srMarkAll')?.addEventListener('click', () => {
    const nums = Array.from({ length: total }, (_, i) => i + 1);
    saveProgressFor(item.id, { ...prog, watched: nums });
    const cur = catalog.find(c => c.id === item.id);
    if (cur) renderDetail(cur);
  });
  page.querySelector('#srUnmarkAll')?.addEventListener('click', () => {
    saveProgressFor(item.id, { ...prog, watched: [] });
    const cur = catalog.find(c => c.id === item.id);
    if (cur) renderDetail(cur);
  });
  page.querySelectorAll('.sr-ep-play').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = btn.dataset.url || btn.closest('.sr-ep-card')?.dataset.url;
      if (url) window.open(url, '_blank', 'noopener');
    });
  });
  // Relacionados (overlay de tarjeta incluido)
  bindCards(page.querySelector('.sr-detail-related'));
}

function renderStickyProgress(item, total, watched, percent) {
  const done = watched.length;
  const next = done < total ? done + 1 : total;
  const finished = done >= total;
  const status = finished ? 'Completada' : `Vas por el capítulo ${next} de ${total}`;
  return `
    <div class="sr-sticky-progress" id="srStickyProgress">
      <div class="sr-sticky-progress-fill" style="width:${percent}%"></div>
      <div class="sr-sticky-progress-body">
        <span class="sr-sticky-progress-label">${finished ? '✓ ' : '▶ '}${status} · ${Math.round(percent)}%</span>
        <div class="sr-sticky-progress-actions">
          ${finished
            ? '<span class="sr-sticky-progress-done">✓ Vista completa</span>'
            : `<button type="button" class="sr-sticky-progress-btn" id="srStickyMark">✓ Marcar ep. ${next}</button>
               <button type="button" class="sr-sticky-progress-link" id="srStickyGoNext">Ver episodio →</button>`}
        </div>
      </div>
    </div>
  `;
}

function renderSeasonsSection(item, seasons, watched) {
  // Índice global secuencial a través de todas las temporadas: así el marcado
  // acumulativo y el progreso (watched) funcionan correctamente aunque los
  // episodios se reinicien por temporada. ep.num queda solo para mostrar.
  let globalNum = 0;
  return `
    <section class="sr-detail-section">
      <div class="sr-seasons-head">
        <h3 class="sr-detail-section-title">Episodios</h3>
        <div class="sr-ep-actions">
          <button class="sr-ep-bulk" id="srMarkAll">✓ Marcar todos vistos</button>
          <button class="sr-ep-bulk" id="srUnmarkAll">✕ Quitar visto</button>
        </div>
      </div>
      ${seasons.map((season, si) => {
        const eps = season.episodios || [];
        const start = globalNum;
        const epsHtml = eps.map(ep => {
          globalNum += 1;
          const isWatched = watched.includes(globalNum);
          const epUrl = ep.recurso || '';
          return `
            <div class="sr-ep-card ${isWatched ? 'is-watched' : ''}" data-ep="${globalNum}" data-url="${escapeHtml(epUrl)}">
              ${ep.miniatura ? `<img src="${escapeHtml(ep.miniatura)}" alt="" class="sr-ep-thumb" loading="lazy" decoding="async" onerror="this.style.display='none'">` : `<div class="sr-ep-thumb sr-ep-thumb--fb">${globalNum}</div>`}
              <div class="sr-ep-body">
                <div class="sr-ep-num">${String(ep.num || globalNum).padStart(2, '0')}</div>
                <div class="sr-ep-info">
                  <div class="sr-ep-title">${escapeHtml(ep.titulo || `Episodio ${ep.num || globalNum}`)}</div>
                  <div class="sr-ep-meta">${isWatched ? '✓ Visto' : 'Sin ver'}</div>
                </div>
                ${epUrl ? `<button class="sr-ep-play" data-url="${escapeHtml(epUrl)}" aria-label="Reproducir">▶</button>` : ''}
              </div>
            </div>`;
        }).join('');
        const watchedInSeason = watched.filter(n => n > start && n <= globalNum).length;
        const isCollapsed = collapsedDetailSeasons.has(si);
        const seasonName = escapeHtml(season.titulo || `Temporada ${si + 1}`);
        const seasonDone = eps.length > 0 && watchedInSeason >= eps.length;
        return `
        <div class="sr-season ${isCollapsed ? 'is-collapsed' : ''}" data-season="${si}">
          <div class="sr-season-headrow">
            <button type="button" class="sr-season-head" data-season-toggle-view aria-expanded="${!isCollapsed}" aria-controls="srSeasonEpisodes${si}">
              <svg class="sr-season-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              <span class="sr-season-name">${seasonName}</span>
              <span class="sr-season-count">${watchedInSeason}/${eps.length} · ${eps.length} ep</span>
            </button>
            ${eps.length ? `<button type="button" class="sr-season-mark" data-season-mark="${si}" aria-label="${seasonDone ? `Desmarcar ${seasonName}` : `Marcar ${seasonName} completa como vista`}">${seasonDone ? 'Desmarcar' : '✓ Temporada'}</button>` : ''}
          </div>
          <div class="sr-episodes-grid" id="srSeasonEpisodes${si}">${epsHtml}</div>
        </div>`;
      }).join('')}
    </section>
  `;
}

function renderMovieSection(item) {
  const link = playUrl(item);
  if (!link) return '';
  return `
    <section class="sr-detail-section">
      <div class="sr-movie-info">
        <div class="sr-movie-info-card">
          <div><span class="sr-movie-k">Reproducción</span><span class="sr-movie-v"><a class="sr-movie-link" href="${escapeHtml(link)}" target="_blank" rel="noopener">Ver contenido →</a></span></div>
        </div>
      </div>
    </section>
  `;
}

// ==========================================
// FAVORITOS
// ==========================================
function toggleFavorite(itemId) {
  if (favorites.has(itemId)) favorites.delete(itemId);
  else favorites.add(itemId);
  saveFavs();
  const item = catalog.find(i => i.id === itemId);
  showToast(item ? `${favorites.has(itemId) ? '❤ Añadida a favoritas' : 'Quitada de favoritas'}` : '', 'success');
  if (currentDetailId === itemId) { const cur = catalog.find(c => c.id === itemId); if (cur) renderDetail(cur); }
  else renderAll();
}

// ==========================================
// ADMIN — EDITOR COMPLETO
// ==========================================
function openEditor(itemId) {
  const item = itemId ? catalog.find(i => i.id === itemId) : null;
  const modal = page.querySelector('#seriesModal');
  modal.querySelector('#srEditId').value = item ? item.id : '';
  modal.querySelector('#srModalTitle').textContent = item ? 'Editar contenido' : 'Añadir contenido';
  modal.querySelector('#srTipo').value = item ? item.tipo : 'serie';
  modal.querySelector('#srTitulo').value = item ? (item.titulo || '') : '';
  modal.querySelector('#srDesc').value = item ? (item.descripcion || '') : '';
  modal.querySelector('#srPortada').value = item ? (item.portada || '') : '';
  modal.querySelector('#srBanner').value = item ? (item.banner || '') : '';
  modal.querySelector('#srRecurso').value = item ? (item.recurso || '') : '';
  modal.querySelector('#srWeb').value = item ? (item.webUrl || '') : '';
  modal.querySelector('#srCategoria').value = item ? (item.categoria || '') : '';
  modal.querySelector('#srDestacado').checked = !!item?.destacado;

  // Panel temporadas
  const panel = modal.querySelector('#srSeasonsPanel');
  const isSerie = (item ? item.tipo : modal.querySelector('#srTipo').value) === 'serie';
  panel.style.display = isSerie ? 'block' : 'none';
  renderSeasonEditor(modal, item, itemId);

  modal.querySelector('#srTipo').onchange = (e) => {
    const s = e.target.value === 'serie';
    panel.style.display = s ? 'block' : 'none';
  };

  modal.style.display = 'flex';
}

function renderSeasonEditor(modal, item, itemId) {
  const box = modal.querySelector('#srSeasonsBox');
  let seasons = item ? getSeasons(item) : [];
  if (!seasons.length) seasons = [{ titulo: 'Temporada 1', episodios: [{ num: 1, titulo: 'Episodio 1' }] }];
  box.innerHTML = seasonEditorHTML(seasons);
  bindSeasonEditorEvents(box);
}

// ==========================================
// ELIMINAR — confirmación + limpieza completa
// ==========================================
function openDeleteConfirm(item) {
  const modal = page.querySelector('#deleteModal');
  if (!modal) return;
  modal.querySelector('#srDelTitle').textContent = item.titulo || 'Sin título';
  modal.querySelector('#srDelType').textContent = typeLabel(item);
  modal.style.display = 'flex';
  modal._itemId = item.id;
}

function closeDeleteConfirm() {
  const modal = page.querySelector('#deleteModal');
  if (modal) modal.style.display = 'none';
}

async function confirmDelete() {
  const modal = page.querySelector('#deleteModal');
  if (!modal || !modal._itemId) return;
  const itemId = modal._itemId;
  await deleteCatalogItem(itemId);
  catalog = await loadCatalog();
  favorites = loadFavorites();
  podioData = loadPodio();
  closeDeleteConfirm();
  currentDetailId = null;
  collapsedDetailSeasons.clear();
  render();
  renderAll();
  showToast('Eliminado ✓', 'success');
}

// ==========================================
// MAIN SHELL
// ==========================================
function render() {
  if (currentDetailId) {
    const item = catalog.find(i => i.id === currentDetailId);
    if (item) { renderDetail(item); return; }
    currentDetailId = null;
  }

  const seriesCount = catalog.filter(i => i.tipo === 'serie').length;
  const movieCount = catalog.filter(i => i.tipo === 'pelicula').length;

  page.innerHTML = `
    <div class="series-content">
      <div class="sr-topbar">
        <div class="sr-topbar-left">
          <div class="sr-page-heading">
            <span class="sr-page-emoji" aria-hidden="true">🎬</span>
            <h1 class="sr-page-title">Series y Películas</h1>
          </div>
          <div class="sr-page-stats">
            <span class="sr-stat-chip">${catalog.length} títulos</span>
            <span class="sr-stat-chip">${seriesCount} series</span>
            <span class="sr-stat-chip">${movieCount} películas</span>
          </div>
        </div>
        ${userStore.isAdmin ? `<div class="sr-topbar-actions">
          <button class="sr-icon-btn sr-icon-btn--add" id="srAddBtn" aria-label="Añadir contenido" title="Añadir contenido">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          </button>
        </div>` : ''}
      </div>

      <div class="sr-view-tabs" role="tablist" aria-label="Vistas de la sección">
        <button class="sr-view-tab ${currentView === 'home' ? 'active' : ''}" data-view="home" role="tab" id="srTabHome" aria-controls="srViewHome" aria-selected="${currentView === 'home'}" tabindex="${currentView === 'home' ? 0 : -1}">Inicio</button>
        <button class="sr-view-tab ${currentView === 'catalog' ? 'active' : ''}" data-view="catalog" role="tab" id="srTabCatalog" aria-controls="srViewCatalog" aria-selected="${currentView === 'catalog'}" tabindex="${currentView === 'catalog' ? 0 : -1}">Catálogo</button>
        <button class="sr-view-tab ${currentView === 'top5' ? 'active' : ''}" data-view="top5" role="tab" id="srTabTop5" aria-controls="srViewTop5" aria-selected="${currentView === 'top5'}" tabindex="${currentView === 'top5' ? 0 : -1}">Mi Top 5</button>
      </div>

      <!-- Fase Pro: la lista que los dos veis y editáis (fila de content). -->
      <section class="pro-card" id="srSharedWatchlist" aria-label="Watchlist compartida" hidden></section>

      <div id="srViewHome" class="sr-view ${currentView === 'home' ? 'is-active' : ''}" role="tabpanel" aria-labelledby="srTabHome"></div>

      <div id="srViewCatalog" class="sr-view ${currentView === 'catalog' ? 'is-active' : ''}" role="tabpanel" aria-labelledby="srTabCatalog">
        <div class="sr-catalog-toolbar">
          <div class="sr-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="sr-search-icon"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="srSearch" class="sr-search-input" placeholder="Buscar por título, género, año…" value="${escapeHtml(searchTerm)}" autocomplete="off" aria-label="Buscar series y películas">
            ${searchTerm ? '<button class="sr-search-clear" id="srSearchClear" aria-label="Limpiar búsqueda">✕</button>' : ''}
          </div>
          <div class="sr-filter-chips" id="srFilterChips">
            <button class="sr-chip ${currentFilter === 'todo' ? 'active' : ''}" data-filter="todo">Todo</button>
            <button class="sr-chip ${currentFilter === 'serie' ? 'active' : ''}" data-filter="serie">Series</button>
            <button class="sr-chip ${currentFilter === 'pelicula' ? 'active' : ''}" data-filter="pelicula">Películas</button>
            <button class="sr-chip ${currentFilter === 'favoritas' ? 'active' : ''}" data-filter="favoritas">❤ Favoritas</button>
            <button class="sr-chip ${currentFilter === 'encurso' ? 'active' : ''}" data-filter="encurso">En curso</button>
            <button class="sr-chip ${currentFilter === 'vistas' ? 'active' : ''}" data-filter="vistas">✓ Vistas</button>
            <button class="sr-chip ${currentFilter === 'porver' ? 'active' : ''}" data-filter="porver">Por ver</button>
          </div>
        </div>
        <div class="sr-catalog-tools">
          <label class="sr-sort" for="srSort">
            <span class="sr-sort-label">Ordenar</span>
            <select id="srSort" class="sr-sort-select">
              <option value="recent" ${currentSort === 'recent' ? 'selected' : ''}>Recientes</option>
              <option value="az" ${currentSort === 'az' ? 'selected' : ''}>A – Z</option>
              <option value="progress" ${currentSort === 'progress' ? 'selected' : ''}>Más avanzadas</option>
              <option value="rating" ${currentSort === 'rating' ? 'selected' : ''}>Mejor valoradas</option>
            </select>
          </label>
        </div>
        <div id="srCatalogResults"></div>
        <div id="srTmdbResults"></div>
      </div>

      <div id="srViewTop5" class="sr-view ${currentView === 'top5' ? 'is-active' : ''}" role="tabpanel" aria-labelledby="srTabTop5"></div>
    </div>

    <!-- Editor completo -->
    <div class="modal-overlay" id="seriesModal" style="display:none;">
      <div class="modal-content sr-modal">
        <button class="close-modal" id="srCloseModal" aria-label="Cerrar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        <h2 id="srModalTitle">Añadir contenido</h2>
        <input type="hidden" id="srEditId">
        <div class="sr-form-grid">
          <div class="form-group"><label for="srTitulo">Título *</label><input type="text" id="srTitulo" class="form-input" required aria-required="true"></div>
          <div class="form-group"><label for="srTipo">Tipo</label><select id="srTipo" class="form-input"><option value="serie">Serie</option><option value="pelicula">Película</option></select></div>
        </div>
        <div class="form-group"><label for="srCategoria">Categoría (sección del inicio)</label><input type="text" id="srCategoria" class="form-input" placeholder="Dragon Ball, Disney, Marvel…"></div>
        <div class="form-group"><label for="srDesc">Descripción</label><textarea id="srDesc" class="form-input" rows="3"></textarea></div>
        <div class="sr-form-grid">
          <div class="form-group"><label for="srPortada">URL portada (2:3)</label><input type="url" id="srPortada" class="form-input" placeholder="https://..."></div>
          <div class="form-group"><label for="srBanner">URL banner (16:9)</label><input type="url" id="srBanner" class="form-input" placeholder="https://..."></div>
        </div>
        <div class="form-group"><label for="srRecurso">Enlace de reproducción</label><input type="url" id="srRecurso" class="form-input" placeholder="https://..."></div>
        <div class="form-group"><label for="srWeb">Web del proyecto / página</label><input type="url" id="srWeb" class="form-input" placeholder="https://..."></div>
        <div class="sr-form-check"><label class="sr-check"><input type="checkbox" id="srDestacado"> Destacar en el inicio de la sección</label></div>

        <div id="srSeasonsPanel" style="display:none;">
          <div class="sr-form-seasons-head">
            <h4>Temporadas y episodios</h4>
            <button class="sr-btn-add-season" id="srAddSeason">+ Añadir temporada</button>
          </div>
          <div id="srSeasonsBox"></div>
        </div>

        <div class="form-actions sr-modal-actions">
          <button class="btn-secondary" id="srCancelBtn">Cancelar</button>
          <button class="btn-primary" id="srSaveBtn">Guardar serie</button>
        </div>
      </div>
    </div>

    <!-- Top 5 editor -->
    <div class="modal-overlay" id="top5Modal" style="display:none;">
      <div class="modal-content sr-modal">
        <button class="close-modal" id="srCloseTop5" aria-label="Cerrar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        <h2>🏆 Editar Top 5</h2>
        <p class="sr-modal-sub">Ordena tus favoritos con ↑ ↓, quita con ✕ y añade desde el selector.</p>
        <div id="top5EditList"></div>
        <div class="form-actions">
          <button class="btn-secondary" id="srCancelTop5">Cancelar</button>
          <button class="btn-primary" id="top5SaveBtn">Guardar</button>
        </div>
      </div>
    </div>

  `;

  // La watchlist se pinta después del HTML: llega de Supabase (fila `content`)
  // y la primera vez puede tardar; la sección se queda oculta hasta tener algo.
  void pintarWatchlistCompartida();

  // Nav views (tabs accesibles: aria-selected + flechas ← →)
  const viewTabs = [...page.querySelectorAll('[data-view]')];
  const activateView = (btn) => {
    viewTabs.forEach(b => {
      const on = b === btn;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    currentView = btn.dataset.view;
    page.querySelectorAll('.sr-view').forEach(v => v.classList.remove('is-active'));
    const target = page.querySelector('#srView' + (currentView === 'home' ? 'Home' : currentView === 'catalog' ? 'Catalog' : 'Top5'));
    if (target) target.classList.add('is-active');
    // El hero solo rota mientras se ve el Inicio.
    if (currentView !== 'home') clearHeroTimer();
    renderAll();
  };
  viewTabs.forEach(btn => btn.addEventListener('click', () => activateView(btn)));
  page.querySelector('.sr-view-tabs')?.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const idx = viewTabs.indexOf(document.activeElement);
    const from = idx === -1 ? viewTabs.findIndex(b => b.dataset.view === currentView) : idx;
    const step = e.key === 'ArrowRight' ? 1 : -1;
    const next = viewTabs[(from + step + viewTabs.length) % viewTabs.length];
    next.focus();
    activateView(next);
  });

  page.querySelector('#srAddBtn')?.addEventListener('click', () => openEditor(null));

  // Search
  const searchInput = page.querySelector('#srSearch');
  const ensureClearBtn = () => {
    const wrap = searchInput?.closest('.sr-search');
    if (!wrap) return;
    let clearBtn = wrap.querySelector('.sr-search-clear');
    if (searchTerm && !clearBtn) {
      wrap.insertAdjacentHTML('beforeend', '<button class="sr-search-clear" id="srSearchClear" aria-label="Limpiar búsqueda">✕</button>');
      clearBtn = wrap.querySelector('.sr-search-clear');
      clearBtn.addEventListener('click', () => {
        searchTerm = '';
        render(); renderAll();
        page.querySelector('#srSearch')?.focus();
      });
    } else if (!searchTerm && clearBtn) {
      clearBtn.remove();
    }
  };
  ensureClearBtn();
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value;
      ensureClearBtn();
      renderCatalog();
      if (tmdbSearchTimer) clearTimeout(tmdbSearchTimer);
      const query = searchTerm.trim();
      tmdbSearchTimer = setTimeout(() => {
        tmdbSearchTimer = null;
        void loadTmdbCatalog(query.length >= 2 ? query : '');
      }, query.length >= 2 ? 350 : 0);
    });
  }
  page.querySelectorAll('[data-filter]').forEach(btn => btn.addEventListener('click', () => {
    page.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderCatalog();
    renderTmdbCatalog();
  }));

  page.querySelector('#srTmdbResults')?.addEventListener('click', event => {
    const modeButton = event.target.closest('[data-tmdb-mode]');
    if (modeButton) {
      tmdbMode = modeButton.dataset.tmdbMode === 'upcoming' ? 'upcoming' : 'trending';
      void loadTmdbCatalog('');
      return;
    }
    const button = event.target.closest('[data-tmdb-add]');
    if (!button || button.disabled) return;
    button.disabled = true;
    void addTmdbTitleToWatchlist(button.dataset.tmdbAdd).finally(() => {
      if (button.isConnected) button.disabled = false;
    });
  });

  // Orden del catálogo
  page.querySelector('#srSort')?.addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderCatalog();
  });

  // Editor save
  page.querySelector('#srSaveBtn')?.addEventListener('click', async () => {
    const titulo = page.querySelector('#srTitulo').value.trim();
    if (!titulo) { showToast('El título es obligatorio', 'error'); return; }
    const editId = page.querySelector('#srEditId').value;
    const urlFields = [
      ['portada', page.querySelector('#srPortada').value.trim()],
      ['banner', page.querySelector('#srBanner').value.trim()],
      ['recurso', page.querySelector('#srRecurso').value.trim()],
      ['webUrl', page.querySelector('#srWeb').value.trim()]
    ];
    const badUrl = urlFields.find(([, v]) => !isValidUrlField(v));
    if (badUrl) {
      showToast(`La URL de ${badUrl[0] === 'webUrl' ? 'enlace web' : badUrl[0]} no es válida (usa https://…)`, 'error');
      return;
    }
    const payload = {
      id: editId || createId(),
      titulo,
      tipo: page.querySelector('#srTipo').value,
      descripcion: page.querySelector('#srDesc').value.trim(),
      portada: urlFields[0][1],
      banner: urlFields[1][1],
      recurso: urlFields[2][1],
      webUrl: urlFields[3][1],
      categoria: page.querySelector('#srCategoria').value.trim(),
      destacado: page.querySelector('#srDestacado').checked
    };
    const isSerie = payload.tipo === 'serie';
    if (isSerie) payload.temporadas = collectSeasons(page.querySelector('#srSeasonsBox'));

    if (editId) {
      const idx = catalog.findIndex(i => i.id === editId);
      if (idx >= 0) catalog[idx] = { ...catalog[idx], ...payload };
    } else {
      payload.createdAt = Date.now();
      catalog.push(payload);
    }
    await saveData();
    page.querySelector('#seriesModal').style.display = 'none';
    render(); renderAll();
    showToast(editId ? 'Actualizado ✓' : 'Añadido ✓', 'success');
  });

  page.querySelector('#srAddSeason')?.addEventListener('click', () => {
    const box = page.querySelector('#srSeasonsBox');
    box.insertAdjacentHTML('beforeend', emptySeasonHTML());
  });

  // Nota: la delegación de temporadas/episodios ya está enlazada sobre
  // #srSeasonsBox (ver renderSeasonEditor). No volver a enlazar en page
  // o los eventos se duplicarían por burbujeo.

  ['#srCloseModal', '#srCancelBtn', '#srCloseTop5', '#srCancelTop5'].forEach(s => {
    page.querySelector(s)?.addEventListener('click', () => {
      page.querySelector('#seriesModal').style.display = 'none';
      page.querySelector('#top5Modal').style.display = 'none';
    });
  });
  page.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', (e) => {
    if (e.target === m) m.style.display = 'none';
  }));

  // Evita acumular listeners keydown entre render() repetidos
  if (page._keyHandler) document.removeEventListener('keydown', page._keyHandler);
  const keyHandler = (e) => {
    if (e.key !== 'Escape') return;
    const delModal = page.querySelector('#deleteModal');
    if (delModal && delModal.style.display === 'flex') { delModal.style.display = 'none'; return; }
    // En el detalle, los modales del shell no existen en el DOM (renderDetail
    // reemplaza el innerHTML completo) — optional chaining evita el crash.
    const seriesModal = page.querySelector('#seriesModal');
    if (seriesModal) seriesModal.style.display = 'none';
    const top5Modal = page.querySelector('#top5Modal');
    if (top5Modal) top5Modal.style.display = 'none';
    if (currentDetailId) { currentDetailId = null; render(); renderAll(); }
  };
  document.addEventListener('keydown', keyHandler);
  page._keyHandler = keyHandler;
  const origCleanup = page.cleanup;
  page.cleanup = () => { clearHeroTimer(); document.removeEventListener('keydown', keyHandler); if (origCleanup) origCleanup(); };
}

// ==========================================
// BINDINGS COMUNES
// ==========================================
function bindCards(root) {
  if (!root) return;
  root.querySelectorAll('.series-card').forEach(card => {
    const open = () => openDetail(card.dataset.id);
    // Un solo manejador: el botón que cubre la tarjeta (accesible con
    // teclado) y cualquier zona libre abren la ficha; las acciones propias
    // (favorito, play, ✓ +1) las gestionan sus botones.
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-card-fav], [data-card-play], [data-continue-add]')) return;
      open();
    });
    // Overlay estilo Netflix: play abre el detalle, corazón alterna favorita
    card.querySelector('[data-card-play]')?.addEventListener('click', (e) => { e.stopPropagation(); open(); });
    card.querySelector('[data-card-fav]')?.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(card.dataset.id); });
    // "Seguir viendo": marca el siguiente capítulo desde la propia tarjeta.
    card.querySelector('[data-continue-add]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      markNextEpisode(card.dataset.id);
    });
  });
}

function renderAll() {
  if (currentDetailId) return;
  // El hero del Inicio se crea dentro de renderHome (crea el slot #srFeatured primero)
  if (currentView === 'home') renderHome();
  else if (currentView === 'catalog') renderCatalog();
  else if (currentView === 'top5') renderTop5();
}

// ==========================================
// ICONOS
// ==========================================
const UI = {
  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
};

// ==========================================
// ENTRY
// ==========================================
/* ---------- Watchlist compartida (fase Pro) ---------- */

// Se carga una vez y se mantiene sincronizada con lo que se guarda aquí.
let sharedWatchlist = [];
// Solo se pide al servidor la primera vez: después manda lo que se acaba de
// guardar, sin una consulta por cada repintado.
let sharedWatchlistLoaded = false;

/** Pinta la lista compartida en la portada de Series (si tiene algo). */
async function pintarWatchlistCompartida() {
  const host = page.querySelector('#srSharedWatchlist');
  if (!host) return;
  if (!sharedWatchlistLoaded) {
    sharedWatchlist = await loadSharedWatchlist();
    sharedWatchlistLoaded = true;
  }
  if (!page.contains(host)) return;

  if (!sharedWatchlist.length) {
    host.hidden = true;
    host.innerHTML = '';
    return;
  }

  const pendientes = sharedWatchlist.filter(item => !item.done).length;
  host.hidden = false;
  host.innerHTML = `
    <header class="pro-card__head">
      <span class="pro-card__kicker">Watchlist compartida</span>
      <span class="pro-item__meta">${pendientes} ${pendientes === 1 ? 'pendiente' : 'pendientes'}</span>
    </header>
    <div class="pro-list">
      ${sharedWatchlist
        .map(
          item => `<div class="pro-item">
            ${
              item.poster
                ? `<img class="pro-item__poster" src="${escapeHtml(item.poster)}" alt="" loading="lazy" decoding="async">`
                : '<span class="pro-item__poster" aria-hidden="true"></span>'
            }
            <div class="pro-item__body">
              <div class="pro-item__title">${escapeHtml(item.title || 'Sin título')}</div>
              <div class="pro-item__meta">${item.done ? 'vista' : 'pendiente'}${
                item.addedBy ? ` · la añadió ${escapeHtml(item.addedBy)}` : ''
              }</div>
            </div>
            <button type="button" class="sr-chip" data-watch-done="${escapeHtml(item.id)}" aria-pressed="${item.done}">${item.done ? '✓ vista' : 'marcar vista'}</button>
            <button type="button" class="sr-chip" data-watch-del="${escapeHtml(item.id)}" aria-label="Quitar de la watchlist">✕</button>
          </div>`
        )
        .join('')}
    </div>`;

  // El detalle abierto también cambia de etiqueta sin repintar la página.
  const detailBtn = page.querySelector('#srWatchlistBtn');
  if (detailBtn && currentDetailId) {
    detailBtn.textContent = sharedWatchlist.some(entry => entry.id === currentDetailId)
      ? 'En la watchlist ✓'
      : '+ Watchlist compartida';
  }

  host.querySelectorAll('[data-watch-done]').forEach(btn => {
    btn.addEventListener('click', () => void marcarWatchlist(btn.dataset.watchDone));
  });
  host.querySelectorAll('[data-watch-del]').forEach(btn => {
    btn.addEventListener('click', () => void quitarWatchlist(btn.dataset.watchDel));
  });
}

/** Cambia el estado «vista» de una entrada y guarda la lista compartida. */
async function marcarWatchlist(id) {
  const prev = sharedWatchlist;
  sharedWatchlist = sharedWatchlist.map(item =>
    item.id === id ? { ...item, done: !item.done } : item
  );
  if (!(await saveSharedWatchlist(sharedWatchlist))) {
    sharedWatchlist = prev;
    showToast('No se pudo guardar la watchlist');
  }
  void pintarWatchlistCompartida();
}

/** Quita una entrada de la watchlist compartida. */
async function quitarWatchlist(id) {
  const prev = sharedWatchlist;
  sharedWatchlist = sharedWatchlist.filter(item => item.id !== id);
  if (!(await saveSharedWatchlist(sharedWatchlist))) {
    sharedWatchlist = prev;
    showToast('No se pudo guardar la watchlist');
  }
  void pintarWatchlistCompartida();
}

export function SeriesPage(router) {
  page = document.createElement('div');
  page.className = 'series-page';

  // Tiempo real: cuando el Admin cambia el catálogo (Supabase), todos los
  // usuarios lo ven al instante (realtime + polling de realtime.service).
  const offSeries = onContentChange(['series'], async () => {
    await loadData();
    if (!page.isConnected) return;
    if (currentDetailId) {
      const item = catalog.find(i => i.id === currentDetailId);
      if (item) { renderDetail(item); return; }
      currentDetailId = null;
    }
    render();
    renderAll();
  });
  // El hero deja de rotar al ocultar la pestaña del navegador y vuelve al
  // mostrarla (si seguimos en Inicio).
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') clearHeroTimer();
    else if (page.isConnected && currentView === 'home' && !currentDetailId) startHeroTimer();
  };
  document.addEventListener('visibilitychange', onVisibility);
  const origCleanup = page.cleanup;
  page.cleanup = () => {
    offSeries();
    document.removeEventListener('visibilitychange', onVisibility);
    if (origCleanup) origCleanup();
  };

  // Carga compartida: skeleton mientras llega Supabase
  page.innerHTML = `<div class="route-loading" role="status" aria-live="polite">
    <span class="route-loading__spinner" aria-hidden="true"></span>
    <span>Cargando catálogo…</span>
  </div>`;
  loadData().then(() => {
    if (!page.isConnected) return; // navegó mientras cargaba
    render();
    renderAll();
    void loadTmdbCatalog('');
    // Deep-link desde Inicio/Rincón (Seguir viendo): /series?id=<id> abre el detalle
    const deepId = router.currentRoute?.query?.id;
    if (deepId) {
      const item = catalog.find(i => String(i.id) === String(deepId));
      if (item) openDetail(item.id);
    }
  });
  void pintarWatchlistCompartida();

  return page;
}
