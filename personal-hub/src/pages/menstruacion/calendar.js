/* ==========================================
   Menstruación — Calendario
   Mes navegable con días registrados, estimados, ventana fértil,
   ovulación y manchado. Estimado y registrado nunca se confunden.
   ========================================== */

import { icon } from '../../components/ui.js';
import { escapeHtml } from '../../utils/escape.js';
import {
  MONTHS,
  WEEKDAYS,
  monthTitle,
  shiftMonth,
  daysInMonth,
  leadingBlanks,
  buildDayIndex,
  dayClass,
} from './shared.js';

const LEGEND = [
  { cls: 'is-period', label: 'Menstruación registrada' },
  { cls: 'is-estimated', label: 'Menstruación estimada' },
  { cls: 'is-fertile', label: 'Ventana fértil estimada' },
  { cls: 'is-ovulation', label: 'Ovulación estimada' },
  { cls: 'is-log', label: 'Día con registro' },
  { cls: 'is-spotting', label: 'Manchado' },
  { cls: 'is-today', label: 'Hoy' },
];

export function renderCalendar(ctx) {
  const { year, month } = ctx.ui;
  const index = buildDayIndex(ctx);
  const total = daysInMonth(year, month);
  const blanks = leadingBlanks(year, month);

  const cells = [];
  for (let i = 0; i < blanks; i += 1)
    cells.push('<span class="cy-day is-empty" aria-hidden="true"></span>');

  for (let day = 1; day <= total; day += 1) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const flags = [];
    if (index.period.has(date)) flags.push('menstruación registrada');
    else if (index.estimated.has(date)) flags.push('menstruación estimada');
    if (index.fertile.has(date)) flags.push('ventana fértil estimada');
    if (index.ovulation.has(date)) flags.push('ovulación estimada');
    if (index.logs.has(date)) flags.push('con registro');
    if (index.logs.get(date)?.spotting) flags.push('manchado');

    cells.push(`
      <button type="button" class="${dayClass(index, date, ctx.today)}" data-date="${date}"
        aria-label="${escapeHtml(`${day} de ${MONTHS[month]}: ${flags.length ? flags.join(', ') : 'sin registros'}`)}">
        <span class="cy-day-num">${day}</span>
        ${index.logs.has(date) ? '<span class="cy-day-dot" aria-hidden="true"></span>' : ''}
        ${index.ovulation.has(date) ? '<span class="cy-day-ring" aria-hidden="true"></span>' : ''}
      </button>
    `);
  }

  return `
    <section class="card cy-cal-card">
      <div class="cy-cal-head">
        <button type="button" class="icon-btn" id="cyPrevMonth" aria-label="Mes anterior">${icon('chevron-left', 18)}</button>
        <button type="button" class="cy-cal-title" id="cyTodayMonth" title="Volver al mes actual">
          ${escapeHtml(monthTitle(year, month))}
        </button>
        <button type="button" class="icon-btn" id="cyNextMonth" aria-label="Mes siguiente">${icon('chevron-right', 18)}</button>
      </div>

      <div class="cy-cal-grid" role="grid" aria-label="Calendario de ${escapeHtml(monthTitle(year, month))}">
        ${WEEKDAYS.map(day => `<span class="cy-cal-weekday" aria-hidden="true">${day}</span>`).join('')}
        ${cells.join('')}
      </div>

      <ul class="cy-legend" aria-label="Leyenda del calendario">
        ${LEGEND.map(item => `<li><span class="cy-legend-dot ${item.cls}" aria-hidden="true"></span>${item.label}</li>`).join('')}
      </ul>
    </section>

    <p class="cy-hint cy-hint--center">Lo estimado se calcula con tu historial. No confirma la ovulación ni sirve como método anticonceptivo.</p>
  `;
}

export function bindCalendar(root, ctx) {
  const goMonth = delta => {
    const next = shiftMonth(ctx.ui.year, ctx.ui.month, delta);
    ctx.ui.year = next.year;
    ctx.ui.month = next.month;
    ctx.repaint();
  };

  root.querySelector('#cyPrevMonth')?.addEventListener('click', () => goMonth(-1));
  root.querySelector('#cyNextMonth')?.addEventListener('click', () => goMonth(1));
  root.querySelector('#cyTodayMonth')?.addEventListener('click', () => {
    const [year, month] = ctx.today.split('-').map(Number);
    ctx.ui.year = year;
    ctx.ui.month = month - 1;
    ctx.repaint();
  });

  root.querySelectorAll('[data-date]').forEach(cell => {
    cell.addEventListener('click', () => ctx.openDay(cell.dataset.date));
  });
}
