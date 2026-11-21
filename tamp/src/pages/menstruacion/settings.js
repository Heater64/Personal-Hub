/* ==========================================
   Menstruación — Ajustes
   Duración del ciclo, privacidad, notificaciones, exportación y borrado.
   ========================================== */

import { icon } from '../../components/ui.js';
import { showToast } from '../../components/Toast.js';
import { escapeHtml } from '../../utils/escape.js';
import { todayISO } from '../../utils/format.js';
import * as cycleService from '../../services/cycle.service.js';
import { confirmSheet, setConfirmReload } from './sheets.js';
import { fmtDay, sectionTitle } from './shared.js';

function toggleRow(name, label, checked, hint = '') {
  return `
    <label class="cy-toggle">
      <input type="checkbox" name="${name}"${checked ? ' checked' : ''}>
      <span class="cy-toggle-track" aria-hidden="true"></span>
      <span class="cy-toggle-copy"><b>${escapeHtml(label)}</b>${hint ? `<small>${escapeHtml(hint)}</small>` : ''}</span>
    </label>
  `;
}

export function renderSettings(ctx) {
  const settings = ctx.data?.settings || {};
  const notifications = settings.notifications || {};
  const preferences = settings.preferences || {};
  const lastStart = ctx.cycle?.lastStart || '';

  return `
    <section class="card cy-settings">
      ${sectionTitle('🔄', 'Tu ciclo')}
      <p class="cy-muted">Estos valores solo se usan mientras no haya suficientes ciclos registrados.</p>
      <form data-form="cycle" class="cy-form">
        <div class="cy-form-grid">
          <label class="cy-field">
            <span>Ciclo habitual (días)</span>
            <input class="cy-input" type="number" name="avgCycleLength" min="15" max="90" value="${Number(settings.avgCycleLength ?? 28)}">
          </label>
          <label class="cy-field">
            <span>Menstruación (días)</span>
            <input class="cy-input" type="number" name="avgPeriodLength" min="1" max="15" value="${Number(settings.avgPeriodLength ?? 5)}">
          </label>
          <label class="cy-field">
            <span>Fase lútea (días)</span>
            <input class="cy-input" type="number" name="lutealPhaseLength" min="7" max="20" value="${Number(settings.lutealPhaseLength ?? 14)}">
          </label>
        </div>
        <div class="cy-actions">
          <button type="submit" class="btn">Guardar</button>
        </div>
      </form>
    </section>

    <section class="card cy-settings">
      ${sectionTitle('🗓️', 'Datos anteriores')}
      <p class="cy-muted">Si llevas meses con el ciclo, añade aquí el inicio de tu última menstruación para que las predicciones empiecen a funcionar sin esperar.</p>
      <form data-form="last-period" class="cy-form">
        <label class="cy-field">
          <span>Primer día de tu última menstruación</span>
          <input class="cy-input" type="date" name="start_date" value="${escapeHtml(lastStart)}" max="${todayISO()}">
        </label>
        <div class="cy-actions">
          <button type="submit" class="btn btn--ghost">Registrar este inicio</button>
        </div>
      </form>
      <p class="cy-hint">Para añadir varios ciclos anteriores, usa «Historial → Añadir».</p>
    </section>

    <section class="card cy-settings">
      ${sectionTitle('🔔', 'Notificaciones')}
      <form data-form="notifs" class="cy-form">
        ${toggleRow('daily', 'Recordatorio diario', notifications.daily === true, 'Solo un aviso genérico: nunca el detalle del ciclo.')}
        <label class="cy-field cy-field--inline">
          <span>Hora del recordatorio</span>
          <input class="cy-input" type="time" name="dailyTime" value="${escapeHtml(notifications.dailyTime || '20:00')}">
        </label>
        ${toggleRow('period', 'Aviso de próxima menstruación', notifications.period === true, 'Dos días antes de la fecha estimada, como mucho.')}
        <p class="cy-hint">Se respetan el permiso del dispositivo y el horario de silencio de la app.</p>
        <div class="cy-actions">
          <button type="submit" class="btn">Guardar avisos</button>
        </div>
      </form>
    </section>

    <section class="card cy-settings">
      ${sectionTitle('heart', 'Datos compartidos')}
      <p class="cy-muted">Los registros del ciclo son visibles para ambos. Cada persona mantiene la autoría y solo puede editar o borrar sus propios datos.</p>
    </section>
    <section class="card cy-settings">
      ${sectionTitle('📅', 'Calendario')}
      <form data-form="prefs" class="cy-form">
        ${toggleRow('showFertile', 'Mostrar ventana fértil estimada', preferences.showFertile !== false)}
        ${toggleRow('showOvulation', 'Marcar ovulación estimada', preferences.showOvulation !== false)}
        <div class="cy-actions">
          <button type="submit" class="btn btn--ghost">Guardar preferencias</button>
        </div>
      </form>
    </section>

    <section class="card cy-settings">
      ${sectionTitle('💾', 'Tus datos')}
      <div class="cy-actions cy-actions--wrap">
        <button type="button" class="btn btn--ghost" data-export="csv">${icon('cloud', 16)} Exportar CSV</button>
        <button type="button" class="btn btn--ghost" data-export="json">${icon('cloud', 16)} Exportar JSON</button>
      </div>
      <p class="cy-hint">La descarga se genera en tu dispositivo. No se sube a ningún servicio externo.</p>
      <button type="button" class="cy-danger-link" data-delete-all>${icon('trash', 16)} Borrar todos mis datos de este módulo</button>
    </section>

    <section class="card cy-settings cy-settings--privacy">
      ${sectionTitle('🔒', 'Privacidad')}
      <p class="cy-muted">Tus registros viven en tu cuenta y solo los lees tú. La vista de pareja se genera en el servidor y únicamente con los campos que autorizas; nunca se guardan copias en este dispositivo.</p>
      <p class="cy-hint">Última revisión: ${escapeHtml(fmtDay(ctx.today))}.</p>
    </section>
  `;
}

export function bindSettings(root, ctx) {
  setConfirmReload(() => ctx.reload());

  const on = (selector, event, handler) => {
    root.querySelector(selector)?.addEventListener(event, handler);
  };

  on('[data-form="cycle"]', 'submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await cycleService.saveSettings({
        avgCycleLength: Number(form.elements.avgCycleLength.value),
        avgPeriodLength: Number(form.elements.avgPeriodLength.value),
        lutealPhaseLength: Number(form.elements.lutealPhaseLength.value),
      });
      showToast('Ajustes guardados', 'success');
      await ctx.reload();
    } catch (err) {
      showToast(err.message || 'No se pudo guardar', 'error');
    }
  });

  on('[data-form="last-period"]', 'submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const start = form.elements.start_date.value;
    if (!start) {
      showToast('Elige una fecha', 'error');
      return;
    }
    if (start > todayISO()) {
      showToast('La fecha no puede ser futura', 'error');
      return;
    }
    try {
      await cycleService.savePeriod({ start_date: start });
      showToast('Inicio registrado', 'success');
      await ctx.reload();
    } catch (err) {
      showToast(err.message || 'No se pudo guardar', 'error');
    }
  });

  on('[data-form="notifs"]', 'submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await cycleService.saveSettings({
        notifications: {
          daily: form.elements.daily.checked,
          dailyTime: form.elements.dailyTime.value || '20:00',
          period: form.elements.period.checked,
        },
      });
      showToast('Avisos guardados', 'success');
      await ctx.reload();
    } catch (err) {
      showToast(err.message || 'No se pudieron guardar', 'error');
    }
  });

  on('[data-form="prefs"]', 'submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await cycleService.saveSettings({
        preferences: {
          showFertile: form.elements.showFertile.checked,
          showOvulation: form.elements.showOvulation.checked,
        },
      });
      showToast('Preferencias guardadas', 'success');
      await ctx.reload();
    } catch (err) {
      showToast(err.message || 'No se pudieron guardar', 'error');
    }
  });

  on('[data-export="csv"]', 'click', () => {
    const name = `menstruacion-${todayISO()}.csv`;
    cycleService.download(name, 'text/csv', cycleService.toCSV(ctx.data));
    showToast('CSV descargado', 'success');
  });

  on('[data-export="json"]', 'click', () => {
    const name = `menstruacion-${todayISO()}.json`;
    cycleService.download(name, 'application/json', cycleService.toJSON(ctx.data));
    showToast('JSON descargado', 'success');
  });

  on('[data-delete-all]', 'click', () => {
    confirmSheet({
      title: 'Borrar todos mis datos',
      message:
        'Se borrarán todos tus ciclos, registros diarios, ajustes y el permiso de pareja. No se puede deshacer.',
      confirmLabel: 'Borrar todo',
      onConfirm: () => cycleService.deleteAll(),
    });
  });
}
