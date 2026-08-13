/* ==========================================
   Personal Hub v2 — Service Worker (v7)
   Estrategias de caché inteligente:

   · Shell + juegos        → precache en install (offline desde la 1ª visita)
   · Assets del build      → cache-first (nombres con hash: inmutables)
   · HTML (navegación)     → network-first → offline.html
   · Fuentes               → cache-first (largo plazo)
   · Imágenes propias      → cache-first
   · Imágenes externas     → stale-while-revalidate (instantáneas + frescas)
   · Audio/Vídeo           → cache-first con PRESUPUESTO EN BYTES (~220 MB)
   · Supabase (content)    → network-first con fallback offline (lecturas públicas)
   · /api/*                → network-first con fallback offline
   · Resto                 → network-first
   ========================================== */

const CACHE_VERSION = '9';
const CACHE = `personal-hub-v${CACHE_VERSION}`;
const DYNAMIC_CACHE = `personal-hub-dynamic-v${CACHE_VERSION}`;
const MEDIA_CACHE = `personal-hub-media-v${CACHE_VERSION}`;

// Precarga la shell mínima (HTML offline + raíz) y los juegos: así se
// pueden abrir sin conexión desde la primera visita (no hacen falta que
// se hayan visitado antes). Los juegos son estáticos y ligeros (~360 KB).
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/games/agujero-negro.html',
  '/games/ahorcado.html',
  '/games/breakout.html',
  '/games/buscaminas.html',
  '/games/cuchillos.html',
  '/games/laberinto.html',
  '/games/memoria.html',
  '/games/meteoritos.html',
  '/games/snake.html',
  '/games/tiroarco.html',
  '/games/torre.html',
  '/games/tetris.html',
  '/games/2048.html',
  '/games/conecta4.html',
  '/games/tresenraya.html',
  '/games/invaders.html',
  '/games/pong.html',
  '/games/simon.html',
  '/games/battleship.html',
  '/games/_theme.css'
];

// Límites de la caché dinámica
const MAX_DYNAMIC_ITEMS = 200;

// Límites de la caché de MEDIA (audio/vídeo): presupuesto en bytes
// (~220 MB ≈ 40-60 canciones) + tope de items para no descontrolarse
// si el servidor no envía Content-Length (respuestas opacas).
const MEDIA_BUDGET = 220 * 1024 * 1024;
const MAX_MEDIA_ITEMS = 60;

// ─── INSTALL ───────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE).then(cache =>
        Promise.allSettled(
          PRECACHE_URLS.map(url => cache.add(url).catch(() => {}))
        )
      ),
      caches.open(DYNAMIC_CACHE),
      caches.open(MEDIA_CACHE)
    ]).then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ──────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      // Purga cachés de versiones anteriores
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE && k !== DYNAMIC_CACHE && k !== MEDIA_CACHE)
            .map(k => caches.delete(k))
        )
      ),
      // Toma control inmediato de los clientes
      self.clients.claim()
    ])
  );
});

// ─── MESSAGE HANDLING ──────────────────────────
self.addEventListener('message', event => {
  const data = event.data || {};
  switch (data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting().then(() => {
        self.clients.matchAll().then(clients => {
          clients.forEach(client => client.postMessage({ type: 'UPDATE_APPLIED' }));
        });
      });
      break;
    case 'CLEAR_CACHES':
      event.waitUntil(
        caches.keys().then(keys =>
          Promise.all(keys.map(k => caches.delete(k)))
        )
      );
      break;
    case 'GET_SW_INFO':
      // Diagnóstico (pwa.service / consola): versión y capacidades activas
      if (event.source) {
        event.source.postMessage({
          type: 'SW_INFO',
          version: CACHE_VERSION,
          rangedMedia: typeof serveRanged === 'function'
        });
      }
      break;
  }
});

// ─── FETCH ─────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo GET
  if (request.method !== 'GET') return;
  // Solo http/https
  if (!url.protocol.startsWith('http')) return;

  // ── Navegación (HTML): network-first, fallback offline ──
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithFallback(request, '/offline.html'));
    return;
  }

  // ── Assets del build (JS/CSS con hash en el nombre): cache-first ──
  // Nunca cambian entre deploys (el nombre incluye el hash), así que no
  // hay que revalidarlos: carga instantánea en visitas repetidas.
  if (/\/assets\/.*\.(js|css)$/.test(url.pathname)) {
    event.respondWith(cacheFirstImmutable(request));
    return;
  }

  // ── Fuentes (Google Fonts, etc.): cache-first con larga duración ──
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com' ||
    /\.(woff2?|ttf|otf|eot)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirstThenNetwork(request));
    return;
  }

  // ── Media (audio/vídeo): cache-first con presupuesto en bytes ──
  // Soporta peticiones con Range (streaming/seeking) sirviéndolas
  // desde el archivo completo cacheado; la 1ª vez descarga el archivo
  // entero y lo guarda (música offline + repetición instantánea).
  if (/\.(mp4|m4a|mp3|webm|ogg|wav)$/.test(url.pathname)) {
    event.respondWith(cacheFirstMedia(request));
    return;
  }

  // ── Imágenes ──
  if (/\.(png|jpe?g|gif|svg|ico|webp|avif)$/.test(url.pathname)) {
    if (url.origin === self.location.origin) {
      // Propias (del build/static): cache-first
      event.respondWith(cacheFirstThenNetwork(request));
    } else {
      // Externas (Cloudinary, Spotify, Wikipedia, dragonballlatino…):
      // stale-while-revalidate — instantáneas en la 2ª visita y se
      // refrescan en segundo plano (portadas actualizadas sin esperar).
      event.respondWith(staleWhileRevalidate(request));
    }
    return;
  }

  // ── Scripts externos (p. ej. lucide vía unpkg): stale-while-revalidate ──
  if (url.hostname.includes('unpkg.com')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // ── Supabase: solo la tabla `content` (lecturas públicas compartidas)
  // se guarda como fallback offline. El resto (moods, profiles, auth)
  // contiene datos personales: nunca se cachea.
  if (url.hostname.includes('supabase.co')) {
    if (url.pathname.includes('/rest/v1/content')) {
      event.respondWith(networkFirstWithFallback(request));
    }
    return;
  }

  // ── API del servidor: network-first con fallback offline ──
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }

  // ── Default: network-first ──
  event.respondWith(networkFirstWithFallback(request));
});

// ─── NOTIFICATIONS ─────────────────────────────
self.addEventListener('notificationclick', event => {
  const url = event.notification.data?.url || '/';
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          // App abierta: navega a la sección (p. ej. /calendario?day=...) sin recargar
          client.postMessage({ type: 'NAVIGATE', url });
          return;
        }
      }
      // App cerrada: abre la ruta hash (el router la resuelve)
      if (clients.openWindow) return clients.openWindow('/#' + url.replace(/^\//, ''));
    })
  );
});

// ─── WEB PUSH ──────────────────────────────────
// Recibe push del servidor y muestra notificación nativa.
// Funciona incluso con la app cerrada (no necesita PWA instalada).
self.addEventListener('push', event => {
  let payload = {};
  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch {
    // payload no es JSON, usar texto plano como body
    payload = { body: event.data?.text() || '' };
  }

  const title = payload.title || 'Personal Hub';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-144.png',
    tag: payload.tag || 'default',
    data: {
      url: payload.url || '/',
      ...payload.data
    },
    vibrate: payload.vibrate || [200, 100, 200],
    requireInteraction: payload.requireInteraction !== false,
    silent: payload.silent || false
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ─── PUSH SUBSCRIPTION CHANGE ─────────────────
// Re-suscribirse automáticamente cuando la suscripción expira o cambia.
// La clave VAPID pública es pública por diseño (no es secreto) y debe
// coincidir con VAPID_PUBLIC_KEY de notifications.service.js y el servidor.
const VAPID_PUBLIC_KEY =
  'BO_qmnZrQT4twbo24CGDk-bpJWcJyfGFQoBVqf24B0jkUKKHNOEyhkZQZ2nPc1Q4BHSSEpcVq71Xcb3FYKz7gIA';

self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    }).then(subscription => {
      // Notificar a todas las pestañas para que sincronicen la suscripción
      // con el servidor (POST /api/push/subscribe)
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
        clients.forEach(client => client.postMessage({
          type: 'PUSH_SUBSCRIPTION_CHANGED',
          subscription: subscription
        }));
      });
    }).catch(() => {
      // Fallback: el cliente reintentará en la próxima visita
    })
  );
});

// Helper: convierte base64 URL-safe a Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ─── PERIODIC BACKGROUND SYNC (fallback legacy) ─
const NOTIF_DB = 'ph-notifications';
const NOTIF_STORE = 'state';

// Día y hora en ESPAÑA (península, Europe/Madrid): el cambio de día es a las
// 00:00 españolas y la notificación de ánimo entra a las 8:00 españolas.
function todaySpain() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function hourSpain(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid', hour: '2-digit', hourCycle: 'h23'
  }).formatToParts(date || new Date());
  return Number(parts.find(p => p.type === 'hour')?.value || 0);
}

function idbGet(key) {
  return new Promise(resolve => {
    const req = indexedDB.open(NOTIF_DB);
    req.onsuccess = () => {
      const db = req.result;
      const get = db.transaction(NOTIF_STORE, 'readonly').objectStore(NOTIF_STORE).get(key);
      get.onsuccess = () => resolve(get.result || null);
      get.onerror = () => resolve(null);
    };
    req.onerror = () => resolve(null);
  });
}

function idbPut(key, value) {
  return new Promise(resolve => {
    const req = indexedDB.open(NOTIF_DB);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(NOTIF_STORE, 'readwrite');
      tx.objectStore(NOTIF_STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    };
    req.onerror = () => resolve(false);
  });
}

self.addEventListener('periodicsync', event => {
  if (event.tag === 'daily-welcome') {
    event.waitUntil(handleDailyWelcome());
  }
});

async function handleDailyWelcome() {
  const state = await idbGet('reminder');
  if (!state || !state.enabled || !state.userId) return;

  const now = new Date();
  const today = todaySpain();

  if (state.lastShown === today) return;
  if (hourSpain(now) < 8) return; // 8:00 hora de España

  await self.registration.showNotification('¡Buenos días! ☀️', {
    body: 'Es hora de tu check-in diario de estado de ánimo.',
    tag: 'daily-welcome',
    vibrate: [200, 100, 200],
    requireInteraction: false,
    data: { url: '/' }
  });

  await idbPut('reminder', { ...state, lastShown: today });
}

// ─── STRATEGIES ────────────────────────────────

/**
 * Network-first: intenta fetch, guarda en caché dinámica.
 * Si falla, devuelve de caché o página offline.
 */
async function networkFirstWithFallback(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const clone = response.clone();
      caches.open(DYNAMIC_CACHE).then(cache => {
        cache.put(request, clone).catch(() => {});
      });
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    if (fallbackUrl) {
      const offline = await caches.match(fallbackUrl);
      if (offline) return offline;
    }
    return new Response('Sin conexión', {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

/**
 * Cache-first para assets inmutables (nombre con hash del build):
 * nunca se revalidan; viven en la caché de precarga hasta el próximo
 * bump de versión del SW (que la purga).
 */
async function cacheFirstImmutable(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const clone = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, clone).catch(() => {}));
    }
    return response;
  } catch {
    return new Response('Sin conexión', {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

/**
 * Stale-while-revalidate: devuelve caché inmediatamente,
 * actualiza en segundo plano para la próxima visita.
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(response => {
      if (response && response.ok) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

/**
 * Cache-first: devuelve de caché si existe,
 * si no, va a red y guarda.
 */
async function cacheFirstThenNetwork(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const clone = response.clone();
      caches.open(DYNAMIC_CACHE).then(cache => {
        cache.put(request, clone).catch(() => {});
        // Limpieza de caché (máx 200 items)
        trimCache(cache);
      });
    }
    return response;
  } catch {
    return new Response('Sin conexión', {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

/**
 * Cache-first para media (audio/vídeo) con presupuesto EN BYTES:
 * las canciones se guardan para reproducir sin conexión y repetir
 * al instante, pero la caché no puede crecer sin límite.
 *
 * Los navegadores piden el audio con cabeceras Range (streaming y
 * seeking): si ya tenemos el archivo completo cacheado, servimos el
 * rango pedido desde la caché (206). Si no, bajamos el archivo
 * COMPLETO una sola vez, lo guardamos y servimos el rango.
 */
async function cacheFirstMedia(request) {
  const cache = await caches.open(MEDIA_CACHE);

  // 1. ¿Ya tenemos el archivo completo?
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) {
    if (request.headers.has('range')) {
      return serveRanged(cached, request.headers.get('range'));
    }
    return cached;
  }

  // 2. Descarga del archivo completo (sin Range) y guarda
  try {
    const fullRequest = request.headers.has('range')
      ? stripRange(request)
      : request;
    const response = await fetch(fullRequest);
    if (response && response.ok) {
      const clone = response.clone();
      const size = Number(response.headers.get('content-length')) || 0;
      await cache.put(fullRequest, clone);
      trimMediaCache(cache, size).catch(() => {});
    }
    if (request.headers.has('range')) {
      // Sirve el rango pedido desde lo que acabamos de guardar
      const stored = await cache.match(fullRequest, { ignoreVary: true });
      if (stored) return serveRanged(stored, request.headers.get('range'));
    }
    return response;
  } catch {
    return new Response('Sin conexión', {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

/** Devuelve una copia del request sin la cabecera Range. */
function stripRange(request) {
  const headers = new Headers(request.headers);
  headers.delete('range');
  return new Request(request.url, { headers });
}

/**
 * Sirve un rango (bytes) desde una respuesta completa cacheada,
 * devolviendo una respuesta 206 con Content-Range correcta.
 */
async function serveRanged(cachedResponse, rangeHeader) {
  try {
    const buffer = await cachedResponse.arrayBuffer();
    const total = buffer.byteLength;
    const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader || '');
    let start = 0;
    let end = total - 1;
    if (match) {
      if (match[1] !== '') start = parseInt(match[1], 10);
      if (match[2] !== '') end = Math.min(parseInt(match[2], 10), total - 1);
    }
    if (start >= total || start > end) {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${total}` }
      });
    }
    const slice = buffer.slice(start, end + 1);
    return new Response(slice, {
      status: 206,
      headers: {
        'Content-Type': cachedResponse.headers.get('content-type') || 'application/octet-stream',
        'Content-Length': String(end - start + 1),
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes'
      }
    });
  } catch {
    // Caso límite (respuesta cacheada ilegible): el navegador reintenta solo
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': 'bytes */0' }
    });
  }
}

/**
 * Recorta la caché de media hasta encajar en MEDIA_BUDGET bytes
 * y MAX_MEDIA_ITEMS items. Borra primero los archivos más grandes.
 */
async function trimMediaCache(cache, addedBytes) {
  const keys = await cache.keys();
  let total = addedBytes;
  const entries = [];
  for (const req of keys) {
    const res = await cache.match(req);
    const size = Number(res?.headers.get('content-length')) || 0;
    entries.push({ req, size });
    total += size;
  }

  if (total <= MEDIA_BUDGET && entries.length <= MAX_MEDIA_ITEMS) return;

  entries.sort((a, b) => b.size - a.size);
  let i = 0;
  while (
    (total > MEDIA_BUDGET || entries.length - i > MAX_MEDIA_ITEMS) &&
    i < entries.length
  ) {
    await cache.delete(entries[i].req);
    total -= entries[i].size;
    i++;
  }
}

/**
 * Recorta la caché dinámica si excede el límite de items.
 */
async function trimCache(cache) {
  try {
    const keys = await cache.keys();
    if (keys.length > MAX_DYNAMIC_ITEMS) {
      const toDelete = keys.slice(0, keys.length - MAX_DYNAMIC_ITEMS);
      for (const req of toDelete) {
        cache.delete(req).catch(() => {});
      }
    }
  } catch { /* no-op */ }
}
