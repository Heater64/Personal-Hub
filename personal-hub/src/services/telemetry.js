/* ==========================================
   Personal Hub v2 — Telemetría
   Captura de errores no controlados y Web Vitals
   básicas, sin dependencias externas.

   Todo es opt-in: si VITE_TELEMETRY_URL no está
   definida no sale ni un byte a la red y los
   eventos solo se acumulan en memoria (accesibles
   desde window.__phTelemetry para depurar).

   Privacidad: nunca se envía el mensaje original
   de una excepción si parece contener un correo,
   ni la query string, ni identificadores de usuario.
   ========================================== */

const ENDPOINT = import.meta.env.VITE_TELEMETRY_URL;
const SAMPLE_RATE = Number(import.meta.env.VITE_TELEMETRY_SAMPLE_RATE || 1);

const MAX_EVENTS = 50;
const MAX_STACK_CHARS = 600;

const buffer = [];
let started = false;

/** Ruta actual normalizada: el router es hash-based y aquí se registra como /ruta. */
function currentRoute() {
  const hash = window.location.hash || '';
  // Sin query ni parámetros: pueden llevar identificadores o correos.
  const ruta = hash.split('?')[0].split('&')[0].replace(/^#/, '');
  return ruta || '/';
}

/**
 * Los mensajes de excepción a veces se tragan el valor de una variable
 * interpolada. Si huele a correo, token o URL con credenciales, se
 * descarta el mensaje y solo se manda el nombre del error.
 */
function sanitizeMessage(message) {
  const text = String(message || '').slice(0, 300);
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(text)) return '[mensaje omitido: contiene datos personales]';
  if (/eyJ[A-Za-z0-9_-]{20,}\./.test(text)) return '[mensaje omitido: parece un token]';
  if (/[a-z]+:\/\/[^/\s:]+:[^/\s@]+@/i.test(text)) return '[mensaje omitido: parece una URL con credenciales]';
  return text;
}

function sanitizeStack(stack) {
  if (!stack) return null;
  // Se recorta el origen (puede traer rutas del filesystem del servidor).
  return String(stack)
    .split('\n')
    .slice(0, 6)
    .map(line => line.replace(/https?:\/\/[^\s)]+\//g, '').trim())
    .join('\n')
    .slice(0, MAX_STACK_CHARS);
}

function record(type, payload) {
  const event = {
    type,
    route: currentRoute(),
    at: new Date().toISOString(),
    ...payload
  };
  buffer.push(event);
  if (buffer.length > MAX_EVENTS) buffer.shift();
  // Los errores se ven siempre en consola: son lo que hay que poder depurar.
  // Las métricas de rendimiento se reservan al buffer para no llenarla de ruido.
  if (type !== 'web-vital' && typeof console !== 'undefined' && console.warn) {
    console.warn(`[telemetría] ${type}`, event);
  }
  if (ENDPOINT) flush();
  return event;
}

/** Envía por `navigator.sendBeacon` si se puede, si no con fetch keepalive. */
function flush() {
  if (!ENDPOINT || buffer.length === 0) return;
  const body = JSON.stringify({ events: buffer.splice(0, buffer.length) });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
      return;
    }
  } catch { /* seguimos con fetch */ }
  fetch(ENDPOINT, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } })
    .catch(() => { /* sin red: se pierde, no rompe la app */ });
}

function shouldSample() {
  return SAMPLE_RATE >= 1 || Math.random() < SAMPLE_RATE;
}

// ─── Web Vitals (sin librería) ─────────────────
//
// LCP, CLS e INP solo tienen valor definitivo "al final" de la visita: se
// acumulan aquí y se emiten una única vez por métrica, cuando la pestaña se
// oculta. Emitirlos en cada interacción llenaría el buffer de ruido.

const vitals = new Map();

function stage(name, value) {
  const anterior = vitals.get(name);
  // CLS e INP solo empeoran: nos quedamos con el peor caso.
  if (anterior !== undefined && (name === 'CLS' || name === 'INP') && anterior >= value) return;
  vitals.set(name, value);
}

function reportStaged() {
  if (vitals.size === 0) return;
  const lote = [...vitals.entries()].map(([name, value]) => ({ name, value }));
  vitals.clear();
  if (!shouldSample()) return;
  record('web-vital', { metrics: lote });
}

/** Un solo volcado por visita: al ocultar o abandonar la pestaña. */
let volcadoHecho = false;
function flushVitalsOnce() {
  if (volcadoHecho) return;
  volcadoHecho = true;
  reportStaged();
}

function observeLCP() {
  try {
    new PerformanceObserver(list => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) stage('LCP', Math.round(last.startTime));
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch { /* navegador sin soporte */ }
}

function observeCLS() {
  try {
    let total = 0;
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) total += entry.value;
      }
      stage('CLS', Number(total.toFixed(4)));
    }).observe({ type: 'layout-shift', buffered: true });
  } catch { /* navegador sin soporte */ }
}

function observeINP() {
  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        // El observer entrega lotes: nos interesa la interacción más lenta.
        stage('INP', Math.round(entry.duration));
      }
    }).observe({ type: 'event', buffered: true, durationThreshold: 40 });
  } catch { /* navegador sin soporte */ }
}

function observeNavigation() {
  try {
    const [nav] = performance.getEntriesByType('navigation');
    if (!nav) return;
    // 0 significa "todavía no ha ocurrido": no es una medición válida.
    if (nav.responseStart > 0) stage('TTFB', Math.round(nav.responseStart));
    if (nav.domContentLoadedEventEnd > 0) stage('DOMContentLoaded', Math.round(nav.domContentLoadedEventEnd));
  } catch { /* sin soporte */ }
}

function watchVisibility() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushVitalsOnce();
  });
  // pagehide cubre el cierre y el bfcache, donde visibilitychange no siempre dispara.
  window.addEventListener('pagehide', flushVitalsOnce);
}

// ─── Errores ──────────────────────────────────

function onError(event) {
  record('error', {
    message: sanitizeMessage(event.message),
    source: event.filename ? event.filename.split('/').pop() : null,
    line: event.lineno ?? null,
    stack: sanitizeStack(event.error?.stack)
  });
}

function onRejection(event) {
  const reason = event.reason;
  record('unhandledrejection', {
    message: sanitizeMessage(reason?.message ?? reason),
    stack: sanitizeStack(reason?.stack)
  });
}

/**
 * Arranca la captura. Idempotente: llamarlo dos veces no duplica listeners.
 * Debe invocarse lo antes posible (antes de init()) para no perder los
 * errores tempranos del arranque.
 */
export function initTelemetry() {
  if (started) return;
  started = true;

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  observeNavigation();
  observeLCP();
  observeCLS();
  observeINP();
  watchVisibility();

  // Depuración manual: window.__phTelemetry.flush() fuerza el envío.
  window.__phTelemetry = {
    events: () => buffer.slice(),
    flush: () => { reportStaged(); flush(); },
    enabled: Boolean(ENDPOINT)
  };
}

export { currentRoute, sanitizeMessage, sanitizeStack };
