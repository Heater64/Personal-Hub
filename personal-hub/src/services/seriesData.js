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

// Portadas de la semilla por id: si la fila de Supabase se quedó con la
// portada vacía (fichas creadas antes de tener imagen), la app usa la de la
// semilla en vez de mostrar el hueco con el icono de respaldo.
const SEED_COVERS = new Map(
  defaultCatalog().map(i => [i.id, { portada: i.portada || '', banner: i.banner || '' }])
);

function fillMissingCovers(list) {
  if (!Array.isArray(list)) return list;
  return list.map(item => {
    if (!item || (item.portada && item.banner)) return item;
    const seed = SEED_COVERS.get(item.id);
    if (!seed || (!seed.portada && !seed.banner)) return item;
    return {
      ...item,
      portada: item.portada || seed.portada,
      banner: item.banner || seed.banner
    };
  });
}

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
    if (Array.isArray(remote?.series)) {
      remote.series = fillMissingCovers(remote.series);
      // Mantener el espejo local al día (ph.config.series): las tarjetas de
      // Inicio/Rincón leen de él de forma síncrona (getCatalogSync).
      try { localStorage.setItem('ph.config.series', JSON.stringify({ series: remote.series })); } catch { /* cuota llena: ignorar */ }
      return remote.series;
    }
  } catch { /* sin red o Supabase caído: seguir con el espejo local */ }
  // 2. Espejo local compartido (offline / arranque rápido)
  const mirror = readMirror();
  if (Array.isArray(mirror)) return mirror;
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

function writePodio(podio) {
  try { localStorage.setItem(PODIO_KEY(), JSON.stringify(podio)); } catch { /* cuota llena */ }
}

/** Top 5 local → y a la cuenta (viaja entre dispositivos). */
export function savePodio(podio) {
  writePodio(podio);
  scheduleSyncPush();
}

export function loadFavorites() {
  try { return new Set(JSON.parse(localStorage.getItem(FAVS_KEY()) || '[]')); }
  catch { return new Set(); }
}

function writeFavorites(set) {
  try { localStorage.setItem(FAVS_KEY(), JSON.stringify([...set])); } catch { /* cuota llena */ }
}

/** Favoritas local → y a la cuenta (viaja entre dispositivos). */
export function saveFavorites(favs) {
  writeFavorites(favs);
  scheduleSyncPush();
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
    if (Array.isArray(parsed?.series) && parsed.series.length) return fillMissingCovers(parsed.series);
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

function readAllProgress() {
  try {
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY()) || '{}');
    return all && typeof all === 'object' ? all : {};
  } catch { return {}; }
}

function writeAllProgress(all) {
  try { localStorage.setItem(PROGRESS_KEY(), JSON.stringify(all)); } catch { /* cuota llena: ignorar */ }
}

// Un solo temporizador: marcar varios capítulos o favoritas seguidos sube el
// estado una vez, no una por clic. Se sincronizan los tres bloques de la
// sección (progreso, favoritas y Top 5) en la misma fila por usuario.
let syncPushTimer = null;

function scheduleSyncPush() {
  if (syncPushTimer) clearTimeout(syncPushTimer);
  syncPushTimer = setTimeout(() => {
    syncPushTimer = null;
    const favoritesList = [...loadFavorites()];
    db.saveSeriesProgress(readAllProgress()).catch(() => { /* sin red: queda local */ });
    db.saveSeriesFavorites(favoritesList).catch(() => { /* sin red: queda local */ });
    db.saveSeriesPodio(loadPodio()).catch(() => { /* sin red: queda local */ });
  }, 500);
}

/**
 * Trae el estado de la cuenta desde Supabase y lo mezcla con el local.
 * Progreso: se une por título (lo remoto manda, lo de este dispositivo se
 * conserva). Favoritas y Top 5: manda la fila de la cuenta, para que también
 * viaje el haber quitado algo en otro dispositivo. Sin sesión o sin Supabase
 * devuelve lo local tal cual.
 */
export async function hydrateProgress() {
  const localProgress = readAllProgress();
  const localFavs = [...loadFavorites()];
  const localPodio = loadPodio();

  const [remoteProgress, remoteFavs, remotePodio] = await Promise.all([
    db.getSeriesProgress().catch(() => null),
    db.getSeriesFavorites().catch(() => null),
    db.getSeriesPodio().catch(() => null)
  ]);

  let push = false;

  if (remoteProgress) {
    const merged = { ...localProgress, ...remoteProgress };
    writeAllProgress(merged);
    if (JSON.stringify(localProgress) !== JSON.stringify(merged)) push = true;
  } else if (Object.keys(localProgress).length) {
    // Primera vez de esta cuenta en la nube: se sube lo que ya hubiera aquí.
    push = true;
  }

  if (Array.isArray(remoteFavs)) {
    if (JSON.stringify(localFavs) !== JSON.stringify(remoteFavs)) {
      writeFavorites(new Set(remoteFavs));
    }
  } else if (localFavs.length) {
    push = true;
  }

  if (remotePodio && typeof remotePodio === 'object') {
    const remoteList = [...(remotePodio.series || []), ...(remotePodio.movies || [])];
    const localList = [...(localPodio.series || []), ...(localPodio.movies || [])];
    if (JSON.stringify(localList) !== JSON.stringify(remoteList)) writePodio(remotePodio);
  } else if ((localPodio.series || []).length || (localPodio.movies || []).length) {
    push = true;
  }

  if (push) scheduleSyncPush();
  return readAllProgress();
}

export function saveProgressFor(itemId, data) {
  const all = readAllProgress();
  all[itemId] = data;
  writeAllProgress(all);
  scheduleSyncPush();
}

/**
 * Series empezadas que siguen EN MARCHA: con algún capítulo visto y alguno
 * pendiente. Las completadas no salen: en Inicio ya no hay nada que seguir
 * (allí se marcan como completadas y desaparecen de «Estás viendo»).
 * Devuelve [{ item, watched, total, percent }].
 */
export function getStartedSeries() {
  const catalog = getCatalogSync();
  if (!catalog.length) return [];
  const all = readAllProgress();
  const out = [];
  for (const [id, d] of Object.entries(all)) {
    const item = catalog.find(c => String(c.id) === String(id));
    if (!item || item.tipo !== 'serie') continue;
    const total = getTotal(item);
    const watched = Math.min(Array.isArray(d?.watched) ? d.watched.length : 0, total);
    if (total > 0 && watched > 0 && watched < total) {
      out.push({ item, watched, total, percent: Math.round((watched / total) * 100) });
    }
  }
  return out.sort((a, b) => String(a.item.titulo || '').localeCompare(String(b.item.titulo || ''), 'es'));
}

/**
 * Suma (+1) o resta (−1) un capítulo visto a una serie, con el mismo modelo
 * acumulativo que la sección: el progreso es 1..N, así que marcar el siguiente
 * deja todos los anteriores vistos. Devuelve { watched, total } o null.
 */
export function bumpWatched(itemId, delta = 1) {
  const item = getCatalogSync().find(c => String(c.id) === String(itemId));
  if (!item) return null;
  const total = getTotal(item);
  if (total <= 0) return null;
  const p = loadProgressFor(itemId);
  const done = Array.isArray(p.watched) ? Math.min(p.watched.length, total) : 0;
  const next = Math.max(0, Math.min(total, done + (delta > 0 ? 1 : -1)));
  const watched = Array.from({ length: next }, (_, i) => i + 1);
  saveProgressFor(itemId, { ...p, watched });
  return { watched: next, total };
}

/** ¿Está marcada como vista esta película? */
export function isMovieWatched(itemId) {
  return loadProgressFor(itemId).movieWatched === true;
}

/**
 * Marca o desmarca una película como vista. Las películas no tienen
 * episodios, así que su estado se guarda en el mismo progreso por usuario que
 * las series (con la misma sincronización entre dispositivos).
 */
export function setMovieWatched(itemId, watched) {
  const next = { ...loadProgressFor(itemId) };
  if (watched) next.movieWatched = true;
  else delete next.movieWatched;

  const hasEpisodes = Array.isArray(next.watched) && next.watched.length > 0;
  if (!next.movieWatched && !hasEpisodes) {
    // Sin nada que contar se borra la entrada: no queda basura en el progreso.
    const all = readAllProgress();
    if (all[itemId]) {
      delete all[itemId];
      writeAllProgress(all);
      scheduleSyncPush();
    }
  } else {
    saveProgressFor(itemId, next);
  }
  return !!next.movieWatched;
}

/** Alterna vista / no vista. Devuelve el estado nuevo. */
export function toggleMovieWatched(itemId) {
  return setMovieWatched(itemId, !isMovieWatched(itemId));
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

  await removeCatalogItem(itemId, await loadCatalog(), saveCatalog);
}

export async function removeCatalogItem(itemId, catalog, save) {
  await save(catalog.filter(item => item.id !== itemId));

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

/** Enlace de reproducción (nuevo `recurso`/`webUrl` o legacy `videoUrl`) */
export function playUrl(item) {
  return item.recurso || item.webUrl || item.videoUrl || '';
}
