/* ==========================================
   Personal Hub v2 — Mal Día Page
   Consuelo y conversación, como un chat
   A pantalla completa: sin barras, se sale con la flecha o deslizando
   ========================================== */

import { h, icon, openSheet, closeSheets, toast } from '../components/ui.js';
import { db } from '../services/db.service.js';
import { onContentChange } from '../services/realtime.service.js';
import { watchPartnerPresence, setTyping, fetchPartnerProfile } from '../services/presence.service.js';
import { userStore } from '../stores/user.store.js';
import { notifyAdminOfNote } from '../services/notifications.service.js';

// Ciclo de respiración: 4 fases con duración (ms) y escala del círculo
const BREATH_PHASES = [
  { key: 'inhale', label: 'Inhala',  dur: 4000, from: 1,    to: 1.35 },
  { key: 'hold',   label: 'Mantén',  dur: 4000, from: 1.35, to: 1.35 },
  { key: 'exhale', label: 'Exhala',  dur: 4000, from: 1.35, to: 1 },
  { key: 'rest',   label: 'Descansa', dur: 5000, from: 1,    to: 1 }
];

// Emojis del panel del compositor. Se insertan en el mensaje, no se envían solos.
const EMOJIS = ['🤍', '❤️', '🥺', '😘', '🌷', '✨', '🧸', '🫂', '💗', '🌙', '☁️', '⭐'];

// Dos mensajes seguidos del mismo autor se leen como un grupo si no pasa esto.
const GROUP_MS = 5 * 60 * 1000;

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// "Algo bonito": confeti y emojis de la web saliendo del mensaje.
const LOVE_EMOJIS = ['🤍', '❤️', '✨', '🌸', '⭐', '🧸', '💫'];
const LOVE_COLORS = ['#ff6b8b', '#ffb03a', '#ffe66d', '#7bd88f', '#6fb7ff', '#c58fff'];
// Un solo reloj para el mensaje y las partículas: aparecen y se van juntos.
const LOVE_MS = 3200;
const LOVE_FADE = 420;
let loveTimer = null;
let loveFadeTimer = null;

/** Lanza una explosión de confeti + emojis desde el centro del mensaje. */
function loveBurst(card) {
  const layer = document.getElementById('mdLoveLayer');
  if (!layer || !card) return;
  const rect = card.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const bits = 36;
  for (let i = 0; i < bits; i++) {
    const isEmoji = i % 3 === 0;
    const bit = document.createElement('span');
    bit.className = isEmoji ? 'md-love-bit md-love-bit--emoji' : 'md-love-bit';
    if (isEmoji) bit.textContent = LOVE_EMOJIS[i % LOVE_EMOJIS.length];
    else bit.style.background = LOVE_COLORS[i % LOVE_COLORS.length];
    const angle = (Math.PI * 2 * i) / bits + Math.random() * 0.35;
    const dist = 100 + Math.random() * 170;
    bit.style.left = `${cx}px`;
    bit.style.top = `${cy}px`;
    bit.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    bit.style.setProperty('--dy', `${Math.sin(angle) * dist - 60}px`);
    bit.style.setProperty('--rot', `${(Math.random() - 0.5) * 620}deg`);
    bit.style.setProperty('--delay', `${Math.random() * 120}ms`);
    layer.appendChild(bit);
  }

  // Y emojis repartidos por TODA la pantalla, no solo alrededor del mensaje.
  const screenEmojis = window.innerWidth < 520 ? 12 : 20;
  for (let i = 0; i < screenEmojis; i++) {
    const star = document.createElement('span');
    star.className = 'md-love-bit md-love-bit--emoji md-love-bit--scatter';
    star.textContent = LOVE_EMOJIS[i % LOVE_EMOJIS.length];
    star.style.left = `${4 + Math.random() * 92}vw`;
    star.style.top = `${6 + Math.random() * 84}vh`;
    star.style.fontSize = `${18 + Math.random() * 12}px`;
    star.style.setProperty('--delay', `${Math.random() * 420}ms`);
    layer.appendChild(star);
  }
}

/** Muestra el mensaje y hace saltar el confeti desde él. */
function showLove() {
  const card = document.getElementById('mdLove');
  const layer = document.getElementById('mdLoveLayer');
  if (!card || !layer) return;
  clearTimeout(loveTimer);
  clearTimeout(loveFadeTimer);
  layer.classList.remove('is-fading');
  layer.innerHTML = '';
  card.hidden = false;
  card.classList.remove('is-out');
  loveBurst(card);
  // El mensaje y las partículas se desvanecen a la vez y desaparecen a la vez.
  loveFadeTimer = setTimeout(() => {
    card.classList.add('is-out');
    layer.classList.add('is-fading');
  }, LOVE_MS - LOVE_FADE);
  loveTimer = setTimeout(() => {
    card.hidden = true;
    layer.classList.remove('is-fading');
    layer.innerHTML = '';
  }, LOVE_MS);
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
  let offPresence = null; // estado en línea del otro lado
  let swipeCleanup = null;
  let presenceState = { online: false, at: null, typing: false, userId: null };
  let lastCount = 0;
  let partnerPhotoTries = 0;   // no insistir con el perfil en cada latido
  let partnerPhotoTriedAt = 0;

  // Las respuestas del admin viven en `content`, así que Realtime ya las
  // empuja a los dos: la conversación se repinta sin pulsar «Actualizar».
  const offThread = onContentChange(['maldia_conversacion'], () => { renderConversation(); });

  page.cleanup = () => {
    offThread();
    if (offPresence) { offPresence(); offPresence = null; }
    if (onKeyDown) document.removeEventListener('keydown', onKeyDown);
    if (breathingInterval) { clearInterval(breathingInterval); breathingInterval = null; }
    if (audioPlayer) { audioPlayer.pause(); audioPlayer = null; }
    if (notesOff) { notesOff(); notesOff = null; }
    if (swipeCleanup) { swipeCleanup(); swipeCleanup = null; }
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

  /** Fecha válida del mensaje, o null si no la tiene. */
  function messageDate(m) {
    const d = m?.createdAt ? new Date(m.createdAt) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
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

  /** ¿Estos dos mensajes se pintan pegados, como un solo grupo del chat? */
  function sameGroup(a, b) {
    if (!a || !b) return false;
    if (Boolean(a.fromAdmin) !== Boolean(b.fromAdmin)) return false;
    const da = messageDate(a);
    const db = messageDate(b);
    if (!da || !db) return false;
    if (dayKey(da) !== dayKey(db)) return false;
    return Math.abs(db - da) <= GROUP_MS;
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

  /**
   * Burbujas agrupadas por día y por autor. La cola solo va en la última del
   * grupo y el nombre solo en la primera: es lo que hace que un hilo se lea
   * como una conversación y no como una lista de tarjetas.
   */
  function threadHTML(items) {
    const iAmAdmin = userStore.isAdmin;
    let currentDay = null;
    return items.map((m, idx) => {
      const own = Boolean(m.fromAdmin) === iAmAdmin;
      const author = m.fromAdmin ? 'Peluche🧸' : noteAuthor(m);
      const date = messageDate(m);
      const when = noteClock(m.createdAt);
      const prev = items[idx - 1];
      const next = items[idx + 1];
      const startsGroup = !sameGroup(prev, m);
      const endsGroup = !sameGroup(m, next);

      let divider = '';
      if (date && dayKey(date) !== currentDay) {
        currentDay = dayKey(date);
        divider = `<p class="md-chat__day"><span>${escapeHtml(dayLabel(date))}</span></p>`;
      }

      // La cita viaja con el mensaje: se ve igual en las dos cuentas.
      const quote = m.replyTo && m.replyTo.text
        ? `<blockquote class="md-bubble__quote">${m.replyTo.author ? `<b>${escapeHtml(m.replyTo.author)}</b> ` : ''}${escapeHtml(m.replyTo.text)}</blockquote>`
        : '';
      // Tocar el mensaje abre sus acciones (responder, eliminar…). El menú
      // vive fuera de la burbuja: aquí solo va el asa para abrirlo y solo el
      // admin la tiene.
      const canAct = iAmAdmin ? ` data-msg-idx="${idx}" tabindex="0" role="button" aria-haspopup="dialog" aria-label="Acciones del mensaje"` : '';

      return `${divider}
      <div class="md-bubble ${own ? 'md-bubble--out' : 'md-bubble--in'}${startsGroup ? ' md-bubble--start' : ''}${endsGroup ? ' md-bubble--tail' : ''}${canAct ? ' md-bubble--tappable' : ''}"${canAct}>
        ${own || !startsGroup ? '' : `<span class="md-bubble__who">${escapeHtml(author)}</span>`}
        ${quote}
        <p class="md-bubble__text">${escapeHtml(m.text || '—')}</p>
        <span class="md-bubble__meta">${when ? `<span class="md-bubble__time">${escapeHtml(when)}</span>` : ''}${own
          ? `<span class="md-bubble__tick" aria-label="Enviado">${icon('check', 12)}${icon('check', 12)}</span>`
          : ''}</span>
      </div>`;
    }).join('');
  }

  function isNearBottom(el, pad = 150) {
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < pad;
  }

  function scrollToBottom(stream = page.querySelector('#mdChatStream')) {
    if (!stream) return;
    requestAnimationFrame(() => { stream.scrollTop = stream.scrollHeight; });
  }

  function showNewPill() {
    const pill = page.querySelector('#mdNewPill');
    if (pill) pill.hidden = false;
  }

  function hideNewPill() {
    const pill = page.querySelector('#mdNewPill');
    if (pill && !pill.hidden) pill.hidden = true;
  }

  /** ¿El otro lado está escribiendo? La cabecera y la burbuja lo cuentan. */
  function paintTyping() {
    const bubble = page.querySelector('#mdTyping');
    const section = page.querySelector('#mdThreadSection');
    if (!bubble) return;
    bubble.hidden = !(presenceState.typing && section && !section.hidden);
  }

  function paintStatus() {
    const statusEl = page.querySelector('#mdChatStatus');
    const statusText = page.querySelector('#mdChatStatusText');
    const chat = page.querySelector('.md-chat');
    const { online, at, typing } = presenceState;
    const onlineState = typing ? 'typing' : (online ? 'true' : 'false');

    if (chat) chat.dataset.online = onlineState;
    if (statusEl) {
      statusEl.dataset.online = onlineState;
      statusEl.title = at
        ? `${online ? 'Ahora' : 'Última vez'} · ${new Date(at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`
        : 'Sin datos de conexión todavía';
    }
    if (statusText) {
      statusText.textContent = typing
        ? 'escribiendo…'
        : online
          ? 'en línea'
          : at
            ? `desconectada · ${new Date(at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`
            : 'desconectada';
    }
    paintTyping();
  }

  /**
   * La foto de perfil de la otra persona, la suya de verdad. Se pide al
   * latido (que ya trae su id) y se pinta solo si tiene; si no hay foto se
   * queda el corazón. Reintenta un par de veces por si el perfil aún carga.
   */
  async function paintPartnerPhoto(userId = null) {
    const avatar = page.querySelector('#mdChatAvatar');
    if (!avatar || avatar.classList.contains('has-photo')) return;
    if (partnerPhotoTries >= 3) return;
    if (Date.now() - partnerPhotoTriedAt < 30000) return;
    partnerPhotoTriedAt = Date.now();
    partnerPhotoTries += 1;

    const profile = await fetchPartnerProfile(userId);
    if (!page.contains(avatar) || !profile?.avatar) return;
    if (avatar.classList.contains('has-photo')) return;

    const img = document.createElement('img');
    img.className = 'md-chat__avatar-img';
    img.alt = '';
    img.decoding = 'async';
    // Si la URL falla, el corazón vuelve y no se insiste más en esta visita.
    img.addEventListener('error', () => {
      img.remove();
      avatar.classList.remove('has-photo');
      partnerPhotoTries = 3;
    });
    img.src = profile.avatar;
    avatar.prepend(img);
    avatar.classList.add('has-photo');
  }

  async function renderConversation({ forceBottom = false } = {}) {
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

    const input = page.querySelector('#mdThreadInput');
    if (input) {
      input.placeholder = isAdmin
        ? 'Escribe una respuesta…'
        : 'Escríbeme lo que sientas…';
    }

    const stream = page.querySelector('#mdChatStream');
    // Si estabas abajo, la conversación te sigue; si estabas leyendo arriba,
    // no te movemos la vista: aparece la píldora de mensajes nuevos.
    const stick = forceBottom || !list.dataset.ready || isNearBottom(stream);
    const prevCount = lastCount;

    const [res] = await Promise.allSettled([db.getMaldiaConversation()]);
    if (!page.contains(section)) return; // la página se cerró mientras cargaba

    const items = res.status === 'fulfilled' && Array.isArray(res.value) ? res.value : [];
    threadItems = items;
    lastCount = items.length;
    list.dataset.ready = '1';
    list.innerHTML = threadHTML(items);

    const empty = page.querySelector('#mdThreadEmpty');
    if (empty) empty.hidden = items.length > 0;

    paintTyping();
    if (stick) {
      hideNewPill();
      scrollToBottom(stream);
    } else if (items.length > prevCount) {
      showNewPill();
    }
  }

  function render() {
    page.innerHTML = `
      <div class="md-chat">
        <header class="md-chat__head">
          <button type="button" class="md-chat__back" data-back aria-label="Volver a Sentimientos">${icon('back', 22)}</button>
          <span class="md-chat__avatar" id="mdChatAvatar" aria-hidden="true">
            ${icon('heart', 18)}
            <i class="md-chat__badge"></i>
          </span>
          <div class="md-chat__who">
            <b>${userStore.isAdmin ? 'Princesa🤍' : 'Peluche🧸'}</b>
            <small class="md-chat__status" id="mdChatStatus" data-online="unknown"><i class="md-chat__dot"></i> <span id="mdChatStatusText">comprobando…</span></small>
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

        <!-- Canción fijada, como el mensaje fijado de un chat -->
        <div class="md-pin" aria-label="Nuestra canción">
          <span class="md-pin__icon" aria-hidden="true">${icon('music', 15)}</span>
          <div class="md-pin__meta">
            <b id="musicLabel">Nuestra canción</b>
            <small id="musicState">en pausa</small>
          </div>
          <span class="md-audio__wave" id="musicWave" aria-hidden="true">${'<i></i>'.repeat(10)}</span>
          <button type="button" class="md-audio__play" id="musicPlayBtn" aria-label="Reproducir música" aria-pressed="false">${icon('play', 14)}</button>
          <button type="button" class="md-audio__volbtn" id="musicVolBtn" aria-label="Volumen 100%" title="Volumen">${icon('volume', 15)}</button>
          <input type="range" class="md-audio__range" id="musicVolRange" min="0" max="100" step="1" value="100" aria-label="Volumen" title="Volumen">
          <audio id="happyAudio" preload="none" loop>
            <source src="https://res.cloudinary.com/dcsent4fs/video/upload/v1777746763/Zzoilo_Aitana_-_Mon_Amour_Remix_Letra_Lyrics_jrgcjv.m4a" type="audio/mpeg">
          </audio>
        </div>

        <div class="md-chat__body">
          <div class="md-chat__stream" id="mdChatStream">
            <!-- La conversación: sus notas y las respuestas del admin -->
            <section class="md-thread" id="mdThreadSection" hidden aria-label="Nuestra conversación">
              <p class="md-chat__notice"><span>${icon('lock', 12)} Solo nosotros dos. Aquí puedes decirlo todo.</span></p>
              <div class="md-thread__list" id="mdThreadList"></div>
              <p class="md-thread__empty" id="mdThreadEmpty" hidden>Todavía no hay mensajes. El primero que escribas aparecerá aquí.</p>
              <div class="md-typing" id="mdTyping" hidden aria-label="Escribiendo"><i></i><i></i><i></i></div>
            </section>
          </div>

          <button type="button" class="md-newpill" id="mdNewPill" hidden>Mensajes nuevos <span aria-hidden="true">↓</span></button>
        </div>

        <div class="md-chat__reply" id="mdThreadReply" hidden>
          <span class="md-chat__reply-text" id="mdThreadReplyText"></span>
          <button type="button" class="md-chat__reply-cancel" id="mdThreadReplyCancel"
            aria-label="Cancelar la respuesta">${icon('x', 14)}</button>
        </div>

        <div class="md-emoji" id="mdEmojiBar" role="toolbar" aria-label="Emojis" hidden>
          ${EMOJIS.map(e => `<button type="button" class="md-emoji__item" data-emoji="${e}" aria-label="Emoji ${e}">${e}</button>`).join('')}
        </div>

        <div class="md-chat__compose" id="mdChatCompose">
          <button type="button" class="md-compose__btn" id="mdAttachBtn" aria-label="Más cosas" aria-expanded="false">${icon('plus', 20)}</button>
          <div class="md-compose__field">
            <textarea class="md-chat__input" id="mdThreadInput" rows="1" maxlength="300"
              placeholder="Escríbeme lo que sientas…" aria-label="Escribe un mensaje" autocomplete="off"></textarea>
            <button type="button" class="md-compose__btn md-compose__emoji" id="mdEmojiBtn" aria-label="Emojis" aria-expanded="false">${icon('smile', 20)}</button>
          </div>
          <button type="button" class="md-chat__send" id="mdThreadSend" aria-label="Enviar mensaje">${icon('send', 18)}</button>
        </div>
      </div>

      <!-- Menú de adjuntos, como el «+» de un chat -->
      <div class="md-attach" id="mdAttachSheet" hidden>
        <div class="md-attach__backdrop" data-attach-close></div>
        <div class="md-attach__card" role="dialog" aria-modal="true" aria-label="Más opciones">
          <button type="button" class="md-attach__item" id="particlesBtn" data-attach-close>
            <span class="md-attach__icon md-attach__icon--pink" aria-hidden="true">${icon('star', 20)}</span>
            <span class="md-attach__text"><b>Algo bonito</b><small>Un mensaje con corazones</small></span>
          </button>
          <button type="button" class="md-attach__item" id="betterBtn" data-attach-close>
            <span class="md-attach__icon md-attach__icon--amber" aria-hidden="true">${icon('heart', 20)}</span>
            <span class="md-attach__text"><b>Me siento mejor</b><small>Un gatito para ti</small></span>
          </button>
          <button type="button" class="md-attach__item" id="attachMusicBtn" data-attach-close>
            <span class="md-attach__icon md-attach__icon--violet" aria-hidden="true">${icon('music', 20)}</span>
            <span class="md-attach__text"><b>Nuestra canción</b><small>Poner o quitar la música</small></span>
          </button>
        </div>
      </div>

      <!-- Acciones del mensaje: un solo menú, abierto al tocar una burbuja -->
      <div class="md-msg" id="mdMsgSheet" hidden>
        <div class="md-msg__backdrop" data-msg-close></div>
        <div class="md-msg__card" role="dialog" aria-modal="true" aria-label="Acciones del mensaje">
          <p class="md-msg__quote" id="mdMsgQuote"></p>
          <button type="button" class="md-msg__item" data-msg-action="reply">
            ${icon('back', 16)}<span>Responder</span>
          </button>
          <button type="button" class="md-msg__item md-msg__item--danger" data-msg-action="delete">
            ${icon('trash', 16)}<span>Eliminar</span>
          </button>
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

      <!-- "Algo bonito": el mensaje, con confeti y emojis saliendo de él -->
      <div class="md-love-layer" id="mdLoveLayer" aria-hidden="true"></div>
      <div class="md-love" id="mdLove" role="status" aria-live="polite" hidden>
        <span class="md-love__emoji" aria-hidden="true">🤍</span>
        <p class="md-love__text">Te quiero mucho mi princesa</p>
      </div>
    `;
  }

  render();

  // "Algo bonito" por delegación: sobrevive a los repintados internos de la
  // página y no depende de que el botón exista al enlazar.
  page.addEventListener('click', (e) => {
    if (e.target.closest('#particlesBtn')) showLove();
  });

  // Estado real del otro lado: latido en Supabase (y «escribiendo…»), verde
  // solo si ha dado señales en el último minuto y medio.
  offPresence = watchPartnerPresence((state = {}) => {
    presenceState = {
      online: !!state.online,
      at: state.at || null,
      typing: !!state.typing,
      userId: state.userId || null
    };
    paintStatus();
    paintPartnerPhoto(presenceState.userId);
  }, { intervalMs: 4000 });
  paintStatus();

  // onChange notifica ya con el estado actual, así que la conversación
  // aparece en cuanto el rol está resuelto.
  notesOff = userStore.onChange(() => { renderConversation(); });

  requestAnimationFrame(() => {
    audioPlayer = document.getElementById('happyAudio');
    const chatEl = page.querySelector('.md-chat');
    const streamEl = document.getElementById('mdChatStream');
    const threadInput = document.getElementById('mdThreadInput');
    const sendBtn = document.getElementById('mdThreadSend');
    const emojiBar = document.getElementById('mdEmojiBar');
    const attachSheet = document.getElementById('mdAttachSheet');
    const attachBtn = document.getElementById('mdAttachBtn');

    // ==========================================
    // SALIR — con la flecha o deslizando a la derecha
    // La pantalla es inmersiva: aquí no hay barra de navegación que sacarte.
    // ==========================================
    const reduceMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let leaving = false;
    const exitPage = () => {
      if (leaving) return;
      leaving = true;
      if (!chatEl || reduceMotion()) { router.navigate('/sentimientos'); return; }
      chatEl.classList.add('md-chat--leaving');
      setTimeout(() => router.navigate('/sentimientos'), 190);
    };

    // Volver
    page.querySelectorAll('[data-back]').forEach(btn =>
      btn.addEventListener('click', exitPage));

    // Deslizar hacia la derecha en cualquier punto de la conversación.
    let gesture = null;
    const canStartSwipe = (target) => {
      const open = (el) => el && !el.hidden;
      if (open(attachSheet) || open(emojiBar) || open(document.getElementById('mdBreatheLayer'))
        || open(document.getElementById('mdMsgSheet'))) return false;
      if (target?.closest('input, textarea, .md-audio__range, .md-emoji, .md-chat__menu')) return false;
      return true;
    };
    const onTouchStart = (e) => {
      if (e.touches.length !== 1 || !canStartSwipe(e.target)) return;
      gesture = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now(), dx: 0, axis: null };
    };
    const onTouchMove = (e) => {
      if (!gesture) return;
      const dx = e.touches[0].clientX - gesture.x;
      const dy = e.touches[0].clientY - gesture.y;
      if (!gesture.axis) {
        if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
        const horizontal = Math.abs(dx) > Math.abs(dy) * 1.4 && dx > 0;
        gesture.axis = horizontal ? 'x' : 'other';
        if (!horizontal) { gesture = null; return; }
        chatEl.classList.add('md-chat--swiping');
      }
      gesture.dx = Math.max(0, dx);
      chatEl.style.transform = `translate3d(${gesture.dx}px, 0, 0)`;
      chatEl.style.opacity = String(Math.max(0.55, 1 - gesture.dx / 900));
    };
    const onTouchEnd = () => {
      if (!gesture) return;
      const { dx, t } = gesture;
      gesture = null;
      if (!chatEl.classList.contains('md-chat--swiping')) return;
      chatEl.classList.remove('md-chat--swiping');
      const velocity = dx / Math.max(1, Date.now() - t);
      if (dx > 96 || velocity > 0.5) { exitPage(); return; }
      // No llegó: vuelve a su sitio.
      chatEl.classList.add('md-chat--settling');
      chatEl.style.transform = '';
      chatEl.style.opacity = '';
      setTimeout(() => chatEl.classList.remove('md-chat--settling'), 230);
    };
    chatEl?.addEventListener('touchstart', onTouchStart, { passive: true });
    chatEl?.addEventListener('touchmove', onTouchMove, { passive: true });
    chatEl?.addEventListener('touchend', onTouchEnd);
    chatEl?.addEventListener('touchcancel', onTouchEnd);
    swipeCleanup = () => {
      chatEl?.removeEventListener('touchstart', onTouchStart);
      chatEl?.removeEventListener('touchmove', onTouchMove);
      chatEl?.removeEventListener('touchend', onTouchEnd);
      chatEl?.removeEventListener('touchcancel', onTouchEnd);
    };

    // Con la conversación en la mano: si estabas abajo, la píldora sobra.
    streamEl?.addEventListener('scroll', () => {
      if (isNearBottom(streamEl, 80)) hideNewPill();
      hideEmoji();
    }, { passive: true });
    document.getElementById('mdNewPill')?.addEventListener('click', () => {
      hideNewPill();
      scrollToBottom(streamEl);
    });

    // Menú de los 3 puntos
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
      hideEmoji();
      hideAttach();
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

    // ==========================================
    // MÚSICA — fijada bajo la cabecera, con volumen
    // ==========================================
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
      if (volBtn) {
        volBtn.innerHTML = icon(volume === 0 ? 'muted' : (volume < 1 ? 'volumeLow' : 'volume'), 15);
        volBtn.setAttribute('aria-label', volume === 0 ? 'Activar volumen' : `Volumen ${pct}%`);
        volBtn.title = volume === 0 ? 'Volumen silenciado' : `Volumen ${pct}%`;
      }
    }

    function togglePlay() {
      if (!audioPlayer) return;
      if (isMusicPlaying) {
        audioPlayer.pause();
        isMusicPlaying = false;
        document.getElementById('musicWave')?.classList.remove('playing');
        if (stateEl) stateEl.textContent = 'en pausa';
        if (playBtn) playBtn.innerHTML = icon('play', 14);
      } else {
        audioPlayer.volume = volume;
        audioPlayer.play().catch(() => {});
        isMusicPlaying = true;
        document.getElementById('musicWave')?.classList.add('playing');
        if (stateEl) stateEl.textContent = 'sonando';
        if (playBtn) playBtn.innerHTML = icon('pause', 14);
      }
      playBtn?.setAttribute('aria-pressed', String(isMusicPlaying));
      playBtn?.setAttribute('aria-label', isMusicPlaying ? 'Pausar música' : 'Reproducir música');
    }

    playBtn?.addEventListener('click', togglePlay);
    volBtn?.addEventListener('click', () => {
      volIdx = (volIdx + 1) % VOL_STEPS.length;
      setVolume(VOL_STEPS[volIdx]);
    });
    volRange?.addEventListener('input', () => {
      setVolume((parseInt(volRange.value, 10) || 0) / 100);
    });

    // ==========================================
    // ESCRIBIR — campo que crece, emojis y adjuntos
    // ==========================================
    function hideEmoji() {
      if (!emojiBar || emojiBar.hidden) return;
      emojiBar.hidden = true;
      document.getElementById('mdEmojiBtn')?.setAttribute('aria-expanded', 'false');
    }

    function hideAttach() {
      if (!attachSheet || attachSheet.hidden) return;
      attachSheet.hidden = true;
      attachBtn?.setAttribute('aria-expanded', 'false');
    }

    function autoGrow() {
      if (!threadInput) return;
      threadInput.style.height = 'auto';
      threadInput.style.height = `${Math.min(threadInput.scrollHeight, 120)}px`;
    }

    function refreshSend() {
      const ready = !!String(threadInput?.value || '').trim();
      sendBtn?.classList.toggle('is-ready', ready);
    }

    threadInput?.addEventListener('input', () => {
      autoGrow();
      refreshSend();
      // «escribiendo…» al otro lado, con throttle dentro del servicio.
      setTyping(!!String(threadInput.value || '').trim());
    });
    threadInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMsg();
      }
    });
    threadInput?.addEventListener('focus', () => { hideAttach(); });

    document.getElementById('mdEmojiBtn')?.addEventListener('click', () => {
      if (!emojiBar) return;
      hideAttach();
      emojiBar.hidden = !emojiBar.hidden;
      document.getElementById('mdEmojiBtn')?.setAttribute('aria-expanded', String(!emojiBar.hidden));
    });
    emojiBar?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-emoji]');
      if (!btn || !threadInput) return;
      const emoji = btn.dataset.emoji;
      const start = threadInput.selectionStart ?? threadInput.value.length;
      const end = threadInput.selectionEnd ?? start;
      threadInput.value = threadInput.value.slice(0, start) + emoji + threadInput.value.slice(end);
      threadInput.focus();
      const caret = start + emoji.length;
      threadInput.setSelectionRange(caret, caret);
      threadInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    attachBtn?.addEventListener('click', () => {
      if (!attachSheet) return;
      hideEmoji();
      attachSheet.hidden = !attachSheet.hidden;
      attachBtn.setAttribute('aria-expanded', String(!attachSheet.hidden));
    });
    attachSheet?.addEventListener('click', (e) => {
      if (e.target === attachSheet || e.target.closest('[data-attach-close]')) hideAttach();
    });
    document.getElementById('attachMusicBtn')?.addEventListener('click', () => {
      document.getElementById('musicPlayBtn')?.click();
    });

    // Enviar a la conversación. Mismo campo para los dos: ella deja una nota
    // (user_progress) y él responde (content), y ambos leen la mezcla.
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
      autoGrow();
      refreshSend();
      setTyping(false);
      showReplyTarget(null);
      hideEmoji();
      hideAttach();
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
      // Se repinta en el acto y baja hasta el final: el mensaje propio aparece
      // al final sin recargar.
      renderConversation({ forceBottom: true });
    };
    sendBtn?.addEventListener('click', sendMsg);
    page.querySelector('#mdThreadReplyCancel')?.addEventListener('click', () => showReplyTarget(null));

    // ==========================================
    // ACCIONES DEL MENSAJE — al tocar la burbuja (solo admin)
    // Un único menú para toda la conversación: las acciones nuevas que
    // vengan después se suman aquí, no dentro de cada burbuja.
    // ==========================================
    const msgSheet = document.getElementById('mdMsgSheet');
    const msgQuote = document.getElementById('mdMsgQuote');
    let sheetMsg = null;

    function closeMsgSheet() {
      if (!msgSheet || msgSheet.hidden) return;
      msgSheet.hidden = true;
      sheetMsg = null;
    }

    function openMsgSheet(msg) {
      if (!msgSheet || !msg) return;
      sheetMsg = msg;
      if (msgQuote) msgQuote.textContent = `“${String(msg.text || '—').slice(0, 160)}”`;
      closeMenu();
      hideEmoji();
      hideAttach();
      msgSheet.hidden = false;
      msgSheet.querySelector('[data-msg-action="reply"]')?.focus();
    }

    // Delegado en la lista porque las burbujas se repintan cada vez que llega
    // algo; el índice apunta a `threadItems`, que es lo que está pintado.
    const threadList = page.querySelector('#mdThreadList');
    const openFromBubble = (target) => {
      if (!userStore.isAdmin) return;
      const bubble = target?.closest('[data-msg-idx]');
      if (!bubble) return;
      const msg = threadItems[parseInt(bubble.dataset.msgIdx, 10)];
      if (msg) openMsgSheet(msg);
    };
    threadList?.addEventListener('click', (e) => openFromBubble(e.target));
    threadList?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (!e.target.closest('[data-msg-idx]')) return;
      e.preventDefault();
      openFromBubble(e.target);
    });

    msgSheet?.addEventListener('click', async (e) => {
      if (e.target === msgSheet || e.target.closest('[data-msg-close]')) {
        closeMsgSheet();
        return;
      }
      const action = e.target.closest('[data-msg-action]')?.dataset.msgAction;
      if (!action || !sheetMsg) return;
      const msg = sheetMsg;
      closeMsgSheet();

      if (action === 'reply') {
        showReplyTarget(msg);
        return;
      }
      if (action !== 'delete') return;
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

    // ESC cierra lo que esté abierto; si no hay nada abierto, sale del chat.
    onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (breatheLayer && !breatheLayer.hidden) { closeBreathing(); closeMenu(); return; }
      if (msgSheet && !msgSheet.hidden) { closeMsgSheet(); return; }
      if (menu && !menu.hidden) { closeMenu(); return; }
      if (emojiBar && !emojiBar.hidden) { hideEmoji(); return; }
      if (attachSheet && !attachSheet.hidden) { hideAttach(); return; }
      exitPage();
    };
    document.addEventListener('keydown', onKeyDown);

    refreshSend();
    autoGrow();
  });

  return page;
}
