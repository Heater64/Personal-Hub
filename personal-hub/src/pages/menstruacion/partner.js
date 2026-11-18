/* ==========================================
   Menstruación — Vista de pareja
   Solo lo que ella ha autorizado. El filtrado ocurre en el servidor
   (cycle_partner_snapshot); aquí no se recibe nada de más.
   ========================================== */

import { icon } from '../../components/ui.js';
import { escapeHtml } from '../../utils/escape.js';
import { computeCycle, daysBetween } from '../../utils/cycleMath.js';
import { flowLabel } from '../../data/cycle.data.js';
import {
  badge,
  emptyHtml,
  fmtDay,
  sectionTitle,
  phaseEmoji,
  symptomChip,
  FLOW_EMOJI,
} from './shared.js';

function kpi(emoji, label, value, hint = '') {
  return `
    <article class="cy-kpi cy-kpi--partner">
      <span class="cy-kpi__emoji" aria-hidden="true">${emoji}</span>
      <span class="cy-kpi-label">${escapeHtml(label)}</span>
      <span class="cy-kpi-value">${escapeHtml(value)}</span>
      ${hint ? `<span class="cy-kpi-hint">${escapeHtml(hint)}</span>` : ''}
    </article>
  `;
}

/** Días que duró (o lleva) una menstruación. */
function durationOf(period, today) {
  const start = period.start_date;
  const end = period.end_date || today;
  const span = start && end ? daysBetween(start, end) : null;
  return Number.isFinite(span) ? Math.max(0, span + 1) : 0;
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
  const periods = (snapshot.periods || []).filter(period => period?.start_date).slice(0, 5);

  // Resumen: solo con los datos que ella ha dejado ver.
  const heroMeta = [
    fields.has('cycle_day') && cycle.cycleDay ? `Día ${cycle.cycleDay} de ~${cycle.avgCycle}` : '',
    fields.has('next_period') && cycle.nextStart ? `Próxima: ${fmtDay(cycle.nextStart)}` : '',
  ].filter(Boolean);
  const showHero = fields.has('cycle_status') || heroMeta.length > 0;

  return `
    ${
      snapshot.support_message
        ? `
      <section class="card cy-support">
        <span class="cy-support-label">💌 Su mensaje para ti</span>
        <p>“${escapeHtml(snapshot.support_message)}”</p>
      </section>
    `
        : ''
    }

    ${
      showHero
        ? `
      <section class="cy-partner-hero">
        <span class="cy-partner-hero__emoji" aria-hidden="true">${phaseEmoji(cycle.phase.id)}</span>
        <div class="cy-partner-hero__body">
          ${fields.has('cycle_status') ? `<b>${escapeHtml(cycle.phase.label)}</b>` : '<b>Su ciclo, de un vistazo</b>'}
          ${heroMeta.length ? `<span class="cy-partner-hero__meta">${escapeHtml(heroMeta.join(' · '))}</span>` : ''}
        </div>
      </section>
    `
        : ''
    }

    <section class="cy-section">
      <div class="cy-section-head">
        ${sectionTitle('📊', 'Lo que comparte contigo')}
        <button type="button" class="btn btn--ghost" data-refresh>${icon('clock', 16)} Actualizar</button>
      </div>

      <div class="cy-kpis">
        ${
          fields.has('next_period') && cycle.nextStart
            ? kpi(
                '📆',
                'Próxima menstruación',
                fmtDay(cycle.nextStart),
                cycle.daysUntilNext === 0
                  ? 'estimada hoy'
                  : `en ${cycle.daysUntilNext} día${cycle.daysUntilNext === 1 ? '' : 's'}`
              )
            : ''
        }
        ${fields.has('cycle_status') ? kpi(phaseEmoji(cycle.phase.id), 'Estado del ciclo', cycle.phase.label, 'estimado') : ''}
        ${
          fields.has('cycle_day') && cycle.cycleDay
            ? kpi('🔄', 'Día del ciclo', String(cycle.cycleDay), `de ~${cycle.avgCycle}`)
            : ''
        }
        ${fields.has('stats') ? kpi('📈', 'Ciclos registrados', String(cycle.cycle.count), 'según sus registros') : ''}
      </div>

      ${fields.has('next_period') ? `<p class="cy-hint">Las fechas son estimaciones calculadas con su historial. No son una certeza ni un método anticonceptivo.</p>` : ''}
    </section>

    ${
      fields.has('period')
        ? `
      <section class="cy-section">
        ${sectionTitle('🩸', 'Menstruaciones registradas')}
        ${
          periods.length
            ? `<ul class="cy-periods">${periods
                .map(period => {
                  const days = durationOf(period, ctx.today);
                  const open = !period.end_date;
                  return `
              <li class="cy-period${open ? ' is-current' : ''}">
                <span class="cy-period__ic" aria-hidden="true">${open ? '🩸' : '🌸'}</span>
                <span class="cy-period__body">
                  <b>${escapeHtml(fmtDay(period.start_date))}${period.end_date ? ` → ${escapeHtml(fmtDay(period.end_date))}` : ''}</b>
                  <small>${days} ${days === 1 ? 'día' : 'días'}${open ? ' · sigue' : ''}</small>
                </span>
                ${open ? badge('En curso', 'log') : badge('Registrado', 'period')}
              </li>`;
                })
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
        ${sectionTitle('🗓️', 'Últimos días')}
        ${
          recentLogs.length
            ? `
          <ul class="cy-timeline">
            ${recentLogs
              .map(log => {
                const tags = [];
                if (fields.has('period') && log.flow) {
                  tags.push(
                    `<span class="cy-tag cy-tag--flow">${FLOW_EMOJI[log.flow] || '🩸'} ${escapeHtml(flowLabel(log.flow))}</span>`
                  );
                }
                if (fields.has('period') && log.spotting) {
                  tags.push('<span class="cy-tag cy-tag--spot">🩹 Manchado</span>');
                }
                if (fields.has('symptoms')) {
                  for (const id of log.symptoms || []) {
                    const symptom = symptomChip(id);
                    tags.push(`<span class="cy-tag cy-tag--symptom">${symptom.emoji} ${escapeHtml(symptom.label)}</span>`);
                  }
                }
                return `
              <li class="cy-day-card">
                <span class="cy-day-card__date">${escapeHtml(fmtDay(log.log_date))}</span>
                <span class="cy-day-card__tags">
                  ${tags.join('') || '<span class="cy-tag cy-tag--empty">Sin datos</span>'}
                </span>
                ${fields.has('notes') && log.notes ? `<p class="cy-day-card__note">📝 ${escapeHtml(log.notes)}</p>` : ''}
              </li>`;
              })
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
        ${sectionTitle('📐', 'Sus medias')}
        <div class="cy-kpis cy-kpis--three">
          ${kpi('🔄', 'Ciclo', `${cycle.avgCycle} d`, 'duración media')}
          ${kpi('🩸', 'Regla', `${cycle.avgPeriod} d`, 'duración media')}
          ${kpi(
            '🎯',
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
