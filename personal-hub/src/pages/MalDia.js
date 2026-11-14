/* ==========================================
   Personal Hub v2 — Mal Día Page
   Consuelo y conversación, como un chat
   ========================================== */

import { h, icon, openSheet, closeSheets, toast } from '../components/ui.js';
import { db } from '../services/db.service.js';
import { onContentChange } from '../services/realtime.service.js';
import { userStore } from '../stores/user.store.js';
import { notifyAdminOfNote } from '../services/notifications.service.js';

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

  let isMusicPlaying = false;
  let audioPlayer = null;
  let breathingInterval = null;
  let breathingRunning = false;
  let onKeyDown = null;
  let notesOff = null;   // suscripción al rol de usuario (sección de notas)
  let threadItems = [];  // mensajes pintados ahora mismo (para responder/borrar)
  let replyTarget = null; // mensaje citado en la respuesta que se está escribiendo

  // Las respuestas del admin viven en `content`, así que Realtime ya las
  // empuja a los dos: la conversación se repinta sin pulsar «Actualizar».
  const offThread = onContentChange(['maldia_conversacion'], () => { renderConversation(); });

  page.cleanup = () => {
    offThread();
    if (onKeyDown) document.removeEventListener('keydown', onKeyDown);
    if (breathingInterval) { clearInterval(breathingInterval); breathingInterval = null; }
    if (audioPlayer) { audioPlayer.pause(); audioPlayer = null; }
    if (notesOff) { notesOff(); notesOff = null; }
    closeSheets();
  };

  // ==========================================
  // LA CONVERSACIÓN — ambos leen lo del otro
  // Sus notas vienen de user_progress (todas si es admin, solo las suyas si
  // es ella) y las respuestas del admin, de `content`.
  // ==========================================
  /** Hora del mensaje, como en cualquier chat (14:32). */
  function noteClock(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  }

  function noteAuthor(note) {
    const mail = String(note?.email || '');
    return mail ? mail.split('@')[0] : 'Princesa🤍';
  }

  /**
   * Cita el mensaje al que se va a responder (solo admin). Aparece encima del
   * campo de escribir hasta que se envía o se cancela.
   */
  function showReplyTarget(msg) {
    replyTarget = msg
      ? {
        text: String(msg.text || '').slice(0, 140),
        author: msg.fromAdmin ? 'Peluche🧸' : noteAuthor(msg)
      }
      : null;
    const bar = page.querySelector('#mdThreadReply');
    const textEl = page.querySelector('#mdThreadReplyText');
    if (!bar || !textEl) return;
    if (!replyTarget) {
      bar.hidden = true;
      textEl.textContent = '';
      textEl.title = '';
      return;
    }
    bar.hidden = false;
    textEl.textContent = `Respondiendo a ${replyTarget.author}: “${replyTarget.text}”`;
    textEl.title = replyTarget.text;
    page.querySelector('#mdThreadInput')?.focus();
  }

  const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  /** Fecha del separador: Hoy, Ayer o el día con su mes. */
  function dayLabel(d) {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (dayKey(d) === dayKey(today)) return 'Hoy';
    if (dayKey(d) === dayKey(yesterday)) return 'Ayer';
    const opts = { day: 'numeric', month: 'long' };
    if (d.getFullYear() !== today.getFullYear()) opts.year = 'numeric';
    return d.toLocaleDateString('es', opts);
  }

  /** Burbujas agrupadas por día, con la fecha centrada encima de cada grupo. */
  function threadHTML(items) {
    const iAmAdmin = userStore.isAdmin;
    let currentDay = null;
    return items.map((m, idx) => {
      const own = Boolean(m.fromAdmin) === iAmAdmin;
      const author = m.fromAdmin ? 'Peluche🧸' : noteAuthor(m);
      const date = m.createdAt ? new Date(m.createdAt) : null;
      const validDate = date && !Number.isNaN(date.getTime());
      const when = noteClock(m.createdAt);
      let divider = '';
      if (validDate) {
        const key = dayKey(date);
        if (key !== currentDay) {
          currentDay = key;
          divider = `<p class="md-chat__day"><span>${escapeHtml(dayLabel(date))}</span></p>`;
        }
      }
      // La cita viaja con el mensaje: se ve igual en las dos cuentas.
      const quote = m.replyTo && m.replyTo.text
        ? `<blockquote class="md-bubble__quote">${m.replyTo.author ? `<b>${escapeHtml(m.replyTo.author)}</b> ` : ''}${escapeHtml(m.replyTo.text)}</blockquote>`
        : '';
      // Responder a un mensaje concreto y borrarlo son solo del admin.
      const tools = iAmAdmin ? `
        <span class="md-bubble__tools">
          <button type="button" class="md-bubble__tool md-bubble__tool--reply" data-reply-idx="${idx}"
            aria-label="Responder a este mensaje" title="Responder">${icon('back', 12)}</button>
          <button type="button" class="md-bubble__tool" data-delete-idx="${idx}"
            aria-label="Eliminar este mensaje" title="Eliminar">${icon('trash', 12)}</button>
        </span>` : '';
      return `${divider}
      <div class="md-bubble ${own ? 'md-bubble--out' : 'md-bubble--in'}">
        ${own ? '' : `<span class="md-bubble__who">${escapeHtml(author)}</span>`}
        ${quote}
        <p class="md-bubble__text">${escapeHtml(m.text || '—')}</p>
        <span class="md-bubble__meta">${when ? `<span class="md-bubble__time">${escapeHtml(when)}</span>` : ''}${own
          ? `<span class="md-bubble__tick" aria-label="Enviado">${icon('check', 12)}${icon('check', 12)}</span>`
          : ''}</span>
        ${tools}
      </div>`;
    }).join('');
  }

  async function renderConversation() {
    const section = page.querySelector('#mdThreadSection');
    const list = page.querySelector('#mdThreadList');
    if (!section || !list) return;
    const isAdmin = userStore.isAdmin;
    const compose = page.querySelector('#mdChatCompose');
    // Sin sesión no hay conversación que enseñar (ni barra para escribir).
    if (!isAdmin && !userStore.isLoggedIn) {
      section.hidden = true;
      if (compose) compose.hidden = true;
      showReplyTarget(null);
      return;
    }
    section.hidden = false;
    if (compose) compose.hidden = false;

    const subEl = page.querySelector('#mdThreadSub');
    if (subEl) {
      subEl.hidden = false;
      subEl.textContent = isAdmin
        ? 'Todo lo que hemos escrito, en orden. Lo que respondas aquí le llega al momento.'
        : 'Tú y yo en un mismo sitio. Escríbelo aquí y su respuesta aparecerá aquí mismo.';
    }
    const input = page.querySelector('#mdThreadInput');
    if (input) {
      input.placeholder = isAdmin
        ? 'Responde aquí; lo leerá en cuanto entre...'
        : 'Escríbeme lo que sientas, llegará directo a mí...';
    }
    const countEl = page.querySelector('#mdThreadCount');
    if (!list.dataset.ready) list.innerHTML = '<p class="md-thread__hint">Cargando la conversación…</p>';

    const [res] = await Promise.allSettled([db.getMaldiaConversation()]);
    if (!page.contains(section)) return; // la página se cerró mientras cargaba

    const items = res.status === 'fulfilled' && Array.isArray(res.value) ? res.value : [];
    threadItems = items;
    list.dataset.ready = '1';
    if (countEl) countEl.textContent = String(items.length);
    list.innerHTML = items.length
      ? threadHTML(items)
      : '<p class="md-thread__empty">Todavía no hay mensajes. El primero que escribas aparecerá aquí.</p>';
    // Lo último, a la vista (la ventana del chat es la que scrollea).
    const stream = page.querySelector('#mdChatStream');
    if (stream) stream.scrollTop = stream.scrollHeight;
  }

  function render() {
    page.innerHTML = `
      <!-- Título de la página: en móvil lo pone la barra superior -->
      <div class="scr-head md-page-head">
        <div>
          <h1 class="scr-title">Mal día</h1>
          <p class="sub">No estás sola. Aquí estoy.</p>
        </div>
      </div>

      <div class="md-chat">
        <header class="md-chat__head">
          <button type="button" class="md-chat__back" data-back aria-label="Volver a Sentimientos">${icon('back', 20)}</button>
          <span class="md-chat__avatar" aria-hidden="true">${icon('heart', 18)}</span>
          <div class="md-chat__who">
            <b>${userStore.isAdmin ? 'Princesa🤍' : 'Peluche🧸'}</b>
            <small><i class="md-chat__dot"></i> en línea</small>
          </div>
          <div class="md-chat__menu-wrap">
            <button type="button" class="md-chat__tool" id="mdChatMenuBtn" aria-label="Más opciones"
              aria-haspopup="menu" aria-expanded="false">${icon('more', 20)}</button>
            <div class="md-chat__menu" id="mdChatMenu" role="menu" hidden>
              <button type="button" class="md-chat__menu-item" role="menuitem" id="openBreatheBtn">
                ${icon('flower', 16)}
                <span>Respiración guiada</span>
              </button>
            </div>
          </div>
        </header>

        <div class="md-chat__body">
          <div class="md-chat__stream" id="mdChatStream">
            <!-- La conversación: sus notas y las respuestas del admin -->
            <section class="md-thread" id="mdThreadSection" hidden aria-label="Nuestra conversación">
              <p class="md-chat__day"><span>Nuestra conversación · <em id="mdThreadCount">0</em></span></p>
              <p class="md-thread__sub" id="mdThreadSub" hidden></p>
              <div class="md-thread__list" id="mdThreadList"></div>
            </section>
          </div>

          <!-- Bajar / subir en la conversación -->
          <div class="md-chat__jump">
            <button type="button" class="md-chat__jumpbtn md-chat__jumpbtn--top" id="mdJumpTop" aria-label="Ir arriba del todo" title="Ir arriba">${icon('chev', 18)}</button>
            <button type="button" class="md-chat__jumpbtn md-chat__jumpbtn--bottom" id="mdJumpBottom" aria-label="Ir abajo del todo" title="Ir abajo">${icon('chev', 18)}</button>
          </div>
        </div>

        <!-- Respuestas rápidas + música -->
        <div class="md-chat__quick">
          <button type="button" class="md-quick__chip" id="particlesBtn">${icon('star', 14)} Algo bonito</button>
          <button type="button" class="md-quick__chip" id="betterBtn">${icon('heart', 14)} Me siento mejor</button>
          <div class="md-audio-pill">
            <button type="button" class="md-audio__play" id="musicPlayBtn" aria-label="Reproducir música" aria-pressed="false">${icon('play', 15)}</button>
            <div class="md-audio__body">
              <span class="md-audio__wave" id="musicWave" aria-hidden="true">${'<i></i>'.repeat(12)}</span>
              <span class="md-audio__meta">
                <b id="musicLabel">Música feliz</b>
                <small id="musicState">en pausa</small>
              </span>
            </div>
            <button type="button" class="md-audio__volbtn" id="musicVolBtn" aria-label="Volumen 100%" title="Volumen">${icon('volume', 15)}</button>
            <input type="range" class="md-audio__range" id="musicVolRange" min="0" max="100" step="1" value="100" aria-label="Volumen" title="Volumen">
          </div>
          <audio id="happyAudio" preload="none" loop>
            <source src="https://res.cloudinary.com/dcsent4fs/video/upload/v1777746763/Zzoilo_Aitana_-_Mon_Amour_Remix_Letra_Lyrics_jrgcjv.m4a" type="audio/mpeg">
          </audio>
        </div>

        <div class="md-chat__reply" id="mdThreadReply" hidden>
          <span class="md-chat__reply-text" id="mdThreadReplyText"></span>
          <button type="button" class="md-chat__reply-cancel" id="mdThreadReplyCancel"
            aria-label="Cancelar la respuesta">${icon('x', 14)}</button>
        </div>

        <div class="md-chat__compose" id="mdChatCompose">
          <input class="md-chat__input" id="mdThreadInput" type="text" maxlength="300"
            placeholder="Escríbeme lo que sientas, llegará directo a mí..." aria-label="Escribe un mensaje" autocomplete="off" />
          <button type="button" class="md-chat__send" id="mdThreadSend" aria-label="Enviar mensaje">${icon('send', 18)}</button>
        </div>
      </div>

      <!-- Respiración guiada: tarjeta flotante desde los 3 puntos -->
      <div class="md-float" id="mdBreatheLayer" hidden>
        <div class="md-float__backdrop" data-breathe-close></div>
        <div class="md-float__card" id="maldiaBreathing" role="dialog" aria-modal="true" aria-labelledby="mdBreatheTitle">
          <button type="button" class="md-float__close" data-breathe-close aria-label="Cerrar">${icon('x', 18)}</button>
          <div class="md-breathe md-breathe--float" id="mdBreathe">
            <div class="md-breathe__main">
              <p class="section-title" id="mdBreatheTitle">Respiración guiada</p>
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
        </div>
      </div>
    `;
  }

  render();

  // onChange notifica ya con el estado actual, así que la conversación
  // aparece en cuanto el rol está resuelto.
  notesOff = userStore.onChange(() => { renderConversation(); });

  requestAnimationFrame(() => {
    audioPlayer = document.getElementById('happyAudio');

    // Volver
    page.querySelectorAll('[data-back]').forEach(btn =>
      btn.addEventListener('click', () => router.navigate('/sentimientos')));

    // Algo bonito
    document.getElementById('particlesBtn')?.addEventListener('click', () => {
      toast('Te quiero mucho, princesa');
    });

    // Bajar / subir del todo en la conversación
    const streamEl = document.getElementById('mdChatStream');
    document.getElementById('mdJumpTop')?.addEventListener('click', () => {
      streamEl?.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.getElementById('mdJumpBottom')?.addEventListener('click', () => {
      if (streamEl) streamEl.scrollTo({ top: streamEl.scrollHeight, behavior: 'smooth' });
    });

    // Menú de los 3 puntos (solo admin)
    const menuBtn = document.getElementById('mdChatMenuBtn');
    const menu = document.getElementById('mdChatMenu');
    const closeMenu = () => {
      if (!menu || menu.hidden) return;
      menu.hidden = true;
      menuBtn?.setAttribute('aria-expanded', 'false');
    };
    menuBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!menu) return;
      menu.hidden = !menu.hidden;
      menuBtn.setAttribute('aria-expanded', String(!menu.hidden));
    });
    page.addEventListener('click', (e) => {
      if (!e.target.closest('.md-chat__menu-wrap')) closeMenu();
    });

    // Respiración guiada: se abre en una tarjeta flotante
    const breatheLayer = document.getElementById('mdBreatheLayer');
    const closeBreathing = () => {
      if (!breatheLayer || breatheLayer.hidden) return;
      stopBreathing();
      breatheLayer.hidden = true;
    };
    document.getElementById('openBreatheBtn')?.addEventListener('click', () => {
      closeMenu();
      if (!breatheLayer) return;
      breatheLayer.hidden = false;
      toggleBtn?.focus();
    });
    breatheLayer?.querySelectorAll('[data-breathe-close]').forEach(el =>
      el.addEventListener('click', closeBreathing));

    // Música: play/pausa + volumen (botón y deslizador)
    const playBtn = document.getElementById('musicPlayBtn');
    const volBtn = document.getElementById('musicVolBtn');
    const volRange = document.getElementById('musicVolRange');
    const stateEl = document.getElementById('musicState');
    const VOL_STEPS = [1, 0.66, 0.33, 0];
    let volIdx = 0;
    let volume = 1; // volumen actual (0..1)

    function setVolume(v) {
      volume = Math.min(1, Math.max(0, v));
      if (audioPlayer) audioPlayer.volume = volume;
      if (volRange) volRange.value = String(Math.round(volume * 100));
      const pct = Math.round(volume * 100);
      volRange?.style.setProperty('--vol-fill', `${pct}%`);
      volBtn.innerHTML = icon(volume === 0 ? 'muted' : (volume < 1 ? 'volumeLow' : 'volume'), 15);
      volBtn.setAttribute('aria-label', volume === 0 ? 'Activar volumen' : `Volumen ${pct}%`);
      volBtn.title = volume === 0 ? 'Volumen silenciado' : `Volumen ${pct}%`;
    }

    function togglePlay() {
      if (!audioPlayer) return;
      if (isMusicPlaying) {
        audioPlayer.pause();
        isMusicPlaying = false;
        document.getElementById('musicWave')?.classList.remove('playing');
        if (stateEl) stateEl.textContent = 'en pausa';
        playBtn.innerHTML = icon('play', 15);
      } else {
        audioPlayer.volume = volume;
        audioPlayer.play().catch(() => {});
        isMusicPlaying = true;
        document.getElementById('musicWave')?.classList.add('playing');
        if (stateEl) stateEl.textContent = 'sonando';
        playBtn.innerHTML = icon('pause', 15);
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

    // Enviar a la conversación. Mismo campo para los dos: ella deja una nota
    // (user_progress) y él responde (content), y ambos leen la mezcla.
    const threadInput = document.getElementById('mdThreadInput');
    const sendMsg = async () => {
      const value = (threadInput?.value || '').trim();
      if (!value) { toast('Escribe un mensaje antes de enviar'); return; }
      const isAdmin = userStore.isAdmin;
      let saved;
      try {
        saved = isAdmin
          ? await db.saveMaldiaReply(value, replyTarget)
          : await db.saveMaldiaNote(value);
      } catch (err) {
        toast(err?.message || 'No se pudo enviar el mensaje');
        return;
      }
      if (threadInput) threadInput.value = '';
      showReplyTarget(null);
      // synced=false: el mensaje solo quedó en este dispositivo (sin sesión o
      // sin respuesta del servidor), así que no se promete que llegue.
      const synced = saved?.synced !== false;
      // Aviso al admin por push (024), solo para las notas de ella y solo si
      // llegaron al servidor: un aviso de algo que sigue en el dispositivo
      // abriría una conversación donde todavía no está.
      if (synced && !isAdmin) notifyAdminOfNote().catch(() => { /* la nota ya está guardada */ });
      toast(isAdmin
        ? 'Respuesta enviada'
        : (synced ? 'Mensaje enviado. Llegará directo a mí' : 'Guardado aquí, pero no se pudo sincronizar. Inténtalo más tarde'));
      // Se repinta en el acto: el mensaje propio aparece al final sin recargar.
      renderConversation();
    };
    document.getElementById('mdThreadSend')?.addEventListener('click', sendMsg);
    threadInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMsg(); });
    page.querySelector('#mdThreadReplyCancel')?.addEventListener('click', () => showReplyTarget(null));

    // Responder a un mensaje concreto y borrarlo: delegado en la lista porque
    // las burbujas se repintan cada vez que llega algo.
    page.querySelector('#mdThreadList')?.addEventListener('click', async (e) => {
      const replyBtn = e.target.closest('[data-reply-idx]');
      if (replyBtn) {
        const msg = threadItems[parseInt(replyBtn.dataset.replyIdx, 10)];
        if (msg) showReplyTarget(msg);
        return;
      }

      const delBtn = e.target.closest('[data-delete-idx]');
      if (!delBtn) return;
      const msg = threadItems[parseInt(delBtn.dataset.deleteIdx, 10)];
      if (!msg) return;
      if (!confirm('¿Eliminar este mensaje de la conversación?')) return;
      try {
        await db.deleteMaldiaMessage(msg);
      } catch (err) {
        toast(err?.message || 'No se pudo eliminar el mensaje');
        return;
      }
      if (replyTarget && replyTarget.text === String(msg.text || '').slice(0, 140)) showReplyTarget(null);
      toast('Mensaje eliminado');
      renderConversation();
    });

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

    // ESC cierra la tarjeta (y detiene la respiración)
    onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      closeBreathing();
      closeMenu();
      stopBreathing();
    };
    document.addEventListener('keydown', onKeyDown);
  });

  return page;
}
