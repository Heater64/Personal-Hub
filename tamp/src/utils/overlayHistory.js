/* ==========================================
   Personal Hub v2 — Historial de overlays
   Una entrada de historial por overlay abierto
   (bottom sheet, confirmación, visor de fotos…)
   para que el botón Atrás lo cierre en vez de
   sacar al usuario de la página donde está.
   ========================================== */

// Overlays abiertos, del más antiguo al más reciente: { id, close }.
// `close` debe ser idempotente: se llamará aunque ya esté cerrado.
const stack = [];
let seq = 0;

function topIndexFor(close) {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].close === close) return i;
  }
  return -1;
}

// Atrás/adelante del navegador: el estado de destino manda. Se cierra todo
// lo que quede por encima de la entrada a la que se vuelve. Si el destino es
// una entrada de overlay desconocida (un adelanto a algo ya cerrado) no se
// resucita nada: se deja la pila como está.
window.addEventListener('popstate', (event) => {
  const destId = event.state?.__phOverlayId;
  const destIdx = destId == null ? -1 : stack.findIndex(item => item.id === destId);
  if (destId != null && destIdx === -1) return;
  const keep = destId == null ? 0 : destIdx + 1;
  while (stack.length > keep) {
    const item = stack.pop();
    try { item.close(); } catch { /* el cierre debe ser idempotente */ }
  }
});

/**
 * Registra un overlay abierto y empuja su entrada de historial.
 */
export function pushOverlayHistory(close) {
  const id = ++seq;
  stack.push({ id, close });
  history.pushState({
    ...(history.state || {}),
    __phInPage: true,
    __phOverlayId: id
  }, '');
  return id;
}

/**
 * Llamar siempre que un overlay se cierre (botón, Escape, click fuera o
 * desde código). Si su entrada de historial sigue encima se deshace con
 * history.back() para que el siguiente Atrás no quede cojo; si no (cierre
 * al navegar a otra página), solo limpia la pila.
 */
export function finalizeOverlayClose(close) {
  const idx = topIndexFor(close);
  if (idx === -1) return;
  const item = stack[idx];
  if (idx !== stack.length - 1) {
    stack.splice(idx, 1);
    return;
  }
  // En microtarea: un cierre + navegación en el mismo tick (un atajo que
  // cambia de página, por ejemplo) pisa la entrada y no hay que deshacerla.
  queueMicrotask(() => {
    const i = stack.indexOf(item);
    if (i === -1) return;
    if (history.state && history.state.__phOverlayId === item.id) {
      history.back(); // el popstate lo saca de la pila
    } else {
      stack.splice(i, 1);
    }
  });
}
