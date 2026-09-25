/* ==========================================
   Personal Hub v2 — Mal Día Page
   Consuelo, frases, recuerdos y apoyo
   ========================================== */

import { h, icon, openSheet, closeSheets, toast } from '../components/ui.js';
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

export function MalDiaPage(router) {
  const page = document.createElement('div');
  page.className = 'maldia-page';

  /** Crea un <svg> del set compartido (para reemplazar iconos en sitio). */
  const iconEl = (name, size) => {
    const wrap = document.createElement('div');
    wrap.innerHTML = icon(name, size);
    return wrap.firstElementChild;
  };

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
    closeSheets();
  };

  function persistFavs() {
    try { localStorage.setItem(userPrefKey('maldiaFavs'), JSON.stringify([...favPhrases])); } catch { /* quota */ }
  }

  // Una frase a la vez, con navegación ‹ › y corazón de favorita
  function quoteCardHTML() {
    if (!frases.length) return '<p class="md-quote-empty">Aún no hay frases</p>';
    const frase = frases[phraseIdx] || frases[0];
    const fav = favPhrases.has(frase);
    const single = frases.length === 1;
    return `
      <div class="md-quote">
        <p class="md-quote__text">${escapeHtml(frase)}</p>
        <div class="md-quote__foot">
          <div class="md-quote__nav">
            <button type="button" class="icon-btn" id="quotePrev" aria-label="Frase anterior"${single ? ' disabled' : ''}>${icon('back', 18)}</button>
            <span class="md-quote__count">${phraseIdx + 1} / ${frases.length}</span>
            <button type="button" class="icon-btn" id="quoteNext" aria-label="Frase siguiente"${single ? ' disabled' : ''}>${icon('chev', 18)}</button>
          </div>
          <button type="button" class="md-fav${fav ? ' is-on' : ''}" data-quote-fav="${phraseIdx}"
            aria-label="${fav ? 'Quitar de favoritas' : 'Guardar frase'}" aria-pressed="${fav}">${icon('heart', 17)}</button>
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
      <header class="scr-head">
        <div class="md-head-main">
          <button type="button" class="icon-btn md-back" data-back aria-label="Volver a Sentimientos">${icon('back', 18)}</button>
          <div>
            <h1 class="scr-title">Mal día</h1>
            <p class="sub">No estás sola. Aquí estoy.</p>
          </div>
        </div>
      </header>

      <!-- Frase del momento -->
      <section class="md-section">
        <div id="quoteCard">${quoteCardHTML()}</div>
        <div class="md-actions">
          <button type="button" class="btn btn-secondary" id="particlesBtn">${icon('star', 16)} Algo bonito</button>
          <button type="button" class="btn" id="betterBtn">${icon('heart', 16)} Me siento mejor</button>
        </div>
      </section>

      <!-- Música feliz -->
      <div class="md-music">
        <button type="button" class="md-music__play" id="musicPlayBtn" aria-label="Reproducir música" aria-pressed="false">${icon('play', 18)}</button>
        <div class="md-music__body">
          <b id="musicLabel">Música feliz</b>
          <div class="md-music__wave" id="musicWave" aria-hidden="true">${'<i></i>'.repeat(14)}</div>
        </div>
        <div class="md-music__ctrl">
          <button type="button" class="icon-btn" id="musicVolBtn" aria-label="Volumen 100%" title="Volumen">${icon('volume', 17)}</button>
          <input type="range" class="md-music__vol" id="musicVolRange" min="0" max="100" step="1" value="100" aria-label="Volumen" title="Volumen">
        </div>
        <audio id="happyAudio" preload="none" loop>
          <source src="https://res.cloudinary.com/dcsent4fs/video/upload/v1777746763/Zzoilo_Aitana_-_Mon_Amour_Remix_Letra_Lyrics_jrgcjv.m4a" type="audio/mpeg">
        </audio>
      </div>

      <!-- Nota para mí -->
      <section class="md-section">
        <p class="section-title">Déjame una nota</p>
        <div class="md-note">
          <input class="input" id="msgInput" type="text" maxlength="300"
            placeholder="Escríbeme lo que sientas, llegará directo a mí..." aria-label="Escribe una nota para mí" />
          <button type="button" class="btn" id="msgSendBtn" aria-label="Enviar nota">${icon('send', 17)}</button>
        </div>
        <p class="md-note__sent" id="msgSent" hidden>Nota enviada. Llegará directo a mí</p>
      </section>

      <!-- Cosas que pueden ayudarte ahora -->
      <section class="md-section">
        <p class="section-title">Cosas que pueden ayudarte ahora</p>
        <div class="md-help">
          <button type="button" class="md-help__card" data-help="music">
            <span class="md-help__ic">${icon('music', 20)}</span>
            <b>Escuchar música</b>
            <small>Tu playlist feliz</small>
          </button>
          <button type="button" class="md-help__card" data-help="recuerdos">
            <span class="md-help__ic">${icon('image', 20)}</span>
            <b>Ver recuerdos</b>
            <small>La galería</small>
          </button>
          <button type="button" class="md-help__card" data-help="escribir">
            <span class="md-help__ic">${icon('pencil', 20)}</span>
            <b>Escribir</b>
            <small>Saca lo que sientes</small>
          </button>
          <button type="button" class="md-help__card" data-help="respirar">
            <span class="md-help__ic">${icon('flower', 20)}</span>
            <b>Respiración guiada</b>
            <small>Relájate</small>
          </button>
          <button type="button" class="md-help__card" data-help="paseo">
            <span class="md-help__ic">${icon('run', 20)}</span>
            <b>Dar un paseo</b>
            <small>A despejar la mente</small>
          </button>
        </div>
      </section>

      <!-- Respiración guiada -->
      <section class="md-section" id="maldiaBreathing">
        <div class="md-breathe" id="mdBreathe">
          <div class="md-breathe__main">
            <p class="section-title">Respiración guiada</p>
            <p class="md-breathe__sub">Tómate un momento para ti</p>
            <div class="md-breathe__circle-wrap">
              <svg class="md-breathe__ring" viewBox="0 0 140 140" aria-hidden="true">
                <circle class="md-breathe__ring-bg" cx="70" cy="70" r="64"/>
                <circle class="md-breathe__ring-fg" id="breatheRing" cx="70" cy="70" r="64"/>
              </svg>
              <div class="md-breathe__circle" id="breatheCircle">
                <span class="md-breathe__phase" id="breathePhase">Inhala</span>
                <span class="md-breathe__timer" id="breatheTimer">4s</span>
              </div>
            </div>
            <button type="button" class="btn" id="breatheToggle">
              ${icon('play', 16)}
              <span id="breatheToggleLabel">Comenzar</span>
            </button>
          </div>
          <ol class="md-breathe__steps">
            ${BREATH_PHASES.map((ph, i) => `
              <li data-phase="${ph.key}" class="${i === 0 ? 'active' : ''}">
                <span class="md-breathe__num">${i + 1}</span>
                ${ph.label}
              </li>`).join('')}
          </ol>
        </div>
      </section>
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
      favBtn.innerHTML = icon('heart', 17);
      toast(favPhrases.has(frase) ? 'Frase guardada' : 'Frase quitada de favoritas');
    });

    // Algo bonito
    document.getElementById('particlesBtn')?.addEventListener('click', () => {
      toast('Te quiero mucho, princesa');
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
      volBtn.innerHTML = icon(volume === 0 ? 'muted' : (volume < 1 ? 'volumeLow' : 'volume'), 17);
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
        playBtn.innerHTML = icon('play', 18);
      } else {
        audioPlayer.volume = volume;
        audioPlayer.play().catch(() => {});
        isMusicPlaying = true;
        document.getElementById('musicWave')?.classList.add('playing');
        document.getElementById('musicLabel').textContent = 'Sonando';
        playBtn.innerHTML = icon('pause', 18);
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
      if (!value) { toast('Escribe una nota antes de enviar'); return; }
      try {
        await db.saveMaldiaNote(value);
      } catch (err) {
        toast(err?.message || 'No se pudo enviar la nota');
        return;
      }
      if (msgInput) msgInput.value = '';
      if (msgSent) {
        msgSent.hidden = false;
        msgSent.style.animation = 'none';
        void msgSent.offsetWidth; // reinicia la animación
        msgSent.style.animation = '';
      }
      toast('Nota enviada. Llegará directo a mí');
    };
    document.getElementById('msgSendBtn')?.addEventListener('click', sendMsg);
    msgInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMsg(); });

    // Me siento mejor (gatito) — el vídeo vive en el sheet del sistema
    document.getElementById('betterBtn')?.addEventListener('click', () => {
      openSheet('Te quiero', () => {
        const body = h('div', { class: 'md-better' });
        const video = h('video', {
          src: 'https://res.cloudinary.com/dcsent4fs/video/upload/v1777134957/gatito_isgr4b.mp4',
          autoplay: true, loop: true, muted: true, playsinline: true
        });
        body.append(video, h('p', { class: 'md-better__msg' }, 'Siempre estaré aquí para ti mi reina.'));
        return body;
      });
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
          breathingEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          startBreathing();
        } else if (action === 'paseo') {
          toast('Sal a dar un paseo. El aire te sentará genial');
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
    const RING_C = 2 * Math.PI * 64;

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
      page.querySelectorAll('.md-breathe__steps li').forEach(li =>
        li.classList.toggle('active', li.dataset.phase === key));
      setRing(progress);
    }

    function startBreathing() {
      if (breathingRunning) return;
      breathingRunning = true;
      if (toggleLabel) toggleLabel.textContent = 'Detener';
      if (toggleBtn) toggleBtn.firstElementChild?.replaceWith(iconEl('pause', 16));
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
      if (toggleBtn) toggleBtn.firstElementChild?.replaceWith(iconEl('play', 16));
      if (phaseEl) phaseEl.textContent = 'Inhala';
      if (timerEl) timerEl.textContent = '4s';
      if (circle) circle.style.transform = 'scale(1)';
      setRing(0);
      page.querySelectorAll('.md-breathe__steps li').forEach(li =>
        li.classList.toggle('active', li.dataset.phase === 'inhale'));
    }

    toggleBtn?.addEventListener('click', () => {
      if (breathingRunning) stopBreathing();
      else startBreathing();
    });

    // ESC detiene la respiración (el sheet se cierra solo)
    onKeyDown = (e) => {
      if (e.key === 'Escape') stopBreathing();
    };
    document.addEventListener('keydown', onKeyDown);
  });

  return page;
}
