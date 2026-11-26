/* ==========================================
   Videoteca Tamp — ficha de título

   Una sola ficha para manuales e importados. Adapta los bloques a los datos
   disponibles y deja la acción principal a la vista; el resto vive en el menú.
   ========================================== */

import { escapeHtml } from '../../utils/escape.js';
import { icon, toast } from '../../components/ui.js';
import { showToast } from '../../components/Toast.js';
import {
  getSeasons,
  getTotal,
  getProgressPosition,
  getEpisodeAt,
  getItemStatus,
  statusLabel,
  getMyRating,
  setMyRating,
  markEpisodeSeen,
  toggleEpisodeWatched,
  setSeasonWatched,
  toggleMovieSeen,
  restoreProgress,
  typeLabel,
  isImported,
  getOrigin,
  loadProgressFor
} from '../../services/seriesData.js';
import { getTmdbSeason } from '../../services/tmdb.service.js';
import { getPartnerRating } from '../../services/seriesPartner.js';
import { state, isAdmin, formatDate, toggleFavorite } from './store.js';
import { filmIcon, bookmarkIcon } from './cards.js';

const selectedSeason = new Map();
const episodePage = new Map();
const EPISODE_PAGE_SIZE = 30;
const seasonCache = new Map();
const seasonAttempts = new Set();
const seasonLoading = new Set();

function durationLabel(minutes) {
  const value = Number(minutes) || 0;
  if (!value) return '';
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function ratingStars(rating) {
  const value = Math.round(Number(rating) || 0);
  return `<span class="sx-rating" aria-label="${value} de 10">★ ${value || '—'}<small>/10</small></span>`;
}

function historyLabel(event) {
  switch (event.type) {
    case 'episode': return `Episodio ${event.ep} visto`;
    case 'unepisode': return `Episodio ${event.ep} desmarcado`;
    case 'season': return `Temporada ${event.season} completada`;
    case 'unseason': return `Temporada ${event.season} desmarcada`;
    case 'movie': return 'Película vista';
    case 'status': return `Estado: ${statusLabel(event.status)}`;
    default: return 'Cambio guardado';
  }
}

function historyHTML(entry) {
  const events = (Array.isArray(entry.history) ? entry.history : []).slice(-6).reverse();
  if (!events.length) return '<p class="sx-muted">Sin historial todavía.</p>';
  return `<ul class="sx-history">${events.map(event => `
    <li><span>${escapeHtml(historyLabel(event))}</span><small>${escapeHtml(formatDate(event.at))}</small></li>
  `).join('')}</ul>`;
}

function ratingHTML(item, partnerRating) {
  const mine = getMyRating(item.id);
  return `
    <div class="sx-ratings">
      <div class="sx-rating-row">
        <span class="sx-rating-owner">Tu nota</span>
        <select class="sx-rating-select" data-my-rating aria-label="Tu valoración">
          <option value="0"${!mine ? ' selected' : ''}>Sin nota</option>
          ${Array.from({ length: 10 }, (_, i) => i + 1).map(value => `<option value="${value}"${mine === value ? ' selected' : ''}>${value} / 10</option>`).join('')}
        </select>
        ${mine ? ratingStars(mine) : ''}
      </div>
      ${state.partner && state.partnerProgress
        ? `<div class="sx-rating-row">
            <span class="sx-rating-owner">${escapeHtml(state.partner.name)}</span>
            ${partnerRating ? ratingStars(partnerRating) : `<span class="sx-muted">${state.partnerError === 'sin-permiso' ? 'No visible (falta migración 047)' : 'Sin nota'}</span>`}
          </div>`
        : ''}
    </div>
  `;
}

function partnerProgressHTML(item) {
  if (!state.partner || !state.partnerProgress) return '';
  const entry = state.partnerProgress[item.id];
  if (!entry) return '';
  if (item.tipo === 'pelicula') {
    if (!entry.movieWatched) return '';
    return `<p class="sx-partner-progress">${escapeHtml(state.partner.name)} ya la ha visto.</p>`;
  }
  const total = getTotal(item);
  const watched = Math.min(Array.isArray(entry.watched) ? entry.watched.length : 0, total);
  if (!watched || !total) return '';
  const percent = Math.round((watched / total) * 100);
  return `<p class="sx-partner-progress">${escapeHtml(state.partner.name)}: ${watched}/${total} · ${percent}%</p>`;
}

function episodesHTML(item, seasonIndex, watchedNumbers, position) {
  const seasons = getSeasons(item);
  const season = seasons[seasonIndex];
  if (!season) return '';
  const cacheKey = `${item.id}:${seasonIndex}`;
  const cachedEpisodes = seasonCache.get(cacheKey);
  const base = seasons.slice(0, seasonIndex).reduce((sum, entry) => sum + (entry.episodios || []).length, 0);
  const list = cachedEpisodes || season.episodios || [];
  const allWatched = list.length > 0 && list.every((_, index) => watchedNumbers.has(base + index + 1));
  const pageCount = Math.max(1, Math.ceil(list.length / EPISODE_PAGE_SIZE));
  let page = episodePage.get(cacheKey);
  if (page === undefined) {
    // Se abre en la página del siguiente episodio (o del último, si terminó).
    const anchor = Number(position?.next?.globalNumber || position?.done || 0);
    const localAnchor = anchor - base - 1;
    page = localAnchor >= 0 && localAnchor < list.length ? Math.floor(localAnchor / EPISODE_PAGE_SIZE) : 0;
  }
  page = Math.min(Math.max(0, page), pageCount - 1);
  episodePage.set(cacheKey, page);
  const pageStart = page * EPISODE_PAGE_SIZE;
  const visibleList = list.slice(pageStart, pageStart + EPISODE_PAGE_SIZE);
  const ranges = Array.from({ length: pageCount }, (_, index) => {
    const from = index * EPISODE_PAGE_SIZE + 1;
    const to = Math.min((index + 1) * EPISODE_PAGE_SIZE, list.length);
    return { index, label: from === to ? `Episodio ${from}` : `Episodios ${from}–${to}` };
  });

  return `
    <div class="sx-season">
      <div class="sx-season-head">
        <h3>${escapeHtml(season.titulo || `Temporada ${seasonIndex + 1}`)}</h3>
        <div class="sx-season-actions">
          <span class="sx-muted">${list.filter((_, index) => watchedNumbers.has(base + index + 1)).length}/${list.length}</span>
          ${list.length ? `<button type="button" class="sx-btn sx-btn--compact" data-season-toggle="${allWatched ? 'off' : 'on'}">${allWatched ? 'Desmarcar temporada' : '✓ Temporada completa'}</button>` : ''}
        </div>
      </div>
      ${seasonLoading.has(cacheKey) ? '<p class="sx-muted">Cargando episodios de TMDB…</p>' : ''}
      ${list.length
        ? `${pageCount > 1 ? `<div class="sx-ep-pager" data-ep-pages="${pageCount}">
            <button type="button" class="sx-ep-page" data-ep-page="prev" aria-label="Página anterior de episodios"${page === 0 ? ' disabled' : ''}>${icon('chevron-left', 16)}</button>
            <label class="sx-ep-page-select">
              <span class="sr-only">Ir a episodios</span>
              <select data-ep-page-select>${ranges.map(range => `<option value="${range.index}"${range.index === page ? ' selected' : ''}>${range.label}</option>`).join('')}</select>
            </label>
            <span class="sx-ep-count">de ${list.length}</span>
            <button type="button" class="sx-ep-page" data-ep-page="next" aria-label="Página siguiente de episodios"${page === pageCount - 1 ? ' disabled' : ''}>${icon('chevron-right', 16)}</button>
          </div>` : ''}
          <div class="sx-episodes">${visibleList.map((episode, index) => {
            const number = base + pageStart + index + 1;
            const watched = watchedNumbers.has(number);
            const displayNumber = episode.num || pageStart + index + 1;
            const title = episode.titulo || `Episodio ${displayNumber}`;
            const generic = !episode.titulo || title.trim().toLowerCase() === `episodio ${displayNumber}`.toLowerCase();
            return `
              <button type="button" class="sx-episode${watched ? ' is-watched' : ''}" data-episode="${number}" aria-pressed="${watched}">
                <span class="sx-episode-check">${icon('check', 13)}</span>
                ${generic ? '' : `<span class="sx-episode-num">${String(displayNumber).padStart(2, '0')}</span>`}
                <span class="sx-episode-title">${escapeHtml(generic ? `Episodio ${displayNumber}` : title)}</span>
                ${episode.duracion ? `<span class="sx-episode-time">${episode.duracion} min</span>` : ''}
              </button>
            `;
          }).join('')}</div>`
        : `<div class="sx-empty-inline">
            <p class="sx-muted">${item.tipo === 'serie' ? 'Esta temporada no tiene episodios registrados.' : ''}</p>
            ${isAdmin() ? '<button type="button" class="sx-link" data-detail-edit>Editar episodios</button>' : ''}
          </div>`}
    </div>
  `;
}

function seasonsSectionHTML(item, watchedNumbers, position) {
  const seasons = getSeasons(item);
  if (!seasons.length) {
    return `
      <section class="sx-detail-section">
        <h3>Seguimiento</h3>
        <p class="sx-muted">Esta serie no tiene episodios todavía.${isAdmin() ? ' Añádelos desde Editar información.' : ''}</p>
        ${isAdmin() ? '<button type="button" class="sx-btn sx-btn--compact" data-detail-edit>Editar episodios</button>' : ''}
      </section>
    `;
  }
  const active = Math.min(selectedSeason.get(item.id) ?? 0, seasons.length - 1);
  return `
    <section class="sx-detail-section">
      <div class="sx-detail-section-head">
        <h3>Episodios</h3>
        <span class="sx-muted">${seasons.length} ${seasons.length === 1 ? 'temporada' : 'temporadas'}</span>
      </div>
      ${seasons.length > 1
        ? `<div class="sx-chips sx-chips--scroll sx-season-tabs">
            ${seasons.map((season, index) => `<button type="button" class="sx-chip${index === active ? ' is-on' : ''}" data-season-tab="${index}">T${index + 1}</button>`).join('')}
          </div>`
        : ''}
      ${episodesHTML(item, active, watchedNumbers, position)}
    </section>
  `;
}

function primaryActionHTML(item, position, seenMovie) {
  if (item.tipo === 'pelicula') {
    return `<button type="button" class="sx-btn sx-btn--primary" id="srDetailSeen" aria-pressed="${seenMovie}">
      ${seenMovie ? `${icon('check', 16)} Vista` : `${icon('eye', 16)} Marcar como vista`}
    </button>`;
  }
  if (!position.total) {
    return `<button type="button" class="sx-btn" data-detail-edit>${icon('plus', 16)} Añadir episodios</button>`;
  }
  if (position.done >= position.total) {
    return `<span class="sx-btn sx-btn--done" aria-label="Serie completada">${icon('check', 16)} Vista completa</span>`;
  }
  return `<button type="button" class="sx-btn sx-btn--primary" id="srDetailNext">
    ${icon('play', 15)} Marcar ${position.done === 0 ? 'episodio 1' : `ep. ${position.done + 1}`}
  </button>`;
}

export function renderDetail(root, ctx, item) {
  const isSeries = item.tipo === 'serie';
  const position = getProgressPosition(item);
  const progress = loadProgressFor(item.id);
  const watchedNumbers = new Set(Array.isArray(progress.watched) ? progress.watched : []);
  const status = getItemStatus(item);
  const fav = state.favorites.has(item.id);
  const seenMovie = status === 'terminada' && !isSeries;
  const partnerRating = getPartnerRating(state.partnerProgress, item.id);
  const genres = Array.isArray(item.generos) && item.generos.length ? item.generos : [];
  const year = item.anio || (item.fechaEstreno ? String(item.fechaEstreno).slice(0, 4) : '');
  const metaBits = [
    year,
    genres.length ? genres.slice(0, 3).join(' · ') : '',
    isSeries ? '' : durationLabel(item.duracion),
    isSeries && position.total ? `${position.total} episodios` : '',
    item.valoracion ? `★ ${Number(item.valoracion).toFixed(1)}` : ''
  ].filter(Boolean);

  root.innerHTML = `
    <div class="sx-detail">
      <div class="sx-detail-hero">
        ${item.banner || item.portada
          ? `<img src="${escapeHtml(item.banner || item.portada)}" alt="" class="sx-detail-bg" data-cover="${escapeHtml(item.portada || '')}" decoding="async">`
          : '<div class="sx-detail-bg sx-detail-bg--empty"></div>'}
        <div class="sx-detail-shade"></div>
        <button type="button" class="sx-back" data-detail-back aria-label="Volver">${icon('back', 20)}</button>
        <div class="sx-detail-head">
          <div class="sx-detail-poster">${item.portada ? `<img src="${escapeHtml(item.portada)}" alt="" decoding="async" data-detail-poster>` : filmIcon(28)}</div>
          <div class="sx-detail-info">
            <p class="sx-kicker">${typeLabel(item)} · ${isImported(item) ? 'Catálogo' : 'Manual'}</p>
            <h1>${escapeHtml(item.titulo || 'Sin título')}</h1>
            <div class="sx-meta-row">
              ${status !== 'sin_empezar' ? `<span class="sx-tag sx-tag--status">${statusLabel(status)}</span>` : ''}
              ${metaBits.map(bit => `<span class="sx-meta">${escapeHtml(bit)}</span>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="sx-detail-body">
        <div class="sx-detail-actions">
          ${primaryActionHTML(item, position, seenMovie)}
          <button type="button" class="sx-icon-btn ${fav ? 'is-on' : ''}" data-detail-fav aria-label="${fav ? 'Quitar de favoritos' : 'Añadir a favoritos'}" aria-pressed="${fav}">${bookmarkIcon(fav)}</button>
          <button type="button" class="sx-icon-btn" data-detail-menu aria-label="Más acciones">${icon('more', 18)}</button>
        </div>

        ${isSeries && position.total ? `
          <div class="sx-detail-progress">
            <span class="sx-progress"><i style="width:${position.percent}%"></i></span>
            <div class="sx-detail-progress-copy">
              <span>${position.done} de ${position.total} episodios · ${position.percent}%</span>
              ${position.next ? `<span>Siguiente: ${escapeHtml(position.next.episodeTitle)}${position.next.seasonIndex > 0 ? ` (T${position.next.seasonIndex + 1})` : ''}</span>` : '<span>Serie completa</span>'}
            </div>
            ${position.done > 0 && position.done < position.total ? `<button type="button" class="sx-link" data-detail-undo>Deshacer último</button>` : ''}
          </div>
          ${partnerProgressHTML(item)}
        ` : ''}

        ${item.descripcion ? `<p class="sx-detail-synopsis">${escapeHtml(item.descripcion)}</p>` : ''}

        <section class="sx-detail-section">
          <h3>Valoraciones</h3>
          ${ratingHTML(item, partnerRating)}
        </section>

        ${isSeries ? seasonsSectionHTML(item, watchedNumbers, position) : ''}

        <section class="sx-detail-section sx-detail-section--split">
          <div>
            <h3>Historial</h3>
            ${historyHTML(progress)}
          </div>
          <div class="sx-detail-facts">
            <span class="sx-filter-label">En la biblioteca</span>
            <p>${escapeHtml(formatDate(item.createdAt))}</p>
            ${item.updatedAt ? `<p class="sx-muted">Actualizado ${escapeHtml(formatDate(item.updatedAt))}</p>` : ''}
            ${item.createdByName ? `<p class="sx-muted">Añadido por ${escapeHtml(item.createdByName)}</p>` : ''}
            <span class="sx-filter-label">Origen</span>
            <p>${getOrigin(item) === 'api' ? 'Importado del catálogo' : 'Añadido manualmente'}</p>
          </div>
        </section>
      </div>
    </div>
  `;

  // Imagen de fondo: si falla, se usa la portada.
  const bg = root.querySelector('.sx-detail-bg[data-cover]');
  if (bg) {
    bg.addEventListener('error', () => {
      const fallback = bg.dataset.cover;
      if (fallback && !bg.dataset.fb) {
        bg.dataset.fb = '1';
        bg.src = fallback;
      } else {
        bg.style.display = 'none';
      }
    });
  }

  root.querySelector('[data-detail-back]')?.addEventListener('click', () => ctx.closeDetail());
  root.querySelectorAll('[data-detail-edit]').forEach(button => button.addEventListener('click', () => ctx.openEditor(item.id)));
  root.querySelector('[data-detail-menu]')?.addEventListener('click', () => ctx.openMenu(item.id));
  root.querySelector('[data-detail-fav]')?.addEventListener('click', () => {
    const on = toggleFavorite(item.id);
    const button = root.querySelector('[data-detail-fav]');
    button.classList.toggle('is-on', on);
    button.setAttribute('aria-pressed', String(on));
    showToast(on ? 'Añadido a favoritos' : 'Quitado de favoritos');
  });

  // Acción principal
  if (isSeries) {
    root.querySelector('#srDetailNext')?.addEventListener('click', () => {
      const current = getProgressPosition(item);
      if (!current.next) return;
      const result = markEpisodeSeen(item.id, current.done + 1, item);
      toast(`${current.next.episodeTitle} visto`, {
        label: 'Deshacer',
        fn: () => { restoreProgress(item.id, result.previous); renderDetail(root, ctx, item); }
      });
      renderDetail(root, ctx, item);
    });
    root.querySelector('[data-detail-undo]')?.addEventListener('click', () => {
      const current = getProgressPosition(item);
      if (current.done <= 0) return;
      const previous = { ...loadProgressFor(item.id) };
      const entryNext = { ...previous, watched: Array.from({ length: current.done - 1 }, (_, i) => i + 1) };
      delete entryNext.status;
      restoreProgress(item.id, entryNext);
      showToast('Último episodio desmarcado');
      renderDetail(root, ctx, item);
    });
  } else {
    root.querySelector('#srDetailSeen')?.addEventListener('click', () => {
      const seen = toggleMovieSeen(item.id);
      showToast(seen ? 'Película marcada como vista' : 'Película desmarcada');
      renderDetail(root, ctx, item);
    });
  }

  // Valoración
  root.querySelector('[data-my-rating]')?.addEventListener('change', event => {
    const value = setMyRating(item.id, event.target.value);
    showToast(value ? `Tu nota: ${value}/10` : 'Nota borrada');
    renderDetail(root, ctx, item);
  });

  // Temporadas
  const goToEpisodePage = page => {
    const active = selectedSeason.get(item.id) ?? 0;
    episodePage.set(`${item.id}:${active}`, Math.max(0, page));
    renderDetail(root, ctx, item);
    setTimeout(() => {
      root.querySelector('.sx-season')?.scrollIntoView({ block: 'start', behavior: 'auto' });
      root.querySelector('[data-ep-page-select]')?.focus({ preventScroll: true });
    }, 0);
  };
  root.querySelectorAll('[data-ep-page]').forEach(button => {
    button.addEventListener('click', () => {
      const active = selectedSeason.get(item.id) ?? 0;
      const pages = Number(button.closest('[data-ep-pages]')?.dataset.epPages) || 1;
      const current = episodePage.get(`${item.id}:${active}`) ?? 0;
      const step = button.dataset.epPage === 'prev' ? -1 : 1;
      goToEpisodePage(Math.max(0, Math.min(pages - 1, current + step)));
    });
  });
  root.querySelector('[data-ep-page-select]')?.addEventListener('change', event => {
    goToEpisodePage(Number(event.target.value) || 0);
  });
  root.querySelectorAll('[data-season-tab]').forEach(button => {
    button.addEventListener('click', () => {
      selectedSeason.set(item.id, Number(button.dataset.seasonTab));
      renderDetail(root, ctx, item);
    });
  });
  root.querySelectorAll('[data-episode]').forEach(button => {
    button.addEventListener('click', () => {
      const number = Number(button.dataset.episode);
      const result = toggleEpisodeWatched(item.id, number, item);
      const label = getEpisodeAt(item, number)?.episodeTitle || `Episodio ${number}`;
      toast(`${result.watched ? 'Visto' : 'Desmarcado'}: ${label}`, {
        label: 'Deshacer',
        fn: () => { restoreProgress(item.id, result.previous); renderDetail(root, ctx, item); }
      });
      renderDetail(root, ctx, item);
    });
  });
  root.querySelector('[data-season-toggle]')?.addEventListener('click', button => {
    const active = selectedSeason.get(item.id) ?? 0;
    const markOn = button.currentTarget.dataset.seasonToggle === 'on';
    const result = setSeasonWatched(item, active, markOn);
    if (result) {
      toast(markOn ? 'Temporada completa' : 'Temporada desmarcada', {
        label: 'Deshacer',
        fn: () => { restoreProgress(item.id, result.previous); renderDetail(root, ctx, item); }
      });
      renderDetail(root, ctx, item);
    }
  });

  // Episodios reales de TMDB: se cargan solo al abrir esa temporada.
  if (isSeries && item.tmdbId) {
    const seasons = getSeasons(item);
    const active = Math.min(selectedSeason.get(item.id) ?? 0, Math.max(0, seasons.length - 1));
    const cacheKey = `${item.id}:${active}`;
    const meta = item.temporadasMeta?.[active];
    const seasonNumber = meta?.numero ?? active + 1;
    if (!seasonCache.has(cacheKey) && !seasonAttempts.has(cacheKey) && !seasonLoading.has(cacheKey)) {
      seasonAttempts.add(cacheKey);
      seasonLoading.add(cacheKey);
      getTmdbSeason(item.tmdbId, seasonNumber)
        .then(episodes => {
          if (Array.isArray(episodes) && episodes.length) {
            seasonCache.set(cacheKey, episodes.map(episode => ({
              num: episode.numero,
              titulo: episode.titulo,
              miniatura: episode.miniatura,
              duracion: episode.duracion
            })));
          } else {
            seasonCache.set(cacheKey, []);
          }
        })
        .catch(() => seasonCache.set(cacheKey, []))
        .finally(() => {
          seasonLoading.delete(cacheKey);
          if (root.isConnected) renderDetail(root, ctx, item);
        });
    }
  }
}
