/* ==========================================
   Personal Hub v2 — Datos de estados de ánimo
   Catálogos y resolución, sin dependencias: ni
   Supabase, ni localStorage, ni el DOM. Así se
   puede probar en aislamiento (node --test) y lo
   reutilizan el store, Sentimientos y el Admin.
   ========================================== */

/**
 * Catálogo VIGENTE: lo único que se puede registrar a partir de ahora.
 * El score va de 0 (peor) a 4 (mejor) para que la media del historial siga
 * siendo comparable con los estados antiguos, que usaban la misma escala.
 */
export const MOODS = [
  { id: 'preocupada', label: 'Preocupada',      emoji: '😟', score: 1 },
  { id: 'enfadada',   label: 'Enfadada',        emoji: '😡', score: 0 },
  { id: 'triste',     label: 'Triste',          emoji: '🥹', score: 2 },
  { id: 'bien',       label: 'Bien',            emoji: '😊', score: 4 },
  { id: 'carino',     label: 'Necesito cariño', emoji: '🤍', score: 3 }
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

/** Catálogo unificado: el vigente primero, el antiguo detrás. */
export const ALL_MOODS = [...MOODS, ...LEGACY_MOODS];

/** Estado del catálogo vigente, o null si ya no se puede registrar. */
export function findMood(id) {
  return MOODS.find(m => m.id === id) || null;
}

/**
 * Resuelve un estado para MOSTRARLO, sin depender del catálogo vigente.
 * Acepta un id suelto o una entrada { mood, label, emoji, score }.
 *
 * Prioridad: lo que venía guardado en la fila (fiel al histórico) →
 * catálogo vigente → catálogo antiguo. Devuelve null solo si no hay nada.
 */
export function resolveMood(entry) {
  if (!entry) return null;
  if (typeof entry === 'string') return resolveMood({ mood: entry });
  const { mood: id, label, emoji, score } = entry;
  const known = MOODS.find(m => m.id === id) || LEGACY_MOODS.find(m => m.id === id);
  // La fila guardó su propia etiqueta: manda sobre el catálogo, para que un
  // día registrado antes de un cambio siga viéndose como se puso.
  if (!label && !known) return null;
  return {
    id,
    label: label || known.label,
    emoji: emoji || known.emoji,
    score: typeof score === 'number' ? score : (known ? known.score : 0),
    legacy: Boolean(known?.legacy)
  };
}

/** Emoji de un estado, sin devolver nunca undefined. */
export function moodEmoji(entry) {
  return resolveMood(entry)?.emoji || '';
}
