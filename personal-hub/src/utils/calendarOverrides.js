/* ==========================================
   calendarOverrides.js — Overrides LOCALES del calendario
   (solo localStorage, nunca toca Supabase ni la BD)

   Permite forzar, únicamente en este navegador, el estado de
   bloqueo de los días del calendario para hacer cambios y
   testear en producción sin esperar a las fechas reales:

     mode: 'auto'      → comportamiento normal (fechas reales)
           'all-open'  → todos los días con contenido quedan abiertos
           'all-locked'→ todos los días con contenido quedan bloqueados
     days: { 'YYYY-MM-DD': 'open' | 'locked' } → override por día
            (gana sobre el mode)

   Es per-usuario (userPrefKey) para que cada dispositivo tenga
   su propio estado de prueba y no afecte al otro.
   ========================================== */

import { userPrefKey } from './userStorage.js';

const KEY = () => userPrefKey('calendarOverrides');

/** Estado actual de overrides. Nunca lanza (corrupto → auto). */
export function getCalendarOverrides() {
  try {
    const raw = localStorage.getItem(KEY());
    if (!raw) return { mode: 'auto', days: {} };
    const parsed = JSON.parse(raw);
    const mode = ['auto', 'all-open', 'all-locked'].includes(parsed?.mode)
      ? parsed.mode
      : 'auto';
    const days = parsed?.days && typeof parsed.days === 'object' ? parsed.days : {};
    return { mode, days };
  } catch {
    return { mode: 'auto', days: {} };
  }
}

function save(overrides) {
  try {
    localStorage.setItem(KEY(), JSON.stringify(overrides));
  } catch { /* cuota llena o privado: ignorar */ }
}

/** Fija el modo global ('auto' | 'all-open' | 'all-locked'). */
export function setCalendarOverrideMode(mode) {
  if (!['auto', 'all-open', 'all-locked'].includes(mode)) return;
  const o = getCalendarOverrides();
  o.mode = mode;
  save(o);
}

/** Fuerza el estado de un día concreto ('open' | 'locked'); null lo limpia. */
export function setCalendarDayOverride(dateStr, state) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
  const o = getCalendarOverrides();
  if (state === null) {
    delete o.days[dateStr];
  } else if (state === 'open' || state === 'locked') {
    o.days[dateStr] = state;
  } else {
    return;
  }
  save(o);
}

/** Elimina TODOS los overrides (vuelve al comportamiento normal). */
export function clearCalendarOverrides() {
  try {
    localStorage.removeItem(KEY());
  } catch { /* noop */ }
}

/** Aplica el override a un día: devuelve 'open' | 'locked' | null (sin override). */
export function applyCalendarDayOverride(dateStr) {
  const o = getCalendarOverrides();
  if (o.days?.[dateStr]) return o.days[dateStr];
  if (o.mode === 'all-open') return 'open';
  if (o.mode === 'all-locked') return 'locked';
  return null;
}

/** ¿El override deja todos los días abiertos? (usado por la sala de juegos). */
export function isCalendarAllOpen() {
  return getCalendarOverrides().mode === 'all-open';
}

/** ¿El override deja todos los días bloqueados? */
export function isCalendarAllLocked() {
  return getCalendarOverrides().mode === 'all-locked';
}
