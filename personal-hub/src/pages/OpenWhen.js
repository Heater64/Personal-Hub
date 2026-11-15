/* ==========================================
   Personal Hub v2 — Open When Page
   Biblioteca emocional: categorías, "Para ti"
   y estado nuevo/visto persistente por usuaria
   ========================================== */

import '../styles/openwhen.css';
import { icon, openSheet, closeSheets, toast } from '../components/ui.js';
import { userStore } from '../stores/user.store.js';
import { createLightbox, openLightbox, closeLightbox } from '../components/MediaLightbox.js';
import { escapeHtml, safeUrl } from '../utils/escape.js';
import { getUserPref, setUserPref } from '../utils/userStorage.js';
import { OPENWHEN_READ_PREFIX } from '../utils/stats-metrics.js';
import { db } from '../services/db.service.js';

import { CATEGORIES, TYPE_META, LETTERS, loadAllOpenWhenLetters } from '../data/openwhen.data.js';

// Reexportados para no romper los importadores existentes (Home, Admin).
export { CATEGORIES, TYPE_META, LETTERS, loadAllOpenWhenLetters };

/* ==========================================
   Motor multimedia — nota de voz (speechSynthesis),
   cajita musical (Web Audio) y álbumes (galería)
   ========================================== */

const PLAY_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
const STOP_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

const WAVE_HEIGHTS = [0.35, 0.7, 0.5, 0.9, 0.42, 0.62, 0.8, 0.3, 0.55, 0.75, 0.45, 0.68, 0.32, 0.82, 0.52, 0.92, 0.4, 0.72, 0.36, 0.6, 0.78, 0.46, 0.85, 0.5];

const NOTE = { C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0 };

const MELODIES = {
  cuna: {
    name: 'Estrellita',
    noteDur: 0.6,
    gap: 0.1,
    notes: ['C4','C4','G4','G4','A4','A4','G4','F4','F4','E4','E4','D4','D4','C4','G4','G4','F4','F4','E4','E4','D4','G4','G4','F4','F4','E4','E4','D4','C4','C4','G4','G4','A4','A4','G4','F4','F4','E4','E4','D4','D4','C4']
  },
  alegre: {
    name: 'Campanitas',
    noteDur: 0.28,
    gap: 0.06,
    notes: ['C4','D4','E4','C4','C4','D4','E4','C4','E4','F4','G4','E4','F4','G4','G4','A4','G4','F4','E4','C4','G4','A4','G4','F4','E4','C4','C4','G4','C4','C4','G4','C4']
  }
};

let audioCtx = null;
let activeAudio = null;

function ensureCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function musicBoxNote(ctx, dest, freq, t, dur) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = freq * 2;
  const g = ctx.createGain();
  const g2 = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.4, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.7);
  g2.gain.setValueAtTime(0, t);
  g2.gain.linearRampToValueAtTime(0.09, t + 0.012);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.3);
  osc.connect(g); g.connect(dest);
  osc2.connect(g2); g2.connect(dest);
  osc.start(t); osc.stop(t + dur * 1.8);
  osc2.start(t); osc2.stop(t + dur * 1.4);
}

function startMusicBox(melodyKey) {
  const ctx = ensureCtx();
  if (!ctx) return null;
  const melody = MELODIES[melodyKey] || MELODIES.cuna;
  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  let t = ctx.currentTime + 0.06;
  melody.notes.forEach(n => {
    if (NOTE[n]) musicBoxNote(ctx, master, NOTE[n], t, melody.noteDur);
    t += melody.noteDur + melody.gap;
  });
  const duration = melody.notes.length * (melody.noteDur + melody.gap);
  const startedAt = performance.now();
  return {
    kind: 'musica',
    duration,
    startedAt,
    getElapsed: () => (performance.now() - startedAt) / 1000,
    stop() {
      try {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      } catch { /* noop */ }
      setTimeout(() => { try { master.disconnect(); } catch { /* noop */ } }, 150);
    }
  };
}

function pickSpanishVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  return (
    voices.find(v => /^es[-_]ES/i.test(v.lang) && /female|maria|maría|mónica|monica|helena|paulina|elvira|alba|lupe|sabina/i.test(v.name)) ||
    voices.find(v => /^es[-_](ES|MX)/i.test(v.lang)) ||
    voices.find(v => /^es/i.test(v.lang)) ||
    null
  );
}

function startVoiceNote(text) {
  const synth = window.speechSynthesis;
  if (!synth) return null;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'es-ES';
  utter.rate = 0.92;
  utter.pitch = 1.05;
  const voice = pickSpanishVoice();
  if (voice) utter.voice = voice;
  utter.onend = () => activeAudio?.onEnd?.();
  utter.onerror = () => activeAudio?.onEnd?.();
  synth.speak(utter);
  const words = text.trim().split(/\s+/).length;
  const startedAt = performance.now();
  return {
    kind: 'nota',
    duration: Math.min(Math.max(words * 0.42, 6), 45),
    startedAt,
    getElapsed: () => (performance.now() - startedAt) / 1000,
    stop() { synth.cancel(); }
  };
}

function startAudioFile(url) {
  // safeUrl valida el esquema pero devuelve HTML escapado: para el src del
  // <audio> (contexto JS) hace falta la URL cruda.
  if (!safeUrl(url)) return null;
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.src = String(url).trim();
  let duration = 0;
  audio.addEventListener('loadedmetadata', () => {
    duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  });
  const startedAt = performance.now();
  const played = audio.play();
  if (played?.catch) played.catch(() => { /* el navegador puede bloquear la reproducción */ });
  return {
    kind: 'audio',
    get duration() { return duration || Infinity; },
    startedAt,
    getElapsed: () => audio.currentTime,
    hasEnded: () => audio.ended,
    stop() {
      audio.pause();
      audio.currentTime = 0;
    }
  };
}

function stopAllMedia() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  if (activeAudio) {
    activeAudio.player?.stop();
    activeAudio = null;
  }
  document.querySelectorAll('.ow-audio.playing').forEach(el => el.classList.remove('playing'));
  document.querySelectorAll('.ow-audio-progress-fill').forEach(el => { el.style.width = '0%'; });
  document.querySelectorAll('.ow-audio-time').forEach(el => { el.textContent = '0:00'; });
  document.querySelectorAll('.ow-play-btn').forEach(b => { b.innerHTML = PLAY_ICON; });
}

const SEEN_KEY = 'openwhen.seen';

function loadSeen() {
  try {
    const raw = getUserPref(SEEN_KEY, '[]');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function OpenWhenPage(router) {
  const page = document.createElement('div');
  page.className = 'openwhen-page';

  const query = router.currentRoute?.query || {};
  const requestedLetterId = typeof query.letter === 'string' && /^[\w-]{1,120}$/.test(query.letter) ? query.letter : '';
  let requestedLetterOpened = false;
  let pageActive = true;
  let view = 'landing'; // 'landing' | category id
  let seen = loadSeen();
  let letters = LETTERS; // se reemplaza con la lista fusionada tras cargar el Admin

  function persist() {
    setUserPref(SEEN_KEY, JSON.stringify(seen));
  }

  function letterById(id) {
    return letters.find(l => l.id === id);
  }

  function lettersOf(catId) {
    return letters.filter(l => l.category === catId);
  }

  function isNew(letter) {
    return !seen.includes(letter.id);
  }

  function newOf(catId) {
    return lettersOf(catId).filter(isNew);
  }

  function totalOf(catId) {
    return lettersOf(catId).length;
  }

  function newTotal() {
    return letters.filter(isNew).length;
  }

  /* ---------- helpers de texto ---------- */
  function plural(n, singular, plural) {
    return `${n} ${n === 1 ? singular : plural}`;
  }

  function countText(catId) {
    const n = newOf(catId).length;
    const total = totalOf(catId);
    if (n === 0) return 'Todo visto por aquí 🤍';
    return `${plural(total, 'cosa', 'cosas')} · ${plural(n, 'nueva', 'nuevas')}`;
  }

  /* ---------- tarjetas ---------- */
  function mediaWidget(letter) {
    if (!letter.media) return '';
    if (letter.media.kind === 'album') {
      return `<div class="ow-album">${letter.media.urls.map((u, i) => `
        <button class="ow-album-thumb" data-photo="${letter.id}" data-idx="${i}" aria-label="Ver foto ${i + 1}">
          <img src="${safeUrl(u)}" alt="" loading="lazy">
        </button>`).join('')}</div>`;
    }
    if (letter.media.kind === 'video') {
      return `
      <div class="ow-video">
        <video controls playsinline preload="metadata" src="${safeUrl(letter.media.url)}"></video>
        <p class="ow-audio-caption">Vídeo · tócalo para verlo</p>
      </div>`;
    }

    const label = letter.media.kind === 'nota'
      ? 'Nota de voz'
      : letter.media.kind === 'audio'
        ? 'Audio'
        : `Canción · ${MELODIES[letter.media.melody]?.name || ''}`;
    return `
      <div class="ow-audio" data-audio="${letter.id}">
        <div class="ow-audio-bubble">
          <button class="ow-play-btn" data-play="${letter.id}" aria-label="Reproducir">${PLAY_ICON}</button>
          <div class="ow-waveform" aria-hidden="true">
            ${WAVE_HEIGHTS.map((h, i) => `<span style="--h:${h};--i:${i}"></span>`).join('')}
          </div>
          <span class="ow-audio-time">0:00</span>
        </div>
        <div class="ow-audio-progress"><span class="ow-audio-progress-fill"></span></div>
        <p class="ow-audio-caption">${label} · toca para escuchar</p>
      </div>`;
  }

  const OPEN_LABEL = { nota: 'Escuchar', cancion: 'Escuchar', album: 'Ver fotos' };

  function openLabel(letter) {
    const kind = letter.media?.kind;
    if (kind === 'audio' || kind === 'nota' || kind === 'cancion') return 'Escuchar';
    if (kind === 'album') return 'Ver fotos';
    if (kind === 'video') return 'Ver vídeo';
    return OPEN_LABEL[letter.type] || 'Abrir';
  }

  function letterCard(letter) {
    const meta = TYPE_META[letter.type] || TYPE_META.carta;
    const fresh = isNew(letter);
    const album = letter.media?.kind === 'album' ? letter.media.urls : null;

    const media = album
      ? `<div class="ow-album">${album.slice(0, 3).map((u, i) => `
          <button class="ow-album-thumb" data-photo="${letter.id}" data-idx="${i}" aria-label="Ver foto ${i + 1}">
            <img src="${escapeHtml(u)}" alt="" loading="lazy">
          </button>`).join('')}${album.length > 3 ? `<span class="ow-album-more">+${album.length - 3}</span>` : ''}</div>`
      : '';

    const videoThumb = letter.media?.kind === 'video'
      ? `<div class="ow-card__video" data-video="${letter.id}" role="button" aria-label="Ver vídeo">
          <video src="${safeUrl(letter.media.url)}" muted playsinline preload="metadata"></video>
          <span class="ow-card__video-play">▶</span>
        </div>`
      : '';

    // La tarjeta no puede ser un <button>: lleva miniaturas que también
    // lo son, y un botón dentro de otro es HTML inválido. El navegador
    // cerraba la tarjeta al encontrar la primera miniatura y las fotos
    // quedaban fuera. Un div con role="button" (más la activación de
    // teclado del listener de keydown) deja los botones interiores válidos.
    const adminActions = userStore.isAdmin
      ? `<div class="ow-card__admin">
          <button type="button" class="ow-card-action-btn" data-edit-letter="${letter.id}" title="Editar carta">${icon('edit', 14)}</button>
          <button type="button" class="ow-card-action-btn is-delete" data-delete-letter="${letter.id}" title="Eliminar carta">${icon('trash', 14)}</button>
        </div>`
      : '';

    return `
      <div class="ow-card${fresh ? ' is-new' : ''}" role="button" tabindex="0" data-open="${letter.id}">
        ${adminActions}
        <span class="ow-card__ic">${meta.emoji}</span>
        <span class="ow-card__body">
          <span class="ow-card__top">
            <b>${escapeHtml(letter.title)}</b>
            ${fresh ? '<span class="ow-card__badge">Nueva</span>' : `<span class="ow-card__seen" aria-label="Vista">${icon('check', 13)}</span>`}
          </span>
          <span class="ow-card__note">${escapeHtml(letter.note)}</span>
        </span>
        ${media}${videoThumb}
        <span class="ow-card__go">${openLabel(letter)} ${icon('chev', 14)}</span>
      </div>`;
  }

  function catCard(cat) {
    const n = newOf(cat.id).length;
    return `
      <button class="ow-cat" data-cat="${cat.id}">
        <span class="ow-cat__ic">${cat.emoji}</span>
        <span class="ow-cat__body">
          <b>${escapeHtml(cat.title)}</b>
          <span class="ow-cat__count" data-cat-count="${cat.id}">${countText(cat.id)}</span>
        </span>
        ${n > 0 ? `<span class="ow-cat__dot" aria-label="${plural(n, 'cosa nueva', 'cosas nuevas')}"></span>` : ''}
        <span class="ow-cat__go" aria-hidden="true">${icon('chev', 15)}</span>
      </button>`;
  }

  /* ---------- vistas ---------- */
  function landingHTML() {
    const cats = CATEGORIES.filter(c => totalOf(c.id) > 0);
    const n = letters.filter(isNew).length;
    const sub = n > 0
      ? `${letters.length} cartas · ${n} ${n === 1 ? 'sin ver' : 'sin ver'}`
      : `${letters.length} ${letters.length === 1 ? 'carta' : 'cartas'} · todo visto`;

    const adminBtn = userStore.isAdmin
      ? `<div class="ow-head-actions">
          <button type="button" class="ow-admin-btn" data-new-letter>
            ${icon('plus', 15)} <span>Escribir carta</span>
          </button>
        </div>`
      : '';

    return `
      <header class="scr-head">
        <div>
          <h1 class="scr-title">Open When</h1>
          <p class="sub">${escapeHtml(sub)}</p>
        </div>
        ${adminBtn}
      </header>

      <section class="ow-section">
        <p class="section-title">¿Qué necesitas?</p>
        <div class="ow-cats">${cats.map(catCard).join('')}</div>
      </section>`;
  }

  function categoryHTML(catId) {
    const cat = CATEGORIES.find(c => c.id === catId);
    if (!cat) return landingHTML();
    const all = lettersOf(catId);
    const news = all.filter(isNew);
    const olds = all.filter(l => !isNew(l));

    const adminBtn = userStore.isAdmin
      ? `<div class="ow-head-actions">
          <button type="button" class="ow-admin-btn" data-new-letter="${catId}">
            ${icon('plus', 15)} <span>Nueva en ${escapeHtml(cat.title)}</span>
          </button>
        </div>`
      : '';

    return `
      <header class="scr-head">
        <div class="ow-head-main">
          <button type="button" class="icon-btn ow-back" data-back aria-label="Volver a Open When">${icon('back', 18)}</button>
          <div>
            <h1 class="scr-title">${cat.emoji} ${escapeHtml(cat.title)}</h1>
            <p class="sub">${escapeHtml(cat.tagline)}</p>
          </div>
        </div>
        ${adminBtn}
      </header>

      ${news.length ? `
        <section class="ow-section">
          <p class="section-title">Nuevas <span class="section-title__aside">${news.length}</span></p>
          <div class="ow-grid">${news.map(letterCard).join('')}</div>
        </section>` : ''}

      ${olds.length ? `
        <section class="ow-section">
          <p class="section-title">Vistas <span class="section-title__aside">${olds.length}</span></p>
          <div class="ow-grid">${olds.map(letterCard).join('')}</div>
        </section>` : ''}

      ${!all.length ? `<div class="ow-all-seen">Aquí todavía no hay cartas.</div>` : ''}`;
  }

  /* ---------- visor de fotos (el compartido de la app) ---------- */
  function openAlbum(letterId, idx) {
    const letter = letterById(letterId);
    if (!letter?.media || letter.media.kind !== 'album') return;
    createLightbox();
    openLightbox(letter.media.urls.map(src => ({ src, type: 'image' })), idx);
  }

  /** Abre el vídeo de una carta en el visor compartido. */
  function openVideo(letterId) {
    const letter = letterById(letterId);
    const url = letter?.media?.kind === 'video' ? letter.media.url : null;
    if (!url) return;
    createLightbox();
    openLightbox([{ src: url, type: 'video' }], 0);
  }

  function toggleAudio(letterId) {
    const letter = letterById(letterId);
    const kind = letter?.media?.kind;
    if (!letter?.media || (kind !== 'nota' && kind !== 'cancion' && kind !== 'audio')) return;

    // La misma carta ya suena → parar
    if (activeAudio?.letterId === letterId) {
      stopAllMedia();
      return;
    }
    stopAllMedia();

    const player = kind === 'nota'
      ? startVoiceNote(letter.message)
      : kind === 'audio'
        ? startAudioFile(letter.media.url)
        : startMusicBox(letter.media.melody);
    if (!player) return;

    // El reproductor puede vivir en la página o en el sheet abierto.
    const bubble = document.querySelector(`[data-audio="${letterId}"]`);
    bubble?.classList.add('playing');
    const btn = bubble?.querySelector('.ow-play-btn');
    if (btn) btn.innerHTML = STOP_ICON;

    const onEnd = () => {
      if (activeAudio?.player === player) stopAllMedia();
    };
    activeAudio = { player, letterId, onEnd };

    const timer = setInterval(() => {
      if (activeAudio?.player !== player) { clearInterval(timer); return; }
      const elapsed = player.getElapsed();
      if (player.hasEnded?.() || elapsed >= player.duration + 0.4) { onEnd(); return; }
      const fill = bubble?.querySelector('.ow-audio-progress-fill');
      const time = bubble?.querySelector('.ow-audio-time');
      if (fill) fill.style.width = `${Math.min(100, (elapsed / player.duration) * 100)}%`;
      if (time) time.textContent = formatTime(Math.min(elapsed, player.duration));
    }, 150);
  }

  function render() {
    stopAllMedia();
    page.innerHTML = view === 'landing' ? landingHTML() : categoryHTML(view);
  }

  /* ---------- acciones ---------- */
  function updateCounts() {
    page.querySelectorAll('[data-cat-count]').forEach(el => {
      const n = newOf(el.dataset.catCount).length;
      el.textContent = countText(el.dataset.catCount);
    });
  }

  /** Abre una carta en el bottom sheet del sistema. */
  function openLetter(id) {
    const letter = letterById(id);
    if (!letter) return;

    const wasNew = !seen.includes(id);
    if (wasNew) {
      seen.push(id);
      persist();
      // Rastro para el panel: `analytics_visits` solo lo puede leer el admin,
      // así que abrir una carta se registra como visita a una ruta reservada.
      db.trackVisit(`${OPENWHEN_READ_PREFIX}${id}`).catch(() => {});
      // Repinta antes de abrir el sheet: así la carta pasa sola a "Vistas"
      // y los contadores de las categorías quedan al día.
      render();
    }

    const meta = TYPE_META[letter.type] || TYPE_META.carta;
    openSheet(letter.title, () => {
      const body = document.createElement('div');
      body.className = 'ow-sheet';

      const msg = document.createElement('p');
      msg.className = 'ow-sheet__msg';
      msg.innerHTML = escapeHtml(letter.message).replace(/\n/g, '<br>');
      body.appendChild(msg);

      if (letter.media) body.insertAdjacentHTML('beforeend', mediaWidget(letter));

      const sign = document.createElement('p');
      sign.className = 'ow-sheet__sign';
      sign.textContent = '— Con todo mi cariño: Peluchito';
      body.appendChild(sign);

      // La hoja vive fuera de la página en el DOM, así que los clics del
      // multimedia (play, fotos, vídeo) no llegan al listener delegado de la
      // página: se cablean aquí, igual que los botones de las otras hojas.
      body.addEventListener('click', (e) => {
        const photo = e.target.closest('[data-photo]');
        if (photo) {
          e.stopPropagation();
          openAlbum(photo.dataset.photo, parseInt(photo.dataset.idx, 10) || 0);
          return;
        }
        const video = e.target.closest('[data-video]');
        if (video) {
          e.stopPropagation();
          openVideo(video.dataset.video);
          return;
        }
        const play = e.target.closest('[data-play]');
        if (play) {
          e.stopPropagation();
          toggleAudio(play.dataset.play);
        }
      });

      return body;
    }, stopAllMedia);
  }

  function goToCategory(catId) {
    if (!CATEGORIES.find(c => c.id === catId)) return;
    view = catId;
    render();
    page.scrollTop = 0;
    // Entrada de historial propia: Atrás vuelve al listado de Open When
    // en vez de sacar al usuario de la página.
    history.pushState({ ...(history.state || {}), __phInPage: true, __owView: catId }, '');
  }


  /* ---------- Editor In-Situ (Admin) ---------- */
  function openEditor(letterToEdit = null, defaultCat = null) {
    if (!userStore.isAdmin) return;
    const isNew = !letterToEdit;
    const initialCat = letterToEdit?.category || defaultCat || CATEGORIES[0].id;
    const initialType = letterToEdit?.type || 'carta';
    const initialMediaKind = letterToEdit?.media?.kind || '';

    openSheet(isNew ? 'Escribir nueva carta' : 'Editar carta', () => {
      const container = document.createElement('div');
      container.className = 'ow-editor-form';

      container.innerHTML = `
        <div class="ow-form-field">
          <label>Título (Ábrela cuando...)</label>
          <input type="text" id="owTitle" placeholder="Ej: ...estés triste y me extrañes" value="${escapeHtml(letterToEdit?.title || '')}" />
        </div>
        <div class="ow-form-field">
          <label>Subtítulo / Nota corta</label>
          <input type="text" id="owNote" placeholder="Ej: Para leer con una taza de café" value="${escapeHtml(letterToEdit?.note || '')}" />
        </div>
        <div class="ow-form-grid">
          <div class="ow-form-field">
            <label>Categoría</label>
            <select id="owCategory">
              ${CATEGORIES.map(c => `<option value="${c.id}" ${c.id === initialCat ? 'selected' : ''}>${c.emoji} ${escapeHtml(c.title)}</option>`).join('')}
            </select>
          </div>
          <div class="ow-form-field">
            <label>Tipo de carta</label>
            <select id="owType">
              <option value="carta" ${initialType === 'carta' ? 'selected' : ''}>💌 Carta</option>
              <option value="mensaje" ${initialType === 'mensaje' ? 'selected' : ''}>💬 Mensaje</option>
              <option value="reto" ${initialType === 'reto' ? 'selected' : ''}>🧩 Reto</option>
              <option value="juego" ${initialType === 'juego' ? 'selected' : ''}>🎮 Juego</option>
              <option value="sorpresa" ${initialType === 'sorpresa' ? 'selected' : ''}>🎁 Sorpresa</option>
            </select>
          </div>
        </div>
        <div class="ow-form-field">
          <label>Contenido del mensaje</label>
          <textarea id="owMessage" rows="6" placeholder="Escribe aquí tus palabras más bonitas...">${escapeHtml(letterToEdit?.message || '')}</textarea>
        </div>
        <div class="ow-form-field">
          <label>Multimedia (opcional)</label>
          <select id="owMediaKind">
            <option value="" ${!initialMediaKind ? 'selected' : ''}>Sin multimedia</option>
            <option value="audio" ${initialMediaKind === 'audio' ? 'selected' : ''}>🎙️ Audio (URL directa mp3)</option>
            <option value="album" ${initialMediaKind === 'album' ? 'selected' : ''}>📸 Fotos (URLs por línea)</option>
            <option value="video" ${initialMediaKind === 'video' ? 'selected' : ''}>🎥 Vídeo (URL directa mp4)</option>
            <option value="nota" ${initialMediaKind === 'nota' ? 'selected' : ''}>🗣️ Nota de voz generada</option>
            <option value="cancion" ${initialMediaKind === 'cancion' ? 'selected' : ''}>🎵 Melodía cajita musical</option>
          </select>
        </div>
        <div id="owMediaExtra"></div>

        <div class="ow-editor-actions">
          <button type="button" class="btn btn-secondary" id="owCancelBtn">Cancelar</button>
          <button type="button" class="btn btn-primary" id="owSaveBtn">${isNew ? 'Guardar carta' : 'Actualizar'}</button>
        </div>
      `;

      const kindSelect = container.querySelector('#owMediaKind');
      const extraDiv = container.querySelector('#owMediaExtra');

      function updateMediaExtra() {
        const val = kindSelect.value;
        if (val === 'audio' || val === 'video') {
          const currentUrl = (letterToEdit?.media?.kind === val ? letterToEdit.media.url : '') || '';
          extraDiv.innerHTML = `
            <div class="ow-form-field">
              <label>URL del ${val === 'audio' ? 'Audio' : 'Vídeo'}</label>
              <input type="url" id="owMediaUrl" placeholder="https://..." value="${escapeHtml(currentUrl)}" />
            </div>
          `;
        } else if (val === 'album') {
          const urls = (letterToEdit?.media?.kind === 'album' ? (letterToEdit.media.urls || []).join('\n') : '');
          extraDiv.innerHTML = `
            <div class="ow-form-field">
              <label>URLs de las imágenes (una por línea)</label>
              <textarea id="owMediaUrls" rows="3" placeholder="https://...\nhttps://...">${escapeHtml(urls)}</textarea>
            </div>
          `;
        } else if (val === 'cancion') {
          const melody = letterToEdit?.media?.melody || 'cuna';
          extraDiv.innerHTML = `
            <div class="ow-form-field">
              <label>Melodía de la cajita</label>
              <select id="owMelody">
                <option value="cuna" ${melody === 'cuna' ? 'selected' : ''}>Estrellita dónde estás</option>
                <option value="alegre" ${melody === 'alegre' ? 'selected' : ''}>Campanitas alegres</option>
              </select>
            </div>
          `;
        } else {
          extraDiv.innerHTML = '';
        }
      }

      kindSelect.addEventListener('change', updateMediaExtra);
      updateMediaExtra();

      container.querySelector('#owCancelBtn').addEventListener('click', closeSheets);

      container.querySelector('#owSaveBtn').addEventListener('click', async () => {
        const title = container.querySelector('#owTitle').value.trim();
        const message = container.querySelector('#owMessage').value.trim();
        const note = container.querySelector('#owNote').value.trim();
        const category = container.querySelector('#owCategory').value;
        const type = container.querySelector('#owType').value;
        const mediaKind = kindSelect.value;

        if (!title) { toast('Por favor introduce un título'); return; }
        if (!message) { toast('Por favor escribe el mensaje de la carta'); return; }

        let media = null;
        if (mediaKind === 'audio' || mediaKind === 'video') {
          const url = container.querySelector('#owMediaUrl')?.value?.trim();
          if (!url) { toast('Falta la URL del multimedia'); return; }
          media = { kind: mediaKind, url };
        } else if (mediaKind === 'album') {
          const urls = (container.querySelector('#owMediaUrls')?.value || '')
            .split('\n').map(u => u.trim()).filter(Boolean);
          if (!urls.length) { toast('Añade al menos una foto'); return; }
          media = { kind: 'album', urls };
        } else if (mediaKind === 'nota') {
          media = { kind: 'nota' };
        } else if (mediaKind === 'cancion') {
          media = { kind: 'cancion', melody: container.querySelector('#owMelody')?.value || 'cuna' };
        }

        const id = letterToEdit?.id || db.generateId();
        const letterObj = {
          id,
          category,
          type,
          title,
          note,
          message,
          ...(media ? { media } : {})
        };

        const currentCustom = await db.getOpenWhenLetters().catch(() => []);
        const idx = currentCustom.findIndex(x => x.id === id);
        let nextCustom;
        if (idx >= 0) {
          nextCustom = [...currentCustom];
          nextCustom[idx] = letterObj;
        } else {
          nextCustom = [...currentCustom, letterObj];
        }

        try {
          await db.saveOpenWhenLetters(nextCustom);
          letters = await loadAllOpenWhenLetters();
          render();
          closeSheets();
          toast(isNew ? 'Carta guardada con éxito ♥' : 'Carta actualizada correctamente ✓');
        } catch (err) {
          toast('Error al guardar carta: ' + (err.message || 'Error desconocido'));
        }
      });

      return container;
    });
  }

  async function deleteLetter(id) {
    if (!userStore.isAdmin) return;
    const letter = letterById(id);
    if (!letter) return;
    if (!confirm(`¿Eliminar la carta "${letter.title}"?`)) return;

    try {
      const currentCustom = await db.getOpenWhenLetters().catch(() => []);
      const nextCustom = currentCustom.filter(x => x.id !== id);
      await db.saveOpenWhenLetters(nextCustom);
      letters = await loadAllOpenWhenLetters();
      render();
      toast('Carta eliminada ✓');
    } catch (err) {
      toast('No se pudo eliminar: ' + (err.message || 'Error'));
    }
  }

  /* ---------- eventos ---------- */
  page.addEventListener('click', (e) => {
    const newBtn = e.target.closest('[data-new-letter]');
    if (newBtn) {
      e.stopPropagation();
      openEditor(null, newBtn.dataset.newLetter || null);
      return;
    }

    const editBtn = e.target.closest('[data-edit-letter]');
    if (editBtn) {
      e.stopPropagation();
      const letId = editBtn.dataset.editLetter;
      openEditor(letterById(letId));
      return;
    }

    const delBtn = e.target.closest('[data-delete-letter]');
    if (delBtn) {
      e.stopPropagation();
      deleteLetter(delBtn.dataset.deleteLetter);
      return;
    }

    const back = e.target.closest('[data-back]');
    if (back) {
      // Si la categoría dejó su entrada de historial, se deshace con el
      // retroceso; si no, se vuelve al listado directamente.
      if (history.state?.__owView) {
        history.back();
        return;
      }
      view = 'landing';
      render();
      page.scrollTop = 0;
      return;
    }

    const cat = e.target.closest('[data-cat]');
    if (cat) {
      goToCategory(cat.dataset.cat);
      return;
    }

    const photo = e.target.closest('[data-photo]');
    if (photo) {
      e.stopPropagation();
      openAlbum(photo.dataset.photo, parseInt(photo.dataset.idx, 10) || 0);
      return;
    }

    const video = e.target.closest('[data-video]');
    if (video) {
      e.stopPropagation();
      openVideo(video.dataset.video);
      return;
    }

    const play = e.target.closest('[data-play]');
    if (play) {
      e.stopPropagation();
      toggleAudio(play.dataset.play);
      return;
    }

    const open = e.target.closest('[data-open]');
    if (open) openLetter(open.dataset.open);
  });

  // El retroceso del navegador desapila la vista de categoría (creada en
  // goToCategory) y acaba en el listado de Open When.
  function onPopState() {
    const target = history.state?.__owView;
    const next = CATEGORIES.find(c => c.id === target) ? target : 'landing';
    if (next === view) return;
    view = next;
    render();
    page.scrollTop = 0;
  }
  window.addEventListener('popstate', onPopState);

  // Esc cierra el visor de fotos (el sheet y el lightbox ya lo hacen solos)
  page.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
    // La tarjeta ya no es un <button>, así que Enter y Espacio
    // hay que gestionarlos aquí para abrirla con el teclado.
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.ow-card[data-open]')) {
      e.preventDefault();
      openLetter(e.target.dataset.open);
    }
  });

  render();

  function openRequestedLetter() {
    if (!pageActive || !requestedLetterId || requestedLetterOpened) return;
    const letter = letterById(requestedLetterId);
    if (!letter) return;
    requestedLetterOpened = true;
    view = letter.category;
    render();
    openLetter(requestedLetterId);
  }

  // Carga las cartas personalizadas del Admin (Supabase) y re-renderiza.
  // El deep link espera esta lista antes de intentar abrir una carta custom.
  loadAllOpenWhenLetters().then(all => {
    if (!pageActive) return;
    const same = all.length === letters.length && all.every((l, i) => JSON.stringify(l) === JSON.stringify(letters[i]));
    if (!same) {
      letters = all;
      render();
    }
    openRequestedLetter();
  });

  // Antes no había cleanup: el audio seguía sonando al salir de la página
  // y el visor de fotos se quedaba abierto en el DOM.
  page.cleanup = () => {
    pageActive = false;
    window.removeEventListener('popstate', onPopState);
    stopAllMedia();
    closeLightbox();
    closeSheets();
  };

  return page;
}
