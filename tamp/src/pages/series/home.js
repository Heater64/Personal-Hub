/* ==========================================
   Videoteca Tamp — Inicio
   Resumen real de la biblioteca compartida.
   ========================================== */

import { escapeHtml } from '../../utils/escape.js';
import { icon, toast } from '../../components/ui.js';
import { showToast } from '../../components/Toast.js';
import {
  getLibraryStats,
  getItemStatus,
  getProgressPosition,
  getProgressEntry,
  bumpWatched,
  restoreProgress
} from '../../services/seriesData.js';
import {
  state,
  pendingTogether,
  isAdmin
} from './store.js';
import {
  continueCardHTML,
  pendingCardHTML,
  sectionHeadHTML,
  emptyHTML
} from './cards.js';

function statsHTML(stats, pendingCount) {
  return `
    <div class="sx-stats">
      <div class="sx-stat"><strong>${stats.total}</strong><span>en la biblioteca</span></div>
      <div class="sx-stat"><strong>${stats.inProgress}</strong><span>en curso</span></div>
      <div class="sx-stat"><strong>${pendingCount}</strong><span>pendientes</span></div>
    </div>
  `;
}

function watchingHTML(items) {
  if (!items.length) {
    return emptyHTML({
      title: 'Nada en marcha ahora mismo',
      text: 'Cuando empieces una serie aparecerá aquí con su siguiente episodio.',
      actionLabel: 'Ir a la biblioteca',
      actionAttr: 'data-go="biblioteca"'
    });
  }
  return `<div class="sx-continue-list">${items.map(item => continueCardHTML(item)).join('')}</div>`;
}

function togetherHTML(items) {
  if (!items.length) {
    return emptyHTML({
      title: 'La lista compartida está vacía',
      text: 'Añade títulos desde Descubrir para decidir juntos qué ver.',
      actionLabel: 'Descubrir títulos',
      actionAttr: 'data-go="descubrir"'
    });
  }
  const visible = items.slice(0, 14);
  return `
    <div class="sx-carousel">
      ${visible.map(item => pendingCardHTML(item)).join('')}
      ${items.length > visible.length ? `<button type="button" class="sx-pending sx-pending--all" data-pending-all>${icon('plus', 18)}<span>Ver los ${items.length}</span></button>` : ''}
    </div>
  `;
}

function pickerHTML(items) {
  if (!items.length) {
    return emptyHTML({
      title: 'No hay pendientes que sortear',
      text: 'Marca títulos como pendientes o añádelos a la lista compartida.'
    });
  }
  return `
    <div class="sx-picker">
      <div class="sx-seg" role="group" aria-label="Qué tipo de título elegir">
        <button type="button" class="is-on" data-pick-type="todo">Ambos</button>
        <button type="button" data-pick-type="serie">Series</button>
        <button type="button" data-pick-type="pelicula">Películas</button>
      </div>
      <button type="button" class="sx-btn sx-btn--primary" data-pick-random>${icon('spark', 16)} Elegir por nosotros</button>
      <div class="sx-pick-result" id="sxPickResult" aria-live="polite"></div>
    </div>
  `;
}

function pickRandom(items, tipo) {
  const pool = tipo === 'todo' ? items : items.filter(entry => entry.tipo === tipo);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function renderHome(root, ctx) {
  const stats = getLibraryStats(state.catalog);
  const watching = [...state.catalog]
    .filter(item => item.tipo === 'serie' && getItemStatus(item) === 'en_curso')
    .sort((a, b) => getProgressPosition(b).done - getProgressPosition(a).done);
  const pending = pendingTogether();
  stats.pending = pending.length;

  root.innerHTML = `
    <div class="sx-home">
      <header class="sx-home-head">
        <div>
          <p class="sx-kicker">Videoteca</p>
          <h1 class="sx-title">Nuestra videoteca</h1>
        </div>
        <div class="sx-head-actions">
          <button type="button" class="sx-icon-btn" data-focus-library aria-label="Buscar en la biblioteca">${icon('search', 18)}</button>
          ${isAdmin() ? `<button type="button" class="sx-icon-btn sx-icon-btn--accent" data-add-title aria-label="Añadir contenido">${icon('plus', 18)}</button>` : ''}
        </div>
      </header>
      ${statsHTML(stats, pending.length)}

      <section class="sx-section" aria-labelledby="sxWatchingHead">
        <div id="sxWatchingHead">${sectionHeadHTML('Estamos viendo', { count: watching.length, hint: 'Usa + y − para avanzar o retroceder un episodio.' })}</div>
        ${watchingHTML(watching)}
      </section>

      <section class="sx-section">
        ${sectionHeadHTML('Para ver juntos', {
          count: pending.length,
          actionLabel: pending.length ? 'Ver lista completa' : '',
          actionAttr: 'data-pending-all',
          hint: 'Pendientes que compartimos los dos.'
        })}
        ${togetherHTML(pending)}
      </section>

      <section class="sx-section sx-section--plain">
        ${sectionHeadHTML('¿Qué vemos hoy?', { hint: 'Deja que la videoteca decida por vosotros.' })}
        ${pickerHTML(pending)}
      </section>

    </div>
  `;

  // Cabecera
  root.querySelector('[data-focus-library]')?.addEventListener('click', () => {
    ctx.goTab('biblioteca');
    window.setTimeout(() => ctx.page.querySelector('#sxLibrarySearch')?.focus(), 80);
  });
  root.querySelector('[data-add-title]')?.addEventListener('click', () => ctx.openEditor(null));
  root.querySelectorAll('[data-go]').forEach(button => {
    button.addEventListener('click', () => ctx.goTab(button.dataset.go));
  });

  // Sumar o restar un episodio con deshacer.
  root.querySelectorAll('[data-watch-step]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      const itemId = button.dataset.watchItem;
      const delta = Number(button.dataset.watchStep) || 0;
      const item = state.catalog.find(entry => entry.id === itemId);
      if (!item || !delta) return;
      const position = getProgressPosition(item);
      const episode = delta > 0 ? position.next : position.current;
      if (!episode) return;
      const previous = getProgressEntry(itemId);
      const result = bumpWatched(itemId, delta);
      if (!result) return;
      toast(`${episode.episodeTitle} ${delta > 0 ? 'visto' : 'desmarcado'}`, {
        label: 'Deshacer',
        fn: () => {
          restoreProgress(itemId, previous);
          ctx.refresh();
        }
      });
      ctx.refresh();
    });
  });

  // Abrir fichas (respeta botones internos).
  root.querySelectorAll('[data-open]').forEach(element => {
    const open = () => ctx.openDetail(element.dataset.open);
    element.addEventListener('click', event => {
      if (event.target.closest('button')) return;
      open();
    });
    element.addEventListener('keydown', event => {
      if (event.target.closest('button')) return;
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
    });
  });
  root.querySelectorAll('[data-open-title]').forEach(button => {
    button.addEventListener('click', () => ctx.openDetail(button.dataset.openTitle));
  });

  // Menú contextual desde «Estamos viendo».
  root.querySelectorAll('[data-menu-item]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      ctx.openMenu(button.dataset.menuItem);
    });
  });

  // Pendientes
  root.querySelectorAll('[data-pending]').forEach(element => {
    const open = () => ctx.openPending(element.dataset.pending);
    element.addEventListener('click', open);
    element.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
    });
  });
  root.querySelectorAll('[data-pending-all]').forEach(button => {
    button.addEventListener('click', () => ctx.openPendingList());
  });

  // Selector aleatorio
  const picker = root.querySelector('.sx-picker');
  if (picker) {
    let pickType = 'todo';
    picker.querySelectorAll('[data-pick-type]').forEach(button => {
      button.addEventListener('click', () => {
        pickType = button.dataset.pickType;
        picker.querySelectorAll('[data-pick-type]').forEach(other => other.classList.toggle('is-on', other === button));
      });
    });
    picker.querySelector('[data-pick-random]')?.addEventListener('click', () => {
      const list = pendingTogether();
      const chosen = pickRandom(list, pickType);
      const result = picker.querySelector('#sxPickResult');
      if (!chosen) {
        result.innerHTML = '<p class="sx-muted">No hay títulos de ese tipo en pendientes.</p>';
        return;
      }
      result.innerHTML = `
        <div class="sx-pick">
          <div class="sx-pick-poster">${chosen.poster ? `<img src="${escapeHtml(chosen.poster)}" alt="" loading="lazy">` : icon('play', 22)}</div>
          <div class="sx-pick-body">
            <span class="sx-kicker">Hoy toca</span>
            <strong>${escapeHtml(chosen.title)}</strong>
            <span>${chosen.tipo === 'serie' ? 'Serie' : chosen.tipo === 'pelicula' ? 'Película' : 'Título'}${chosen.addedBy ? ` · la añadió ${escapeHtml(chosen.addedBy)}` : ''}</span>
            <button type="button" class="sx-btn" data-pick-open>${icon('play', 14)} Abrir ficha</button>
          </div>
        </div>
      `;
      result.querySelector('[data-pick-open]')?.addEventListener('click', () => {
        if (chosen.kind === 'catalog') ctx.openDetail(chosen.item.id);
        else ctx.openPending(chosen.key);
      });
    });
  }

  if (!state.catalog.length && isAdmin()) {
    showToast('Añade el primer título o impórtalo desde Descubrir', 'info');
  }
}
