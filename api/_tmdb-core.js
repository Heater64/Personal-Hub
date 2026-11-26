import { createClient } from '@supabase/supabase-js';

const TMDB_API = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p';
let genreCache = { expires: 0, values: {} };

function json(status, body) {
  return { status, body };
}

function mapTitle(item, genreNames = {}) {
  const type = item.media_type === 'tv' ? 'serie' : 'pelicula';
  const date = type === 'serie' ? item.first_air_date : item.release_date;
  const poster = item.poster_path ? `${IMAGE_BASE}/w500${item.poster_path}` : '';
  return {
    id: `tmdb:${item.media_type}:${item.id}`,
    tmdbId: Number(item.id),
    tmdbType: item.media_type,
    tipo: type,
    titulo: String(item.title || item.name || '').slice(0, 180),
    tituloOriginal: String(item.original_title || item.original_name || '').slice(0, 180),
    descripcion: String(item.overview || '').slice(0, 1800),
    portada: poster,
    banner: item.backdrop_path ? `${IMAGE_BASE}/w780${item.backdrop_path}` : '',
    anio: /^\d{4}/.test(date || '') ? date.slice(0, 4) : '',
    valoracion: Number.isFinite(Number(item.vote_average)) ? Number(item.vote_average) : 0,
    fecha: date || '',
    generosIds: Array.isArray(item.genre_ids) ? item.genre_ids.slice(0, 12) : [],
    generos: (item.genre_ids || []).map(id => genreNames[`${item.media_type}:${id}`]).filter(Boolean),
  };
}

export async function handleTmdbRequest(req) {
  if (req.method !== 'GET') return json(405, { error: 'Método no permitido.' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const tmdbToken = process.env.TMDB_ACCESS_TOKEN;
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !tmdbToken) {
    return json(503, { error: 'Falta configurar el servicio de búsqueda en el servidor.' });
  }

  const accessToken = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  if (!accessToken) return json(401, { error: 'Inicia sesión para buscar en TMDB.' });

  try {
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) return json(401, { error: 'La sesión ha caducado. Vuelve a iniciar sesión.' });

    const url = new URL(req.url || '/', 'http://localhost');
    const action = url.searchParams.get('action') || 'trending';
    const query = (url.searchParams.get('q') || '').trim().slice(0, 100);
    if (!['search', 'trending', 'upcoming', 'details', 'season', 'discover'].includes(action)) return json(400, { error: 'Acción TMDB no válida.' });
    if (action === 'search' && query.length < 2) return json(400, { error: 'Escribe al menos dos caracteres.' });

    // Los límites locales de una función serverless desaparecen al escalar o
    // reciclar instancias. El RPC serializa el contador por usuario en Postgres.
    const limiter = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: allowed, error: limitError } = await limiter.rpc('consume_tmdb_request', {
      p_user_id: user.id,
    });
    if (limitError) {
      console.error('[api/tmdb] no se pudo comprobar el límite de peticiones:', limitError.code || 'unknown');
      return json(503, { error: 'La búsqueda no está disponible temporalmente.' });
    }
    if (allowed !== true) return json(429, { error: 'Has hecho muchas búsquedas seguidas. Espera un momento.' });

    const fetchTmdb = async (endpoint, params = {}) => {
      const tmdbUrl = new URL(`${TMDB_API}${endpoint}`);
      tmdbUrl.searchParams.set('language', 'es-ES');
      tmdbUrl.searchParams.set('include_adult', 'false');
      Object.entries(params).forEach(([key, value]) => tmdbUrl.searchParams.set(key, String(value)));
      const response = await fetch(tmdbUrl, {
        headers: { accept: 'application/json', Authorization: `Bearer ${tmdbToken}` },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) {
        console.warn('[api/tmdb] upstream returned', response.status);
        throw new Error('TMDB_UPSTREAM');
      }
      return response.json();
    };

    const getGenreNames = async () => {
      if (genreCache.expires > Date.now()) return genreCache.values;
      const [movies, shows] = await Promise.all([
        fetchTmdb('/genre/movie/list'),
        fetchTmdb('/genre/tv/list'),
      ]);
      const values = {};
      (movies.genres || []).forEach(genre => { values[`movie:${genre.id}`] = genre.name; });
      (shows.genres || []).forEach(genre => { values[`tv:${genre.id}`] = genre.name; });
      genreCache = { expires: Date.now() + 24 * 60 * 60 * 1000, values };
      return values;
    };

    // Fichas y temporadas: completan metadatos sin importar nada por su cuenta.
    if (action === 'details' || action === 'season' || action === 'discover') {
      const mediaType = url.searchParams.get('type') === 'movie' ? 'movie' : 'tv';
      const tmdbId = Number(url.searchParams.get('id'));
      if (action === 'discover') {
        const genreNames = await getGenreNames();
        const genre = String(Number(url.searchParams.get('genre')) || '');
        const params = { sort_by: 'popularity.desc', 'vote_count.gte': 10 };
        if (genre) params.with_genres = genre;
        const data = await fetchTmdb(`/discover/${mediaType}`, params);
        const results = (data.results || [])
          .filter(item => item && item.id && (item.title || item.name))
          .slice(0, 20)
          .map(item => mapTitle({ ...item, media_type: mediaType }, genreNames));
        return json(200, { results, page: 1, totalResults: results.length, attribution: 'Datos e imágenes proporcionados por TMDB.' });
      }

      if (!tmdbId) return json(400, { error: 'Falta el identificador del título.' });

      if (action === 'season') {
        const seasonNumber = Math.max(0, Number(url.searchParams.get('season')) || 0);
        const data = await fetchTmdb(`/tv/${tmdbId}/season/${seasonNumber}`);
        const episodes = (data.episodes || []).map(episode => ({
          numero: Number(episode.episode_number) || 0,
          titulo: String(episode.name || '').slice(0, 180),
          descripcion: String(episode.overview || '').slice(0, 1200),
          miniatura: episode.still_path ? `${IMAGE_BASE}/w300${episode.still_path}` : '',
          duracion: Number(episode.runtime) || 0,
          fecha: episode.air_date || '',
        }));
        return json(200, { season: seasonNumber, episodes, attribution: 'Datos e imágenes proporcionados por TMDB.' });
      }

      const genreNames = await getGenreNames();
      const data = await fetchTmdb(`/${mediaType}/${tmdbId}`);
      const base = mapTitle({ ...data, media_type: mediaType }, genreNames);
      const seasons = mediaType === 'tv' && Array.isArray(data.seasons)
        ? data.seasons
            .filter(season => Number(season.season_number) > 0)
            .map(season => ({
              numero: Number(season.season_number) || 0,
              titulo: String(season.name || '').slice(0, 120),
              episodios: Number(season.episode_count) || 0,
              anio: /^\d{4}/.test(season.air_date || '') ? season.air_date.slice(0, 4) : '',
            }))
        : [];
      return json(200, {
        result: {
          ...base,
          generos: (data.genres || []).map(genre => genre.name).filter(Boolean).slice(0, 8),
          duracion: mediaType === 'movie' ? Number(data.runtime) || 0 : Number(data.episode_run_time?.[0]) || 0,
          fechaEstreno: data.release_date || data.first_air_date || '',
          estadoExterno: data.status || '',
          totalTemporadas: seasons.length,
          totalEpisodios: seasons.reduce((sum, season) => sum + season.episodios, 0),
          temporadasMeta: seasons,
        },
        attribution: 'Datos e imágenes proporcionados por TMDB.',
      });
    }

    let rawResults = [];
    if (action === 'search') {
      const data = await fetchTmdb('/search/multi', { query });
      rawResults = data.results || [];
    } else if (action === 'trending') {
      const data = await fetchTmdb('/trending/all/week', { region: 'ES' });
      rawResults = data.results || [];
    } else {
      const [movies, shows] = await Promise.all([
        fetchTmdb('/movie/upcoming', { region: 'ES' }),
        fetchTmdb('/tv/on_the_air'),
      ]);
      rawResults = [
        ...(movies.results || []).map(item => ({ ...item, media_type: 'movie' })),
        ...(shows.results || []).map(item => ({ ...item, media_type: 'tv' })),
      ].sort((a, b) => String(a.release_date || a.first_air_date || '').localeCompare(String(b.release_date || b.first_air_date || '')));
    }

    const genres = await getGenreNames();
    const results = rawResults
      .filter(item => (item.media_type === 'tv' || item.media_type === 'movie') && item.id && (item.title || item.name))
      .slice(0, 20)
      .map(item => mapTitle(item, genres));

    return json(200, {
      results,
      page: 1,
      totalResults: results.length,
      attribution: 'Datos e imágenes proporcionados por TMDB.',
    });
  } catch (error) {
    console.error('[api/tmdb] request failed:', error?.message || 'unknown error');
    return json(502, { error: 'No se pudo conectar con TMDB. Comprueba la conexión e inténtalo otra vez.' });
  }
}
