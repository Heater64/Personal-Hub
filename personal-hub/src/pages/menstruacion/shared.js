/* ==========================================
   Menstruación — utilidades compartidas de vista
   Formato de fechas, meses, insignias y el índice de días del
   calendario (registrado vs estimado). Sin lógica de persistencia.
   ========================================== */

import { escapeHtml } from '../../utils/escape.js';
import { addDaysISO, daysBetween } from '../../utils/cycleMath.js';
import { flowLabel, symptomById } from '../../data/cycle.data.js';

/* Mismos emojis en las dos caras del módulo: lo que ve ella y lo que ve él. */
export const PHASE_EMOJI = {
  menstrual: '🩸',
  follicular: '🌱',
  fertile: '🌼',
  ovulation: '✨',
  luteal: '🌙',
  none: '🌿',
};

export const FLOW_EMOJI = { light: '💧', medium: '🩸', heavy: '🩸' };

export function phaseEmoji(id) {
  return PHASE_EMOJI[id] || PHASE_EMOJI.none;
}

/** Emoji + texto de un síntoma (los personalizados no están en el catálogo). */
export function symptomChip(id) {
  const key = String(id || '');
  if (key.startsWith('custom:')) return { emoji: '✳️', label: key.slice(7) };
  const item = symptomById(key);
  return { emoji: item.emoji || '✳️', label: item.label };
}

/** Título de sección con su emoji, igual en todas las vistas del módulo. */
export function sectionTitle(emoji, text) {
  return `<h2 class="section-title cy-section-title"><span aria-hidden="true">${emoji}</span> ${escapeHtml(text)}</h2>`;
}

export const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const DAY_FMT = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const LONG_FMT = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

function toDate(iso) {
  const [y, m, d] = String(iso || '')
    .split('-')
    .map(Number);
  return y && m && d ? new Date(Date.UTC(y, m - 1, d)) : null;
}

export function fmtDay(iso) {
  const date = toDate(iso);
  if (!date) return '';
  return DAY_FMT.format(date).replace('.', '');
}

export function fmtLong(iso) {
  const date = toDate(iso);
  if (!date) return '';
  const text = LONG_FMT.format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function monthTitle(year, monthIndex) {
  return `${MONTHS[monthIndex]} ${year}`;
}

export function shiftMonth(year, monthIndex, delta) {
  const date = new Date(Date.UTC(year, monthIndex + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

export function daysInMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Hueco antes del día 1 con la semana empezando en lunes. */
export function leadingBlanks(year, monthIndex) {
  return (new Date(Date.UTC(year, monthIndex, 1)).getUTCDay() + 6) % 7;
}

/**
 * Lo que se ve en una fila de registro: flujo, síntomas y nota, como etiquetas.
 * Se corta a tres síntomas para que la fila no se convierta en un párrafo.
 */
export function logChips(log) {
  const chips = [];
  if (log.flow) chips.push({ tone: 'flow', text: flowLabel(log.flow), emoji: FLOW_EMOJI[log.flow] || '🩸' });
  if (log.spotting) chips.push({ tone: 'flow', text: 'Manchado', emoji: '🩹' });
  const symptoms = log.symptoms || [];
  for (const id of symptoms.slice(0, 3)) {
    const symptom = symptomChip(id);
    chips.push({ tone: 'symptom', text: symptom.label, emoji: symptom.emoji });
  }
  if (symptoms.length > 3) chips.push({ tone: 'more', text: `+${symptoms.length - 3}` });
  if (log.notes) chips.push({ tone: 'note', text: 'Nota', emoji: '📝' });
  return chips;
}

/** Etiquetas de una fila (y «Sin datos» si no hay nada). */
export function chipsHTML(chips) {
  if (!chips.length) return '<span class="cy-chip cy-chip--empty">Sin datos</span>';
  return chips
    .map(
      chip =>
        `<span class="cy-chip cy-chip--${chip.tone}">${chip.emoji ? `<span class="cy-chip__emoji" aria-hidden="true">${chip.emoji}</span>` : ''}${escapeHtml(chip.text)}</span>`
    )
    .join('');
}

export function badge(text, tone = '') {
  return `<span class="cy-badge${tone ? ` cy-badge--${tone}` : ''}">${escapeHtml(text)}</span>`;
}

export function emptyHtml({
  iconHtml = '',
  title = '',
  text = '',
  actionLabel = '',
  action = '',
} = {}) {
  return `
    <div class="empty cy-empty">
      ${iconHtml ? `<div class="e-ic">${iconHtml}</div>` : ''}
      <b>${escapeHtml(title)}</b>
      ${text ? `<p>${escapeHtml(text)}</p>` : ''}
      ${actionLabel ? `<button class="btn" type="button" ${action || ''}>${escapeHtml(actionLabel)}</button>` : ''}
    </div>
  `;
}

/**
 * Índice de días del calendario.
 * `period`: días de sangrado registrados.
 * `estimated`: días previstos (nunca se mezclan con los registrados).
 */
export function buildDayIndex(ctx) {
  const { ranges = [], data, today } = ctx;
  const index = {
    period: new Set(),
    estimated: new Set(),
    fertile: new Set(),
    ovulation: new Set(),
    logs: new Map(),
  };

  for (const period of data?.periods || []) {
    const start = period.start_date;
    if (!start) continue;
    let end = period.end_date || (start <= today ? today : start);
    // Un sangrado registrado nunca debería medir más de 20 días.
    if (daysBetween(start, end) > 20) end = addDaysISO(start, 20);
    let cursor = start;
    let guard = 0;
    while (cursor <= end && guard < 40) {
      index.period.add(cursor);
      cursor = addDaysISO(cursor, 1);
      guard += 1;
    }
  }

  for (const range of ranges) {
    let cursor = range.start;
    let guard = 0;
    while (cursor <= range.end && guard < 40) {
      if (!index.period.has(cursor)) index.estimated.add(cursor);
      cursor = addDaysISO(cursor, 1);
      guard += 1;
    }
    if (ctx.data?.settings?.preferences?.showFertile !== false) {
      let day = range.fertileStart;
      let steps = 0;
      while (day && day <= range.fertileEnd && steps < 20) {
        if (!index.period.has(day)) index.fertile.add(day);
        day = addDaysISO(day, 1);
        steps += 1;
      }
    }
    if (ctx.data?.settings?.preferences?.showOvulation !== false && range.ovulation) {
      index.ovulation.add(range.ovulation);
    }
  }

  for (const log of data?.logs || []) {
    if (log?.log_date) index.logs.set(log.log_date, log);
  }

  return index;
}

export function dayClass(index, date, today) {
  const classes = ['cy-day'];
  if (index.period.has(date)) classes.push('is-period');
  else if (index.estimated.has(date)) classes.push('is-estimated');
  if (index.fertile.has(date)) classes.push('is-fertile');
  if (index.ovulation.has(date)) classes.push('is-ovulation');
  if (index.logs.has(date)) classes.push('is-log');
  if (index.logs.get(date)?.spotting) classes.push('is-spotting');
  if (date === today) classes.push('is-today');
  return classes.join(' ');
}
