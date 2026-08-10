/* ==========================================
   Personal Hub v2 — Open When Page
   Biblioteca emocional: categorías, "Para ti"
   y estado nuevo/visto persistente por usuaria
   ========================================== */

import { escapeHtml } from '../utils/escape.js';
import { getUserPref, setUserPref } from '../utils/userStorage.js';
import { db } from '../services/db.service.js';

export const CATEGORIES = [
  { id: 'amor', emoji: '❤️', title: 'Amor y conexión', tagline: 'Para momentos en los que quieras sentirte cerca de mí.' },
  { id: 'tristeza', emoji: '😔', title: 'Tristeza y bajón', tagline: 'Para cuando no estés pasando por un buen momento.' },
  { id: 'enfado', emoji: '😡', title: 'Enfado y celos', tagline: 'Para las emociones intensas.' },
  { id: 'alegria', emoji: '🥰', title: 'Alegría', tagline: 'Para compartir y potenciar los buenos momentos.' },
  { id: 'aburrimiento', emoji: '🥱', title: 'Aburrimiento y entretenimiento', tagline: 'Para cuando simplemente no sepas qué hacer.' },
  { id: 'cuidarte', emoji: '🤒', title: 'Cuidarte', tagline: 'Para momentos físicos o de descanso.' },
  { id: 'noche', emoji: '🌙', title: 'Noche', tagline: 'Para cerrar el día con cariño.' }
];

export const TYPE_META = {
  carta: { emoji: '💌', label: 'Carta' },
  nota: { emoji: '🎙️', label: 'Nota de voz' },
  video: { emoji: '🎥', label: 'Vídeo' },
  foto: { emoji: '📸', label: 'Foto' },
  album: { emoji: '🖼️', label: 'Álbum' },
  juego: { emoji: '🎮', label: 'Juego' },
  reto: { emoji: '🧩', label: 'Reto' },
  cancion: { emoji: '🎵', label: 'Canción' },
  mensaje: { emoji: '💬', label: 'Mensaje' },
  sorpresa: { emoji: '🎁', label: 'Sorpresa' }
};

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
  return {
    kind: 'nota',
    duration: Math.min(Math.max(words * 0.42, 6), 45),
    startedAt: performance.now(),
    getElapsed: () => (performance.now() - startedAt) / 1000,
    stop() { synth.cancel(); }
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

export const LETTERS = [
  // ─── ❤️ Amor y conexión ───
  {
    id: 'me-extranes',
    category: 'amor',
    type: 'carta',
    title: 'Cuando me extrañes',
    note: 'Estoy más cerca de lo que crees',
    message: 'Piensa en mí y ya estoy ahí. Cierra los ojos, respira, y recuerda que cada segundo lejos de ti es un segundo más cerca de volver a verte. Yo también te extraño, princesa, pero siempre estamos juntos, pase lo que pase 🤍'
  },
  {
    id: 'sientas-que-no-te-amo',
    category: 'amor',
    type: 'carta',
    title: 'Ábrela cuando sientas que no te amo',
    note: 'Cosa que no es verdad, yo siempre te amo y te amaré por siempre jamás',
    message: 'Te amo mucho y quiero que sepas que siempre estaré aquí para ti, apoyándote en cada paso del camino. Porque estamos juntos en esto. Peluche y princesa para siempre'
  },
  {
    id: 'sientas-acompanada',
    category: 'amor',
    type: 'carta',
    title: 'Cuando quieras sentirte acompañada',
    note: 'Aunque no esté físicamente a tu lado',
    message: 'Aunque ahora mismo no pueda estar a tu lado, quiero que sepas que no estás sola. Voy contigo en cada pensamiento, en cada risa y en cada lágrima. Peluche y princesa, siempre juntos'
  },
  {
    id: 'necesites-un-abrazo',
    category: 'amor',
    type: 'carta',
    title: 'Ábrela cuando necesites un abrazo',
    note: 'Aunque no pueda darte un abrazo físico, aquí tienes uno virtual.',
    message: 'Imagina que te abrazo muy fuerte, que acaricio tu pelo y te digo al oído todo lo que te quiero. Eres la persona más importante para mí y deseo poder abrazarte ahora mismo'
  },
  {
    id: 'sentirte-querida',
    category: 'amor',
    type: 'carta',
    title: 'Ábrela cuando simplemente quieras sentirte querida',
    note: 'Porque siempre mereces saberlo',
    message: 'Eres hermosa, inteligente, divertida, fuerte y única. No hay nadie como tú en este mundo y me siento el afortunado de tenerte en mi vida. Te quiero más de lo que las palabras pueden expresar'
  },
  {
    id: 'palabras-bonitas',
    category: 'amor',
    type: 'mensaje',
    title: 'Ábrela cuando necesites palabras bonitas',
    note: 'Cuando necesites escuchar algo lindo',
    message: 'Eres una niña muy linda, hermosa, guapa, valiosa, y vales muchísimo. Por si nadie te lo ha dicho hoy, estás hermosa 🤍. Tienes unos ojitos hermosos y siempre siempre serás mi niña preciosa'
  },
  {
    id: 'nadie-te-lo-ha-dicho',
    category: 'amor',
    type: 'mensaje',
    title: 'POR SI NADIE TE LO HA DICHO HOY',
    note: '🤍👑',
    message: 'Tú importas, vales la pena, eres suficiente, eres INCREÍBLE, te ves hermosa cuando sonríes, y te mereces todo lo bonito en la vida'
  },
  {
    id: 'siete-maravillas',
    category: 'amor',
    type: 'mensaje',
    title: 'Las 7 maravillas del mundo',
    note: 'jsjsjsj',
    message: '1. Tus ojos\n2. Tu sonrisa\n3. Tu forma de ser\n4. Tus abrazos\n5. Tu inteligencia\n6. Tu energía\n7. Simplemente tú'
  },
  {
    id: 'buenos-dias',
    category: 'amor',
    type: 'carta',
    title: 'Ábrela si no te he dado los buenos días hoy',
    note: 'Te amo mi niña hermosa😘🧸',
    message: 'Buenos días REINA👑, espero que la princesita haya amanecido bien y tenga un día tan hermoso como ella (TÚ). IMPLOSIBLE MI NIÑA ES HERMOSISIMAAAAAAAAAA'
  },
  {
    id: 'escuchar-mi-voz',
    category: 'amor',
    type: 'nota',
    media: { kind: 'nota' },
    title: 'Ábrela cuando necesites escuchar mi voz',
    note: 'No es lo mismo leerlo… aquí estoy, hablándote',
    message: 'Hola, mi niña hermosa. Soy yo. Quería decirte que estoy aquí, que te quiero muchísimo y que no hay nada en el mundo que me haga más feliz que tú. Cuando me necesites, cierra los ojos y piensa en mí, porque yo también estoy pensando en ti en este mismo momento. Te quiero, princesa. Siempre.'
  },
  {
    id: 'album-lugares',
    category: 'amor',
    type: 'album',
    media: { kind: 'album', urls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Rio_cangrejo.JPG/960px-Rio_cangrejo.JPG',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Playa_Escondida_Tela_Honduras.jpg/960px-Playa_Escondida_Tela_Honduras.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Monta%C3%B1a_en_la_Ceiba_Honduras.jpg/960px-Monta%C3%B1a_en_la_Ceiba_Honduras.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/St_Petersburg_Neva_River002.JPG/960px-St_Petersburg_Neva_River002.JPG',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/St._Petersburg_Bridge_during_White_Night.jpg/960px-St._Petersburg_Bridge_during_White_Night.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Saint_Petersburg_Palace_Bridge%2C_St._Petersburg_%2837931957696%29.jpg/960px-Saint_Petersburg_Palace_Bridge%2C_St._Petersburg_%2837931957696%29.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Church_of_the_Saviour_on_Spilled_Blood%2C_St_Petersburg%2C_Russia.jpg/960px-Church_of_the_Saviour_on_Spilled_Blood%2C_St_Petersburg%2C_Russia.jpg'
    ] },
    title: 'Cuando quieras un paseo por lugares bonitos',
    note: 'Un viajecito sin salir de casa',
    message: 'Cierra los ojos, ábrelos y viaja conmigo: el río, la playa, las noches blancas… algún día te llevaré a todos estos lugares de la mano.'
  },

  // ─── 😔 Tristeza y bajón ───
  {
    id: 'estes-triste',
    category: 'tristeza',
    type: 'carta',
    title: 'Ábrela cuando estés triste',
    note: 'No estás sola, siempre hay alguien que piensa en ti',
    message: 'Sé que a veces las cosas no salen como queremos, pero quiero que recuerdes que eres increíble. Tu sonrisa ilumina mi mundo y no hay nada que no puedas superar. Estoy aquí para ti, siempre'
  },
  {
    id: 'tengas-dudas',
    category: 'tristeza',
    type: 'carta',
    title: 'Ábrela cuando tengas dudas',
    note: 'Sobre nosotros, sobre ti, sobre lo que sea',
    message: 'Si alguna vez tienes dudas, recuerda esto: te elijo hoy, mañana y siempre. No hay nada que pueda cambiar lo que siento por ti. Eres mi persona favorita en este universo y siempre lo serás'
  },
  {
    id: 'cansada-de-todo',
    category: 'tristeza',
    type: 'carta',
    title: 'Ábrela cuando estés cansada de todo',
    note: 'Cuando no puedas más...',
    message: 'Échale ganas hermosa, sé que estás cansada, con sueño, pero son momentos. Recuerda que puedes con todo, eres muy fuerte, y lista😘. Y solo mía jsjsjsjs. Te amo 🤍'
  },
  {
    id: 'todo-ira-bien',
    category: 'tristeza',
    type: 'nota',
    media: { kind: 'nota' },
    title: 'Cuando necesites que te diga que todo irá bien',
    note: 'Escúchalo con los ojos cerrados',
    message: 'Todo va a estar bien. Respira hondo. Lo que sea que esté pasando ahora mismo, va a pasar. Tú eres más fuerte de lo que crees, y yo estoy aquí, contigo, pase lo que pase. No estás sola. Nunca. Te quiero.'
  },

  // ─── 😡 Enfado y celos ───
  {
    id: 'enojada-conmigo',
    category: 'enfado',
    type: 'carta',
    title: 'Cuando estés enojada conmigo',
    note: 'Lo que sea que haya pasado, aquí estoy',
    message: 'Si estás leyendo esto es porque algo pasó. Quiero que sepas que te escucho, que lo que sientas siempre es válido y que no me voy a ningún lado. Hablemos cuando quieras: yo te quiero, incluso enojada conmigo'
  },
  {
    id: 'celosa',
    category: 'enfado',
    type: 'carta',
    title: 'Cuando estés celosa',
    note: 'Solo hay una reina en mi corazón',
    message: 'No tienes por qué sentir celos, nunca. En mi mundo solo existes tú. No hay nadie más que me haga sentir lo que tú me haces sentir. Eres la única, la elegida, mi princesa. Siempre'
  },

  // ─── 🥰 Alegría ───
  {
    id: 'orgullosa-de-ti',
    category: 'alegria',
    type: 'carta',
    title: 'Ábrela cuando estés orgullosa de ti',
    note: 'Porque tienes mucho que celebrar',
    message: '¡Mira todo lo que has logrado! Estoy tan orgulloso de ti y de la persona increíble que eres. Cada día me sorprendes más con tu fuerza, tu inteligencia y tu corazón enorme. ¡Te mereces el mundo!'
  },
  {
    id: 'algo-increible',
    category: 'alegria',
    type: 'sorpresa',
    title: 'Cuando te haya pasado algo increíble',
    note: '¡Cuéntamelo todo!',
    message: '¡¿En serio?! Eso es enorme, te felicito de corazón. Guarda este momento, porque es tuyo y te lo ganaste. Cuando me lo cuentes, celebraremos como se debe. Estoy orgulloso de ti, siempre. ¡Bien hecho, mi campeona!'
  },

  // ─── 🥱 Aburrimiento y entretenimiento ───
  {
    id: 'aburrida',
    category: 'aburrimiento',
    type: 'reto',
    title: 'Cuando estés aburrida',
    note: 'Te reto a algo',
    message: 'Te reto a no sonreír durante 10 segundos. Cuenta: 1, 2, 3… ¿Lo lograste? Mentira, ya sé que sonreíste, porque tu sonrisa es más rápida que tú jsjs. Ahora haz algo bonito: un dibujo, tu canción favorita o ven a molestarme'
  },
  {
    id: 'quieras-jugar',
    category: 'aburrimiento',
    type: 'juego',
    title: 'Cuando quieras jugar',
    note: 'Los juegos nos esperan',
    message: '¿Sabes qué? El Rincón tiene juegos esperándote: tres en raya, memoria, el ahorcado, la serpiente… Ve y gáname una partida. Si ganas, me debes una sonrisa. Si pierdo yo (siempre pierdo), te debo lo que quieras. ¡Ve!'
  },
  {
    id: 'cancion-alegre',
    category: 'aburrimiento',
    type: 'cancion',
    media: { kind: 'cancion', melody: 'alegre' },
    title: 'Cuando quieras escuchar algo alegre',
    note: 'Campanitas para subir el ánimo',
    message: 'Campanitas para alegrarte. Si esta canción no te saca una sonrisa, te debo una. Baila un poquito, aunque sea con la cabeza.'
  },
  {
    id: 'album-gatitos',
    category: 'aburrimiento',
    type: 'album',
    media: { kind: 'album', urls: [
      'https://upload.wikimedia.org/wikipedia/commons/3/38/Shaded_silver_Persian_Cat_Missionhill_Cosmic_Rainstorm.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/7/71/Ragdoll_cat_Merlin_0733.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/20170604_Sphynx_cat_7984.jpg/960px-20170604_Sphynx_cat_7984.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Russian_Blue_Cat_Looking_Up.jpg/960px-Russian_Blue_Cat_Looking_Up.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Bengal_Cat_Details_of_Face.jpeg/960px-Bengal_Cat_Details_of_Face.jpeg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Grumpy_Cat_%2814512777426%29.jpg/960px-Grumpy_Cat_%2814512777426%29.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/b/b8/Lil-Bub-2013_%28cropped%29.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Scottish_Fold_cat_%28blue%29.jpg/960px-Scottish_Fold_cat_%28blue%29.jpg'
    ] },
    title: 'Cuando quieras ver gatitos',
    note: 'Terapia felina instantánea',
    message: 'Mira estos pequeñitos y dime que no te sientes mejor. Los gatitos son la prueba de que la vida es bonita.'
  },

  // ─── 🤒 Cuidarte ───
  {
    id: 'estes-mala',
    category: 'cuidarte',
    type: 'carta',
    title: 'Cuando estés mala',
    note: 'Mima ese cuerpo',
    message: 'Cuando estés mala, tu única misión es descansar: agüita, sopita, mantita y peli. No hagas nada más, yo me encargo de cuidarte desde aquí. Si necesitas algo, aquí estoy. Recupérate pronto, mi niña'
  },
  {
    id: 'necesites-descansar',
    category: 'cuidarte',
    type: 'carta',
    title: 'Cuando necesites descansar',
    note: 'No todo tiene que ser hoy',
    message: 'Tienes permiso para parar. El mundo no se acaba si descansas un rato. Apaga la mente, estira, respira hondo y recuerda que eres humana, no una máquina. Cuando vuelvas, seguiré aquí. Te quiero'
  },

  // ─── 🌙 Noche ───
  {
    id: 'antes-de-dormir',
    category: 'noche',
    type: 'carta',
    title: 'Ábrela antes de dormir',
    note: 'Para cerrar el día bonito',
    message: 'Antes de dormir quiero que recuerdes tres cosas: 1. Hoy hiciste lo que pudiste y eso basta. 2. Mañana te esperan cosas bonitas. 3. Yo te quiero muchísimo. Duerme tranquila, mi princesa. Buenas noches 🤍'
  },
  {
    id: 'buenas-noches',
    category: 'noche',
    type: 'carta',
    title: 'Ábrela si no pude darte las buenas noches',
    note: 'Aunque yo no haya podido decírtelo',
    message: 'Si estoy viendo una peli, jugando o simplemente no pude escribirte, esta carta hace mi trabajo: buenas noches, mi niña hermosa. Que sueñes con cosas lindas y mañana te despiertes con una sonrisa. Te quiero, siempre'
  },
  {
    id: 'no-puedas-dormir',
    category: 'noche',
    type: 'sorpresa',
    title: 'Cuando no puedas dormir',
    note: 'Cuenta ovejitas conmigo',
    message: 'Si no puedes dormir, hagamos esto: respira hondo 4 veces, relaja los hombros y piensa en el lugar más bonito que hayas visto. Yo estoy ahí contigo. Cuando te duermas, te cuidaré el sueño. Buenas noches, princesa'
  },
  {
    id: 'cancion-de-cuna',
    category: 'noche',
    type: 'cancion',
    media: { kind: 'cancion', melody: 'cuna' },
    title: 'Ábrela cuando quieras una canción de cuna',
    note: 'Estrellita, ¿dónde estás?',
    message: 'Esta es nuestra canción de las estrellas. Cierra los ojos, escucha y déjate llevar. Duerme tranquila, mi princesa. Buenas noches 🤍'
  }
];

const SEEN_KEY = 'openwhen.seen';

/**
 * Lista completa de cartas: las personalizadas del Admin (Supabase)
 * sobrescriben a las de la app por id; el resto se mantienen.
 */
export async function loadAllOpenWhenLetters() {
  let custom = [];
  try {
    const loaded = await db.getOpenWhenLetters();
    if (Array.isArray(loaded)) custom = loaded;
  } catch {
    custom = [];
  }
  const byId = new Map();
  custom.forEach(l => { if (l && l.id) byId.set(l.id, l); });
  LETTERS.forEach(l => { if (!byId.has(l.id)) byId.set(l.id, l); });
  return [...byId.values()];
}

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
  function typeChip(type) {
    const meta = TYPE_META[type] || TYPE_META.carta;
    return `<span class="ow-type-chip" title="${meta.label}">${meta.emoji}</span>`;
  }

  function mediaWidget(letter) {
    if (!letter.media) return '';
    if (letter.media.kind === 'album') {
      return `<div class="ow-album">${letter.media.urls.map((u, i) => `
        <button class="ow-album-thumb" data-photo="${letter.id}" data-idx="${i}" aria-label="Ver foto ${i + 1}">
          <img src="${u}" alt="" loading="lazy">
        </button>`).join('')}</div>`;
    }
    const isNota = letter.media.kind === 'nota';
    const label = isNota
      ? 'Nota de voz'
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

  function letterCard(letter) {
    const meta = TYPE_META[letter.type] || TYPE_META.carta;
    const seenMark = isNew(letter)
      ? '<span class="ow-badge ow-badge--new">NUEVO</span>'
      : '<span class="ow-seen-mark">✓ Visto</span>';
    const openLabel = { nota: 'Escuchar', cancion: 'Escuchar', album: 'Ver fotos' }[letter.type] || 'Abrir';
    return `
      <div class="ow-letter" data-letter-id="${letter.id}">
        <div class="ow-letter-head">
          <span class="ow-letter-type">${meta.emoji}</span>
          <h3>${escapeHtml(letter.title)}</h3>
          ${seenMark}
        </div>
        <p class="ow-letter-note">${escapeHtml(letter.note)}</p>
        <button class="ow-open-btn" data-open="${letter.id}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg>
          ${openLabel}
        </button>
        <div class="ow-letter-content">
          <div class="ow-message">${escapeHtml(letter.message).replace(/\n/g, '<br>')}</div>
          ${mediaWidget(letter)}
          <div class="ow-signature">— Con todo mi cariño: Peluchito</div>
          <button class="ow-close-btn" data-close="${letter.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Cerrar sobre
          </button>
        </div>
      </div>`;
  }

  function catCard(cat) {
    const n = newOf(cat.id).length;
    return `
      <div class="ow-cat-card" data-cat="${cat.id}" role="button" tabindex="0">
        <div class="ow-cat-emoji">${cat.emoji}</div>
        <div class="ow-cat-body">
          <h3>${escapeHtml(cat.title)}</h3>
          <p class="ow-cat-count" data-cat-count="${cat.id}">${countText(cat.id)}</p>
        </div>
        ${n > 0 ? `<span class="ow-cat-dot"></span>` : ''}
        <span class="ow-cat-arrow" aria-hidden="true">→</span>
      </div>`;
  }

  function paraTiCard(letter) {
    const meta = TYPE_META[letter.type] || TYPE_META.carta;
    const cat = CATEGORIES.find(c => c.id === letter.category);
    return `
      <button class="ow-pt-card" data-pt="${letter.id}">
        <span class="ow-pt-icon">${meta.emoji}</span>
        <span class="ow-pt-text">
          <span class="ow-pt-title">${escapeHtml(letter.title)}</span>
          <span class="ow-pt-cat">${cat ? cat.emoji + ' ' + escapeHtml(cat.title) : ''}</span>
        </span>
        <span class="ow-pt-open" aria-hidden="true">→</span>
      </button>`;
  }

  /* ---------- vistas ---------- */
  function landingHTML() {
    const fresh = letters.filter(isNew).slice(0, 5);
    const cats = CATEGORIES.filter(c => totalOf(c.id) > 0);
    return `
      <div class="openwhen-container">
        <header class="ow-hero">
          <h1>Open When</h1>
          <p class="ow-hero-sub">¿Qué necesitas ahora? 🤍</p>
        </header>

        <section class="ow-for-you">
          <div class="ow-section-head">
            <h2>Para ti</h2>
            ${fresh.length
              ? `<span class="ow-section-sub">Tienes ${plural(fresh.length, 'cosa nueva', 'cosas nuevas')} esperándote</span>`
              : `<span class="ow-section-sub">Todo visto por aquí 🤍</span>`}
          </div>
          ${fresh.length
            ? `<div class="ow-pt-grid">${fresh.map(paraTiCard).join('')}</div>`
            : `<div class="ow-all-seen">🤍 Todo visto por aquí. Vuelve cuando lo necesites</div>`}
        </section>

        <section class="ow-categories">
          <div class="ow-section-head">
            <h2>¿Qué necesitas?</h2>
            <span class="ow-section-sub">Elige según cómo te sientas</span>
          </div>
          <div class="ow-cat-grid">
            ${cats.map(catCard).join('')}
          </div>
        </section>
      </div>`;
  }

  function categoryHTML(catId) {
    const cat = CATEGORIES.find(c => c.id === catId);
    if (!cat) return landingHTML();
    const all = lettersOf(catId);
    const news = all.filter(isNew);
    const olds = all.filter(l => !isNew(l));
    const n = news.length;

    return `
      <div class="openwhen-container ow-cat-view">
        <button class="ow-back-btn" data-back>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
          Open When
        </button>

        <header class="ow-cat-hero">
          <div class="ow-cat-hero-emoji">${cat.emoji}</div>
          <h1>${escapeHtml(cat.title)}</h1>
          <p>${escapeHtml(cat.tagline)}</p>
          <span class="ow-cat-hero-count" data-cat-count="${cat.id}">
            ${n > 0 ? `${plural(n, 'cosa nueva', 'cosas nuevas')}` : 'Todo visto por aquí 🤍'}
          </span>
        </header>

        ${news.length ? `
          <section class="ow-group">
            <h2 class="ow-group-title">Nuevas</h2>
            <div class="ow-letter-grid ow-nuevas-grid">${news.map(letterCard).join('')}</div>
          </section>` : ''}

        ${olds.length ? `
          <section class="ow-group">
            <h2 class="ow-group-title">Vistas</h2>
            <div class="ow-letter-grid ow-vistas-grid">${olds.map(letterCard).join('')}</div>
          </section>` : ''}
      </div>`;
  }

  let lbOverlay = null;

  function closeLightbox() {
    if (lbOverlay) {
      lbOverlay.remove();
      lbOverlay = null;
      document.body.style.overflow = '';
    }
  }

  function openLightbox(letterId, idx) {
    const letter = letterById(letterId);
    if (!letter?.media || letter.media.kind !== 'album') return;
    const urls = letter.media.urls;
    closeLightbox();
    const overlay = document.createElement('div');
    overlay.className = 'ow-lightbox';
    overlay.innerHTML = `
      <div class="ow-lb-backdrop" data-lb-close></div>
      <div class="ow-lb-stage">
        <button class="ow-lb-btn ow-lb-close" data-lb-close aria-label="Cerrar">✕</button>
        ${urls.length > 1 ? `<button class="ow-lb-btn ow-lb-prev" data-lb-prev aria-label="Anterior">‹</button>` : ''}
        <figure class="ow-lb-figure">
          <img src="${urls[idx]}" alt="">
          <figcaption class="ow-lb-caption"></figcaption>
        </figure>
        ${urls.length > 1 ? `<button class="ow-lb-btn ow-lb-next" data-lb-next aria-label="Siguiente">›</button>` : ''}
      </div>`;
    page.appendChild(overlay);
    lbOverlay = overlay;
    document.body.style.overflow = 'hidden';
    const img = overlay.querySelector('img');
    const cap = overlay.querySelector('.ow-lb-caption');
    let cur = idx;
    const show = (i) => {
      cur = (i + urls.length) % urls.length;
      img.src = urls[cur];
      cap.textContent = `${cur + 1} de ${urls.length}`;
    };
    show(idx);
    overlay.addEventListener('click', (e) => {
      if (e.target.closest('[data-lb-close]')) { closeLightbox(); return; }
      if (e.target.closest('[data-lb-prev]')) { show(cur - 1); return; }
      if (e.target.closest('[data-lb-next]')) { show(cur + 1); return; }
    });
  }

  function toggleAudio(letterId) {
    const letter = letterById(letterId);
    if (!letter?.media || (letter.media.kind !== 'nota' && letter.media.kind !== 'cancion')) return;

    // La misma carta ya suena → parar
    if (activeAudio?.letterId === letterId) {
      stopAllMedia();
      return;
    }
    stopAllMedia();

    const player = letter.media.kind === 'nota'
      ? startVoiceNote(letter.message)
      : startMusicBox(letter.media.melody);
    if (!player) return;

    const bubble = page.querySelector(`[data-audio="${letterId}"]`);
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
      if (elapsed >= player.duration + 0.4) { onEnd(); return; }
      const fill = bubble?.querySelector('.ow-audio-progress-fill');
      const time = bubble?.querySelector('.ow-audio-time');
      if (fill) fill.style.width = `${Math.min(100, (elapsed / player.duration) * 100)}%`;
      if (time) time.textContent = formatTime(Math.min(elapsed, player.duration));
    }, 150);
  }

  function render() {
    stopAllMedia();
    closeLightbox();
    page.innerHTML = view === 'landing' ? landingHTML() : categoryHTML(view);
  }

  /* ---------- acciones ---------- */
  function updateCounts() {
    page.querySelectorAll('[data-cat-count]').forEach(el => {
      const catId = el.dataset.catCount;
      const n = newOf(catId).length;
      const isHero = el.classList.contains('ow-cat-hero-count');
      el.textContent = n > 0
        ? plural(n, 'cosa nueva', 'cosas nuevas')
        : 'Todo visto por aquí 🤍';
      if (isHero) el.classList.toggle('ow-count-zero', n === 0);
    });
  }

  function openLetter(id, opts = {}) {
    const letter = letterById(id);
    if (!letter) return;

    // Marcar como visto
    if (!seen.includes(id)) {
      seen.push(id);
      persist();
    }

    const card = page.querySelector(`[data-letter-id="${id}"]`);
    if (card) {
      card.classList.add('open');
      const badge = card.querySelector('.ow-badge--new');
      if (badge) {
        const mark = document.createElement('span');
        mark.className = 'ow-seen-mark';
        mark.textContent = '✓ Visto';
        badge.replaceWith(mark);
      }
      // La carta se queda en su sitio mientras esté abierta;
      // al cerrarla (o al recargar) pasará a "Vistas".
      updateCounts();
    }

    if (opts.scroll) {
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // Mueve una carta ya cerrada de la sección "Nuevas" a "Vistas"
  function moveToVistas(card) {
    const nuevasGrid = page.querySelector('.ow-nuevas-grid');
    if (!nuevasGrid || !nuevasGrid.contains(card)) return;
    let vistasGrid = page.querySelector('.ow-vistas-grid');
    if (!vistasGrid) {
      const catView = page.querySelector('.ow-cat-view');
      if (!catView) return;
      const wrap = document.createElement('section');
      wrap.className = 'ow-group';
      wrap.innerHTML = '<h2 class="ow-group-title">Vistas</h2><div class="ow-letter-grid ow-vistas-grid"></div>';
      catView.appendChild(wrap);
      vistasGrid = wrap.querySelector('.ow-vistas-grid');
    }
    vistasGrid.appendChild(card);
    if (!nuevasGrid.children.length) {
      nuevasGrid.closest('.ow-group')?.remove();
    }
  }

  function goToCategory(catId) {
    if (!CATEGORIES.find(c => c.id === catId)) return;
    view = catId;
    render();
  }

  /* ---------- eventos ---------- */
  page.addEventListener('click', (e) => {
    const back = e.target.closest('[data-back]');
    if (back) {
      view = 'landing';
      render();
      return;
    }

    const cat = e.target.closest('[data-cat]');
    if (cat) {
      goToCategory(cat.dataset.cat);
      return;
    }

    const pt = e.target.closest('[data-pt]');
    if (pt) {
      const letter = letterById(pt.dataset.pt);
      if (!letter) return;
      goToCategory(letter.category);
      requestAnimationFrame(() => openLetter(letter.id, { scroll: true }));
      return;
    }

    const open = e.target.closest('[data-open]');
    if (open) {
      openLetter(open.dataset.open);
      return;
    }

    const play = e.target.closest('[data-play]');
    if (play) {
      toggleAudio(play.dataset.play);
      return;
    }

    const photo = e.target.closest('[data-photo]');
    if (photo) {
      openLightbox(photo.dataset.photo, parseInt(photo.dataset.idx, 10) || 0);
      return;
    }

    const close = e.target.closest('[data-close]');
    if (close) {
      const card = page.querySelector(`[data-letter-id="${close.dataset.close}"]`);
      if (card) {
        card.classList.remove('open');
        moveToVistas(card);
      }
      stopAllMedia();
    }
  });

  // Teclado: Enter en categorías (accesible) y Esc cierra el visor de fotos
  page.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLightbox();
      return;
    }
    if (e.key !== 'Enter') return;
    const cat = e.target.closest('[data-cat]');
    if (cat) {
      goToCategory(cat.dataset.cat);
    }
  });

  render();

  // Carga las cartas personalizadas del Admin (Supabase) y re-renderiza
  loadAllOpenWhenLetters().then(all => {
    const same = all.length === letters.length && all.every((l, i) => JSON.stringify(l) === JSON.stringify(letters[i]));
    if (same) return;
    letters = all;
    render();
  });

  return page;
}
