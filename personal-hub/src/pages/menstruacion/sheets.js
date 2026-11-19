/* ==========================================
   Menstruación — hojas de registro
   Formularios reales (registro diario, menstruación y detalle del día)
   sobre el bottom sheet compartido de la app.
   ========================================== */

import { openSheet, closeSheets, icon } from '../../components/ui.js';
import { showToast } from '../../components/Toast.js';
import { escapeHtml } from '../../utils/escape.js';
import { todayISO } from '../../utils/format.js';
import { getUserPref, setUserPref } from '../../utils/userStorage.js';
import {
  SYMPTOMS,
  FLOW_LEVELS,
  ENERGY_LEVELS,
  SLEEP_LABELS,
  symptomLabel,
  flowLabel,
  energyLabel,
  sleepLabel,
} from '../../data/cycle.data.js';
import { cycleDayFor } from '../../utils/cycleMath.js';
import * as cycleService from '../../services/cycle.service.js';
import { buildDayIndex, fmtDay, fmtLong, badge } from './shared.js';

function findLog(ctx, date) {
  return (ctx.data?.logs || []).find(log => log.log_date === date) || null;
}

/* ==========================================
   SÍNTOMAS PROPIOS
   ==========================================
   Los que escribe ella se guardan dentro del propio registro como
   `custom:<texto>` (sin tocar la base de datos), y la lista de los últimos
   usados queda en este dispositivo para volver a ofrecerlos como píldoras. */

const CUSTOM_KEY = 'cyCustomSymptoms';

export function customSymptoms() {
  try {
    const list = JSON.parse(getUserPref(CUSTOM_KEY) || '[]');
    return Array.isArray(list) ? list.filter(text => typeof text === 'string' && text.trim()) : [];
  } catch {
    return [];
  }
}

function rememberSymptom(text) {
  const list = customSymptoms();
  if (list.some(item => item.toLowerCase() === text.toLowerCase())) return;
  setUserPref(CUSTOM_KEY, JSON.stringify([...list, text].slice(-20)));
}

/* ==========================================
   FORMULARIO DE REGISTRO DIARIO
   ========================================== */

function multiPill(group, id, label, emoji, active) {
  return `<button type="button" class="cy-pill${active ? ' is-active' : ''}" data-multi="${group}" data-value="${escapeHtml(id)}" aria-pressed="${active ? 'true' : 'false'}">
    ${emoji ? `<span aria-hidden="true">${emoji}</span>` : ''}${escapeHtml(label)}
  </button>`;
}

function singlePill(group, id, label, active) {
  return `<button type="button" class="cy-pill${active ? ' is-active' : ''}" data-single="${group}" data-value="${escapeHtml(id)}" aria-pressed="${active ? 'true' : 'false'}">${escapeHtml(label)}</button>`;
}

export function renderLogForm(date, log = null) {
  const symptoms = new Set(log?.symptoms || []);
  const sleep = log?.sleep_quality ?? '';

  return `
    <form class="cy-form" novalidate>
      <input type="hidden" name="log_date" value="${escapeHtml(date)}">

      <fieldset class="cy-field">
        <legend>Flujo</legend>
        <div class="cy-pills" role="group" aria-label="Intensidad del flujo">
          ${FLOW_LEVELS.map(level => singlePill('flow', level.id, level.label, log?.flow === level.id)).join('')}
          <button type="button" class="cy-pill${log?.spotting ? ' is-active' : ''}" data-toggle="spotting" aria-pressed="${log?.spotting ? 'true' : 'false'}">Manchado</button>
        </div>
      </fieldset>

      <fieldset class="cy-field">
        <legend>Síntomas</legend>
        <div class="cy-pills" role="group" aria-label="Síntomas" data-symptoms-pills>
          ${SYMPTOMS.map(item => multiPill('symptoms', item.id, item.label, item.emoji, symptoms.has(item.id))).join('')}
          ${customSymptoms()
            .map(text =>
              multiPill('symptoms', `custom:${text}`, text, '', symptoms.has(`custom:${text}`))
            )
            .join('')}
        </div>
        <div class="cy-custom">
          <input class="cy-input cy-custom__input" type="text" maxlength="28"
            placeholder="Otro síntoma…" data-custom-input aria-label="Escribir otro síntoma">
          <button type="button" class="cy-custom__add" data-custom-add>Añadir</button>
        </div>
      </fieldset>

      <div class="cy-form-grid">
        <fieldset class="cy-field">
          <legend>Energía</legend>
          <div class="cy-pills" role="group" aria-label="Energía">
            ${ENERGY_LEVELS.map(level => singlePill('energy', level.id, level.label, log?.energy === level.id)).join('')}
          </div>
        </fieldset>

        <label class="cy-field">
          <span>Calidad del sueño</span>
          <select class="cy-select" name="sleep_quality">
            <option value="">Sin registrar</option>
            ${Object.entries(SLEEP_LABELS)
              .map(
                ([value, label]) =>
                  `<option value="${value}"${String(sleep) === value ? ' selected' : ''}>${label}</option>`
              )
              .join('')}
          </select>
        </label>
      </div>

      <label class="cy-field">
        <span>Notas</span>
        <textarea class="cy-textarea" name="notes" rows="3" maxlength="2000" placeholder="Lo que quieras recordar de hoy…">${escapeHtml(log?.notes || '')}</textarea>
      </label>

      <p class="cy-hint">Puedes guardar solo lo que quieras. Nada es obligatorio.</p>

      <div class="cy-actions">
        <button type="submit" class="btn">Guardar registro</button>
      </div>
    </form>
  `;
}

export function wireLogForm(form, ctx, { onSaved } = {}) {
  form.querySelectorAll('[data-single]').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.single;
      const wasActive = btn.getAttribute('aria-pressed') === 'true';
      form.querySelectorAll(`[data-single="${group}"]`).forEach(other => {
        other.classList.remove('is-active');
        other.setAttribute('aria-pressed', 'false');
      });
      if (!wasActive) {
        btn.classList.add('is-active');
        btn.setAttribute('aria-pressed', 'true');
      }
    });
  });

  const bindMulti = btn => {
    btn.addEventListener('click', () => {
      const active = btn.getAttribute('aria-pressed') === 'true';
      btn.classList.toggle('is-active', !active);
      btn.setAttribute('aria-pressed', String(!active));
    });
  };
  form.querySelectorAll('[data-multi]').forEach(bindMulti);

  // Síntoma escrito a mano: se crea la píldora en el momento y se recuerda.
  const customInput = form.querySelector('[data-custom-input]');
  const customAdd = form.querySelector('[data-custom-add]');
  const pillsRow = form.querySelector('[data-symptoms-pills]');

  const addCustomSymptom = () => {
    const text = (customInput?.value || '').replace(/\s+/g, ' ').trim().slice(0, 28);
    if (!text || !pillsRow) return;

    const id = `custom:${text}`;
    let pill = [...pillsRow.querySelectorAll('[data-multi="symptoms"]')].find(
      item => item.dataset.value === id
    );

    if (!pill) {
      pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'cy-pill';
      pill.dataset.multi = 'symptoms';
      pill.dataset.value = id;
      pill.setAttribute('aria-pressed', 'false');
      pill.textContent = text;
      pillsRow.append(pill);
      bindMulti(pill);
    }

    if (pill.getAttribute('aria-pressed') !== 'true') pill.click();
    rememberSymptom(text);
    customInput.value = '';
    customInput.focus();
  };

  customAdd?.addEventListener('click', addCustomSymptom);
  customInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      // Enter mientras un IME compone confirma el candidato, no añade nada.
      if (event.isComposing || event.keyCode === 229) return;
      addCustomSymptom();
    }
  });

  form.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const active = btn.getAttribute('aria-pressed') === 'true';
      btn.classList.toggle('is-active', !active);
      btn.setAttribute('aria-pressed', String(!active));
    });
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    const date = form.querySelector('[name="log_date"]')?.value;

    if (!date) {
      showToast('Elige una fecha', 'error');
      return;
    }
    if (date > todayISO()) {
      showToast('No se puede registrar un día futuro', 'error');
      return;
    }

    const valuesOf = group =>
      [...form.querySelectorAll(`[data-multi="${group}"][aria-pressed="true"]`)].map(
        btn => btn.dataset.value
      );
    const valueOf = group =>
      form.querySelector(`[data-single="${group}"][aria-pressed="true"]`)?.dataset.value || null;
    const spotting =
      form.querySelector('[data-toggle="spotting"]')?.getAttribute('aria-pressed') === 'true';

    const payload = {
      log_date: date,
      flow: valueOf('flow'),
      spotting,
      symptoms: valuesOf('symptoms'),
      // El ánimo se registra en Sentimientos; aquí se conserva lo que ya
      // hubiera apuntado antes, sin pedirlo otra vez.
      mood: findLog(ctx, date)?.mood || [],
      energy: valueOf('energy'),
      sleep_quality: form.querySelector('[name="sleep_quality"]')?.value || null,
      notes: form.querySelector('[name="notes"]')?.value || '',
    };

    const empty =
      !payload.flow &&
      !payload.spotting &&
      !payload.symptoms.length &&
      !payload.energy &&
      !payload.sleep_quality &&
      !payload.notes.trim();

    submit.disabled = true;
    try {
      if (empty) {
        await cycleService.deleteLog(date);
        showToast('Día sin registro', 'info');
      } else {
        await cycleService.saveLog(payload);
        showToast('Registro guardado', 'success');
      }
      closeSheets();
      await ctx.reload();
      onSaved?.();
    } catch (err) {
      showToast(err.message || 'No se pudo guardar el registro', 'error');
      submit.disabled = false;
    }
  });
}

export function openLogSheet(ctx, date) {
  const log = findLog(ctx, date);
  openSheet(`${log ? 'Editar' : 'Nuevo'} registro · ${fmtDay(date)}`, sheet => {
    const wrap = document.createElement('div');
    wrap.className = 'cy-sheet menstruacion-page';
    wrap.innerHTML = renderLogForm(date, log);
    wireLogForm(wrap.querySelector('form'), ctx);

    if (log) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'cy-danger-link';
      remove.innerHTML = `${icon('trash', 16)} Eliminar este registro`;
      remove.addEventListener('click', () => {
        confirmSheet({
          title: 'Eliminar registro',
          message: `Se borrará todo lo registrado el ${fmtLong(date)}. Esta acción no se puede deshacer.`,
          onConfirm: () => cycleService.deleteLog(date),
        });
      });
      wrap.append(remove);
    }
    return sheet.appendChild(wrap);
  });
}

/* ==========================================
   MENSTRUACIÓN (periodo)
   ========================================== */

export function openPeriodSheet(ctx, period = null, defaultStart = null) {
  const start = period?.start_date || defaultStart || todayISO();
  const end = period?.end_date || '';
  const notes = period?.notes || '';

  openSheet(period ? 'Editar menstruación' : 'Registrar menstruación', sheet => {
    const wrap = document.createElement('div');
    wrap.className = 'cy-sheet menstruacion-page';
    wrap.innerHTML = `
      <form class="cy-form" novalidate>
        <label class="cy-field">
          <span>Primer día</span>
          <input class="cy-input" type="date" name="start_date" required value="${escapeHtml(start)}" max="${todayISO()}">
        </label>
        <label class="cy-field">
          <span>Último día (opcional)</span>
          <input class="cy-input" type="date" name="end_date" value="${escapeHtml(end)}" max="${todayISO()}">
          <small class="cy-hint">Si aún no ha terminado, déjalo vacío.</small>
        </label>
        <label class="cy-field">
          <span>Notas</span>
          <textarea class="cy-textarea" name="notes" rows="2" maxlength="2000">${escapeHtml(notes)}</textarea>
        </label>
        <div class="cy-actions">
          <button type="submit" class="btn">${period ? 'Guardar cambios' : 'Guardar menstruación'}</button>
        </div>
      </form>
      ${period ? `<button type="button" class="cy-danger-link" data-delete>${icon('trash', 16)} Eliminar esta menstruación</button>` : ''}
    `;

    const form = wrap.querySelector('form');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const startDate = form.querySelector('[name="start_date"]').value;
      const endDate = form.querySelector('[name="end_date"]').value;
      const submit = form.querySelector('[type="submit"]');

      if (!startDate) {
        showToast('Elige el primer día', 'error');
        return;
      }
      if (startDate > todayISO()) {
        showToast('La fecha no puede ser futura', 'error');
        return;
      }
      if (endDate && endDate < startDate) {
        showToast('El último día no puede ser anterior al primero', 'error');
        return;
      }

      submit.disabled = true;
      try {
        await cycleService.savePeriod({
          id: period?.id,
          start_date: startDate,
          end_date: endDate || null,
          notes: form.querySelector('[name="notes"]').value,
        });
        showToast(period ? 'Menstruación actualizada' : 'Menstruación registrada', 'success');
        closeSheets();
        await ctx.reload();
      } catch (err) {
        showToast(err.message || 'No se pudo guardar', 'error');
        submit.disabled = false;
      }
    });

    wrap.querySelector('[data-delete]')?.addEventListener('click', () => {
      confirmSheet({
        title: 'Eliminar menstruación',
        message: `Se borrará el periodo que empieza el ${fmtLong(start)}. Esta acción no se puede deshacer.`,
        onConfirm: () => cycleService.deletePeriod(period.id),
      });
    });

    sheet.appendChild(wrap);
  });
}

/* ==========================================
   DETALLE DE UN DÍA
   ========================================== */

export function openDaySheet(ctx, date) {
  const index = buildDayIndex(ctx);
  const log = index.logs.get(date) || null;
  const cycleDay = cycleDayFor(date, ctx.data?.periods || []);
  const predicted = index.estimated.has(date);

  const labels = [];
  if (index.period.has(date)) labels.push(badge('Menstruación registrada', 'period'));
  if (predicted) labels.push(badge('Menstruación estimada', 'estimated'));
  if (index.fertile.has(date)) labels.push(badge('Ventana fértil estimada', 'fertile'));
  if (index.ovulation.has(date)) labels.push(badge('Ovulación estimada', 'ovulation'));
  if (log?.spotting) labels.push(badge('Manchado', 'spotting'));

  const rows = [];
  if (log?.flow) rows.push(['Flujo', flowLabel(log.flow)]);
  if ((log?.symptoms || []).length)
    rows.push(['Síntomas', log.symptoms.map(id => symptomLabel(id)).join(', ')]);
  if (log?.energy) rows.push(['Energía', energyLabel(log.energy)]);
  if (log?.sleep_quality) rows.push(['Sueño', sleepLabel(log.sleep_quality)]);
  if (log?.notes) rows.push(['Notas', log.notes]);

  openSheet(fmtLong(date), sheet => {
    const wrap = document.createElement('div');
    wrap.className = 'cy-sheet menstruacion-page';
    wrap.innerHTML = `
      <div class="cy-day-sheet-head">
        ${labels.length ? `<div class="cy-badges">${labels.join('')}</div>` : ''}
        ${cycleDay ? `<p class="cy-muted">Día ${cycleDay} del ciclo · ${predicted || index.fertile.has(date) ? 'datos estimados' : 'según tus registros'}</p>` : ''}
      </div>
      ${
        rows.length
          ? `<dl class="cy-detail">${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>`
          : `<p class="cy-muted">No hay nada registrado este día.</p>`
      }
      <p class="cy-hint">Lo marcado como estimado se calcula con tu historial; no es un registro real.</p>
      <div class="cy-actions cy-actions--wrap">
        <button type="button" class="btn" data-edit>${log ? 'Editar registro' : 'Añadir registro'}</button>
        <button type="button" class="btn btn--ghost" data-period>Registrar menstruación</button>
      </div>
      ${log ? `<button type="button" class="cy-danger-link" data-delete>${icon('trash', 16)} Eliminar registro del día</button>` : ''}
    `;

    wrap.querySelector('[data-edit]').addEventListener('click', () => openLogSheet(ctx, date));
    wrap
      .querySelector('[data-period]')
      .addEventListener('click', () => openPeriodSheet(ctx, null, date));
    wrap.querySelector('[data-delete]')?.addEventListener('click', () => {
      confirmSheet({
        title: 'Eliminar registro',
        message: `Se borrará lo registrado el ${fmtLong(date)}. Esta acción no se puede deshacer.`,
        onConfirm: () => cycleService.deleteLog(date),
      });
    });

    sheet.appendChild(wrap);
  });
}

/* ==========================================
   CONFIRMACIÓN
   ========================================== */

export function confirmSheet({
  title = '¿Seguro?',
  message = '',
  confirmLabel = 'Eliminar',
  onConfirm,
}) {
  openSheet(title, sheet => {
    const wrap = document.createElement('div');
    wrap.className = 'cy-sheet menstruacion-page';
    wrap.innerHTML = `
      <p class="cy-confirm-text">${escapeHtml(message)}</p>
      <div class="cy-actions">
        <button type="button" class="btn btn--ghost" data-cancel>Cancelar</button>
        <button type="button" class="btn btn--danger" data-confirm>${escapeHtml(confirmLabel)}</button>
      </div>
    `;
    wrap.querySelector('[data-cancel]').addEventListener('click', () => closeSheets());
    const confirm = wrap.querySelector('[data-confirm]');
    confirm.addEventListener('click', async () => {
      confirm.disabled = true;
      try {
        await onConfirm();
        closeSheets();
        await ctxReloadSafely();
      } catch (err) {
        showToast(err.message || 'No se pudo completar', 'error');
        confirm.disabled = false;
      }
    });
    sheet.appendChild(wrap);
  });
}

/* `confirmSheet` se usa también desde ajustes (borrar todo): necesita
   repintar la página tras el borrado. Se inyecta el reload del ctx. */
let ctxReloadSafely = async () => {};
export function setConfirmReload(reload) {
  ctxReloadSafely = typeof reload === 'function' ? reload : async () => {};
}
