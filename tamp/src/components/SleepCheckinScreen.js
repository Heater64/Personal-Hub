/* ==========================================
   Check-in diario de sueño
   El valor se guarda como `sleep_quality` en el registro diario del ciclo.
   ========================================== */

import { showToast } from './Toast.js';
import { userStore } from '../stores/user.store.js';
import { SLEEP_LABELS } from '../data/cycle.data.js';
import * as cycleService from '../services/cycle.service.js';
import { setUserPref } from '../utils/userStorage.js';
import { todayISO } from '../utils/format.js';
import { escapeHtml } from '../utils/escape.js';

const SLEEP_OPTIONS = [
  { value: 1, emoji: '😵‍💫' },
  { value: 2, emoji: '😕' },
  { value: 3, emoji: '😐' },
  { value: 4, emoji: '🙂' },
  { value: 5, emoji: '😴' },
];

export function SleepCheckinScreen({ onDone } = {}) {
  const userName = userStore.getUser()?.name || 'princesa';
  const day = todayISO();
  const overlay = document.createElement('div');
  overlay.className = 'sleep-checkin-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Registro diario del sueño');
  overlay.innerHTML = `
    <section class="sleep-checkin-card">
      <div class="sleep-checkin-icon" aria-hidden="true">🌙</div>
      <p class="sleep-checkin-eyebrow">Un momento para ti</p>
      <h1 class="sleep-checkin-title">¿Qué tal has dormido, <span>${escapeHtml(userName)}</span>?</h1>
      <p class="sleep-checkin-copy">Elige cómo fue tu descanso. Se guardará en el registro diario de tu calendario <u>menstrual</u>.</p>
      <div class="sleep-checkin-options" role="group" aria-label="Calidad del sueño">
        ${SLEEP_OPTIONS.map(option => `
          <button type="button" class="sleep-checkin-option" data-sleep-quality="${option.value}" aria-pressed="false">
            <span class="sleep-checkin-option__emoji" aria-hidden="true">${option.emoji}</span>
            <span>${escapeHtml(SLEEP_LABELS[option.value])}</span>
          </button>
        `).join('')}
      </div>
      <p class="sleep-checkin-status" aria-live="polite" hidden></p>
      <div class="sleep-checkin-actions">
        <button type="button" class="sleep-checkin-save" disabled>Guardar en el calendario</button>
        <button type="button" class="sleep-checkin-later">Ahora no</button>
      </div>
      <p class="sleep-checkin-footnote">Puedes cambiar este dato después desde el calendario.</p>
    </section>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const saveButton = overlay.querySelector('.sleep-checkin-save');
  const status = overlay.querySelector('.sleep-checkin-status');
  let selection = null;
  let closing = false;

  function close() {
    if (closing) return;
    closing = true;
    document.body.style.overflow = '';
    overlay.style.animation = 'fade-out 0.25s ease forwards';
    setTimeout(() => {
      overlay.remove();
      onDone?.();
    }, 250);
  }

  overlay.addEventListener('click', event => {
    const option = event.target.closest('[data-sleep-quality]');
    if (!option) return;
    selection = Number(option.dataset.sleepQuality);
    overlay.querySelectorAll('[data-sleep-quality]').forEach(button => {
      const active = Number(button.dataset.sleepQuality) === selection;
      button.classList.toggle('is-selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
    saveButton.disabled = false;
    status.hidden = true;
  });

  saveButton.addEventListener('click', async () => {
    if (!selection || saveButton.disabled) return;
    saveButton.disabled = true;
    saveButton.textContent = 'Guardando…';
    try {
      await cycleService.saveSleepQuality(day, selection);
      showToast('Sueño guardado en el calendario', 'success');
      close();
    } catch (error) {
      status.textContent = error?.message || 'No se pudo guardar el sueño. Inténtalo de nuevo.';
      status.hidden = false;
      saveButton.textContent = 'Guardar en el calendario';
      saveButton.disabled = false;
    }
  });

  overlay.querySelector('.sleep-checkin-later').addEventListener('click', () => {
    cycleService.dismissSleepCheckin(day).then(({ synced }) => {
      if (!synced) setUserPref('sleepPromptDismissedDate', day);
      close();
    }).catch(() => {
      // Posponer no debe forzar un registro de salud ni bloquear la app si no
      // hay red. Si la migración 048 aún no está aplicada, queda local hoy.
      setUserPref('sleepPromptDismissedDate', day);
      showToast('Lo dejamos para otro momento en este dispositivo', 'info');
      close();
    });
  });

  return overlay;
}
