/* ==========================================
   Personal Hub v3 — Series & Movies (Streaming)
   Inicio con hero destacado + carruseles ·
   Catálogo grid 2:3 · Detalle con temporadas ·
   Top 5 editable · Búsqueda agrupada ·
   Admin completo en la propia sección
   ========================================== */

import { showToast } from '../components/Toast.js';
import { escapeHtml } from '../utils/escape.js';
import { userStore } from '../stores/user.store.js';
import { onContentChange } from '../services/realtime.service.js';
import {
  loadCatalog, saveCatalog, loadPodio, savePodio,
  loadFavorites, saveFavorites, loadProgressFor, saveProgressFor,
  createId, getSeasons, getTotal, getCompletedCount, getPercent,
  getStatusText, detectGenres, typeLabel, deleteCatalogItem, playUrl
} from '../services/seriesData.js';
import { seasonEditorHTML, collectSeasons, emptySeasonHTML, bindSeasonEditorEvents } from '../services/seriesEditor.js';
import { isValidUrlField } from '../utils/format.js';

let page = null;                       // elemento raíz (asignado en SeriesPage)
let catalog = [];
let podioData = { series: [], movies: [] };
let favorites = new Set();
let currentFilter = 'todo';
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

// ==========================================
// CARGA / PERSISTENCIA (delegada a seriesData)
// ==========================================

async function loadData() {
  // Catálogo COMPARTIDO (Supabase): ambos usuarios ven el mismo.
  catalog = await loadCatalog();
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
function cardHTML(item) {
  const hasCover = !!item.portada;
  const isFav = favorites.has(item.id);
  return `
    <div class="series-card" data-id="${escapeHtml(item.id)}" data-tipo="${escapeHtml(item.tipo)}" role="button" tabindex="0" aria-label="${escapeHtml(item.titulo || 'Sin título')}, ${typeLabel(item)}">
      <div class="series-card-cover">
        ${hasCover ? `<img src="${escapeHtml(item.portada)}" alt="" class="series-card-img" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
        <div class="series-card-fallback" style="${hasCover ? 'display:none' : 'display:flex'}">${escapeHtml((item.titulo || '?')[0])}</div>
        <div class="series-card-shade"></div>
        <!-- Overlay estilo Netflix: aparece en hover/focus con play + favorita -->
        <div class="series-card-overlay">
          <button type="button" class="series-card-play" data-card-play aria-label="Abrir ${escapeHtml(item.titulo || 'Sin título')}" title="Abrir">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </button>
          <button type="button" class="series-card-heart ${isFav ? 'is-on' : ''}" data-card-fav aria-label="${isFav ? 'Quitar de favoritas' : 'Añadir a favoritas'}" title="${isFav ? 'Quitar de favoritas' : 'Añadir a favoritas'}">${isFav ? '❤' : '🤍'}</button>
        </div>
        ${item.tipo === 'serie' && getPercent(item) > 0 ? `<div class="series-card-progress"><div style="width:${getPercent(item)}%"></div></div>` : ''}
      </div>
      <div class="series-card-meta">
        <div class="series-card-title">${escapeHtml(item.titulo || 'Sin título')}</div>
        <div class="series-card-sub">
          <span>${typeLabel(item)}</span>
          ${item.tipo === 'serie' && getTotal(item) > 0 ? `<span class="dot">·</span><span>${getTotal(item)} ep</span>` : ''}
        </div>
      </div>
    </div>
  `;
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

  container.innerHTML = `
    <div class="sr-hero" data-id="${escapeHtml(featured.id)}">
      ${featured.banner || featured.portada
        ? `<img src="${escapeHtml(featured.banner || featured.portada)}" alt="" class="sr-hero-bg" loading="eager" fetchpriority="high" decoding="async" onerror="if(this.src!==this.dataset.fb){this.dataset.fb=this.src;this.src='${escapeHtml(featured.portada || '')}';}">`
        : ''}
      <div class="sr-hero-shade"></div>
      <div class="sr-hero-body">
        <div class="sr-hero-tags">
          ${isContinue ? '<span class="sr-hero-badge">▶ Seguir viendo</span>' : ''}
          <span class="sr-hero-badge">${typeLabel(featured)}</span>
          ${featured.tipo === 'serie' && getTotal(featured) > 0 ? `<span class="sr-hero-badge">${getTotal(featured)} ep</span>` : ''}
        </div>
        <h2 class="sr-hero-title">${escapeHtml(featured.titulo || 'Sin título')}</h2>
        <p class="sr-hero-desc">${escapeHtml(featured.descripcion || (featured.tipo === 'serie' ? `${getStatusText(featured) || ''} — Explora esta serie y marca tus episodios vistos.` : 'Disfruta de esta película cuando quieras.'))}</p>
        <div class="sr-hero-actions">
          <button class="sr-hero-play" data-hero="play">▶ ${isContinue ? 'Continuar' : (featured.tipo === 'serie' && getTotal(featured) > 0 ? 'Ver' : 'Reproducir')}</button>
          <button class="sr-hero-fav ${isFav ? 'is-on' : ''}" data-hero="fav" aria-label="Favorito">${isFav ? '❤' : '🤍'}</button>
        </div>
      </div>
    </div>
  `;

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

// ==========================================
// HOME (Inicio streaming)
// ==========================================
function renderHome() {
  const root = page.querySelector('#srViewHome');
  if (!root) return;
  const inProgress = catalog.filter(i => { const t = getTotal(i); return t > 0 && getCompletedCount(i.id, t) > 0 && getCompletedCount(i.id, t) < t; });
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
  heroPool = heroMode === 'continue' ? [...inProgress] : [...catalog].sort(() => Math.random() - 0.5);
  heroIndex = 0;
  clearHeroTimer();
  if (heroPool.length > 1) heroTimer = window.setInterval(rotateHero, 10000);
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
    gridSectionHTML('Seguir viendo', inProgress, '▶', 'srContinueWatching') +
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
function renderCatalog() {
  const root = page.querySelector('#srCatalogResults');
  if (!root) return;
  let filtered = [...catalog];
  if (searchTerm) {
    const q = searchTerm.toLowerCase();
    filtered = filtered.filter(i =>
      (i.titulo || '').toLowerCase().includes(q) ||
      (i.descripcion || '').toLowerCase().includes(q) ||
      String(i.anio || '').includes(q) ||
      detectGenres(i).some(g => g.toLowerCase().includes(q)) ||
      (i.webUrl || '').toLowerCase().includes(q)
    );
  }
  if (currentFilter === 'serie') filtered = filtered.filter(i => i.tipo === 'serie');
  else if (currentFilter === 'pelicula') filtered = filtered.filter(i => i.tipo === 'pelicula');
  else if (currentFilter === 'favoritas') filtered = filtered.filter(i => favorites.has(i.id));

  // Resultados agrupados por tipo cuando hay búsqueda
  if (searchTerm) {
    const series = filtered.filter(i => i.tipo === 'serie');
    const movies = filtered.filter(i => i.tipo === 'pelicula');
    if (!filtered.length) {
      root.innerHTML = `
        <div class="sr-search-empty">
          <div class="sr-empty-icon">🔍</div>
          <h3>Sin resultados para «${escapeHtml(searchTerm)}»</h3>
          <p>Prueba con otro título, género, año o descripción.</p>
        </div>`;
      return;
    }
    let html = `<div class="sr-search-summary">${filtered.length} resultado${filtered.length === 1 ? '' : 's'} para «${escapeHtml(searchTerm)}»</div>`;
    if (series.length) html += `<div class="sr-group"><div class="sr-group-title">Series <span>${series.length}</span></div><div class="series-flat-grid">${series.map(cardHTML).join('')}</div></div>`;
    if (movies.length) html += `<div class="sr-group"><div class="sr-group-title">Películas <span>${movies.length}</span></div><div class="series-flat-grid">${movies.map(cardHTML).join('')}</div></div>`;
    root.innerHTML = html;
    bindCards(root);
    return;
  }

  if (!filtered.length) {
    root.innerHTML = `
      <div class="sr-empty">
        <div class="sr-empty-icon">🎞️</div>
        <h3>${currentFilter === 'favoritas' ? 'Aún no tienes favoritas' : 'Aún no hay contenido'}</h3>
        <p>${currentFilter === 'favoritas' ? 'Toca el corazón de cualquier título para guardarlo aquí.' : 'Añade tu primera serie o película desde el botón +.'}</p>
      </div>`;
    return;
  }

  root.innerHTML = `<div class="series-flat-grid">${filtered.map(cardHTML).join('')}</div>`;
  bindCards(root);
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
  const related = catalog.filter(i => i.id !== item.id && detectGenres(i).some(g => detectGenres(item).includes(g))).slice(0, 10);

  page.innerHTML = `
    <div class="sr-detail">
      <div class="sr-detail-hero">
        ${item.banner || item.portada ? `<img src="${escapeHtml(item.banner || item.portada)}" alt="" class="sr-detail-hero-bg" fetchpriority="high" decoding="async" onerror="if(this.src!==this.dataset.fb){this.dataset.fb=this.src;this.src='${escapeHtml(item.portada || '')}';}">` : ''}
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
            </div>
            <h1 class="sr-detail-title">${escapeHtml(item.titulo || 'Sin título')}</h1>
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

  page.querySelector('#srBackBtn')?.addEventListener('click', () => { currentDetailId = null; collapsedDetailSeasons.clear(); render(); renderAll(); });
  page.querySelector('#srDetailFav')?.addEventListener('click', () => toggleFavorite(item.id));
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
  // Continuar → salta al siguiente capítulo sin ver
  page.querySelector('#srStickyGoNext')?.addEventListener('click', () => {
    const next = (prog.watched || []).length + 1;
    const target = page.querySelector(`.sr-ep-card[data-ep="${next}"]`) || page.querySelector('.sr-season');
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
  page.querySelectorAll('.sr-detail-related .series-card').forEach(card => {
    const open = () => openDetail(card.dataset.id);
    card.addEventListener('click', open);
    card.querySelector('[data-card-play]')?.addEventListener('click', (e) => { e.stopPropagation(); open(); });
    card.querySelector('[data-card-fav]')?.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(card.dataset.id); });
  });
}

function renderStickyProgress(item, total, watched, percent) {
  const done = watched.length;
  const next = done < total ? done + 1 : total;
  const status = done >= total ? 'Completada' : `Vas por el capítulo ${next} de ${total}`;
  const label = done >= total ? '✓ ' + status : `▶ ${status} · ${Math.round(percent)}%`;
  return `
    <div class="sr-sticky-progress" id="srStickyProgress">
      <div class="sr-sticky-progress-fill" style="width:${percent}%"></div>
      <div class="sr-sticky-progress-body">
        <span class="sr-sticky-progress-label">${label}</span>
        ${done < total ? `<button class="sr-sticky-progress-btn" id="srStickyGoNext">Continuar <span>→</span></button>` : ''}
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
        return `
        <div class="sr-season ${isCollapsed ? 'is-collapsed' : ''}" data-season="${si}">
          <button type="button" class="sr-season-head" data-season-toggle-view aria-expanded="${!isCollapsed}" aria-controls="srSeasonEpisodes${si}">
            <svg class="sr-season-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            <span class="sr-season-name">${escapeHtml(season.titulo || `Temporada ${si + 1}`)}</span>
            <span class="sr-season-count">${watchedInSeason}/${eps.length} · ${eps.length} ep</span>
          </button>
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

      <div class="sr-view-tabs" role="tablist">
        <button class="sr-view-tab ${currentView === 'home' ? 'active' : ''}" data-view="home" role="tab">Inicio</button>
        <button class="sr-view-tab ${currentView === 'catalog' ? 'active' : ''}" data-view="catalog" role="tab">Catálogo</button>
        <button class="sr-view-tab ${currentView === 'top5' ? 'active' : ''}" data-view="top5" role="tab">Mi Top 5</button>
      </div>

      <div id="srViewHome" class="sr-view ${currentView === 'home' ? 'is-active' : ''}"></div>

      <div id="srViewCatalog" class="sr-view ${currentView === 'catalog' ? 'is-active' : ''}">
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
          </div>
        </div>
        <div id="srCatalogResults"></div>
      </div>

      <div id="srViewTop5" class="sr-view ${currentView === 'top5' ? 'is-active' : ''}"></div>
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

  // Nav views
  page.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => {
    page.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentView = btn.dataset.view;
    page.querySelectorAll('.sr-view').forEach(v => v.classList.remove('is-active'));
    const target = page.querySelector('#srView' + (currentView === 'home' ? 'Home' : currentView === 'catalog' ? 'Catalog' : 'Top5'));
    if (target) target.classList.add('is-active');
    renderAll();
  }));

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
    });
  }
  page.querySelectorAll('[data-filter]').forEach(btn => btn.addEventListener('click', () => {
    page.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderCatalog();
  }));

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
  root.querySelectorAll('.series-card').forEach(card => {
    const open = () => openDetail(card.dataset.id);
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    // Overlay estilo Netflix: play abre el detalle, corazón alterna favorita
    card.querySelector('[data-card-play]')?.addEventListener('click', (e) => { e.stopPropagation(); open(); });
    card.querySelector('[data-card-fav]')?.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(card.dataset.id); });
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
  const origCleanup = page.cleanup;
  page.cleanup = () => { offSeries(); if (origCleanup) origCleanup(); };

  // Carga compartida: skeleton mientras llega Supabase
  page.innerHTML = `<div class="route-loading" role="status" aria-live="polite">
    <span class="route-loading__spinner" aria-hidden="true"></span>
    <span>Cargando catálogo…</span>
  </div>`;
  loadData().then(() => {
    if (!page.isConnected) return; // navegó mientras cargaba
    render();
    renderAll();
    // Deep-link desde Inicio/Rincón (Seguir viendo): /series?id=<id> abre el detalle
    const deepId = router.currentRoute?.query?.id;
    if (deepId) {
      const item = catalog.find(i => String(i.id) === String(deepId));
      if (item) openDetail(item.id);
    }
  });
  return page;
}
