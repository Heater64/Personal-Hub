/* ==========================================
   Personal Hub v2 — Just The Way You Are
   Experiencia tipo ThoseEyes con letras EN+ES
   Traducción línea a línea · Tema coherente
   ========================================== */

const SONG_DATA = {
  title: "Just The Way You Are",
  artist: "Bruno Mars",
  audio: "https://res.cloudinary.com/dcsent4fs/video/upload/v1777748879/Bruno_Mars_-_Just_The_Way_You_Are_i8mkhd.m4a"
};

// ==========================================
// 📝 TIMESTAMPS — Ajusta aquí los segundos
//    start = cuando empieza la línea
//    end   = cuando termina
// ==========================================
const LYRIC_PAIRS = [
  // ── Verse 1 ──
  { start: 17, end: 22, en: "Oh, her eyes, her eyes make the stars look like they're not shining", es: "Oh, sus ojos, sus ojos hacen que las estrellas parezcan no brillar" },
  { start: 22, end: 27, en: "Her hair, her hair falls perfectly without her trying", es: "Su cabello, su cabello cae perfectamente sin que ella lo intente" },
  { start: 27, end: 34, en: "She's so beautiful and I tell her every day", es: "Ella es tan hermosa y se lo digo todos los días" },
  // ── Pre-Chorus 1 ──
  { start: 34, end: 39, en: "Yeah, I know, I know when I compliment her she won't believe me", es: "Sí, lo sé, lo sé, cuando la halago no me cree" },
  { start: 39, end: 44, en: "And it's so, it's so sad to think that she don't see what I see", es: "Y es tan, es tan triste pensar que ella no ve lo que yo veo" },
  { start: 44, end: 51, en: "But every time she asks me, do I look okay?", es: "Pero cada vez que me pregunta, ¿me veo bien?" },
  // ── Chorus 1 ──
  { start: 51, end: 60, en: "When I see your face, there's not a thing that I would change", es: "Cuando veo tu cara, no hay nada que cambiaría", style: 'accent' },
  { start: 60, end: 63, en: "'Cause you're amazing, just the way you are", es: "Porque eres increíble, tal como eres", style: 'accent big' },
  { start: 63, end: 71, en: "And when you smile, the whole world stops and stares for a while", es: "Y cuando sonríes, el mundo entero se detiene y te mira", style: 'accent' },
  { start: 71, end: 79, en: "'Cause girl you're amazing, just the way you are", es: "Porque chica, eres increíble, tal como eres", style: 'accent big' },
  // ── Verse 2 ──
  { start: 79, end: 88, en: "Her lips, her lips I could kiss them all day if she'd let me", es: "Sus labios, sus labios, podría besarlos todo el día" },
  { start: 88, end: 94, en: "Her laugh, her laugh she hates but I think it's so sexy", es: "Su risa, su risa, ella odia pero a mí me parece tan sexy" },
  { start: 94, end: 98, en: "She's so beautiful and I tell her every day", es: "Ella es tan hermosa y se lo digo todos los días" },
  // ── Pre-Chorus 2 ──
  { start: 112, end: 118, en: "Yeah, I know, I know when I compliment her she won't believe me", es: "Sí, lo sé, lo sé, cuando la halago no me cree" },
  { start: 118, end: 124, en: "And it's so, it's so sad to think that she don't see what I see", es: "Y es tan, es tan triste pensar que ella no ve lo que yo veo" },
  { start: 124, end: 130, en: "But every time she asks me, do I look okay?", es: "Pero cada vez que me pregunta, ¿me veo bien?" },
  // ── Chorus 2 ──
  { start: 130, end: 137, en: "When I see your face, there's not a thing that I would change", es: "Cuando veo tu cara, no hay nada que cambiaría", style: 'accent' },
  { start: 137, end: 144, en: "'Cause you're amazing, just the way you are", es: "Porque eres increíble, tal como eres", style: 'accent big' },
  { start: 144, end: 151, en: "And when you smile, the whole world stops and stares for a while", es: "Y cuando sonríes, el mundo entero se detiene y te mira", style: 'accent' },
  { start: 151, end: 158, en: "'Cause girl you're amazing, just the way you are", es: "Porque chica, eres increíble, tal como eres", style: 'accent big' },
  // ── Bridge ──
  { start: 158, end: 166, en: "You know I'd never ask you to change", es: "Sabes que nunca te pediría que cambiaras", style: 'italic' },
  { start: 166, end: 174, en: "If perfect's what you're searching for, then just stay the same", es: "Si la perfección es lo que buscas, entonces solo quédate igual", style: 'italic' },
  { start: 174, end: 180, en: "So don't even bother asking if you look okay", es: "Así que ni te molestes en preguntar si te ves bien", style: 'italic' },
  { start: 180, end: 186, en: "You know I'll say…", es: "Sabes que diré…", style: 'italic' },
  // ── Final Chorus ──
  { start: 186, end: 193, en: "When I see your face, there's not a thing that I would change", es: "Cuando veo tu cara, no hay nada que cambiaría", style: 'accent' },
  { start: 193, end: 200, en: "'Cause you're amazing, just the way you are", es: "Porque eres increíble, tal como eres", style: 'accent big' },
  { start: 200, end: 207, en: "And when you smile, the whole world stops and stares for a while", es: "Y cuando sonríes, el mundo entero se detiene y te mira", style: 'accent' },
  { start: 207, end: 215, en: "'Cause girl you're amazing, just the way you are", es: "Porque chica, eres increíble, tal como eres", style: 'accent big' },
  // ── Outro ──
  { start: 215, end: 222, en: "You're amazing, just the way you are", es: "Eres increíble, tal como eres", style: 'accent big' },
  { start: 222, end: 230, en: "You're amazing, just the way you are", es: "Eres increíble, tal como eres", style: 'accent big' },
];

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    if (m === '"') return '&quot;';
    if (m === "'") return '&#39;';
    return m;
  });
}

export function JustTheWayYouArePage(router) {
  const page = document.createElement('div');
  page.className = 'jt-page';

  function render() {
    page.innerHTML = `
      <canvas id="jtStarsCanvas" class="jt-stars-canvas"></canvas>

      <div class="jt-wrap">
        <!-- HERO -->
        <div class="jt-hero">
          <p class="jt-eyebrow">para ti · con todo mi amor</p>
          <h1 class="jt-title">
            <span class="t1">Just The Way</span>
            <span class="t2">You Are</span>
          </h1>
          <div class="jt-meta">
            <span>Bruno Mars</span>
            <span class="meta-dot"></span>
            <span>2010</span>
          </div>
        </div>

        <!-- PLAYER -->
        <div class="jt-player">
          <div class="jt-player-card">
            <button class="jt-play-btn" id="playBtn" aria-label="Reproducir">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
            <div class="jt-player-info">
              <div class="jt-song">Just The Way You Are</div>
              <div class="jt-artist">Bruno Mars</div>
            </div>
            <div class="jt-player-right">
              <div class="jt-audio-bars" id="audioBars">
                ${'<span></span>'.repeat(6)}
              </div>
              <div class="jt-time" id="timeDisplay">0:00</div>
            </div>
          </div>
          <div class="jt-progress-track" id="progressTrack">
            <div class="jt-progress-fill" id="progressFill"></div>
          </div>
        </div>

        <!-- LYRICS (EN + ES) -->
        <div class="jt-lyrics" id="lyricsContainer">
          ${LYRIC_PAIRS.map((pair, i) => {
            const prev = LYRIC_PAIRS[i - 1];
            // Insert divider between sections
            const isSectionStart = prev && (
              (pair.start >= 56 && prev.start < 56) ||
              (pair.start >= 93 && prev.start < 93) ||
              (pair.start >= 130 && prev.start < 130) ||
              (pair.start >= 158 && prev.start < 158)
            );
            const divider = isSectionStart
              ? `<div class="lyric-divider"><span>♡</span></div>`
              : '';
            const enClass = 'lyric-line' + (pair.style ? ' ' + pair.style : '');
            return `
              ${divider}
              <div class="lyric-block" data-start="${pair.start}" data-end="${pair.end}">
                <span class="${enClass}">${escapeHtml(pair.en)}</span>
                <span class="lyric-line-es">${escapeHtml(pair.es)}</span>
                <span class="lyric-ts" style="display:none;">${pair.start}s → ${pair.end}s</span>
              </div>
            `;
          }).join('')}
        </div>

        <!-- CLOSING -->
        <div class="jt-closing" id="closingSection">
          <p class="closing-msg">
            Eres increíble<br>
            <strong>tal como eres.</strong>
          </p>
          <p class="closing-sub">Y siempre lo serás.</p>
        </div>
      </div>

      <audio id="jtAudio" loop preload="auto">
        <source src="${SONG_DATA.audio}" type="audio/mpeg">
      </audio>
    `;
  }

  render();

  requestAnimationFrame(() => {
    // ==========================================
    // 1. STARS CANVAS
    // ==========================================
    const canvas = page.querySelector('#jtStarsCanvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      let stars = [];
      const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        stars = Array.from({ length: 140 }, () => ({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r: Math.random() * 1.2 + 0.3,
          sp: Math.random() * 0.008 + 0.002,
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

    // ==========================================
    // 2. AUDIO PLAYER
    // ==========================================
    const audio = page.querySelector('#jtAudio');
    const playBtn = page.querySelector('#playBtn');
    const bars = page.querySelector('#audioBars');
    const timeDisplay = page.querySelector('#timeDisplay');
    const progressFill = page.querySelector('#progressFill');
    const progressTrack = page.querySelector('#progressTrack');
    const allPairs = page.querySelectorAll('.lyric-block');
    const closing = page.querySelector('#closingSection');

    if (!audio || !playBtn) return;

    let playing = false;
    let lastActive = null;
    let closingShown = false;

    function fmt(sec) {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    }

    function syncLyrics(time) {
      let activePair = null;

      allPairs.forEach(el => {
        const start = parseFloat(el.dataset.start);
        const end = parseFloat(el.dataset.end);
        el.classList.remove('active', 'past');
        if (time >= start && time < end) {
          activePair = el;
        } else if (time >= end) {
          el.classList.add('past');
        }
      });

      if (activePair === lastActive) return;
      lastActive = activePair;

      if (activePair) {
        activePair.classList.add('active');

        // No hacer scroll durante la calibración para anotar tiempos
        if (!calibrationActive) {
          activePair.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        if (parseFloat(activePair.dataset.start) >= 215 && !closingShown) {
          closingShown = true;
          setTimeout(() => closing.classList.add('visible'), 1500);
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
        const t = audio.currentTime;
        timeDisplay.textContent = fmt(t);
        progressFill.style.width = `${(t / audio.duration) * 100}%`;
        syncLyrics(t);

        // Actualizar overlay de calibración si está activo
        const debugTime = document.getElementById('jtDebugTime');
        if (debugTime) {
          const dur = audio.duration;
          debugTime.textContent = `⏱ ${t.toFixed(1)}s / ${dur.toFixed(1)}s (${Math.round((t/dur)*100)}%)`;
        }
      }
    });

    audio.addEventListener('ended', () => {
      playing = false;
      playBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
      bars.classList.remove('playing');
      lastActive = null;
    });

    audio.play().then(() => {
      playing = true;
      playBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
      bars.classList.add('playing');
    }).catch(() => {});

    playBtn.addEventListener('click', togglePlay);

    progressTrack?.addEventListener('click', (e) => {
      if (!audio.duration) return;
      const rect = progressTrack.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      audio.currentTime = pct * audio.duration;
    });

    // ==========================================
    // 3. CALIBRATION MODE (Shift+T)
    //    Muestra el tiempo actual del audio
    //    y los timestamps de cada línea
    // ==========================================
    let calibrationActive = false;
    let calibrateOverlay = null;

    function toggleCalibration() {
      calibrationActive = !calibrationActive;

      // Show/hide timestamps on each lyric pair
      allPairs.forEach(el => {
        const ts = el.querySelector('.lyric-ts');
        if (ts) ts.style.display = calibrationActive ? 'block' : 'none';
      });

      if (calibrationActive) {
        // Create overlay
        calibrateOverlay = document.createElement('div');
        calibrateOverlay.id = 'jtCalibrateOverlay';
        calibrateOverlay.innerHTML = `
          <div style="position:fixed;top:0;left:0;right:0;z-index:9999;
            background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);
            color:#f5c842;font-family:monospace;font-size:1.2rem;
            padding:10px 16px;display:flex;align-items:center;gap:16px;
            justify-content:space-between;border-bottom:1px solid rgba(255,200,50,0.15);">
            <span style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:0.7rem;opacity:0.5;">🔧 CALIBRACIÓN</span>
              <span id="jtDebugTime" style="font-weight:bold;">⏱ 0.0s / —</span>
            </span>
            <span style="font-size:0.7rem;opacity:0.5;">Shift+T para cerrar</span>
          </div>
        `;
        document.body.appendChild(calibrateOverlay);

        // Highlight current pair boundaries
        allPairs.forEach(el => {
          const start = parseFloat(el.dataset.start);
          const end = parseFloat(el.dataset.end);
          el.style.border = '1px dashed rgba(255,200,50,0.15)';
          el.style.position = 'relative';
          el.style.paddingTop = '24px';

          // Show time badge on each pair
          const badge = document.createElement('span');
          badge.className = 'jt-cal-badge';
          badge.textContent = `${start}s → ${end}s`;
          badge.style.cssText = `
            position:absolute;top:-8px;left:8px;
            font-size:0.6rem;font-family:monospace;
            color:#f5c842;opacity:0.5;
            background:var(--theme-bg-card, #1a1a1a);
            padding:1px 6px;border-radius:4px;
          `;
          el.appendChild(badge);
        });
      } else {
        // Remove overlay
        if (calibrateOverlay) {
          calibrateOverlay.remove();
          calibrateOverlay = null;
        }
        // Remove badges
        allPairs.forEach(el => {
          el.style.border = '';
          el.style.paddingTop = '';
          const badge = el.querySelector('.jt-cal-badge');
          if (badge) badge.remove();
        });
      }
    }

    // Keyboard shortcut: Shift+T
    document.addEventListener('keydown', (e) => {
      if (e.key === 'T' && e.shiftKey) {
        e.preventDefault();
        toggleCalibration();
      }
    });

    // ==========================================
    // 4. CLEANUP
    // ==========================================
    page._cleanup = () => {
      if (audio) {
        audio.pause();
        audio.src = '';
      }
      if (calibrateOverlay) calibrateOverlay.remove();
    };

    window.addEventListener('hashchange', () => {
      if (!document.contains(page)) {
        if (page._cleanup) page._cleanup();
      }
    });
  });

  return page;
}
