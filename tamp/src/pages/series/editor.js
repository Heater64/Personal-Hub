/* ==========================================
   Videoteca Tamp — editor manual, vinculación y gestión

   · Editor: crea y edita fichas manuales sin tocar las importadas.
   · Vincular: busca el equivalente en TMDB, enseña la vista previa y solo
     sobrescribe lo que el usuario marque. Conserva id, progreso, estado,
     favoritos, valoraciones, rankings e historial.
   · Gestión: títulos manuales pendientes de vincular y duplicados.
   ========================================== */

import { escapeHtml } from '../../utils/escape.js';
import { icon, openSheet, closeSheets } from '../../components/ui.js';
import { showToast } from '../../components/Toast.js';
import { isValidUrlField } from '../../utils/format.js';
import { userStore } from '../../stores/user.store.js';
import {
  seasonEditorHTML,
  collectSeasons,
  emptySeasonHTML,
  bindSeasonEditorEvents
} from '../../services/seriesEditor.js';
import {
  createId,
  getSeasons,
  loadProgressFor,
  saveProgressFor,
  loadFavorites,
  saveFavorites,
  loadPodio,
  savePodio,
  applyTmdbLink,
  getLinkPreview,
  getUnlinkedManual,
  findDuplicateGroups,
  deleteProgressFor,
  getOrigin
} from '../../services/seriesData.js';
import { getTmdbDetails, searchTmdbTitles } from '../../services/tmdb.service.js';
import { state, isAdmin, persistCatalog, refreshCatalog, currentUserName } from './store.js';

function wrapSheet(content) {
  return openSheet('', sheet => {
    const host = document.createElement('div');
    host.className = 'sx-sheet-host';
    host.innerHTML = content;
    sheet.append(host);
    return null;
  });
}

/* ==========================================
   EDITOR MANUAL
   ========================================== */

export function openEditor(ctx, itemId = null) {
  if (!isAdmin()) return;
  const item = itemId ? state.catalog.find(entry => String(entry.id) === String(itemId)) : null;
  const seasons = item ? getSeasons(item) : [];

  const overlay = wrapSheet(`
    <header class="sx-sheet-head">
      <div><span class="sx-kicker">${item ? 'Editar' : 'Nueva ficha'}</span><h2>${item ? escapeHtml(item.titulo) : 'Añadir a la biblioteca'}</h2></div>
      <button type="button" class="sx-icon-btn" data-sheet-close aria-label="Cerrar">${icon('x', 18)}</button>
    </header>

    <div class="sx-form">
      <label class="sx-field sx-field--wide"><span>Título *</span><input type="text" data-f="titulo" value="${escapeHtml(item?.titulo || '')}" required></label>
      <label class="sx-field"><span>Tipo</span>
        <select data-f="tipo">
          <option value="serie"${item?.tipo !== 'pelicula' ? ' selected' : ''}>Serie</option>
          <option value="pelicula"${item?.tipo === 'pelicula' ? ' selected' : ''}>Película</option>
        </select>
      </label>
      <label class="sx-field"><span>Año</span><input type="text" data-f="anio" inputmode="numeric" maxlength="4" value="${escapeHtml(item?.anio || '')}"></label>
      <label class="sx-field"><span>Duración (min)</span><input type="number" data-f="duracion" min="0" value="${Number(item?.duracion) || ''}"></label>
      <label class="sx-field"><span>Géneros (separados por coma)</span><input type="text" data-f="generos" value="${escapeHtml((item?.generos || []).join(', '))}"></label>
      <label class="sx-field"><span>Categoría</span><input type="text" data-f="categoria" value="${escapeHtml(item?.categoria || '')}" placeholder="Disney, Marvel…"></label>
      <label class="sx-field sx-field--wide"><span>Sinopsis</span><textarea data-f="descripcion" rows="3">${escapeHtml(item?.descripcion || '')}</textarea></label>
      <label class="sx-field"><span>URL de portada (2:3)</span><input type="url" data-f="portada" value="${escapeHtml(item?.portada || '')}" placeholder="https://…"></label>
      <label class="sx-field"><span>URL de fondo (16:9)</span><input type="url" data-f="banner" value="${escapeHtml(item?.banner || '')}" placeholder="https://…"></label>
      <label class="sx-field"><span>Enlace de reproducción</span><input type="url" data-f="recurso" value="${escapeHtml(item?.recurso || '')}" placeholder="https://…"></label>
      <label class="sx-field"><span>Web del proyecto</span><input type="url" data-f="webUrl" value="${escapeHtml(item?.webUrl || '')}" placeholder="https://…"></label>
      <label class="sx-field"><span>Nº total de episodios (si no usas temporadas)</span><input type="number" data-f="totalEpisodios" min="0" value="${Number(item?.totalEpisodios) || ''}"></label>
      <label class="sx-check"><input type="checkbox" data-f="destacado"${item?.destacado ? ' checked' : ''}> Destacar</label>
    </div>

    <div class="sx-seasons" data-seasons-panel>
      <div class="sx-form-seasons-head">
        <h3>Temporadas y episodios</h3>
        <button type="button" class="sx-btn sx-btn--compact" data-season-add-new>+ Temporada</button>
      </div>
      <div data-seasons-box>${seasonEditorHTML(seasons.length ? seasons : [])}</div>
    </div>

    <div class="form-actions">
      <button type="button" class="sx-btn" data-sheet-close>Cancelar</button>
      <button type="button" class="sx-btn sx-btn--primary" data-save>${item ? 'Guardar cambios' : 'Añadir a la biblioteca'}</button>
    </div>
  `);

  if (!overlay) return;
  const seasonsBox = overlay.querySelector('[data-seasons-box]');
  bindSeasonEditorEvents(seasonsBox);

  overlay.querySelectorAll('[data-sheet-close]').forEach(button => button.addEventListener('click', closeSheets));
  overlay.querySelector('[data-season-add-new]')?.addEventListener('click', () => {
    seasonsBox.insertAdjacentHTML('beforeend', emptySeasonHTML());
  });

  overlay.querySelector('[data-save]')?.addEventListener('click', async () => {
    const get = name => overlay.querySelector(`[data-f="${name}"]`);
    const titulo = get('titulo').value.trim();
    if (!titulo) { showToast('El título es obligatorio', 'error'); return; }

    const urlFields = [
      ['portada', get('portada').value.trim()],
      ['banner', get('banner').value.trim()],
      ['recurso', get('recurso').value.trim()],
      ['webUrl', get('webUrl').value.trim()]
    ];
    const badUrl = urlFields.find(([, value]) => !isValidUrlField(value));
    if (badUrl) {
      showToast(`La URL de ${badUrl[0]} no es válida`, 'error');
      return;
    }

    const tipo = get('tipo').value;
    const collected = tipo === 'serie' ? collectSeasons(seasonsBox) : [];
    const totalEpisodios = Math.max(0, Number(get('totalEpisodios').value) || 0);
    const payload = {
      titulo,
      tipo,
      anio: get('anio').value.trim(),
      duracion: Math.max(0, Number(get('duracion').value) || 0),
      generos: get('generos').value.split(',').map(value => value.trim()).filter(Boolean).slice(0, 10),
      categoria: get('categoria').value.trim(),
      descripcion: get('descripcion').value.trim(),
      portada: urlFields[0][1],
      banner: urlFields[1][1],
      recurso: urlFields[2][1],
      webUrl: urlFields[3][1],
      destacado: get('destacado').checked,
      updatedAt: Date.now()
    };
    if (tipo === 'serie') {
      payload.temporadas = collected;
      if (collected.length) payload.totalEpisodios = 0;
      else payload.totalEpisodios = totalEpisodios;
    }

    let nextCatalog;
    if (item) {
      nextCatalog = state.catalog.map(entry => (String(entry.id) === String(item.id) ? { ...entry, ...payload } : entry));
    } else {
      nextCatalog = [...state.catalog, {
        ...payload,
        id: createId(),
        origen: 'manual',
        createdAt: Date.now(),
        createdBy: userStore.getUser()?.id || '',
        createdByName: currentUserName()
      }];
    }

    try {
      await persistCatalog(nextCatalog);
      closeSheets();
      showToast(item ? 'Ficha actualizada' : 'Añadido a la biblioteca', 'success');
      ctx.refresh();
    } catch (error) {
      showToast(error?.message || 'No se pudo guardar', 'error');
    }
  });
}

/* ==========================================
   VINCULAR CON LA API
   ========================================== */

export function openLinkTool(ctx, presetItemId = null) {
  if (!isAdmin()) return;
  const manual = getUnlinkedManual(state.catalog);
  if (!manual.length) {
    showToast('No quedan títulos manuales pendientes de vincular', 'info');
    return;
  }

  const overlay = wrapSheet(`
    <header class="sx-sheet-head">
      <div><span class="sx-kicker">Herramienta</span><h2>Vincular con TMDB</h2></div>
      <button type="button" class="sx-icon-btn" data-sheet-close aria-label="Cerrar">${icon('x', 18)}</button>
    </header>
    <p class="sx-muted">Se conservan identificador, progreso, estado, favoritos, valoraciones, rankings e historial. Solo se completan metadatos.</p>

    <label class="sx-field sx-field--wide">
      <span>Título manual</span>
      <select data-link-item>
        <option value="">Elige una ficha…</option>
        ${manual.map(entry => `<option value="${escapeHtml(entry.id)}"${String(presetItemId) === String(entry.id) ? ' selected' : ''}>${escapeHtml(entry.titulo)}${entry.anio ? ` (${escapeHtml(entry.anio)})` : ''}</option>`).join('')}
      </select>
    </label>

    <div class="sx-link-search" hidden>
      <label class="sx-field sx-field--wide"><span>Buscar el equivalente en TMDB</span><input type="search" data-link-query placeholder="Escribe el título…"></label>
      <button type="button" class="sx-btn" data-link-search>${icon('search', 15)} Buscar</button>
    </div>

    <div data-link-results class="sx-link-results"></div>
    <div data-link-preview></div>
  `);

  if (!overlay) return;
  const select = overlay.querySelector('[data-link-item]');
  const searchBlock = overlay.querySelector('.sx-link-search');
  const queryInput = overlay.querySelector('[data-link-query]');
  const resultsHost = overlay.querySelector('[data-link-results]');
  const previewHost = overlay.querySelector('[data-link-preview]');
  let external = null;

  overlay.querySelectorAll('[data-sheet-close]').forEach(button => button.addEventListener('click', closeSheets));

  const doSearch = async () => {
    const chosen = state.catalog.find(entry => String(entry.id) === select.value);
    const query = (queryInput.value || chosen?.titulo || '').trim();
    if (query.length < 2) { showToast('Escribe al menos dos caracteres', 'error'); return; }
    resultsHost.innerHTML = '<p class="sx-muted">Buscando en TMDB…</p>';
    try {
      const data = await searchTmdbTitles(query);
      const items = (data.results || []).filter(entry => entry.tipo === chosen?.tipo || !chosen);
      resultsHost.innerHTML = items.length
        ? `<div class="sx-link-grid">${items.map((entry, index) => `
            <button type="button" class="sx-link-result" data-result-index="${index}">
              <span class="sx-link-poster">${entry.portada ? `<img src="${escapeHtml(entry.portada)}" alt="" loading="lazy">` : icon('film', 16)}</span>
              <span><strong>${escapeHtml(entry.titulo)}</strong><small>${entry.tipo === 'serie' ? 'Serie' : 'Película'}${entry.anio ? ` · ${escapeHtml(entry.anio)}` : ''}</small></span>
            </button>`).join('')}</div>`
        : '<p class="sx-muted">Sin resultados. Prueba otro título.</p>';
      resultsHost.querySelectorAll('[data-result-index]').forEach(button => {
        button.addEventListener('click', () => {
          external = items[Number(button.dataset.resultIndex)];
          resultsHost.querySelectorAll('[data-result-index]').forEach(other => other.classList.toggle('is-on', other === button));
          renderPreview();
        });
      });
    } catch (error) {
      resultsHost.innerHTML = `<p class="sx-error-text">${escapeHtml(error?.message || 'No se pudo buscar en TMDB.')}</p>`;
    }
  };

  const renderPreview = () => {
    const chosen = state.catalog.find(entry => String(entry.id) === select.value);
    if (!chosen || !external) { previewHost.innerHTML = ''; return; }
    const changes = getLinkPreview(chosen, external);
    previewHost.innerHTML = `
      <div class="sx-link-preview">
        <h3>Vista previa</h3>
        <p class="sx-muted">${escapeHtml(chosen.titulo)} → ${escapeHtml(external.titulo)}${external.anio ? ` (${escapeHtml(external.anio)})` : ''}</p>
        ${changes.length ? `<div class="sx-link-changes">
          ${changes.map(change => `
            <label class="sx-link-change${change.conflicts ? ' is-conflict' : ''}">
              <span class="sx-link-change-label">${escapeHtml(change.label)}</span>
              <span class="sx-link-change-value">${escapeHtml(Array.isArray(change.after) ? change.after.join(', ') : String(change.after ?? ''))}</span>
              ${change.conflicts ? `<span class="sx-link-change-before">Ahora: ${escapeHtml(Array.isArray(change.before) ? change.before.join(', ') : String(change.before ?? ''))}</span>
              <input type="checkbox" data-overwrite="${change.key}"> <small>Sobrescribir</small>` : '<small class="sx-link-fill">Se completará</small>'}
            </label>`).join('')}
        </div>` : '<p class="sx-muted">No hay metadatos nuevos que completar.</p>'}
        <div class="form-actions">
          <button type="button" class="sx-btn" data-link-cancel>Cancelar</button>
          <button type="button" class="sx-btn sx-btn--primary" data-link-confirm>Confirmar vinculación</button>
        </div>
      </div>
    `;
    previewHost.querySelector('[data-link-cancel]')?.addEventListener('click', () => { previewHost.innerHTML = ''; external = null; });
    previewHost.querySelector('[data-link-confirm]')?.addEventListener('click', async () => {
      const overwriteKeys = [...previewHost.querySelectorAll('[data-overwrite]:checked')].map(input => input.dataset.overwrite);
      await confirmLink(ctx, chosen, external, overwriteKeys);
      closeSheets();
    });
  };

  select?.addEventListener('change', () => {
    const chosen = state.catalog.find(entry => String(entry.id) === select.value);
    searchBlock.hidden = !chosen;
    resultsHost.innerHTML = '';
    previewHost.innerHTML = '';
    external = null;
    if (chosen) {
      queryInput.placeholder = `Buscar «${chosen.titulo}» en TMDB`;
      // Sugerencia automática: el usuario revisa y confirma.
      queryInput.value = chosen.titulo;
      doSearch();
    }
  });
  overlay.querySelector('[data-link-search]')?.addEventListener('click', doSearch);
  queryInput?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); doSearch(); } });

  if (presetItemId) {
    searchBlock.hidden = false;
    const chosen = state.catalog.find(entry => String(entry.id) === String(presetItemId));
    if (chosen) {
      queryInput.value = chosen.titulo;
      doSearch();
    }
  }
}

async function confirmLink(ctx, item, external, overwriteKeys) {
  let details = external;
  try {
    if (external.tmdbId) details = { ...external, ...(await getTmdbDetails(external.tipo, external.tmdbId)) };
  } catch { /* si falla la ficha ampliada se usa la búsqueda */ }

  const linked = applyTmdbLink(item, details, overwriteKeys);
  try {
    await persistCatalog(state.catalog.map(entry => (String(entry.id) === String(item.id) ? linked : entry)));
    showToast(`«${item.titulo}» vinculado con TMDB`, 'success');
    ctx.refresh();
  } catch (error) {
    showToast(error?.message || 'No se pudo guardar la vinculación', 'error');
  }
}

/* ==========================================
   GESTIÓN DE TÍTULOS ANTIGUOS Y DUPLICADOS
   ========================================== */

export function openManageTool(ctx) {
  if (!isAdmin()) return;
  const manual = getUnlinkedManual(state.catalog);
  const groups = findDuplicateGroups(state.catalog);

  const overlay = wrapSheet(`
    <header class="sx-sheet-head">
      <div><span class="sx-kicker">Gestión</span><h2>Biblioteca antigua</h2></div>
      <button type="button" class="sx-icon-btn" data-sheet-close aria-label="Cerrar">${icon('x', 18)}</button>
    </header>

    <section class="sx-manage-block">
      <h3>Manuales pendientes de vincular <span>${manual.length}</span></h3>
      ${manual.length
        ? `<div class="sx-manage-list">${manual.map(entry => `
            <div class="sx-manage-row">
              <span class="sx-manage-poster">${entry.portada ? `<img src="${escapeHtml(entry.portada)}" alt="" loading="lazy">` : icon('film', 15)}</span>
              <span class="sx-manage-name">${escapeHtml(entry.titulo)}${entry.anio ? ` <small>${escapeHtml(entry.anio)}</small>` : ''}</span>
              <button type="button" class="sx-btn sx-btn--compact" data-link-one="${escapeHtml(entry.id)}">Buscar coincidencia</button>
            </div>`).join('')}</div>`
        : '<p class="sx-muted">Todo lo manual ya está vinculado o no hay fichas manuales.</p>'}
    </section>

    <section class="sx-manage-block">
      <h3>Posibles duplicados <span>${groups.length}</span></h3>
      ${groups.length
        ? groups.map((group, groupIndex) => `
            <div class="sx-dupe">
              <p class="sx-muted">${group.map(entry => escapeHtml(entry.titulo)).join(' · ')}</p>
              <div class="sx-dupe-row">
                ${group.map(entry => `<span class="sx-dupe-chip${entry.id === group[0].id ? ' is-keep' : ''}">${escapeHtml(entry.titulo)}${getOrigin(entry) === 'manual' ? ' · manual' : ''}</span>`).join('')}
              </div>
              <button type="button" class="sx-btn sx-btn--compact" data-merge-group="${groupIndex}">Fusionar conservando «${escapeHtml(group[0].titulo)}»</button>
            </div>`).join('')
        : '<p class="sx-muted">No se han detectado duplicados por título o identificador.</p>'}
    </section>
  `);

  if (!overlay) return;
  overlay.querySelectorAll('[data-sheet-close]').forEach(button => button.addEventListener('click', closeSheets));
  overlay.querySelectorAll('[data-link-one]').forEach(button => {
    button.addEventListener('click', () => {
      closeSheets();
      openLinkTool(ctx, button.dataset.linkOne);
    });
  });
  overlay.querySelectorAll('[data-merge-group]').forEach(button => {
    button.addEventListener('click', () => {
      const group = groups[Number(button.dataset.mergeGroup)];
      if (group) void mergeGroup(ctx, group);
    });
  });
}

async function mergeGroup(ctx, group) {
  const [keep, ...duplicates] = group;
  if (!keep || !duplicates.length) return;

  let nextCatalog = state.catalog.filter(item => item.id === keep.id || !duplicates.some(dup => dup.id === item.id));
  nextCatalog = nextCatalog.map(item => (item.id === keep.id ? { ...keep, updatedAt: Date.now() } : item));

  const favorites = loadFavorites();
  duplicates.forEach(dup => {
    if (favorites.has(dup.id)) favorites.add(keep.id);
    favorites.delete(dup.id);

    const keepProgress = { ...loadProgressFor(keep.id) };
    const dupProgress = { ...loadProgressFor(dup.id) };
    if (dupProgress.watched?.length > (keepProgress.watched?.length || 0)) keepProgress.watched = dupProgress.watched;
    if (dupProgress.movieWatched && !keepProgress.movieWatched) keepProgress.movieWatched = true;
    if (dupProgress.rating && !keepProgress.rating) keepProgress.rating = dupProgress.rating;
    if (dupProgress.status && !keepProgress.status) keepProgress.status = dupProgress.status;
    if (Array.isArray(dupProgress.history)) {
      keepProgress.history = [...(keepProgress.history || []), ...dupProgress.history].slice(-80);
    }
    if (Object.keys(keepProgress).length) saveProgressFor(keep.id, keepProgress);

    deleteProgressFor(dup.id);
  });
  saveFavorites(favorites);

  const podio = loadPodio();
  ['series', 'movies'].forEach(type => {
    (podio[type] || []).forEach(entry => {
      if (duplicates.some(dup => String(dup.id) === String(entry.itemId))) entry.itemId = keep.id;
    });
    const seen = new Set();
    podio[type] = (podio[type] || []).filter(entry => {
      if (seen.has(entry.itemId)) return false;
      seen.add(entry.itemId);
      return true;
    });
    podio[type].forEach((entry, index) => { entry.position = index + 1; });
  });
  savePodio(podio);

  try {
    await persistCatalog(nextCatalog);
    await refreshCatalog();
    showToast(`Duplicados fusionados en «${keep.titulo}»`, 'success');
    closeSheets();
    ctx.refresh();
  } catch (error) {
    showToast(error?.message || 'No se pudo fusionar', 'error');
  }
}
