/* ==========================================
   Personal Hub — Those Eyes Page
   Experiencia romántica: solo la canción con
   letra sincronizada automáticamente.
   Título + reproductor + letra. Sin fotos.
   ========================================== */

// Audio local (funciona offline y en producción); la versión con fotos
// usaba una URL de Cloudinary que dejó de existir (404).
const AUDIO_SRC = '/assets/those-eyes.mp3';

export function ThoseEyesPage(router) {
  const page = document.createElement('div');
  page.className = 'thoseeyes-page';

  let rafId = null;
  let onResize = null;
  let audioEl = null;
  let playing = false;
  let lastActive = null;

  page.cleanup = () => {
    if (rafId) cancelAnimationFrame(rafId);
    if (onResize) window.removeEventListener('resize', onResize);
    if (audioEl) {
      audioEl.pause();
      // El source vive en un hijo <source>: hay que quitarlo y llamar a load()
      // para abortar el fetch de verdad (removeAttribute('src') no basta).
      audioEl.removeAttribute('src');
      audioEl.querySelectorAll('source').forEach(s => s.remove());
      audioEl.load();
      audioEl = null;
    }
    document.removeEventListener('keydown', page._keyHandler);
  };

  function fmt(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function render() {
    page.innerHTML = `
      <div class="thoseeyes-wrap">
        <canvas id="starsCanvas" class="thoseeyes-stars-canvas" aria-hidden="true"></canvas>

        <header class="thoseeyes-hero">
          <p class="thoseeyes-eyebrow">para ti · con todo mi amor</p>
          <h1 class="thoseeyes-title">
            <span class="t1">Those</span>
            <span class="t2">Eyes</span>
          </h1>
          <div class="thoseeyes-meta">
            <span>New West</span>
            <span class="meta-dot" aria-hidden="true"></span>
            <span>2023</span>
          </div>
        </header>

        <section class="thoseeyes-player" aria-label="Reproductor de la canción">
          <div class="thoseeyes-player-card">
            <button class="thoseeyes-play-btn" id="playBtn" aria-label="Reproducir o pausar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
            <div class="thoseeyes-player-info">
              <div class="thoseeyes-song">Those Eyes</div>
              <div class="thoseeyes-artist">New West</div>
            </div>
            <div class="thoseeyes-player-right">
              <div class="thoseeyes-audio-bars" id="audioBars" aria-hidden="true">
                ${'<span></span>'.repeat(6)}
              </div>
              <div class="thoseeyes-time" id="timeDisplay">0:00</div>
            </div>
          </div>
          <div class="thoseeyes-progress-track" id="progressTrack" role="slider" aria-label="Progreso de la canción" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <div class="thoseeyes-progress-fill" id="progressFill"></div>
          </div>
          <div class="thoseeyes-loading" id="loadingState" style="display:none" role="status" aria-live="polite">
            <span class="thoseeyes-loading-spinner" aria-hidden="true"></span> Cargando audio...
          </div>
        </section>

        <div class="thoseeyes-lyrics" id="lyricsContainer" aria-label="Letra de la canción">
          <div class="lyric-block">
            <span class="lyric-line big" data-start="0" data-end="4">When we're done making love</span>
            <span class="lyric-line italic" data-start="4" data-end="8">And you look up</span>
            <span class="lyric-line accent" data-start="8" data-end="13">and give me those eyes</span>
          </div>
          <div class="lyric-divider"><span>♡</span></div>
          <div class="lyric-block">
            <span class="lyric-line" data-start="13" data-end="17">'Cause all of the small things</span>
            <span class="lyric-line italic" data-start="17" data-end="20">that you do</span>
            <span class="lyric-line" data-start="20" data-end="23">Are what remind me</span>
            <span class="lyric-line accent" data-start="23" data-end="27">why I fell for you</span>
          </div>
          <div class="lyric-block">
            <span class="lyric-line" data-start="27" data-end="29">And when we're apart,</span>
            <span class="lyric-line italic" data-start="29" data-end="31">and I'm missing you</span>
            <span class="lyric-line" data-start="31" data-end="33">I close my eyes</span>
            <span class="lyric-line accent" data-start="33" data-end="37">and all I see is you</span>
            <span class="lyric-line italic" data-start="37" data-end="40">And the small things you do</span>
          </div>
          <div class="lyric-divider"><span>♡</span></div>
          <div class="lyric-block">
            <span class="lyric-line big" data-start="49" data-end="52">When you call me at night</span>
            <span class="lyric-line italic" data-start="52" data-end="55">while you're out</span>
            <span class="lyric-line italic" data-start="55" data-end="57">Getting high with your friends</span>
          </div>
          <div class="lyric-block">
            <span class="lyric-line" data-start="62" data-end="64">Every "hi", every "bye"</span>
            <span class="lyric-line accent" data-start="64" data-end="68">every "I love you"</span>
            <span class="lyric-line italic" data-start="68" data-end="70">you've ever said</span>
          </div>
          <div class="lyric-divider"><span>♡</span></div>
          <div class="lyric-block">
            <span class="lyric-line" data-start="73" data-end="78">'Cause all of the small things</span>
            <span class="lyric-line italic" data-start="78" data-end="80">that you do</span>
            <span class="lyric-line" data-start="80" data-end="83">Are what remind me</span>
            <span class="lyric-line accent" data-start="83" data-end="85">why I fell for you</span>
          </div>
          <div class="lyric-block">
            <span class="lyric-line" data-start="86" data-end="89">And when we're apart,</span>
            <span class="lyric-line italic" data-start="89" data-end="92">and I'm missing you</span>
            <span class="lyric-line" data-start="92" data-end="95">I close my eyes</span>
            <span class="lyric-line accent" data-start="95" data-end="97">and all I see is you</span>
            <span class="lyric-line big" data-start="97" data-end="100">And the small things you do</span>
          </div>
        </div>

        <div class="thoseeyes-closing" id="closingSection">
          <p class="closing-msg">
            Cada pequeña cosa que haces<br>
            me recuerda por qué <strong>me enamoré de ti.</strong>
          </p>
        </div>
      </div>

      <audio id="thoseEyesAudio" loop preload="auto">
        <source src="${AUDIO_SRC}" type="audio/mpeg">
      </audio>
    `;
  }

  render();

  requestAnimationFrame(() => {
    // ==========================================
    // Canvas estrellas (sutil, se adapta al tema)
    // ==========================================
    const canvas = document.getElementById('starsCanvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      let stars = [];
      const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
      onResize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const count = window.innerWidth < 600 ? 60 : 110;
        stars = Array.from({ length: count }, () => ({
          x: Math.random() * canvas.width, y: Math.random() * canvas.height,
          r: Math.random() * 1.2 + 0.3, sp: Math.random() * 0.008 + 0.002,
          ph: Math.random() * Math.PI * 2
        }));
      };
      const draw = (time) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const color = isDark ? '230,220,210' : '190,110,135';
        stars.forEach(s => {
          const alpha = 0.06 + 0.25 * Math.abs(Math.sin(time * 0.001 * s.sp * 200 + s.ph));
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${color},${alpha})`;
          ctx.fill();
        });
        rafId = requestAnimationFrame(draw);
      };
      window.addEventListener('resize', onResize);
      onResize();
      rafId = requestAnimationFrame(draw);
    }

    // ==========================================
    // Audio player + letra sincronizada
    // ==========================================
    audioEl = document.getElementById('thoseEyesAudio');
    const playBtn = document.getElementById('playBtn');
    const bars = document.getElementById('audioBars');
    const timeDisplay = document.getElementById('timeDisplay');
    const progressFill = document.getElementById('progressFill');
    const progressTrack = document.getElementById('progressTrack');
    const loadingState = document.getElementById('loadingState');
    const closing = document.getElementById('closingSection');
    const allLines = document.querySelectorAll('.lyric-line[data-start]');

    if (!audioEl || !playBtn) return;
    let audioReady = false;

    function updatePlayState(state) {
      playing = state;
      playBtn.innerHTML = state
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
      if (bars) bars.classList.toggle('playing', state);
      playBtn.classList.toggle('is-playing', state);
      playBtn.setAttribute('aria-label', state ? 'Pausar' : 'Reproducir');
    }

    function syncLyrics(time) {
      let activeEl = null;
      allLines.forEach(el => {
        const start = parseFloat(el.dataset.start);
        const end = parseFloat(el.dataset.end);
        if (time >= start && time < end) activeEl = el;
      });
      if (activeEl === lastActive) return;
      lastActive = activeEl;
      allLines.forEach(el => {
        el.classList.remove('active', 'past');
        if (time > parseFloat(el.dataset.end)) el.classList.add('past');
      });
      if (activeEl) {
        activeEl.classList.add('active');
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    function togglePlay() {
      if (!audioReady || !audioEl) return;
      if (playing) { audioEl.pause(); updatePlayState(false); }
      else { audioEl.play().then(() => updatePlayState(true)).catch(() => {}); }
    }

    audioEl.addEventListener('loadstart', () => {
      if (loadingState) loadingState.style.display = '';
      audioReady = false;
    });
    audioEl.addEventListener('canplay', () => {
      if (loadingState) loadingState.style.display = 'none';
      audioReady = true;
    });
    const onAudioError = () => {
      if (loadingState) {
        loadingState.innerHTML = '<span style="color:var(--theme-error)">⚠️</span> Esta pista no está disponible ahora mismo.';
        loadingState.style.display = '';
      }
      audioReady = false;
      playBtn.disabled = true;
      playBtn.setAttribute('aria-disabled', 'true');
      playBtn.title = 'Audio no disponible';
    };
    audioEl.addEventListener('error', onAudioError);
    // Con preload="auto" el fetch empieza al insertar el elemento: el error
    // puede dispararse ANTES de enlazar el listener. Detectarlo y aplicarlo ya.
    if (audioEl.error || audioEl.networkState === 3) onAudioError();

    audioEl.addEventListener('timeupdate', () => {
      if (audioEl.duration) {
        const pct = (audioEl.currentTime / audioEl.duration) * 100;
        if (timeDisplay) timeDisplay.textContent = fmt(audioEl.currentTime);
        if (progressFill) progressFill.style.width = `${pct}%`;
        if (progressTrack) progressTrack.setAttribute('aria-valuenow', String(Math.round(pct)));
        syncLyrics(audioEl.currentTime);
      }
    });
    audioEl.addEventListener('ended', () => {
      updatePlayState(false);
      if (closing) closing.classList.add('visible');
    });

    // Autoplay: la canción arranca sola al entrar en la página
    audioEl.play().then(() => updatePlayState(true)).catch(() => {});
    playBtn.addEventListener('click', togglePlay);

    // Click en la barra de progreso para saltar
    progressTrack?.addEventListener('click', (e) => {
      if (!audioEl.duration || !audioReady) return;
      const rect = progressTrack.getBoundingClientRect();
      audioEl.currentTime = ((e.clientX - rect.left) / rect.width) * audioEl.duration;
    });

    // Espacio = play/pausa (accesibilidad por teclado)
    const keyHandler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    };
    document.addEventListener('keydown', keyHandler);
    page._keyHandler = keyHandler;
  });

  return page;
}
