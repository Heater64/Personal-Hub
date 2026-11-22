import { supabase } from './supabase.js';

async function request(action, query = '') {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Inicia sesión para buscar series y películas.');

  const url = new URL('/api/tmdb', window.location.origin);
  url.searchParams.set('action', action);
  if (query) url.searchParams.set('q', query);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    credentials: 'same-origin',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No se pudo consultar TMDB.');
  return data;
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
