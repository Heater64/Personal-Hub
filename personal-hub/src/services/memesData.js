/* ==========================================
   memesData.js — Capa de datos de la biblioteca de memes.

   Single source of truth para la experiencia
   de Memes de El Rincón:
   - Álbumes base (MEME_FOLDERS de rincon-data)
   - Álbumes propios del usuario (localStorage user-scoped)
   - Subidas por álbum
   - Memes ocultos / eliminados por el usuario
   - Meta de álbum (descripción, portada)
   - Favoritos
   ========================================== */

import { MEME_FOLDERS, isVideo, getVideoPoster } from './rincon-data.js';
import { userPrefKey } from '../utils/userStorage.js';
import { createSyncStore } from './sync.service.js';

const USER_ALBUMS_KEY = () => userPrefKey('memeUserAlbums');
const UPLOADS_KEY = () => userPrefKey('memeUploads');
const META_KEY = () => userPrefKey('memeMeta');
const HIDDEN_KEY = () => userPrefKey('memeHidden');
const FAVS_KEY = () => userPrefKey('memeFavs');

// ==========================================
// SYNC cross-device — álbumes propios y subidas de memes COMPARTIDOS
// (el admin los crea desde el móvil y aparecen en el PC). Se espejan en
// la tabla `content` (fila 'meme_data'). Favoritas y ocultas personales.
// ==========================================

const sync = createSyncStore({
  id: 'meme_data',
  readLocal: () => ({ albums: userAlbums(), uploads: readJson(UPLOADS_KEY, {}) }),
  writeLocal: (data) => {
    if (Array.isArray(data?.albums)) writeJson(USER_ALBUMS_KEY, data.albums);
    if (data?.uploads && typeof data.uploads === 'object') writeJson(UPLOADS_KEY, data.uploads);
  }
});

/** Sincroniza con el servidor (pull/push). Devuelve { changed, data }. */
export function hydrateMemes() {
  return sync.hydrate();
}

// ==========================================
// STORAGE helpers (user-scoped)
// ==========================================

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key()) || 'null') ?? fallback; }
  catch { return fallback; }
}
function writeJson(key, value) {
  try { localStorage.setItem(key(), JSON.stringify(value)); } catch { /* quota */ }
}

// ==========================================
// ÁLBUMES
// ==========================================

/** Álbumes propios creados por el usuario */
export function userAlbums() {
  const list = readJson(USER_ALBUMS_KEY, []);
  return Array.isArray(list) ? list : [];
}

/** Todos los álbumes: base (MEME_FOLDERS) + propios del usuario */
export function memeAlbums() {
  const base = Object.keys(MEME_FOLDERS || {}).map(name => ({
    id: name,
    name,
    isUser: false
  }));
  const own = userAlbums().map(a => ({ id: a.id, name: a.name, isUser: true }));
  return [...base, ...own];
}

/** Contenido visible de un álbum: base + subidas del álbum, sin ocultos */
export function memeItems(albumId) {
  const hidden = new Set(readJson(HIDDEN_KEY, []));
  const uploads = (readJson(UPLOADS_KEY, {})[albumId] || []);
  const base = (MEME_FOLDERS[albumId] || []);
  const merged = [...uploads, ...base];
  return merged.filter(u => !hidden.has(u));
}

/** Subidas del usuario para un álbum concreto */
export function albumUploads(albumId) {
  return readJson(UPLOADS_KEY, {})[albumId] || [];
}

/** Añadir memes subidos a un álbum */
export function addMemesToAlbum(albumId, urls) {
  const all = readJson(UPLOADS_KEY, {});
  const list = all[albumId] || [];
  all[albumId] = [...urls, ...list]; // los nuevos primero
  writeJson(UPLOADS_KEY, all);
  sync.markDirty();
}

/** Marcar un meme como oculto (borrado por el usuario) */
export function hideMeme(albumId, url) {
  // Si es una subida del usuario, se elimina de su álbum
  const all = readJson(UPLOADS_KEY, {});
  if ((all[albumId] || []).includes(url)) {
    all[albumId] = (all[albumId] || []).filter(u => u !== url);
    writeJson(UPLOADS_KEY, all);
    sync.markDirty();
    return;
  }
  // Si es contenido base, se oculta
  const hidden = readJson(HIDDEN_KEY, []);
  if (!hidden.includes(url)) { hidden.push(url); writeJson(HIDDEN_KEY, hidden); }
}

// ==========================================
// META DEL ÁLBUM (descripción, portada)
// ==========================================

export function albumMeta() {
  return readJson(META_KEY, {});
}

export function saveAlbumMeta(meta) {
  writeJson(META_KEY, { ...albumMeta(), ...meta });
}

/** Portada de un álbum: la elegida por el usuario o la primera visible */
export function albumCover(albumId, items) {
  const meta = albumMeta();
  const chosen = meta[`portada:${albumId}`];
  if (chosen && items.includes(chosen)) return chosen;
  return items[0] || '';
}

// ==========================================
// ÁLBUMES PROPIOS
// ==========================================

let albumSeq = Date.now();
function newAlbumId() { return `m${(++albumSeq).toString(36)}`; }

/** Crear un álbum propio (localStorage user-scoped) */
export function createMemeAlbum(name, desc = '') {
  const list = userAlbums();
  const album = { id: newAlbumId(), name: name.trim() || 'Nuevo álbum', desc: desc.trim(), createdAt: Date.now() };
  list.push(album);
  writeJson(USER_ALBUMS_KEY, list);
  sync.markDirty();
  return album;
}

/** Renombrar / editar un álbum propio */
export function renameMemeAlbum(id, name, desc) {
  const list = userAlbums().map(a => {
    if (a.id !== id) return a;
    return { ...a, name: name.trim() || a.name, desc: desc !== undefined ? desc.trim() : a.desc };
  });
  writeJson(USER_ALBUMS_KEY, list);
  sync.markDirty();
}

/** Eliminar un álbum propio + sus subidas asociadas */
export function deleteMemeAlbum(id) {
  writeJson(USER_ALBUMS_KEY, userAlbums().filter(a => a.id !== id));
  const all = readJson(UPLOADS_KEY, {});
  if (all[id]) { delete all[id]; writeJson(UPLOADS_KEY, all); }
  const meta = albumMeta();
  let changed = false;
  Object.keys(meta).forEach(k => {
    if (k.endsWith(`:${id}`)) { delete meta[k]; changed = true; }
  });
  if (changed) writeJson(META_KEY, meta);
  sync.markDirty();
}

// ==========================================
// FAVORITOS
// ==========================================

export function loadMemeFavs() {
  return new Set(readJson(FAVS_KEY, []));
}

export function saveMemeFavs(set) {
  writeJson(FAVS_KEY, [...set]);
}

export function toggleMemeFav(url, favs) {
  if (favs.has(url)) favs.delete(url);
  else favs.add(url);
  saveMemeFavs(favs);
  return favs.has(url);
}

// ==========================================
// CONTADORES + TIPOS
// ==========================================

/**
 * Poster de un meme para thumbnails/collages.
 * - Imagen: la propia URL.
 * - Vídeo Cloudinary: poster generado (f_jpg,so_auto).
 * - Vídeo de otro proveedor (Supabase): no hay poster → '' para que la UI
 *   muestre un placeholder con icono play.
 */
export function memePoster(src) {
  if (!src) return '';
  if (isVideo(src)) return getVideoPoster(src);
  return src;
}

/** Resumen de un álbum: total, vídeos, fotos y etiqueta de tipo */
export function albumSummary(items) {
  const total = items.length;
  const videos = items.filter(u => isVideo(u)).length;
  const fotos = total - videos;
  let typeLabel = 'Fotos';
  if (videos > 0 && fotos > 0) typeLabel = 'Fotos + Vídeos';
  else if (videos > 0) typeLabel = 'Vídeos';
  return { total, videos, fotos, typeLabel };
}

/** Contadores globales de la biblioteca */
export function libraryStats() {
  const albums = memeAlbums();
  let total = 0;
  albums.forEach(a => { total += memeItems(a.id).length; });
  return { memes: total, albums: albums.length };
}
