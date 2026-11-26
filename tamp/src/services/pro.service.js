/* ==========================================
   pro.service.js — datos compartidos de la fase Pro

   La watchlist es lo único que necesita escribir en Supabase, y lo hace en la
   tabla `content` que ya existe (la misma de los catálogos y la presencia):
   una fila compartida, sin migraciones ni RLS nueva. Los dos miembros leen y
   escriben la misma lista, y cada entrada recuerda quién la añadió.
   ========================================== */

import { supabase } from './supabase.js';
import { userStore } from '../stores/user.store.js';

const DOC_ID = 'series_watchlist';
const MAX_ITEMS = 60;

/** Deja la lista en una forma segura venga de donde venga. */
export function normalizeWatchlist(items) {
  const seen = new Set();
  const out = [];
  for (const item of Array.isArray(items) ? items : []) {
    const id = String(item?.id || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      title: String(item?.title || '').slice(0, 120),
      poster: String(item?.poster || '').slice(0, 500),
      tipo: item?.tipo === 'pelicula' ? 'pelicula' : item?.tipo === 'serie' ? 'serie' : '',
      anio: String(item?.anio || '').slice(0, 4),
      tmdbId: item?.tmdbId ? Number(item.tmdbId) || 0 : 0,
      addedBy: String(item?.addedBy || '').slice(0, 40),
      addedAt: String(item?.addedAt || '').slice(0, 40),
      done: item?.done === true,
    });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

/** Lista compartida. Sin conexión o sin fila devuelve []. */
export async function loadSharedWatchlist() {
  try {
    const { data, error } = await supabase
      .from('content')
      .select('data')
      .eq('id', DOC_ID)
      .maybeSingle();
    if (error) return [];
    return normalizeWatchlist(data?.data?.items);
  } catch {
    return [];
  }
}

/** Guarda la lista compartida. Devuelve true si el servidor la aceptó. */
export async function saveSharedWatchlist(items) {
  const at = new Date().toISOString();
  try {
    const { error } = await supabase.from('content').upsert(
      {
        id: DOC_ID,
        data: { items: normalizeWatchlist(items), at, by: userStore.getUser()?.name || '' },
        updated_at: at,
      },
      { onConflict: 'id' }
    );
    return !error;
  } catch {
    return false;
  }
}

/** Añade o quita una serie de la lista compartida. */
export function toggleInWatchlist(items, entry, author = '') {
  const list = normalizeWatchlist(items);
  const id = String(entry?.id || '');
  if (!id) return list;
  const exists = list.some(item => item.id === id);
  if (exists) return list.filter(item => item.id !== id);
  return normalizeWatchlist([
    ...list,
    {
      id,
      title: entry.title || '',
      poster: entry.poster || '',
      tipo: entry.tipo === 'pelicula' || entry.tipo === 'serie' ? entry.tipo : '',
      anio: entry.anio || '',
      tmdbId: entry.tmdbId || 0,
      addedBy: author,
      addedAt: new Date().toISOString(),
      done: false,
    },
  ]);
}

export const WATCHLIST_DOC_ID = DOC_ID;
