/* ==========================================
   Personal Hub v2 — Datos de Open When
   Catálogo y cartas base, sin dependencias de UI,
   para que servicios, Home y Admin los importen sin
   arrastrar la página Open When completa al bundle inicial.
   ========================================== */

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
