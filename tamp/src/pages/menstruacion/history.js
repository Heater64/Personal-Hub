/* ==========================================
   Menstruación — Historial
   Ciclos anteriores con duración, flujo dominante y notas.
   ========================================== */

import { icon } from '../../components/ui.js';
import { escapeHtml } from '../../utils/escape.js';
import { daysBetween } from '../../utils/cycleMath.js';
import { flowLabel } from '../../data/cycle.data.js';
import { badge, emptyHtml, fmtDay, sectionTitle } from './shared.js';

function dominantFlow(logs, period) {
  const counts = new Map();
  const end = period.end_date || period.start_date;
  for (const log of logs) {
    if (log.log_date < period.start_date || log.log_date > end) continue;
    if (!log.flow) continue;
    counts.set(log.flow, (counts.get(log.flow) || 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? flowLabel(top[0]) : '';
}

export function renderHistory(ctx) {
  const periods = (ctx.data?.periods || []).toSorted((a, b) =>
    a.start_date.localeCompare(b.start_date)
  );

  if (!periods.length) {
    return `
      <section class="cy-section">
        ${emptyHtml({
          iconHtml: icon('archive', 24),
          title: 'Todavía no hay ciclos',
          text: 'Cuando registres el inicio de tu menstruación aparecerá aquí, con su duración y tus notas.',
          actionLabel: 'Registrar menstruación',
          action: 'data-add-period',
        })}
      </section>
    `;
  }

  const nextStart = new Map();
  periods.forEach((period, index) => {
    nextStart.set(period.start_date, periods[index + 1]?.start_date || null);
  });

  const logs = ctx.data.logs || [];
  const rows = periods.toReversed();

  return `
    <section class="cy-section">
      <div class="cy-section-head">
        ${sectionTitle('🩸', 'Todos tus ciclos')}
        <button type="button" class="btn btn--ghost" data-add-period>${icon('plus', 16)} Añadir</button>
      </div>

      <ul class="cy-history">
        ${rows
          .map(period => {
            const duration = period.end_date
              ? daysBetween(period.start_date, period.end_date) + 1
              : period.start_date <= ctx.today
                ? daysBetween(period.start_date, ctx.today) + 1
                : null;
            const cycleLength = nextStart.get(period.start_date)
              ? daysBetween(period.start_date, nextStart.get(period.start_date))
              : null;
            const flow = dominantFlow(logs, period);
            const ongoing = !period.end_date;

            return `
            <li>
              <button type="button" class="cy-history-item${ongoing ? ' is-current' : ''}" data-edit-period="${escapeHtml(period.id || '')}">
                <span class="cy-history-ic" aria-hidden="true">${ongoing ? '🩸' : '🌸'}</span>
                <span class="cy-history-date">
                  <b>${escapeHtml(fmtDay(period.start_date))}</b>
                  <small>${escapeHtml(period.start_date.slice(0, 4))}</small>
                </span>
                <span class="cy-history-body">
                  <span class="cy-history-line">
                    ${period.end_date ? `hasta ${escapeHtml(fmtDay(period.end_date))}` : 'en curso'}
                    ${duration ? ` · ${duration} día${duration === 1 ? '' : 's'}` : ''}
                    ${ongoing ? badge('En curso', 'log') : ''}
                  </span>
                  <span class="cy-history-meta">
                    ${cycleLength ? `Ciclo de ${cycleLength} días` : 'Sin siguiente inicio registrado'}
                    ${flow ? ` · Flujo ${flow.toLowerCase()}` : ''}
                  </span>
                  ${period.notes ? `<span class="cy-history-notes">📝 ${escapeHtml(period.notes)}</span>` : ''}
                </span>
                <span class="cy-history-chev" aria-hidden="true">${icon('chevron-right', 16)}</span>
              </button>
            </li>
          `;
          })
          .join('')}
      </ul>
      <p class="cy-hint">Toca un ciclo para corregir sus fechas o eliminarlo.</p>
    </section>
  `;
}

export function bindHistory(root, ctx) {
  root.querySelectorAll('[data-add-period]').forEach(btn => {
    btn.addEventListener('click', () => ctx.openPeriod());
  });
  root.querySelectorAll('[data-edit-period]').forEach(btn => {
    btn.addEventListener('click', () => {
      const period = (ctx.data?.periods || []).find(item => item.id === btn.dataset.editPeriod);
      if (period) ctx.openPeriod(period);
    });
  });
}
