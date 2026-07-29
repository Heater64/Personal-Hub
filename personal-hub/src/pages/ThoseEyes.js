/* ==========================================
   Personal Hub v2 — Those Eyes Page
   Experiencia romántica con estrellas, audio y letras sincronizadas
   ========================================== */

export function ThoseEyesPage(router) {
  const page = document.createElement('div');
  page.className = 'thoseeyes-page';

  function render() {
    page.innerHTML = `
      <div class="thoseeyes-wrap">
        <canvas id="starsCanvas" class="thoseeyes-stars-canvas"></canvas>

        <div class="thoseeyes-hero">
          <p class="thoseeyes-eyebrow">para ti · con todo mi amor</p>
          <h1 class="thoseeyes-title">
            <span class="t1">Those</span>
            <span class="t2">Eyes</span>
          </h1>
          <div class="thoseeyes-meta">
            <span>New West</span>
            <span class="meta-dot"></span>
            <span>2023</span>
          </div>
        </div>

        <div class="thoseeyes-player">
          <div class="thoseeyes-player-card">
            <button class="thoseeyes-play-btn" id="playBtn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
            <div class="thoseeyes-player-info">
              <div class="thoseeyes-song">Those Eyes</div>
              <div class="thoseeyes-artist">New West</div>
            </div>
            <div class="thoseeyes-player-right">
              <div class="thoseeyes-audio-bars" id="audioBars">
                ${'<span></span>'.repeat(6)}
              </div>
              <div class="thoseeyes-time" id="timeDisplay">0:00</div>
            </div>
          </div>
          <div class="thoseeyes-progress-track" id="progressTrack">
            <div class="thoseeyes-progress-fill" id="progressFill"></div>
          </div>
        </div>

        <div class="thoseeyes-lyrics" id="lyricsContainer">
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
        <source src="/assets/those-eyes.mp3" type="audio/mpeg">
      </audio>
    `;
  }

  render();

  requestAnimationFrame(() => {
    // Canvas stars
    const canvas = document.getElementById('starsCanvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      let stars = [];
      const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        stars = Array.from({ length: 140 }, () => ({
          x: Math.random() * canvas.width, y: Math.random() * canvas.height,
          r: Math.random() * 1.2 + 0.3, sp: Math.random() * 0.008 + 0.002,
          ph: Math.random() * Math.PI * 2
        }));
      };
      const draw = (time) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        stars.forEach(s => {
          const alpha = 0.1 + 0.3 * Math.abs(Math.sin(time * 0.001 * s.sp * 200 + s.ph));
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(230,220,210,${alpha})`;
          ctx.fill();
        });
        requestAnimationFrame(draw);
      };
      window.addEventListener('resize', resize);
      resize();
      requestAnimationFrame(draw);
    }

    // Audio player
    const audio = document.getElementById('thoseEyesAudio');
    const playBtn = document.getElementById('playBtn');
    const bars = document.getElementById('audioBars');
    const timeDisplay = document.getElementById('timeDisplay');
    const progressFill = document.getElementById('progressFill');
    const progressTrack = document.getElementById('progressTrack');
    const allLines = document.querySelectorAll('.lyric-line[data-start]');
    const closing = document.getElementById('closingSection');

    if (!audio || !playBtn) return;

    let playing = false;
    let lastActive = null;

    function fmt(sec) {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
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
        if (closing && parseFloat(activeEl.dataset.start) >= 97) {
          setTimeout(() => closing.classList.add('visible'), 1800);
        }
      }
    }

    function togglePlay() {
      if (playing) {
        audio.pause();
        playBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
        bars.classList.remove('playing');
      } else {
        audio.play().catch(() => {});
        playBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
        bars.classList.add('playing');
      }
      playing = !playing;
    }

    audio.addEventListener('timeupdate', () => {
      if (audio.duration) {
        timeDisplay.textContent = fmt(audio.currentTime);
        progressFill.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
        syncLyrics(audio.currentTime);
      }
    });

    audio.addEventListener('ended', () => {
      playing = false;
      playBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
      bars.classList.remove('playing');
    });

    // Try autoplay on load
    audio.play().then(() => {
      playing = true;
      playBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
      bars.classList.add('playing');
    }).catch(() => {});

    playBtn.addEventListener('click', togglePlay);

    // Progress bar seek
    progressTrack?.addEventListener('click', (e) => {
      if (!audio.duration) return;
      const rect = progressTrack.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      audio.currentTime = pct * audio.duration;
    });
  });

  return page;
}
