/**
 * Those Eyes Page — Romantic experience with synced lyrics and canvas stars
 */
(function() {
  const page = {
    name: 'thoseeyes',

    mount(container) {
      container.innerHTML = this.render();
      this.afterMount(container);
    },

    render() {
      return `
        <div class="thoseeyes-wrap">
          <canvas id="starsCanvas" class="stars-canvas"></canvas>

          <div class="thoseeyes-hero">
            <p class="thoseeyes-eyebrow">para ti · con todo mi amor</p>
            <h1 class="thoseeyes-title">
              <span class="t1">Those</span>
              <span class="t2">Eyes</span>
            </h1>
            <div class="thoseeyes-meta">
              <span>New West</span>
              <div class="meta-dot"></div>
              <span>2023</span>
            </div>
          </div>

          <div class="thoseeyes-player">
            <div class="player-card-inline">
              <button class="btn-play-circle" id="playBtn">▶</button>
              <div class="player-info-inline">
                <div class="player-song-inline">Those Eyes</div>
                <div class="player-artist-inline">New West</div>
              </div>
              <div class="player-right-inline">
                <div class="audio-bars" id="audioBars">
                  ${'<span></span>'.repeat(6)}
                </div>
                <div class="time-display" id="timeDisplay">0:00</div>
              </div>
            </div>
            <div class="progress-bar-track" id="progressTrack">
              <div class="progress-bar-fill" id="progressFill"></div>
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
            <p class="closing-hearts">🤍 💕 💖 🤍 💕</p>
          </div>
        </div>

        <audio id="thoseEyesAudio" loop>
          <source src="assets/those-eyes.mp3" type="audio/mpeg">
        </audio>

        <style>
          .thoseeyes-wrap { position: relative; z-index: 10; max-width: 780px; margin: 0 auto; padding: 0 24px 120px; }
          .stars-canvas { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; opacity: 0.5; }
          .thoseeyes-hero { padding: 72px 0 48px; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 56px; }
          .thoseeyes-eyebrow { font-size: 0.7rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--umbra-ash); margin-bottom: 24px; }
          .thoseeyes-title .t1, .thoseeyes-title .t2 { display: block; font-family: 'Playfair Display',serif; font-weight: 400; font-size: clamp(4rem,14vw,8rem); letter-spacing: -0.02em; line-height: 0.95; }
          .thoseeyes-title .t2 { font-style: italic; color: var(--accent-coral); }
          .thoseeyes-meta { margin-top: 20px; display: flex; align-items: center; gap: 12px; font-size: 0.65rem; letter-spacing: 0.2em; color: var(--umbra-ash); }
          .meta-dot { width: 3px; height: 3px; background: var(--umbra-ash); opacity: 0.4; border-radius: 50%; }
          .thoseeyes-player { margin-bottom: 64px; }
          .player-card-inline { display: flex; align-items: center; gap: 16px; padding: 16px 24px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; max-width: 380px; }
          .btn-play-circle { flex-shrink: 0; width: 48px; height: 48px; border-radius: 40px; border: 1px solid var(--accent-coral); background: transparent; color: var(--accent-coral); font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
          .btn-play-circle:hover { opacity: 0.8; transform: scale(0.98); }
          .player-info-inline { flex: 1; min-width: 0; }
          .player-song-inline { font-family: 'Playfair Display',serif; font-size: 1rem; font-weight: 500; color: var(--umbra-light); }
          .player-artist-inline { font-size: 0.7rem; letter-spacing: 0.08em; color: var(--umbra-ash); margin-top: 4px; }
          .player-right-inline { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
          .audio-bars { display: flex; align-items: center; gap: 3px; height: 20px; }
          .audio-bars span { display: block; width: 2px; background: var(--accent-coral); opacity: 0.3; }
          .audio-bars.playing span { opacity: 0.8; animation: barBeat 1s ease-in-out infinite; }
          .audio-bars span:nth-child(1) { height: 6px; animation-delay: 0s; }
          .audio-bars span:nth-child(2) { height: 12px; animation-delay: 0.1s; }
          .audio-bars span:nth-child(3) { height: 18px; animation-delay: 0.2s; }
          .audio-bars span:nth-child(4) { height: 10px; animation-delay: 0.3s; }
          .audio-bars span:nth-child(5) { height: 14px; animation-delay: 0.4s; }
          .audio-bars span:nth-child(6) { height: 8px; animation-delay: 0.5s; }
          @keyframes barBeat { 0%,100% { transform: scaleY(0.4); } 50% { transform: scaleY(1); } }
          .time-display { font-size: 0.65rem; font-family: monospace; color: var(--umbra-ash); }
          .progress-bar-track { height: 2px; background: rgba(255,255,255,0.08); border-radius: 2px; margin-top: 12px; max-width: 380px; cursor: pointer; }
          .progress-bar-fill { height: 100%; width: 0%; background: var(--accent-coral); border-radius: 2px; transition: width 0.1s linear; }
          .thoseeyes-lyrics { padding: 0 4px; }
          .lyric-block { margin-bottom: 3rem; }
          .lyric-line { display: block; font-family: 'Playfair Display',serif; font-size: clamp(1.6rem,5vw,3rem); line-height: 1.3; color: var(--umbra-ash); margin-bottom: 0.15em; transition: color 0.3s ease, transform 0.3s ease; font-weight: 400; }
          .lyric-line.italic { font-style: italic; font-size: clamp(1.3rem,4vw,2.4rem); font-weight: 300; }
          .lyric-line.accent { font-weight: 500; color: var(--accent-coral); opacity: 0.6; }
          .lyric-line.big { font-size: clamp(1.8rem,6vw,3.4rem); font-weight: 500; }
          .lyric-line.active { color: var(--umbra-light); transform: translateX(6px); }
          .lyric-line.accent.active { opacity: 1; }
          .lyric-line.past { color: #2a2a2e; }
          .lyric-line.accent.past { opacity: 0.3; }
          .lyric-divider { display: flex; align-items: center; gap: 16px; margin: 2rem 0 2.5rem; opacity: 0.4; }
          .lyric-divider::before, .lyric-divider::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, transparent, var(--umbra-ash), transparent); }
          .lyric-divider span { font-size: 0.7rem; color: var(--accent-coral); }
          .thoseeyes-closing { margin-top: 80px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 48px; text-align: center; opacity: 0; transform: translateY(20px); transition: opacity 1s ease, transform 1s ease; }
          .thoseeyes-closing.visible { opacity: 1; transform: translateY(0); }
          .closing-msg { font-family: 'Playfair Display',serif; font-style: italic; font-size: clamp(1.1rem,3vw,1.5rem); color: var(--umbra-ash); }
          .closing-msg strong { color: var(--accent-coral); font-style: normal; }
          .closing-hearts { margin-top: 32px; font-size: 1.3rem; letter-spacing: 0.4em; animation: pulse 2s ease infinite; color: var(--accent-coral); }
          @keyframes pulse { 0%,100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
          @media (max-width: 600px) { .thoseeyes-wrap { padding: 0 16px 100px; } .thoseeyes-hero { padding: 48px 0 32px; margin-bottom: 40px; } }
        </style>
      `;
    },

    afterMount(container) {
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

      // Floating symbols
      const symbols = ['✦', '♡', '🌹', '·', '✧', '🌸'];
      const spawnSymbol = () => {
        const el = document.createElement('div');
        el.className = 'floating-symbol';
        el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        el.style.cssText = `position:fixed;pointer-events:none;z-index:5;left:${Math.random() * 95}vw;bottom:-10px;font-size:${0.7 + Math.random() * 0.8}rem;opacity:0.4;animation:petalFloat ${12 + Math.random() * 14}s linear forwards;`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 20000);
      };
      const floatInterval = setInterval(spawnSymbol, 4000);
      // Clean up interval on page change
      this._cleanup = () => clearInterval(floatInterval);

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
          playBtn.textContent = '▶';
          bars.classList.remove('playing');
        } else {
          audio.play().catch(() => {});
          playBtn.textContent = '⏸';
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
        playBtn.textContent = '▶';
        bars.classList.remove('playing');
      });

      // Try autoplay on load
      audio.play().then(() => {
        playing = true;
        playBtn.textContent = '⏸';
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
    }
  };

  if (window.AppRouter) {
    AppRouter.register('thoseeyes', () => page);
  }
})();
