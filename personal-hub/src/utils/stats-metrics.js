/* ==========================================
   stats-metrics.js — cálculos puros de estadísticas

   Todo lo que el panel de Admin calcula sobre visitas y ánimos vive aquí,
   sin DOM y sin Supabase, para poder probarlo con datos sintéticos:

     · sesiones (gap > 30 min = sesión nueva)
     · tiempo por sección y por persona, con una estimación para la última
       página de cada sesión (antes quedaba en 0 ms porque no había hueco
       hasta la siguiente visita)
     · mapa de calor por día de la semana y hora
     · rachas de días consecutivos (visitas o ánimos)
   ========================================== */

export const SESSION_GAP_MS = 30 * 60 * 1000;
const MADRID_CLOCK = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23'
});
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function dayMillis(key) {
  if (typeof key !== 'string' || !ISO_DAY.test(key)) return NaN;
  const time = Date.parse(`${key}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === key ? time : NaN;
}

function madridParts(value) {
  if (value == null || value === '') return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const { year, month, day, hour } = Object.fromEntries(
    MADRID_CLOCK.formatToParts(date).map(part => [part.type, part.value])
  );
  return { day: `${year}-${month}-${day}`, hour: Number(hour) };
}

/** Conserva el día de un ánimo. Convierte una marca de tiempo a la fecha de Madrid. */
export function statsDay(value) {
  if (typeof value === 'string' && ISO_DAY.test(value)) {
    return Number.isFinite(dayMillis(value)) ? value : '';
  }
  return madridParts(value)?.day || '';
}

/** Desplaza un día de calendario sin depender de la hora local ni del horario de verano. */
export function shiftStatsDay(day, delta) {
  const start = dayMillis(day);
  const next = new Date(start + delta * 86400000);
  return Number.isFinite(next.getTime()) ? next.toISOString().slice(0, 10) : '';
}

/**
 * Ruta reservada con la que Open When deja constancia de una carta abierta:
 * `/openwhen/leido/<id>`. No es una visita de navegación; el panel la separa
 * para no inflar secciones ni tiempos y solo cuenta los ids distintos.
 */
export const OPENWHEN_READ_PREFIX = '/openwhen/leido/';

export const isOpenWhenReadVisit = (visit) =>
  String(visit?.page || '').startsWith(OPENWHEN_READ_PREFIX);

/** Ids de cartas Open When abiertas a partir de las visitas registradas. */
export function openWhenReadIds(visits) {
  const ids = new Set();
  (visits || []).forEach((visit) => {
    const page = String(visit?.page || '');
    if (!page.startsWith(OPENWHEN_READ_PREFIX)) return;
    const id = page.slice(OPENWHEN_READ_PREFIX.length).split(/[?#]/)[0].trim();
    if (id) ids.add(id);
  });
  return ids;
}
export const TAIL_MIN_MS = 45 * 1000;
export const TAIL_MAX_MS = 2 * 60 * 1000;

/** Sección raíz de una página: '/canciones?v=x' → '/canciones', '/juegos/1' → '/juegos' */
export function basePageOf(path) {
  const base = String(path || '/').split('?')[0].replace(/\/+$/, '') || '/';
  return '/' + (base.split('/').filter(Boolean)[0] || '');
}

/** Mediana de una lista de números (0 si no hay ninguno válido). */
export function median(values) {
  const nums = (values || []).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!nums.length) return 0;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Cuánto duró la última página de una sesión. No hay hueco hasta la siguiente
 * visita, así que se estima con la mediana de los huecos de esa misma sesión,
 * acotada entre 45 s y 2 min: ni 0 (lo que había antes) ni una hora inventada.
 */
export function tailDurationMs(gaps, { min = TAIL_MIN_MS, max = TAIL_MAX_MS } = {}) {
  const typical = median(gaps);
  if (!(typical > 0)) return min;
  return Math.round(clamp(typical, min, max));
}

function finishSession(userId, items) {
  const gaps = [];
  for (let i = 1; i < items.length; i++) gaps.push(items[i].ts - items[i - 1].ts);
  const tail = tailDurationMs(gaps);
  const pages = items.map((item, i) => ({
    bp: item.bp,
    ts: item.ts,
    ms: i < items.length - 1 ? gaps[i] : tail
  }));
  return {
    userId,
    start: items[0].ts,
    end: items[items.length - 1].ts,
    pages,
    totalMs: pages.reduce((sum, p) => sum + p.ms, 0)
  };
}

/**
 * Agrupa las visitas en sesiones por usuario. `visits` es la forma que
 * devuelve db.getPageVisits(): [{ user_id, page, timestamp }].
 * Un hueco mayor que `gapMs` (30 min por defecto) abre una sesión nueva.
 */
export function buildSessions(visits, { gapMs = SESSION_GAP_MS } = {}) {
  const byUser = new Map();
  (visits || []).forEach((visit) => {
    const ts = Date.parse(visit?.timestamp);
    if (!Number.isFinite(ts)) return;
    const userId = visit.user_id || 'anon';
    if (!byUser.has(userId)) byUser.set(userId, []);
    byUser.get(userId).push({ ts, bp: basePageOf(visit.page) });
  });

  const sessions = [];
  for (const [userId, list] of byUser) {
    list.sort((a, b) => a.ts - b.ts);
    let current = null;
    for (const item of list) {
      if (!current || item.ts - current.lastTs > gapMs) {
        if (current) sessions.push(finishSession(userId, current.items));
        current = { items: [item], lastTs: item.ts };
      } else {
        current.items.push(item);
        current.lastTs = item.ts;
      }
    }
    if (current) sessions.push(finishSession(userId, current.items));
  }
  return sessions.sort((a, b) => a.start - b.start);
}

/** Tiempo y visitas por sección a partir de las sesiones. */
export function sectionUsage(sessions) {
  const out = {};
  for (const session of sessions || []) {
    for (const page of session.pages) {
      const entry = (out[page.bp] = out[page.bp] || { count: 0, ms: 0 });
      entry.count++;
      entry.ms += page.ms;
    }
  }
  return out;
}

/** Tiempo, visitas, sesiones y última conexión por persona. */
export function userUsage(sessions) {
  const out = {};
  for (const session of sessions || []) {
    const user = (out[session.userId] = out[session.userId] || {
      count: 0, msBySection: {}, totalMs: 0, lastTs: 0, sessions: 0
    });
    user.sessions++;
    user.lastTs = Math.max(user.lastTs, session.end);
    for (const page of session.pages) {
      user.count++;
      user.msBySection[page.bp] = (user.msBySection[page.bp] || 0) + page.ms;
      user.totalMs += page.ms;
    }
  }
  return out;
}

/** Resumen: nº de sesiones y duración media. */
export function sessionSummary(sessions) {
  const list = sessions || [];
  const totalMs = list.reduce((sum, s) => sum + s.totalMs, 0);
  return {
    sessions: list.length,
    totalMs,
    avgMs: list.length ? Math.round(totalMs / list.length) : 0
  };
}

/**
 * Mapa de calor de visitas: matriz [7][24] (lunes = 0), total por hora y hora
 * punta (null si no hay visitas).
 */
export function hourlyHeatmap(visits) {
  const matrix = Array.from({ length: 7 }, () => new Array(24).fill(0));
  const hours = new Array(24).fill(0);
  let total = 0;

  (visits || []).forEach((visit) => {
    const time = madridParts(visit?.timestamp);
    if (!time) return;
    const weekday = (new Date(dayMillis(time.day)).getUTCDay() + 6) % 7;
    matrix[weekday][time.hour]++;
    hours[time.hour]++;
    total++;
  });

  let peakHour = null;
  hours.forEach((count, hour) => {
    if (count > 0 && (peakHour === null || count > hours[peakHour])) peakHour = hour;
  });

  return { matrix, hours, total, peakHour };
}

/** Franjas del día a partir del mapa horario. */
export function dayParts(heat) {
  const sum = (from, to) => {
    let count = 0;
    for (let hour = from; hour <= to; hour++) count += heat?.hours?.[hour] || 0;
    return count;
  };
  return [
    { id: 'madrugada', label: 'Madrugada', from: 0, to: 5, count: sum(0, 5) },
    { id: 'manana', label: 'Mañana', from: 6, to: 11, count: sum(6, 11) },
    { id: 'tarde', label: 'Tarde', from: 12, to: 19, count: sum(12, 19) },
    { id: 'noche', label: 'Noche', from: 20, to: 23, count: sum(20, 23) }
  ];
}

/** Días únicos en formato YYYY-MM-DD a partir de fechas ISO o 'YYYY-MM-DD'. */
export function uniqueDays(values) {
  return [...new Set((values || []).map(statsDay).filter(Boolean))].sort();
}

/**
 * Racha de días consecutivos. `current` sigue viva si el último día con
 * actividad es hoy o ayer (el día de hoy aún se puede completar); `longest`
 * es la mejor racha del histórico. `today` en formato YYYY-MM-DD.
 */
export function streaks(days, today) {
  const sorted = uniqueDays(days).filter(day => !today || day <= today);
  if (!sorted.length) return { current: 0, longest: 0, last: null };

  let longest = 0;
  let run = 0;
  let previous = null;
  for (const day of sorted) {
    run = previous && shiftStatsDay(previous, 1) === day ? run + 1 : 1;
    if (run > longest) longest = run;
    previous = day;
  }

  const last = sorted[sorted.length - 1];
  const alive = last === today || last === shiftStatsDay(today, -1);
  return { current: alive ? run : 0, longest, last };
}
