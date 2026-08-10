/* ==========================================
   Personal Hub v2 — Format helpers
   ========================================== */

/** Convierte segundos a m:ss (o h:mm:ss si supera la hora). */
export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/* ==========================================
   HORA DE ESPAÑA (península, Europe/Madrid)
   Los "cambios de día" (ánimo, calendario, notificaciones,
   rachas…) y los horarios de notificación (8:00 AM) usan
   SIEMPRE la hora de España, no la local del dispositivo.
   ========================================== */
const SPAIN_TZ = 'Europe/Madrid';

/** Fecha en España (península) en formato YYYY-MM-DD. */
export function todayISO(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SPAIN_TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

/** Hora actual en España (0-23). */
export function hourInSpain(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SPAIN_TZ, hour: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  return Number(parts.find(p => p.type === 'hour')?.value || 0);
}

/** Día del mes actual en España (1-31). */
export function dayOfMonthInSpain(date = new Date()) {
  return Number(todayISO(date).slice(8, 10));
}

/**
 * Marca de tiempo (ms) del día español 'YYYY-MM-DD' a las hour:00.
 * Corrige el desfase UTC↔España (UTC+1 invierno / UTC+2 verano).
 */
export function spainMsOnDate(dateStr, hour) {
  const utcMidnight = Date.parse(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(utcMidnight)) return NaN;
  const offsetH = hourInSpain(new Date(utcMidnight));
  return utcMidnight - offsetH * 3600000 + hour * 3600000;
}

/** Fecha española del PRÓXIMO día (distinta a la de hoy). */
export function nextDayISO(date = new Date()) {
  const start = date.getTime();
  const today = todayISO(date);
  for (let d = 1; d <= 3; d++) {
    const s = todayISO(new Date(start + d * 86400000));
    if (s !== today) return s;
  }
  return today;
}

/**
 * Valida campos de URL opcionales: vacío = válido. Acepta http(s)://,
 * rutas relativas (/...), protocolo relativo (//...), data: y blob:.
 * Rechaza cualquier otro texto (p. ej. 'no-es-una-url').
 */
export function isValidUrlField(value) {
  if (!value) return true;
  return /^(https?:\/\/|\/|data:|blob:)/i.test(value.trim());
}
