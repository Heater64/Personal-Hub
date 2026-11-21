/* ==========================================
   motion.js — Micro-movimiento de la web
   Revelado progresivo al hacer scroll y
   cascada suave al entrar en una página.

   Idea: el JS solo AÑADE movimiento. El
   estado oculto que provoca la animación lo
   aplica el CSS, y solo cuando <html> lleva
   la clase .motion-ready, que pone este
   módulo DESPUÉS de tener el observador
   montado. Si el JS falla o no se carga, la
   clase no llega a existir y todo el
   contenido se ve igual, sin animaciones.
   Esa es la garantía: nunca hay contenido
   invisible por un error de animación.
   ========================================== */

/**
 * Qué se revela al hacer scroll. Solo bloques —secciones, tarjetas, métricas—
 * y nunca filas de lista: en una lista larga (las 67 canciones) animar
 * elemento a elemento distrae más que ayuda.
 */
const REVEAL_TARGETS = [
  '.content > *',
  '.card',
  '.admin-panel',
  '.dash-metric',
  '.moods-stat',
  '.notif-status-card',
  '.series-card'
].join(',');

/** Cuánto se retrasa cada elemento respecto al anterior de su misma fila. */
const STAGGER_MS = 45;
const STAGGER_MAX_MS = 260;

/** Margen sobre la duración real del revelado, para el temporizador de respaldo. */
const REVEAL_MAX_MS = 1200;

let observer = null;
let started = false;

const prefersReduced = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Cuenta los hermanos ya registrados para escalonar sin tocar el DOM. */
function staggerFor(el) {
  const parent = el.parentElement;
  if (!parent) return 0;
  let index = 0;
  for (const sibling of parent.children) {
    if (sibling === el) break;
    if (sibling.hasAttribute('data-reveal')) index++;
  }
  return Math.min(index * STAGGER_MS, STAGGER_MAX_MS);
}

function register(el) {
  if (!el || el.hasAttribute('data-reveal')) return;
  el.setAttribute('data-reveal', '');
  el.style.setProperty('--reveal-delay', `${staggerFor(el)}ms`);
  observer?.observe(el);
}

function reveal(el) {
  if (el.classList.contains('is-revealed')) return;
  el.classList.add('is-revealed');

  // Al terminar se retira la animación: una animación de `transform` con
  // fill-mode activo crea containing block y rompería los position:fixed
  // de modales y hojas que viven dentro de la tarjeta.
  //
  // El temporizador es el respaldo: si el CSS decide no animar (por ejemplo
  // si el usuario activa el movimiento reducido con la pestaña ya abierta),
  // `animationend` no llega nunca y el atributo se quedaría colgando.
  const done = () => {
    clearTimeout(timer);
    el.classList.remove('is-revealed');
    el.removeAttribute('data-reveal');
    el.removeEventListener('animationend', done);
  };
  const timer = setTimeout(done, REVEAL_MAX_MS);
  el.addEventListener('animationend', done);
}

function scan(root) {
  if (!root || !observer) return;
  if (root.nodeType === 1 && root.matches?.(REVEAL_TARGETS)) register(root);
  root.querySelectorAll?.(REVEAL_TARGETS).forEach(register);
}

/**
 * Red de seguridad: pase lo que pase, a los 3 s nada sigue oculto. Cubre
 * un observer que no dispara (contenido dentro de un scroll anidado), un
 * observer que se pierde al re-renderizar o un nodo movido.
 */
function safetyNet(root) {
  setTimeout(() => {
    root?.querySelectorAll?.('[data-reveal]:not(.is-revealed)').forEach(el => {
      if (el.getBoundingClientRect().top < window.innerHeight) reveal(el);
    });
  }, 3000);
}

/**
 * Arranca el movimiento. Idempotente: se puede llamar desde el arranque y
 * desde cada navegación sin duplicar observadores.
 */
export function initMotion(root) {
  if (started) {
    scan(root);
    return;
  }
  started = true;

  // Con movimiento reducido no se oculta nada, así que ni la clase ni el
  // observador hacen falta: el CSS ya anula las animaciones por su cuenta.
  if (prefersReduced() || !('IntersectionObserver' in window)) return;

  observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      reveal(entry.target);
      observer.unobserve(entry.target);
    });
  }, {
    // Un poco antes de entrar: el elemento ya está casi en pantalla cuando
    // empieza a moverse, que es lo que hace que se perciba como "sutil".
    rootMargin: '0px 0px -8% 0px',
    threshold: 0.06
  });

  const target = root || document.querySelector('.content') || document.body;
  scan(target);
  safetyNet(target);

  // Las páginas pintan su contenido de forma asíncrona (await de Supabase y
  // luego innerHTML), así que el observer por sí solo se quedaría corto:
  // este vigilante recoge lo que se añada después.
  if (window.MutationObserver) {
    const mo = new MutationObserver((muts) => {
      muts.forEach(m => m.addedNodes.forEach((node) => {
        if (node.nodeType === 1) scan(node);
      }));
    });
    mo.observe(target, { childList: true, subtree: true });
  }

  // Solo ahora, con el observador montado, se autoriza al CSS a ocultar lo
  // pendiente. Esta clase es el interruptor: si el JS no llegara hasta aquí,
  // el contenido se vería igualmente.
  document.documentElement.classList.add('motion-ready');
}

/**
 * Llamar tras cada navegación. No re-marca lo ya revelado y recalcula el
 * escalonado de lo nuevo.
 */
export function refreshMotion(root) {
  if (!started || prefersReduced() || !observer) return;
  scan(root);
  safetyNet(root);
}
