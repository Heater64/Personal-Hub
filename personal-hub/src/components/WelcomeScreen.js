/* ==========================================
   Personal Hub v2 — Welcome Screen (Mood Check-in)
   Panel de bienvenida completo con estado de ánimo diario.
   Solo para la usuaria (no admin): saludo personalizado
   según la hora del día con el nombre real del perfil.

   La tarjeta ofrece los atajos de siempre y un desplegable
   «Otras» con el catálogo largo + la opción de escribirla.
   Se puede elegir MÁS DE UNA emoción a la vez.
   ========================================== */

import { moodStore } from '../stores/mood.store.js';
import { userStore } from '../stores/user.store.js';
import { showToast } from '../components/Toast.js';
import { hourInSpain } from '../utils/format.js';
import { daysSinceAnniversary, loadSpecialDates } from '../utils/specialDates.js';
import { MAX_CUSTOM_LABEL, makeCustomMood, toggleMoodSelection } from '../data/moods.data.js';

export function WelcomeScreen({ onDone } = {}) {
  const user = userStore.getUser();
  const userName = user?.name || 'princesa';
  const daysSince = daysSinceAnniversary();

  const overlay = document.createElement('div');
  overlay.className = 'welcome-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Bienvenida diaria');
  overlay.innerHTML = `
    <div class="welcome-modal">
      <div class="welcome-bg">
        <div class="welcome-bg-particle p1"></div>
        <div class="welcome-bg-particle p2"></div>
        <div class="welcome-bg-particle p3"></div>
        <div class="welcome-bg-particle p4"></div>
        <div class="welcome-bg-particle p5"></div>
        <div class="welcome-bg-particle p6"></div>
      </div>
      <div class="welcome-content">
        <div class="welcome-greeting">
          <div class="welcome-time-icon">
            <span class="welcome-icon-inner" id="welcomeTimeIcon">☀️</span>
          </div>
          <h1 class="welcome-title">
            <span id="welcomeGreeting"></span>,<br>
            <span class="welcome-name" id="welcomeName">${escapeAttr(userName)}</span>
            <span class="welcome-heart">♥</span>
          </h1>
          <p class="welcome-subtitle">¿Cómo te sientes ahora mismo?</p>
        </div>

        <div class="welcome-moods" id="welcomeMoods" role="group" aria-label="Elige cómo te sientes. Puedes marcar varias"></div>

        <div class="welcome-extra" id="welcomeExtra" hidden>
          <div class="welcome-extra-head">
            <span class="welcome-extra-title">Más emociones</span>
            <span class="welcome-extra-hint">Puedes marcar varias</span>
          </div>
          <div class="welcome-extra-grid" id="welcomePalette"></div>
          <form class="welcome-custom" id="welcomeCustomForm">
            <input
              type="text"
              id="welcomeCustomInput"
              class="welcome-custom-input"
              maxlength="${MAX_CUSTOM_LABEL}"
              placeholder="¿No está? Escríbela tú…"
              aria-label="Escribe tú la emoción"
              autocomplete="off"
            >
            <button type="submit" class="welcome-custom-add">Añadir</button>
          </form>
          <div class="welcome-custom-chips" id="welcomeCustomChips"></div>
        </div>

        <div class="welcome-cta">
          <button type="button" class="welcome-btn" id="welcomeContinueBtn" disabled>
            <span>Continuar</span>
            <span class="welcome-btn-arrow">→</span>
          </button>
          <button type="button" class="welcome-later" id="welcomeLaterBtn">Más tarde</button>
        </div>

        <p class="welcome-counter" id="welcomeCounter">${daysSince} días compartiendo momentos juntos</p>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Contador dinámico: si las fechas configuradas llegan después del render
  // (Supabase), actualiza el contador de la bienvenida en caliente.
  loadSpecialDates().then(() => {
    const el = overlay.querySelector('#welcomeCounter');
    if (el) el.textContent = `${daysSinceAnniversary()} días compartiendo momentos juntos`;
  });

  // Prevent body scroll
  document.body.style.overflow = 'hidden';

  const moodsContainer = overlay.querySelector('#welcomeMoods');
  const extraPanel = overlay.querySelector('#welcomeExtra');
  const paletteEl = overlay.querySelector('#welcomePalette');
  const customForm = overlay.querySelector('#welcomeCustomForm');
  const customInput = overlay.querySelector('#welcomeCustomInput');
  const continueBtn = overlay.querySelector('#welcomeContinueBtn');
  const greetingEl = overlay.querySelector('#welcomeGreeting');
  const timeIcon = overlay.querySelector('#welcomeTimeIcon');

  // Set greeting and icon based on time of day (hora de España, península)
  const hour = hourInSpain();
  if (hour >= 5 && hour < 12) {
    greetingEl.textContent = 'Buenos días';
    timeIcon.textContent = '☀️';
  } else if (hour >= 12 && hour < 18) {
    greetingEl.textContent = 'Buenas tardes';
    timeIcon.textContent = '🌤️';
  } else if (hour >= 18 && hour < 22) {
    greetingEl.textContent = 'Buenas noches';
    timeIcon.textContent = '🌙';
  } else {
    greetingEl.textContent = 'Buenas noches';
    timeIcon.textContent = '🌙';
  }

  // Catálogo: los atajos van en la tarjeta y el resto en «Otras». Las dos
  // listas salen del mismo catálogo, así que añadir emociones no obliga a
  // tocar esta pantalla.
  const quickMoods = moodStore.getQuickMoods();
  const paletteMoods = moodStore.getPaletteMoods();
  const customMood = moodStore.getCustomMood();
  const quickIds = new Set(quickMoods.map(m => m.id));

  let selection = [];
  let extraOpen = false;

  // Render mood options (atajos) + «Otras»
  moodsContainer.innerHTML = `
    ${quickMoods.map((mood, i) => `
      <button type="button" class="mood-btn" data-mood="${mood.id}" aria-pressed="false" style="animation-delay: ${150 + i * 80}ms">
        <span class="mood-btn__emoji">${mood.emoji}</span>
        <div class="mood-btn__text">
          <span class="mood-btn__label">${mood.label}</span>
        </div>
        <span class="mood-btn__check">✓</span>
      </button>
    `).join('')}
    <button type="button" class="mood-btn mood-btn--more" id="welcomeMoreBtn" aria-pressed="false" aria-expanded="false" aria-controls="welcomeExtra" style="animation-delay: ${150 + quickMoods.length * 80}ms">
      <span class="mood-btn__emoji">${customMood.emoji}</span>
      <div class="mood-btn__text">
        <span class="mood-btn__label">Otras</span>
      </div>
      <span class="mood-btn__check">✓</span>
    </button>
  `;

  paletteEl.innerHTML = paletteMoods.map(mood => `
    <button type="button" class="mood-chip" data-mood="${mood.id}" aria-pressed="false">
      <span class="mood-chip__emoji" aria-hidden="true">${mood.emoji}</span>
      <span class="mood-chip__label">${mood.label}</span>
      <span class="mood-chip__check" aria-hidden="true">✓</span>
    </button>
  `).join('');

  const moreBtn = overlay.querySelector('#welcomeMoreBtn');

  /** Repinta qué está marcado y si se puede continuar. */
  function paint() {
    overlay.querySelectorAll('[data-mood]').forEach(btn => {
      const active = selection.some(item => item.id === btn.dataset.mood);
      btn.classList.toggle('selected', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    const hasExtra = selection.some(item => !quickIds.has(item.id));
    moreBtn.classList.toggle('selected', hasExtra);
    moreBtn.setAttribute('aria-pressed', String(hasExtra));

    // Lo escrito se ve como una emoción más, y se puede quitar.
    const customChips = overlay.querySelector('#welcomeCustomChips');
    const customItem = selection.find(item => item.id === customMood.id);
    customChips.innerHTML = customItem
      ? `<button type="button" class="mood-chip mood-chip--custom selected" data-custom-remove aria-label="Quitar «${escapeAttr(customItem.label)}»">
          <span class="mood-chip__emoji" aria-hidden="true">${customItem.emoji}</span>
          <span class="mood-chip__label">${escapeAttr(customItem.label)}</span>
          <span class="mood-chip__check" aria-hidden="true">×</span>
        </button>`
      : '';
    overlay.querySelector('.welcome-custom-add').textContent = customItem ? 'Cambiar' : 'Añadir';

    continueBtn.disabled = selection.length === 0;
    continueBtn.classList.toggle('ready', selection.length > 0);
  }

  // Selección / deselección de cualquier emoción (atajos y desplegable)
  overlay.addEventListener('click', (event) => {
    const removeCustom = event.target.closest('[data-custom-remove]');
    if (removeCustom) {
      selection = selection.filter(item => item.id !== customMood.id);
      customInput.value = '';
      paint();
      return;
    }
    const btn = event.target.closest('[data-mood]');
    if (!btn || !overlay.contains(btn)) return;
    selection = toggleMoodSelection(selection, btn.dataset.mood);
    paint();
    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(15);
  });

  // «Otras» abre y cierra el desplegable
  moreBtn.addEventListener('click', () => {
    extraOpen = !extraOpen;
    extraPanel.hidden = !extraOpen;
    moreBtn.setAttribute('aria-expanded', String(extraOpen));
    moreBtn.classList.toggle('is-open', extraOpen);
    if (extraOpen) customInput.focus({ preventScroll: true });
  });

  // Emoción escrita a mano: sustituye a la anterior si ya había una
  customForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const item = makeCustomMood(customInput.value);
    if (!item) {
      customInput.focus();
      showToast('Escribe cómo te sientes', 'info');
      return;
    }
    selection = [...selection.filter(i => i.id !== customMood.id), item];
    customInput.value = item.label;
    paint();
  });

  // Continue
  async function handleContinue() {
    if (!selection.length) return;
    continueBtn.disabled = true;
    continueBtn.innerHTML = '<span>Guardando...</span>';

    try {
      await moodStore.saveMoods(selection);
      showToast('💖 ¡Gracias por compartir cómo te sientes!', 'success');
      close(onDone);
    } catch (err) {
      showToast('Error al guardar', 'error');
      continueBtn.disabled = false;
      continueBtn.innerHTML = '<span>Continuar</span><span class="welcome-btn-arrow">→</span>';
    }
  }

  let isClosing = false;
  function close(onClose) {
    if (isClosing) return;
    isClosing = true;
    overlay.style.animation = 'fade-out 0.35s ease forwards';
    document.body.style.overflow = '';
    setTimeout(() => {
      if (overlay.isConnected) overlay.remove();
      if (onClose) onClose();
      window.dispatchEvent(new CustomEvent('ph:mood-welcome-done'));
    }, 350);
  }

  continueBtn.addEventListener('click', handleContinue);

  // «Más tarde»: cierra sin registrar ánimo. Vuelve a salir en la próxima entrada.
  overlay.querySelector('#welcomeLaterBtn').addEventListener('click', () => close(onDone));

  return overlay;
}

// Tiny inline HTML escaper (avoid circular import)
function escapeAttr(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
