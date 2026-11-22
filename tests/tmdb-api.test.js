import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { handleTmdbRequest } from '../api/_tmdb-core.js';

const envKeys = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'TMDB_ACCESS_TOKEN'];

async function read(...parts) {
  return readFile(new URL(`../${parts.join('/')}`, import.meta.url), 'utf8');
}

test('la API TMDB no publica el catálogo si falta su secreto de servidor', async () => {
  const previous = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  try {
    process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-test';
    delete process.env.TMDB_ACCESS_TOKEN;
    const result = await handleTmdbRequest({ method: 'GET', url: '/api/tmdb?action=trending', headers: {} });
    assert.equal(result.status, 503);
    assert.match(result.body.error, /TMDB_ACCESS_TOKEN/);
  } finally {
    envKeys.forEach(key => previous[key] === undefined ? delete process.env[key] : process.env[key] = previous[key]);
  }
});

test('la API TMDB requiere una sesión Tamp válida antes de consultar al proveedor', async () => {
  const previous = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  try {
    process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-test';
    process.env.TMDB_ACCESS_TOKEN = 'server-only-test-token';
    const result = await handleTmdbRequest({ method: 'GET', url: '/api/tmdb?action=trending', headers: {} });
    assert.equal(result.status, 401);
  } finally {
    envKeys.forEach(key => previous[key] === undefined ? delete process.env[key] : process.env[key] = previous[key]);
  }
});

test('la API TMDB normaliza títulos, portadas, idioma y géneros sin exponer el token', async () => {
  const previous = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const calls = [];
  try {
    process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-test';
    process.env.TMDB_ACCESS_TOKEN = 'server-only-test-token';
    globalThis.fetch = async (input, options = {}) => {
      const url = new URL(String(input));
      calls.push({ url, headers: options.headers });
      if (url.hostname === 'example.supabase.co') {
        return new Response(JSON.stringify({ id: '00000000-0000-4000-8000-000000000002' }), { status: 200 });
      }
      if (url.pathname === '/3/trending/all/week') {
        return new Response(JSON.stringify({ page: 1, total_results: 1, results: [{
          id: 123, media_type: 'tv', name: 'Ejemplo', original_name: 'Example',
          overview: 'Sinopsis', poster_path: '/poster.jpg', backdrop_path: '/backdrop.jpg',
          first_air_date: '2024-02-03', vote_average: 8.5, genre_ids: [18],
        }] }), { status: 200 });
      }
      if (url.pathname === '/3/movie/upcoming') {
        return new Response(JSON.stringify({ results: [{
          id: 456, title: 'Estreno', overview: '', poster_path: null,
          release_date: '2027-01-02', vote_average: 7, genre_ids: [],
        }] }), { status: 200 });
      }
      if (url.pathname === '/3/tv/on_the_air') {
        return new Response(JSON.stringify({ results: [{
          id: 789, name: 'En emisión', overview: '', poster_path: null,
          first_air_date: '2026-12-01', vote_average: 8, genre_ids: [],
        }] }), { status: 200 });
      }
      if (url.pathname === '/3/genre/tv/list') {
        return new Response(JSON.stringify({ genres: [{ id: 18, name: 'Drama' }] }), { status: 200 });
      }
      if (url.pathname === '/3/genre/movie/list') {
        return new Response(JSON.stringify({ genres: [] }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    };

    const result = await handleTmdbRequest({
      method: 'GET',
      url: '/api/tmdb?action=trending',
      headers: { authorization: 'Bearer tamp-test-session' },
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.results[0].id, 'tmdb:tv:123');
    assert.equal(result.body.results[0].tipo, 'serie');
    assert.equal(result.body.results[0].portada, 'https://image.tmdb.org/t/p/w500/poster.jpg');
    assert.deepEqual(result.body.results[0].generos, ['Drama']);
    assert.equal(result.body.results[0].anio, '2024');
    assert.ok(calls.filter(call => call.url.hostname === 'api.themoviedb.org').every(call => call.headers.Authorization === 'Bearer server-only-test-token'));

    const upcoming = await handleTmdbRequest({
      method: 'GET', url: '/api/tmdb?action=upcoming',
      headers: { authorization: 'Bearer tamp-test-session' },
    });
    assert.equal(upcoming.status, 200);
    assert.deepEqual(upcoming.body.results.map(item => item.tipo), ['serie', 'pelicula']);
  } finally {
    globalThis.fetch = originalFetch;
    envKeys.forEach(key => previous[key] === undefined ? delete process.env[key] : process.env[key] = previous[key]);
  }
});

test('Series conecta búsqueda, tendencias, próximos estrenos y lista compartida', async () => {
  const page = await read('tamp', 'src', 'pages', 'Series.js');
  const service = await read('tamp', 'src', 'services', 'tmdb.service.js');
  const profile = await read('tamp', 'src', 'pages', 'Profile.js');
  const vite = await read('vite.config.js');

  assert.match(page, /searchTmdbTitles/);
  assert.match(page, /getUpcomingTmdbTitles/);
  assert.match(page, /data-tmdb-add/);
  assert.match(page, /toggleInWatchlist/);
  assert.match(service, /Authorization: `Bearer \$\{session\.access_token\}`/);
  assert.match(vite, /localTmdbApi/);
  assert.match(profile, /This product uses the TMDB API but is not endorsed or certified by TMDB\./);
  assert.match(profile, /www\.themoviedb\.org\/assets\/2\/v4\/logos/);
});
