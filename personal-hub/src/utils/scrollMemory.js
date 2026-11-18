/* ==========================================
   scrollMemory — la posición en la que estabas

   La app no desplaza el documento: reset.css bloquea html/body y el scroll
   real ocurre dentro de `.main`. Por eso la restauración nativa del navegador
   (`history.scrollRestoration`) no puede hacer nada aquí, y el router vuelve a
   montar cada página desde cero: sin esta memoria, el botón Atrás siempre te
   devolvía arriba y había que volver a bajar a mano.

   La posición se guarda por ENTRADA de historial, no por ruta: dos visitas a
   /rincon son dos sitios distintos del documento.
   ========================================== */

const STORAGE_KEY = 'ph.scrollPositions';
const STATE_KEY = '__phScrollKey';
const MAX_ENTRIES = 60;
const SAVE_DEBOUNCE_MS = 400;
const RESTORE_MAX_MS = 1200;

/** clave de historial → altura del scroller. */
const positions = new Map();

let seq = 0;
let activeKey = null;
let scroller = null;
let frame = 0;
let saveTimer = null;
let restoreToken = 0;
let listening = false;
let guarding = false;

/** El único scroller de la app es .main (ver main.css). */
function resolveScroller() {
  if (scroller && scroller.isConnected) return scroller;
  scroller = document.querySelector('.main');
  return scroller;
}

function readY(el) {
  return el ? el.scrollTop : window.scrollY;
}

function writeY(el, y) {
  if (el) el.scrollTop = y;
  else window.scrollTo(0, y);
}

function trim() {
  while (positions.size > MAX_ENTRIES) {
    positions.delete(positions.keys().next().value);
  }
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(positions)));
  } catch {
    /* modo privado o cuota llena: seguimos solo con la memoria en RAM */
  }
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(save, SAVE_DEBOUNCE_MS);
}

function load() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const stored = JSON.parse(raw);
    if (!stored || typeof stored !== 'object') return;
    for (const [key, value] of Object.entries(stored)) {
      if (!Number.isFinite(value)) continue;
      positions.set(key, value);
      // Las claves son 's<n>': el contador sigue por encima de las guardadas
      // para no reutilizar ninguna.
      const n = Number(String(key).slice(1));
      if (Number.isFinite(n) && n > seq) seq = n;
    }
  } catch {
    /* almacenamiento ilegible: se empieza vacío */
  }
}

function record() {
  if (!activeKey) return;
  positions.set(activeKey, readY(resolveScroller()));
  trim();
  scheduleSave();
}

/** `scroll` no burbujea: se escucha en captura desde document. */
function onScroll(event) {
  const el = resolveScroller();
  if (el && event.target !== el) return;
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    record();
  });
}

function guardUserIntent(on) {
  if (on === guarding) return;
  guarding = on;
  const method = on ? 'addEventListener' : 'removeEventListener';
  window[method]('wheel', cancelRestore, { passive: true });
  window[method]('touchstart', cancelRestore, { passive: true });
  window[method]('keydown', cancelRestore);
}

/**
 * Aborta cualquier restauración en curso. Se llama cuando el usuario toma el
 * mando (rueda, dedo, teclado): la vista nunca debe pelearse con su gesto.
 */
export function cancelRestore() {
  restoreToken++;
  guardUserIntent(false);
}

export function initScrollMemory() {
  if (listening) return;
  listening = true;
  load();
  document.addEventListener('scroll', onScroll, { passive: true, capture: true });
  window.addEventListener('pagehide', save);
}

/** Guarda ahora la posición pendiente (antes de abandonar la entrada). */
export function flushScroll() {
  if (frame) {
    cancelAnimationFrame(frame);
    frame = 0;
  }
  record();
}

/** Clave nueva para una entrada de historial nueva. */
export function newKey() {
  return `s${++seq}`;
}

export function keyFor(state) {
  const key = state?.[STATE_KEY];
  return typeof key === 'string' && key ? key : null;
}

/** Marca la entrada sobre la que se está navegando ahora mismo. */
export function setActiveKey(key) {
  if (!key) return;
  activeKey = key;
  if (!positions.has(key)) positions.set(key, 0);
}

/** Posición guardada de una entrada (0 si no hay nada). */
export function savedY(key) {
  const y = key ? positions.get(key) : 0;
  return Number.isFinite(y) ? y : 0;
}

// ==========================================
// Memoria entre pestañas — Galería / Memes / Audios / Minecraft
// Las pestañas son rutas distintas (cada una es una entrada de historial
// nueva), así que al cambiarse el router empieza arriba. Aquí se recuerda la
// altura de la pestaña que se abandona y se reaplica al entrar en la otra,
// reutilizando la restauración con reintentos de esta misma utilidad.
// ==========================================

/** Ruta → última altura vista en esa pestaña. */
const tabPositions = new Map();

/** Guarda la altura de la pestaña que se abandona (lo llama su cleanup). */
export function saveTabScroll(path, y) {
  if (!path) return;
  tabPositions.set(path, Math.max(0, Number(y) || 0));
}

/**
 * Devuelve la pestaña recién montada a la altura en la que se dejó.
 * Se reafirma durante un momento: el router vuelve arriba al montar la ruta y
 * el contenido perezoso aún está creciendo.
 */
export function restoreTabScroll(path) {
  const y = tabPositions.get(path) || 0;
  if (!y) return;

  // Se reafirma durante un momento: el router vuelve arriba al montar la ruta
  // y el contenido perezoso aún está creciendo. setInterval en vez de rAF para
  // que funcione igual con la pestaña en segundo plano.
  const started = performance.now();
  const stop = () => {
    clearInterval(timer);
    window.removeEventListener('wheel', stop, { passive: true });
    window.removeEventListener('touchstart', stop, { passive: true });
    window.removeEventListener('keydown', stop);
  };
  const step = () => {
    const el = document.querySelector('main.main');
    if (el) el.scrollTop = y;
    if (!el || Math.abs(el.scrollTop - y) < 2 || performance.now() - started > 1500) stop();
  };
  const timer = setInterval(step, 60);
  window.addEventListener('wheel', stop, { passive: true, once: true });
  window.addEventListener('touchstart', stop, { passive: true, once: true });
  window.addEventListener('keydown', stop, { once: true });
  step();
}

/**
 * Devuelve la vista a `y` en la entrada `key`. El contenido de las páginas
 * llega de forma asíncrona (import() + Supabase), así que se reintenta en cada
 * frame hasta que el scroller tenga altura suficiente. Sin `smooth`: una
 * vuelta atrás tiene que ser instantánea, como en una app nativa.
 */
export function restoreScroll(key, y = savedY(key)) {
  const target = Math.max(0, Number.isFinite(y) ? y : 0);
  cancelRestore();
  const token = restoreToken;
  guardUserIntent(true);
  const started = performance.now();

  const step = () => {
    if (token !== restoreToken) return; // el usuario (o otra navegación) mandó
    const el = resolveScroller();
    writeY(el, target);
    if (Math.abs(readY(el) - target) < 2 || performance.now() - started > RESTORE_MAX_MS) {
      cancelRestore();
      return;
    }
    requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}
