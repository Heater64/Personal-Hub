/* ==========================================
   pro-insights.js — cálculos de la fase Pro (sin migraciones)

   Funciones puras: no tocan red, ni DOM, ni almacenamiento (el
   almacenamiento se pasa como parámetro). Así se pueden probar y reutilizar
   desde Inicio, Sentimientos, Razones, Juegos o Galería sin duplicar lógica.
   ========================================== */

/** Meses cortos tal y como los escribe `galleryData.photoDate()`. */
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Récords de los minijuegos de la casa.
 *
 * Los juegos son páginas estáticas (`/games/*.html`) y ya guardan su mejor
 * marca en `localStorage`; aquí solo se leen esas claves, sin tocar los
 * juegos ni inventar datos nuevos. `mejor: 'bajo'` = menos es mejor (tiempos).
 */
export const GAME_RECORDS = [
  { id: 'snake', key: 'snakeHighScore', label: 'Snake', unit: 'puntos' },
  { id: 'memoria', key: 'memoriaBest', label: 'Memoria', unit: 'segundos', mejor: 'bajo' },
  { id: 'ahorcado', key: 'ahorcadoBest', label: 'Ahorcado', unit: 'aciertos' },
  { id: 'buscaminas', key: 'buscaminasBestTime', label: 'Buscaminas', unit: 'segundos', mejor: 'bajo' },
  { id: 'breakout', key: 'breakoutHighScore', label: 'Breakout', unit: 'puntos' },
  { id: '2048', key: 'game2048Best', label: '2048', unit: 'puntos' },
  { id: 'tetris', key: 'tetrisHighScore', label: 'Tetris', unit: 'puntos' },
  { id: 'meteoritos', key: 'meteorHighScore', label: 'Meteoritos', unit: 'puntos' },
  { id: 'laberinto', key: 'laberintoBestTime', label: 'Laberinto', unit: 'segundos', mejor: 'bajo' },
  { id: 'torre', key: 'torreHighScore', label: 'Torre', unit: 'puntos' },
  { id: 'tiroarco', key: 'tiroarcoHighScore', label: 'Tiro al Arco', unit: 'puntos' },
  { id: 'cuchillos', key: 'cuchillosHighScore', label: 'Cuchillos', unit: 'puntos' },
  { id: 'agujero-negro', key: 'agujeroNegroHighScore', label: 'Agujero Negro', unit: 'puntos' },
];

/**
 * Récords guardados por los minijuegos, listos para pintar.
 * Solo devuelve los que existen (el juego se jugó en este navegador).
 */
export function gameRecords(storage) {
  if (!storage || typeof storage.getItem !== 'function') return [];
  const out = [];
  for (const record of GAME_RECORDS) {
    let raw;
    try {
      raw = storage.getItem(record.key);
    } catch {
      raw = null;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) continue;
    out.push({
      id: record.id,
      label: record.label,
      value,
      text: record.unit === 'segundos' ? formatSeconds(value) : String(Math.round(value)),
      unit: record.unit,
      mejor: record.mejor === 'bajo' ? 'bajo' : 'alto',
    });
  }
  return out;
}

function formatSeconds(value) {
  const total = Math.max(0, Math.round(value));
  const min = Math.floor(total / 60);
  const seg = total % 60;
  return min ? `${min}:${String(seg).padStart(2, '0')}` : `${seg}s`;
}

/**
 * Mejor racha de días seguidos con ánimo registrado.
 * `historyMap` es `{ 'YYYY-MM-DD': mood }` (el del historial de Sentimientos).
 */
export function bestStreak(historyMap) {
  const dates = Object.keys(historyMap || {}).filter(date => historyMap[date]).sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const date of dates) {
    if (prev && nextDay(prev) === date) run += 1;
    else run = 1;
    if (run > best) best = run;
    prev = date;
  }
  return best;
}

function nextDay(iso) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + 1);
  return toISO(date);
}

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Los últimos `days` días (del más viejo al de hoy), con su ánimo o `null`.
 * Es la tira de puntos que enseña cómo ha ido la quincena.
 */
export function lastNDays(historyMap, days = 14, today = toISO(new Date())) {
  const out = [];
  const cursor = new Date(`${today}T12:00:00`);
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(cursor);
    date.setDate(date.getDate() - i);
    const iso = toISO(date);
    out.push({ date: iso, mood: historyMap?.[iso] || null });
  }
  return out;
}

/**
 * Razón del día: la misma para las dos cuentas y para todo el día, sin
 * guardar nada. La elección sale de la fecha, no de un `Math.random()` que
 * cambiaría en cada visita.
 */
export function reasonOfDay(list, today = toISO(new Date())) {
  const items = (Array.isArray(list) ? list : []).filter(item => item && item.text);
  if (!items.length) return null;
  const digits = today.replace(/\D/g, '').split('').reduce((sum, d) => sum + Number(d), 0);
  const dayOfYear = Math.floor(
    (new Date(`${today}T12:00:00`) - new Date(`${today.slice(0, 4)}-01-01T12:00:00`)) / 86400000
  );
  const index = (digits + dayOfYear) % items.length;
  return { item: items[index], index, date: today };
}

/**
 * «Un año hoy»: fotos del mismo día y mes de años anteriores.
 * `photos` es `[{ url, dateText }]` con el texto de `galleryData.photoDate()`.
 */
export function sameDayInPast(photos, today = toISO(new Date())) {
  const [, month, day] = today.split('-').map(Number);
  const year = Number(today.slice(0, 4));
  const out = [];
  for (const photo of Array.isArray(photos) ? photos : []) {
    const parsed = parsePhotoDate(photo?.dateText);
    if (!parsed) continue;
    if (parsed.day !== day || parsed.month !== month) continue;
    if (parsed.year >= year) continue;
    out.push({ ...photo, year: parsed.year, yearsAgo: year - parsed.year });
  }
  return out.sort((a, b) => a.yearsAgo - b.yearsAgo);
}

/** «3 jul 2026» → { day: 3, month: 7, year: 2026 }. */
export function parsePhotoDate(text) {
  const match = String(text || '')
    .toLowerCase()
    .match(/^(\d{1,2})\s+([a-záéíóú]{3,})\s+(\d{4})$/);
  if (!match) return null;
  const month = MESES.indexOf(match[2].slice(0, 3)) + 1;
  const day = Number(match[1]);
  const year = Number(match[3]);
  if (!month || !day || !year) return null;
  return { day, month, year };
}
