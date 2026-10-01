/* ==========================================
   Rincon — Curiosidades
   Enciclopedia de San Juan Pueblo, San Petersburgo y gatos: landing, categorias,
   detalle, escenas SVG y el visor de datos. Es la vista mas grande del Rincon
   y la unica que dibuja su propio encapsulated HTML.
   ========================================== */

import { SPB_DATA, CURIOSIDADES_DATA, CURIOSIDADES_EXTRA } from '../../services/rincon-data.js';
import { db } from '../../services/db.service.js';
import { showToast } from '../../components/Toast.js';
import { escapeHtml, safeUrl } from '../../utils/escape.js';
import { openLightbox } from '../../components/MediaLightbox.js';
import { renderPageHeader } from '../../components/PageHeader.js';
import { todayISO } from '../../utils/format.js';
import { userPrefKey } from '../../utils/userStorage.js';
import { ICON_SVGS } from './icons.js';
import { state } from './state.js';
import { GATO_IMG, SPB_IMG, SPB_CAPTIONS, GATO_CAPTIONS } from './media.data.js';
import { CATEGORIES, DISCO_CATEGORIES, EXTRA_CAT_LABELS } from './curiosities.data.js';

/** Favoritas de curiosidades guardadas en localStorage (user-scoped). El
 *  orquestador las carga al montar la pagina, antes de crear el factory. */
export function loadCurioFavs() {
  try { return new Set(JSON.parse(localStorage.getItem(userPrefKey('curioFavs')) || '[]')); }
  catch { return new Set(); }
}

export function createCuriosities(ctx) {
  const {
    page, router, isAdmin, render,
    getDatoViewerKeyHandler, setDatoViewerKeyHandler
  } = ctx;

  function renderCuriosidades() {
    if (state.curioDetail) {
      renderCuriosidadDetail(state.curioDetail);
    } else if (state.curiosidadTab === 'landing') {
      renderCuriosidadesLanding();
    } else {
      renderCuriosidadesCategory(state.curiosidadTab);
    }
  }
  
  // ==========================================
  // CURIOSIDADES — datos auxiliares del landing
  // ==========================================
  
  // Chips de categoría (con icono SVG, sin emojis)
  const DISCO_CATEGORIES = [
    { id: 'todas', label: 'Todas', icon: 'sparkles', match: [] },
    { id: 'lugares', label: 'Lugares', icon: 'globe', match: ['honduras', 'atlántida', 'pueblo', 'río', 'rusia', 'ciudad', 'imperial', 'puentes'] },
    { id: 'historia', label: 'Historia', icon: 'landmark', match: ['historia', 'cronología', 'fundación', 'pirámides', 'muralla', 'antigüedad'] },
    { id: 'comida', label: 'Comida', icon: 'utensils-crossed', match: ['comida', 'gastronomía', 'gastronómico', 'chocolate', 'vainilla', 'cacao'] },
    { id: 'animales', label: 'Animales', icon: 'paw', match: ['felino', 'mascota', 'animal', 'tortugas', 'pulpos', 'mar', 'biología'] },
    { id: 'datos', label: 'Datos curiosos', icon: 'lightbulb', match: ['estadística', 'dato', 'curiosidad', 'espacio', 'astronautas'] },
    { id: 'ciencia', label: 'Ciencia', icon: 'flask', match: ['ciencia', 'aurora', 'física'] },
    { id: 'cultura', label: 'Cultura', icon: 'leaf', match: ['cultura', 'tradiciones', 'tolupán'] }
  ];
  
  // Etiqueta legible para cada categoría de CURIOSIDADES_EXTRA
  const EXTRA_CAT_LABELS = {
    historia: 'Historia', comida: 'Comida', animales: 'Animales',
    ciencia: 'Ciencia', datos: 'Datos curiosos', lugares: 'Lugares', cultura: 'Cultura'
  };
  
  // ==========================================
  // FAVORITAS de curiosidades (user-scoped)
  // ==========================================
  function saveCurioFavs() {
    try { localStorage.setItem(userPrefKey('curioFavs'), JSON.stringify([...state.curioFavs])); } catch { /* quota */ }
  }
  function toggleCurioFav(id) {
    if (state.curioFavs.has(id)) state.curioFavs.delete(id);
    else state.curioFavs.add(id);
    saveCurioFavs();
    return state.curioFavs.has(id);
  }
  
  // Items "Añadido recientemente": colecciones con portada + extras con imagen
  function buildRecentItems() {
    const items = [];
    if (SPB_DATA?.galeriaSPB?.[0]) {
      items.push({ id: 'spb-intro', cat: 'lugares', category: 'Lugares', title: 'San Juan Pueblo, Atlántida', text: SPB_DATA.intro.slice(0, 120) + '…', img: SPB_DATA.galeriaSPB[0].src });
    }
    if (CURIOSIDADES_DATA.sanPetersburgo?.galeria?.[0]) {
      items.push({ id: 'sp-intro', cat: 'lugares', category: 'Lugares', title: 'San Petersburgo, la Venecia del Norte', text: CURIOSIDADES_DATA.sanPetersburgo.intro.slice(0, 120) + '…', img: CURIOSIDADES_DATA.sanPetersburgo.galeria[0].src });
    }
    if (GATO_IMG[0]) {
      items.push({ id: 'gatos-intro', cat: 'animales', category: 'Animales', title: 'Enciclopedia Gatuna 🐱', text: CURIOSIDADES_DATA.gatos.intro.slice(0, 120) + '…', img: GATO_IMG[0] });
    }
    CURIOSIDADES_EXTRA.forEach(x => {
      items.push({ id: 'extra-' + x.id, cat: x.cat, category: EXTRA_CAT_LABELS[x.cat] || 'Curiosidad', title: x.title, text: x.text, img: x.img, src: x.src || null });
    });
    return items;
  }
  
  // Piscina para "Curiosidad del día": años de la cronología, datos y extras
  function buildDayPool() {
    const pool = [];
    (SPB_DATA.timeline || []).forEach(t => pool.push({
      number: t.year, text: t.desc, place: 'San Juan Pueblo',
      img: SPB_DATA.galeriaSPB?.[0]?.src || '', catId: 'spb'
    }));
    (CURIOSIDADES_DATA.sanPetersburgo?.datos || []).forEach(d => pool.push({
      number: d.titulo, text: d.texto, place: 'San Petersburgo',
      img: CURIOSIDADES_DATA.sanPetersburgo?.galeria?.[0]?.src || '', catId: 'sp'
    }));
    (CURIOSIDADES_DATA.gatos?.datos || []).forEach(d => pool.push({
      number: d.titulo, text: d.texto, place: 'Enciclopedia Gatuna',
      img: GATO_IMG[0] || '', catId: 'gatos'
    }));
    CURIOSIDADES_EXTRA.forEach(x => pool.push({
      number: x.title, text: x.text, place: EXTRA_CAT_LABELS[x.cat] || 'Curiosidad',
      img: x.img, catId: null, itemId: 'extra-' + x.id
    }));
    return pool;
  }
  
  // Selección determinista por fecha: misma curiosidad todo el día
  function getCuriosidadDelDia() {
    const pool = buildDayPool();
    if (!pool.length) return null;
    // Día español (Europe/Madrid): la misma curiously aparece a todo el
    // mundo el mismo día, aunque el dispositivo esté en otro huso.
    const iso = todayISO();
    const seed = Number(iso.slice(0, 4)) * 10000 + Number(iso.slice(5, 7)) * 100 + Number(iso.slice(8, 10));
    return pool[seed % pool.length];
  }
  
  // Stats del landing: cifras reales derivadas de los datos
  function buildCurioStats() {
    const all = buildAllCurioItems();
    // "Lugares" = curiosidades de las colecciones de lugares (SJP + San Petersburgo)
    const lugares = all.filter(i => i.category === 'San Juan Pueblo' || i.category === 'San Petersburgo').length;
    return [
      { icon: 'book', value: all.length + CURIOSIDADES_EXTRA.length, label: 'Curiosidades' },
      { icon: 'globe', value: DISCO_CATEGORIES.length - 1, label: 'Categorías' },
      { icon: 'map-pin', value: lugares, label: 'Lugares' },
      { icon: 'bookmark', value: state.curioFavs.size, label: 'Favoritas' }
    ];
  }
  
  // ==========================================
  // CURIOSIDADES — landing (mockup: hero, búsqueda, categorías,
  // curiosidad del día, stats, colecciones, recientes, temas, banner)
  // ==========================================
  function renderCuriosidadesLanding() {
    const dayItem = getCuriosidadDelDia();
    const recentItems = buildRecentItems();
    const stats = buildCurioStats();
  
    // Conteo real por chip (misma lógica de filtrado que applyFilters)
    const chipCounts = {};
    DISCO_CATEGORIES.forEach(c => {
      if (c.id === 'todas') { chipCounts[c.id] = recentItems.length; return; }
      chipCounts[c.id] = recentItems.filter(it => c.match.some(m => (it.title + ' ' + it.text + ' ' + it.category).toLowerCase().includes(m))).length;
    });
  
    page.innerHTML = `<div class="rincon-subpage">
      <div class="curio-topbar">
        <button class="icon-btn" type="button" data-back="landing" aria-label="Volver al Rincón">${ICON_SVGS['chevron-left']}</button>
        <h1 class="scr-title">Curiosidades</h1>
      </div>
  
      <header class="curio-hero">
        <div class="curio-hero-copy">
          <span class="curio-hero-eyebrow">${ICON_SVGS['sparkles']} Explora y aprende</span>
          <h2 class="curio-hero-title">Cada lugar tiene una historia</h2>
          <p class="curio-hero-sub">Descubre datos increíbles sobre lugares, historia, comida, animales y mucho más.</p>
        </div>
        <div class="curio-hero-art" aria-hidden="true">
          <svg width="160" height="140" viewBox="0 0 160 140" fill="none" stroke="var(--theme-accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="70" cy="62" r="40"/>
            <ellipse cx="70" cy="62" rx="18" ry="40"/>
            <line x1="30" y1="62" x2="110" y2="62"/>
            <path d="M70 22a38 38 0 0 1 38 38" stroke="var(--theme-text-tertiary)"/>
            <circle cx="120" cy="42" r="16" stroke="var(--warm-amber)"/>
            <line x1="131" y1="53" x2="148" y2="70" stroke="var(--warm-amber)"/>
            <path d="M30 118h62l14 12H30z" stroke="var(--theme-text-secondary)"/>
            <path d="M30 118v-14M92 118v-14M44 118v-14M78 118v-14" stroke="var(--theme-text-tertiary)"/>
          </svg>
        </div>
      </header>
  
      <div class="curio-search-row">
        <div class="discovery-search">
          <span class="discovery-search-icon">${ICON_SVGS['search']}</span>
          <input type="text" class="discovery-search-input" id="discoGlobalSearch" placeholder="Buscar curiosidades..." autocomplete="off">
          <button class="discovery-search-clear" id="discoGlobalClear" style="display:none" aria-label="Limpiar búsqueda"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <button class="curio-filter-btn" id="curioFilterBtn" aria-label="Filtros" title="Filtros">${ICON_SVGS['sliders']}</button>
      </div>
      <p class="discovery-results-count" id="discoveryResultsCount"></p>
  
      <div class="disco-category-row" aria-label="Filtrar por categoría">
        ${DISCO_CATEGORIES.map(c => `<button class="disco-filter-chip${state.discoCat === c.id ? ' is-active' : ''}" data-disco-cat="${c.id}" role="tab" aria-selected="${state.discoCat === c.id ? 'true' : 'false'}"><span class="disco-filter-chip-icon">${ICON_SVGS[c.icon] || ''}</span>${c.label}<span class="disco-filter-chip-count">${chipCounts[c.id]}</span></button>`).join('')}
      </div>
  
      ${dayItem ? `
      <section class="curio-day-section" aria-label="Curiosidad del día">
        <span class="curio-day-eyebrow">${ICON_SVGS['sparkles']} CURIOSIDAD DEL DÍA</span>
        <button class="curio-day-card card animate-in" role="button" tabindex="0">
          <div class="curio-day-copy">
            <span class="curio-day-number">${escapeHtml(dayItem.number)}</span>
            <p class="curio-day-text">${escapeHtml(dayItem.text)}</p>
            <span class="curio-day-loc">${ICON_SVGS['map-pin']} ${escapeHtml(dayItem.place)} ${ICON_SVGS['arrow-right']}</span>
          </div>
          ${dayItem.img ? `<div class="curio-day-img"><img src="${safeUrl(dayItem.img)}" alt="" loading="eager"></div>` : ''}
        </button>
      </section>` : ''}
  
      <div class="curio-stats" aria-label="Estadísticas">
        ${stats.map((s, i) => `<article class="curio-stat-card card animate-in${s.icon === 'bookmark' ? ' is-fav' : ''}" style="--enter-delay:${i * 50}ms"${s.icon === 'bookmark' ? ' data-fav' : ''}>
          <span class="curio-stat-icon">${ICON_SVGS[s.icon] || ''}</span>
          <div class="curio-stat-body">
            <strong class="curio-stat-value">${s.value}</strong>
            <span class="curio-stat-label">${s.label}</span>
          </div>
        </article>`).join('')}
      </div>
  
      <section class="curio-section">
        <div class="curio-sec-head">
          <h3 class="curio-sec-title">Explora por colección</h3>
          <span class="curio-sec-link" data-scroll="curioCollGrid">Ver todas ${ICON_SVGS['arrow-right']}</span>
        </div>
        <div class="curio-coll-grid" id="curioCollGrid">
          ${CATEGORIES.map((cat, i) => renderCategoryCard(cat, i)).join('')}
        </div>
      </section>
  
      <section class="curio-section">
        <div class="curio-sec-head">
          <h3 class="curio-sec-title">Añadido recientemente</h3>
          <span class="curio-sec-link" data-scroll="curioRecentGrid">Ver todas ${ICON_SVGS['arrow-right']}</span>
        </div>
        <div class="curio-recent-grid" id="curioRecentGrid"></div>
      </section>
  
      <section class="curio-banner">
        <span class="curio-banner-icon">${ICON_SVGS['lightbulb']}</span>
        <div class="curio-banner-copy">
          <strong>¿Sabías que tu curiosidad te hace diferente?</strong>
          <span>Sigue explorando y aprendiendo cosas increíbles cada día.</span>
        </div>
        <button class="curio-banner-btn" id="curioBannerBtn">Descubrir más ${ICON_SVGS['arrow-right']}</button>
      </section>
    </div>`;
  
    page.querySelector('[data-back="landing"]').addEventListener('click', () => router.navigate('/rincon'));
  
    // Animate cards
    requestAnimationFrame(() => {
      page.querySelectorAll('.curio-day-card.animate-in, .curio-stat-card.animate-in, .curio-coll-card.animate-in, .curio-recent-card.animate-in').forEach(el => el.classList.add('visible'));
    });
  
    // Collection cards → categoría
    bindCategoryCardClicks(page);
  
    // Curiosidad del día → abre su colección (o el visor si es un dato suelto)
    const dayCard = page.querySelector('.curio-day-card');
    if (dayCard && dayItem) {
      const openDay = () => {
        if (dayItem.catId) { state.curiosidadTab = dayItem.catId; render(); }
        else if (dayItem.itemId) { state.curioDetail = dayItem.itemId; render(); }
        else { openDatoViewer([{ icon: 'lightbulb', title: dayItem.number, text: dayItem.text }], 0); }
      };
      dayCard.addEventListener('click', openDay);
      dayCard.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDay(); } });
    }
  
    // Búsqueda + chips filtran la cuadrícula de recientes
    const recentGrid = page.querySelector('#curioRecentGrid');
    const searchInput = page.querySelector('#discoGlobalSearch');
    const searchClear = page.querySelector('#discoGlobalClear');
    const resultsCount = page.querySelector('#discoveryResultsCount');
    const filterBtn = page.querySelector('#curioFilterBtn');
  
    const applyFilters = () => {
      const query = searchInput.value.trim().toLowerCase();
      const activeCat = DISCO_CATEGORIES.find(c => c.id === state.discoCat);
      let filtered = recentItems;
      if (activeCat && activeCat.id !== 'todas' && activeCat.match.length) {
        filtered = filtered.filter(item => {
          const haystack = (item.title + ' ' + item.text + ' ' + item.category).toLowerCase();
          return activeCat.match.some(m => haystack.includes(m));
        });
      }
      if (query) {
        filtered = filtered.filter(item =>
          item.title.toLowerCase().includes(query) ||
          item.text.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query)
        );
      }
      searchClear.style.display = query ? '' : 'none';
      updateResultsCount(filtered.length, recentItems.length, resultsCount);
      renderRecentGrid(recentGrid, filtered);
    };
  
    renderRecentGrid(recentGrid, recentItems);
    updateResultsCount(recentItems.length, recentItems.length, resultsCount);
  
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(applyFilters, 150);
    });
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      applyFilters();
      searchInput.focus();
    });
    const applyChip = (chip) => {
      const wasActive = chip.classList.contains('is-active');
      page.querySelectorAll('.disco-filter-chip').forEach(c => {
        c.classList.remove('is-active');
        c.setAttribute('aria-selected', 'false');
      });
      if (!wasActive) {
        chip.classList.add('is-active');
        chip.setAttribute('aria-selected', 'true');
        state.discoCat = chip.dataset.discoCat;
      } else {
        state.discoCat = 'todas';
      }
      applyFilters();
    };
    page.querySelectorAll('.disco-filter-chip').forEach(chip => {
      chip.addEventListener('click', () => applyChip(chip));
    });
  
    // Filtros: hace scroll a las categorías (el botón sliders del mockup)
    filterBtn.addEventListener('click', () => {
      page.querySelector('.disco-category-row')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  
    // "Ver todas" → scroll a la sección correspondiente
    page.querySelectorAll('.curio-sec-link').forEach(link => {
      link.addEventListener('click', () => {
        const target = page.querySelector('#' + link.dataset.scroll);
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  
    // Banner "Descubrir más" → abre la curiosidad del día
    const bannerBtn = page.querySelector('#curioBannerBtn');
    if (bannerBtn) {
      bannerBtn.addEventListener('click', () => {
        if (dayItem?.catId) { state.curiosidadTab = dayItem.catId; render(); }
        else if (dayItem?.itemId) { state.curioDetail = dayItem.itemId; render(); }
        else if (dayItem) { openDatoViewer([{ icon: 'lightbulb', title: dayItem.number, text: dayItem.text }], 0); }
        else { page.querySelector('.curio-day-section')?.scrollIntoView({ behavior: 'smooth' }); }
      });
    }
  }
  
  // Tarjetas de colección — verticales con foto de fondo (mockup)
  function renderCategoryCard(cat, index) {
    const img = cat.heroImg;
    const delay = index * 0.08;
    return `<button class="curio-coll-card card animate-in" style="--enter-delay:${delay}s;--disco-color:${cat.accentColor}" data-cat="${cat.id}">
      <div class="curio-coll-visual">
        ${img
          ? `<img src="${safeUrl(img)}" alt="${escapeHtml(cat.title)}" loading="lazy" decoding="async">`
          : `<div class="curio-coll-emoji-wrap"><span class="curio-coll-emoji">${cat.emoji}</span></div>`
        }
        <div class="curio-coll-overlay"></div>
        <span class="curio-coll-icon" style="color:${cat.accentColor}">${ICON_SVGS[cat.iconKey] || ''}</span>
      </div>
      <div class="curio-coll-body">
        <h3 class="curio-coll-title">${cat.title}</h3>
        <p class="curio-coll-desc">${cat.desc}</p>
        <span class="curio-coll-count" style="color:${cat.accentColor}">${cat.statsCount} curiosidades</span>
      </div>
    </button>`;
  }
  
  function bindCategoryCardClicks(container) {
    container.querySelectorAll('.curio-coll-card').forEach(card => {
      card.addEventListener('click', () => {
        state.curiosidadTab = card.dataset.cat;
        render();
      });
    });
  }
  
  const CURIO_CAT_COLORS = {
    'San Juan Pueblo': 'var(--theme-accent-primary)', 'San Petersburgo': '#818cf8',
    'Lugares': 'var(--theme-accent-primary)', 'Historia': '#f59e0b', 'Comida': '#34d399',
    'Animales': '#f472b6', 'Ciencia': '#60a5fa', 'Datos curiosos': '#a78bfa', 'Cultura': '#4ade80', 'Curiosidad': 'var(--theme-accent-primary)'
  };
  
  /** HTML de una tarjeta-portada de curiosidad (abre su pestaña de detalle). */
  function recentCardHTML(item, i) {
    const catColor = CURIO_CAT_COLORS[item.category] || 'var(--theme-accent-primary)';
    const fav = state.curioFavs.has(item.id);
    return `<article class="curio-recent-card card animate-in" style="--enter-delay:${i * 40}ms" data-curio-id="${item.id}" role="button" tabindex="0" aria-label="Abrir: ${escapeHtml(item.title)}">
      <div class="curio-recent-img">
        <img src="${safeUrl(item.img)}" alt="" loading="lazy" onerror="this.closest('.curio-recent-img').classList.add('is-empty')">
        <button class="curio-recent-fav${fav ? ' is-on' : ''}" data-fav-id="${item.id}" aria-label="${fav ? 'Quitar de favoritas' : 'Añadir a favoritas'}" aria-pressed="${fav}">${ICON_SVGS['bookmark']}</button>
        <span class="curio-recent-badge" style="background:${catColor}">${item.category}</span>
      </div>
      <div class="curio-recent-body">
        <h4 class="curio-recent-title">${escapeHtml(item.title)}</h4>
        <p class="curio-recent-text">${escapeHtml(item.text.slice(0, 110))}${item.text.length > 110 ? '…' : ''}</p>
      </div>
    </article>`;
  }
  
  // Cuadrícula "Añadido recientemente" — portadas que abren su pestaña de detalle
  function renderRecentGrid(grid, items) {
    if (!items.length) {
      grid.innerHTML = '<div class="empty-state">🔍 No se encontraron resultados. Prueba con otras palabras.</div>';
      return;
    }
    grid.innerHTML = items.map((item, i) => recentCardHTML(item, i)).join('');
    requestAnimationFrame(() => {
      grid.querySelectorAll('.curio-recent-card.animate-in').forEach(el => el.classList.add('visible'));
    });
    bindRecentCards(grid);
  }
  
  /** Clic en una tarjeta-portada → abre su pestaña (colección o detalle). */
  function bindRecentCards(grid) {
    grid.querySelectorAll('.curio-recent-card').forEach(card => {
      const open = () => {
        const id = card.dataset.curioId;
        if (!id) return;
        // Las portadas de colección llevan a su colección completa
        if (id === 'spb-intro') { state.curioDetail = null; state.curiosidadTab = 'spb'; render(); return; }
        if (id === 'sp-intro') { state.curioDetail = null; state.curiosidadTab = 'sp'; render(); return; }
        if (id === 'gatos-intro') { state.curioDetail = null; state.curiosidadTab = 'gatos'; render(); return; }
        state.curioDetail = id;
        render();
      };
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  
    // Bookmark = favorita (persistente por usuario, actualiza la stat de Favoritas)
    grid.querySelectorAll('.curio-recent-fav').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const on = toggleCurioFav(btn.dataset.favId);
        btn.classList.toggle('is-on', on);
        btn.setAttribute('aria-pressed', String(on));
        btn.setAttribute('aria-label', on ? 'Quitar de favoritas' : 'Añadir a favoritas');
        const statCard = page.querySelector('.curio-stat-card[data-fav]');
        if (statCard) statCard.querySelector('.curio-stat-value').textContent = state.curioFavs.size;
        showToast(on ? 'Añadida a favoritas 🤍' : 'Quitada de favoritas', on ? 'success' : 'info');
      });
    });
  }
  
  // ==========================================
  // CURIOSIDAD — pestaña de detalle (portada → información)
  // ==========================================
  function renderCuriosidadDetail(itemId) {
    const all = buildRecentItems();
    const item = all.find(i => i.id === itemId) || all.find(i => 'extra-' + i.id === itemId);
    if (!item) { state.curioDetail = null; render(); return; }
  
    const catColor = CURIO_CAT_COLORS[item.category] || 'var(--theme-accent-primary)';
    const fav = state.curioFavs.has(item.id);
    // Relacionadas: misma categoría (o cualquier otra si no hay)
    const related = all.filter(i => i.id !== item.id && i.category === item.category).slice(0, 4);
  
    page.innerHTML = `<div class="rincon-subpage">
      <div class="disco-breadcrumb">
        <button class="disco-breadcrumb-item" data-curio-nav="rincon">El Rincón</button>
        <span class="disco-breadcrumb-sep">/</span>
        <button class="disco-breadcrumb-item" data-curio-nav="curiosidades">Curiosidades</button>
        <span class="disco-breadcrumb-sep">/</span>
        <button class="disco-breadcrumb-item" data-curio-nav="curiosidades">${escapeHtml(item.category)}</button>
        <span class="disco-breadcrumb-sep">/</span>
        <span class="disco-breadcrumb-current">${escapeHtml(item.title.slice(0, 34))}${item.title.length > 34 ? '…' : ''}</span>
      </div>
      ${renderPageHeader({ title: 'Curiosidades', icon: 'compass', mobileHidden: true })}
  
      <header class="curio-detail-hero card">
        <div class="curio-detail-copy">
          <div class="curio-detail-meta">
            <span class="curio-detail-badge" style="background:${catColor}">${item.category}</span>
            ${item.src ? `<a class="curio-detail-src" href="${escapeHtml(item.src.url)}" target="_blank" rel="noopener noreferrer">Fuente: ${escapeHtml(item.src.name)} <span class="curio-detail-src-arrow">↗</span></a>` : ''}
          </div>
          <h2 class="curio-detail-title">${escapeHtml(item.title)}</h2>
          <p class="curio-detail-text">${escapeHtml(item.text)}</p>
          <div class="curio-detail-actions">
            <button class="curio-detail-fav${fav ? ' is-on' : ''}" data-fav-id="${item.id}" aria-pressed="${fav}">
              ${ICON_SVGS['bookmark']} <span>${fav ? 'En favoritas' : 'Guardar'}</span>
            </button>
          </div>
        </div>
        ${item.img ? `<div class="curio-detail-img"><img src="${safeUrl(item.img)}" alt="" loading="eager" onerror="this.closest('.curio-detail-img').classList.add('is-empty')"></div>` : ''}
      </header>
  
      ${related.length ? `<section class="curio-section">
        <div class="curio-sec-head">
          <h3 class="curio-sec-title">Más ${escapeHtml(item.category)}</h3>
        </div>
        <div class="curio-recent-grid">${related.map((r, i) => recentCardHTML(r, i)).join('')}</div>
      </section>` : ''}
    </div>`;
  
    // Breadcrumb: volver al Rincón o a Curiosidades
    page.querySelectorAll('[data-curio-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.curioNav === 'rincon') { state.view = 'landing'; state.curioDetail = null; render(); }
        else { state.curioDetail = null; render(); }
      });
    });
  
    // Favorita desde el detalle
    const favBtn = page.querySelector('.curio-detail-fav');
    if (favBtn) {
      favBtn.addEventListener('click', () => {
        const on = toggleCurioFav(favBtn.dataset.favId);
        favBtn.classList.toggle('is-on', on);
        favBtn.querySelector('span').textContent = on ? 'En favoritas' : 'Guardar';
        favBtn.setAttribute('aria-pressed', String(on));
        showToast(on ? 'Añadida a favoritas 🤍' : 'Quitada de favoritas', on ? 'success' : 'info');
      });
    }
  
    // Relacionadas clicables
    const relatedGrid = page.querySelector('.curio-section .curio-recent-grid');
    if (relatedGrid) bindRecentCards(relatedGrid);
  
    requestAnimationFrame(() => {
      page.querySelectorAll('.curio-recent-card.animate-in').forEach(el => el.classList.add('visible'));
    });
  }
  
  // ==========================================
  // CATEGORY DETAIL VIEW
  // ==========================================
  function renderCuriosidadesCategory(catId) {
    const cat = CATEGORIES.find(c => c.id === catId);
    if (!cat) { state.curiosidadTab = 'landing'; render(); return; }
  
    const catColor = cat.accentColor;
  
    let contentHTML = '';
    if (catId === 'spb') {
      contentHTML = renderSPBDetail(catColor);
    } else if (catId === 'sp') {
      contentHTML = renderSanPetersburgoDetail(catColor);
    } else if (catId === 'gatos') {
      contentHTML = renderGatosDetail(catColor);
    }
  
    page.innerHTML = `<div class="rincon-subpage">
      <div class="disco-breadcrumb">
        <button class="disco-breadcrumb-item">El Rincón</button>
        <span class="disco-breadcrumb-sep">/</span>
        <button class="disco-breadcrumb-item" id="discoBackToLanding">Curiosidades</button>
        <span class="disco-breadcrumb-sep">/</span>
        <span class="disco-breadcrumb-current">${cat.title}</span>
        <span class="disco-breadcrumb-count">${cat.statsCount} datos</span>
      </div>
      ${contentHTML}
      ${renderRecommendations(catId)}
    </div>`;
  
    // Breadcrumb nav: el primer crumb (Rincón) navega a la landing del Rincón
    page.querySelectorAll('.disco-breadcrumb-item').forEach((btn, i) => {
      btn.addEventListener('click', () => {
        if (i === 0) { router.navigate('/rincon'); return; }
        state.curiosidadTab = 'landing';
        render();
      });
    });
  
    // Recommendation cards
    page.querySelectorAll('.disco-reco-card').forEach(card => {
      card.addEventListener('click', () => {
        state.curiosidadTab = card.dataset.cat;
        render();
      });
    });
  
    // Animate visible cards (todos los tipos: stats, timeline, chips, datos,
    // razas y gatos famosos — si falta uno se queda con opacity 0 y "en negro")
    requestAnimationFrame(() => {
      page.querySelectorAll('.disco-stat-card.animate-in, .disco-tl-card.animate-in, .disco-curio-card.animate-in, .disco-chip.animate-in, .disco-dato-featured.animate-in, .disco-dato-open.animate-in, .disco-raza-card.animate-in, .disco-famoso-card.animate-in').forEach(el => el.classList.add('visible'));
    });
  
    // Galería de fotos → lightbox
    page.querySelectorAll('.disco-gallery-item').forEach(item => {
      item.addEventListener('click', () => {
        const all = [...page.querySelectorAll('.disco-gallery-item')];
        const items = all.map(el => ({
          type: 'image',
          src: el.dataset.src,
          caption: el.querySelector('.disco-gallery-caption')?.textContent || ''
        }));
        const idx = all.findIndex(el => el === item);
        if (items.length) openLightbox(items, Math.max(0, idx));
      });
    });
  
    // Datos destacados → visor individual (clic en cualquier dato abre el visor)
    const datoList = getCategoryDatos(catId);
    if (datoList.length) {
      page.querySelectorAll('.disco-dato-open, .disco-dato-featured').forEach(el => {
        el.addEventListener('click', () => openDatoViewer(datoList, Number(el.dataset.index)));
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDatoViewer(datoList, Number(el.dataset.index)); } });
      });
    }
  
    // Anatomía felina → visor individual (enciclopedia de gatos)
    const anatomiaList = (CURIOSIDADES_DATA.gatos?.anatomia || []).map((a, i) => ({ icon: a.icon, title: a.titulo, text: a.texto, num: i + 1 }));
    if (anatomiaList.length) {
      page.querySelectorAll('.disco-anatomy-hot').forEach(hot => {
        const open = () => openDatoViewer(anatomiaList, Number(hot.dataset.anatomyIndex));
        hot.addEventListener('click', open);
        hot.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      });
    }
  }
  
  function renderIntroHero(catColor, iconKey, title, subtitle, intro, heroImg) {
    return `<header class="disco-intro-hero" style="--disco-color:${catColor}">
      ${heroImg ? `<div class="disco-intro-img"><img src="${safeUrl(heroImg)}" alt="" loading="eager" decoding="async"></div>` : ''}
      <div class="disco-intro-body">
        <span class="disco-intro-icon" style="color:${catColor}">${ICON_SVGS[iconKey] || ''}</span>
        <h2 class="disco-intro-title">${title}</h2>
        ${subtitle ? `<p class="disco-intro-subtitle">${subtitle}</p>` : ''}
        <p class="disco-intro-text">${intro}</p>
      </div>
    </header>`;
  }
  
  function renderStatsGrid(quickStats, catColor) {
    return `<div class="disco-stats-grid">
      ${quickStats.map((s, i) => `<article class="disco-stat-card card animate-in" style="--enter-delay:${i * 60}ms;--disco-color:${catColor}">
        <div class="disco-stat-icon" style="color:${catColor}">${ICON_SVGS[s.icon] || '✦'}</div>
        <strong class="disco-stat-value">${s.label}</strong>
        <small class="disco-stat-sub">${s.sub}</small>
      </article>`).join('')}
    </div>`;
  }
  
  function renderTimeline(timeline, catColor) {
    return `<section class="disco-section">
      <h3 class="disco-section-title">Cronología</h3>
      <div class="disco-timeline">
        ${timeline.map((t, i) => `<article class="disco-tl-card animate-in" style="--enter-delay:${i * 80}ms;--disco-color:${catColor}">
          <span class="disco-tl-dot"></span>
          <div class="disco-tl-content">
            <span class="disco-tl-year">${t.year}</span>
            <p class="disco-tl-text">${t.desc}</p>
          </div>
        </article>`).join('')}
      </div>
    </section>`;
  }
  
  function renderPhotoGallery(images, catColor, label, captions) {
    if (!Array.isArray(images) || !images.length) return '';
    return `<section class="disco-section">
      <h3 class="disco-section-title">${label}</h3>
      <div class="disco-gallery">
        ${images.map((src, i) => `
          <button type="button" class="disco-gallery-item" data-src="${escapeHtml(src)}" style="--disco-color:${catColor}" aria-label="Ver foto ampliada${captions?.[i] ? ': ' + escapeHtml(captions[i]) : ''}">
            <img src="${safeUrl(src)}" alt="${captions?.[i] ? escapeHtml(captions[i]) : ''}" loading="lazy">
            ${captions?.[i] ? `<span class="disco-gallery-caption">${escapeHtml(captions[i])}</span>` : ''}
          </button>`).join('')}
      </div>
    </section>`;
  }
  
  function renderChips(items, catColor, label) {
    return `<section class="disco-section">
      <h3 class="disco-section-title">${label}</h3>
      <div class="disco-chips">
        ${items.map((item, i) => `<span class="disco-chip animate-in" style="--enter-delay:${i * 40}ms;--disco-color:${catColor}">${typeof item === 'string' ? (ICON_SVGS['utensils-crossed'] + ' ' + item) : (ICON_SVGS[item.icon] + ' ' + (item.titulo || item.title))}</span>`).join('')}
      </div>
    </section>`;
  }
  
  // Raza → tarjeta con foto real, origen y dato corto (enciclopedia gatuna)
  function renderRazas(razas, catColor) {
    if (!Array.isArray(razas) || !razas.length) return '';
    return `<section class="disco-section">
      <h3 class="disco-section-title">Razas felinas</h3>
      <div class="disco-razas-grid">
        ${razas.map((r, i) => `<article class="disco-raza-card card animate-in" style="--enter-delay:${i * 50}ms;--disco-color:${catColor}">
          <div class="disco-raza-img">
            <img src="${safeUrl(r.img)}" alt="Gato de raza ${escapeHtml(r.nombre)}" loading="lazy">
          </div>
          <div class="disco-raza-body">
            <h4 class="disco-raza-nombre">${escapeHtml(r.nombre)}</h4>
            <span class="disco-raza-origen">${ICON_SVGS['map-pin'] || '📍'} ${escapeHtml(r.origen)}</span>
            <p class="disco-raza-dato">${escapeHtml(r.dato)}</p>
          </div>
        </article>`).join('')}
      </div>
    </section>`;
  }
  
  // Gatos famosos → tarjetas horizontales con foto (enciclopedia gatuna)
  function renderFamosos(famosos, catColor) {
    if (!Array.isArray(famosos) || !famosos.length) return '';
    return `<section class="disco-section">
      <h3 class="disco-section-title">Gatos famosos</h3>
      <div class="disco-famosos-list">
        ${famosos.map((f, i) => `<article class="disco-famoso-card card animate-in" style="--enter-delay:${i * 60}ms;--disco-color:${catColor}">
          <div class="disco-famoso-img">
            <img src="${f.img}" alt="${escapeHtml(f.nombre)}" loading="lazy">
          </div>
          <div class="disco-famoso-body">
            <h4 class="disco-famoso-nombre">${ICON_SVGS['crown'] || '👑'} ${escapeHtml(f.nombre)}</h4>
            <p class="disco-famoso-dato">${escapeHtml(f.dato)}</p>
          </div>
        </article>`).join('')}
      </div>
    </section>`;
  }
  
  // Datos de una colección para el visor (icono + título + texto reales)
  function getCategoryDatos(catId) {
    if (catId === 'spb') return (SPB_DATA?.curiosidades || []).map((d, i) => ({ icon: d.icon, title: d.titulo, text: d.texto, num: i + 1 }));
    if (catId === 'sp') return (CURIOSIDADES_DATA.sanPetersburgo?.datos || []).map((d, i) => ({ icon: d.icon, title: d.titulo, text: d.texto, num: i + 1 }));
    if (catId === 'gatos') return (CURIOSIDADES_DATA.gatos?.datos || []).map((d, i) => ({ icon: d.icon, title: d.titulo, text: d.texto, num: i + 1 }));
    return [];
  }
  
  // Datos destacados: primer dato protagonista (01) + lista numerada compacta
  function renderDatosDestacados(items, catColor, label) {
    if (!items.length) return '';
    // Normalizar campos (datos crudos usan titulo/texto)
    const normalized = items.map((d, i) => ({ icon: d.icon, title: d.titulo || d.title, text: d.texto || d.text, num: i + 1 }));
    const pad = (n) => String(n).padStart(2, '0');
    const [first, ...rest] = normalized;
    return `<section class="disco-section">
      <h3 class="disco-section-title">${label}</h3>
      <article class="disco-dato-featured card animate-in" style="--disco-color:${catColor}" role="button" tabindex="0" data-index="0" aria-label="Abrir dato: ${escapeHtml(first.title)}">
        <span class="disco-dato-featured-num">${pad(1)}</span>
        <div class="disco-dato-featured-icon" style="color:${catColor}">${ICON_SVGS[first.icon] || '✦'}</div>
        <h4 class="disco-dato-featured-title">${escapeHtml(first.title)}</h4>
        <p class="disco-dato-featured-text">${escapeHtml(first.text)}</p>
        <span class="disco-dato-open-hint">${ICON_SVGS['arrow-right'] || '→'} Leer</span>
      </article>
      <div class="disco-dato-list">
        ${rest.map((d, i) => `<article class="disco-dato-open card animate-in" style="--enter-delay:${(i + 1) * 60}ms;--disco-color:${catColor}" role="button" tabindex="0" data-index="${i + 1}" aria-label="Abrir dato: ${escapeHtml(d.title)}">
          <span class="disco-dato-num">${pad(i + 2)}</span>
          <span class="disco-dato-icon" style="color:${catColor}">${ICON_SVGS[d.icon] || '✦'}</span>
          <div class="disco-dato-body">
            <h4 class="disco-dato-title">${escapeHtml(d.title)}</h4>
            <p class="disco-dato-text">${escapeHtml((d.text || '').slice(0, 110))}${(d.text || '').length > 110 ? '…' : ''}</p>
          </div>
          ${ICON_SVGS['chevron-right'] || '›'}
        </article>`).join('')}
      </div>
    </section>`;
  }
  
  // ==========================================
  // ESCENAS SVG ANIMADAS (Curiosidades) — postales vivas
  // ==========================================
  function renderSceneSVG(kind) {
    if (kind === 'spb') return renderSceneRio();
    if (kind === 'sp') return renderScenePuente();
    if (kind === 'gatos') return renderSceneGato();
    return '';
  }
  
  // Río San Juan: palmeras, montañas y agua que fluye + pulso sísmico
  function renderSceneRio() {
    return `<div class="disco-scene" aria-hidden="true">
      <svg class="disco-scene-svg" viewBox="0 0 600 250" preserveAspectRatio="xMidYMid slice" role="img" aria-label="El río San Juan">
        <defs>
          <linearGradient id="rioSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd9a3"/><stop offset="1" stop-color="#ffb98a"/></linearGradient>
          <linearGradient id="rioWater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3aa0c9"/><stop offset="1" stop-color="#1c5d7c"/></linearGradient>
        </defs>
        <rect width="600" height="250" fill="url(#rioSky)"/>
        <circle class="rio-sun" cx="512" cy="58" r="34" fill="#fff3c4"/>
        <path d="M0 168 L95 78 L190 168 Z" fill="#9cbfa2" opacity="0.75"/>
        <path d="M140 168 L270 62 L400 168 Z" fill="#79a68a" opacity="0.85"/>
        <path d="M330 168 L470 84 L610 168 Z" fill="#9cbfa2" opacity="0.7"/>
        <rect y="168" width="600" height="82" fill="url(#rioWater)"/>
        <g class="rio-wave" stroke="#bfe6f2" stroke-width="5" stroke-linecap="round" fill="none">
          <path d="M-40 196 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0"/>
          <path d="M-40 226 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0"/>
        </g>
        <g class="rio-wave rio-wave--slow" stroke="#7fc3de" stroke-width="4" stroke-linecap="round" fill="none">
          <path d="M-40 212 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0"/>
        </g>
        <g class="palm" transform="translate(96 168)">
          <path d="M0 0 C -4 -34 -4 -66 4 -92" stroke="#7a4b2b" stroke-width="12" fill="none" stroke-linecap="round"/>
          <g class="palm-fronds">
            <path d="M6 -88 C -28 -104 -58 -96 -74 -72" stroke="#3e8f5e" stroke-width="10" fill="none" stroke-linecap="round"/>
            <path d="M6 -88 C 36 -108 70 -100 86 -74" stroke="#4aa56c" stroke-width="10" fill="none" stroke-linecap="round"/>
            <path d="M5 -86 C -10 -122 -34 -132 -58 -128" stroke="#388657" stroke-width="10" fill="none" stroke-linecap="round"/>
            <path d="M5 -86 C 24 -122 50 -130 74 -122" stroke="#449b64" stroke-width="10" fill="none" stroke-linecap="round"/>
          </g>
          <circle cx="42" cy="-34" r="11" fill="#2f7a4d"/>
        </g>
        <g class="palm" transform="translate(508 168) scale(0.78)">
          <path d="M0 0 C -4 -34 -4 -66 4 -92" stroke="#7a4b2b" stroke-width="12" fill="none" stroke-linecap="round"/>
          <g class="palm-fronds">
            <path d="M6 -88 C -28 -104 -58 -96 -74 -72" stroke="#3e8f5e" stroke-width="10" fill="none" stroke-linecap="round"/>
            <path d="M6 -88 C 36 -108 70 -100 86 -74" stroke="#4aa56c" stroke-width="10" fill="none" stroke-linecap="round"/>
            <path d="M5 -86 C -10 -122 -34 -132 -58 -128" stroke="#388657" stroke-width="10" fill="none" stroke-linecap="round"/>
            <path d="M5 -86 C 24 -122 50 -130 74 -122" stroke="#449b64" stroke-width="10" fill="none" stroke-linecap="round"/>
          </g>
          <circle cx="42" cy="-34" r="11" fill="#2f7a4d"/>
        </g>
        <g class="sismo-ring" stroke="#ff8a8a" stroke-width="4" fill="none"><circle cx="562" cy="208" r="9"/></g>
        <g class="sismo-ring sismo-ring--2" stroke="#ffb199" stroke-width="3" fill="none"><circle cx="562" cy="208" r="9"/></g>
      </svg>
      <span class="disco-scene-label">🌊 El río San Juan · un pulso de vida</span>
    </div>`;
  }
  
  // Puente levadizo del Neva: se abre de madrugada y pasa un barco
  function renderScenePuente() {
    return `<div class="disco-scene" aria-hidden="true">
      <svg class="disco-scene-svg" viewBox="0 0 600 250" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Puente levadizo de San Petersburgo">
        <defs>
          <linearGradient id="spSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141c3a"/><stop offset="1" stop-color="#3a4a7a"/></linearGradient>
          <linearGradient id="spWater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2c55"/><stop offset="1" stop-color="#0d1630"/></linearGradient>
        </defs>
        <rect width="600" height="250" fill="url(#spSky)"/>
        <circle class="sp-moon" cx="508" cy="54" r="26" fill="#e8ecff"/>
        <g class="sp-stars" fill="#cfd8ff">
          <circle cx="60" cy="42" r="2"/><circle cx="140" cy="80" r="1.6"/><circle cx="220" cy="30" r="2.2"/><circle cx="330" cy="66" r="1.8"/><circle cx="420" cy="28" r="2"/>
        </g>
        <g fill="#223056" opacity="0.92">
          <rect x="0" y="150" width="70" height="60"/><rect x="70" y="128" width="50" height="82"/><rect x="120" y="150" width="60" height="60"/>
          <rect x="420" y="140" width="60" height="70"/><rect x="480" y="150" width="50" height="60"/><rect x="530" y="118" width="70" height="92"/>
        </g>
        <rect y="196" width="600" height="54" fill="url(#spWater)"/>
        <g class="rio-wave sp-wave" stroke="#4a6cb5" stroke-width="4" stroke-linecap="round" fill="none">
          <path d="M-40 212 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0"/>
          <path d="M-40 234 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0"/>
        </g>
        <rect x="138" y="150" width="22" height="46" fill="#8f9bc0"/>
        <rect x="440" y="150" width="22" height="46" fill="#8f9bc0"/>
        <g class="sp-deck sp-deck--left"><rect x="160" y="182" width="140" height="9" rx="4" fill="#aeb8d8"/></g>
        <g class="sp-deck sp-deck--right"><rect x="300" y="182" width="140" height="9" rx="4" fill="#aeb8d8"/></g>
        <g class="sp-ship">
          <path d="M0 0 h56 l-8 18 h-40 z" fill="#cfd8ff"/>
          <path d="M36 -26 l16 26 h-32 z" fill="#ffffff"/>
          <path d="M0 12 h56" stroke="#8f9bc0" stroke-width="5"/>
        </g>
        <g class="sp-snow" fill="#dfe6ff">
          <circle cx="70" cy="20" r="3"/><circle cx="180" cy="120" r="2.5"/><circle cx="260" cy="40" r="3"/>
          <circle cx="370" cy="150" r="2.5"/><circle cx="470" cy="90" r="3"/><circle cx="540" cy="140" r="2.2"/>
        </g>
      </svg>
      <span class="disco-scene-label">🌉 Puentes que se abren de madrugada</span>
    </div>`;
  }
  
  // Gato animado: parpadea, mueve la cola, ronronea y suelta corazones
  function renderSceneGato() {
    return `<div class="disco-scene" aria-hidden="true">
      <svg class="disco-scene-svg disco-scene-svg--gato" viewBox="0 0 600 300" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Gato ronroneando">
        <defs>
          <radialGradient id="gatoBg" cx="0.5" cy="0.3" r="0.9"><stop offset="0" stop-color="#3d2b52"/><stop offset="1" stop-color="#191228"/></radialGradient>
        </defs>
        <rect width="600" height="300" fill="url(#gatoBg)"/>
        <circle class="gato-moon" cx="488" cy="64" r="34" fill="#ffe9a8"/>
        <g class="sp-stars" fill="#e8d9ff">
          <circle cx="80" cy="50" r="2"/><circle cx="200" cy="90" r="1.6"/><circle cx="330" cy="40" r="2.2"/><circle cx="430" cy="100" r="1.8"/>
        </g>
        <ellipse cx="300" cy="276" rx="152" ry="22" fill="#4b3666"/>
        <ellipse cx="300" cy="270" rx="142" ry="17" fill="#5d4680"/>
        <g class="gato-tail"><path d="M300 240 C 380 238 410 150 382 118" stroke="#6a5490" stroke-width="22" fill="none" stroke-linecap="round"/></g>
        <ellipse cx="300" cy="238" rx="96" ry="74" fill="#6a5490"/>
        <ellipse cx="300" cy="258" rx="70" ry="38" fill="#7c64a4"/>
        <ellipse cx="266" cy="296" rx="20" ry="12" fill="#5d4680"/>
        <ellipse cx="334" cy="296" rx="20" ry="12" fill="#5d4680"/>
        <circle cx="300" cy="148" r="60" fill="#6a5490"/>
        <path d="M252 108 L262 52 L302 94 Z" fill="#6a5490"/>
        <path d="M262 98 L269 66 L294 92 Z" fill="#f2b8c6"/>
        <path d="M348 108 L338 52 L298 94 Z" fill="#6a5490"/>
        <path d="M338 98 L331 66 L306 92 Z" fill="#f2b8c6"/>
        <g class="gato-eyes">
          <ellipse cx="274" cy="146" rx="10" ry="12" fill="#ffd166"/>
          <ellipse cx="274" cy="146" rx="4" ry="10" fill="#191228"/>
          <ellipse cx="326" cy="146" rx="10" ry="12" fill="#ffd166"/>
          <ellipse cx="326" cy="146" rx="4" ry="10" fill="#191228"/>
        </g>
        <path d="M296 162 l4 8 l4 -8 z" fill="#f2b8c6"/>
        <path d="M289 172 q6 6 11 0 M300 172 q6 6 11 0" stroke="#c9a7d8" stroke-width="3" fill="none" stroke-linecap="round"/>
        <g class="gato-whiskers" stroke="#cbb4e2" stroke-width="3" stroke-linecap="round">
          <line x1="272" y1="162" x2="238" y2="156"/><line x1="272" y1="168" x2="238" y2="170"/>
          <line x1="328" y1="162" x2="362" y2="156"/><line x1="328" y1="168" x2="362" y2="170"/>
        </g>
        <g class="gato-purr" stroke="#ffd166" fill="none" stroke-width="4" stroke-linecap="round">
          <path d="M338 228 q14 -8 14 -22"/><path d="M338 228 q22 -6 24 -24"/>
        </g>
        <g class="gato-heart" fill="#ff8aa1"><path d="M300 40 c-6 -8 -18 -4 -18 4 c0 6 18 12 18 12 s18 -6 18 -12 c0 -8 -12 -12 -18 -4z"/></g>
        <g class="gato-heart gato-heart--2" fill="#ffb3c1"><path d="M352 24 c-5 -6 -14 -3 -14 3 c0 5 14 9 14 9 s14 -4 14 -9 c0 -6 -9 -9 -14 -3z"/></g>
      </svg>
      <span class="disco-scene-label">😻 RRRrrr… ronroneo terapéutico</span>
    </div>`;
  }
  
  // ==========================================
  // ENCICLOPEDIA — Anatomía felina interactiva
  // ==========================================
  function renderCatAnatomy(anatomia, catColor) {
    if (!Array.isArray(anatomia) || !anatomia.length) return '';
    const hotspots = anatomia.map((a, i) => `
      <g class="disco-anatomy-hot" data-anatomy-index="${i}" role="button" tabindex="0" transform="translate(${a.x} ${a.y})" aria-label="Abrir: ${escapeHtml(a.titulo)}">
        <circle class="disco-anatomy-hot-ring" r="17" fill="none" stroke="${catColor}" stroke-width="2.5"/>
        <circle class="disco-anatomy-hot-dot" r="13" fill="${catColor}"/>
        <text text-anchor="middle" dy="4.5" font-size="13" font-weight="700" fill="#0a0a0c">${i + 1}</text>
      </g>`).join('');
    return `<section class="disco-section">
      <h3 class="disco-section-title">Anatomía felina · toca cada parte</h3>
      <div class="disco-anatomy-wrap card">
        <svg class="disco-anatomy-svg" viewBox="0 0 480 360" role="img" aria-label="Diagrama de anatomía de un gato">
          <ellipse cx="240" cy="330" rx="200" ry="20" fill="rgba(0,0,0,0.28)"/>
          <path d="M348 250 C 396 246 410 120 394 92 C 408 130 398 244 356 252 Z" fill="#43435a"/>
          <ellipse cx="248" cy="230" rx="114" ry="68" fill="#4b4b63"/>
          <ellipse cx="232" cy="252" rx="72" ry="40" fill="#5c5c78"/>
          <rect x="200" y="278" width="26" height="54" rx="12" fill="#3c3c52"/>
          <rect x="240" y="282" width="26" height="50" rx="12" fill="#3c3c52"/>
          <path d="M60 90 L72 42 L104 78 Z" fill="#4b4b63"/>
          <path d="M72 84 L78 56 L96 78 Z" fill="#f2b8c6"/>
          <circle cx="98" cy="120" r="46" fill="#4b4b63"/>
          <circle cx="78" cy="112" r="6" fill="#ffd166"/>
          <circle cx="78" cy="112" r="3" fill="#191228"/>
          <path d="M118 120 l9 7 l-9 7 z" fill="#f2b8c6"/>
          <g stroke="#cbb4e2" stroke-width="2.5" stroke-linecap="round">
            <line x1="124" y1="130" x2="168" y2="124"/><line x1="124" y1="136" x2="170" y2="136"/><line x1="124" y1="142" x2="168" y2="148"/>
          </g>
          <g stroke="#7c64a4" stroke-width="3" stroke-linecap="round">
            <path d="M180 200 q8 -4 8 -14"/><path d="M180 200 q14 -4 16 -18"/>
          </g>
          <g stroke="#5c5c78" stroke-width="4" stroke-linecap="round">
            <path d="M300 190 q6 -2 6 -8"/><path d="M300 190 q12 -1 13 -10"/>
          </g>
          ${hotspots}
        </svg>
      </div>
    </section>`;
  }
  
  // Visor de dato individual: 01/N, anterior/siguiente, swipe, Escape
  function openDatoViewer(items, index) {
    const existing = document.querySelector('.disco-viewer-overlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.className = 'disco-viewer-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Visor de curiosidad');
    overlay.innerHTML = `
      <div class="disco-viewer-card card">
        <button class="disco-viewer-close" aria-label="Cerrar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        <span class="disco-viewer-count"></span>
        <span class="disco-viewer-icon"></span>
        <h3 class="disco-viewer-title"></h3>
        <p class="disco-viewer-text"></p>
        <div class="disco-viewer-nav">
          <button class="disco-viewer-prev" aria-label="Anterior">${ICON_SVGS['chevron-left'] || '←'} Anterior</button>
          <button class="disco-viewer-next" aria-label="Siguiente">Siguiente ${ICON_SVGS['chevron-right'] || '→'}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  
    const countEl = overlay.querySelector('.disco-viewer-count');
    const iconEl = overlay.querySelector('.disco-viewer-icon');
    const titleEl = overlay.querySelector('.disco-viewer-title');
    const textEl = overlay.querySelector('.disco-viewer-text');
    const prevBtn = overlay.querySelector('.disco-viewer-prev');
    const nextBtn = overlay.querySelector('.disco-viewer-next');
    const pad = (n) => String(n).padStart(2, '0');
    let current = Math.min(Math.max(index, 0), items.length - 1);
  
    const show = () => {
      const d = items[current];
      countEl.textContent = `${pad(current + 1)} / ${pad(items.length)}`;
      iconEl.innerHTML = ICON_SVGS[d.icon] || '✦';
      titleEl.textContent = d.title;
      textEl.textContent = d.text;
      prevBtn.disabled = current === 0;
      nextBtn.disabled = current === items.length - 1;
    };
    // El visor usa textContent (seguro por defecto); nada que escapar.
    const nav = (dir) => {
      const next = current + dir;
      if (next < 0 || next >= items.length) return;
      current = next;
      show();
    };
    const close = () => { overlay.remove(); if (getDatoViewerKeyHandler()) document.removeEventListener('keydown', getDatoViewerKeyHandler()); setDatoViewerKeyHandler(null); };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') nav(-1);
      if (e.key === 'ArrowRight') nav(1);
    };
    if (getDatoViewerKeyHandler()) document.removeEventListener('keydown', getDatoViewerKeyHandler());
    setDatoViewerKeyHandler(onKey);
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    prevBtn.addEventListener('click', () => nav(-1));
    nextBtn.addEventListener('click', () => nav(1));
    overlay.querySelector('.disco-viewer-close').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
  
    // Swipe táctil
    let touchX = null;
    overlay.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    overlay.addEventListener('touchend', (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) nav(dx < 0 ? 1 : -1);
      touchX = null;
    }, { passive: true });
  
    show();
  }
  
  function renderSPBDetail(catColor) {
    const spb = SPB_DATA;
    return `
      ${renderIntroHero(catColor, 'mountain', 'San Juan Pueblo', 'Atlántida, Honduras', spb.intro, spb.galeriaSPB?.[0]?.src || '')}
      ${renderSceneSVG('spb')}
      ${renderPhotoGallery((spb.galeriaSPB || []).map(p => p.src).filter(Boolean), catColor, 'Galería', (spb.galeriaSPB || []).map(p => p.caption))}
      ${renderStatsGrid(spb.quickStats, catColor)}
      ${renderTimeline(spb.timeline, catColor)}
      ${renderDatosDestacados(spb.curiosidades, catColor, 'Curiosidades')}
      ${renderChips(spb.comidas, catColor, 'Comidas típicas')}
    `;
  }
  
  function renderSanPetersburgoDetail(catColor) {
    const sp = CURIOSIDADES_DATA.sanPetersburgo;
    const gallery = (sp.galeria || []).map(p => p.src).filter(Boolean);
    const captions = (sp.galeria || []).map(p => p.caption);
    return `
      ${renderIntroHero(catColor, 'ship', sp.title, sp.subtitle, sp.intro, gallery[0] || '')}
      ${renderSceneSVG('sp')}
      ${renderPhotoGallery(gallery.length ? gallery : SPB_IMG, catColor, 'Galería', captions.length ? captions : SPB_CAPTIONS)}
      ${renderStatsGrid(sp.quickStats, catColor)}
      ${renderDatosDestacados(sp.datos, catColor, 'Datos destacados')}
    `;
  }
  
  function renderGatosDetail(catColor) {
    const g = CURIOSIDADES_DATA.gatos;
    return `
      ${renderIntroHero(catColor, 'cat', g.title, g.subtitle, g.intro, GATO_IMG[0] || '')}
      ${renderSceneSVG('gatos')}
      ${renderCatAnatomy(g.anatomia, catColor)}
      ${renderRazas(g.razas, catColor)}
      ${renderFamosos(g.famosos, catColor)}
      ${renderPhotoGallery(GATO_IMG, catColor, 'Galería', GATO_CAPTIONS)}
      ${renderStatsGrid(g.quickStats, catColor)}
      ${renderDatosDestacados(g.datos, catColor, 'Datos destacados')}
    `;
  }
  
  function renderRecommendations(currentCatId) {
    const others = CATEGORIES.filter(c => c.id !== currentCatId);
    if (!others.length) return '';
    return `<section class="disco-recommendations">
      <h3 class="disco-section-title">También podría interesarte</h3>
      <div class="disco-reco-grid">
        ${others.map(c => `<button class="disco-reco-card card" data-cat="${c.id}">
          <span class="disco-reco-emoji">${c.emoji}</span>
          <div>
            <span class="disco-reco-title">${c.title}</span>
            <span class="disco-reco-count">${c.statsCount} datos</span>
          </div>
          ${ICON_SVGS['arrow-right']}
        </button>`).join('')}
      </div>
    </section>`;
  }
  
  function buildAllCurioItems() {
    const items = [];
    const spb = SPB_DATA;
    items.push({ id: 'spb-intro', catId: 'spb', category: 'San Juan Pueblo', icon: 'map-pin', title: 'San Juan Pueblo, Atlántida', text: spb.intro, tags: ['honduras', 'atlántida', 'pueblo', 'río'] });
    spb.quickStats.forEach(s => items.push({ id: 'spb-stat-' + s.label, catId: 'spb', category: 'San Juan Pueblo', icon: s.icon, title: s.label, text: s.sub, tags: ['estadística', 'dato'] }));
    spb.timeline.forEach(t => items.push({ id: 'spb-tl-' + t.year, catId: 'spb', category: 'San Juan Pueblo', icon: 'history', title: t.year, text: t.desc, tags: ['historia', 'cronología'] }));
    spb.curiosidades.forEach(c => items.push({ id: 'spb-cur-' + c.titulo, catId: 'spb', category: 'San Juan Pueblo', icon: c.icon, title: c.titulo, text: c.texto, tags: ['curiosidad', 'dato'] }));
    spb.comidas.forEach(c => items.push({ id: 'spb-food-' + c, catId: 'spb', category: 'San Juan Pueblo', icon: 'utensils-crossed', title: c, text: 'Comida típica hondureña', tags: ['comida', 'gastronomía'] }));
    const sp = CURIOSIDADES_DATA.sanPetersburgo;
    items.push({ id: 'sp-intro', catId: 'sp', category: 'San Petersburgo', icon: 'ship', title: sp.title, text: sp.intro, tags: ['rusia', 'imperial', 'ciudad'] });
    sp.quickStats.forEach(s => items.push({ id: 'sp-stat-' + s.label, catId: 'sp', category: 'San Petersburgo', icon: s.icon, title: s.label, text: s.sub, tags: ['estadística', 'dato'] }));
    sp.datos.forEach(d => items.push({ id: 'sp-dato-' + d.titulo, catId: 'sp', category: 'San Petersburgo', icon: d.icon, title: d.titulo, text: d.texto, tags: ['curiosidad', 'dato'] }));
    const g = CURIOSIDADES_DATA.gatos;
    items.push({ id: 'gatos-intro', catId: 'gatos', category: 'Datos Gatunos', icon: 'cat', title: g.title, text: g.intro, tags: ['felino', 'mascota', 'animal'] });
    g.quickStats.forEach(s => items.push({ id: 'gatos-stat-' + s.label, catId: 'gatos', category: 'Datos Gatunos', icon: s.icon, title: s.label, text: s.sub, tags: ['estadística', 'dato'] }));
    g.datos.forEach(d => items.push({ id: 'gatos-dato-' + d.titulo, catId: 'gatos', category: 'Datos Gatunos', icon: d.icon, title: d.titulo, text: d.texto, tags: ['curiosidad', 'dato'] }));
    (g.anatomia || []).forEach(d => items.push({ id: 'gatos-anatomia-' + d.label, catId: 'gatos', category: 'Datos Gatunos', icon: d.icon, title: d.titulo, text: d.texto, tags: ['felino', 'anatomía', 'cuerpo', 'dato'] }));
    (g.razas || []).forEach(r => items.push({ id: 'gatos-raza-' + r.nombre, catId: 'gatos', category: 'Datos Gatunos', icon: 'cat', title: r.nombre, text: r.dato, tags: ['raza', 'felino', 'gato', r.origen] }));
    (g.famosos || []).forEach(f => items.push({ id: 'gatos-famoso-' + f.nombre, catId: 'gatos', category: 'Datos Gatunos', icon: 'crown', title: f.nombre, text: f.dato, tags: ['famoso', 'felino', 'gato', 'internet'] }));
    return items;
  }
  
  function updateResultsCount(shown, total, el) {
    if (!el) return;
    el.textContent = shown === total ? `${total} datos para explorar` : `${shown} de ${total} resultados`;
  }
  
  // ==========================================
  // AUDIOS — archivo cronológico del día 3
  // ==========================================
  
  const AUDIO_MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  
  /** Carga los audios una sola vez y los cachea en state. */
  async function loadAudios(force = false) {
    if (state.audiosLoaded && !force) return state.audios;
    state.audiosLoaded = true;
    try {
      const list = await db.getAudios();
      state.audios = Array.isArray(list) ? list : [];
    } catch (err) {
      console.warn('[rincon] No se pudieron cargar los audios:', err?.message);
      state.audios = [];
    }
    return state.audios;
  }
  
  /** Audios agrupados por mes: { '2026-8': [audios...] } */

  return {
    renderCuriosidades,
    saveCurioFavs,
    toggleCurioFav,
    buildRecentItems,
    buildDayPool,
    getCuriosidadDelDia,
    buildCurioStats,
    renderCuriosidadesLanding,
    renderCuriosidadDetail,
    renderCuriosidadesCategory,
    renderRecommendations,
    buildAllCurioItems
  };
}
