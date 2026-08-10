/* ==========================================
   seriesEditor.js — Editor compartido de
   temporadas/episodios para la sección
   Series & Películas y el Panel Admin.

   Genera el markup, recolecta los valores y
   gestiona los eventos por delegación para
   que los nodos añadidos dinámicamente
   funcionen sin re-binding.

   - Creación rápida: un input de cantidad
     añade N episodios de una vez.
   - Temporadas colapsables con contador.
   - Aplicar una portada a todos los episodios.
   ========================================== */

import { escapeHtml } from '../utils/escape.js';

const MAX_BULK = 200;

/** Markup de una fila de episodio del editor */
function episodeRowHTML(ei, ep) {
  return `
    <div class="sr-ep-editor" data-ep-index="${ei}">
      <span class="sr-ep-editor-num">${String(ei + 1).padStart(2, '0')}</span>
      <input class="sr-ep-input sr-ep-input--title" data-ep-field="titulo" value="${escapeHtml(ep?.titulo || '')}" placeholder="Título del episodio">
      <input class="sr-ep-input sr-ep-input--thumb" data-ep-field="miniatura" value="${escapeHtml(ep?.miniatura || '')}" placeholder="URL miniatura">
      <input class="sr-ep-input sr-ep-input--url" data-ep-field="recurso" value="${escapeHtml(ep?.recurso || '')}" placeholder="URL reproducción">
      <button type="button" class="sr-ep-del" data-ep-del aria-label="Eliminar episodio">✕</button>
    </div>`;
}

/** Markup del editor de temporadas + episodios */
export function seasonEditorHTML(seasons) {
  return seasons.map((s, si) => {
    const count = (s.episodios || []).length;
    return `
    <div class="sr-season-editor" data-season-index="${si}">
      <div class="sr-season-editor-head">
        <button type="button" class="sr-season-toggle" data-season-toggle aria-label="Expandir o colapsar temporada" aria-expanded="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <input class="sr-season-title-input" data-season-title value="${escapeHtml(s.titulo || `Temporada ${si + 1}`)}" placeholder="Título de la temporada">
        <span class="sr-season-editor-count" data-season-count>${count} ep</span>
        <button type="button" class="sr-season-del" data-season-del aria-label="Eliminar temporada">✕</button>
      </div>
      <div class="sr-season-editor-body">
        ${(s.episodios || []).map((ep, ei) => episodeRowHTML(ei, ep)).join('')}
        <div class="sr-ep-actions-row">
          <button type="button" class="sr-ep-add" data-season-add>+ Añadir episodio</button>
          <div class="sr-ep-bulk">
            <input type="number" class="sr-ep-bulk-input" data-season-bulk-count min="1" max="${MAX_BULK}" value="10" inputmode="numeric" aria-label="Cantidad de episodios a añadir">
            <button type="button" class="sr-ep-bulk-btn" data-season-bulk title="Añadir varios episodios de una vez">Añadir N episodios</button>
          </div>
        </div>
        <div class="sr-ep-thumb-all">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <input type="text" class="sr-ep-thumb-all-input" data-season-thumb-all placeholder="URL de portada para todos los episodios">
          <button type="button" class="sr-ep-thumb-all-btn" data-season-thumb-apply>Aplicar a todos</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

/** Markup de una temporada vacía (nueva) */
export function emptySeasonHTML() {
  return seasonEditorHTML([{ titulo: '', episodios: [{ num: 1, titulo: '' }] }]);
}

/** Lee los inputs del DOM y devuelve el array de temporadas */
export function collectSeasons(scope) {
  const seasons = [];
  scope.querySelectorAll('.sr-season-editor').forEach(seasonEl => {
    const eps = [];
    seasonEl.querySelectorAll('.sr-ep-editor').forEach((epEl, ei) => {
      const get = field => epEl.querySelector(`[data-ep-field="${field}"]`)?.value?.trim() || '';
      const titulo = get('titulo') || `Episodio ${ei + 1}`;
      eps.push({ num: ei + 1, titulo, miniatura: get('miniatura'), recurso: get('recurso') });
    });
    if (!eps.length) return;
    seasons.push({
      titulo: seasonEl.querySelector('[data-season-title]')?.value?.trim() || `Temporada ${seasons.length + 1}`,
      episodios: eps
    });
  });
  return seasons;
}

/** Eventos por delegación: añadir/eliminar episodios, colapsar, portada masiva */
export function bindSeasonEditorEvents(scope) {
  if (scope._srSeasonBound) return;
  scope._srSeasonBound = true;

  const refreshCount = (seasonEl) => {
    const badge = seasonEl.querySelector('[data-season-count]');
    if (badge) {
      const n = seasonEl.querySelectorAll('.sr-ep-editor').length;
      badge.textContent = `${n} ep`;
    }
  };

  const addEpisodeRows = (seasonEl, count) => {
    const start = seasonEl.querySelectorAll('.sr-ep-editor').length;
    let html = '';
    for (let i = start; i < start + count; i++) html += episodeRowHTML(i);
    const anchor = seasonEl.querySelector('.sr-ep-actions-row');
    if (anchor) anchor.insertAdjacentHTML('beforebegin', html);
    else seasonEl.querySelector('.sr-season-editor-body')?.insertAdjacentHTML('beforeend', html);
    refreshCount(seasonEl);
  };

  scope.addEventListener('click', (e) => {
    const seasonDel = e.target.closest('[data-season-del]');
    if (seasonDel) { seasonDel.closest('.sr-season-editor')?.remove(); return; }

    const toggle = e.target.closest('[data-season-toggle]');
    if (toggle) {
      const seasonEl = toggle.closest('.sr-season-editor');
      const collapsed = seasonEl.classList.toggle('is-collapsed');
      toggle.setAttribute('aria-expanded', String(!collapsed));
      return;
    }

    const epDel = e.target.closest('[data-ep-del]');
    if (epDel) { epDel.closest('.sr-ep-editor')?.remove(); refreshCount(epDel.closest('.sr-season-editor')); return; }

    const seasonAdd = e.target.closest('[data-season-add]');
    if (seasonAdd) {
      addEpisodeRows(seasonAdd.closest('.sr-season-editor'), 1);
      return;
    }

    const bulkBtn = e.target.closest('[data-season-bulk]');
    if (bulkBtn) {
      const seasonEl = bulkBtn.closest('.sr-season-editor');
      const countEl = seasonEl.querySelector('[data-season-bulk-count]');
      let count = parseInt(countEl?.value, 10);
      if (!count || count < 1) count = 1;
      if (count > MAX_BULK) count = MAX_BULK;
      addEpisodeRows(seasonEl, count);
      countEl.value = '10';
      return;
    }

    const thumbApply = e.target.closest('[data-season-thumb-apply]');
    if (thumbApply) {
      const seasonEl = thumbApply.closest('.sr-season-editor');
      const input = seasonEl.querySelector('[data-season-thumb-all]');
      const url = input?.value?.trim() || '';
      if (!url) {
        // Feedback mínimo sin dependencias: parpadeo del input
        input?.classList.add('is-empty');
        setTimeout(() => input?.classList.remove('is-empty'), 700);
        return;
      }
      seasonEl.querySelectorAll('[data-ep-field="miniatura"]').forEach(f => { f.value = url; });
      const btn = thumbApply;
      const prev = btn.textContent;
      btn.textContent = '✓ Aplicada';
      setTimeout(() => { btn.textContent = prev; }, 1200);
    }
  });
}
