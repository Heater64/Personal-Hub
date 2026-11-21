/* ==========================================
   CELEBRACIÓN — los ambientes disponibles.
   Vive en utils/ porque lo leen tres sitios: el
   motor de partículas (components/), la hoja del
   día especial y el selector del Admin.
   ========================================== */

/**
 * Ambientes que puede elegir cada día. `shape` es lo que usa el canvas:
 * confeti en tiras, Copos redondos, hojas ovaladas, corazones y estrellas.
 * 'ninguno' no crea nada (y es el único que sale sin confeti).
 */
export const DECORATIONS = [
  { id: 'confeti', label: 'Confeti', icon: '🎉', shape: 'strip' },
  { id: 'nieve', label: 'Nieve', icon: '❄️', shape: 'flake' },
  { id: 'hojas', label: 'Hojas', icon: '🍂', shape: 'leaf' },
  { id: 'corazones', label: 'Corazones', icon: '💗', shape: 'heart' },
  { id: 'estrellas', label: 'Estrellas', icon: '✨', shape: 'star' },
  { id: 'emoji', label: 'Emojis', icon: '😊', shape: 'glyph' },
  { id: 'ninguno', label: 'Sin decoración', icon: '🚫', shape: null }
];

/**
 * Emojis que caen por defecto en cada fiesta, cuando el ambiente es «Emojis»
 * y ese día no trae su propia lista. Se eligen por tipo de día (el mismo
 * que decide el color), así que San Valentín sale de corazones y Halloween
 * de calabazas y fantasmas sin que haya que tocar nada.
 */
export const THEME_EMOJIS = {
  halloween: '🎃 👻 🦇 🕸️ 💀 🔫',
  christmas: '🎄 🎁 ❄️ 🛫 🎀 🏴️200d🎇',
  birthday: '🎂 🎉 🎈 🎁 😊',
  anniversary: '💍 ❤️ 🥂 💕 🌸',
  valentine: '💘 💝 💖 💕 💗 💜',
  memory: '💜 🌟 ⭐ 🌱',
  custom: '✨ 🎉 🎊 💖'
};

/** Los emojis del día: los propios si hay, y si no, los de su fiesta. */
export function emojisFor(dayEmoji, type) {
  const own = String(dayEmoji || '').trim().split(/\s+/).filter(Boolean);
  return own.length ? own : (THEME_EMOJIS[type] || THEME_EMOJIS.custom).split(/\s+/).filter(Boolean);
}

/** El vídeo va como portada grande o como fondo difuminado tras el texto. */
export const VIDEO_MODES = [
  { id: 'portada', label: 'Vídeo grande arriba' },
  { id: 'fondo', label: 'Vídeo de fondo' }
];

/** Un ambiente solo se acepta si existe: uno inventado dejaría la pantalla quieta. */
export function normalizeDecor(value) {
  return DECORATIONS.some(d => d.id === value) ? value : 'confeti';
}

/** Un ambiente concreto: nombre, icono y forma. */
export function decorInfo(value) {
  return DECORATIONS.find(d => d.id === normalizeDecor(value)) || DECORATIONS[0];
}

/** Opciones <option> para el selector del Admin. */
export function decorOptions(value) {
  const current = normalizeDecor(value);
  return DECORATIONS
    .map(d => `<option value="${d.id}"${d.id === current ? ' selected' : ''}>${d.icon} ${d.label}</option>`)
    .join('');
}

export function normalizeVideoMode(value) {
  return value === 'fondo' ? 'fondo' : 'portada';
}

/** Opciones <option> del selector de modo de vídeo. */
export function videoModeOptions(value) {
  const current = normalizeVideoMode(value);
  return VIDEO_MODES
    .map(m => `<option value="${m.id}"${m.id === current ? ' selected' : ''}>${m.label}</option>`)
    .join('');
}

/** Cuántas fotos se guardan como máximo en la tira de un día. */
export const MAX_GALLERY = 12;

/** Cuántos emojis se guardan como máximo por día. */
export const MAX_EMOJIS = 20;

/**
 * Direcciones de una galería: solo http(s), sin basura y con tope. Una URL
 * rota deja un hueco vacío en la tira de fotos.
 */
export function mediaList(value) {
  return (Array.isArray(value) ? value : [])
    .map(url => (typeof url === 'string' ? url.trim() : ''))
    .filter(url => /^https?:\/\//i.test(url))
    .slice(0, MAX_GALLERY);
}