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
  if (!item) return [];
  if (Array.isArray(item.temporadas) && item.temporadas.length) return item.temporadas;
  const total = parseInt(item.totalEpisodios) || 0;
  if (total > 0) {
    return [{
      titulo: 'Temporada 1',
      episodios: Array.from({ length: total }, (_, i) => ({ num: i + 1, titulo: `Episodio ${i + 1}` }))
    }];
  }
  // Series importadas de la API: TMDB solo da el recuento por temporada. Se
  // sintetizan los episodios para poder seguir el progreso sin reimportar.
  if (Array.isArray(item.temporadasMeta) && item.temporadasMeta.length) {
    return item.temporadasMeta
      .map((season, si) => ({
        titulo: season.titulo || `Temporada ${season.numero || si + 1}`,
        episodios: Array.from(
          { length: Math.max(0, Number(season.episodios) || 0) },
          (_, i) => ({ num: i + 1, titulo: `Episodio ${i + 1}` })
        )
      }))
      .filter(season => season.episodios.length > 0);
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

// ==========================================
// VIDEOTECA — origen, estado, valoraciones, historial y vinculación
// Amplía el modelo existente sin cambiar el formato guardado: los títulos
// antiguos siguen funcionando y `origen` se deriva de `tmdbId` cuando falta.
// ==========================================

export const STATUS_LABELS = {
  sin_empezar: 'Sin empezar',
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  terminada: 'Terminada',
  abandonada: 'Abandonada'
};

/** 'api' si vino del catálogo externo; 'manual' si se creó a mano. */
export function getOrigin(item) {
  if (!item) return 'manual';
  if (item.origen === 'api' || item.origen === 'manual') return item.origen;
  return item.tmdbId ? 'api' : 'manual';
}

export function isImported(item) {
  return getOrigin(item) === 'api';
}

export function originLabel(item) {
  return isImported(item) ? 'Catálogo' : 'Manual';
}

/** Minúsculas, sin acentos y sin signos: para buscar y detectar duplicados. */
export function normalizeSeriesText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Estado real de un título para el usuario actual. Combina el estado explícito
 * (pendiente/abandonada) con el progreso guardado, para no duplicar datos.
 */
export function getItemStatus(item, entry = null) {
  if (!item) return 'sin_empezar';
  const progress = entry || loadProgressFor(item.id);
  if (progress.status === 'abandonada') return 'abandonada';
  if (item.tipo === 'pelicula') {
    if (progress.movieWatched) return 'terminada';
    return progress.status === 'pendiente' ? 'pendiente' : 'sin_empezar';
  }
  const total = getTotal(item);
  const done = Math.min((progress.watched || []).length, total);
  if (total > 0 && done >= total) return 'terminada';
  if (done > 0) return 'en_curso';
  return progress.status === 'pendiente' ? 'pendiente' : 'sin_empezar';
}

export function statusLabel(status) {
  return STATUS_LABELS[status] || STATUS_LABELS.sin_empezar;
}

function pushHistory(entry, event) {
  const history = Array.isArray(entry.history) ? entry.history.slice(-79) : [];
  history.push({ at: Date.now(), ...event });
  return { ...entry, history };
}

/** Lectura de la entrada de progreso sin mutarla. */
export function getProgressEntry(itemId) {
  return loadProgressFor(itemId);
}
export { loadProgressFor as getRawProgress };

/** Borra el progreso de un título (al fusionar duplicados). */
export function deleteProgressFor(itemId) {
  const all = readAllProgress();
  if (!all[itemId]) return;
  delete all[itemId];
  writeAllProgress(all);
  scheduleSyncPush();
}

/** Guarda una entrada ya construida (se usa para deshacer sin perder datos). */
export function restoreProgress(itemId, entry) {
  if (!entry || !Object.keys(entry).length) {
    const all = readAllProgress();
    delete all[itemId];
    writeAllProgress(all);
    scheduleSyncPush();
    return;
  }
  saveProgressFor(itemId, entry);
}

/** Fija el estado personal (pendiente, abandonada, terminada…). */
export function setItemStatus(itemId, status, item = null) {
  const entry = { ...loadProgressFor(itemId) };
  if (status) entry.status = status;
  else delete entry.status;
  if (status === 'terminada' && item) {
    if (item.tipo === 'pelicula') entry.movieWatched = true;
    else {
      const total = getTotal(item);
      entry.watched = Array.from({ length: total }, (_, i) => i + 1);
    }
    entry.finishedAt = Date.now();
  }
  if (item?.tipo === 'pelicula' && status !== 'terminada') entry.movieWatched = false;
  saveProgressFor(itemId, pushHistory(entry, { type: 'status', status: status || '' }));
  return entry;
}

/** Valoración personal (1–10). 0 la borra. */
export function getMyRating(itemId) {
  const rating = Number(loadProgressFor(itemId).rating);
  return Number.isFinite(rating) && rating > 0 ? rating : 0;
}

export function setMyRating(itemId, rating) {
  const entry = { ...loadProgressFor(itemId) };
  const value = Math.max(0, Math.min(10, Number(rating) || 0));
  if (value > 0) entry.rating = value;
  else delete entry.rating;
  saveProgressFor(itemId, entry);
  return value;
}

/** Posición global → temporada, episodio y títulos legibles. */
export function getEpisodeAt(item, globalNumber) {
  const seasons = getSeasons(item);
  let n = 0;
  for (let si = 0; si < seasons.length; si++) {
    const episodes = seasons[si].episodios || [];
    for (let ei = 0; ei < episodes.length; ei++) {
      n += 1;
      if (n === globalNumber) {
        return {
          globalNumber: n,
          seasonIndex: si,
          episodeIndex: ei,
          season: seasons[si],
          episode: episodes[ei],
          seasonTitle: seasons[si].titulo || `Temporada ${si + 1}`,
          episodeNumber: ei + 1,
          episodeTitle: episodes[ei].titulo || `Episodio ${ei + 1}`
        };
      }
    }
  }
  return null;
}

/** { done, total, percent, current, next } para pintar progreso y «siguiente». */
export function getProgressPosition(item) {
  const total = getTotal(item);
  const done = Math.min(getCompletedCount(item.id, total), total);
  return {
    done,
    total,
    percent: total > 0 ? Math.round((done / total) * 100) : 0,
    current: done > 0 ? getEpisodeAt(item, done) : null,
    next: done < total ? getEpisodeAt(item, done + 1) : null
  };
}

/**
 * Marca un episodio de forma acumulativa (marcar el N deja vistos 1..N).
 * Devuelve la entrada anterior para poder deshacer con restoreProgress().
 */
export function markEpisodeSeen(itemId, globalNumber, item, previousEntry = null) {
  const previous = previousEntry || { ...loadProgressFor(itemId) };
  const total = item ? getTotal(item) : Number(globalNumber) || 0;
  const target = Math.max(0, Math.min(Number(globalNumber) || 0, total));
  let entry = { ...previous, watched: Array.from({ length: target }, (_, i) => i + 1) };
  if (total > 0 && target >= total) entry.status = 'terminada';
  else if (entry.status === 'terminada') delete entry.status;
  entry = pushHistory(entry, { type: 'episode', ep: target, total });
  saveProgressFor(itemId, entry);
  return { previous, entry, done: target, total };
}

/** Marca o desmarca un episodio concreto sin tocar los demás. */
export function toggleEpisodeWatched(itemId, globalNumber, item, previousEntry = null) {
  const previous = previousEntry || { ...loadProgressFor(itemId) };
  const total = item ? getTotal(item) : Number(globalNumber) || 0;
  const target = Math.max(0, Math.min(Number(globalNumber) || 0, total));
  const watched = new Set(Array.isArray(previous.watched) ? previous.watched : []);
  if (watched.has(target)) watched.delete(target);
  else watched.add(target);
  const entry = { ...previous, watched: [...watched].sort((a, b) => a - b) };
  if (total > 0 && entry.watched.length >= total) entry.status = 'terminada';
  else if (entry.status === 'terminada') delete entry.status;
  saveProgressFor(itemId, pushHistory(entry, { type: watched.has(target) ? 'episode' : 'unepisode', ep: target, total }));
  return { previous, entry, watched: watched.has(target) };
}

/** Desmarca desde el episodio indicado en adelante. */
export function unwatchFromEpisode(itemId, globalNumber, item, previousEntry = null) {
  const previous = previousEntry || { ...loadProgressFor(itemId) };
  const total = item ? getTotal(item) : Number(globalNumber) || 0;
  const target = Math.max(0, Math.min(Number(globalNumber) || 0, total));
  const entry = { ...previous, watched: Array.from({ length: Math.max(0, target - 1) }, (_, i) => i + 1) };
  delete entry.status;
  saveProgressFor(itemId, entry);
  return { previous, entry };
}

/** Marca o desmarca una temporada completa. */
export function setSeasonWatched(item, seasonIndex, watched) {
  const seasons = getSeasons(item);
  const season = seasons[seasonIndex];
  if (!season) return null;
  let start = 0;
  for (let i = 0; i < seasonIndex; i++) start += (seasons[i].episodios || []).length;
  const count = (season.episodios || []).length;
  const end = start + count;
  const previous = { ...loadProgressFor(item.id) };
  const entry = { ...previous };
  if (watched) entry.watched = Array.from({ length: end }, (_, i) => i + 1);
  else entry.watched = Array.from({ length: start }, (_, i) => i + 1);
  const total = getTotal(item);
  if (watched && entry.watched.length >= total) entry.status = 'terminada';
  else if (entry.status === 'terminada') delete entry.status;
  saveProgressFor(item.id, pushHistory(entry, { type: watched ? 'season' : 'unseason', season: seasonIndex + 1 }));
  return { previous, entry };
}

/** Marca/desmarca una película vista y deja el registro en el historial. */
export function toggleMovieSeen(itemId) {
  const entry = { ...loadProgressFor(itemId) };
  const seen = !entry.movieWatched;
  if (seen) {
    entry.movieWatched = true;
    entry.finishedAt = Date.now();
    delete entry.status;
    saveProgressFor(itemId, pushHistory(entry, { type: 'movie' }));
  } else {
    delete entry.movieWatched;
    delete entry.finishedAt;
    saveProgressFor(itemId, entry);
  }
  return seen;
}

/** Estadísticas reales de la biblioteca compartida. */
export function getLibraryStats(catalog = getCatalogSync()) {
  const stats = { total: catalog.length, series: 0, movies: 0, inProgress: 0, pending: 0, finished: 0 };
  catalog.forEach(item => {
    if (item.tipo === 'serie') stats.series += 1;
    else stats.movies += 1;
    const status = getItemStatus(item);
    if (status === 'en_curso') stats.inProgress += 1;
    else if (status === 'pendiente') stats.pending += 1;
    else if (status === 'terminada') stats.finished += 1;
  });
  return stats;
}

/** Metadatos de TMDB que se pueden completar al vincular un título manual. */
const LINK_FIELDS = [
  ['titulo', 'Título'],
  ['anio', 'Año'],
  ['descripcion', 'Sinopsis'],
  ['portada', 'Portada'],
  ['banner', 'Imagen de fondo'],
  ['generos', 'Géneros'],
  ['valoracion', 'Nota externa'],
  ['duracion', 'Duración'],
  ['fechaEstreno', 'Fecha de estreno']
];

function isEmptyValue(value) {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0) || value === 0;
}

function valuesDiffer(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a || []) !== JSON.stringify(b || []);
  return String(a ?? '') !== String(b ?? '');
}

/** Lista de cambios que aplicaría la vinculación (para la vista previa). */
export function getLinkPreview(item, tmdb) {
  return LINK_FIELDS
    .filter(([key]) => !isEmptyValue(tmdb?.[key]))
    .map(([key, label]) => ({
      key,
      label,
      before: item?.[key],
      after: tmdb[key],
      conflicts: !isEmptyValue(item?.[key]) && valuesDiffer(item[key], tmdb[key])
    }));
}

/**
 * Aplica la vinculación conservando id, progreso, estado, favoritos, notas,
 * rankings e historial. Solo rellena huecos, salvo que el usuario marque un
 * campo concreto para sobrescribir.
 */
export function applyTmdbLink(item, tmdb, overwriteKeys = []) {
  const next = { ...item };
  LINK_FIELDS.forEach(([key]) => {
    const incoming = tmdb?.[key];
    if (isEmptyValue(incoming)) return;
    const empty = isEmptyValue(next[key]);
    if (empty || overwriteKeys.includes(key)) next[key] = incoming;
  });
  if (!next.tipo && tmdb?.tipo) next.tipo = tmdb.tipo;
  if (tmdb?.tmdbId) next.tmdbId = tmdb.tmdbId;
  if (tmdb?.tmdbType) next.tmdbType = tmdb.tmdbType;
  next.origen = 'api';
  if (Array.isArray(tmdb?.temporadasMeta) && tmdb.temporadasMeta.length) {
    const hasEpisodes = Array.isArray(next.temporadas) && next.temporadas.some(season => (season.episodios || []).length);
    if (!hasEpisodes) {
      next.temporadasMeta = tmdb.temporadasMeta;
      if (!next.totalEpisodios && tmdb.totalEpisodios) next.totalEpisodios = tmdb.totalEpisodios;
    }
  } else if (!next.totalEpisodios && tmdb?.totalEpisodios) {
    next.totalEpisodios = tmdb.totalEpisodios;
  }
  next.updatedAt = Date.now();
  return next;
}

/** Busca un título de la biblioteca equivalente a un resultado externo. */
export function findCatalogMatch(catalog, external) {
  if (!Array.isArray(catalog) || !external) return null;
  if (external.tmdbId) {
    const byTmdb = catalog.find(item => item.tmdbId && String(item.tmdbId) === String(external.tmdbId) && (item.tipo === external.tipo || !external.tipo));
    if (byTmdb) return byTmdb;
  }
  const title = normalizeSeriesText(external.titulo);
  if (!title) return null;
  return catalog.find(item => normalizeSeriesText(item.titulo) === title && item.tipo === external.tipo) || null;
}

/** Grupos de posibles duplicados (mismo tmdbId o mismo título + tipo). */
export function findDuplicateGroups(catalog) {
  const buckets = new Map();
  (catalog || []).forEach(item => {
    const keys = [`title:${item.tipo}:${normalizeSeriesText(item.titulo)}`];
    if (item.tmdbId) keys.push(`tmdb:${item.tmdbId}`);
    keys.forEach(key => {
      if (!buckets.has(key)) buckets.set(key, new Set());
      buckets.get(key).add(item);
    });
  });
  const seen = new Set();
  const groups = [];
  buckets.forEach(set => {
    const items = [...set].filter(item => !seen.has(item.id));
    if (items.length > 1) {
      items.forEach(item => seen.add(item.id));
      groups.push(items);
    }
  });
  return groups;
}

/** Títulos manuales que aún no tienen equivalente en la API. */
export function getUnlinkedManual(catalog) {
  return (catalog || []).filter(item => !isImported(item));
}
