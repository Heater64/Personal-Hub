/* ==========================================
   galleryData.js — Capa de datos de la galería.

   Single source of truth para la experiencia
   fotográfica de El Rincón:
   - Álbum base (GALLERY_FOLDERS de rincon-data)
   - Subidas del usuario (localStorage user-scoped)
   - Favoritas
   - Fotos ocultas / eliminadas por el usuario
   - Meta del álbum (nombre, descripción, portada)
   - Cache de proporciones reales (evita CLS)

   La galería consume el sistema de datos
   existente: no duplica ni hardcodea fotos.
   ========================================== */

import { GALLERY_FOLDERS } from './rincon-data.js';
import { userPrefKey } from '../utils/userStorage.js';
import { createSyncStore } from './sync.service.js';

const UPLOADS_KEY = () => userPrefKey('galleryUploads');
const FAVS_KEY = () => userPrefKey('galleryFavs');
const HIDDEN_KEY = () => userPrefKey('galleryHidden');
const ALBUM_KEY = () => userPrefKey('galleryAlbum');
const RATIO_KEY = () => userPrefKey('galleryRatios');

// ==========================================
// SYNC cross-device — las subidas de la galería son COMPARTIDAS:
// el admin sube desde el móvil y aparecen en el PC (y viceversa).
// Se espejan en la tabla `content` (fila 'gallery_uploads').
// Favoritas y ocultas siguen siendo personales de cada cuenta.
// ==========================================

const sync = createSyncStore({
  id: 'gallery_uploads',
  readLocal: () => ({ uploads: userPhotos() }),
  writeLocal: (data) => { if (Array.isArray(data?.uploads)) writeJson(UPLOADS_KEY, data.uploads); }
});

/** Sincroniza con el servidor (pull/push). Devuelve { changed, data }. */
export function hydrateGallery() {
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
// ÁLBUM BASE + SUBIDAS
// ==========================================

/** Todas las carpetas del álbum base (rincon-data) */
export function baseFolders() {
  return Object.keys(GALLERY_FOLDERS || {});
}

/** Fotos base de una carpeta */
export function basePhotos(folder) {
  return (GALLERY_FOLDERS[folder] || []).slice();
}

/** Fotos subidas por el usuario (se añaden al principio, más recientes) */
export function userPhotos() {
  return readJson(UPLOADS_KEY, []);
}

/** Subir URLs de fotos del usuario al final (más recientes al principio) */
export function addUserPhotos(urls) {
  const list = userPhotos();
  writeJson(UPLOADS_KEY, [...urls.reverse(), ...list]);
  sync.markDirty();
}

/** Eliminar una foto subida del usuario (por URL) */
export function removeUserPhoto(url) {
  writeJson(UPLOADS_KEY, userPhotos().filter(u => u !== url));
  sync.markDirty();
}

/**
 * Lista visible de una carpeta: subidas del usuario + base,
 * menos las ocultas por el usuario.
 */
export function visiblePhotos(folder) {
  const hidden = new Set(readJson(HIDDEN_KEY, []));
  const merged = [...userPhotos(), ...basePhotos(folder)];
  return merged.filter(u => !hidden.has(u));
}

/** Lista de fotos ocultas por el usuario (borradas de su vista) */
export function hiddenPhotos() {
  return readJson(HIDDEN_KEY, []);
}

/** Marcar una foto como oculta (borrado por el usuario) */
export function hidePhoto(url) {
  const list = readJson(HIDDEN_KEY, []);
  if (!list.includes(url)) { list.push(url); writeJson(HIDDEN_KEY, list); }
  removeUserPhoto(url);
}

/** Restaurar todas las fotos ocultas (no usado en UI, utilidad) */

// ==========================================
// FAVORITAS
// ==========================================

export function loadFavPhotos() {
  return new Set(readJson(FAVS_KEY, []));
}

export function saveFavPhotos(set) {
  writeJson(FAVS_KEY, [...set]);
}

export function toggleFavPhoto(url, favs) {
  if (favs.has(url)) favs.delete(url);
  else favs.add(url);
  saveFavPhotos(favs);
  return favs.has(url);
}

// ==========================================
// META DEL ÁLBUM (nombre, descripción, portada)
// ==========================================

export function albumMeta() {
  return readJson(ALBUM_KEY, {});
}

export function saveAlbumMeta(meta) {
  writeJson(ALBUM_KEY, { ...albumMeta(), ...meta });
}

// ==========================================
// PROPORCIONES REALES (cache — evita CLS)
// ==========================================

const ratioCache = new Map(Object.entries(readJson(RATIO_KEY, {})));

function normalizeRatio(w, h) {
  if (!w || !h) return '4/3';
  const g = gcd(w, h);
  const rw = w / g, rh = h / g;
  // Limita la variedad para un masonry armónico sin deformar
  const keep = [[1,1],[3,2],[2,3],[4,3],[3,4],[16,9],[9,16],[5,4],[4,5],[21,9],[9,21]];
  let best = keep[0], bestDist = Infinity;
  for (const [a, b] of keep) {
    const d = Math.abs(a / b - rw / rh);
    if (d < bestDist) { bestDist = d; best = [a, b]; }
  }
  return `${best[0]}/${best[1]}`;
}

function gcd(a, b) { return b ? gcd(b, a % b) : a; }

/** Devuelve la proporción conocida de una URL (4/3 por defecto) */
export function knownRatio(url) {
  return ratioCache.get(url) || '4/3';
}

/** Registra la proporción real de una imagen y persiste la cache */
export function rememberRatio(url, w, h) {
  if (!url || !w || !h) return;
  const ratio = normalizeRatio(w, h);
  ratioCache.set(url, ratio);
  // Persistencia acotada (máx 500 entradas)
  try {
    const entries = [...ratioCache.entries()].slice(-500);
    localStorage.setItem(RATIO_KEY(), JSON.stringify(Object.fromEntries(entries)));
  } catch { /* quota */ }
}

// ==========================================
// FECHA desde URL Cloudinary
// ==========================================

const MONTHS_SHORT = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

/**
 * Extrae la fecha de una URL de foto:
 *  - Cloudinary:  /v<timestamp>/
 *  - Supabase:    /galeria/<uid>/<Date.now()>-<hash>.jpg
 *  - Nombre:      yyyyMMdd_HHmmss
 */
export function photoDate(url) {
  if (!url) return '';
  const ts = url.match(/\/v(\d{10,})/);
  if (ts) {
    const d = new Date(parseInt(ts[1], 10) * 1000);
    if (!isNaN(d) && d.getFullYear() > 2000) {
      return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
    }
  }
  // Supabase: timestamp de 13 dígitos (ms) en el nombre de archivo
  const sb = url.match(/\/(\d{13})-[\w]+\.\w+$/);
  if (sb) {
    const d = new Date(parseInt(sb[1], 10));
    if (!isNaN(d) && d.getFullYear() > 2000) {
      return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
    }
  }
  const named = url.match(/(20\d{2})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  if (named) {
    return `${parseInt(named[3], 10)} ${MONTHS_SHORT[parseInt(named[2], 10) - 1]} ${named[1]}`;
  }
  return '';
}

/** Timestamp (segundos) de una URL para ordenación: Cloudinary /v<ts>/ o Supabase <13ms>-hash */
export function photoTs(url) {
  if (!url) return 0;
  const cloud = url.match(/\/v(\d{10,})/);
  if (cloud) return parseInt(cloud[1], 10);
  const sb = url.match(/\/(\d{13})-[\w]+\.\w+$/);
  if (sb) return Math.floor(parseInt(sb[1], 10) / 1000);
  return 0;
}

/** Año del álbum (para metadatos del hero) — recibe la lista de fotos visible */
export function albumYear(photos) {
  const years = (photos || []).map(photoDate).filter(Boolean).map(d => parseInt(d.split(' ').pop(), 10)).filter(y => y > 2000);
  if (!years.length) return new Date().getFullYear();
  return Math.min(...years);
}
