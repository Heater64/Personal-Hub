/* ==========================================
   seriesData.js — Capa de datos compartida de
   la sección Series & Películas.

   Single source of truth: Series.js (sección) y
   Admin.js (panel) leen y escriben el MISMO
   catálogo, podio, favoritos y progreso.

   Datos: { id, titulo, tipo: 'serie'|'pelicula',
            descripcion, portada, banner, anio,
            generos[], valoracion, duracion,
            recurso, webUrl, videoUrl (legacy),
            destacado, createdAt, temporadas[] }
   ========================================== */

import { userPrefKey } from '../utils/userStorage.js';
import { db } from './db.service.js';
import { defaultCatalog } from '../data/series-seed.js';

const PODIO_KEY = () => userPrefKey('seriesPodio');
const PROGRESS_KEY = () => userPrefKey('seriesProgress');
const FAVS_KEY = () => userPrefKey('seriesFavorites');

// ==========================================
// CATÁLOGO COMPARTIDO (Supabase)
// Fuente de verdad: fila id='series' de la tabla `content` de Supabase.
// AMBOS usuarios ven el mismo catálogo; solo el admin puede guardar
// (db.saveSeries exige admin). Lectura: Supabase → espejo local
// (ph.config.series, que mantienen realtime y los propios guardados)
// → semilla inicial (Dragon Ball).
// ==========================================

function readMirror() {
  try {
    const raw = localStorage.getItem('ph.config.series');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.series || null;
  } catch { return null; }
}

export async function loadCatalog() {
  // 1. Supabase (compartido entre usuarios)
  try {
    const remote = await db.getSeries();
    if (Array.isArray(remote?.series) && remote.series.length) {
      // Mantener el espejo local al día (ph.config.series): las tarjetas de
      // Inicio/Rincón leen de él de forma síncrona (getCatalogSync).
      try { localStorage.setItem('ph.config.series', JSON.stringify({ series: remote.series })); } catch { /* cuota llena: ignorar */ }
      return remote.series;
    }
  } catch { /* sin red o Supabase caído: seguir con el espejo local */ }
  // 2. Espejo local compartido (offline / arranque rápido)
  const mirror = readMirror();
  if (Array.isArray(mirror) && mirror.length) return mirror;
  // 3. Semilla inicial
  return defaultCatalog();
}

export async function saveCatalog(catalog) {
  // Solo ADMIN: db.saveSeries lanza si el usuario no es admin.
  // saveContent además deja el espejo local (ph.config.series).
  await db.saveSeries(catalog);
}

export function loadPodio() {
  try { return JSON.parse(localStorage.getItem(PODIO_KEY()) || '{"series":[],"movies":[]}'); }
  catch { return { series: [], movies: [] }; }
}

export function savePodio(podio) {
  localStorage.setItem(PODIO_KEY(), JSON.stringify(podio));
}

export function loadFavorites() {
  try { return new Set(JSON.parse(localStorage.getItem(FAVS_KEY()) || '[]')); }
  catch { return new Set(); }
}

export function saveFavorites(favs) {
  localStorage.setItem(FAVS_KEY(), JSON.stringify([...favs]));
}

export function loadProgressFor(itemId) {
  try {
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY()) || '{}');
    return all[itemId] || {};
  } catch { return {}; }
}

/**
 * Catálogo desde el espejo local (sync, sin Supabase). Mantenido por
 * realtime, los propios guardados y loadCatalog(). Si aún no hay espejo
 * (primera visita), devuelve la semilla inicial para que las tarjetas de
 * Inicio/Rincón siempre muestren series del catálogo.
 */
export function getCatalogSync() {
  try {
    const raw = localStorage.getItem('ph.config.series');
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed?.series) && parsed.series.length) return parsed.series;
  } catch { /* espejo corrupto: usar semilla */ }
  return defaultCatalog();
}

/**
 * Títulos en progreso (sync, para Inicio/Rincón). Lee el espejo local del
 * catálogo (ph.config.series) y el progreso del usuario actual.
 * Devuelve [{ item, watched, total, percent }].
 */
export function getContinueWatching() {
  const catalog = getCatalogSync();
  if (!catalog.length) return [];
  let all = {};
  try { all = JSON.parse(localStorage.getItem(PROGRESS_KEY()) || '{}'); } catch { all = {}; }
  const out = [];
  for (const [id, d] of Object.entries(all)) {
    const item = catalog.find(c => String(c.id) === String(id));
    if (!item) continue;
    const total = getTotal(item);
    const watched = Array.isArray(d.watched) ? d.watched.length : 0;
    if (total > 0 && watched > 0 && watched < total) {
      out.push({ item, watched, total, percent: Math.round((watched / total) * 100) });
    }
  }
  return out;
}

export function saveProgressFor(itemId, data) {
  try {
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY()) || '{}');
    all[itemId] = data;
    localStorage.setItem(PROGRESS_KEY(), JSON.stringify(all));
  } catch { /* ignore */ }
}

export function createId() {
  return 'sr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * Elimina un título de TODO el catálogo: catálogo, favoritos,
 * podio (series y películas, renumerando posiciones) y progreso.
 * Fuente única de verdad para borrar desde la sección o el Admin.
 */
export async function deleteCatalogItem(itemId) {
  if (!itemId) return;

  const catalog = await loadCatalog();
  await saveCatalog(catalog.filter(i => i.id !== itemId));

  const favs = loadFavorites();
  if (favs.delete(itemId)) saveFavorites(favs);

  const podio = loadPodio();
  let changed = false;
  ['series', 'movies'].forEach(type => {
    const before = (podio[type] || []).length;
    podio[type] = (podio[type] || []).filter(p => p.itemId !== itemId);
    if (podio[type].length !== before) changed = true;
  });
  if (changed) {
    podio.series.forEach((p, i) => { p.position = i + 1; });
    podio.movies.forEach((p, i) => { p.position = i + 1; });
    savePodio(podio);
  }

  // Progreso
  try {
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY()) || '{}');
    if (all[itemId]) {
      delete all[itemId];
      localStorage.setItem(PROGRESS_KEY(), JSON.stringify(all));
    }
  } catch { /* ignore */ }
}

// ==========================================
// HELPERS DE DATOS (compatibilidad total)
// ==========================================

export function typeLabel(item) {
  return item.tipo === 'serie' ? 'Serie' : 'Película';
}

export function getSeasons(item) {
  if (Array.isArray(item.temporadas) && item.temporadas.length) return item.temporadas;
  const total = parseInt(item.totalEpisodios) || 0;
  if (total > 0) {
    return [{
      titulo: 'Temporada 1',
      episodios: Array.from({ length: total }, (_, i) => ({ num: i + 1, titulo: `Episodio ${i + 1}` }))
    }];
  }
  return [];
}

export function getTotal(item) {
  return getSeasons(item).reduce((a, s) => a + (s.episodios?.length || 0), 0);
}

export function getCompletedCount(itemId, total) {
  const p = loadProgressFor(itemId);
  return Math.min((p.watched || []).length, total);
}

export function getPercent(item) {
  const t = getTotal(item);
  if (t <= 0) return 0;
  return Math.round((getCompletedCount(item.id, t) / t) * 100);
}

export function getStatusText(item) {
  const t = getTotal(item);
  if (t <= 0) return '';
  const done = getCompletedCount(item.id, t);
  if (done >= t) return 'Completado';
  if (done > 0) return `${done}/${t} vistos`;
  return `${t} episodios`;
}

export function detectGenres(item) {
  if (Array.isArray(item.generos) && item.generos.length) return item.generos.slice(0, 4);
  const t = (item.titulo || '').toLowerCase();
  const genres = [];
  if (/anime|animación|animado|animada|dibujo|cartoon/i.test(t)) genres.push('Animación');
  if (/comedia|comic|risa|humor|funny/i.test(t)) genres.push('Comedia');
  if (/misterio|crime|asesinato|detective|sherlock/i.test(t)) genres.push('Misterio');
  if (/amor|romance|romántic|love/i.test(t)) genres.push('Romance');
  if (/terror|horror|miedo|scary/i.test(t)) genres.push('Terror');
  if (/acción|accion|action|guerra|war/i.test(t)) genres.push('Acción');
  if (/drama/i.test(t)) genres.push('Drama');
  if (/ciencia|ficción|futuro|space|espacio/i.test(t)) genres.push('Ciencia ficción');
  if (item.tipo === 'pelicula') genres.push('Película');
  if (item.tipo === 'serie') genres.push('Serie');
  return genres.length ? genres.slice(0, 3) : [typeLabel(item)];
}

export function formatYear(item) {
  return item.anio ? String(item.anio) : '';
}

export function formatRating(item) {
  const r = parseFloat(item.valoracion);
  return isNaN(r) ? '' : r.toFixed(1);
}

export function formatDuration(item) {
  return item.duracion ? `${item.duracion} min` : '';
}

/** Enlace de reproducción (nuevo `recurso`/`webUrl` o legacy `videoUrl`) */
export function playUrl(item) {
  return item.recurso || item.webUrl || item.videoUrl || '';
}
