/* ==========================================
   Menstruación — Inicio
   Estado del ciclo, próximas fechas, medias y accesos rápidos.
   ========================================== */

import { icon } from '../../components/ui.js';
import { escapeHtml } from '../../utils/escape.js';
import { EDUCATION, symptomLabel } from '../../data/cycle.data.js';
import { daysBetween } from '../../utils/cycleMath.js';
import { badge, fmtDay, fmtLong, logChips, chipsHTML, phaseEmoji, sectionTitle } from './shared.js';

// Una nota al pie de las medias: se lee sin robar protagonismo a la fecha.
function confidenceNote(cycle) {
  return `<p class="cy-confidence-note">
    <b>${escapeHtml(cycle.confidence.label)}.</b> ${escapeHtml(cycle.confidence.explanation)}
  </p>`;
}

function renderEducation() {
  // Va plegado: la información está ahí para quien la busque, pero no ocupa
  // media pantalla en el día a día.
  return `
    <details class="cy-edu-fold">
      <summary class="cy-edu-fold__head">
        <span class="cy-edu-fold__text">
          <span class="cy-edu-fold__title">Entender tu ciclo</span>
          <span class="cy-edu-fold__hint">${EDUCATION.length} lecturas cortas</span>
        </span>
        <span class="cy-edu-fold__more" aria-hidden="true">
          <span class="cy-edu-fold__open-label">Ver</span>
          <span class="cy-edu-fold__close-label">Ocultar</span>
        </span>
      </summary>
      <div class="cy-edu">
        ${EDUCATION.map(
          item => `
          <details class="cy-edu-item">
            <summary>${escapeHtml(item.title)}</summary>
            <p>${escapeHtml(item.body)}</p>
          </details>
        `
        ).join('')}
      </div>
    </details>
  `;
}

function emptyHome() {
  return `
    <section class="card cy-hero cy-hero--empty">
      <div class="cy-hero-head">
        <span class="cy-hero-eyebrow">Tu seguimiento</span>
      </div>
      <h2 class="cy-hero-title">Empieza por tu última menstruación</h2>
      <p class="cy-hero-sub">Con un solo dato ya hay una primera estimación. Todo lo demás se calcula con tus registros: aquí no se inventa ninguna fecha.</p>
      <div class="cy-actions cy-actions--wrap">
        <button type="button" class="btn" data-action="new-period">Registrar menstruación</button>
        <button type="button" class="btn btn--ghost" data-goto="ajustes">Introducir datos anteriores</button>
      </div>
    </section>
    ${renderEducation()}
  `;
}

export function renderHome(ctx) {
  const cycle = ctx.cycle;
  if (!cycle?.hasData) return emptyHome();

  const { data, today } = ctx;
  const monthPrefix = today.slice(0, 7);
  const monthLogs = (data.logs || []).filter(log => log.log_date.startsWith(monthPrefix));
  const monthPeriodDays = (data.periods || []).reduce((total, period) => {
    const start = period.start_date;
    const end = period.end_date || today;
    if (start.slice(0, 7) !== monthPrefix && end.slice(0, 7) !== monthPrefix) return total;
    const from = start > `${monthPrefix}-01` ? start : `${monthPrefix}-01`;
    const to = end < `${monthPrefix}-31` ? end : `${monthPrefix}-31`;
    return total + Math.max(0, (daysBetween(from, to) ?? 0) + 1);
  }, 0);
  const monthSymptoms = (() => {
    const counts = new Map();
    for (const log of monthLogs) {
      for (const id of log.symptoms || []) counts.set(id, (counts.get(id) || 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? `${symptomLabel(top[0])} (${top[1]})` : '—';
  })();

  const recent = (data.logs || [])
    .toSorted((a, b) => b.log_date.localeCompare(a.log_date))
    .slice(0, 3);

  return `
    <section class="card cy-hero cy-phase--${cycle.phase.id}">
      <div class="cy-hero-head">
        <span class="cy-hero-eyebrow">Hoy · ${escapeHtml(fmtLong(today))}</span>
        ${badge('Estimación', 'estimated')}
      </div>

      <div class="cy-hero-body">
        <div class="cy-hero-text">
          <h2 class="cy-hero-title"><span class="cy-hero-emoji" aria-hidden="true">${phaseEmoji(cycle.phase.id)}</span> ${escapeHtml(cycle.phase.label)}</h2>
          <p class="cy-hero-sub">${escapeHtml(cycle.phase.hint)}</p>
        </div>
        <p class="cy-hero-day" aria-label="Día ${cycle.cycleDay} de un ciclo estimado de ${cycle.avgCycle} días">
          <b>${cycle.cycleDay}</b>
          <span>día del ciclo<small>sobre ~${cycle.avgCycle} días</small></span>
        </p>
      </div>

      <div class="cy-actions cy-actions--wrap cy-hero-actions">
        <button type="button" class="btn" data-action="new-period">Registrar menstruación</button>
        <button type="button" class="btn btn--ghost" data-action="new-log">Añadir síntomas</button>
      </div>
    </section>

        <section class="cy-next${cycle.isOverdue ? ' is-late' : ''}" aria-label="Próxima menstruación estimada">
      <div class="cy-next__main">
        <span class="cy-next__label">${cycle.isOverdue ? 'Menstruación' : 'Próxima menstruación'}</span>
        <span class="cy-next__value">${
          // Con retraso, el dato grande son los días de retraso; la fecha queda
          // como nueva estimación pequeña (si no, se contradicen).
          cycle.isOverdue
            ? `${cycle.daysLate} día${cycle.daysLate === 1 ? '' : 's'}`
            : cycle.nextStart
              ? escapeHtml(fmtDay(cycle.nextStart))
              : '—'
        }</span>
      </div>
      <span class="cy-next__when">
        ${
          cycle.isOverdue
            ? `de retraso${cycle.nextStart ? `<small>nueva estimación · ${escapeHtml(fmtDay(cycle.nextStart))}</small>` : ''}`
            : cycle.daysUntilNext === 0
              ? 'estimada hoy'
              : `en <b>${cycle.daysUntilNext}</b> día${cycle.daysUntilNext === 1 ? '' : 's'}`
        }
      </span>
    </section>

    <button type="button" class="cy-facts-toggle" id="cyFactsToggle" aria-expanded="false" aria-controls="cyFacts">
      <span class="cy-facts-toggle-text">Más información</span>
      <span class="cy-facts-toggle-chev" aria-hidden="true">${icon('chev', 16)}</span>
    </button>

    ${confidenceNote(cycle)}

    <section class="cy-facts" id="cyFacts" aria-label="Datos de tu ciclo" hidden>
      <div class="cy-fact">
        <span class="cy-fact__label"><span class="cy-fact__emoji" aria-hidden="true">🔄</span> Ciclo medio</span>
        <b class="cy-fact__value">${cycle.avgCycle} <small>días</small></b>
        <span class="cy-fact__hint">${cycle.cycle.count ? `${cycle.cycle.count} ciclo${cycle.cycle.count === 1 ? '' : 's'} registrado${cycle.cycle.count === 1 ? '' : 's'}` : 'duración configurada'}</span>
      </div>
      <div class="cy-fact">
        <span class="cy-fact__label"><span class="cy-fact__emoji" aria-hidden="true">🩸</span> Regla media</span>
        <b class="cy-fact__value">${cycle.avgPeriod} <small>días</small></b>
        <span class="cy-fact__hint">${cycle.period.count ? `${cycle.period.count} periodo${cycle.period.count === 1 ? '' : 's'}` : 'orientativo'}</span>
      </div>
      <div class="cy-fact">
        <span class="cy-fact__label"><span class="cy-fact__emoji" aria-hidden="true">📅</span> Último inicio</span>
        <b class="cy-fact__value">${cycle.lastStart ? escapeHtml(fmtDay(cycle.lastStart)) : '—'}</b>
        <span class="cy-fact__hint">${cycle.lastEnd ? `terminó el ${escapeHtml(fmtDay(cycle.lastEnd))}` : 'sin fecha de fin'}</span>
      </div>
    </section>

    <section class="cy-section cy-section--quiet">
      ${sectionTitle('📅', 'Este mes')}
      <div class="cy-month-summary cy-month-summary--quiet">
        <div><b>${monthLogs.length}</b><small>📝 día${monthLogs.length === 1 ? '' : 's'} con registro</small></div>
        <div><b>${monthPeriodDays}</b><small>🩸 día${monthPeriodDays === 1 ? '' : 's'} de sangrado</small></div>
        <div><b>${escapeHtml(monthSymptoms)}</b><small>🌡️ síntoma más repetido</small></div>
      </div>
    </section>

    <section class="cy-section">
      ${sectionTitle('📝', 'Últimos registros')}
      ${
        recent.length
          ? `<ul class="cy-recent">${recent
              .map(
                log => `
            <li><button type="button" class="cy-recent-item" data-edit-log="${log.log_date}">
              <span class="cy-recent-dot" aria-hidden="true"></span>
              <span class="cy-recent-body">
                <span class="cy-recent-date">${escapeHtml(fmtDay(log.log_date))}</span>
                <span class="cy-chips">${chipsHTML(logChips(log))}</span>
              </span>
              <span class="cy-recent-chev" aria-hidden="true">${icon('chev', 16)}</span>
            </button></li>`
              )
              .join('')}</ul>`
          : `<p class="cy-empty-note">Todavía no has registrado ningún síntoma.</p>`
      }
    </section>

    ${renderEducation()}
  `;
}

export function bindHome(root, ctx) {
  // Las medias empiezan plegadas: la barra es la única puerta a ellas.
  const factsToggle = root.querySelector('#cyFactsToggle');
  const facts = root.querySelector('#cyFacts');
  if (factsToggle && facts) {
    factsToggle.addEventListener('click', () => {
      const open = facts.hidden;
      facts.hidden = !open;
      factsToggle.classList.toggle('is-open', open);
      factsToggle.setAttribute('aria-expanded', String(open));
      const text = factsToggle.querySelector('.cy-facts-toggle-text');
      if (text) text.textContent = open ? 'Ocultar información' : 'Más información';
    });
  }

  root.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.action === 'new-period') ctx.openPeriod();
      if (btn.dataset.action === 'new-log') ctx.openLog(ctx.today);
    });
  });
  root.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click', () => ctx.setTab(btn.dataset.goto));
  });
  root.querySelectorAll('[data-edit-log]').forEach(btn => {
    btn.addEventListener('click', () => ctx.openLog(btn.dataset.editLog));
  });
}
