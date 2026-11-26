/* ==========================================
   Videoteca Tamp — tarjetas y bloques reutilizables
   ========================================== */

import { escapeHtml } from '../../utils/escape.js';
import { icon } from '../../components/ui.js';
import {
  getProgressPosition,
  getItemStatus,
  statusLabel,
  isImported,
  getOrigin,
  typeLabel
} from '../../services/seriesData.js';
import { isFavorite } from './store.js';

/** Icono de cine (claqueta) para huecos sin portada. */
export function filmIcon(size = 22) {
  return `<span class="sx-film" aria-hidden="true"><svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 8 5 3h4L7 8M11 8l2-5h4l-2 5M19 8l2-5h-4"/><path d="M7 13h4M7 16h7"/></svg></span>`;
}

export function bookmarkIcon(filled) {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>`;
}

export function posterInner(item, { lazy = true } = {}) {
  const src = item?.portada || '';
  const title = escapeHtml(item?.titulo || 'Sin título');
  return `
    ${src
      ? `<img src="${escapeHtml(src)}" alt="Portada de ${title}" loading="${lazy ? 'lazy' : 'eager'}" decoding="async" data-poster-img>`
      : ''}
    <span class="sx-poster-fallback"${src ? ' hidden' : ''}>${filmIcon(26)}</span>
  `;
}

function statusPill(item) {
  const status = getItemStatus(item);
  if (status === 'terminada') return `<span class="sx-badge sx-badge--done${item.tipo === 'pelicula' ? ' series-card-watched' : ''}">Vista</span>`;
  if (status === 'en_curso') {
    const { percent } = getProgressPosition(item);
    return `<span class="sx-badge">${percent}%</span>`;
  }
  if (status === 'pendiente') return `<span class="sx-badge sx-badge--soft">Pendiente</span>`;
  if (status === 'abandonada') return `<span class="sx-badge sx-badge--soft">Abandonada</span>`;
  return '';
}

export function gridCardHTML(item) {
  const percent = item.tipo === 'serie' ? getProgressPosition(item).percent : 0;
  const fav = isFavorite(item.id);
  const title = escapeHtml(item.titulo || 'Sin título');
  const meta = [typeLabel(item), item.anio].filter(Boolean).join(' · ');
  return `
    <article class="series-card sx-card" data-open="${escapeHtml(item.id)}" tabindex="0" role="button" aria-label="Abrir ${title}">
      <div class="sx-poster">
        ${posterInner(item)}
        ${statusPill(item)}
        <button type="button" class="sx-fav${fav ? ' is-on' : ''}" data-fav="${escapeHtml(item.id)}" aria-label="${fav ? 'Quitar de favoritas' : 'Añadir a favoritas'}" aria-pressed="${fav}">${bookmarkIcon(fav)}</button>
        ${item.tipo === 'serie' && percent > 0 ? `<span class="sx-card-progress"><i style="width:${percent}%"></i></span>` : ''}
      </div>
      <div class="sx-card-body">
        <h4>${title}</h4>
        <p>${escapeHtml(meta)}${isImported(item) ? '' : ' · manual'}</p>
      </div>
    </article>
  `;
}

export function libraryRowHTML(item) {
  const percent = item.tipo === 'serie' ? getProgressPosition(item).percent : 0;
  const status = getItemStatus(item);
  return `
    <button type="button" class="sx-row" data-open="${escapeHtml(item.id)}">
      <span class="sx-row-poster">${posterInner(item)}</span>
      <span class="sx-row-body">
        <span class="sx-row-title">${escapeHtml(item.titulo || 'Sin título')}</span>
        <span class="sx-row-meta">${typeLabel(item)}${item.anio ? ` · ${escapeHtml(item.anio)}` : ''} · ${statusLabel(status)}${getOrigin(item) === 'manual' ? ' · manual' : ''}</span>
        ${item.tipo === 'serie' && percent > 0 ? `<span class="sx-row-bar"><i style="width:${percent}%"></i></span>` : ''}
      </span>
      <span class="sx-row-score">${percent > 0 ? `${percent}%` : ''}</span>
    </button>
  `;
}

/** Tarjeta horizontal de «Estamos viendo». */
export function continueCardHTML(item) {
  const position = getProgressPosition(item);
  const percent = position.percent;
  const next = position.next;
  const current = position.current;
  const seasonLabel = current && !/^temporada\s+\d+$/i.test(current.seasonTitle || '')
    ? current.seasonTitle
    : `T${(current?.seasonIndex ?? 0) + 1}`;
  const watchedLabel = current
    ? `${seasonLabel} · E${current.episodeNumber}`
    : `${position.total} episodios`;
  return `
    <article class="sx-continue" data-open="${escapeHtml(item.id)}">
      <div class="sx-continue-poster">${posterInner(item)}</div>
      <div class="sx-continue-body">
        <h4><button type="button" class="sx-continue-title" data-open-title="${escapeHtml(item.id)}">${escapeHtml(item.titulo || 'Sin título')}</button></h4>
        <p>${escapeHtml(watchedLabel)}</p>
        <span class="sx-progress" aria-label="${percent}% visto"><i style="width:${percent}%"></i></span>
        ${next
          ? `<p class="sx-continue-next"><span class="sx-continue-next-label">Siguiente</span><span class="sx-continue-next-title">${escapeHtml(next.episodeTitle)}</span></p>`
          : '<p class="sx-continue-next sx-continue-next--done"><span class="sx-continue-next-title">Serie completa</span></p>'}
      </div>
      <div class="sx-continue-actions">
        <div class="sx-step-group">
          <button type="button" class="sx-step" data-watch-item="${escapeHtml(item.id)}" data-watch-step="-1" aria-label="Quitar el último episodio visto" title="Quitar el último episodio visto"${position.done ? '' : ' disabled'}>${icon('minus', 17)}</button>
          <button type="button" class="sx-step sx-step--plus" data-watch-item="${escapeHtml(item.id)}" data-watch-step="1" aria-label="Marcar ${escapeHtml(next?.episodeTitle || 'el siguiente episodio')} como visto" title="Marcar el siguiente episodio como visto"${next ? '' : ' disabled'}>${icon('plus', 17)}</button>
        </div>
        <button type="button" class="sx-more" data-menu-item="${escapeHtml(item.id)}" aria-label="Más acciones">${icon('more', 17)}</button>
      </div>
    </article>
  `;
}

/** Portada 2:3 de la lista compartida de pendientes. */
export function pendingCardHTML(pending) {
  const title = escapeHtml(pending.title);
  const addedBy = pending.addedBy ? `<span class="sx-pending-by">${escapeHtml(pending.addedBy)}</span>` : '';
  return `
    <article class="sx-pending" data-pending="${escapeHtml(pending.key)}" tabindex="0" role="button" aria-label="Abrir ${title}">
      <div class="sx-poster">${posterInner({ titulo: pending.title, portada: pending.poster })}</div>
      <h4>${title}</h4>
      ${addedBy}
    </article>
  `;
}

/** Resultado externo (Descubrir): portada limpia, sin sinopsis ni botones. */
export function externalCardHTML(title, { inLibrary, inWatchlist, index = 0 }) {
  const name = escapeHtml(title.titulo || 'Sin título');
  const badge = inLibrary
    ? '<span class="sx-badge sx-badge--done">En biblioteca</span>'
    : inWatchlist
      ? '<span class="sx-badge sx-badge--soft">En la lista</span>'
      : '';
  return `
    <article class="sx-card sx-card--external" data-external-index="${Number(index) || 0}" tabindex="0" role="button" aria-label="Abrir ${name}">
      <div class="sx-poster">
        ${posterInner(title)}
        ${badge}
      </div>
      <div class="sx-card-body">
        <h4>${name}</h4>
        <p>${typeLabel(title)}${title.anio ? ` · ${escapeHtml(title.anio)}` : ''}${title.valoracion ? ` · ★ ${Number(title.valoracion).toFixed(1)}` : ''}</p>
      </div>
    </article>
  `;
}

export function sectionHeadHTML(title, { count = 0, actionLabel = '', actionAttr = '', hint = '' } = {}) {
  return `
    <header class="sx-section-head">
      <div>
        <h3>${escapeHtml(title)}</h3>
        ${hint ? `<p>${escapeHtml(hint)}</p>` : ''}
      </div>
      <div class="sx-section-tools">
        ${count ? `<span class="sx-section-count">${count}</span>` : ''}
        ${actionLabel ? `<button type="button" class="sx-link" ${actionAttr}>${escapeHtml(actionLabel)}</button>` : ''}
      </div>
    </header>
  `;
}

export function emptyHTML({ iconName = 'film', title, text = '', actionLabel = '', actionAttr = '' }) {
  return `
    <div class="sx-empty">
      <div class="sx-empty-icon">${iconName === 'film' ? filmIcon(22) : icon(iconName, 22)}</div>
      <h3>${escapeHtml(title)}</h3>
      ${text ? `<p>${escapeHtml(text)}</p>` : ''}
      ${actionLabel ? `<button type="button" class="sx-btn" ${actionAttr}>${escapeHtml(actionLabel)}</button>` : ''}
    </div>
  `;
}

export function skeletonCardsHTML(count = 6) {
  return `<div class="sx-grid" role="status" aria-live="polite" aria-busy="true"><span class="sr-only">Cargando…</span>${Array.from({ length: count }, () => '<span class="sx-skeleton sx-skeleton--poster" aria-hidden="true"></span>').join('')}</div>`;
}

export function skeletonRowsHTML(count = 4) {
  return `<div class="sx-continue-list" role="status" aria-live="polite" aria-busy="true"><span class="sr-only">Cargando…</span>${Array.from({ length: count }, () => '<span class="sx-skeleton sx-skeleton--row" aria-hidden="true"></span>').join('')}</div>`;
}
