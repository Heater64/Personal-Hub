/* ==========================================
   Personal Hub v2 — Razones Page
   Álbum editorial de razones con desbloqueo
   por fechas (como el Calendario):
   - Razones con fecha → se desbloquean ese día
   - "Nuevas" = desbloqueadas sin leer
   - La de hoy sale como "Razón de hoy"
   - Admin edita texto + fecha de desbloqueo
   ========================================== */

import { db } from '../services/db.service.js';
import { showToast } from '../components/Toast.js';
import { escapeHtml } from '../utils/escape.js';
import { userPrefKey } from '../utils/userStorage.js';
import { onContentChange } from '../services/realtime.service.js';

const FAV_KEY = () => userPrefKey('razonesFavoritas');
const READ_KEY = () => userPrefKey('razonesRead');

// Contenido por defecto (primer arranque, hasta que Admin guarde su lista)
const DEFAULT_RAZONES = [
  'Por lo lista, lo hermosa y lo increíble que eres.',
  'Por todo lo que me has enseñado y lo que me sigues enseñando cada día.',
  'Por toda la paciencia que tienes conmigo.',
  'Por lo mucho que me cuidas y te preocupas por mí.',
  'Por lo cariñosa que eres en cada momento.',
  'Por lo divertida y graciosa que eres.',
  'Por cómo me miras, como si fuera lo más especial del mundo.',
  'Porque contigo cualquier plan es el mejor plan.',
  'Por cómo haces que los días grises se vuelvan coloridos.',
  'Por tu forma de ser, única e irrepetible.',
  'No son las únicas razones pero así te obligaré a entrar de vez en cuando para ver las nuevas jsjsj',
];

const MONTHS_SHORT = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(s) {
  const [y, m, d] = (s || '').split('-');
  if (!y || !m || !d) return s || '';
  return `${parseInt(d, 10)} ${MONTHS_SHORT[parseInt(m, 10)]}`;
}

function loadJson(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

function loadFavs() { return loadJson(FAV_KEY()); }
function loadRead() { return loadJson(READ_KEY()); }

function saveFavs(favs) { try { localStorage.setItem(FAV_KEY(), JSON.stringify(favs)); } catch { /* */ } }
function saveRead(ids) { try { localStorage.setItem(READ_KEY(), JSON.stringify(ids)); } catch { /* */ } }

const HEART_SVG = (filled) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;

const LOCK_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

export function RazonesPage(router) {
  const page = document.createElement('div');
  page.className = 'razones-page';

  let razones = [];            // [{ id, text, date }]
  let favoritos = loadFavs();  // ids
  let readIds = loadRead();    // ids leídos
  let currentFilter = 'todas';
  let sheetIdx = null;
  let lastTrigger = null;
  let onKey = null;

  const isFav = (id) => favoritos.includes(id);

  // ==========================================
  // ESTADOS DE RAZÓN
  // ==========================================
  function reasonState(r) {
    if (r.date && r.date > todayStr()) return 'locked';
    if (r.date && !readIds.includes(r.id)) return 'new';
    return 'open';
  }
  const newCount = () => razones.filter(r => reasonState(r) === 'new').length;
  const hasDated = () => razones.some(r => !!r.date);

  // ==========================================
  // CARGA DE DATOS (db con fallback estático)
  // ==========================================
  async function loadRazones() {
    let raw = [];
    try {
      const r = await db.getReasons();
      if (Array.isArray(r) && r.length) raw = r;
    } catch { /* fallback */ }

    // Normaliza y descarta basura (p. ej. objetos sin texto real que
    // renderizarían como "[object Object]")
    const normalized = raw
      .map((r, i) => {
        if (typeof r === 'string') return { id: `r${i}`, text: r.trim(), date: '' };
        return {
          id: r?.id || `r${i}`,
          text: String(r?.text || r?.reason || '').trim(),
          date: r?.date || ''
        };
      })
      .filter(r => r.text);

    // La semilla por defecto SOLO aplica la primera vez (nunca se ha
    // guardado nada). Si el Admin borra TODAS las razones, no deben
    // reaparecer al recargar.
    const everSaved = localStorage.getItem('ph.config.razones') !== null;
    if (!normalized.length && !everSaved) {
      razones = DEFAULT_RAZONES.map((text, i) => ({ id: `r${i}`, text, date: '' }));
    } else {
      razones = normalized;
    }

    // Migra favoritos guardados por índice (formato legacy) a ids
    const migrated = favoritos.map(f =>
      (typeof f === 'number' || /^\d+$/.test(String(f))) && razones[+f] ? razones[+f].id : String(f)
    );
    favoritos = [...new Set(migrated)];
    saveFavs(favoritos);
  }

  // ==========================================
  // RAZÓN DESTACADA
  // ==========================================
  function pickFeatured() {
    const today = todayStr();
    const todayIdx = razones.findIndex(r => r.date === today);
    if (todayIdx !== -1) return { idx: todayIdx, label: 'Razón de hoy' };

    const favIdx = favoritos.length ? razones.findIndex(r => r.id === favoritos[0]) : -1;
    if (favIdx !== -1 && reasonState(razones[favIdx]) !== 'locked') {
      return { idx: favIdx, label: 'Una de tus favoritas' };
    }

    const unlocked = razones.map((_, i) => i).filter(i => reasonState(razones[i]) !== 'locked');
    if (unlocked.length) {
      const seed = today.replace(/-/g, '') * 1;
      return { idx: unlocked[seed % unlocked.length], label: 'Razón del momento' };
    }

    const locked = razones.map((_, i) => i)
      .filter(i => reasonState(razones[i]) === 'locked')
      .sort((a, b) => (razones[a].date || '').localeCompare(razones[b].date || ''));
    if (locked.length) return { idx: locked[0], label: 'Próxima razón 🔒', locked: true };

    return null;
  }

  function renderFeatured() {
    const wrap = page.querySelector('#razonFeatured');
    if (!wrap) return;
    const pick = pickFeatured();
    if (!pick) { wrap.innerHTML = ''; return; }

    const { idx, label } = pick;
    const r = razones[idx];
    const isLocked = reasonState(r) === 'locked' || pick.locked;
    const esFav = !isLocked && isFav(r.id);

    wrap.innerHTML = `
      <article class="razon-featured ${isLocked ? 'is-locked' : ''}" data-index="${idx}">
        <div class="razon-featured__head">
          <span class="razon-featured__label">${label}</span>
          <span class="razon-featured__num">${String(idx + 1).padStart(2, '0')}</span>
        </div>
        <button type="button" class="razon-featured__main" data-index="${idx}" aria-label="Abrir razón ${idx + 1}">
          <p class="razon-featured__text">${isLocked ? `${LOCK_SVG} Una razón especial llegará el ${formatDate(r.date)}` : escapeHtml(r.text)}</p>
        </button>
        <div class="razon-featured__foot">
          ${isLocked ? '' : `<button type="button" class="fav-dot ${esFav ? 'is-on' : ''}" data-id="${r.id}" aria-label="${esFav ? 'Quitar de favoritas' : 'Guardar entre tus favoritas'}" title="${esFav ? 'Quitar de favoritas' : 'Guardar entre tus favoritas'}">${HEART_SVG(esFav)}</button>`}
          <button type="button" class="razon-featured__open" data-index="${idx}" aria-label="Abrir razón ${idx + 1}">${isLocked ? 'El día llega pronto' : `Abrir <span aria-hidden="true">→</span>`}</button>
        </div>
      </article>`;
    bindFeaturedEvents(wrap);
  }

  function bindFeaturedEvents(wrap) {
    const article = wrap.querySelector('.razon-featured');
    const idx = parseInt(article.dataset.index);
    article.addEventListener('click', (e) => {
      if (e.target.closest('.fav-dot')) return;
      openSheet(idx);
    });
    const favBtn = wrap.querySelector('.fav-dot');
    if (favBtn) favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFav(favBtn.dataset.id);
    });
  }

  // ==========================================
  // GRID (lista editorial con divisores)
  // ==========================================
  function filteredIndexes() {
    if (currentFilter === 'favoritas') {
      return razones.map((r, i) => ({ r, i })).filter(({ r }) => favoritos.includes(r.id)).map(({ i }) => i);
    }
    if (currentFilter === 'nuevas') {
      return razones.map((r, i) => ({ r, i })).filter(({ r }) => reasonState(r) === 'new').map(({ i }) => i);
    }
    return razones.map((_, i) => i);
  }

  function renderGrid() {
    const grid = page.querySelector('#razonesGrid');
    if (!grid) return;
    const idxs = filteredIndexes();

    if (!idxs.length) {
      grid.innerHTML = renderEmpty(currentFilter);
      return;
    }

    grid.innerHTML = idxs.map((idx, i) => {
      const r = razones[idx];
      const st = reasonState(r);
      const esFav = isFav(r.id);

      if (st === 'locked') {
        return `
          <div class="razon-item is-locked" style="--enter-delay:${(i % 9) * 45}ms">
            <div class="razon-item__open" aria-hidden="true">
              <span class="razon-item__num">${String(idx + 1).padStart(2, '0')} ·</span>
              <div class="razon-item__locked">
                <span class="razon-item__text razon-item__text--muted">Razón bloqueada</span>
                <span class="razon-item__hint">${LOCK_SVG} Se desbloquea el ${formatDate(r.date)}</span>
              </div>
            </div>
          </div>`;
      }

      const isNew = st === 'new';
      return `
        <div class="razon-item ${isNew ? 'is-new' : ''}" style="--enter-delay:${(i % 9) * 45}ms">
          <button type="button" class="razon-item__open" data-index="${idx}" aria-label="Abrir razón ${idx + 1}">
            <span class="razon-item__num">${String(idx + 1).padStart(2, '0')} ·</span>
            <span class="razon-item__text">${escapeHtml(r.text)}</span>
          </button>
          ${isNew ? '<span class="razon-item__badge">Nueva</span>' : ''}
          <button type="button" class="fav-dot ${esFav ? 'is-on' : ''}" data-id="${r.id}" aria-label="${esFav ? 'Quitar de favoritas' : 'Guardar entre tus favoritas'}" title="${esFav ? 'Quitar de favoritas' : 'Guardar entre tus favoritas'}">${HEART_SVG(esFav)}</button>
        </div>`;
    }).join('');

    grid.onclick = (e) => {
      const favBtn = e.target.closest('.fav-dot');
      if (favBtn) { e.stopPropagation(); toggleFav(favBtn.dataset.id); return; }
      const open = e.target.closest('.razon-item__open[data-index]');
      if (open) openSheet(parseInt(open.dataset.index, 10));
    };
  }

  function renderEmpty(filter) {
    if (filter === 'favoritas') {
      return `
        <div class="razones-empty">
          <span class="razones-empty__heart" aria-hidden="true">♡</span>
          <p>No has guardado ninguna todavía.</p>
          <small>Cuando encuentres una que te guste especialmente, puedes guardarla aquí.</small>
        </div>`;
    }
    if (filter === 'nuevas') {
      return `
        <div class="razones-empty">
          <span class="razones-empty__heart" aria-hidden="true">💌</span>
          <p>No tienes razones nuevas pendientes</p>
          <small>Cuando se desbloquee una razón nueva, aparecerá aquí para que la descubras.</small>
        </div>`;
    }
    return `
      <div class="razones-empty">
        <span class="razones-empty__heart" aria-hidden="true">💛</span>
        <p>Aún no hay razones</p>
        <small>Vuelve pronto: llegarán razones nuevas muy pronto.</small>
      </div>`;
  }

  // ==========================================
  // FAVORITOS
  // ==========================================
  function toggleFav(id) {
    const wasFav = favoritos.includes(id);
    if (wasFav) {
      favoritos = favoritos.filter(i => i !== id);
      showToast('Eliminada de tus favoritas', 'info');
    } else {
      favoritos.push(id);
      showToast('💖 Guardada entre tus favoritas', 'info');
    }
    saveFavs(favoritos);
    syncFavButtons(id);
    updateMeta();
    renderFeatured();
    if (currentFilter === 'favoritas') renderGrid();
  }

  function syncFavButtons(id) {
    const esFav = isFav(id);
    page.querySelectorAll(`.fav-dot[data-id="${id}"]`).forEach(btn => {
      btn.classList.toggle('is-on', esFav);
      btn.innerHTML = HEART_SVG(esFav);
      btn.setAttribute('aria-label', esFav ? 'Quitar de favoritas' : 'Guardar entre tus favoritas');
      btn.title = esFav ? 'Quitar de favoritas' : 'Guardar entre tus favoritas';
    });
  }

  // ==========================================
  // LECTURA (marca nuevas como leídas)
  // ==========================================
  function markRead(idx) {
    const r = razones[idx];
    if (!r?.date || readIds.includes(r.id)) return;
    readIds.push(r.id);
    saveRead(readIds);
    updateMeta();
    renderTabCounts();
    renderFeatured();
    if (currentFilter === 'nuevas') {
      // En el filtro Nuevas el item debe salir de la lista → re-render
      renderGrid();
    } else {
      // Quita el badge "Nueva" del item EN SITIO (sin re-animar la lista)
      const open = page.querySelector(`.razon-item__open[data-index="${idx}"]`);
      const item = open?.closest('.razon-item');
      if (item) {
        item.classList.remove('is-new');
        item.querySelector('.razon-item__badge')?.remove();
      }
    }
  }

  // ==========================================
  // META / CONTADOR (narrativa)
  // ==========================================
  function updateMeta() {
    const meta = page.querySelector('#razonesMeta');
    if (!meta) return;
    const n = newCount();
    const plural = (count, singular, pluralForm) => count === 1 ? `${count} ${singular}` : `${count} ${pluralForm}`;
    meta.innerHTML = `
      <span>${plural(razones.length, 'razón', 'razones')}</span>
      ${hasDated() ? `
      <span class="razones-meta__dot" aria-hidden="true">·</span>
      <span class="razones-meta__new${n ? ' has' : ''}">${n > 0 ? plural(n, 'nueva', 'nuevas') : 'sin nuevas'}</span>` : ''}
      <span class="razones-meta__dot" aria-hidden="true">·</span>
      <span class="razones-meta__favs">${favoritos.length > 0 ? plural(favoritos.length, 'guardada', 'guardadas') : 'ninguna guardada aún'}</span>
      <span class="razones-meta__dot" aria-hidden="true">·</span>
      <em>y podría escribir muchas más</em>`;
    renderTabCounts();
  }

  function renderTabCounts() {
    const tabNuevas = page.querySelector('#tabNuevas');
    if (tabNuevas) {
      tabNuevas.style.display = hasDated() ? '' : 'none';
      const count = tabNuevas.querySelector('.razones-tab__count');
      if (count) count.textContent = newCount();
    }
    const tabFavs = page.querySelector('#tabFavs');
    const favCount = tabFavs?.querySelector('.razones-tab__count');
    if (favCount) favCount.textContent = favoritos.length;
  }

  // ==========================================
  // BOTTOM SHEET — razón ampliada
  // ==========================================
  function openSheet(idx) {
    const r = razones[idx];
    if (!r) return;
    if (reasonState(r) === 'locked') {
      showToast(`Se desbloquea el ${formatDate(r.date)} 🔒`, 'info');
      return;
    }
    // Captura el trigger ANTES de markRead: marcar como leída re-renderiza
    // la lista/featured y sustituiría el elemento clicado (se pierde el foco).
    lastTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    markRead(idx);

    sheetIdx = idx;
    const sheet = page.querySelector('#razonSheet');
    const textEl = page.querySelector('#razonSheetText');
    const numEl = page.querySelector('#razonSheetNum');
    const favBtn = page.querySelector('#razonSheetFav');
    const esFav = isFav(r.id);
    textEl.textContent = r.text;
    numEl.textContent = String(idx + 1).padStart(2, '0');
    favBtn.innerHTML = `${HEART_SVG(esFav)}<span>${esFav ? 'Guardada' : 'Guardar'}</span>`;
    favBtn.classList.toggle('is-on', esFav);
    sheet.classList.add('is-open');
    sheet.setAttribute('aria-hidden', 'false');
    document.body.classList.add('sheet-locked');
    requestAnimationFrame(() => {
      if (sheet.classList.contains('is-open')) {
        sheet.classList.add('is-visible');
        page.querySelector('#razonSheetClose').focus();
      }
    });

    if (!onKey) {
      onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); closeSheet(); }
        if (e.key === 'Tab') {
          const focusables = Array.from(page.querySelectorAll('#razonSheet button'));
          if (!focusables.length) return;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      };
      document.addEventListener('keydown', onKey);
    }
  }

  function closeSheet() {
    const sheet = page.querySelector('#razonSheet');
    if (!sheet || !sheet.classList.contains('is-open')) return;
    sheet.classList.remove('is-visible', 'is-open');
    sheet.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('sheet-locked');
    if (onKey) { document.removeEventListener('keydown', onKey); onKey = null; }
    if (lastTrigger && typeof lastTrigger.focus === 'function') lastTrigger.focus();
    lastTrigger = null;
    sheetIdx = null;
  }

  // ==========================================
  // RAZÓN ALEATORIA (FAB → sheet)
  // ==========================================
  function openRandom() {
    const unlocked = razones.map((_, i) => i).filter(i => reasonState(razones[i]) !== 'locked');
    if (!unlocked.length) { showToast('Aún no hay razones desbloqueadas 🔒', 'info'); return; }
    openSheet(unlocked[Math.floor(Math.random() * unlocked.length)]);
  }

  // ==========================================
  // RENDER
  // ==========================================
  page.innerHTML = `
    <header class="razones-header">
      <p class="razones-eyebrow">Para ti ✧</p>
      <h1 class="razones-title">Razones por las que te quiero</h1>
      <p class="razones-sub">Pequeños detalles que hacen que seas tú.</p>
      <div class="razones-meta" id="razonesMeta"></div>
    </header>

    <nav class="razones-tabs" aria-label="Filtrar razones">
      <button type="button" class="razones-tab is-active" id="tabTodas" aria-pressed="true">Todas</button>
      <button type="button" class="razones-tab" id="tabNuevas" aria-pressed="false" style="display:none">Nuevas <span class="razones-tab__count">0</span></button>
      <button type="button" class="razones-tab" id="tabFavs" aria-pressed="false">Favoritas <span class="razones-tab__count">${favoritos.length}</span></button>
    </nav>

    <div class="razon-featured-wrap" id="razonFeatured">
      <div class="razon-featured-skeleton" aria-hidden="true"></div>
    </div>

    <div class="razones-list" id="razonesGrid">
      ${'<div class="razon-skeleton" aria-hidden="true"></div>'.repeat(4)}
    </div>

    <button type="button" class="razones-fab" id="randomFab" title="Razón aleatoria" aria-label="Razón aleatoria">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19V6.5A2.5 2.5 0 0 1 6.5 4H20v13.5a2.5 2.5 0 0 1-2.5 2.5H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 19a2.5 2.5 0 0 0 2.5 2.5H20"/></svg>
      <span class="razones-fab__label">Otra razón</span>
    </button>

    <div class="razon-sheet" id="razonSheet" role="dialog" aria-modal="true" aria-hidden="true" aria-label="Razón ampliada">
      <div class="razon-sheet__panel">
        <span class="razon-sheet__handle" aria-hidden="true"></span>
        <button type="button" class="razon-sheet__close" id="razonSheetClose" aria-label="Cerrar">✕</button>
        <span class="razon-sheet__chip">Razón <b id="razonSheetNum">01</b></span>
        <p class="razon-sheet__text" id="razonSheetText"></p>
        <div class="razon-sheet__actions">
          <button type="button" class="razon-sheet__btn razon-sheet__fav" id="razonSheetFav"></button>
          <button type="button" class="razon-sheet__btn razon-sheet__copy" id="razonSheetCopy">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span>Copiar</span>
          </button>
        </div>
      </div>
    </div>
  `;

  // ==========================================
  // EVENTOS
  // ==========================================
  const tabs = page.querySelectorAll('.razones-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('is-active');
        t.setAttribute('aria-pressed', 'false');
      });
      tab.classList.add('is-active');
      tab.setAttribute('aria-pressed', 'true');
      currentFilter = tab.id === 'tabNuevas' ? 'nuevas' : tab.id === 'tabFavs' ? 'favoritas' : 'todas';
      renderGrid();
    });
  });

  page.querySelector('#randomFab').addEventListener('click', openRandom);

  const sheet = page.querySelector('#razonSheet');
  page.querySelector('#razonSheetClose').addEventListener('click', closeSheet);
  sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
  page.querySelector('#razonSheetFav').addEventListener('click', () => {
    if (sheetIdx === null) return;
    toggleFav(razones[sheetIdx].id);
    const btn = page.querySelector('#razonSheetFav');
    const esFav = isFav(razones[sheetIdx].id);
    btn.innerHTML = `${HEART_SVG(esFav)}<span>${esFav ? 'Guardada' : 'Guardar'}</span>`;
    btn.classList.toggle('is-on', esFav);
  });
  page.querySelector('#razonSheetCopy').addEventListener('click', () => {
    const text = page.querySelector('#razonSheetText').textContent;
    const done = () => showToast('📋 Razón copiada', 'success');
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy') ? done() : showToast('No se pudo copiar', 'error'); }
      catch { showToast('No se pudo copiar', 'error'); }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else {
      fallback();
    }
  });

  // Carga de datos y primer render
  loadRazones().then(() => {
    updateMeta();
    renderFeatured();
    renderGrid();
  }).catch(() => {
    razones = DEFAULT_RAZONES.map((text, i) => ({ id: `r${i}`, text, date: '' }));
    updateMeta();
    renderFeatured();
    renderGrid();
  });

  // Tiempo real: si el Admin edita las razones, se recargan al instante.
  const offContent = onContentChange(['razones'], async () => {
    if (sheetIdx !== null) return; // leyendo una razón: no interrumpir
    await loadRazones();
    updateMeta();
    renderFeatured();
    renderGrid();
  });

  page.cleanup = () => {
    offContent();
    if (onKey) { document.removeEventListener('keydown', onKey); onKey = null; }
    document.body.classList.remove('sheet-locked');
  };

  return page;
}
