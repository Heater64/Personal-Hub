/* ==========================================
   Menstruación — Registro diario
   Formulario del día elegido (parcial, editable) + últimos registros.
   ========================================== */

import { escapeHtml } from '../../utils/escape.js';
import { icon } from '../../components/ui.js';
import { badge, fmtDay, fmtLong, logChips, chipsHTML, sectionTitle } from './shared.js';
import { renderLogForm, wireLogForm } from './sheets.js';

export function renderLog(ctx) {
  const date = ctx.ui.logDate || ctx.today;
  const log = (ctx.data?.logs || []).find(item => item.log_date === date) || null;
  const esHoy = date === ctx.today;
  const recent = [...(ctx.data?.logs || [])]
    .sort((a, b) => b.log_date.localeCompare(a.log_date))
    .slice(0, 8);

  return `
    <section class="card cy-log-card">
      <header class="cy-log-head">
        <div class="cy-log-head__text">
          <p class="cy-log-eyebrow">${esHoy ? 'Hoy' : 'Día elegido'}</p>
          <h2 class="cy-log-title">${escapeHtml(fmtLong(date))}</h2>
        </div>
        ${log ? badge('Registrado', 'log') : badge('Sin registro')}
      </header>

      <label class="cy-log-pick">
        <span class="cy-log-pick__label">${icon('calendar', 15)} Día</span>
        <input class="cy-input" type="date" id="cyLogDate" value="${escapeHtml(date)}" max="${ctx.today}">
      </label>

      ${renderLogForm(date, log)}
    </section>

    <section class="cy-section">
      <div class="cy-section-head">
        ${sectionTitle('📝', 'Últimos registros')}
        ${recent.length ? `<span class="cy-log-count">${recent.length}</span>` : ''}
      </div>
      ${
        recent.length
          ? `<ul class="cy-recent">${recent
              .map(
                item => `
            <li><button type="button" class="cy-recent-item" data-open-log="${item.log_date}">
              <span class="cy-recent-dot" aria-hidden="true"></span>
              <span class="cy-recent-body">
                <span class="cy-recent-date">${escapeHtml(fmtDay(item.log_date))}</span>
                <span class="cy-chips">${chipsHTML(logChips(item))}</span>
              </span>
              <span class="cy-recent-chev" aria-hidden="true">${icon('chev', 16)}</span>
            </button></li>`
              )
              .join('')}</ul>`
          : '<p class="cy-empty-note">Todavía no has registrado ningún síntoma.</p>'
      }
    </section>
  `;
}

export function bindLog(root, ctx) {
  const dateInput = root.querySelector('#cyLogDate');
  dateInput?.addEventListener('change', () => {
    ctx.ui.logDate = dateInput.value || ctx.today;
    ctx.repaint();
  });

  const form = root.querySelector('form.cy-form');
  if (form) wireLogForm(form, ctx);

  root.querySelectorAll('[data-open-log]').forEach(btn => {
    btn.addEventListener('click', () => {
      ctx.ui.logDate = btn.dataset.openLog;
      ctx.repaint();
    });
  });
}
