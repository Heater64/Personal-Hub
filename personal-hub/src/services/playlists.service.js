/* ==========================================
   playlists.service.js — Playlists de música compartidas

   Las playlists son de la pareja: ambos usuarios pueden
   crearlas, editarlas y eliminarlas (tabla `playlists` de
   Supabase con RLS de lectura/escritura para authenticated).

   · Cada playlist guarda nombre, icono y claves de canción
     ("título | artista" en minúsculas; los datos del tema
     se resuelven desde el catálogo estático de Canciones).
   · Espejo local (ph.playlists) para funcionar offline y
     como fallback cuando Supabase no está configurado.
   · Suscripción en tiempo real (postgres_changes) + evento
     window 'ph:playlists-updated' para re-renderizar.
   ========================================== */

import { supabase } from './supabase.js';
import { db } from './db.service.js';

const MIRROR_KEY = 'ph.playlists';
const EMPTY = [];

let cache = null;          // array de playlists en memoria
let channel = null;
let started = false;

// ==========================================
// HELPERS
// ==========================================
export function songKey(title, artist) {
  return `${String(title || '').toLowerCase().trim()} | ${String(artist || '').toLowerCase().trim()}`;
}

export function songKeyOf(song) {
  return songKey(song?.title, song?.artist);
}

function lsGet() {
  try {
    const v = localStorage.getItem(MIRROR_KEY);
    return v ? JSON.parse(v) : EMPTY;
  } catch { return EMPTY; }
}

function lsSet(list) {
  try { localStorage.setItem(MIRROR_KEY, JSON.stringify(list)); } catch { /* cuota llena */ }
}

function generateId() {
  return 'pl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Normaliza una playlist recién leída de la DB (JSONB songs). */
function normalize(pl) {
  if (!pl) return null;
  return {
    id: pl.id,
    name: String(pl.name || 'Mi playlist'),
    icon: String(pl.icon || '❤️'),
    songs: Array.isArray(pl.songs) ? pl.songs.filter(s => typeof s === 'string') : [],
    createdBy: pl.created_by || null,
    createdAt: pl.created_at || null,
    updatedAt: pl.updated_at || null
  };
}

function isSupabaseReady() {
  return db.isSupabaseConfigured();
}

// ==========================================
// CARGA
// ==========================================
/** Devuelve las playlists (de Supabase si está disponible; si no, espejo local). */
export async function loadPlaylists() {
  if (isSupabaseReady()) {
    try {
      const { data, error } = await supabase.from('playlists').select('*').order('created_at', { ascending: true });
      if (!error && Array.isArray(data)) {
        const list = data.map(normalize).filter(Boolean);
        cache = list;
        lsSet(list); // refresca el espejo offline
        return list;
      }
    } catch { /* caído: usar espejo */ }
  }
  if (cache) return cache;
  cache = lsGet().map(normalize).filter(Boolean);
  return cache;
}

export function getCachedPlaylists() {
  if (cache) return cache;
  cache = lsGet().map(normalize).filter(Boolean);
  return cache;
}

// ==========================================
// PERSISTENCIA
// ==========================================
/** Escribe el estado local y lo sincroniza con Supabase (con fallback silencioso). */
async function persist(list, opts = {}) {
  cache = list;
  lsSet(list);
  window.dispatchEvent(new CustomEvent('ph:playlists-updated', { detail: { list } }));
  if (!isSupabaseReady() || opts.localOnly) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;
    const rows = list.map(pl => ({
      id: pl.id,
      name: pl.name,
      icon: pl.icon,
      songs: pl.songs,
      created_by: pl.createdBy || userId,
      updated_at: new Date().toISOString()
    }));
    const { error } = await supabase.from('playlists').upsert(rows, { onConflict: 'id' });
    if (error) console.warn('[playlists] No se pudo sincronizar:', error.message);
  } catch (err) {
    console.warn('[playlists] Supabase no disponible, cambios solo locales:', err?.message || err);
  }
}

// ==========================================
// OPERACIONES (todo con persistencia local + sync)
// ==========================================
export async function createPlaylist(name, icon = '❤️') {
  const list = [...getCachedPlaylists()];
  const pl = {
    id: generateId(),
    name: String(name || '').trim() || 'Mi playlist',
    icon: String(icon || '❤️'),
    songs: [],
    createdBy: null,
    createdAt: null,
    updatedAt: null
  };
  list.push(pl);
  await persist(list);
  return pl;
}

export async function updatePlaylist(pl) {
  const list = getCachedPlaylists().map(p => p.id === pl.id ? { ...p, ...pl, songs: pl.songs || p.songs } : p);
  await persist(list);
}

export async function deletePlaylist(id) {
  const list = getCachedPlaylists().filter(p => p.id !== id);
  await persist(list);
  if (isSupabaseReady()) {
    try { await supabase.from('playlists').delete().eq('id', id); } catch { /* ya local */ }
  }
}

/** Añade una canción (clave) a una playlist. */
export async function addSongToPlaylist(playlistId, key) {
  const list = getCachedPlaylists();
  const pl = list.find(p => p.id === playlistId);
  if (!pl) return false;
  if (pl.songs.includes(key)) return false;
  pl.songs.push(key);
  await persist(list);
  return true;
}

/** Quita una canción de una playlist. */
export async function removeSongFromPlaylist(playlistId, key) {
  const list = getCachedPlaylists();
  const pl = list.find(p => p.id === playlistId);
  if (!pl) return false;
  const before = pl.songs.length;
  pl.songs = pl.songs.filter(k => k !== key);
  if (pl.songs.length === before) return false;
  await persist(list);
  return true;
}

/** Mueve una canción de una playlist a otra. */
export async function moveSong(fromPlaylistId, toPlaylistId, key) {
  const list = getCachedPlaylists();
  const from = list.find(p => p.id === fromPlaylistId);
  const to = list.find(p => p.id === toPlaylistId);
  if (!from || !to) return false;
  from.songs = from.songs.filter(k => k !== key);
  if (!to.songs.includes(key)) to.songs.push(key);
  await persist(list);
  return true;
}

// ==========================================
// TIEMPO REAL
// ==========================================
/** Inicia la suscripción a cambios de playlists (idempotente). */
export function initPlaylistsRealtime() {
  if (started) return;
  started = true;
  if (!isSupabaseReady()) return;
  try {
    channel = supabase
      .channel('ph-playlists-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'playlists' }, () => {
        // Re-carga y propaga (no sobreescribe cambios locales sin guardar:
        // el propio usuario re-renderiza tras persistir).
        loadPlaylists().then(list => {
          window.dispatchEvent(new CustomEvent('ph:playlists-updated', { detail: { list } }));
        }).catch(() => {});
      })
      .subscribe();
  } catch (err) {
    console.warn('[playlists] Realtime no disponible:', err.message);
  }
}

export function stopPlaylistsRealtime() {
  started = false;
  if (channel) {
    try { supabase.removeChannel(channel); } catch { /* ya eliminado */ }
    channel = null;
  }
}

/** Suscripción para páginas: handler(list) cuando cambian las playlists. */
export function onPlaylistsChange(handler) {
  const wrapped = () => { handler(getCachedPlaylists()); };
  window.addEventListener('ph:playlists-updated', wrapped);
  return () => window.removeEventListener('ph:playlists-updated', wrapped);
}
