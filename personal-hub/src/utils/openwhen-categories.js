/* ==========================================
   Personal Hub v2 — Categorías de Open When

   Qué ha visto ya ella de Open When: las categorías (para marcar «Nueva
   categoría») y la versión de cada carta editada (para marcar
   «Actualizada»). Misma fuente para la página y para los avisos.

   La primera vez se dan por vistas todas las que ya existen: si no, el
   catálogo entero aparecería como nuevo al estrenar la app.
   ========================================== */

import { getUserPref, setUserPref } from './userStorage.js';

const SEEN_CATS_KEY = 'openwhen.categories.seen';
const SEEN_UPDATES_KEY = 'openwhen.seen-updates';

/** Categorías ya vistas, o null si esta cuenta aún no tiene registro. */
export function readSeenCategories() {
  try {
    const raw = getUserPref(SEEN_CATS_KEY, 'null');
    const arr = raw ? JSON.parse(raw) : null;
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

function saveSeenCategories(ids) {
  setUserPref(SEEN_CATS_KEY, JSON.stringify([...new Set(ids)]));
}

/**
 * Categorías ya vistas, sembrando la primera vez con las que hay ahora.
 * @param {string[]} currentIds ids de las categorías que existen hoy
 * @returns {string[]}
 */
export function seenCategories(currentIds) {
  const stored = readSeenCategories();
  if (stored) return stored;
  const fresh = [...new Set(currentIds)];
  saveSeenCategories(fresh);
  return fresh;
}

/** Versión leída de cada carta editada: { [id]: updatedAt }. */
export function readSeenUpdates() {
  try {
    const obj = JSON.parse(getUserPref(SEEN_UPDATES_KEY, '{}'));
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

/** Apunta la versión de una carta como leída y devuelve el mapa completo. */
export function markUpdateSeen(id, updatedAt) {
  const stored = readSeenUpdates();
  if (!id || !updatedAt) return stored;
  const next = { ...stored, [id]: updatedAt };
  setUserPref(SEEN_UPDATES_KEY, JSON.stringify(next));
  return next;
}

/** Da una categoría por vista sin tocar el resto de la lista. */
export function markCategorySeen(id) {
  if (!id) return readSeenCategories() || [];
  const stored = readSeenCategories() || [];
  if (stored.includes(id)) return stored;
  const next = [...stored, id];
  saveSeenCategories(next);
  return next;
}
