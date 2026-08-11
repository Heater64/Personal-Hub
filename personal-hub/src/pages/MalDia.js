/* ==========================================
   Personal Hub v2 — Mal Día Page
   Consuelo, frases, recuerdos y apoyo
   ========================================== */

import { showToast } from '../components/Toast.js';
import { db } from '../services/db.service.js';
import { onContentChange } from '../services/realtime.service.js';
import { userPrefKey } from '../utils/userStorage.js';

const PHRASES = [
  "Respira. No tienes que arreglarlo todo ahora mismo. Primero: agua, aire y un abrazo.",
  "Estás aquí, y eso ya es suficiente. Un día más, un paso más. Yo te veo, y eres increíble.",
  "No necesitas demostrar nada a nadie. Solo a ti misma. Y si puedes, sonreír un poquito.",
  "Eres más fuerte de lo que crees, más bonita de lo que piensas y más querida de lo que imaginas.",
  "Hoy puede que no sea fácil, pero mañana será otro día. Yo seguiré estando aquí para ti.",
  "Tu misión ahora: beber agua, respirar hondo y recordar que te quiero muchísimo.",
  "No tienes que poder con todo. Permítete descansar. Yo te apaño el resto.",
  "Eres mi persona favorita en este planeta. No lo olvides.",
  "Aunque hoy sea gris, recuerda que los días bonitos también existen y volverán.",
  "Tómate un minuto para ti. Cierra los ojos. Respira. Yo cuido de ti.",
  "Eres única, especial e irrepetible. No hay nadie como tú.",
  "Eres como una flor que florece incluso en invierno.",
  "Eres el mejor descubrimiento de mi vida.",
  "Incluso sin saberlo, haces mi mundo más bonito.",
];

// Ciclo de respiración: 4 fases con duración (ms) y escala del círculo
const BREATH_PHASES = [
  { key: 'inhale', label: 'Inhala',  dur: 4000, from: 1,    to: 1.35 },
  { key: 'hold',   label: 'Mantén',  dur: 4000, from: 1.35, to: 1.35 },
  { key: 'exhale', label: 'Exhala',  dur: 4000, from: 1.35, to: 1 },
  { key: 'rest',   label: 'Descansa', dur: 5000, from: 1,    to: 1 }
];

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const ICONS = {
  cloudRain: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/><path d="M8 19h1"/><path d="M16 19h1"/><path d="M12 19h1"/></svg>',
  heart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  heartFill: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  send: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
  wave: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12h1"/><path d="M7 8v8"/><path d="M11 5v14"/><path d="M15 8v8"/><path d="M19 10v4"/><path d="M22 12h-1"/></svg>',
  play: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
  pause: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
  volume2: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
  volume1: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
  volumeX: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
  chevronLeft: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  chevronRight: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
  chevronDown: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  // Help cards — iconos SVG (estilo lucide, sin emojis)
  musicNote: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  image: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  pencil: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  lungs: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6.12 12.32a2.5 2.5 0 0 1 .54-4.7L9 7"/><path d="M12 12.5V9"/><path d="M12 12.5v7a2 2 0 0 0 4 0v-6a2 2 0 0 0-2-2h-2z"/><path d="M12 12.5v7a2 2 0 0 1-4 0v-6a2 2 0 0 1 2-2h2z"/><path d="M17.88 12.32a2.5 2.5 0 0 0-.54-4.7L15 7"/></svg>',
  walk: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4a2 2 0 1 0-4 0 2 2 0 0 0 4 0z"/><path d="M9.5 8 6 12l3 1 1-3 2 1 2-2-1.5-1.5-3-1z"/><path d="M6 12l-2 4 3 1 1-3"/><path d="m11 11 1.5 3.5L15 18"/></svg>'
};

export function MalDiaPage(router) {
  const page = document.createElement('div');
  page.className = 'maldia-page';

  // Frases gestionables desde el Admin (tab Mal Día) con fallback a las estáticas
  let frases = PHRASES.slice();
  let phraseIdx = 0;            // frase visible actualmente
  let favPhrases = new Set();   // frases favoritas (texto, user-scoped)
  let isMusicPlaying = false;
  let audioPlayer = null;
  let breathingInterval = null;
  let breathingRunning = false;
  let onKeyDown = null;

  // Favoritas, por usuario
  try { favPhrases = new Set(JSON.parse(localStorage.getItem(userPrefKey('maldiaFavs')) || '[]')); } catch { /* vacío */ }

  const offContent = onContentChange(['maldia_frases'], loadAdminContent);

  page.cleanup = () => {
    offContent();
    if (onKeyDown) document.removeEventListener('keydown', onKeyDown);
    if (breathingInterval) { clearInterval(breathingInterval); breathingInterval = null; }
    if (audioPlayer) { audioPlayer.pause(); audioPlayer = null; }
    document.getElementById('betterVideo')?.pause();
    document.body.style.overflow = '';
  };

  function persistFavs() {
    try { localStorage.setItem(userPrefKey('maldiaFavs'), JSON.stringify([...favPhrases])); } catch { /* quota */ }
  }

  // Una frase a la vez, con navegación ‹ › y corazón de favorita
  function quoteCardHTML() {
    if (!frases.length) return '<p class="maldia-quote-empty">Aún no hay frases 🤍</p>';
    const frase = frases[phraseIdx] || frases[0];
    const fav = favPhrases.has(frase);
    const single = frases.length === 1;
    return `
      <div class="maldia-quote-card">
        <span class="maldia-quote-mark">❝</span>
        <div class="maldia-quote-row">
          <button class="maldia-quote-arrow" id="quotePrev" aria-label="Frase anterior" ${single ? 'disabled' : ''}>${ICONS.chevronLeft}</button>
          <p class="maldia-quote-text">${escapeHtml(frase)}</p>
          <button class="maldia-quote-arrow" id="quoteNext" aria-label="Frase siguiente" ${single ? 'disabled' : ''}>${ICONS.chevronRight}</button>
        </div>
        <div class="maldia-quote-footer">
          <span class="maldia-quote-count">${phraseIdx + 1} / ${frases.length}</span>
          <button class="maldia-quote-fav${fav ? ' is-fav' : ''}" data-quote-fav="${phraseIdx}" aria-label="${fav ? 'Quitar de favoritas' : 'Guardar frase'}" aria-pressed="${fav}">
            ${fav ? ICONS.heartFill : ICONS.heart}
          </button>
        </div>
      </div>`;
  }

  function renderQuoteCard() {
    const card = page.querySelector('#quoteCard');
    if (card) card.innerHTML = quoteCardHTML();
    bindQuoteNav();
  }

  function bindQuoteNav() {
    const prev = page.querySelector('#quotePrev');
    const next = page.querySelector('#quoteNext');
    prev?.addEventListener('click', () => {
      phraseIdx = (phraseIdx - 1 + frases.length) % frases.length;
      renderQuoteCard();
    });
    next?.addEventListener('click', () => {
      phraseIdx = (phraseIdx + 1) % frases.length;
      renderQuoteCard();
    });
  }

  function render() {
    page.innerHTML = `
      <div class="maldia-container">

        <!-- Topbar -->
        <div class="maldia-topbar">
          <nav class="maldia-breadcrumb" aria-label="Ruta de navegación">
            <button class="maldia-breadcrumb-item" data-back>Sentimientos</button>
            <span class="maldia-breadcrumb-sep">/</span>
            <span class="maldia-breadcrumb-current">Mal Día</span>
          </nav>
          <button class="maldia-back-btn" data-back>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            Volver
          </button>
        </div>

        <!-- Hero -->
        <section class="maldia-hero">
          <div class="maldia-hero-sky" aria-hidden="true">
            <span class="maldia-hero-sun"></span>
            <span class="maldia-hero-cloud cloud-a"></span>
            <span class="maldia-hero-cloud cloud-b"></span>
            <span class="maldia-hero-cloud cloud-c"></span>
          </div>
          <div class="maldia-hero-heart" aria-hidden="true">${ICONS.heart}</div>
          <div class="maldia-hero-content">
            <span class="maldia-hero-rain">${ICONS.cloudRain}</span>
            <h1>Mal día</h1>
            <p>No estás sola. Respira, tómate un momento y recuerda que te amo.</p>
          </div>
        </section>

        <!-- Música feliz -->
        <div class="maldia-music-player">
          <span class="maldia-music-icon">${ICONS.wave}</span>
          <div class="maldia-music-wave" id="musicWave">${'<div class="maldia-wave-bar"></div>'.repeat(6)}</div>
          <span class="maldia-music-label" id="musicLabel">Música feliz</span>
          <div class="maldia-music-controls">
            <input type="range" class="maldia-music-vol" id="musicVolRange" min="0" max="100" step="1" value="100" aria-label="Volumen" title="Volumen">
            <button class="maldia-music-ctrl" id="musicVolBtn" aria-label="Volumen 100%" title="Volumen">${ICONS.volume2}</button>
            <button class="maldia-music-ctrl play" id="musicPlayBtn" aria-label="Reproducir música" aria-pressed="false">${ICONS.play}</button>
          </div>
          <audio id="happyAudio" preload="none" loop>
            <source src="https://res.cloudinary.com/dcsent4fs/video/upload/v1777746763/Zzoilo_Aitana_-_Mon_Amour_Remix_Letra_Lyrics_jrgcjv.m4a" type="audio/mpeg">
          </audio>
        </div>

        <!-- Frases -->
        <section class="maldia-section">
          <header class="maldia-section-head">
            <h2>🤍 Frases que podrían ayudarte</h2>
            <p class="maldia-section-sub">Todo va a estar bien 💖</p>
          </header>
          <div id="quoteCard">${quoteCardHTML()}</div>
          <div class="maldia-actions">
            <button class="maldia-action-btn" id="particlesBtn">☺ Algo bonito</button>
            <button class="maldia-action-btn" id="betterBtn">🤍 Me siento mejor</button>
          </div>
        </section>

        <!-- Nota para mí -->
        <section class="maldia-section">
          <header class="maldia-section-head">
            <h2>💌 Déjame una nota</h2>
          </header>
          <div class="maldia-msg-row">
            <input class="maldia-msg-input" id="msgInput" type="text" maxlength="300"
              placeholder="Escríbeme lo que sientas, llegará directo a mí..." aria-label="Escribe una nota para mí" />
            <button class="maldia-msg-send" id="msgSendBtn" aria-label="Enviar nota">${ICONS.send}</button>
          </div>
          <p class="maldia-msg-sent" id="msgSent" hidden>
            <span class="maldia-msg-sent-icon">💌</span>
            <span id="msgSentText">Nota enviada. Llegará directo a mí 🤍</span>
          </p>
        </section>

        <!-- Cosas que pueden ayudarte ahora -->
        <section class="maldia-section">
          <header class="maldia-section-head maldia-help-head">
            <h2>✨ Cosas que pueden ayudarte ahora</h2>
            <span class="maldia-help-cheer">Lo harás genial! ✨</span>
          </header>
          <div class="maldia-help-grid">
            <button class="maldia-help-card" data-help="music">
              <span class="maldia-help-icon">${ICONS.musicNote}</span>
              <strong>Escuchar música</strong>
              <small>Tu playlist feliz</small>
            </button>
            <button class="maldia-help-card" data-help="recuerdos">
              <span class="maldia-help-icon">${ICONS.image}</span>
              <strong>Ver recuerdos</strong>
              <small>La galería</small>
            </button>
            <button class="maldia-help-card" data-help="escribir">
              <span class="maldia-help-icon">${ICONS.pencil}</span>
              <strong>Escribir</strong>
              <small>Saca lo que sientes</small>
            </button>
            <button class="maldia-help-card" data-help="respirar">
              <span class="maldia-help-icon">${ICONS.lungs}</span>
              <strong>Respiración guiada</strong>
              <small>Relájate</small>
            </button>
            <button class="maldia-help-card" data-help="paseo">
              <span class="maldia-help-icon">${ICONS.walk}</span>
              <strong>Dar un paseo</strong>
              <small>A despejar la mente</small>
            </button>
          </div>
        </section>

        <!-- Respiración guiada (desplegable) -->
        <section class="maldia-section" id="maldiaBreathing">
          <button class="maldia-breathe-toggle-head" id="breatheHeadBtn" aria-expanded="false" aria-controls="breatheBody">
            <span class="maldia-breathe-head-left">
              <span class="maldia-help-icon">${ICONS.lungs}</span>
              <span>
                <strong>Respiración guiada</strong>
                <small>Tómate un momento para ti</small>
              </span>
            </span>
            <span class="maldia-breathe-head-chevron" id="breatheChevron">${ICONS.chevronDown}</span>
          </button>
          <div class="maldia-breathe-body" id="breatheBody" hidden>
            <div class="maldia-breathe-left">
              <h3>Tómate un momento para ti</h3>
              <p>Sigue el ritmo y respira profundamente</p>
              <div class="maldia-breathe-circle-wrap">
                <svg class="maldia-breathe-ring" viewBox="0 0 140 140" aria-hidden="true">
                  <circle class="maldia-breathe-ring-bg" cx="70" cy="70" r="64"/>
                  <circle class="maldia-breathe-ring-fg" id="breatheRing" cx="70" cy="70" r="64"/>
                </svg>
                <div class="maldia-breathe-circle" id="breatheCircle">
                  <span class="maldia-breathe-phase" id="breathePhase">Inhala</span>
                  <span class="maldia-breathe-timer" id="breatheTimer">4s</span>
                </div>
              </div>
              <button class="maldia-breathe-toggle" id="breatheToggle">
                ${ICONS.play}
                <span id="breatheToggleLabel">Comenzar</span>
              </button>
            </div>
            <ol class="maldia-breathe-steps">
              ${BREATH_PHASES.map((ph, i) => `
                <li data-phase="${ph.key}" class="${i === 0 ? 'active' : ''}">
                  <span class="maldia-breathe-step-num">${i + 1}</span>
                  ${ph.label}
                </li>`).join('')}
            </ol>
          </div>
        </section>
      </div>

      <!-- Better Modal (gatito) -->
      <div class="maldia-modal" id="betterModal" style="display:none;">
        <div class="maldia-modal-content better-content">
          <button class="maldia-modal-close" id="closeBetterModal" aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <div class="maldia-better-video">
            <video id="betterVideo" autoplay loop muted playsinline>
              <source src="https://res.cloudinary.com/dcsent4fs/video/upload/v1777134957/gatito_isgr4b.mp4" type="video/mp4">
            </video>
          </div>
          <div class="maldia-better-message">
            <h2>¡Te quiero!</h2>
            <p>Siempre estaré aquí para ti mi reina 🤍</p>
          </div>
        </div>
      </div>
    `;
  }

  render();
  bindQuoteNav();

  // Carga frases gestionadas desde el Admin (fallback silencioso a las
  // estáticas). También se invoca en tiempo real cuando el Admin las edita.
  async function loadAdminContent() {
    const [f] = await Promise.allSettled([db.getMaldiaFrases()]);
    const frasesAdmin = (f.value || []).filter(x => typeof x === 'string' && x.trim());
    if (frasesAdmin.length) {
      frases = frasesAdmin;
      if (phraseIdx >= frases.length) phraseIdx = 0;
      renderQuoteCard();
    }
  }

  loadAdminContent();

  requestAnimationFrame(() => {
    audioPlayer = document.getElementById('happyAudio');

    // Volver
    page.querySelectorAll('[data-back]').forEach(btn =>
      btn.addEventListener('click', () => router.navigate('/sentimientos')));

    // Favoritas de frases
    page.addEventListener('click', (e) => {
      const favBtn = e.target.closest('[data-quote-fav]');
      if (!favBtn) return;
      const i = parseInt(favBtn.dataset.quoteFav, 10);
      const frase = frases[i];
      if (!frase) return;
      if (favPhrases.has(frase)) favPhrases.delete(frase);
      else favPhrases.add(frase);
      persistFavs();
      favBtn.classList.toggle('is-fav', favPhrases.has(frase));
      favBtn.setAttribute('aria-pressed', String(favPhrases.has(frase)));
      favBtn.innerHTML = favPhrases.has(frase) ? ICONS.heartFill : ICONS.heart;
      showToast(favPhrases.has(frase) ? 'Frase guardada 💖' : 'Frase quitada de favoritas', 'info');
    });

    // Algo bonito
    document.getElementById('particlesBtn')?.addEventListener('click', () => {
      showToast('Te quiero mucho princesa', 'info');
    });

    // Música: play/pausa + volumen (botón y deslizador)
    const playBtn = document.getElementById('musicPlayBtn');
    const volBtn = document.getElementById('musicVolBtn');
    const volRange = document.getElementById('musicVolRange');
    const VOL_STEPS = [1, 0.66, 0.33, 0];
    let volIdx = 0;
    let volume = 1; // volumen actual (0..1)

    function setVolume(v) {
      volume = Math.min(1, Math.max(0, v));
      if (audioPlayer) audioPlayer.volume = volume;
      if (volRange) volRange.value = String(Math.round(volume * 100));
      const pct = Math.round(volume * 100);
      volRange?.style.setProperty('--vol-fill', `${pct}%`);
      volBtn.innerHTML = volume === 0 ? ICONS.volumeX : (volume < 1 ? ICONS.volume1 : ICONS.volume2);
      volBtn.setAttribute('aria-label', volume === 0 ? 'Activar volumen' : `Volumen ${pct}%`);
      volBtn.title = volume === 0 ? 'Volumen silenciado' : `Volumen ${pct}%`;
    }

    function togglePlay() {
      if (!audioPlayer) return;
      if (isMusicPlaying) {
        audioPlayer.pause();
        isMusicPlaying = false;
        document.getElementById('musicWave')?.classList.remove('playing');
        document.getElementById('musicLabel').textContent = 'Pausada';
        playBtn.innerHTML = ICONS.play;
      } else {
        audioPlayer.volume = volume;
        audioPlayer.play().catch(() => {});
        isMusicPlaying = true;
        document.getElementById('musicWave')?.classList.add('playing');
        document.getElementById('musicLabel').textContent = 'Sonando';
        playBtn.innerHTML = ICONS.pause;
      }
      playBtn.setAttribute('aria-pressed', String(isMusicPlaying));
      playBtn.setAttribute('aria-label', isMusicPlaying ? 'Pausar música' : 'Reproducir música');
    }

    playBtn?.addEventListener('click', togglePlay);
    volBtn?.addEventListener('click', () => {
      volIdx = (volIdx + 1) % VOL_STEPS.length;
      setVolume(VOL_STEPS[volIdx]);
    });
    volRange?.addEventListener('input', () => {
      setVolume((parseInt(volRange.value, 10) || 0) / 100);
    });

    // Nota para mí (llega al Admin)
    const msgInput = document.getElementById('msgInput');
    const msgSent = document.getElementById('msgSent');
    const sendMsg = async () => {
      const value = (msgInput?.value || '').trim();
      if (!value) { showToast('Escribe una nota antes de enviar 🤍', 'info'); return; }
      try {
        await db.saveMaldiaNote(value);
      } catch (err) {
        showToast(err?.message || 'No se pudo enviar la nota', 'error');
        return;
      }
      if (msgInput) msgInput.value = '';
      if (msgSent) {
        msgSent.hidden = false;
        msgSent.style.animation = 'none';
        void msgSent.offsetWidth; // reinicia la animación
        msgSent.style.animation = '';
      }
      showToast('Nota enviada 💌 Llegará directo a mí', 'success');
    };
    document.getElementById('msgSendBtn')?.addEventListener('click', sendMsg);
    msgInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMsg(); });

    // Me siento mejor (gatito)
    const betterModal = document.getElementById('betterModal');
    const closeBetter = () => {
      betterModal.style.display = 'none';
      const video = document.getElementById('betterVideo');
      if (video) video.pause();
    };
    document.getElementById('betterBtn')?.addEventListener('click', () => {
      betterModal.style.display = 'flex';
      const video = document.getElementById('betterVideo');
      if (video) { video.currentTime = 0; video.play().catch(() => {}); }
    });
    document.getElementById('closeBetterModal')?.addEventListener('click', closeBetter);
    betterModal?.addEventListener('click', (e) => {
      if (e.target === betterModal) closeBetter();
    });

    // ==========================================
    // COSAS QUE PUEDEN AYUDARTE AHORA
    // ==========================================
    const breathingEl = document.getElementById('maldiaBreathing');
    page.querySelectorAll('[data-help]').forEach(card => {
      card.addEventListener('click', () => {
        const action = card.dataset.help;
        if (action === 'music') {
          router.navigate('/canciones');
        } else if (action === 'recuerdos') {
          router.navigate('/galeria');
        } else if (action === 'escribir') {
          const inp = document.getElementById('msgInput');
          inp?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          inp?.focus();
        } else if (action === 'respirar') {
          openBreathing();
          breathingEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          startBreathing();
        } else if (action === 'paseo') {
          showToast('Sal a dar un paseo 🌤️ El aire te sentará genial', 'info');
        }
      });
    });

    // ==========================================
    // RESPIRACIÓN GUIADA — 4 fases inline
    // ==========================================
    const ringFg = document.getElementById('breatheRing');
    const circle = document.getElementById('breatheCircle');
    const phaseEl = document.getElementById('breathePhase');
    const timerEl = document.getElementById('breatheTimer');
    const toggleBtn = document.getElementById('breatheToggle');
    const toggleLabel = document.getElementById('breatheToggleLabel');
    const breatheHeadBtn = document.getElementById('breatheHeadBtn');
    const breatheBody = document.getElementById('breatheBody');
    const breatheChevron = document.getElementById('breatheChevron');
    const RING_C = 2 * Math.PI * 64;

    function openBreathing() {
      if (!breatheBody || breatheBody.hidden === false) return;
      breatheBody.hidden = false;
      breatheHeadBtn?.setAttribute('aria-expanded', 'true');
      breatheChevron?.classList.add('open');
    }

    function toggleBreathing() {
      if (!breatheBody) return;
      const willOpen = breatheBody.hidden;
      breatheBody.hidden = !willOpen;
      breatheHeadBtn?.setAttribute('aria-expanded', String(willOpen));
      breatheChevron?.classList.toggle('open', willOpen);
    }

    breatheHeadBtn?.addEventListener('click', toggleBreathing);

    function setRing(progress) {
      if (ringFg) ringFg.style.strokeDashoffset = String(RING_C * (1 - Math.min(1, Math.max(0, progress))));
    }
    setRing(0);

    function setPhaseUI(key, progress, secondsLeft) {
      const ph = BREATH_PHASES.find(p => p.key === key) || BREATH_PHASES[0];
      if (phaseEl) phaseEl.textContent = ph.label;
      if (timerEl) timerEl.textContent = `${secondsLeft}s`;
      if (circle) {
        const scale = ph.from + (ph.to - ph.from) * Math.min(1, Math.max(0, progress));
        circle.style.transform = `scale(${scale})`;
      }
      page.querySelectorAll('.maldia-breathe-steps li').forEach(li =>
        li.classList.toggle('active', li.dataset.phase === key));
      setRing(progress);
    }

    function startBreathing() {
      if (breathingRunning) return;
      breathingRunning = true;
      if (toggleLabel) toggleLabel.textContent = 'Detener';
      let phaseIdx = 0;
      let phaseElapsed = 0;
      let lastNow = performance.now();
      const tick = () => {
        if (!breathingRunning) return;
        const now = performance.now();
        const delta = Math.min(now - lastNow, 500); // salto máximo 0.5s (pestaña en segundo plano)
        lastNow = now;
        const ph = BREATH_PHASES[phaseIdx];
        phaseElapsed += delta;
        if (phaseElapsed >= ph.dur) {
          phaseElapsed -= ph.dur;
          phaseIdx = (phaseIdx + 1) % BREATH_PHASES.length;
        }
        const phNow = BREATH_PHASES[phaseIdx];
        const progress = phaseElapsed / phNow.dur;
        const secondsLeft = Math.max(1, Math.ceil((phNow.dur - phaseElapsed) / 1000));
        setPhaseUI(phNow.key, progress, secondsLeft);
      };
      tick();
      breathingInterval = setInterval(tick, 100);
    }

    function stopBreathing() {
      breathingRunning = false;
      if (breathingInterval) { clearInterval(breathingInterval); breathingInterval = null; }
      if (toggleLabel) toggleLabel.textContent = 'Comenzar';
      if (phaseEl) phaseEl.textContent = 'Inhala';
      if (timerEl) timerEl.textContent = '4s';
      if (circle) circle.style.transform = 'scale(1)';
      setRing(0);
      page.querySelectorAll('.maldia-breathe-steps li').forEach(li =>
        li.classList.toggle('active', li.dataset.phase === 'inhale'));
    }

    toggleBtn?.addEventListener('click', () => {
      if (breathingRunning) stopBreathing();
      else startBreathing();
    });

    // ESC
    onKeyDown = (e) => {
      if (e.key === 'Escape') {
        stopBreathing();
        betterModal.style.display = 'none';
        const video = document.getElementById('betterVideo');
        if (video) video.pause();
      }
    };
    document.addEventListener('keydown', onKeyDown);
  });

  return page;
}
