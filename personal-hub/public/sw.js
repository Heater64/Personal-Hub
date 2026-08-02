/* ==========================================
   Personal Hub v2 — Service Worker
   Cache-first for assets, network-first for HTML
   with update detection and skip-waiting support
   ========================================== */

// v3: purga cachés de builds anteriores (chunks obsoletos que rompían la navegación)
const CACHE = 'personal-hub-v3';
const DYNAMIC_CACHE = 'personal-hub-dynamic-v3';

// Precarga solo rutas HTML que existen tanto en dev como en producción.
// Los assets (CSS/JS) los gestiona el runtime caching automáticamente.
const PRECACHE_URLS = [
  '/',
  '/offline.html'
];

const RUNTIME_CACHE_CONFIG = [
  { pattern: /\.(js|css)$/, strategy: 'stale-while-revalidate' },
  { pattern: /\.(png|jpg|jpeg|gif|svg|ico|webp|avif|woff2?)$/, strategy: 'cache-first' },
  { pattern: /\.(mp4|m4a|mp3|webm)$/, strategy: 'cache-first' }
];

// ─── INSTALL ───────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE).then(cache =>
        Promise.allSettled(
          PRECACHE_URLS.map(url =>
            cache.add(url).catch(() => {})
          )
        )
      ),
      caches.open(DYNAMIC_CACHE).catch(() => {})
    ]).then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ──────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE && k !== DYNAMIC_CACHE)
            .map(k => caches.delete(k))
        )
      ),
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
        // Notify all clients that update is ready
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'UPDATE_APPLIED' });
          });
        });
      });
      break;

    case 'PRECACHE_UPDATE':
      // Silently update cache in background
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ type: 'CACHE_UPDATED' }));
      });
      break;
  }
});

// ─── FETCH ─────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other protocols
  if (!url.protocol.startsWith('http')) return;

  // ── Navigation (HTML pages) ──
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }

  // ── Assets: check runtime config ──
  for (const config of RUNTIME_CACHE_CONFIG) {
    if (config.pattern.test(url.pathname)) {
      event.respondWith(
        config.strategy === 'cache-first'
          ? cacheFirstThenNetwork(request)
          : staleWhileRevalidate(request)
      );
      return;
    }
  }

  // ── Cloudinary / external CDN: cache-first ──
  if (url.hostname.includes('cloudinary.com') || url.hostname.includes('unpkg.com')) {
    event.respondWith(cacheFirstThenNetwork(request));
    return;
  }

  // ── Default: network-first ──
  event.respondWith(networkFirstWithFallback(request, '/offline.html'));
});

// ─── NOTIFICATIONS ─────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(event.notification.data?.url || '/');
    })
  );
});

// ─── PERIODIC BACKGROUND SYNC ──────────────────
// Recordatorio diario: 1 vez/día, solo después de las 8:00 local.
// El estado (habilitado + último día mostrado) vive en IndexedDB,
// compartido con la página (el SW no tiene acceso a localStorage).
const NOTIF_DB = 'ph-notifications';
const NOTIF_STORE = 'state';

// Fecha LOCAL en formato YYYY-MM-DD (coincide con todayISO de la página)
function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Sin versión explícita: abre la versión actual de la DB sin riesgo de VersionError
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
  const today = todayLocal();

  // 1 vez/día y solo a partir de las 8:00 (hora local del dispositivo)
  if (state.lastShown === today) return;
  if (now.getHours() < 8) return;

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

async function networkFirstWithFallback(request, fallbackUrl = '/offline.html') {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const clone = response.clone();
      caches.open(DYNAMIC_CACHE).then(cache => {
        cache.put(request, clone).catch(() => {});
      });
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Nunca devolver undefined a respondWith(): evita
    // "Failed to convert value to 'Response'"
    const offline = await caches.match(fallbackUrl);
    if (offline) return offline;
    return new Response('Sin conexión', {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

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
    .catch(() => cached || new Response('Sin conexión', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    }));
  return cached || fetchPromise;
}

async function cacheFirstThenNetwork(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const clone = response.clone();
      caches.open(DYNAMIC_CACHE).then(cache => {
        cache.put(request, clone).catch(() => {});
      });
    }
    return response;
  } catch (err) {
    const offline = await caches.match('/offline.html');
    if (offline) return offline;
    return new Response('Sin conexión', {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}
