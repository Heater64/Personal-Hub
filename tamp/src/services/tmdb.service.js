import { supabase } from './supabase.js';

/**
 * Consultas a TMDB a través de /api/tmdb.
 *
 * · Caché en memoria (5 min) y peticiones en vuelo compartidas: abrir la misma
 *   ficha dos veces o repetir una búsqueda no gasta otra petición del límite.
 * · La búsqueda se llama ya con debounce desde la pantalla.
 */

const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map();
const inFlight = new Map();

function cacheKey(action, query, params) {
  return `${action}|${query}|${JSON.stringify(params || {})}`;
}

async function request(action, query = '', params = {}) {
  const key = cacheKey(action, query, params);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  if (inFlight.has(key)) return inFlight.get(key);

  const promise = (async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Inicia sesión para buscar series y películas.');

    const url = new URL('/api/tmdb', window.location.origin);
    url.searchParams.set('action', action);
    if (query) url.searchParams.set('q', query);
    Object.entries(params).forEach(([name, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, String(value));
    });

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      credentials: 'same-origin',
    });
    const raw = await response.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      // Sin el endpoint de TMDB (por ejemplo, un dev server sin el middleware)
      // llega HTML: es un fallo del servidor, no «sin resultados».
      throw new Error('El servidor no devolvió datos de TMDB.');
    }
    if (!response.ok) {
      const error = new Error(data.error || 'No se pudo consultar TMDB.');
      // El 503 es configuración del servidor (falta TMDB_ACCESS_TOKEN), no red.
      error.status = response.status;
      throw error;
    }
    cache.set(key, { value: data, expires: Date.now() + CACHE_TTL });
    return data;
  })();

  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}

export async function searchTmdbTitles(query) {
  return request('search', query);
}

export async function getTrendingTmdbTitles() {
  return request('trending');
}

export async function getUpcomingTmdbTitles() {
  return request('upcoming');
}

/** Ficha ampliada: duración, géneros y temporadas con recuento de episodios. */
export async function getTmdbDetails(tipo, tmdbId) {
  const data = await request('details', '', {
    type: tipo === 'pelicula' || tipo === 'movie' ? 'movie' : 'tv',
    id: tmdbId,
  });
  return data.result;
}

/** Episodios de una temporada concreta (nombres y miniaturas reales). */
export async function getTmdbSeason(tmdbId, seasonNumber) {
  const data = await request('season', '', { id: tmdbId, season: seasonNumber });
  return Array.isArray(data.episodes) ? data.episodes : [];
}

/** Descubrir por género (ids de TMDB). */
export async function discoverTmdbTitles(tipo, genre = '') {
  return request('discover', '', {
    type: tipo === 'pelicula' || tipo === 'movie' ? 'movie' : 'tv',
    genre,
  });
}

/** Géneros habituales de TMDB para el explorador. */
export const TMDB_GENRES = [
  { id: '28', label: 'Acción', tipo: 'pelicula' },
  { id: '12', label: 'Aventura', tipo: 'pelicula' },
  { id: '16', label: 'Animación', tipo: 'todo' },
  { id: '35', label: 'Comedia', tipo: 'todo' },
  { id: '80', label: 'Crimen', tipo: 'todo' },
  { id: '99', label: 'Documental', tipo: 'todo' },
  { id: '18', label: 'Drama', tipo: 'todo' },
  { id: '10751', label: 'Familia', tipo: 'pelicula' },
  { id: '14', label: 'Fantasía', tipo: 'pelicula' },
  { id: '27', label: 'Terror', tipo: 'todo' },
  { id: '9648', label: 'Misterio', tipo: 'todo' },
  { id: '10749', label: 'Romance', tipo: 'pelicula' },
  { id: '878', label: 'Ciencia ficción', tipo: 'todo' },
  { id: '53', label: 'Suspense', tipo: 'pelicula' },
  { id: '10759', label: 'Acción y aventura', tipo: 'serie' },
  { id: '10765', label: 'Sci-fi y fantasía', tipo: 'serie' }
];
