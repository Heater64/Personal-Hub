/* ==========================================
   Personal Hub v2 — Datos de estados de ánimo
   Catálogos y resolución, sin dependencias: ni
   Supabase, ni localStorage, ni el DOM. Así se
   puede probar en aislamiento (node --test) y lo
   reutilizan el store, Sentimientos y el Admin.

   Se puede elegir MÁS DE UNA emoción a la vez. Para guardarlas sin tocar
   el esquema de la tabla `moods` (una fila por estado), la fila guarda la
   lista codificada: los ids, las etiquetas y los emojis van unidos por
   MOOD_SEPARATOR en sus respectivas columnas, y el score es la media.
   Una fila de una sola emoción queda exactamente igual que antes, así que
   todo el histórico sigue leyéndose sin migraciones.
   ========================================== */

/** Separador de la lista codificada dentro de una columna de texto. */
export const MOOD_SEPARATOR = '|';

/** Id reservado para la emoción que escribe ella cuando no está en la lista. */
export const CUSTOM_MOOD_ID = 'custom';
export const CUSTOM_MOOD_LABEL = 'Otras';
export const CUSTOM_MOOD_EMOJI = '💭';
export const CUSTOM_MOOD_SCORE = 2;
export const MAX_CUSTOM_LABEL = 40;

/**
 * Catálogo VIGENTE: todo lo que se puede registrar a partir de ahora.
 *
 * `quick` marca las que caben en la tarjeta de bienvenida y en la rejilla de
 * Sentimientos; el resto vive en el desplegable «Otras» y puede crecer sin
 * tocar ninguna pantalla. El score va de 0 (peor) a 4 (mejor) para que la
 * media del historial siga siendo comparable con los estados antiguos, que
 * usaban la misma escala.
 *
 * Para añadir una emoción nueva basta con una línea aquí.
 */
export const MOODS = [
  { id: 'preocupada',   label: 'Preocupada',      emoji: '😟', score: 1, quick: true },
  { id: 'enfadada',     label: 'Enfadada',        emoji: '😡', score: 0, quick: true },
  { id: 'triste',       label: 'Triste',          emoji: '🥺', score: 2, quick: true },
  { id: 'carino',       label: 'Necesito cariño', emoji: '🤍', score: 3, quick: true },
  { id: 'bien',         label: 'Bien',            emoji: '😊', score: 4 },
  { id: 'emocionada',   label: 'Emocionada',      emoji: '🤩', score: 4 },
  { id: 'decepcionada', label: 'Decepcionada',    emoji: '😔', score: 1 },
  { id: 'molesta',      label: 'Molesta',         emoji: '😤', score: 0 },
  { id: 'miedo',        label: 'Con miedo',       emoji: '👻', score: 1 },
  { id: 'asustada',     label: 'Asustada',        emoji: '😰', score: 1 },
  { id: 'dolor',        label: 'Dolor',           emoji: '🤕', score: 0 },
  { id: 'nauseas',      label: 'Con náuseas',     emoji: '🤢', score: 0 },
  { id: 'cansada',      label: 'Cansada',         emoji: '😴', score: 2 },
  { id: 'estresada',    label: 'Estresada',       emoji: '🫩', score: 0 },
  { id: 'enferma',      label: 'Enferma',         emoji: '🤧', score: 1 },
  { id: 'muyfeliz',     label: 'MUUUY FELIZ',     emoji: '🥳', score: 4 }
];

/**
 * Catálogo ANTERIOR. Ya no se ofrece para registrar, pero los días que se
 * guardaron con estos ids deben seguir leyéndose tal cual se registraron
 * ("Muy bieeeen", "Mal"…): el histórico no se reescribe.
 */
export const LEGACY_MOODS = [
  { id: 'great', label: 'Muy bieeeen',     emoji: '🤍',   score: 4, legacy: true },
  { id: 'good',  label: 'Bien',            emoji: '😊',  score: 3, legacy: true },
  { id: 'meh',   label: 'Un poquito mal',   emoji: '😕',  score: 2, legacy: true },
  { id: 'bad',   label: 'Mal',             emoji: '😔',  score: 1, legacy: true },
  { id: 'love',  label: 'Necesito cariño', emoji: '❤️', score: 0, legacy: true }
];

/** La emoción escrita a mano: misma forma que las del catálogo. */
export const CUSTOM_MOOD = Object.freeze({
  id: CUSTOM_MOOD_ID,
  label: CUSTOM_MOOD_LABEL,
  emoji: CUSTOM_MOOD_EMOJI,
  score: CUSTOM_MOOD_SCORE,
  custom: true
});

/** Las que se ven sin abrir el desplegable (tarjeta de bienvenida). */
export const QUICK_MOODS = MOODS.filter(m => m.quick);

/** Las del desplegable «Otras» (todas las que no son atajos). */
export const PALETTE_MOODS = MOODS.filter(m => !m.quick);

/** Catálogo unificado: el vigente primero, el antiguo detrás. */
export const ALL_MOODS = [...MOODS, ...LEGACY_MOODS];

/** Orden de las barras del Admin: catálogo, texto libre e histórico. */
export const ADMIN_MOOD_IDS = [...MOODS.map(m => m.id), CUSTOM_MOOD_ID, ...LEGACY_MOODS.map(m => m.id)];

/** Estado del catálogo vigente, o null si ya no se puede registrar. */
export function findMood(id) {
  return MOODS.find(m => m.id === id) || null;
}

/** Busca en vigente + histórico + texto libre (solo para LEER). */
function findAnyMood(id) {
  if (!id) return null;
  if (id === CUSTOM_MOOD_ID) return CUSTOM_MOOD;
  return MOODS.find(m => m.id === id) || LEGACY_MOODS.find(m => m.id === id) || null;
}

/** Parte una columna codificada sin devolver nunca cadenas vacías sueltas. */
function splitField(value) {
  if (typeof value !== 'string' || !value.trim()) return [];
  return value.split(MOOD_SEPARATOR).map(part => part.trim()).filter(Boolean);
}

/**
 * Limpia el texto que escribe ella: sin separadores (romperían la lista),
 * sin saltos de línea y con un máximo razonable de caracteres.
 */
export function cleanCustomLabel(text) {
  return String(text ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .split(MOOD_SEPARATOR).join('/')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CUSTOM_LABEL);
}

/** Emoción a partir del texto libre, o null si no queda nada que guardar. */
export function makeCustomMood(text) {
  const label = cleanCustomLabel(text);
  if (!label) return null;
  return { id: CUSTOM_MOOD_ID, label, emoji: CUSTOM_MOOD_EMOJI, score: CUSTOM_MOOD_SCORE, custom: true };
}

/**
 * Convierte cualquier forma de selección en una lista de emociones completa.
 * Acepta ids sueltos, entradas { id|mood, label } y arrays de ambas.
 */
export function normalizeMoodSelection(selection) {
  const raw = Array.isArray(selection) ? selection : (selection ? [selection] : []);
  const items = [];
  for (const entry of raw) {
    let item = null;
    if (typeof entry === 'string') {
      if (entry === CUSTOM_MOOD_ID) continue; // sin texto no es una emoción
      const known = findAnyMood(entry);
      if (known) item = { id: known.id, label: known.label, emoji: known.emoji, score: known.score, legacy: Boolean(known.legacy) };
    } else if (entry && typeof entry === 'object') {
      const id = entry.id || entry.mood || '';
      if (id === CUSTOM_MOOD_ID) {
        item = makeCustomMood(entry.label);
      } else {
        const known = findAnyMood(id);
        if (known) {
          item = {
            id: known.id,
            label: entry.label || known.label,
            emoji: entry.emoji || known.emoji,
            score: typeof entry.score === 'number' ? entry.score : known.score,
            legacy: Boolean(known.legacy)
          };
        } else {
          const label = cleanCustomLabel(entry.label);
          if (label) item = { id: CUSTOM_MOOD_ID, label, emoji: entry.emoji || CUSTOM_MOOD_EMOJI, score: CUSTOM_MOOD_SCORE, custom: true };
        }
      }
    }
    if (!item) continue;
    // Sin duplicados: la misma emoción dos veces solo distorsionaría la media.
    const dup = items.find(i => i.id === item.id && i.label === item.label);
    if (!dup) items.push(item);
  }
  return items;
}

/** Clave estable de una emoción (el texto distingue una «Otras» de otra). */
export function moodKey(item) {
  return `${item?.id || ''}::${item?.label || ''}`;
}

/**
 * Marca o desmarca una emoción sobre la selección actual (multi-selección).
 * Un texto libre nuevo sustituye al anterior: no tiene sentido acumular
 * varias «Otras» en la misma lista.
 */
export function toggleMoodSelection(selection, candidate) {
  const list = normalizeMoodSelection(selection);
  const item = normalizeMoodSelection([candidate])[0];
  if (!item) return list;
  const key = moodKey(item);
  const idx = list.findIndex(i => moodKey(i) === key);
  if (idx >= 0) {
    list.splice(idx, 1);
    return list;
  }
  const next = item.id === CUSTOM_MOOD_ID ? list.filter(i => i.id !== CUSTOM_MOOD_ID) : list;
  next.push(item);
  return next;
}

/**
 * Empaqueta la selección en las columnas de la fila de `moods`.
 * Devuelve null si no hay nada que guardar. El score es la media de las
 * emociones elegidas, así una fila con varias sigue cabiendo en la escala 0-4.
 */
export function encodeMood(selection) {
  const items = normalizeMoodSelection(selection);
  if (!items.length) return null;
  return {
    mood: items.map(i => i.id).join(MOOD_SEPARATOR),
    label: items.map(i => i.label).join(MOOD_SEPARATOR),
    emoji: items.map(i => i.emoji).join(MOOD_SEPARATOR),
    score: Math.round(items.reduce((sum, i) => sum + i.score, 0) / items.length)
  };
}

/**
 * Resuelve un estado para MOSTRARLO, sin depender del catálogo vigente.
 * Acepta un id suelto o una entrada { mood, label, emoji, score }, con una o
 * varias emociones codificadas.
 *
 * Prioridad: lo que venía guardado en la fila (fiel al histórico) →
 * catálogo vigente → catálogo antiguo. Devuelve null solo si no hay nada.
 * El resultado conserva `id`/`label`/`emoji` como texto legible y añade
 * `ids`, `items` y `count` para quien necesite la lista.
 */
export function resolveMood(entry) {
  if (!entry) return null;
  if (typeof entry === 'string') return resolveMood({ mood: entry });
  const ids = splitField(entry.mood);
  const labels = splitField(entry.label);
  const emojis = splitField(entry.emoji);
  const total = Math.max(ids.length, labels.length);
  const items = [];

  for (let i = 0; i < total; i++) {
    const id = ids[i] || '';
    const known = findAnyMood(id);
    const rowLabel = labels[i] || '';
    const rowEmoji = emojis[i] || '';
    // Ni catálogo ni etiqueta guardada: no hay nada que enseñar de esta.
    if (!known && !rowLabel) continue;
    // El emoji de un día registrado antes de un cambio de catálogo se corrige
    // al vigente (el caso real: 🥹 → 🥺 en «Triste»).
    const emoji = id === 'triste' && rowEmoji === '🥹' && known
      ? known.emoji
      : (rowEmoji || (known ? known.emoji : CUSTOM_MOOD_EMOJI));
    items.push({
      id: id || CUSTOM_MOOD_ID,
      label: rowLabel || known.label,
      emoji,
      score: known ? known.score : CUSTOM_MOOD_SCORE,
      legacy: Boolean(known?.legacy),
      custom: id === CUSTOM_MOOD_ID || (!known && Boolean(rowLabel))
    });
  }

  if (!items.length) return null;
  const average = Math.round(items.reduce((sum, i) => sum + i.score, 0) / items.length);
  return {
    id: items.map(i => i.id).join(MOOD_SEPARATOR),
    ids: items.map(i => i.id),
    label: items.map(i => i.label).join(' · '),
    emoji: items.map(i => i.emoji).join(''),
    score: typeof entry.score === 'number' ? entry.score : average,
    items,
    count: items.length,
    legacy: items.every(i => i.legacy),
    custom: items.some(i => i.custom)
  };
}

/** Emoji de un estado, sin devolver nunca undefined. */
export function moodEmoji(entry) {
  return resolveMood(entry)?.emoji || '';
}

/** Ids de un estado resuelto (lista vacía si no hay nada). */
export function moodIds(entry) {
  return resolveMood(entry)?.ids || [];
}
