/* ==========================================
   Estados de un regalo

   DailyHub usa cuatro estados: Idea · Por comprar · Comprado · Entregado.
   En Tamp llegan en dos migraciones: la 037 añade `starred` y la 039
   arregla el CHECK para que acepte 'comprar' y 'comprado'. Mientras falte
   una, la pantalla solo ofrece lo que la base acepta de verdad:

   · sin 037    → Idea · Comprado (preparado) · Entregado, lo de 034
   · sin 039    → Idea · Entregado: los dos estados nuevos se esconden
   · con las dos → los cuatro estados de DailyHub

   Al pintar una fila guardada se entiende cualquier estado, se ofrezca o
   no: una sorpresa antigua sigue mostrando «Comprado» aunque el selector
   no lo ofrezca. Este módulo es puro para poder probarlo sin navegador.
   ========================================== */

export const GIFT_STATE_META = {
  pendiente: { label: 'Idea', emoji: '💡', tone: 'idea' },
  comprar: { label: 'Por comprar', emoji: '🛒', tone: 'shop' },
  comprado: { label: 'Comprado', emoji: '✨', tone: 'ready' },
  // Valor de la 034: se guardaba como «Comprado» antes de existir `comprado`.
  preparado: { label: 'Comprado', emoji: '✨', tone: 'ready' },
  entregado: { label: 'Entregado', emoji: '🎉', tone: 'done' },
};

const FULL_ORDER = ['pendiente', 'comprar', 'comprado', 'entregado'];
const STARRED_ONLY = ['pendiente', 'entregado'];
const LEGACY_ORDER = ['pendiente', 'preparado', 'entregado'];

/**
 * Estados que el selector puede ofrecer.
 * @param {{ starred?: boolean, states?: boolean }} capabilities
 *   `starred` = la 037 está aplicada; `states` = la 039 está aplicada.
 */
export function offeredGiftStates({ starred = false, states = false } = {}) {
  if (starred && states) return FULL_ORDER;
  if (starred) return STARRED_ONLY;
  return LEGACY_ORDER;
}

/** Presentación de un estado, incluidos valores antiguos ya guardados. */
export function giftStateMeta(state) {
  return GIFT_STATE_META[state] || GIFT_STATE_META.pendiente;
}

/**
 * Valor que se puede escribir en la base. Sin la 039, «Por comprar» cae en
 * Idea y «Comprado» en el antiguo `preparado` en vez de chocar con el CHECK.
 */
export function storableGiftState(state, { starred = false, states = false } = {}) {
  if (starred && states) return state;
  if (state === 'comprar') return 'pendiente';
  if (state === 'comprado') return 'preparado';
  return state;
}
