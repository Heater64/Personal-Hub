/* ==========================================
   Estados de un regalo — fuente única

   El modelo de `tamp_entries` (kind='surprise') admite cinco valores:
   Idea · Por comprar · Comprado · Preparado · Entregado. `preparado`
   era el valor antiguo de «Comprado» y ahora es su propio estado; las
   filas guardadas con ese valor se siguen leyendo sin migrar nada.

   Las migraciones llegan en dos pasos y el selector solo ofrece lo que
   la base acepta de verdad:

   · sin 037    → Idea · Comprado (preparado) · Entregado, lo de 034
   · sin 039    → Idea · Entregado: los estados nuevos se esconden
   · con las dos → los cinco estados

   Aquí viven también la presentación (etiqueta, tono e ilustración) y
   el valor que se puede escribir. `gift-organizer.js` reexporta estas
   funciones: una sola definición para la pantalla y los cálculos.
   ========================================== */

export const GIFT_STATE_ORDER = ['pendiente', 'comprar', 'comprado', 'preparado', 'entregado'];

export const GIFT_STATE_META = {
  pendiente: { label: 'Idea', tone: 'idea', art: 'regalo-idea', step: 0 },
  comprar: { label: 'Por comprar', tone: 'shop', art: 'regalo-pendiente', step: 1 },
  comprado: { label: 'Comprado', tone: 'ready', art: 'regalo-comprado', step: 2 },
  preparado: { label: 'Preparado', tone: 'prepared', art: 'regalo-preparado', step: 3 },
  entregado: { label: 'Entregado', tone: 'done', art: 'regalo-entregado', step: 4 },
};

const LEGACY_ORDER = ['pendiente', 'preparado', 'entregado'];
const STARRED_ONLY = ['pendiente', 'entregado'];

/**
 * Estados que el selector puede ofrecer.
 * @param {{ starred?: boolean, states?: boolean }} capabilities
 *   `starred` = la 037 está aplicada; `states` = la 039 está aplicada.
 */
export function offeredGiftStates({ starred = false, states = false } = {}) {
  if (starred && states) return GIFT_STATE_ORDER.slice();
  if (starred) return STARRED_ONLY.slice();
  return LEGACY_ORDER.slice();
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
  if (starred && states) return GIFT_STATE_ORDER.includes(state) ? state : 'pendiente';
  if (state === 'comprar' || state === 'pendiente') return 'pendiente';
  if (state === 'comprado') return 'preparado';
  return state === 'entregado' ? 'entregado' : 'preparado';
}
