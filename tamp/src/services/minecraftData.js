/* ==========================================
   minecraftData.js — Capa de datos de la
   sección Minecraft del Rincón.

   Recuerda todos los mundos de Minecraft que
   hayáis hecho: cada mundo (categoría) tiene
   una descripción general (semilla, versión,
   notas...) y una lista de items (fotos y
   vídeos) con descripción individual.

   Persistencia: localStorage global compartido (ambas cuentas ven lo
   mismo) + sincronización cross-device vía Supabase (tabla content,
   fila 'minecraft'). Solo el admin edita; dada solo ve.
   ========================================== */

import { createSyncStore } from './sync.service.js';

/* Los mundos y sus recuerdos son COMPARTIDOS entre las cuentas de la pareja:
   el admin sube y dada ve. Por eso se usan claves globales (sin userId),
   a diferencia de otras preferencias que sí son por usuario. */
const WORLDS_KEY = 'ph.minecraftWorlds';
const ITEMS_KEY = 'ph.minecraftItems';

/* Sincronización cross-device: la copia local (claves globales) se espeja
   en la tabla `content` de Supabase (fila 'minecraft'), de modo que lo
   subido en el móvil aparece en el PC. Admin escribe, todos leen. */
const sync = createSyncStore({
  id: 'minecraft',
  readLocal: () => ({ worlds: listWorlds(), items: listItems() }),
  writeLocal: (data) => {
    if (Array.isArray(data?.worlds)) writeJson(WORLDS_KEY, data.worlds);
    if (Array.isArray(data?.items)) writeJson(ITEMS_KEY, data.items);
  }
});

/** Sincroniza con el servidor (pull/push). Devuelve { changed, data }. */
export function hydrateMinecraft() {
  return sync.hydrate();
}

// ==========================================
// STORAGE helpers (globales compartidos)
// ==========================================

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
  catch { return fallback; }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
}

/**
 * Migración única: antes los mundos/items se guardaban por usuario
 * (ph.minecraftWorlds.<userId>). Al pasar a compartidos (claves globales),
 * se toma la copia más reciente entre todos los usuarios del navegador
 * y se promueve a la clave global. No borra las claves por usuario por si
 * hace falta volver atrás, pero deja de leerlas.
 */
function migrateShared() {
  if (localStorage.getItem(WORLDS_KEY) !== null || localStorage.getItem(ITEMS_KEY) !== null) return;
  const pickBest = (base, extract) => {
    let best = null;
    let bestTs = -1;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(base + '.')) continue;
      try {
        const val = JSON.parse(localStorage.getItem(k));
        const ts = extract(val) || 0;
        if (Array.isArray(val) && ts >= bestTs) { best = val; bestTs = ts; }
      } catch { /* clave inválida: ignorar */ }
    }
    return best;
  };
  const worlds = pickBest(WORLDS_KEY, list => (list || []).reduce((m, w) => Math.max(m, w.updatedAt || w.createdAt || 0), 0));
  if (worlds) writeJson(WORLDS_KEY, worlds);
  const items = pickBest(ITEMS_KEY, list => (list || []).reduce((m, it) => Math.max(m, it.createdAt || 0), 0));
  if (items) writeJson(ITEMS_KEY, items);
}

/** Garantiza que la migración se ejecute una vez por carga. */
migrateShared();

export function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ==========================================
// MUNDOS (categorías)
// ==========================================

/** Lista de mundos: [{ id, name, description, cover, createdAt, updatedAt }] */
export function listWorlds() {
  return readJson(WORLDS_KEY, []);
}

export function getWorld(id) {
  return listWorlds().find(w => w.id === id) || null;
}

/** Guardar mundo (crear o actualizar). Devuelve el mundo guardado. */
export function saveWorld(world) {
  const list = listWorlds();
  const now = Date.now();
  let saved;
  if (world.id && list.some(w => w.id === world.id)) {
    const next = list.map(w => w.id === world.id ? { ...w, ...world, updatedAt: now } : w);
    writeJson(WORLDS_KEY, next);
    saved = next.find(w => w.id === world.id);
  } else {
    const fresh = { id: world.id || createId(), name: world.name, description: world.description || '', cover: world.cover || '', createdAt: now, updatedAt: now };
    writeJson(WORLDS_KEY, [...list, fresh]);
    saved = fresh;
  }
  sync.markDirty();
  return saved;
}

/** Eliminar un mundo y todos sus items. */
export function deleteWorld(id) {
  writeJson(WORLDS_KEY, listWorlds().filter(w => w.id !== id));
  writeJson(ITEMS_KEY, listItems().filter(it => it.worldId !== id));
  sync.markDirty();
}

/** Portada de un mundo: la elegida o la primera foto/vídeo con miniatura. */
export function worldCover(world, items) {
  if (world?.cover) return world.cover;
  const first = (items || []).find(it => it.type === 'image');
  return first ? first.src : '';
}

// ==========================================
// ITEMS (fotos y vídeos de un mundo)
// ==========================================

/** Todos los items: [{ id, worldId, src, type: 'image'|'video', caption, createdAt }] */
export function listItems() {
  return readJson(ITEMS_KEY, []);
}

/** Items de un mundo, ordenados por fecha (más recientes primero). */
export function worldItems(worldId) {
  return listItems()
    .filter(it => it.worldId === worldId)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/** Añadir items a un mundo. Devuelve la lista actualizada del mundo. */
export function addItems(worldId, urls) {
  const list = listItems();
  const now = Date.now();
  const fresh = urls.map((src, i) => ({
    id: createId(),
    worldId,
    src,
    type: /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(src) ? 'video' : 'image',
    caption: '',
    createdAt: now + i
  }));
  writeJson(ITEMS_KEY, [...fresh, ...list]);
  sync.markDirty();
  return worldItems(worldId);
}

/** Actualizar un item (descripción individual, tipo...). */
export function updateItem(id, patch) {
  writeJson(ITEMS_KEY, listItems().map(it => it.id === id ? { ...it, ...patch } : it));
  sync.markDirty();
}

/** Eliminar un item. */
export function removeItem(id) {
  writeJson(ITEMS_KEY, listItems().filter(it => it.id !== id));
  sync.markDirty();
}

/** Recuento por mundo: { total, fotos, vídeos } */
export function worldStats(worldId) {
  const items = worldItems(worldId);
  return {
    total: items.length,
    fotos: items.filter(i => i.type === 'image').length,
    videos: items.filter(i => i.type === 'video').length
  };
}

/** Extrae la fecha legible de un timestamp de creación. */
export function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}
