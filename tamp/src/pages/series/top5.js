/* ==========================================
   Videoteca Tamp — Top 5
   Mi ranking (editable), el de mi pareja (solo lectura) y el conjunto.
   El conjunto se calcula con los dos rankings: no se inventa nada ni se
   escriben datos ajenos.
   ========================================== */

import { escapeHtml } from '../../utils/escape.js';
import { icon, openSheet, closeSheets } from '../../components/ui.js';
import { showToast } from '../../components/Toast.js';
import { state, isAdmin, saveTop5, catalogById } from './store.js';
import { emptyHTML } from './cards.js';

const KEY_FOR = { series: 'series', movies: 'movies' };
const TYPE_FOR = { series: 'serie', movies: 'pelicula' };

function sorted(list) {
  const seen = new Set();
  const unique = [];
  [...(Array.isArray(list) ? list : [])]
    .sort((a, b) => Number(a.position) - Number(b.position))
    .forEach(entry => {
      if (!entry?.itemId || seen.has(entry.itemId) || unique.length >= 5) return;
      seen.add(entry.itemId);
      unique.push({ ...entry, position: unique.length + 1 });
    });
  return unique;
}

function resolveEntry(entry) {
  const item = catalogById(entry.itemId);
  return {
    id: entry.itemId,
    titulo: item?.titulo || entry.titulo || 'Sin título',
    portada: item?.portada || entry.portada || item?.banner || '',
    tipo: item?.tipo || TYPE_FOR[state.topTipo],
    exists: !!item
  };
}

function rankingRows(list, { emptyText } = {}) {
  if (!list.length) {
    return `<div class="sx-rank-empty">${escapeHtml(emptyText)}</div>`;
  }
  return `
    <ol class="sx-rank">
      ${list.map(entry => {
        const item = resolveEntry(entry);
        return `
          <li class="sx-rank-row${Number(entry.position) === 1 ? ' is-first' : ''}">
            <button type="button" class="sx-rank-open" ${item.exists ? `data-open="${escapeHtml(item.id)}" aria-label="Abrir ${escapeHtml(item.titulo)}"` : 'disabled'}>
              <span class="sx-rank-pos">${String(entry.position).padStart(2, '0')}</span>
              <span class="sx-rank-poster">${item.portada ? `<img src="${escapeHtml(item.portada)}" alt="" loading="lazy">` : icon('film', 16)}</span>
              <span class="sx-rank-name">${escapeHtml(item.titulo)}</span>
            </button>
          </li>
        `;
      }).join('')}
    </ol>
  `;
}

function jointFor(type) {
  const mine = sorted(state.podio[type]);
  const theirs = sorted(state.partnerPodio?.[type]);
  if (!mine.length || !theirs.length) return [];
  const scores = new Map();
  const entries = new Map();
  [mine, theirs].forEach(list => {
    list.forEach(entry => {
      if (!entry?.itemId) return;
      const points = 6 - Number(entry.position);
      scores.set(entry.itemId, (scores.get(entry.itemId) || 0) + points);
      if (!entries.has(entry.itemId)) entries.set(entry.itemId, entry);
    });
  });
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([itemId, points], index) => ({ ...entries.get(itemId), itemId, position: index + 1, points }));
}

function commonFor(type) {
  const mine = sorted(state.podio[type]).map(entry => entry.itemId);
  const theirs = new Set(sorted(state.partnerPodio?.[type]).map(entry => entry.itemId));
  return mine.filter(id => theirs.has(id)).map(id => {
    const entry = sorted(state.podio[type]).find(item => item.itemId === id);
    return resolveEntry(entry);
  });
}

function partnerColumnHTML(type) {
  if (!state.partner) {
    return emptyHTML({
      title: 'Aún no hay otra cuenta',
      text: 'Cuando la segunda cuenta entre, aquí aparecerá su Top 5.'
    });
  }
  if (state.partnerError === 'sin-permiso') {
    return emptyHTML({
      title: `El Top 5 de ${state.partner.name} aún no es visible`,
      text: 'Falta aplicar la migración 047 (lectura del Top 5 entre pareja). El ranking propio sigue funcionando.'
    });
  }
  if (state.partnerError === 'sin-red') {
    return emptyHTML({ title: 'Sin conexión', text: 'No se pudo leer el Top 5 de la otra cuenta.' });
  }
  const list = sorted(state.partnerPodio?.[type]);
  return rankingRows(list, { emptyText: `${state.partner.name} todavía no ha creado su Top 5.` });
}

function bindOpenRows(root, ctx) {
  root.querySelectorAll('[data-open]').forEach(row => {
    row.addEventListener('click', () => ctx.openDetail(row.dataset.open));
  });
}

export function renderTop5(root, ctx) {
  const key = KEY_FOR[state.topTipo] || 'series';
  const mine = sorted(state.podio[key]);
  const joint = jointFor(key);
  const common = commonFor(key);

  root.innerHTML = `
    <div class="sx-top5">
      <header class="sx-screen-head">
        <div>
          <p class="sx-kicker">Top 5</p>
          <h1 class="sx-title">Lo mejor de cada casa</h1>
          <p class="sx-sub">Rankings personales y lo que compartimos.</p>
        </div>
        <div class="sx-seg sx-seg--small" role="group" aria-label="Tipo de ranking">
          <button type="button" class="${state.topTipo === 'series' ? 'is-on' : ''}" data-top-tipo="series">Series</button>
          <button type="button" class="${state.topTipo === 'movies' ? 'is-on' : ''}" data-top-tipo="movies">Películas</button>
        </div>
      </header>

      <div class="sx-top5-grid">
        <section class="sx-panel">
          <header class="sx-panel-head">
            <div><span class="sx-kicker">Tuyo</span><h3>Mi Top 5</h3></div>
            <button type="button" class="sx-btn sx-btn--compact" data-edit-top>${mine.length ? 'Editar' : 'Crear ranking'}</button>
          </header>
          ${rankingRows(mine, { emptyText: 'Todavía no has ordenado tus favoritos.' })}
        </section>

        <section class="sx-panel">
          <header class="sx-panel-head">
            <div><span class="sx-kicker">De ${escapeHtml(state.partner?.name || 'mi pareja')}</span><h3>Su Top 5</h3></div>
          </header>
          ${partnerColumnHTML(key)}
        </section>

        <section class="sx-panel">
          <header class="sx-panel-head">
            <div><span class="sx-kicker">Calculado</span><h3>Top 5 conjunto</h3></div>
          </header>
          ${joint.length
            ? rankingRows(joint, { emptyText: '' }) + '<p class="sx-note">Suma de vuestros dos rankings.</p>'
            : `<div class="sx-rank-empty">${isAdmin() || state.partner ? 'El conjunto aparece cuando los dos tengáis un Top 5 de este tipo.' : 'Se calcula con los rankings de las dos cuentas.'}</div>`}
        </section>
      </div>

      <section class="sx-section">
        <header class="sx-section-head">
          <div><h3>Gustos en común</h3><p>Títulos que aparecen en vuestros dos rankings.</p></div>
          <span class="sx-section-count">${common.length}</span>
        </header>
        ${common.length
          ? `<div class="sx-common">${common.map(item => `
              <button type="button" class="sx-common-item" data-open-common="${escapeHtml(item.id)}">
                <span class="sx-common-poster">${item.portada ? `<img src="${escapeHtml(item.portada)}" alt="" loading="lazy">` : icon('film', 16)}</span>
                <span>${escapeHtml(item.titulo)}</span>
              </button>`).join('')}</div>`
          : `<p class="sx-muted">Aún no coincidís en ningún título de este ranking.</p>`}
      </section>
    </div>
  `;

  root.querySelectorAll('[data-top-tipo]').forEach(button => {
    button.addEventListener('click', () => {
      state.topTipo = button.dataset.topTipo === 'movies' ? 'movies' : 'series';
      renderTop5(root, ctx);
    });
  });
  root.querySelector('[data-edit-top]')?.addEventListener('click', () => openTop5Editor(ctx));
  bindOpenRows(root, ctx);
  root.querySelectorAll('[data-open-common]').forEach(button => {
    button.addEventListener('click', () => ctx.openDetail(button.dataset.openCommon));
  });
}

function openTop5Editor(ctx) {
  const key = KEY_FOR[state.topTipo] || 'series';
  const tipo = TYPE_FOR[key];
  const catalog = state.catalog.filter(item => item.tipo === tipo);
  let items = sorted(state.podio[key]).map(entry => ({ ...entry }));

  if (!catalog.length) {
    showToast('Añade títulos de ese tipo primero', 'error');
    return;
  }

  const overlay = openSheet('Editar mi Top 5', sheet => {
    const wrap = document.createElement('div');
    wrap.className = 'sx-top5-editor';
    wrap.innerHTML = `
      <p class="sx-muted">Ordena del 1 al 5. Tu ranking es solo tuyo.</p>
      <div data-top5-list></div>
      <label class="sx-select sx-select--block">
        <span>Añadir título</span>
        <select data-top5-add></select>
      </label>
      <div class="form-actions">
        <button type="button" class="sx-btn" data-top5-cancel>Cancelar</button>
        <button type="button" class="sx-btn sx-btn--primary" data-top5-save>Guardar ranking</button>
      </div>
    `;
    sheet.append(wrap);
    return null;
  });

  if (!overlay) return;
  const listHost = overlay.querySelector('[data-top5-list]');
  const select = overlay.querySelector('[data-top5-add]');

  const paint = () => {
    listHost.innerHTML = items.length
      ? items.map((entry, index) => `
          <div class="sx-top5-row" data-index="${index}">
            <span class="sx-rank-pos">${String(index + 1).padStart(2, '0')}</span>
            <span class="sx-top5-row-name">${escapeHtml(catalogById(entry.itemId)?.titulo || entry.titulo || 'Sin título')}</span>
            <button type="button" class="sx-mini" data-move="up" aria-label="Subir" ${index === 0 ? 'disabled' : ''}>${icon('chevron-left', 14)}</button>
            <button type="button" class="sx-mini sx-mini--down" data-move="down" aria-label="Bajar" ${index === items.length - 1 ? 'disabled' : ''}>${icon('chevron-right', 14)}</button>
            <button type="button" class="sx-mini" data-remove aria-label="Quitar">${icon('x', 14)}</button>
          </div>
        `).join('')
      : '<p class="sx-muted">Elige hasta cinco títulos.</p>';

    const used = new Set(items.map(entry => entry.itemId));
    const available = catalog.filter(item => !used.has(item.id));
    select.innerHTML = `<option value="">${available.length ? 'Elige un título…' : 'Top 5 completo'}</option>${available.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.titulo)}</option>`).join('')}`;
    select.disabled = !available.length;

    listHost.querySelectorAll('[data-move]').forEach(button => {
      button.addEventListener('click', () => {
        const index = Number(button.closest('.sx-top5-row').dataset.index);
        const target = button.dataset.move === 'up' ? index - 1 : index + 1;
        if (target < 0 || target >= items.length) return;
        [items[index], items[target]] = [items[target], items[index]];
        paint();
      });
    });
    listHost.querySelectorAll('[data-remove]').forEach(button => {
      button.addEventListener('click', () => {
        const index = Number(button.closest('.sx-top5-row').dataset.index);
        items.splice(index, 1);
        paint();
      });
    });
  };

  select.addEventListener('change', () => {
    const id = select.value;
    if (!id || items.length >= 5) return;
    const item = catalogById(id);
    if (!item) return;
    items.push({ itemId: id, position: items.length + 1, titulo: item.titulo, portada: item.portada || '' });
    paint();
  });

  overlay.querySelector('[data-top5-cancel]')?.addEventListener('click', closeSheets);
  overlay.querySelector('[data-top5-save]')?.addEventListener('click', () => {
    state.podio[key] = items.map((entry, index) => ({ ...entry, position: index + 1 }));
    saveTop5();
    closeSheets();
    showToast('Top 5 guardado', 'success');
    ctx.refresh();
  });

  paint();
}
