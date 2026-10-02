/* ==========================================
   Personal Hub — Fechas especiales configurables
   Fuente de verdad: tabla content (clave 'hub_dates'),
   editables desde el panel Admin → Configuración.
   Este módulo da acceso síncrono (caché) para que las
   páginas rendericen al momento y se actualicen cuando
   llegan los datos remotos.
   ========================================== */

import { db } from '../services/db.service.js';
import { normalizeDecor, normalizeVideoMode, mediaList } from './celebration.js';
import { todayISO } from './format.js';

// Días temáticos de fábrica (Halloween, Navidad). Editables desde Admin:
// su mes/día, título, texto, emoji, foto y color se guardan en la config y
// estos valores solo se usan cuando no hay nada guardado.
const SEASONAL_EVENTS = [
  { id: 'halloween', monthDay: '10-31', title: 'Halloween', icon: '🎃', type: 'halloween', description: 'Una noche para compartir sustos dulces, risas y algún recuerdo encantado.' },
  { id: 'christmas', monthDay: '12-25', title: 'Navidad', icon: '🎄', type: 'christmas', description: 'Hoy toca guardar un recuerdo bonito y celebrar todo lo que compartimos.' }
];

// Los cuatro días principales: lo que no se edita (fecha, repetición) se
// guarda en la config; el resto (emoji, texto, foto, color) también, con
// estos valores como defecto.
const FIXED_EVENT_META = {
  anniversary: { icon: '🤍', type: 'anniversary', description: 'Un capítulo más de nuestra historia juntos. Hoy merece un recuerdo especial.' },
  hubStart: { icon: '💌', type: 'memory', description: 'Hoy recordamos el primer mensaje y todo lo bonito que vino después.' },
  birthday: { icon: '🎂', type: 'birthday', description: 'Hoy celebramos a alguien que hace nuestros días mucho más bonitos.' },
  userBirthday: { icon: '🎉', type: 'birthday', description: 'Hoy el día va de celebrar a alguien muy especial: tú.' }
};

// Tipos válidos: deciden el color con el que se pinta la bienvenida.
// Fuente única: la usan la hoja (SpecialEventSheet) y el selector del Admin,
// para que el color que eliges sea el que sale.
export const SPECIAL_EVENT_TYPES = ['custom', 'birthday', 'anniversary', 'memory', 'halloween', 'christmas', 'valentine'];

export const SPECIAL_EVENT_TONES = {
  halloween: ['#f28b36', 'rgba(242,139,54,.16)'],
  valentine: ['#e8614f', 'rgba(232,97,79,.16)'],
  christmas: ['#69b984', 'rgba(105,185,132,.16)'],
  birthday: ['var(--primary)', 'var(--primary-soft)'],
  anniversary: ['var(--primary)', 'var(--primary-soft)'],
  memory: ['var(--primary)', 'var(--primary-soft)'],
  custom: ['var(--primary)', 'var(--primary-soft)']
};

// Los cuatro días principales, en el orden en que se editan.
export const FIXED_IDS = ['anniversary', 'hubStart', 'birthday', 'userBirthday'];

/** Los cuatro con sus valores de fábrica, para pintarlos en el editor. */
export const FIXED_EVENT_FIELDS = [
  { id: 'anniversary', label: 'Aniversario', ...FIXED_EVENT_META.anniversary },
  { id: 'hubStart', label: 'Primer mensaje', ...FIXED_EVENT_META.hubStart },
  { id: 'birthday', label: 'Cumpleaños de dada', ...FIXED_EVENT_META.birthday },
  { id: 'userBirthday', label: 'Tu cumpleaños', ...FIXED_EVENT_META.userBirthday }
];

/** Normaliza un valor de texto: recorta y, si falta, devuelve el defecto. */
function pick(value, fallback) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

/** Un tipo solo se acepta si está en la lista: un color inventado rompe el CSS. */
export function normalizeEventType(value, fallback = 'custom') {
  return SPECIAL_EVENT_TYPES.includes(value) ? value : fallback;
}

/** Todo lo que decora y los medios de un día, tal cual los pintan las hojas. */
function mediaFields(source = {}) {
  return {
    video: pick(source.video, ''),
    videoMode: normalizeVideoMode(source.videoMode),
    gallery: mediaList(source.gallery),
    decor: normalizeDecor(source.decor),
    // Los emojis que caen cuando el ambiente es «emoji». Vacío = los de su fiesta.
    emojis: pick(source.emojis, '')
  };
}

function occursOnDate(value, repeats, iso) {
  if (!value) return false;
  return repeats ? String(value).slice(5) === iso.slice(5) : value === iso;
}

function eventOccurrenceKey(prefix, recurring, date, iso) {
  return `${prefix}:${recurring ? iso.slice(0, 4) : date}`;
}

/** Eventos configurados y festivos que coinciden con una fecha española. */
export function specialEventsForDate(iso = todayISO()) {
  const cfg = specialDates();
  const recurring = cfg.recurring || {};
  const titles = cfg.titles || {};
  const looks = cfg.looks || {};
  const events = [];

  for (const id of FIXED_IDS) {
    const date = cfg[id];
    const repeats = recurring[id] === true;
    if (!occursOnDate(date, repeats, iso)) continue;
    const meta = FIXED_EVENT_META[id];
    const look = looks[id] || {};
    events.push({
      key: eventOccurrenceKey(`date:${id}`, repeats, date, iso),
      title: pick(titles[id], id),
      icon: pick(look.icon, meta.icon),
      type: normalizeEventType(look.type, meta.type),
      description: pick(look.description, meta.description),
      image: pick(look.image, ''),
      ...mediaFields(look),
      date: iso
    });
  }

  for (const event of cfg.events || []) {
    if (!event?.date || !occursOnDate(event.date, event.recurring === true, iso)) continue;
    const suffix = event.recurring === true ? iso.slice(0, 4) : event.date;
    const identity = event.id || String(event.title || 'evento').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    events.push({
      key: `event:${identity}:${suffix}`,
      title: pick(event.title, 'Día especial'),
      icon: pick(event.icon, '✨'),
      type: normalizeEventType(event.type),
      description: pick(event.description, 'Hoy tenemos una razón más para crear un recuerdo juntos.'),
      image: pick(event.image, ''),
      ...mediaFields(event),
      date: iso
    });
  }

  const monthDay = iso.slice(5);
  for (const preset of seasonalEvents(cfg)) {
    if (pick(preset.monthDay, '') === monthDay) {
      events.push({ ...preset, key: `holiday:${preset.id}:${iso.slice(0, 4)}`, date: iso });
    }
  }

  return events;
}

/**
 * Días temáticos: los de fábrica (Halloween, Navidad) más los que se hayan
 * añadido desde Admin. Con `enabled: false` no saltan aunque sea su fecha.
 */
export function seasonalEvents(cfg = specialDates()) {
  const saved = Array.isArray(cfg.seasonal) ? cfg.seasonal : [];
  const known = SEASONAL_EVENTS.map(preset => {
    const edit = (saved || []).find(item => item?.id === preset.id) || {};
    return {
      ...preset,
      monthDay: pick(edit.monthDay, preset.monthDay),
      title: pick(edit.title, preset.title),
      icon: pick(edit.icon, preset.icon),
      type: normalizeEventType(edit.type, preset.type),
      description: pick(edit.description, preset.description),
      image: pick(edit.image, ''),
      ...mediaFields(edit),
      enabled: edit.enabled !== false
    };
  });
  // Los temáticos nuevos que no vengan de fábrica, si los hubo.
  const extra = saved
    .filter(item => item && !SEASONAL_EVENTS.some(p => p.id === item.id))
    .map(item => ({
      id: item.id,
      monthDay: pick(item.monthDay, ''),
      title: pick(item.title, 'Día especial'),
      icon: pick(item.icon, '✨'),
      type: normalizeEventType(item.type),
      description: pick(item.description, 'Hoy tenemos una razón más para crear un recuerdo juntos.'),
      image: pick(item.image, ''),
      ...mediaFields(item),
      enabled: item.enabled !== false
    }))
    .filter(item => item.monthDay);
  return [...known, ...extra].filter(item => item.enabled && item.monthDay);
}

/** Eventos de hoy según el mismo huso que usa el resto de la aplicación. */
export function specialEventsToday() {
  return specialEventsForDate(todayISO());
}

// Alias legibles para la vista previa (`?evento=halloween`): con sólo mes y
// día se completa con el año en curso, que es lo que interesa al mirar cómo
// se verá ese día.
const PREVIEW_ALIASES = {
  halloween: '10-31',
  navidad: '12-25',
  christmas: '12-25',
  aniversario: 'anniversary',
  cumple: 'birthday',
  cumpleanos: 'birthday'
};

/**
 * Traduce lo que llega en `?evento=` a una fecha ISO real.
 * Acepta un alias ('halloween', 'navidad'...), un mes-día ('10-31') o una
 * fecha completa ('2026-10-31'). Devuelve null si no se entiende, para que la
 * vista previa no abra cualquier cosa.
 */
export function resolveEventPreview(value) {
  if (!value) return null;
  const raw = String(value).trim().toLowerCase();
  const monthDay = PREVIEW_ALIASES[raw] || (/^\d{2}-\d{2}$/.test(raw) ? raw : null);
  if (monthDay && /^\d{2}-\d{2}$/.test(monthDay)) {
    return `${todayISO().slice(0, 4)}-${monthDay}`;
  }
  if (PREVIEW_ALIASES[raw] && !/^\d{2}-\d{2}$/.test(PREVIEW_ALIASES[raw])) {
    // Alias a una de las fechas configuradas (aniversario, cumpleaños...):
    // se busca la de este año en la caché actual.
    const id = PREVIEW_ALIASES[raw];
    const cfg = specialDates();
    const value = cfg[id];
    if (!value) return null;
    return cfg.recurring?.[id] === false ? value : `${todayISO().slice(0, 4)}-${String(value).slice(5)}`;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

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
  },
  looks: {                       // Cómo se ve cada día en la bienvenida (editable)
    // anniversary: { icon: '🤍', description: '…', image: 'https://…' }
  },
  seasonal: []                   // Halloween/Navidad editados + temáticos nuevos
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
