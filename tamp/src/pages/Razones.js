/* ==========================================
   Razones — álbum de razones con desbloqueo
   por fechas (como el Calendario):
   - Razones con fecha → se desbloquean ese día
   - "Nuevas" = desbloqueadas sin leer
   - La de hoy sale como "Razón de hoy"
   - Admin edita texto + fecha de desbloqueo

   Rehecha sobre el sistema de diseño nuevo: cabecera
   del sistema, chips, lista densa y bottom sheet
   compartido (antes tenía FAB, sheet e iconos
   propios duplicados).
   ========================================== */

import '../styles/razones.css';
import { h, icon, openSheet, closeSheets, toast } from '../components/ui.js';
import { db } from '../services/db.service.js';
import { escapeHtml } from '../utils/escape.js';
import { userPrefKey } from '../utils/userStorage.js';
import { todayISO } from '../utils/format.js';
import { onContentChange } from '../services/realtime.service.js';
import { userStore } from '../stores/user.store.js';
import { renderPageHeader } from '../components/PageHeader.js';
import { reasonOfDay } from '../utils/pro-insights.js';
import { saveReasonWidget } from '../services/widgets.service.js';
import { DEFAULT_RAZONES, normalizeReasons } from '../data/reasons.data.js';

const FAV_KEY = () => userPrefKey('razonesFavoritas');
const READ_KEY = () => userPrefKey('razonesRead');

const MONTHS_SHORT = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// "Hoy" en España (Europe/Madrid), igual que el calendario y los ánimos.
function todayStr() {
  return todayISO();
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

export function RazonesPage() {
  const page = document.createElement('div');
  page.className = 'razones-page';

  let razones = [];            // [{ id, text, date }]
  let favoritos = loadFavs();  // ids
  let readIds = loadRead();    // ids leídos
  let currentFilter = 'todas';

  const isFav = (id) => favoritos.includes(id);
  const pad2 = (n) => String(n + 1).padStart(2, '0');

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
    let raw = null;
    try {
      raw = await db.getReasons({ fallback: null });
    } catch { /* fallback */ }

    // Un resultado vacío guardado también es válido.
    const missing = raw === null && localStorage.getItem('ph.config.razones') === null;
    razones = normalizeReasons(missing ? DEFAULT_RAZONES : raw);

    // Migra favoritos guardados por índice (formato legacy) a ids
    const migrated = favoritos.map(f =>
      (typeof f === 'number' || /^\d+$/.test(String(f))) && razones[+f] ? razones[+f].id : String(f)
    );
    favoritos = [...new Set(migrated)];
    saveFavs(favoritos);
  }

  // ==========================================
  // FAVORITAS ENTRE DISPOSITIVOS
  // Mismo patrón que las favoritas de Series: la fila de la cuenta manda; si
  // todavía no existe, se sube la copia local (primera vez en esta cuenta).
  // ==========================================
  async function hydrateFavs() {
    const remote = await db.getRazonesFavorites().catch(() => null);
    if (Array.isArray(remote)) {
      favoritos = [...new Set(remote.map(String))];
      saveFavs(favoritos);
    } else if (favoritos.length) {
      db.saveRazonesFavorites(favoritos).catch(() => { /* sin red: queda local */ });
    }
  }

  function pushFavs() {
    db.saveRazonesFavorites(favoritos).catch(() => { /* sin red: queda local */ });
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
    if (locked.length) return { idx: locked[0], label: 'La próxima', locked: true };

    return null;
  }

  function renderFeatured() {
    const wrap = page.querySelector('#razonFeatured');
    if (!wrap) return;
    const pick = pickFeatured();
    if (!pick) { wrap.replaceChildren(); return; }

    const { idx, label } = pick;
    const r = razones[idx];
    const isLocked = reasonState(r) === 'locked' || pick.locked;
    const esFav = !isLocked && isFav(r.id);

    const body = h('div', { class: 'razon-spot__body' },
      h('span', { class: 'razon-spot__label' }, label),
      h('p', { class: 'razon-spot__text' },
        isLocked
          ? `Una razón especial llegará el ${formatDate(r.date)}`
          : r.text
      )
    );

    const btn = h('button', {
      class: 'razon-spot__main',
      type: 'button',
      'aria-label': isLocked ? 'Razón bloqueada' : `Abrir razón ${idx + 1}`
    },
      isLocked
        ? h('span', { class: 'razon-spot__lock', html: icon('lock', 22) })
        : null,
      body,
      isLocked
        ? null
        : h('span', { class: 'razon-spot__go' }, 'Abrir ', h('span', { html: icon('chev', 15), 'aria-hidden': 'true' }))
    );

    const card = h('article', { class: 'razon-spot' }, btn);

    // El corazón va por encima del botón principal (no anida botones).
    if (!isLocked) {
      const fav = h('button', {
        class: `razon-fav${esFav ? ' is-on' : ''}`,
        type: 'button',
        'data-id': r.id,
        'aria-label': esFav ? 'Quitar de favoritas' : 'Guardar entre tus favoritas',
        title: esFav ? 'Quitar de favoritas' : 'Guardar entre tus favoritas',
        html: icon('heart', 17)
      });
      fav.addEventListener('click', () => toggleFav(r.id));
      card.appendChild(fav);
    }

    wrap.replaceChildren();
    wrap.appendChild(card);

    btn.addEventListener('click', () => openSheetReason(idx));

    renderReasonOfDay();
  }

  /**
   * Razón del día: la misma para los dos durante todo el día, elegida por la
   * fecha (no al azar en cada visita). Sale de las razones ya cargadas, así
   * que no hace falta ningún dato nuevo.
   */
  function renderReasonOfDay() {
    const wrap = page.querySelector('#razonDelDia');
    if (!wrap) return;
    const abiertas = razones.filter(r => reasonState(r) !== 'locked');
    const pick = reasonOfDay(abiertas, todayISO());
    if (!pick) {
      wrap.replaceChildren();
      return;
    }
    const idx = razones.indexOf(pick.item);
    wrap.innerHTML = `
      <article class="pro-card razon-day">
        <header class="pro-card__head">
          <span class="pro-card__kicker">Razón del día</span>
          <span class="pro-item__meta">${escapeHtml(formatDate(todayISO()))}</span>
        </header>
        <p class="razon-day__text">${escapeHtml(pick.item.text)}</p>
        <button type="button" class="btn" data-day-reason>Abrirla con calma</button>
      </article>`;
    wrap.querySelector('[data-day-reason]')?.addEventListener('click', () => openSheetReason(idx));
    saveReasonWidget({ text: pick.item.text, date: todayISO() });
  }

  // ==========================================
  // LISTA
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
      grid.replaceChildren();
      grid.append(emptyFor(currentFilter));
      return;
    }

    const list = h('div', { class: 'razones-listbox' });
    idxs.forEach(idx => list.append(reasonRow(idx)));
    grid.replaceChildren();
    grid.append(list);
  }

  function reasonRow(idx) {
    const r = razones[idx];
    const st = reasonState(r);
    const esFav = isFav(r.id);

    if (st === 'locked') {
      return h('div', { class: 'razon-row is-locked' },
        h('span', { class: 'razon-row__num' }, pad2(idx)),
        h('span', { class: 'razon-row__lock', html: icon('lock', 15), 'aria-hidden': 'true' }),
        h('span', { class: 'razon-row__main' },
          h('b', null, 'Razón por llegar'),
          h('span', { class: 'razon-row__sub' }, `Se desbloquea el ${formatDate(r.date)}`)
        )
      );
    }

    const isNew = st === 'new';
    const open = h('button', {
      class: 'razon-row__open',
      type: 'button',
      'data-id': r.id,
      'aria-label': `Abrir razón ${idx + 1}`
    },
      h('span', { class: 'razon-row__num' }, pad2(idx)),
      h('span', { class: 'razon-row__text' }, r.text),
      isNew ? h('span', { class: 'razon-row__new' }, 'Nueva') : null
    );
    open.addEventListener('click', () => openSheetReason(idx));

    const fav = h('button', {
      class: `razon-fav${esFav ? ' is-on' : ''}`,
      type: 'button',
      'data-id': r.id,
      'aria-label': esFav ? 'Quitar de favoritas' : 'Guardar entre tus favoritas',
      title: esFav ? 'Quitar de favoritas' : 'Guardar entre tus favoritas',
      html: icon('heart', 16)
    });
    fav.addEventListener('click', () => toggleFav(r.id));

    if (userStore.isAdmin) {
      const editBtn = h('button', {
        class: 'razon-action-btn',
        type: 'button',
        title: 'Editar razón',
        'aria-label': 'Editar razón',
        html: icon('edit', 14)
      });
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openReasonEditor(r);
      });

      const delBtn = h('button', {
        class: 'razon-action-btn is-delete',
        type: 'button',
        title: 'Eliminar razón',
        'aria-label': 'Eliminar razón',
        html: icon('trash', 14)
      });
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteReason(r.id);
      });

      const adminWrap = h('div', { class: 'razon-row__admin' }, editBtn, delBtn);
      return h('div', { class: `razon-row${isNew ? ' is-new' : ''}` }, open, adminWrap, fav);
    }

    return h('div', { class: `razon-row${isNew ? ' is-new' : ''}` }, open, fav);
  }

  function emptyFor(filter) {
    const conf = {
      favoritas: ['heart', 'Ninguna guardada todavía', 'Cuando encuentres una que te guste especialmente, guárdala aquí.'],
      nuevas: ['mail', 'No tienes razones nuevas', 'Cuando se desbloquee una razón nueva aparecerá aquí para que la descubras.'],
      todas: ['spark', 'Aún no hay razones', 'Vuelve pronto: llegarán razones nuevas muy pronto.']
    }[filter];
    const box = document.createElement('div');
    box.className = 'razones-empty';
    const btn = h('button', { class: 'btn btn-secondary btn--block', type: 'button' },
      filter === 'todas' ? 'Ver una razón' : 'Ver todas');
    btn.addEventListener('click', () => {
      if (filter === 'todas') openRandom();
      else setFilter('todas');
    });
    box.innerHTML = `<span class="razones-empty__ic">${icon(conf[0], 26)}</span><b>${escapeHtml(conf[1])}</b><p>${escapeHtml(conf[2])}</p>`;
    box.append(btn);
    return box;
  }

  // ==========================================
  // FAVORITOS
  // ==========================================
  function toggleFav(id) {
    const wasFav = favoritos.includes(id);
    if (wasFav) {
      favoritos = favoritos.filter(i => i !== id);
      toast('Eliminada de tus favoritas');
    } else {
      favoritos.push(id);
      toast('Guardada entre tus favoritas ♥');
    }
    saveFavs(favoritos);
    pushFavs();
    updateMeta();
    renderFeatured();
    if (currentFilter === 'favoritas') renderGrid();
    else syncFavButtons(id);
  }

  function syncFavButtons(id) {
    const esFav = isFav(id);
    page.querySelectorAll(`.razon-fav[data-id="${id}"]`).forEach(btn => {
      btn.classList.toggle('is-on', esFav);
      btn.innerHTML = icon('heart', 16);
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
    renderFeatured();
    if (currentFilter === 'nuevas') {
      // En el filtro Nuevas el item debe salir de la lista → re-render
      renderGrid();
    } else {
      // Quita el badge "Nueva" del item EN SITIO (sin re-animar la lista)
      const open = page.querySelector(`.razon-row__open[data-id="${r.id}"]`);
      const item = open?.closest('.razon-row');
      if (item) {
        item.classList.remove('is-new');
        item.querySelector('.razon-row__new')?.remove();
      }
    }
  }

  // ==========================================
  // META / CONTADOR
  // ==========================================
  function updateMeta() {
    const meta = page.querySelector('#razonesMeta');
    if (!meta) return;
    const n = newCount();
    const parts = [`${razones.length} ${razones.length === 1 ? 'razón' : 'razones'}`];
    if (hasDated()) parts.push(n > 0 ? `${n} ${n === 1 ? 'nueva' : 'nuevas'}` : 'sin nuevas');
    if (favoritos.length) parts.push(`${favoritos.length} ${favoritos.length === 1 ? 'guardada' : 'guardadas'}`);
    meta.textContent = parts.join(' · ');
    renderTabCounts();
  }

  function renderTabCounts() {
    const tabNuevas = page.querySelector('#tabNuevas');
    if (tabNuevas) {
      tabNuevas.hidden = !hasDated();
      const count = tabNuevas.querySelector('.razones-chip__count');
      if (count) count.textContent = newCount();
    }
    const tabFavs = page.querySelector('#tabFavs');
    const favCount = tabFavs?.querySelector('.razones-chip__count');
    if (favCount) favCount.textContent = favoritos.length;
  }


  // ==========================================
  // GESTIÓN IN-SITU (ADMIN)
  // ==========================================
  function openReasonEditor(reasonToEdit = null) {
    if (!userStore.isAdmin) return;
    const isNew = !reasonToEdit;

    openSheet(isNew ? 'Nueva razón' : 'Editar razón', () => {
      const body = document.createElement('div');
      body.className = 'ow-editor-form razon-editor-form';

      body.innerHTML = `
        <div class="ow-form-field">
          <label>¿Por qué la amas? (Texto de la razón)</label>
          <textarea id="razonText" rows="4" placeholder="Por tu sonrisa, por cómo me cuidas...">${escapeHtml(reasonToEdit?.text || '')}</textarea>
        </div>
        <div class="ow-form-field">
          <label>Fecha de desbloqueo (opcional)</label>
          <input type="date" id="razonDate" value="${escapeHtml(reasonToEdit?.date || '')}" />
          <small style="color:var(--text-3);font-size:var(--fs-caption);margin-top:2px;">
            Si se deja vacío, la razón estará desbloqueada de inmediato. Si pones una fecha futura, aparecerá bloqueada con candado hasta ese día.
          </small>
        </div>
        <div class="ow-editor-actions">
          <button type="button" class="btn btn-secondary" id="razonCancelBtn">Cancelar</button>
          <button type="button" class="btn btn-primary" id="razonSaveBtn">${isNew ? 'Guardar razón' : 'Actualizar'}</button>
        </div>
      `;

      body.querySelector('#razonCancelBtn').addEventListener('click', closeSheets);

      body.querySelector('#razonSaveBtn').addEventListener('click', async () => {
        const text = body.querySelector('#razonText').value.trim();
        const date = body.querySelector('#razonDate').value;
        if (!text) { toast('Por favor escribe el motivo o razón'); return; }

        const id = reasonToEdit?.id || ('r_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
        const updatedReason = { id, text, date };

        let nextRazones = [...razones];
        if (isNew) {
          nextRazones.push(updatedReason);
        } else {
          const idx = nextRazones.findIndex(x => x.id === id);
          if (idx >= 0) nextRazones[idx] = updatedReason;
          else nextRazones.push(updatedReason);
        }

        try {
          await db.saveReasons(nextRazones);
          razones = nextRazones;
          updateMeta();
          renderFeatured();
          renderGrid();
          closeSheets();
          toast(isNew ? 'Razón añadida con éxito ♥' : 'Razón actualizada correctamente ✓');
        } catch (err) {
          toast('Error al guardar razón: ' + (err.message || 'Error'));
        }
      });

      return body;
    });
  }

  async function deleteReason(id) {
    if (!userStore.isAdmin) return;
    const r = razones.find(x => x.id === id);
    if (!r) return;
    if (!confirm(`¿Eliminar la razón: "${r.text.slice(0, 50)}..."?`)) return;

    try {
      const nextRazones = razones.filter(x => x.id !== id);
      await db.saveReasons(nextRazones);
      razones = nextRazones;
      favoritos = favoritos.filter(fId => fId !== id);
      saveFavs(favoritos);
      pushFavs();
      updateMeta();
      renderFeatured();
      renderGrid();
      toast('Razón eliminada ✓');
    } catch (err) {
      toast('No se pudo eliminar: ' + (err.message || 'Error'));
    }
  }

  // ==========================================
  // BOTTOM SHEET — razón ampliada
  // ==========================================
  function openSheetReason(idx) {
    const r = razones[idx];
    if (!r) return;
    if (reasonState(r) === 'locked') {
      toast(`Se desbloquea el ${formatDate(r.date)}`);
      return;
    }
    markRead(idx);

    const esFav = isFav(r.id);
    const num = pad2(idx);

    openSheet(`Razón ${num}`, () => {
      const body = h('div', { class: 'razon-sheet' });

      body.append(h('p', { class: 'razon-sheet__text' }, r.text));
      if (r.date) {
        body.append(h('p', { class: 'razon-sheet__date', html: icon('calendar', 13) + ` Se desbloqueó el ${formatDate(r.date)}` }));
      }

      const favBtn = h('button', {
        class: `btn btn--block${esFav ? ' is-on' : ''}`,
        type: 'button',
        html: icon('heart', 16) + (esFav ? 'Guardada' : 'Guardar')
      });
      favBtn.addEventListener('click', () => {
        toggleFav(r.id);
        const now = isFav(r.id);
        favBtn.classList.toggle('is-on', now);
        favBtn.innerHTML = icon('heart', 16) + (now ? 'Guardada' : 'Guardar');
      });

      const copyBtn = h('button', { class: 'btn btn-secondary btn--block', type: 'button',
        html: icon('copy', 16) + 'Copiar' });
      copyBtn.addEventListener('click', () => copyText(r.text));

      body.append(favBtn, copyBtn);
      return body;
    });
  }

  async function copyText(text) {
    const done = () => toast('Razón copiada');
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy') ? done() : toast('No se pudo copiar'); }
      catch { toast('No se pudo copiar'); }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else {
      fallback();
    }
  }

  // ==========================================
  // RAZÓN ALEATORIA
  // ==========================================
  function openRandom() {
    const unlocked = razones.map((_, i) => i).filter(i => reasonState(razones[i]) !== 'locked');
    if (!unlocked.length) { toast('Aún no hay razones desbloqueadas'); return; }
    openSheetReason(unlocked[Math.floor(Math.random() * unlocked.length)]);
  }

  function setFilter(filter) {
    currentFilter = filter;
    page.querySelectorAll('.razones-chip').forEach(chip => {
      const on = chip.dataset.filter === filter;
      chip.classList.toggle('is-active', on);
      chip.setAttribute('aria-pressed', String(on));
    });
    renderGrid();
  }

  // ==========================================
  // RENDER
  // ==========================================
  page.innerHTML = `
    ${renderPageHeader({
      title: 'Razones',
      subtitleId: 'razonesMeta',
      actions: `
        ${userStore.isAdmin ? `<button type="button" class="razones-admin-btn" id="newRazonBtn">${icon('plus', 15)} <span>Añadir razón</span></button>` : ''}
        <button type="button" class="icon-btn" id="randomBtn" aria-label="Razón aleatoria" title="Razón aleatoria">${icon('spark', 19)}</button>
      `,
    })}

    <div class="chips razones-chips" role="group" aria-label="Filtrar razones">
      <button type="button" class="chip razones-chip is-active" data-filter="todas" aria-pressed="true">Todas</button>
      <button type="button" class="chip razones-chip" data-filter="nuevas" aria-pressed="false" id="tabNuevas" hidden>Nuevas <span class="razones-chip__count">0</span></button>
      <button type="button" class="chip razones-chip" data-filter="favoritas" aria-pressed="false" id="tabFavs">Favoritas <span class="razones-chip__count">0</span></button>
    </div>

    <div id="razonFeatured"></div>

    <div id="razonDelDia"></div>

    <section id="razonesGrid" aria-live="polite"></section>
  `;

  // ==========================================
  // EVENTOS
  // ==========================================
  page.querySelectorAll('.razones-chip').forEach(chip => {
    chip.addEventListener('click', () => setFilter(chip.dataset.filter));
  });

  page.querySelector('#randomBtn').addEventListener('click', openRandom);
  page.querySelector('#newRazonBtn')?.addEventListener('click', () => openReasonEditor(null));

  // Carga de datos y primer render
  const firstPaint = () => {
    updateMeta();
    renderFeatured();
    renderGrid();
  };

  loadRazones()
    .catch(() => {
      razones = DEFAULT_RAZONES.map((text, i) => ({ id: `r${i}`, text, date: '' }));
    })
    .then(hydrateFavs)
    .then(firstPaint);

  // Tiempo real: si el Admin edita las razones, se recargan al instante.
  // (Si hay una razón abierta en el sheet, no interrumpir la lectura.)
  const offContent = onContentChange(['razones'], async () => {
    if (document.querySelector('.overlay .sheet')) return;
    await loadRazones();
    firstPaint();
  });

  page.cleanup = () => {
    offContent();
    closeSheets();
  };

  return page;
}
