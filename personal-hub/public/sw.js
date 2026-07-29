/* ==========================================
   Personal Hub v2 — Service Worker
   Cache-first for assets, network-first for HTML
   with update detection and skip-waiting support
   ========================================== */

const CACHE = 'personal-hub-v2';
const DYNAMIC_CACHE = 'personal-hub-dynamic-v2';

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

// ─── STRATEGIES ────────────────────────────────

async function networkFirstWithFallback(request, fallbackUrl = '/offline.html') {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      caches.open(DYNAMIC_CACHE).then(cache => {
        cache.put(request, clone).catch(() => {});
      });
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match(fallbackUrl).catch(() => new Response('Sin conexión', { status: 503 }));
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}

async function cacheFirstThenNetwork(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      caches.open(DYNAMIC_CACHE).then(cache => {
        cache.put(request, clone).catch(() => {});
      });
    }
    return response;
  } catch (err) {
    return caches.match('/offline.html').catch(() => new Response('Sin conexión', { status: 503 }));
  }
}
