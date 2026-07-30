/* ==========================================
   Personal Hub v2 — Welcome Screen (Mood Check-in)
   Solo para la usuaria (no admin): "¿Cómo te sientes ahora mismo princesa?"
   ========================================== */

import { moodStore } from '../stores/mood.store.js';
import { userStore } from '../stores/user.store.js';
import { showToast } from '../components/Toast.js';

export function WelcomeScreen({ onDone, onSkip } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'welcome-overlay';
  overlay.innerHTML = `
    <div class="welcome-modal">
      <div class="welcome-bg"></div>
      <div class="welcome-content">
        <div class="welcome-greeting">
          <div class="welcome-time-icon">
            <span class="welcome-icon-inner">☀️</span>
          </div>
          <h1 class="welcome-title">
            <span id="welcomeGreeting"></span>,<br>
            <span class="welcome-name" id="welcomeName">princesa</span>
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
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Prevent body scroll
  document.body.style.overflow = 'hidden';

  const moodsContainer = overlay.querySelector('#welcomeMoods');
  const continueBtn = overlay.querySelector('#welcomeContinueBtn');
  const skipBtn = overlay.querySelector('#welcomeSkipBtn');
  const nameEl = overlay.querySelector('#welcomeName');
  const greetingEl = overlay.querySelector('#welcomeGreeting');

  const user = userStore.getUser();
  if (user?.name) nameEl.textContent = user.name.split(' ')[0];

  // Set greeting based on time
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) greetingEl.textContent = 'Buenos días';
  else if (hour >= 12 && hour < 18) greetingEl.textContent = 'Buenas tardes';
  else if (hour >= 18 && hour < 22) greetingEl.textContent = 'Buenas noches';
  else greetingEl.textContent = 'Buenas noches';

  let selectedMood = null;

  // Render mood options
  const moods = moodStore.getMoods();
  moodsContainer.innerHTML = moods.map((mood, i) => `
    <button type="button" class="mood-btn" data-mood="${mood.id}" style="animation-delay: ${200 + i * 90}ms">
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
    overlay.style.animation = 'fade-out 0.3s ease forwards';
    document.body.style.overflow = '';
    setTimeout(() => overlay.remove(), 300);
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
