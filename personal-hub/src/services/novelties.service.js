/* ==========================================
   novelties.service.js — Novedades del día

   Calcula qué secciones tienen contenido nuevo HOY
   para que el Inicio lo muestre como un panel
   informativo con enlaces directos.

   Cada fuente devuelve items { id, section, icon,
   tag, text, route }. La arquitectura permite
   añadir más fuentes en el futuro sin tocar la UI.
   ========================================== */

import { userPrefKey } from '../utils/userStorage.js';
import { loadGiftsCatalog, getGiftTodayStr } from './gifts.service.js';
import { db } from './db.service.js';

/**
 * Novedades de hoy:
 *  - Calendario: el regalo de hoy sin abrir todavía.
 *  - Razones: razones con fecha de desbloqueo (<= hoy) aún no leídas.
 */
export async function getTodayNovelties() {
  const novelties = [];
  const today = getGiftTodayStr();

  // 1. CALENDARIO — regalo del día aún sin abrir
  try {
    const cat = await loadGiftsCatalog();
    if (cat) {
      const dayNum = String(parseInt(today.slice(8), 10));
      // Un día puede tener varios contenidos: se usa el primero para la novedad
      const raw = cat.months?.[today.slice(0, 7)]?.calendarMapping?.[dayNum];
      const ids = Array.isArray(raw) ? raw.filter(Boolean) : (raw ? [raw] : []);
      const gift = ids.length ? cat.giftsById?.[ids[0]] : null;
      if (gift) {
        let progress = {};
        try { progress = JSON.parse(localStorage.getItem(userPrefKey('giftProgress')) || '{}'); } catch { /* */ }
        if (!progress[gift.id]?.opened) {
          novelties.push({
            id: `cal-${today}`,
            section: 'calendario',
            icon: '🎁',
            tag: 'Calendario',
            text: gift.title || 'Hay una sorpresa esperándote hoy',
            route: `/calendario?day=${today}`
          });
        }
      }
    }
  } catch { /* catálogo no disponible: omitir esta fuente */ }

  // 2. RAZONES — razones desbloqueadas (fecha <= hoy) aún sin leer
  try {
    const reasons = (await db.getReasons()) || [];
    if (Array.isArray(reasons) && reasons.length) {
      let read = [];
      try { read = JSON.parse(localStorage.getItem(userPrefKey('razonesRead')) || '[]'); } catch { /* */ }
      const readSet = new Set(read);
      // Normaliza ids igual que Razones.js (r?.id || `r${i}`): si una razón
      // con fecha no tiene id, el mismo id se usa en la página al marcarla leída.
      const unread = reasons.filter((r, i) => {
        if (typeof r !== 'object' || !r || !r.date) return false;
        const id = r.id || `r${i}`;
        return r.date <= today && !readSet.has(id);
      }).length;

      if (unread > 0) {
        novelties.push({
          id: `razones-${today}`,
          section: 'razones',
          icon: '💌',
          tag: 'Razones',
          text: unread === 1 ? 'Una nueva razón te está esperando' : `${unread} razones nuevas te están esperando`,
          route: '/razones'
        });
      }
    }
  } catch { /* razones no disponibles: omitir esta fuente */ }

  return novelties;
}
