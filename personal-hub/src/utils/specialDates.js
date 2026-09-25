/* ==========================================
   Personal Hub — Fechas especiales configurables
   Fuente de verdad: tabla content (clave 'hub_dates'),
   editables desde el panel Admin → Configuración.
   Este módulo da acceso síncrono (caché) para que las
   páginas rendericen al momento y se actualicen cuando
   llegan los datos remotos.
   ========================================== */

import { db } from '../services/db.service.js';

const DEFAULTS = {
  anniversary: '2025-07-03',     // aniversario de pareja: 03/07/2025 (día/mes/año)
  hubStart: '2024-05-10',        // inicio del Hub / primer mensaje
  birthday: '2012-09-03',        // cumpleaños de dada: 03/09/2012
  userBirthday: '2009-08-03',    // cumpleaños del admin: 03/08/2009
  events: [],                    // próximas cosas: [{ id, title, date, recurring }]
  titles: {                      // títulos editables de los 4 días principales
    anniversary: 'Aniversario',
    hubStart: 'Primer mensaje',
    birthday: 'Cumpleaños de dada',
    userBirthday: 'Tu cumpleaños'
  },
  recurring: {                   // ¿se repite cada año? (cumpleaños/aniversario sí; una boda/viaje no)
    anniversary: true,
    hubStart: false,
    birthday: true,
    userBirthday: true
  }
};

let cached = null;
let loading = null;

export function specialDates() {
  return cached || { ...DEFAULTS };
}

/** Carga las fechas desde Supabase y las deja en caché. Devuelve la promesa. */
export function loadSpecialDates() {
  if (!loading) {
    loading = db
      .getHubDates()
      .then(d => { cached = d; return d; })
      .catch(() => ({ ...DEFAULTS }))
      .finally(() => { loading = null; });
  }
  return loading;
}

/** Días transcurridos desde el aniversario (contador "días juntos"). */
export function daysSinceAnniversary() {
  return Math.floor((Date.now() - new Date(specialDates().anniversary + 'T00:00:00').getTime()) / 86400000);
}

const MS_DAY = 86400000;

/** Fecha local YYYY-MM-DD (sin desfase de UTC). */
function toISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Medianoche local de hoy, para comparar días sin horas. */
function todayMidnight() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Próxima fecha especial (las 4 fijas + los eventos del Admin).
 * Las recurrentes se proyectan al año en curso o al siguiente si ya pasaron.
 * Devuelve { title, date, days } o null si no hay ninguna configurada.
 */
export function nextSpecialDate() {
  const cfg = specialDates();
  const titles = cfg.titles || {};
  const recurring = cfg.recurring || {};
  const today = todayMidnight();
  const candidates = [];

  for (const key of ['anniversary', 'hubStart', 'birthday', 'userBirthday']) {
    const value = cfg[key];
    if (!value) continue;
    candidates.push({ title: titles[key] || key, value, repeats: recurring[key] !== false });
  }
  for (const event of cfg.events || []) {
    if (event?.date) candidates.push({ title: event.title || 'Fecha especial', value: event.date, repeats: !!event.recurring });
  }

  let best = null;
  for (const candidate of candidates) {
    const [year, month, day] = String(candidate.value).split('-').map(Number);
    if (!year || !month || !day) continue;

    let date = new Date(year, month - 1, day);
    if (candidate.repeats) {
      date = new Date(today.getFullYear(), month - 1, day);
      if (date < today) date = new Date(today.getFullYear() + 1, month - 1, day);
    }
    const days = Math.round((date - today) / MS_DAY);
    if (days < 0) continue;
    if (!best || days < best.days) {
      best = { title: candidate.title, date: toISO(date), days };
    }
  }

  return best;
}

/**
 * Invalida la caché y vuelve a cargar las fechas desde Supabase.
 * El Admin la llama tras guardar para que el inicio y la bienvenida
 * reflejen el cambio al instante (sin quedarse con el valor viejo).
 */
export function refreshSpecialDates() {
  cached = null;
  return loadSpecialDates();
}
