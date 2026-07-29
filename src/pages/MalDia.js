/**
 * Mal Día Page — Comfort and support when you're having a bad day
 */
(function() {
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
    "✨ Eres única, especial e irrepetible. No hay nadie como tú.",
    "🌸 Eres como una flor que florece incluso en invierno.",
    "💖 Eres el mejor descubrimiento de mi vida.",
    "🌈 Incluso sin saberlo, haces mi mundo más bonito.",
  ];

  const MEMORIES = [
    { image: "https://res.cloudinary.com/dcsent4fs/image/upload/q_auto,f_auto,w_800/v1777747760/5199564237372592635_eqj9v5.jpg", caption: "Siempre tan linda ✨" },
    { image: "https://res.cloudinary.com/dcsent4fs/image/upload/v1782766240/5913325400387948133_1_t6a24g.jpg", caption: "Piscina con mi princesa" },
    { image: "https://res.cloudinary.com/dcsent4fs/image/upload/v1782766239/5913325400387948134_efteqk.jpg", caption: "Comprando papitash jsjs" },
    { image: "https://res.cloudinary.com/dcsent4fs/image/upload/v1782766239/5913325400387948135_diq97c.jpg", caption: "Que hermosa que eres" },
    { image: "https://res.cloudinary.com/dcsent4fs/image/upload/v1782766238/5913325400387948138_ryirj6.jpg", caption: "Batooon" },
    { image: "https://res.cloudinary.com/dcsent4fs/image/upload/v1782766238/5913325400387948137_i6fcp2.jpg", caption: "Que preciosidad" },
    { image: "https://res.cloudinary.com/dcsent4fs/image/upload/v1782766238/5913325400387948139_qdgn0l.jpg", caption: "Que ojazos tiene mi princesa" },
    { image: "https://res.cloudinary.com/dcsent4fs/image/upload/v1782766238/6046582610491806111_mx6qc3.jpg", caption: "Yo también te amo miniñaaaaaaaaaa" },
    { image: "https://res.cloudinary.com/dcsent4fs/image/upload/v1783252673/5931306366871997939_mpvodw.jpg", caption: "Jijijiji si somosh" },
  ];

  let isMusicPlaying = false;
  let audioPlayer = null;
  let breathingInterval = null;
  let currentMemory = 0;
  let currentPhrase = 0;
  let phraseInterval = null;

  const page = {
    name: 'maldia',

    mount(container) {
      currentPhrase = Math.floor(Math.random() * PHRASES.length);
      currentMemory = 0;
      container.innerHTML = this.render();
      this.afterMount(container);
    },

    render() {
      return `
        <div class="maldia-container">
          <div class="maldia-header">
            <div class="maldia-header-icon">☀️</div>
            <h1>¿Día gris?</h1>
            <p>No estás sola. Respira, tómate un momento y recuerda que te amo.</p>
          </div>

          <!-- Hero card -->
          <div class="hero-card">
            <div class="hero-glow"></div>
            <div class="card-icon-big"><i data-lucide="heart"></i></div>
            <h2>Frases que pueden ayudarte</h2>
            <div class="hero-message-wrapper">
              <p class="hero-message" id="heroMessage">${Utils.escapeHtml(PHRASES[currentPhrase])}</p>
            </div>
            <div class="hero-actions">
              <button class="action-btn" id="newPhraseBtn"><i data-lucide="sparkles"></i><span>Frase nueva</span></button>
              <button class="action-btn" id="particlesBtn"><i data-lucide="party-popper"></i><span>Algo bonito</span></button>
              <button class="action-btn primary" id="betterBtn"><i data-lucide="heart"></i><span>Me siento mejor</span></button>
            </div>
            <div class="music-player">
              <div class="music-wave" id="musicWave">
                ${'<div class="wave-bar"></div>'.repeat(6)}
              </div>
              <span class="music-label" id="musicLabel">🎵 Música feliz</span>
              <button class="music-toggle-btn" id="musicBtn"><i data-lucide="volume-2"></i></button>
            </div>
            <audio id="happyAudio" preload="none" loop>
              <source src="https://res.cloudinary.com/dcsent4fs/video/upload/v1777746763/Zzoilo_Aitana_-_Mon_Amour_Remix_Letra_Lyrics_jrgcjv.m4a" type="audio/mpeg">
            </audio>
          </div>

          <!-- Message + memories -->
          <div class="glass-card message-card">
            <div class="card-icon small"><i data-lucide="message-circle"></i></div>
            <h3>Mensaje para ti</h3>
            <div class="daily-message" id="dailyMessage">"Eres más fuerte de lo que crees, más bonita de lo que piensas y más querida de lo que imaginas."</div>
            <div class="memory-section">
              <div class="memory-frame">
                <img id="memoryImage" class="memory-image" src="${MEMORIES[0].image}" alt="Recuerdo especial">
              </div>
              <p class="memory-caption" id="memoryCaption">${MEMORIES[0].caption}</p>
              <button class="mini-btn" id="changeMemoryBtn"><i data-lucide="refresh-cw"></i><span>Cambiar recuerdo</span></button>
            </div>
          </div>

          <!-- Breathing -->
          <div class="breathing-section">
            <button class="breathing-btn" id="breathingBtn"><i data-lucide="wind"></i><span>Respiración guiada</span></button>
          </div>
        </div>

        <!-- Breathing Modal -->
        <div id="breathingModal" class="breathing-modal" style="display:none;">
          <div class="breathing-modal-content">
            <button class="breathing-modal-close" id="closeBreathingModal">&times;</button>
            <div class="breathing-circle" id="breathingCircle">
              <div class="breathing-text" id="breathingText">Inhala</div>
            </div>
            <p class="breathing-instruction">Sigue el ritmo del círculo</p>
            <button class="breathing-stop-btn" id="stopBreathingBtn">Detener</button>
          </div>
        </div>

        <!-- Better Modal (cat video) -->
        <div id="betterModal" class="better-modal" style="display:none;">
          <div class="better-modal-content">
            <button class="better-modal-close" id="closeBetterModal">&times;</button>
            <div class="better-video-container">
              <video id="betterVideo" autoplay loop muted playsinline>
                <source src="https://res.cloudinary.com/dcsent4fs/video/upload/v1777134957/gatito_isgr4b.mp4" type="video/mp4">
              </video>
            </div>
            <div class="better-message">
              <i data-lucide="heart"></i>
              <h2>¡Te quiero!</h2>
              <p>Siempre estaré aquí para ti mi reina 💕🤍</p>
            </div>
          </div>
        </div>
      `;
    },

    afterMount(container) {
      audioPlayer = document.getElementById('happyAudio');

      // New phrase
      document.getElementById('newPhraseBtn')?.addEventListener('click', () => {
        const msg = document.getElementById('heroMessage');
        if (msg) {
          let idx;
          do { idx = Math.floor(Math.random() * PHRASES.length); } while (idx === currentPhrase);
          currentPhrase = idx;
          msg.textContent = PHRASES[idx];
          msg.style.opacity = '0';
          setTimeout(() => { msg.style.opacity = '1'; }, 100);
        }
      });

      // Particles / something nice
      document.getElementById('particlesBtn')?.addEventListener('click', () => {
        Utils.showToast('✨ Te quiero mucho princesa ✨');
      });

      // Music
      document.getElementById('musicBtn')?.addEventListener('click', () => {
        if (!audioPlayer) return;
        if (isMusicPlaying) {
          audioPlayer.pause();
          isMusicPlaying = false;
          document.getElementById('musicWave').classList.remove('playing');
          document.getElementById('musicLabel').textContent = '🎵 Pausada';
          document.getElementById('musicBtn').innerHTML = '<i data-lucide="volume-2"></i>';
        } else {
          audioPlayer.play().catch(() => {});
          isMusicPlaying = true;
          document.getElementById('musicWave').classList.add('playing');
          document.getElementById('musicLabel').textContent = '🎵 Sonando';
          document.getElementById('musicBtn').innerHTML = '<i data-lucide="volume-x"></i>';
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
        const text = document.getElementById('breathingText');
        if (breathingInterval) clearInterval(breathingInterval);
        let phase = 'inhale', time = 0;
        breathingInterval = setInterval(() => {
          const total = 4000;
          if (phase === 'inhale') {
            const p = time / total;
            circle.style.transform = `scale(${1 + p * 0.4})`;
            text.textContent = 'Inhala';
            if (time >= total) { phase = 'exhale'; time = 0; }
          } else {
            const p = time / total;
            circle.style.transform = `scale(${1.4 - p * 0.4})`;
            text.textContent = 'Exhala';
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
    }
  };

  if (window.AppRouter) {
    AppRouter.register('maldia', () => page);
  }
})();
