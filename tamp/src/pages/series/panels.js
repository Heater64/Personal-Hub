/* ==========================================
   Videoteca Tamp — hojas auxiliares
   Ficha externa, lista completa de pendientes y menú contextual.
   ========================================== */

import { escapeHtml } from '../../utils/escape.js';
import { icon, openSheet, closeSheets } from '../../components/ui.js';
import { showToast } from '../../components/Toast.js';
import {
  createId,
  getItemStatus,
  statusLabel,
  setItemStatus,
  toggleMovieSeen,
  deleteCatalogItem,
  isImported
} from '../../services/seriesData.js';
import { getTmdbDetails } from '../../services/tmdb.service.js';
import {
  state,
  isAdmin,
  findMatch,
  watchlistEntryFor,
  toggleSharedWatchlist,
  removeFromSharedWatchlist,
  markWatchlistEntryDone,
  pendingTogether,
  watchlistExternalFor,
  catalogItemFromExternal,
  persistCatalog,
  toggleFavorite
} from './store.js';
import { filmIcon } from './cards.js';

function sheetHost(content) {
  return openSheet('', sheet => {
    const host = document.createElement('div');
    host.className = 'sx-sheet-host';
    host.innerHTML = content;
    sheet.append(host);
    return null;
  });
}

export function importExternal(ctx, title) {
  if (!isAdmin()) {
    showToast('Solo el administrador puede añadir a la biblioteca', 'error');
    return;
  }
  const existing = findMatch(title);
  if (existing) {
    showToast('Ya está en la biblioteca', 'info');
    closeSheets();
    ctx.openDetail(existing.id);
    return;
  }

  const item = {
    ...catalogItemFromExternal(title),
    id: createId(),
    createdAt: Date.now()
  };

  // Se completa con la ficha ampliada si está disponible (no bloquea el alta).
  const save = async () => {
    if (item.tmdbId) {
      try {
        const details = await getTmdbDetails(item.tipo, item.tmdbId);
        if (details) {
          item.duracion = item.duracion || details.duracion || 0;
          item.generos = item.generos?.length ? item.generos : details.generos || [];
          item.temporadasMeta = details.temporadasMeta || [];
          item.totalEpisodios = details.totalEpisodios || item.totalEpisodios || 0;
          item.fechaEstreno = details.fechaEstreno || item.fechaEstreno || '';
        }
      } catch { /* la búsqueda ya trae lo esencial */ }
    }
    try {
      await persistCatalog([...state.catalog, item]);
      closeSheets();
      showToast(`«${item.titulo}» añadido a la biblioteca`, 'success');
      ctx.refresh();
      ctx.openDetail(item.id);
    } catch (error) {
      showToast(error?.message || 'No se pudo añadir a la biblioteca', 'error');
    }
  };

  void save();
}

/* ==========================================
   FICHA EXTERNA (Descubrir)
   ========================================== */

export function openExternalDetail(ctx, title) {
  const existing = findMatch(title);
  if (existing) {
    ctx.openDetail(existing.id);
    return;
  }
  const inWatchlist = !!watchlistEntryFor(title);

  const overlay = sheetHost(`
    <div class="sx-ext">
      ${title.banner || title.portada ? `<div class="sx-ext-bg"><img src="${escapeHtml(title.banner || title.portada)}" alt="" loading="lazy"></div>` : ''}
      <header class="sx-sheet-head">
        <div>
          <span class="sx-kicker">${title.tipo === 'serie' ? 'Serie' : 'Película'}${title.anio ? ` · ${escapeHtml(title.anio)}` : ''}</span>
          <h2>${escapeHtml(title.titulo || 'Sin título')}</h2>
        </div>
        <button type="button" class="sx-icon-btn" data-sheet-close aria-label="Cerrar">${icon('x', 18)}</button>
      </header>
      <div class="sx-ext-body">
        <div class="sx-ext-poster">${title.portada ? `<img src="${escapeHtml(title.portada)}" alt="" loading="lazy">` : filmIcon(24)}</div>
        <div class="sx-ext-info">
          <div class="sx-meta-row">
            ${title.valoracion ? `<span class="sx-rating">★ ${Number(title.valoracion).toFixed(1)}</span>` : ''}
            ${(title.generos || []).slice(0, 3).map(genre => `<span class="sx-tag">${escapeHtml(genre)}</span>`).join('')}
          </div>
          <p>${escapeHtml(title.descripcion || 'Sin sinopsis disponible.')}</p>
          <div class="sx-ext-actions">
            ${isAdmin() ? `<button type="button" class="sx-btn sx-btn--primary" data-import>${icon('plus', 15)} Añadir a la biblioteca</button>` : ''}
            <button type="button" class="sx-btn" data-watchlist aria-pressed="${inWatchlist}">${inWatchlist ? 'En la lista ✓' : 'Añadir a nuestra lista'}</button>
          </div>
        </div>
      </div>
      <p class="sx-attribution">Datos e imágenes proporcionados por TMDB.</p>
    </div>
  `);

  if (!overlay) return;
  overlay.querySelectorAll('[data-sheet-close]').forEach(button => button.addEventListener('click', closeSheets));
  overlay.querySelector('[data-import]')?.addEventListener('click', () => importExternal(ctx, title));
  overlay.querySelector('[data-watchlist]')?.addEventListener('click', async () => {
    const ok = await toggleSharedWatchlist(title);
    if (!ok) { showToast('No se pudo guardar la lista', 'error'); return; }
    const active = !!watchlistEntryFor(title);
    overlay.querySelector('[data-watchlist]').textContent = active ? 'En la lista ✓' : 'Añadir a nuestra lista';
    overlay.querySelector('[data-watchlist]').setAttribute('aria-pressed', String(active));
    ctx.refresh();
  });
}

/* ==========================================
   LISTA COMPLETA DE PENDIENTES
   ========================================== */

export function openPendingItem(ctx, key) {
  const pending = pendingTogether().find(entry => entry.key === key);
  if (!pending) return;
  if (pending.kind === 'catalog') {
    ctx.openDetail(pending.item.id);
    return;
  }
  ctx.openExternal(watchlistExternalFor(pending.entry));
}

export function openPendingList(ctx) {
  const pending = pendingTogether();
  const overlay = sheetHost(`
    <header class="sx-sheet-head">
      <div><span class="sx-kicker">Compartida</span><h2>Para ver juntos</h2></div>
      <button type="button" class="sx-icon-btn" data-sheet-close aria-label="Cerrar">${icon('x', 18)}</button>
    </header>
    ${pending.length
      ? `<div class="sx-pending-list">${pending.map(entry => `
          <div class="sx-pending-row">
            <button type="button" class="sx-pending-open" data-pending-open="${escapeHtml(entry.key)}">
              <span class="sx-pending-poster">${entry.poster ? `<img src="${escapeHtml(entry.poster)}" alt="" loading="lazy">` : filmIcon(16)}</span>
              <span class="sx-pending-copy">
                <strong>${escapeHtml(entry.title)}</strong>
                <small>${entry.tipo === 'serie' ? 'Serie' : entry.tipo === 'pelicula' ? 'Película' : 'Título'}${entry.addedBy ? ` · la añadió ${escapeHtml(entry.addedBy)}` : ''}</small>
              </span>
            </button>
            <div class="sx-pending-actions">
              ${entry.kind === 'catalog'
                ? `<button type="button" class="sx-mini" data-pending-unqueue="${escapeHtml(entry.item.id)}" aria-label="Quitar de pendientes" title="Quitar de pendientes">${icon('x', 15)}</button>`
                : `<button type="button" class="sx-mini" data-pending-done="${escapeHtml(entry.entry.id)}" aria-label="Marcar como vista" title="Marcar como vista">${icon('check', 15)}</button>
                   <button type="button" class="sx-mini" data-pending-remove="${escapeHtml(entry.entry.id)}" aria-label="Quitar de la lista" title="Quitar de la lista">${icon('x', 15)}</button>`}
            </div>
          </div>`).join('')}</div>`
      : '<p class="sx-muted">No hay pendientes compartidos. Añade títulos desde Descubrir.</p>'}
    <div class="form-actions">
      <button type="button" class="sx-btn" data-sheet-close>Cerrar</button>
      <button type="button" class="sx-btn sx-btn--primary" data-go-discover>Descubrir títulos</button>
    </div>
  `);

  if (!overlay) return;
  overlay.querySelectorAll('[data-sheet-close]').forEach(button => button.addEventListener('click', closeSheets));
  overlay.querySelector('[data-go-discover]')?.addEventListener('click', () => {
    closeSheets();
    ctx.goTab('descubrir');
  });
  overlay.querySelectorAll('[data-pending-open]').forEach(button => {
    button.addEventListener('click', () => { closeSheets(); openPendingItem(ctx, button.dataset.pendingOpen); });
  });
  overlay.querySelectorAll('[data-pending-unqueue]').forEach(button => {
    button.addEventListener('click', () => {
      const item = state.catalog.find(entry => String(entry.id) === String(button.dataset.pendingUnqueue));
      if (item) setItemStatus(item.id, null, item);
      showToast('Quitado de pendientes');
      closeSheets();
      ctx.refresh();
    });
  });
  overlay.querySelectorAll('[data-pending-done]').forEach(button => {
    button.addEventListener('click', async () => {
      const target = state.watchlist.find(entry => String(entry.id) === String(button.dataset.pendingDone));
      const linked = findMatch(watchlistExternalFor(target || {}));
      if (linked) toggleMovieSeen(linked.id);
      const ok = await markWatchlistEntryDone(button.dataset.pendingDone, true);
      if (!ok) { showToast('No se pudo guardar', 'error'); return; }
      showToast('Marcado como visto');
      closeSheets();
      ctx.refresh();
    });
  });
  overlay.querySelectorAll('[data-pending-remove]').forEach(button => {
    button.addEventListener('click', async () => {
      const ok = await removeFromSharedWatchlist(button.dataset.pendingRemove);
      if (!ok) { showToast('No se pudo quitar', 'error'); return; }
      closeSheets();
      ctx.refresh();
    });
  });
}

/* ==========================================
   MENÚ CONTEXTUAL DE UN TÍTULO
   ========================================== */

export function openItemMenu(ctx, itemId) {
  const item = state.catalog.find(entry => String(entry.id) === String(itemId));
  if (!item) return;
  const fav = state.favorites.has(item.id);
  const inList = !!watchlistEntryFor(item);
  const status = getItemStatus(item);
  let confirmingDelete = false;

  const overlay = sheetHost(`
    <header class="sx-sheet-head">
      <div><span class="sx-kicker">Acciones</span><h2>${escapeHtml(item.titulo || 'Sin título')}</h2></div>
      <button type="button" class="sx-icon-btn" data-sheet-close aria-label="Cerrar">${icon('x', 18)}</button>
    </header>
    <div class="sx-menu">
      <button type="button" class="sx-menu-row" data-menu-fav>${icon('bookmark', 17)} <span>${fav ? 'Quitar de favoritos' : 'Añadir a favoritos'}</span></button>
      <button type="button" class="sx-menu-row" data-menu-watch>${icon('list', 17)} <span>${inList ? 'Quitar de la lista compartida' : 'Añadir a la lista compartida'}</span></button>
      <div class="sx-menu-group">
        <span class="sx-filter-label">Estado</span>
        <div class="sx-chips sx-chips--scroll">
          ${['pendiente', 'en_curso', 'terminada', 'abandonada'].map(value => `
            <button type="button" class="sx-chip${status === value ? ' is-on' : ''}" data-menu-status="${value}">${statusLabel(value)}</button>
          `).join('')}
        </div>
      </div>
      <button type="button" class="sx-menu-row" data-menu-detail>${icon('eye', 17)} <span>Ver ficha completa</span></button>
      ${isAdmin() ? `<button type="button" class="sx-menu-row" data-menu-edit>${icon('edit', 17)} <span>Editar información</span></button>` : ''}
      ${isAdmin() && !isImported(item) ? `<button type="button" class="sx-menu-row" data-menu-link>${icon('link', 17)} <span>Vincular con la API</span></button>` : ''}
      ${isAdmin() ? `<button type="button" class="sx-menu-row sx-menu-row--danger" data-menu-delete>${icon('trash', 17)} <span>Eliminar de la biblioteca</span></button>` : ''}
    </div>
  `);

  if (!overlay) return;
  overlay.querySelectorAll('[data-sheet-close]').forEach(button => button.addEventListener('click', closeSheets));

  overlay.querySelector('[data-menu-fav]')?.addEventListener('click', () => { toggleFavorite(item.id); closeSheets(); ctx.refresh(); });
  overlay.querySelector('[data-menu-watch]')?.addEventListener('click', async () => {
    const ok = await toggleSharedWatchlist(item);
    if (!ok) { showToast('No se pudo guardar la lista', 'error'); return; }
    closeSheets();
    ctx.refresh();
  });
  overlay.querySelectorAll('[data-menu-status]').forEach(button => {
    button.addEventListener('click', () => {
      setItemStatus(item.id, button.dataset.menuStatus, item);
      closeSheets();
      showToast(`Estado: ${statusLabel(button.dataset.menuStatus)}`);
      ctx.refresh();
    });
  });
  overlay.querySelector('[data-menu-detail]')?.addEventListener('click', () => { closeSheets(); ctx.openDetail(item.id); });
  overlay.querySelector('[data-menu-edit]')?.addEventListener('click', () => { closeSheets(); ctx.openEditor(item.id); });
  overlay.querySelector('[data-menu-link]')?.addEventListener('click', () => { closeSheets(); ctx.openLinkTool(item.id); });
  overlay.querySelector('[data-menu-delete]')?.addEventListener('click', event => {
    if (!confirmingDelete) {
      confirmingDelete = true;
      const button = event.currentTarget;
      button.innerHTML = `${icon('trash', 17)} <span>¿Seguro? Toca otra vez para eliminar</span>`;
      button.classList.add('is-confirming');
      return;
    }
    void (async () => {
      try {
        await deleteCatalogItem(item.id);
        closeSheets();
        showToast('Eliminado de la biblioteca', 'success');
        ctx.closeDetail();
        ctx.refresh();
      } catch (error) {
        showToast(error?.message || 'No se pudo eliminar', 'error');
      }
    })();
  });
}
