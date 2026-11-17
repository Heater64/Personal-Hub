/* ==========================================
   Menstruación — Vista de pareja
   Solo lo que ella ha autorizado. El filtrado ocurre en el servidor
   (cycle_partner_snapshot); aquí no se recibe nada de más.
   ========================================== */

import { icon } from '../../components/ui.js';
import { escapeHtml } from '../../utils/escape.js';
import { computeCycle } from '../../utils/cycleMath.js';
import { flowLabel, symptomLabel } from '../../data/cycle.data.js';
import { badge, emptyHtml, fmtDay } from './shared.js';

function kpi(label, value, hint = '') {
  return `
    <article class="cy-kpi">
      <span class="cy-kpi-label">${escapeHtml(label)}</span>
      <span class="cy-kpi-value">${escapeHtml(value)}</span>
      ${hint ? `<span class="cy-kpi-hint">${escapeHtml(hint)}</span>` : ''}
    </article>
  `;
}

export function renderPartner(ctx) {
  const snapshot = ctx.snapshot || { shared: false };

  if (!snapshot.shared) {
    return `
      <section class="cy-section">
        ${emptyHtml({
          iconHtml: icon('lock', 24),
          title: 'Ahora mismo no se comparte nada',
          text: snapshot.unavailable
            ? 'No se pudo consultar el permiso. Si acabas de activarlo, espera un momento y vuelve a intentarlo.'
            : 'Esta vista solo muestra lo que ella decida compartir desde Ajustes → Compartir. Nada se comparte por defecto y se puede revocar en cualquier momento.',
        })}
      </section>
      <p class="cy-hint cy-hint--center">Los registros siguen siendo suyos: esta vista nunca permite editarlos.</p>
    `;
  }

  const fields = new Set(snapshot.fields || []);
  const cycle = computeCycle({
    periods: snapshot.periods || [],
    settings: snapshot.settings || {},
    today: ctx.today,
  });
  const logs = snapshot.logs || [];
  const recentLogs = logs.slice(0, 7);

  return `
    ${
      snapshot.support_message
        ? `
      <section class="card cy-support">
        <span class="cy-support-label">Su mensaje para ti</span>
        <p>“${escapeHtml(snapshot.support_message)}”</p>
      </section>
    `
        : ''
    }

    <section class="cy-section">
      <div class="cy-section-head">
        <h2 class="section-title">Lo que comparte contigo</h2>
        <button type="button" class="btn btn--ghost" data-refresh>${icon('clock', 16)} Actualizar</button>
      </div>

      <div class="cy-kpis">
        ${
          fields.has('next_period') && cycle.nextStart
            ? kpi(
                'Próxima menstruación',
                fmtDay(cycle.nextStart),
                cycle.daysUntilNext === 0
                  ? 'estimada hoy'
                  : `en ${cycle.daysUntilNext} día${cycle.daysUntilNext === 1 ? '' : 's'}`
              )
            : ''
        }
        ${fields.has('cycle_status') ? kpi('Estado del ciclo', cycle.phase.label, 'estimado') : ''}
        ${fields.has('cycle_day') && cycle.cycleDay ? kpi('Día del ciclo', String(cycle.cycleDay), `de ~${cycle.avgCycle}`) : ''}
        ${fields.has('stats') ? kpi('Ciclos registrados', String(cycle.cycle.count), 'según sus registros') : ''}
      </div>

      ${fields.has('next_period') ? `<p class="cy-hint">Las fechas son estimaciones calculadas con su historial. No son una certeza ni un método anticonceptivo.</p>` : ''}
    </section>

    ${
      fields.has('period')
        ? `
      <section class="cy-section">
        <h2 class="section-title">Menstruaciones registradas</h2>
        ${
          (snapshot.periods || []).length
            ? `<ul class="cy-partner-list">${(snapshot.periods || [])
                .slice(0, 5)
                .map(
                  period => `
              <li>
                <span>${escapeHtml(fmtDay(period.start_date))}${period.end_date ? ` → ${escapeHtml(fmtDay(period.end_date))}` : ' · en curso'}</span>
                ${period.end_date ? badge('Registrado', 'period') : badge('En curso', 'log')}
              </li>`
                )
                .join('')}</ul>`
            : '<p class="cy-muted">Todavía no hay menstruaciones registradas.</p>'
        }
      </section>
    `
        : ''
    }

    ${
      fields.has('symptoms') || fields.has('notes')
        ? `
      <section class="cy-section">
        <h2 class="section-title">Últimos días</h2>
        ${
          recentLogs.length
            ? `
          <ul class="cy-partner-days">
            ${recentLogs
              .map(
                log => `
              <li>
                <span class="cy-partner-day">${escapeHtml(fmtDay(log.log_date))}</span>
                <span class="cy-partner-tags">
                  ${fields.has('period') && log.flow ? `<span>${escapeHtml(flowLabel(log.flow))}</span>` : ''}
                  ${fields.has('period') && log.spotting ? '<span>Manchado</span>' : ''}
                  ${fields.has('symptoms') ? (log.symptoms || []).map(id => `<span>${escapeHtml(symptomLabel(id))}</span>`).join('') : ''}
                  ${fields.has('notes') && log.notes ? `<span class="cy-partner-note">${escapeHtml(log.notes)}</span>` : ''}
                </span>
              </li>
            `
              )
              .join('')}
          </ul>
        `
            : '<p class="cy-muted">No hay días registrados en el periodo compartido.</p>'
        }
      </section>
    `
        : ''
    }

    ${
      fields.has('stats')
        ? `
      <section class="cy-section">
        <h2 class="section-title">Sus medias</h2>
        <div class="cy-kpis">
          ${kpi('Ciclo', `${cycle.avgCycle} d`, 'duración media')}
          ${kpi('Regla', `${cycle.avgPeriod} d`, 'duración media')}
          ${kpi(
            'Fiabilidad',
            // «Estimación moderada» no cabe en una tarjeta estrecha: la
            // palabra se partía por la mitad. El matiz va en la nota.
            { high: 'Alta', medium: 'Media', low: 'Baja' }[cycle.confidence.level] || '—',
            `${cycle.confidence.label} · ${cycle.confidence.cycles} ciclos`
          )}
        </div>
      </section>
    `
        : ''
    }

    <p class="cy-hint cy-hint--center">Ella controla qué ves y puede quitarte el acceso cuando quiera. Esta vista no permite modificar nada.</p>
  `;
}

export function bindPartner(root, ctx) {
  root.querySelectorAll('[data-refresh]').forEach(btn => {
    btn.addEventListener('click', () => ctx.reload());
  });
}
