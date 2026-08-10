/* ==========================================
   gifts.service.js — Catálogo compartido del Calendario.

   Single source of truth para gifts.json usado por
   el Calendario y la Galería (vídeos que se desbloquean
   por fecha). Evita fetches duplicados.
   ========================================== */

import { getVideoPoster } from './rincon-data.js';
import { db } from './db.service.js';
import { expandCalendarCatalog } from '../data/calendar-expansion.js';

const GIFTS_PATH = '/data/gifts.json';

let catalog = null;
let catalogPromise = null;

/**
 * Carga el catálogo una sola vez y lo cachea.
 * Fuente de verdad: lo que el Admin guarda (Supabase con fallback local).
 * Si aún no hay nada guardado (primera vez), cae a /data/gifts.json
 * como catálogo semilla. Así Admin y Calendario/Galería comparten datos.
 * Devuelve una promesa que resuelve al catálogo (o null si falla).
 */
export function loadGiftsCatalog() {
  if (catalog) return Promise.resolve(catalog);
  if (!catalogPromise) {
    catalogPromise = (async () => {
      // 1. Datos guardados por el Admin (Supabase → localStorage fallback)
      let data = null;
      try {
        data = await db.getGifts();
      } catch { data = null; }
      const hasContent = !!(data && (data.gifts?.length || (data.months && Object.keys(data.months).length)));
      // Marca de "ya se guardó alguna vez": saveContent siempre escribe
      // ph.config.<id> (incluso tras guardar un catálogo vacío). Sin esto,
      // si el Admin elimina TODOS los regalos, el refresh re-semilla desde
      // gifts.json y los regalos borrados reaparecerían.
      const everSaved = localStorage.getItem('ph.config.gifts') !== null;

      // 2. Semilla: gifts.json solo si nunca se ha guardado nada
      let shouldExpandCalendar = false;
      if (!hasContent && !everSaved) {
        const res = await fetch(GIFTS_PATH, { cache: 'no-cache' });
        data = await res.json();
        shouldExpandCalendar = true;
      } else if (data?.gifts?.length && Number(data.version) < 5) {
        // Catálogos anteriores a la extensión multi-contenido (v5) también
        // reciben los nuevos contenidos por día, sin sustituir asignaciones
        // creadas por el Admin.
        shouldExpandCalendar = true;
      }

      if (shouldExpandCalendar) expandCalendarCatalog(data);
      catalog = data;
      catalog.giftsById = {};
      (catalog.gifts || []).forEach(g => { if (g.id) catalog.giftsById[g.id] = g; });
      return catalog;
    })().catch(() => {
      catalogPromise = null; // permite reintentar
      return null;
    });
  }
  return catalogPromise;
}

/** Invalida la caché en memoria (tras guardar desde el Admin). */
export function invalidateGiftsCache() {
  catalog = null;
  catalogPromise = null;
}

// Inicia la carga en el import para que la caché esté lista al entrar.
loadGiftsCatalog();

/** Catálogo ya cargado (puede ser null si aún no llega) */
export function getGiftsCatalog() {
  return catalog;
}

/** Fecha local de hoy (YYYY-MM-DD), sin el desfase de UTC */
export function getGiftTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** ¿El regalo ya está desbloqueado por fecha? */
export function isGiftUnlocked(gift) {
  if (!gift?.unlock?.value) return false;
  return getGiftTodayStr() >= gift.unlock.value;
}

/**
 * Vídeos del calendario ya desbloqueados (su fecha llegó).
 * Devuelve [{ src, giftId, title, day, cover }] para alimentar la galería.
 * `cover` = poster/portada del regalo (definible en gifts.json) o auto-poster.
 */
export function unlockedCalendarVideos() {
  if (!catalog?.gifts) return [];
  const today = getGiftTodayStr();
  return catalog.gifts
    .filter(g => g.type === 'video' && g.unlock?.value && today >= g.unlock.value && g.data?.videoUrl)
    .map(g => ({
      src: g.data.videoUrl,
      giftId: g.id,
      title: g.title || 'Del calendario',
      day: g.unlock.value,
      cover: g.cover || g.data?.poster || getVideoPoster(g.data.videoUrl)
    }));
}
