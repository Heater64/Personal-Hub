/* ==========================================
   Menstruación — Estadísticas
   Duración de ciclos y periodos, flujo y síntomas.
   Los datos se leen de los registros; no hay diagnósticos.
   ========================================== */

import { icon } from '../../components/ui.js';
import { escapeHtml } from '../../utils/escape.js';
import { addDaysISO, computeStats, filterSince } from '../../utils/cycleMath.js';
import { flowLabel, symptomLabel } from '../../data/cycle.data.js';
import { lineChart, barRows } from './charts.js';
import { emptyHtml } from './shared.js';

const WINDOWS = [
  { id: 3, label: '3 meses' },
  { id: 6, label: '6 meses' },
  { id: 12, label: '12 meses' },
  { id: 0, label: 'Todo' },
];

function kpi(label, value, hint = '') {
  return `
    <article class="cy-kpi">
      <span class="cy-kpi-label">${escapeHtml(label)}</span>
      <span class="cy-kpi-value">${escapeHtml(String(value))}</span>
      ${hint ? `<span class="cy-kpi-hint">${escapeHtml(hint)}</span>` : ''}
    </article>
  `;
}

export function renderStats(ctx) {
  const windowMonths = ctx.ui.statsWindow;
  const source = windowMonths
    ? filterSince(
        { periods: ctx.data?.periods || [], logs: ctx.data?.logs || [] },
        addDaysISO(ctx.today, -Math.round(windowMonths * 30.44))
      )
    : { periods: ctx.data?.periods || [], logs: ctx.data?.logs || [] };

  const stats = computeStats(source);
  const hasAnything = stats.cycles.count || stats.logs || stats.periods.count;

  return `
    <section class="cy-section">
      <div class="chips cy-window" role="group" aria-label="Periodo de las estadísticas">
        ${WINDOWS.map(item => `<button type="button" class="chip${windowMonths === item.id ? ' chip--active' : ''}" data-window="${item.id}" aria-pressed="${windowMonths === item.id}">${item.label}</button>`).join('')}
      </div>
    </section>

    ${
      !hasAnything
        ? emptyHtml({
            iconHtml: icon('chart', 24),
            title: 'Aún no hay nada que medir',
            text: 'Registra al menos un ciclo y algún día para ver tus propias estadísticas. Nada se estima sin datos.',
          })
        : `
      <section class="cy-section">
        <h2 class="section-title">Ciclos</h2>
        <div class="cy-kpis">
          ${kpi('Ciclos completos', stats.cycles.count, 'entre dos inicios')}
          ${kpi('Media', stats.cycles.avg != null ? `${stats.cycles.avg} d` : '—', 'ponderada a lo reciente')}
          ${kpi('Mediana', stats.cycles.median != null ? `${stats.cycles.median} d` : '—')}
          ${kpi('Más corto', stats.cycles.min != null ? `${stats.cycles.min} d` : '—')}
          ${kpi('Más largo', stats.cycles.max != null ? `${stats.cycles.max} d` : '—')}
          ${kpi('Variación', stats.cycles.spread ? `${stats.cycles.spread} d` : '—', 'entre el más corto y el más largo')}
        </div>
        <div class="card cy-chart-card">
          ${lineChart(stats.cycles.values, { label: 'Duración de cada ciclo', unit: 'días' })}
        </div>
      </section>

      <section class="cy-section">
        <h2 class="section-title">Menstruación</h2>
        <div class="cy-kpis">
          ${kpi('Periodos', stats.periods.count, 'con duración medida')}
          ${kpi('Duración media', stats.periods.avg != null ? `${stats.periods.avg} d` : '—')}
          ${kpi('Más habitual', stats.flow[0] ? flowLabel(stats.flow[0].id) : '—', 'flujo registrado')}
        </div>
        <div class="card cy-chart-card">
          <h3 class="cy-chart-label">Duración de cada periodo</h3>
          ${barRows(stats.periods.values.map((value, index) => ({ label: `Periodo ${index + 1}`, value })))}
        </div>
      </section>

      <section class="cy-section">
        <h2 class="section-title">Síntomas</h2>
        <div class="card cy-chart-card">
          ${barRows(
            stats.symptoms.map(item => ({
              label: symptomLabel(item.id),
              value: item.count,
              hint: item.avgCycleDay ? `de media, día ${item.avgCycleDay}` : '',
            }))
          )}
        </div>
        <p class="cy-hint">Aparecen ordenados por frecuencia. La relación con una fase concreta es orientativa: no demuestra causa.</p>
      </section>

      <p class="cy-hint cy-hint--center">Estas cifras salen solo de tus registros y no son un diagnóstico médico.</p>
    `
    }
  `;
}

export function bindStats(root, ctx) {
  root.querySelectorAll('[data-window]').forEach(btn => {
    btn.addEventListener('click', () => {
      ctx.ui.statsWindow = Number(btn.dataset.window);
      ctx.repaint();
    });
  });
}
