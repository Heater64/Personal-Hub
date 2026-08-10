/* ==========================================
   Personal Hub v2 — Mal Día Page
   Consuelo, frases, recuerdos y apoyo
   ========================================== */

import { showToast } from '../components/Toast.js';
import { db } from '../services/db.service.js';
import { onContentChange } from '../services/realtime.service.js';

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

  // Frases gestionables desde el Admin (tab Mal Día) con fallback a las estáticas
  let frases = PHRASES.slice();
  let dailyMensajes = [];
  let currentPhrase = Math.floor(Math.random() * frases.length);
  let isMusicPlaying = false;
  let audioPlayer = null;
  let breathingInterval = null;
  let onKeyDown = null;

  const offContent = onContentChange(['maldia_frases', 'maldia_mensajes'], loadAdminContent);

  page.cleanup = () => {
    offContent();
    if (onKeyDown) document.removeEventListener('keydown', onKeyDown);
    if (breathingInterval) { clearInterval(breathingInterval); breathingInterval = null; }
    if (audioPlayer) { audioPlayer.pause(); audioPlayer = null; }
    document.getElementById('betterVideo')?.pause();
    document.body.style.overflow = '';
  };

  function render() {
    const heroMsg = frases[currentPhrase] || 'Respira, todo va a estar bien. Te quiero.';
    const dailyMsg = dailyMensajes.length
      ? dailyMensajes[Math.floor(Math.random() * dailyMensajes.length)]
      : 'Eres más fuerte de lo que crees, más bonita de lo que piensas y más querida de lo que imaginas.';

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
            <p class="maldia-message" id="heroMessage">${heroMsg}</p>
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
            <button class="maldia-music-toggle" id="musicBtn" aria-label="Activar o desactivar música" aria-pressed="false">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            </button>
            <audio id="happyAudio" preload="none" loop>
              <source src="https://res.cloudinary.com/dcsent4fs/video/upload/v1777746763/Zzoilo_Aitana_-_Mon_Amour_Remix_Letra_Lyrics_jrgcjv.m4a" type="audio/mpeg">
            </audio>
          </div>
        </div>

        <!-- Daily message -->
        <div class="maldia-daily-msg-card glass-card">
          <div class="maldia-daily-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <h3>Mensaje para ti</h3>
          </div>
          <div class="maldia-daily-message">${dailyMsg}</div>
        </div>

        <!-- Photo Gallery -->
        <div class="maldia-gallery-card glass-card">
          <div class="maldia-gallery-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <h3>Nuestros recuerdos</h3>
            <span class="maldia-gallery-count">${MEMORIES.length} fotos</span>
          </div>
          <div class="maldia-gallery-grid">
            ${MEMORIES.map((mem, i) => `
              <div class="maldia-gallery-item" data-index="${i}">
                <img src="${mem.image.replace('w_800', 'w_400,c_fill,g_face,h_300')}" alt="${mem.caption}" loading="lazy">
                <div class="maldia-gallery-overlay">
                  <span class="maldia-gallery-caption">${mem.caption}</span>
                </div>
              </div>
            `).join('')}
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

      <!-- Photo Lightbox -->
      <div class="maldia-lightbox" id="galleryLightbox" style="display:none;">
        <button class="maldia-lightbox-close" id="closeLightbox" aria-label="Cerrar visor">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <button class="maldia-lightbox-nav prev" id="lightboxPrev" aria-label="Foto anterior">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <img id="lightboxImage" class="maldia-lightbox-img" src="" alt="">
        <div class="maldia-lightbox-info">
          <span id="lightboxCaption"></span>
          <span id="lightboxCounter"></span>
        </div>
        <button class="maldia-lightbox-nav next" id="lightboxNext" aria-label="Foto siguiente">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <!-- Breathing Modal -->
      <div class="maldia-modal" id="breathingModal" style="display:none;">
        <div class="maldia-modal-content">
          <button class="maldia-modal-close" id="closeBreathingModal" aria-label="Cerrar">
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
          <button class="maldia-modal-close" id="closeBetterModal" aria-label="Cerrar">
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

  // Carga frases y mensajes gestionados desde el Admin (fallback silencioso a los
  // estáticos). También se invoca en tiempo real cuando el Admin los edita.
  async function loadAdminContent() {
    const [f, m] = await Promise.allSettled([db.getMaldiaFrases(), db.getMaldiaMensajes()]);
    const frasesAdmin = (f.value || []).filter(x => typeof x === 'string' && x.trim());
    const msgsAdmin = (m.value || []).filter(x => typeof x === 'string' && x.trim());
    if (frasesAdmin.length) frases = frasesAdmin;
    if (msgsAdmin.length) dailyMensajes = msgsAdmin;
    if (currentPhrase >= frases.length) currentPhrase = 0;
    const heroMsg = document.getElementById('heroMessage');
    if (heroMsg) heroMsg.textContent = frases[currentPhrase] || heroMsg.textContent;
    const dailyEl = page.querySelector('.maldia-daily-message');
    if (dailyEl && dailyMensajes.length) {
      dailyEl.textContent = dailyMensajes[Math.floor(Math.random() * dailyMensajes.length)];
    }
  }

  loadAdminContent();

  requestAnimationFrame(() => {
    audioPlayer = document.getElementById('happyAudio');

    // New phrase
    document.getElementById('newPhraseBtn')?.addEventListener('click', () => {
      const msg = document.getElementById('heroMessage');
      if (msg) {
        let idx;
        if (frases.length > 1) {
          do { idx = Math.floor(Math.random() * frases.length); } while (idx === currentPhrase);
        } else {
          idx = 0;
        }
        currentPhrase = idx;
        msg.style.opacity = '0';
        msg.textContent = frases[idx] || 'Respira, todo va a estar bien. Te quiero.';
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
      document.getElementById('musicBtn')?.setAttribute('aria-pressed', String(isMusicPlaying));
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

    // ==========================================
    // PHOTO GALLERY — Immersive grid + lightbox
    // ==========================================
    let lightboxIndex = 0;

    function openLightbox(index) {
      lightboxIndex = index;
      const lb = document.getElementById('galleryLightbox');
      const img = document.getElementById('lightboxImage');
      const cap = document.getElementById('lightboxCaption');
      const counter = document.getElementById('lightboxCounter');
      if (!lb || !img) return;
      img.src = MEMORIES[index].image;
      if (cap) cap.textContent = MEMORIES[index].caption;
      if (counter) counter.textContent = `${index + 1} / ${MEMORIES.length}`;
      lb.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      const lb = document.getElementById('galleryLightbox');
      if (lb) { lb.style.display = 'none'; }
      document.body.style.overflow = '';
    }

    function navigateLightbox(dir) {
      lightboxIndex = (lightboxIndex + dir + MEMORIES.length) % MEMORIES.length;
      openLightbox(lightboxIndex);
    }

    // Grid item clicks
    page.querySelectorAll('.maldia-gallery-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.index);
        openLightbox(idx);
      });
    });

    // Lightbox close
    document.getElementById('closeLightbox')?.addEventListener('click', closeLightbox);
    document.getElementById('galleryLightbox')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeLightbox();
    });

    // Lightbox nav
    document.getElementById('lightboxPrev')?.addEventListener('click', () => navigateLightbox(-1));
    document.getElementById('lightboxNext')?.addEventListener('click', () => navigateLightbox(1));

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
    onKeyDown = (e) => {
      if (e.key === 'Escape') {
        stopBreathing();
        betterModal.style.display = 'none';
        closeLightbox();
      }
      if (e.key === 'ArrowLeft') navigateLightbox(-1);
      if (e.key === 'ArrowRight') navigateLightbox(1);
    };
    document.addEventListener('keydown', onKeyDown);
  });

  return page;
}
