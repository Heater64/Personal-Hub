/* ==========================================
   Personal Hub v2 — Welcome Screen (Mood Check-in)
   Panel de bienvenida completo con estado de ánimo diario.
   Solo para la usuaria (no admin): saludo personalizado
   según la hora del día con el nombre real del perfil.
   ========================================== */

import { moodStore } from '../stores/mood.store.js';
import { userStore } from '../stores/user.store.js';
import { showToast } from '../components/Toast.js';
import { hourInSpain } from '../utils/format.js';
import { daysSinceAnniversary, loadSpecialDates } from '../utils/specialDates.js';

export function WelcomeScreen({ onDone, onSkip } = {}) {
  const user = userStore.getUser();
  const userName = user?.name || 'princesa';
  const daysSince = daysSinceAnniversary();

  const overlay = document.createElement('div');
  overlay.className = 'welcome-overlay';
  overlay.setAttribute('role', 'dialog');
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

        <div class="welcome-moods" id="welcomeMoods"></div>

        <div class="welcome-cta">
          <button type="button" class="welcome-btn" id="welcomeContinueBtn" disabled>
            <span>Continuar</span>
            <span class="welcome-btn-arrow">→</span>
          </button>
        </div>

        <button type="button" class="welcome-skip" id="welcomeSkipBtn">
          Pregúntame luego
        </button>

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
  const continueBtn = overlay.querySelector('#welcomeContinueBtn');
  const skipBtn = overlay.querySelector('#welcomeSkipBtn');
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

  let selectedMood = null;

  // Render mood options
  const moods = moodStore.getMoods();
  moodsContainer.innerHTML = moods.map((mood, i) => `
    <button type="button" class="mood-btn" data-mood="${mood.id}" style="animation-delay: ${150 + i * 80}ms">
      <span class="mood-btn__emoji">${mood.emoji}</span>
      <div class="mood-btn__text">
        <span class="mood-btn__label">${mood.label}</span>
      </div>
      <span class="mood-btn__check">✓</span>
    </button>
  `).join('');

  // Bind mood selection
  moodsContainer.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      moodsContainer.querySelectorAll('.mood-btn').forEach(b => {
        b.classList.remove('selected');
      });
      btn.classList.add('selected');
      selectedMood = btn.dataset.mood;
      continueBtn.disabled = false;
      continueBtn.classList.add('ready');

      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate(15);
    });
  });

  // Continue
  async function handleContinue() {
    if (!selectedMood) return;
    continueBtn.disabled = true;
    continueBtn.innerHTML = '<span>Guardando...</span>';

    try {
      await moodStore.saveMood(selectedMood);
      showToast('💖 ¡Gracias por compartir cómo te sientes!', 'success');
      close();
      if (onDone) onDone();
    } catch (err) {
      showToast('Error al guardar', 'error');
      continueBtn.disabled = false;
      continueBtn.innerHTML = '<span>Continuar</span><span class="welcome-btn-arrow">→</span>';
    }
  }

  function close() {
    overlay.style.animation = 'fade-out 0.35s ease forwards';
    document.body.style.overflow = '';
    setTimeout(() => {
      if (overlay.isConnected) overlay.remove();
    }, 350);
  }

  continueBtn.addEventListener('click', handleContinue);
  skipBtn.addEventListener('click', () => {
    // Mark as seen for today so the welcome screen doesn't reappear
    // until the next scheduled check (tomorrow at 8:00 AM).
    moodStore.markSeen();
    close();
    if (onSkip) onSkip();
  });

  return overlay;
}

// Tiny inline HTML escaper (avoid circular import)
function escapeAttr(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
