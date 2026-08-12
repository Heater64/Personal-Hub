/* ==========================================
   calendar-expansion.js — Calendario 2026 (v5)

   Esqueleto del calendario de sorpresas: cada día de
   2026-08-11 → 2026-12-31 puede tener VARIOS contenidos.

   Distribución priorizada (sin mates a propósito):
   ❤️ Motivación · 💌 Cartas · 🧩 Acertijos · 💡 Curiosidades
   · 🧘 Desconexión · 🎯 Retos · 📸 Fotos · 🎬 Vídeos
   · 🎁 Sorpresas · 🔗 Retos reales · 🎨 Manualidades PDF
   · 🎮 Juegos (solo los no desbloqueados en julio, en días
     consecutivos desde el arranque; luego sigue el resto).

   El Admin puede reemplazar este esqueleto desde el panel
   (Contenido → Regalos) sin necesidad de tocar código.
   ========================================== */

const START_DATE = '2026-08-15';
const END_DATE = '2026-12-31';

// Solo los juegos que NO se desbloquearon en julio (los de julio ya se
// jugaron: memoria, ahorcado, tiroarco, snake, buscaminas, laberinto,
// meteoritos, cuchillos, torre, breakout), en días consecutivos desde el
// 15 de agosto. Los juegos retirados de la sala (flappy, nonogramas, dino,
// doodle, match3, asteroides) tampoco se asignan.
const GAME_DATES = {
  '2026-08-15': ['agujero-negro', 'Agujero Negro', 'Escapa de la atracción gravitatoria antes de que te atrape.'],
  '2026-08-16': ['tetris', 'Tetris', 'Encaja las piezas y completa líneas.'],
  '2026-08-17': ['2048', '2048', 'Une las baldosas hasta alcanzar el 2048.'],
  '2026-08-18': ['conecta4', 'Conecta 4', 'Consigue cuatro fichas en línea antes que tu rival.'],
  '2026-08-19': ['tresenraya', 'Tres en Raya', 'Un clásico rápido para jugar juntos.'],
  '2026-08-20': ['invaders', 'Space Invaders', 'Defiende la galaxia de la invasión alienígena.'],
  '2026-08-21': ['pong', 'Pong', 'Un duelo clásico, sencillo y adictivo.'],
  '2026-08-22': ['simon', 'Simon Dice', 'Recuerda la secuencia y llega más lejos.'],
  '2026-08-23': ['battleship', 'Hundir la Flota', 'Prepara tu estrategia y encuentra la flota rival.']
};

// ==========================================
// BOLSAS DE CONTENIDO (rotan por día)
// ==========================================

const AFFIRMATIONS = [
  ['Motivación del día', 'Hoy también puedes con todo. No tienes que demostrar nada: ya eres suficiente tal y como estás.'],
  ['Recordatorio', 'Estoy orgulloso de ti por levantarte y seguir. Eso ya es ganar.'],
  ['Para ti', 'Tu esfuerzo de hoy es tu regalo de mañana. Ve a tu ritmo, sin prisa.'],
  ['Un poco de fe', 'Lo que estás construyendo va por buen camino. Confía en ti como yo confío en ti.'],
  ['Ánimo', 'Si hoy te toca descansar, descansa. Mañana también vale.'],
  ['Te quiero cerca', 'Pase lo que pase hoy, aquí estoy. Contigo siempre.']
];

const LETTERS = [
  ['Una cartita', 'Hola princesa. Solo quería decirte que pensar en ti me hace el día más bonito. Cuídate mucho hoy.'],
  ['Para tus buenos días', 'Que hoy te sonría la vida como me sonríes tú a mí. Buenos días, mi niña.'],
  ['Mensaje del corazón', 'No sé qué hará el mundo hoy, pero yo sé que tú lo haces todo mejor solo con estar.'],
  ['Hasta luego', 'Cuando cierres esta carta, sonríe. Alguien muy especial se acuerda de ti en este momento.']
];

const RIDDLES = [
  { title: 'Adivinanza', q: 'Blanca por dentro, verde por fuera. Si quieres que te lo diga, espera.', a: 'La pera' },
  { title: 'Adivinanza de dos', q: 'Tengo agujas pero no sé coser, tengo números pero no sé leer.', a: 'Un reloj' },
  { title: 'Adivinanza', q: 'Cuanto más se moja, más te seca.', a: 'La toalla' },
  { title: 'Acertijo', q: 'Soy grande y no tengo puertas, me llenan y no tengo barriga.', a: 'El mar' },
  { title: 'Adivinanza', q: 'Oro parece, plata no es. ¿Qué es?', a: 'El plátano' }
];

const CURIOSITIES = [
  ['Curiosidad', 'Los gatos duermen de media 15 horas al día. Todo un arte.'],
  ['Curiosidad', 'La miel nunca se estropea: se han encontrado tarros de hace miles de años en perfecto estado.'],
  ['Dato curioso', 'Tu corazón late unas 100.000 veces al día sin pedirte permiso.'],
  ['Curiosidad', 'Los pulpos tienen tres corazones y sangre azul. Casi de otro planeta.'],
  ['Dato curioso', 'Las nubes pesan muchísimo: una mediana pesa lo mismo que unos 40 elefantes.']
];

const RELAX = [
  ['Desconecta', 'Respira hondo 5 veces. Cada respiración es un pequeño descanso para tu mente.'],
  ['Pausa', 'Cierra los ojos 30 segundos y piensa en un lugar que te dé paz. Estás ahí.'],
  ['Tregua', 'Hoy toca hacer una sola cosa y hacerla bien: respirar y soltar los hombros.'],
  ['Mimos', 'Ponte tu canción favorita, una mantita y no hagas nada más por un rato. Te lo mereces.']
];

const CHALLENGES = [
  ['Reto pequeño', 'Mándame una nota de voz con tu mejor imitación de alguien famoso.'],
  ['Reto de hoy', 'Encuentra algo bonito en tu casa y cuéntame por qué lo elegiste.'],
  ['Misión', 'Haz una foto de algo que te haga feliz hoy y enséñamela.'],
  ['Reto rápido', 'Escribe 3 cosas por las que darías las gracias hoy.']
];

const PHOTOS = [
  ['Una foto para ti', 'Aquí irá una foto especial. (Pista: la está eligiendo alguien con mucho cariño.)'],
  ['Foto del día', 'Aquí irá una foto para este día. Por ahora, imagínala y sonríe.']
];

const VIDEOS = [
  ['Un vídeo para ti', 'Aquí irá un vídeo especial para este día. Vuelve cuando esté listo.'],
  ['Vídeo sorpresa', 'Aquí irá un vídeo pensado solo para ti. Pronto.'],
  ['Para ver juntos', 'Aquí irá un vídeo para ver juntos en algún momento del día.']
];

const SURPRISES = [
  ['Sorpresa', 'Algo bueno se acerca. Mantén los ojos abiertos 😉'],
  ['Sorpresita', 'Hoy el universo te tiene reservado un momentito bonito. Búscalo.']
];

const OFFLINE = [
  ['Reto fuera de la web', 'Sal a la calle y mira el cielo. Si ves algo bonito, piensa en mí.'],
  ['Reto real', 'Hazle un cumplido sincero a alguien hoy. Luego cuéntame qué pasó.'],
  ['Reto fuera de la web', 'Bebe un vaso de agua, estira el cuello y da un mini paseo por casa.'],
  ['Reto real', 'Escribe una nota con un deseo y guárdala en un libro. Dentro de un año, ábrela.']
];

const CRAFTS = [
  ['Manualidad', 'Aquí habrá una manualidad en PDF lista para imprimir y hacer. 🎨'],
  ['Manualidad de hoy', 'Aquí irá un PDF descargable para crear algo bonito con tus manos.']
];

const GIFTBOXES = [
  ['Regalito', 'Aquí irá un regalo sorpresa para este día. 🎁']
];

// ==========================================
// UTILIDADES
// ==========================================

function pad(value) {
  return String(value).padStart(2, '0');
}

function dateToISO(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function monthLabel(year, month) {
  const labels = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${labels[month]} ${year}`;
}

function giftId(dateStr) {
  return `calendario_${dateStr.replaceAll('-', '')}`;
}

function pick(arr, index) {
  return arr[index % arr.length];
}

/** Normaliza la asignación de un día: string → [string], array → array limpia. */
function toIds(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function buildGameGift(dateStr, game) {
  const [id, title, message] = game;
  const redirectUrl = `games/${id}.html`;
  return {
    id: giftId(dateStr),
    title: `🎮 ${title}`,
    type: 'game',
    unlock: { mode: 'date', value: dateStr },
    redirect: true,
    redirectUrl,
    data: { message, redirectUrl }
  };
}

/**
 * Plan del día (esqueleto): 2-3 contenidos.
 * - Siempre: ❤️ motivación o 💌 carta.
 * - Siempre: 🧩 acertijo o 💡 curiosidad.
 * - Tercer contenido rotatorio (no en días de juego): desconexión,
 *   reto, foto, vídeo, sorpresa, reto real, manualidad o regalo.
 * Sin matemáticas: esas solo se añaden de forma explícita.
 */
function buildDayPlan(dateStr, dayIndex, extraSeq) {
  const plan = [];

  const first = dayIndex % 3 === 0
    ? { type: 'letter', title: pick(LETTERS, dayIndex)[0], message: pick(LETTERS, dayIndex)[1] }
    : { type: 'affirmation', title: pick(AFFIRMATIONS, dayIndex)[0], message: pick(AFFIRMATIONS, dayIndex)[1] };
  plan.push(first);

  if (dayIndex % 2 === 0) {
    const r = pick(RIDDLES, dayIndex);
    plan.push({ type: 'riddle', title: r.title, question: r.q, answer: r.a });
  } else {
    plan.push({ type: 'curiosity', title: pick(CURIOSITIES, dayIndex)[0], message: pick(CURIOSITIES, dayIndex)[1] });
  }

  const isGameDay = !!GAME_DATES[dateStr];
  if (!isGameDay && dayIndex % 4 !== 3) {
    const extras = [
      { type: 'relax', pool: RELAX },
      { type: 'challenge', pool: CHALLENGES },
      { type: 'polaroid', pool: PHOTOS },
      { type: 'video', pool: VIDEOS },
      { type: 'surprise', pool: SURPRISES },
      { type: 'offline', pool: OFFLINE },
      { type: 'craft', pool: CRAFTS },
      { type: 'giftBox', pool: GIFTBOXES }
    ];
    // Contador propio: avanza solo cuando se añade un extra, así
    // todos los tipos rotan aunque algunos días se salten el tercero.
    const extra = extras[extraSeq % extras.length];
    plan.push({ type: extra.type, title: pick(extra.pool, dayIndex)[0], message: pick(extra.pool, dayIndex)[1] });
  }

  return plan;
}

/**
 * Completa el catálogo con el esqueleto multi-contenido.
 * Nunca pisa asignaciones del Admin: respeta los ids existentes
 * del día y añade los del plan sin duplicar tipos ni ids.
 */
export function expandCalendarCatalog(input) {
  if (!input || typeof input !== 'object') return input;

  const catalog = input;
  catalog.months = catalog.months && typeof catalog.months === 'object' ? catalog.months : {};
  catalog.gifts = Array.isArray(catalog.gifts) ? catalog.gifts : [];
  catalog.giftsById = catalog.giftsById || {};
  catalog.gifts.forEach(gift => { if (gift?.id) catalog.giftsById[gift.id] = gift; });
  const giftIds = new Set(catalog.gifts.map(gift => gift?.id).filter(Boolean));

  const cursor = new Date(`${START_DATE}T12:00:00`);
  const end = new Date(`${END_DATE}T12:00:00`);
  let dayIndex = 0;
  let extraSeq = 0;

  while (cursor <= end) {
    const dateStr = dateToISO(cursor);
    const monthKey = dateStr.slice(0, 7);
    const day = String(cursor.getDate());

    if (!catalog.months[monthKey]) {
      catalog.months[monthKey] = { label: monthLabel(cursor.getFullYear(), cursor.getMonth() + 1), calendarMapping: {} };
    }
    if (!catalog.months[monthKey].calendarMapping) {
      catalog.months[monthKey].calendarMapping = {};
    }

    const mapping = catalog.months[monthKey].calendarMapping;
    const existingIds = toIds(mapping[day]);
    const existingTypes = new Set(existingIds.map(id => catalog.giftsById?.[id]?.type).filter(Boolean));

    const plan = [];
    if (GAME_DATES[dateStr]) {
      // Días de juego: SOLO el juego, sin motivación/carta ni acertijo/curiosidad.
      plan.push(buildGameGift(dateStr, GAME_DATES[dateStr]));
    } else {
      const dayPlan = buildDayPlan(dateStr, dayIndex, extraSeq);
      if (dayPlan.length === 3) extraSeq += 1; // se añadió el extra → avanza la rotación
      dayPlan.forEach(item => plan.push(item));
    }

    // Respeta lo ya asignado y añade el plan sin duplicar tipos ni ids
    const finalIds = [...existingIds];
    plan.forEach(item => {
      if (existingTypes.has(item.type)) return;
      const n = finalIds.length;
      const id = `${giftId(dateStr)}${n === 0 ? '' : `_${String.fromCharCode(96 + n)}`}`;
      if (giftIds.has(id)) return;
      const data = { message: item.message || '' };
      if (item.question) data.question = item.question;
      if (item.answer) data.answer = item.answer;
      if (item.type === 'polaroid') data.image = '';
      if (item.type === 'video') data.videoUrl = '';
      if (item.type === 'craft') data.pdfUrl = '';
      // Los juegos llevan redirectUrl (generada en buildGameGift): se preserva
      // para que el día abra la página del juego en vez de un modal genérico.
      if (item.redirectUrl) data.redirectUrl = item.redirectUrl;
      const gift = {
        id,
        title: item.title,
        type: item.type,
        unlock: { mode: 'date', value: dateStr },
        redirect: !!item.redirectUrl,
        redirectUrl: item.redirectUrl || '',
        data
      };
      catalog.gifts.push(gift);
      catalog.giftsById[id] = gift;
      giftIds.add(id);
      finalIds.push(id);
    });
    mapping[day] = finalIds.length === 1 ? finalIds[0] : finalIds;

    cursor.setDate(cursor.getDate() + 1);
    dayIndex += 1;
  }

  catalog.version = Math.max(Number(catalog.version) || 0, 5);
  return catalog;
}
