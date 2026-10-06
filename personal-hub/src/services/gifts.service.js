/* ==========================================
   gifts.service.js — Catálogo compartido del Calendario.

   Single source of truth para gifts.json usado por
   el Calendario y la Galería (vídeos que se desbloquean
   por fecha). Evita fetches duplicados.
   ========================================== */

import { getVideoPoster } from './rincon-data.js';
import { db } from './db.service.js';
import { expandCalendarCatalog } from '../data/calendar-expansion.js';
import { userPrefKey } from '../utils/userStorage.js';

const GIFTS_PATH = '/data/gifts.json';

let catalog = null;
let catalogPromise = null;
// Sube con cada invalidación. Si una carga empieza con generation N y
// alguien invalida mientras está en vuelo (el Admin acaba de guardar),
// el resultado viejo se descarta: así un regalo recién añadido nunca
// se queda "a medio camino" por culpa de una promesa cacheada.
let generation = 0;

/**
 * Carga el catálogo una sola vez y lo cachea.
 * Fuente de verdad: lo que el Admin guarda (Supabase con fallback local).
 * Si aún no hay nada guardado (primera vez), cae a /data/gifts.json
 * como catálogo semilla. Así Admin y Calendario/Galería comparten datos.
 * Devuelve una promesa que resuelve al catálogo (o null si falla).
 */
// "Reto real" (offline) se fusionó con "Reto" (challenge). Los catálogos
// ya guardados en localStorage, en la caché del service worker o en un móvil
// que no se ha abierto desde el cambio siguen trayendo type: 'offline'. Sin
// esta normalización, esos regalos se pintarían con el tipo desconocido y
// caerían en el "Mensaje" por defecto. La base de datos ya está migrada; esto
// solo limpia lo que quedó guardado en el cliente.
const LEGACY_TYPES = { offline: 'challenge' };

function normalizeLegacyTypes(data) {
  if (!data || !Array.isArray(data.gifts)) return data;
  let changed = 0;
  for (const gift of data.gifts) {
    const nuevo = gift?.type ? LEGACY_TYPES[gift.type] : null;
    if (nuevo) { gift.type = nuevo; changed++; }
  }
  // giftsById se reconstruye justo después, pero si el catálogo venía con él
  // ya montado, sus valores son los mismos objetos: no hay nada más que hacer.
  if (changed) console.info(`[gifts] ${changed} regalo(s) de tipo heredado normalizados`);
  return data;
}

export function loadGiftsCatalog() {
  if (catalog) return Promise.resolve(catalog);
  if (!catalogPromise) {
    const myGeneration = generation;
    catalogPromise = (async () => {
      // 1. Datos guardados por el Admin (Supabase → localStorage fallback)
      let data = null;
      try {
        data = await db.getGifts();
      } catch { data = null; }
      // Si Supabase está caído (o el token expiró) pero ya hay un espejo
      // local con datos, úsalos en vez de mostrar el calendario vacío.
      // Mismo patrón de resiliencia que seriesData.loadCatalog().
      if (!data || !(data.gifts?.length || (data.months && Object.keys(data.months).length))) {
        try {
          const mirror = JSON.parse(localStorage.getItem('ph.config.gifts'));
          if (mirror && (mirror.gifts?.length || (mirror.months && Object.keys(mirror.months).length))) {
            data = mirror;
          }
        } catch { /* espejo corrupto: ignorar */ }
      }
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
      // Si se invalidó mientras esperábamos a Supabase, estos datos ya son
      // rancios: no los publicamos como caché (el siguiente load reintrea).
      if (myGeneration !== generation) return null;
      normalizeLegacyTypes(data);
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

/**
 * Invalida la caché en memoria (tras guardar desde el Admin).
 * También sube la generación: cualquier carga en vuelo con datos viejos
 * se descarta en vez de publicarse como "la verdad" del catálogo.
 */
export function invalidateGiftsCache() {
  generation += 1;
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
/**
 * Contenidos del calendario asignados a HOY, con lo que queda por abrir.
 *
 * Es la lectura del "regalo del día" para cualquier pantalla (Inicio, avisos):
 * el reparto por día (`months[mes].calendarMapping`) y el progreso
 * (`giftProgress`) viven aquí, en el servicio dueño del catálogo, y nadie más
 * los vuelve a derivar por su cuenta.
 *
 * Devuelve `{ ids, total, pending }`; `pending` = aún sin abrir en este
 * navegador. Requiere que `loadGiftsCatalog()` haya resuelto antes.
 */
export function todayCalendarGifts() {
  const today = getGiftTodayStr();
  const monthKey = today.slice(0, 7);
  const raw = catalog?.months?.[monthKey]?.calendarMapping?.[String(Number(today.slice(8, 10)))];
  const ids = Array.isArray(raw) ? raw.filter(Boolean) : (raw ? [raw] : []);
  if (!ids.length) return { ids: [], total: 0, pending: 0 };

  let progress = {};
  try { progress = JSON.parse(localStorage.getItem(userPrefKey('giftProgress')) || '{}'); } catch { /* sin progreso */ }
  return { ids, total: ids.length, pending: ids.filter(id => !progress[id]?.opened).length };
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
