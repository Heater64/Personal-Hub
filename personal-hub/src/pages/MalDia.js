/* ==========================================
   Personal Hub v2 — Mal Día Page
   Consuelo, frases, recuerdos y apoyo
   ========================================== */

import { showToast } from '../components/Toast.js';

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

const MEMORIES = [
  { image: "https://res.cloudinary.com/dcsent4fs/image/upload/q_auto,f_auto,w_800/v1777747760/5199564237372592635_eqj9v5.jpg", caption: "Siempre tan linda" },
  { image: "https://res.cloudinary.com/dcsent4fs/image/upload/v1782766240/5913325400387948133_1_t6a24g.jpg", caption: "Piscina con mi princesa" },
  { image: "https://res.cloudinary.com/dcsent4fs/image/upload/v1782766239/5913325400387948134_efteqk.jpg", caption: "Comprando papitash jsjs" },
  { image: "https://res.cloudinary.com/dcsent4fs/image/upload/v1782766239/5913325400387948135_diq97c.jpg", caption: "Que hermosa que eres" },
  { image: "https://res.cloudinary.com/dcsent4fs/image/upload/v1782766238/5913325400387948138_ryirj6.jpg", caption: "Batooon" },
  { image: "https://res.cloudinary.com/dcsent4fs/image/upload/v1782766238/5913325400387948137_i6fcp2.jpg", caption: "Que preciosidad" },
  { image: "https://res.cloudinary.com/dcsent4fs/image/upload/v1782766238/5913325400387948139_qdgn0l.jpg", caption: "Que ojazos tiene mi princesa" },
  { image: "https://res.cloudinary.com/dcsent4fs/image/upload/v1782766238/6046582610491806111_mx6qc3.jpg", caption: "Yo también te amo miniñaaaaaaaaaa" },
  { image: "https://res.cloudinary.com/dcsent4fs/image/upload/v1783252673/5931306366871997939_mpvodw.jpg", caption: "Jijijiji si somosh" },
];

export function MalDiaPage(router) {
  const page = document.createElement('div');
  page.className = 'maldia-page';

  let currentPhrase = Math.floor(Math.random() * PHRASES.length);
  let currentMemory = 0;
  let isMusicPlaying = false;
  let audioPlayer = null;
  let breathingInterval = null;

  function render() {
    page.innerHTML = `
      <div class="maldia-container">
        <div class="maldia-header">
          <div class="maldia-header-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
          </div>
          <h1>¿Día gris?</h1>
          <p>No estás sola. Respira, tómate un momento y recuerda que te amo.</p>
        </div>

        <!-- Hero card -->
        <div class="card maldia-hero-card glass-card">
          <div class="maldia-hero-glow"></div>
          <div class="maldia-heart-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
          </div>
          <h2>Frases que pueden ayudarte</h2>
          <div class="maldia-message-wrapper">
            <p class="maldia-message" id="heroMessage">${PHRASES[currentPhrase]}</p>
          </div>
          <div class="maldia-actions">
            <button class="maldia-action-btn" id="newPhraseBtn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18"/><path d="M3 12h18"/></svg>
              <span>Frase nueva</span>
            </button>
            <button class="maldia-action-btn" id="particlesBtn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
              <span>Algo bonito</span>
            </button>
            <button class="maldia-action-btn primary" id="betterBtn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
              <span>Me siento mejor</span>
            </button>
          </div>
          <div class="maldia-music-player">
            <div class="maldia-music-wave" id="musicWave">
              ${'<div class="maldia-wave-bar"></div>'.repeat(6)}
            </div>
            <span class="maldia-music-label" id="musicLabel">Música feliz</span>
            <button class="maldia-music-toggle" id="musicBtn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            </button>
            <audio id="happyAudio" preload="none" loop>
              <source src="https://res.cloudinary.com/dcsent4fs/video/upload/v1777746763/Zzoilo_Aitana_-_Mon_Amour_Remix_Letra_Lyrics_jrgcjv.m4a" type="audio/mpeg">
            </audio>
          </div>
        </div>

        <!-- Memories card -->
        <div class="maldia-memories-card glass-card">
          <div class="maldia-memories-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <h3>Mensaje para ti</h3>
          </div>
          <div class="maldia-daily-message" id="dailyMessage">"Eres más fuerte de lo que crees, más bonita de lo que piensas y más querida de lo que imaginas."</div>
          <div class="maldia-memory-section">
            <div class="maldia-memory-frame">
              <img id="memoryImage" class="maldia-memory-image" src="${MEMORIES[0].image}" alt="Recuerdo especial">
            </div>
            <p class="maldia-memory-caption" id="memoryCaption">${MEMORIES[0].caption}</p>
            <button class="maldia-mini-btn" id="changeMemoryBtn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              <span>Cambiar recuerdo</span>
            </button>
          </div>
        </div>

        <!-- Breathing -->
        <div class="maldia-breathing-section">
          <button class="maldia-breathing-btn" id="breathingBtn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4v16h16"/><path d="m7 11 3-3 2 2 4-4 1 1"/></svg>
            <span>Respiración guiada</span>
          </button>
        </div>
      </div>

      <!-- Breathing Modal -->
      <div class="maldia-modal" id="breathingModal" style="display:none;">
        <div class="maldia-modal-content">
          <button class="maldia-modal-close" id="closeBreathingModal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <div class="maldia-breathing-circle" id="breathingCircle">
            <div class="maldia-breathing-text" id="breathingText">Inhala</div>
          </div>
          <p class="maldia-breathing-instruction">Sigue el ritmo del círculo</p>
          <button class="maldia-stop-btn" id="stopBreathingBtn">Detener</button>
        </div>
      </div>

      <!-- Better Modal (cat video) -->
      <div class="maldia-modal" id="betterModal" style="display:none;">
        <div class="maldia-modal-content better-content">
          <button class="maldia-modal-close" id="closeBetterModal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <div class="maldia-better-video">
            <video id="betterVideo" autoplay loop muted playsinline>
              <source src="https://res.cloudinary.com/dcsent4fs/video/upload/v1777134957/gatito_isgr4b.mp4" type="video/mp4">
            </video>
          </div>
          <div class="maldia-better-message">
            <h2>¡Te quiero!</h2>
            <p>Siempre estaré aquí para ti mi reina</p>
          </div>
        </div>
      </div>
    `;
  }

  render();

  requestAnimationFrame(() => {
    audioPlayer = document.getElementById('happyAudio');

    // New phrase
    document.getElementById('newPhraseBtn')?.addEventListener('click', () => {
      const msg = document.getElementById('heroMessage');
      if (msg) {
        let idx;
        do { idx = Math.floor(Math.random() * PHRASES.length); } while (idx === currentPhrase);
        currentPhrase = idx;
        msg.style.opacity = '0';
        msg.textContent = PHRASES[idx];
        requestAnimationFrame(() => { msg.style.transition = 'opacity 0.3s'; msg.style.opacity = '1'; });
      }
    });

    // Particles / something nice
    document.getElementById('particlesBtn')?.addEventListener('click', () => {
      showToast('Te quiero mucho princesa', 'info');
    });

    // Music
    document.getElementById('musicBtn')?.addEventListener('click', () => {
      if (!audioPlayer) return;
      if (isMusicPlaying) {
        audioPlayer.pause();
        isMusicPlaying = false;
        document.getElementById('musicWave')?.classList.remove('playing');
        document.getElementById('musicLabel').textContent = 'Pausada';
      } else {
        audioPlayer.play().catch(() => {});
        isMusicPlaying = true;
        document.getElementById('musicWave')?.classList.add('playing');
        document.getElementById('musicLabel').textContent = 'Sonando';
      }
    });

    // Better button (cat video)
    const betterModal = document.getElementById('betterModal');
    document.getElementById('betterBtn')?.addEventListener('click', () => {
      betterModal.style.display = 'flex';
      const video = document.getElementById('betterVideo');
      if (video) { video.currentTime = 0; video.play().catch(() => {}); }
    });
    document.getElementById('closeBetterModal')?.addEventListener('click', () => {
      betterModal.style.display = 'none';
      const video = document.getElementById('betterVideo');
      if (video) video.pause();
    });
    betterModal?.addEventListener('click', (e) => {
      if (e.target === betterModal) {
        betterModal.style.display = 'none';
        const video = document.getElementById('betterVideo');
        if (video) video.pause();
      }
    });

    // Change memory
    document.getElementById('changeMemoryBtn')?.addEventListener('click', () => {
      currentMemory = (currentMemory + 1) % MEMORIES.length;
      const img = document.getElementById('memoryImage');
      const cap = document.getElementById('memoryCaption');
      if (img) { img.style.opacity = '0.5'; setTimeout(() => { img.src = MEMORIES[currentMemory].image; img.style.opacity = '1'; }, 150); }
      if (cap) cap.textContent = MEMORIES[currentMemory].caption;
    });

    // Breathing
    const breathingModal = document.getElementById('breathingModal');
    document.getElementById('breathingBtn')?.addEventListener('click', () => {
      breathingModal.style.display = 'flex';
      const circle = document.getElementById('breathingCircle');
      const textEl = document.getElementById('breathingText');
      if (breathingInterval) clearInterval(breathingInterval);
      let phase = 'inhale', time = 0;
      breathingInterval = setInterval(() => {
        const total = 4000;
        if (phase === 'inhale') {
          const p = time / total;
          circle.style.transform = `scale(${1 + p * 0.4})`;
          textEl.textContent = 'Inhala';
          if (time >= total) { phase = 'exhale'; time = 0; }
        } else {
          const p = time / total;
          circle.style.transform = `scale(${1.4 - p * 0.4})`;
          textEl.textContent = 'Exhala';
          if (time >= total) { phase = 'inhale'; time = 0; }
        }
        time += 100;
      }, 100);
    });

    function stopBreathing() {
      breathingModal.style.display = 'none';
      if (breathingInterval) { clearInterval(breathingInterval); breathingInterval = null; }
      const c = document.getElementById('breathingCircle');
      if (c) c.style.transform = 'scale(1)';
    }

    document.getElementById('closeBreathingModal')?.addEventListener('click', stopBreathing);
    document.getElementById('stopBreathingBtn')?.addEventListener('click', stopBreathing);

    // ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        stopBreathing();
        betterModal.style.display = 'none';
      }
    });
  });

  return page;
}
