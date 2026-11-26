/* ==========================================
   Videoteca Tamp — estado compartido

   Un único estado para las cuatro pestañas y la ficha. El catálogo y la
   lista compartida viven en Supabase; el progreso, las favoritas y el Top 5
   son por cuenta (seriesData los sincroniza entre dispositivos).
   ========================================== */

import {
  loadCatalog,
  loadPodio,
  loadFavorites,
  hydrateProgress,
  saveCatalog,
  saveFavorites,
  savePodio,
  getItemStatus,
  getTotal,
  getOrigin,
  getCatalogSync,
  findCatalogMatch,
  normalizeSeriesText
} from '../../services/seriesData.js';
import {
  loadSharedWatchlist,
  saveSharedWatchlist,
  normalizeWatchlist,
  toggleInWatchlist
} from '../../services/pro.service.js';
import { loadPartnerData } from '../../services/seriesPartner.js';
import { userStore } from '../../stores/user.store.js';

export const state = {
  catalog: [],
  favorites: new Set(),
  podio: { series: [], movies: [] },
  watchlist: [],
  watchlistLoaded: false,
  partner: null,
  partnerPodio: null,
  partnerProgress: null,
  partnerError: '',
  tab: 'inicio',
  detailId: null,
  topTipo: 'series',
  library: {
    q: '',
    tipo: 'todo',
    estado: 'todos',
    origen: 'todas',
    favoritas: false,
    sort: 'recent',
    view: 'grid'
  },
  discover: {
    q: '',
    tipo: 'todo',
    genre: '',
    mode: 'trending',
    loading: false,
    error: '',
    items: [],
    requestId: 0,
    timer: null
  }
};

export function currentUserName() {
  return userStore.getUser()?.name || '';
}

export function isAdmin() {
  return !!userStore.isAdmin;
}

export async function initData() {
  state.catalog = await loadCatalog();
  await hydrateProgress().catch(() => { /* sin red: se conserva lo local */ });
  state.favorites = loadFavorites();
  state.podio = loadPodio();
  await loadWatchlist();
  await loadPartner({ force: true });
}

export async function loadWatchlist() {
  state.watchlist = await loadSharedWatchlist();
  state.watchlistLoaded = true;
  return state.watchlist;
}

export async function loadPartner({ force = false } = {}) {
  const data = await loadPartnerData({ force }).catch(() => null);
  state.partner = data?.partner || null;
  state.partnerPodio = data?.podio || null;
  state.partnerProgress = data?.progress || null;
  state.partnerError = data?.error || '';
  return data;
}

export async function refreshCatalog() {
  state.catalog = await loadCatalog();
  state.favorites = loadFavorites();
  state.podio = loadPodio();
  return state.catalog;
}

export async function persistCatalog(nextCatalog) {
  await saveCatalog(nextCatalog);
  state.catalog = nextCatalog;
  // El espejo local lo actualiza saveContent; refrescamos para compartirlo ya.
  const mirror = getCatalogSync();
  if (Array.isArray(mirror)) state.catalog = mirror;
}

export function saveTop5() {
  savePodio(state.podio);
}

export function toggleFavorite(itemId) {
  if (state.favorites.has(itemId)) state.favorites.delete(itemId);
  else state.favorites.add(itemId);
  saveFavorites(state.favorites);
  return state.favorites.has(itemId);
}

export function catalogById(id) {
  return state.catalog.find(item => String(item.id) === String(id)) || null;
}

export function findMatch(external) {
  return findCatalogMatch(state.catalog, external) || findCatalogMatch(getCatalogSync(), external);
}

export function statusOf(item) {
  return getItemStatus(item);
}

export function isFavorite(itemId) {
  return state.favorites.has(itemId);
}

/** Ids de la lista compartida (admite entradas antiguas sin tipo). */
export function watchlistEntryFor(external) {
  if (!external) return null;
  const tmdbId = external.tmdbId || external.tmdb_id || 0;
  return state.watchlist.find(entry => {
    if (external.id && entry.id === external.id) return true;
    if (tmdbId && entry.tmdbId && String(entry.tmdbId) === String(tmdbId)) return true;
    return normalizeSeriesText(entry.title) === normalizeSeriesText(external.titulo || external.title);
  }) || null;
}

export function watchTipo(entry) {
  if (entry.tipo) return entry.tipo;
  // Entradas antiguas: el id de TMDB guarda el tipo (`tmdb:tv:123`).
  if (String(entry.id).startsWith('tmdb:tv:')) return 'serie';
  if (String(entry.id).startsWith('tmdb:movie:')) return 'pelicula';
  return '';
}

export function externalFromWatch(entry) {
  return {
    id: entry.id,
    tmdbId: entry.tmdbId || Number(String(entry.id).split(':').pop()) || 0,
    tmdbType: watchTipo(entry) === 'serie' ? 'tv' : watchTipo(entry) === 'pelicula' ? 'movie' : '',
    tipo: watchTipo(entry),
    titulo: entry.title,
    anio: entry.anio || '',
    portada: entry.poster || '',
    descripcion: '',
    generos: []
  };
}

/**
 * Lista compartida de pendientes: los títulos de la biblioteca marcados como
 * pendientes + las entradas externas de la watchlist que todavía no están en
 * la biblioteca (sin duplicar).
 */
export function pendingTogether() {
  const out = [];
  const used = new Set();
  state.catalog.forEach(item => {
    if (getItemStatus(item) !== 'pendiente') return;
    used.add(item.id);
    if (item.tmdbId) used.add(`tmdb:${item.tmdbId}`);
    out.push({
      key: `catalog:${item.id}`,
      kind: 'catalog',
      item,
      tipo: item.tipo,
      title: item.titulo || 'Sin título',
      poster: item.portada || '',
      addedBy: item.createdByName || 'Nuestra biblioteca',
      addedAt: item.createdAt || 0
    });
  });
  state.watchlist.forEach(entry => {
    if (entry.done) return;
    if (entry.tmdbId && used.has(`tmdb:${entry.tmdbId}`)) return;
    const match = findCatalogMatch(state.catalog, externalFromWatch(entry));
    if (match) return;
    out.push({
      key: `watch:${entry.id}`,
      kind: 'watch',
      entry,
      tipo: watchTipo(entry),
      title: entry.title || 'Sin título',
      poster: entry.poster || '',
      addedBy: entry.addedBy || '',
      addedAt: Date.parse(entry.addedAt || '') || 0
    });
  });
  return out;
}

export function watchlistExternalFor(entry) {
  const item = findCatalogMatch(state.catalog, externalFromWatch(entry));
  return item || externalFromWatch(entry);
}

async function commitWatchlist(next) {
  const previous = state.watchlist;
  const normalized = normalizeWatchlist(next);
  if (!(await saveSharedWatchlist(normalized))) {
    state.watchlist = previous;
    return false;
  }
  state.watchlist = normalized;
  return true;
}

export async function addToSharedWatchlist(external) {
  const entry = {
    id: external.id || (external.tmdbId ? `tmdb:${external.tmdbType || (external.tipo === 'serie' ? 'tv' : 'movie')}:${external.tmdbId}` : ''),
    title: external.titulo || external.title || '',
    poster: external.portada || external.poster || '',
    tipo: external.tipo || '',
    anio: external.anio || '',
    tmdbId: external.tmdbId || 0
  };
  if (!entry.id) entry.id = `sr:${Date.now()}`;
  return commitWatchlist(toggleInWatchlist(state.watchlist, entry, currentUserName()));
}

export async function toggleSharedWatchlist(external) {
  const existing = watchlistEntryFor(external);
  if (existing) return commitWatchlist(state.watchlist.filter(entry => entry.id !== existing.id));
  return addToSharedWatchlist(external);
}

export async function removeFromSharedWatchlist(entryId) {
  return commitWatchlist(state.watchlist.filter(entry => entry.id !== entryId));
}

export async function markWatchlistEntryDone(entryId, done = true) {
  return commitWatchlist(state.watchlist.map(entry => (entry.id === entryId ? { ...entry, done } : entry)));
}

/** Título de la API → elemento válido del catálogo (solo se guarda al confirmar). */
export function catalogItemFromExternal(title) {
  return {
    id: '',
    tmdbId: title.tmdbId || 0,
    tmdbType: title.tmdbType || '',
    origen: 'api',
    titulo: title.titulo || '',
    tipo: title.tipo || (title.tmdbType === 'tv' ? 'serie' : 'pelicula'),
    anio: title.anio || '',
    descripcion: title.descripcion || '',
    portada: title.portada || '',
    banner: title.banner || '',
    generos: Array.isArray(title.generos) ? title.generos : [],
    valoracion: Number(title.valoracion) || 0,
    duracion: Number(title.duracion) || 0,
    fechaEstreno: title.fechaEstreno || '',
    categoria: '',
    destacado: false,
    recurso: '',
    webUrl: '',
    temporadas: [],
    temporadasMeta: Array.isArray(title.temporadasMeta) ? title.temporadasMeta : [],
    totalEpisodios: Number(title.totalEpisodios) || 0,
    createdAt: Date.now(),
    createdBy: userStore.getUser()?.id || '',
    createdByName: currentUserName()
  };
}

export function formatDate(value) {
  if (!value || value === '0' || Number(value) === 0) return '';
  const date = typeof value === 'number' ? new Date(value) : new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function totalOf(item) {
  return getTotal(item);
}

export function originOf(item) {
  return getOrigin(item);
}
