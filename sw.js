// ============================================================
// Personal Hub - Service Worker
// ============================================================
var CACHE_VERSION = 'v14';
var STATIC_CACHE  = 'personal-hub-static-' + CACHE_VERSION;
var DYNAMIC_CACHE = 'personal-hub-dynamic-' + CACHE_VERSION;
var APP_VERSION   = null; // se rellena al instalar/activar vía version.json

// -- Resources to precache on install (solo fallbacks offline) --
var PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/css/main.css',
  '/css/base.css',
  '/css/components.css'
];

// -- Helper: network timeout --
function timeout(ms) {
  return new Promise(function(_, reject) {
    setTimeout(function() { reject(new Error('Timeout')); }, ms);
  });
}

// -- Install --
self.addEventListener('install', function(event) {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(function(cache) {
        return Promise.all(
          PRECACHE_URLS.map(function(url) {
            return cache.add(url).catch(function(err) {
              console.warn('[SW] Failed to precache:', url, err);
            });
          })
        );
      })
      .then(cargarVersionApp)
      .then(function() { return self.skipWaiting(); })
  );
});

// -- Activate --
self.addEventListener('activate', function(event) {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) { return name !== STATIC_CACHE && name !== DYNAMIC_CACHE; })
          .map(function(name) {
            console.log('[SW] Cleaning old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

// -- Fetch interception --
self.addEventListener('fetch', function(event) {
  var request = event.request;
  var url = new URL(request.url);

  // Only handle http(s) requests (skip chrome-extension://, file://, etc.)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Only GET requests
  if (request.method !== 'GET') return;

  // Skip Firebase, Google APIs, and Lucide CDN
  if (
    url.hostname.indexOf('firebase') !== -1 ||
    url.hostname.indexOf('googleapis') !== -1 ||
    url.hostname.indexOf('gstatic.com') !== -1 ||
    url.hostname.indexOf('unpkg.com') !== -1 ||
    url.hostname.indexOf('cdn.jsdelivr.net') !== -1
  ) {
    return;
  }

  // Stale-while-revalidate for local static assets (instant from cache, update in background)
  if (url.pathname.match(/\.(css|js|png|svg|ico|woff2?|ttf|otf|eot|mp3|wav|ogg|jpg|jpeg|webp)$/)) {
    event.respondWith(
      caches.match(request).then(function(cached) {
        var fetchPromise = fetch(request).then(function(response) {
          safeCachePut(DYNAMIC_CACHE, request, response);
          return response;
        }).catch(function() {});
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Network-first for navigation/HTML
  if (request.mode === 'navigate' || url.pathname.match(/\.html$/)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Stale-while-revalidate for everything else
  event.respondWith(staleWhileRevalidate(request));
});

// -- Strategies --

// Guarda una respuesta en caché de forma segura (evita el error
// "Response body is already used" con respuestas opacas/cross-origin)
function safeCachePut(cacheName, request, response) {
  try {
    if (!response || !response.ok || response.type === 'opaque' || response.type === 'error') {
      return Promise.resolve();
    }
    var clone = response.clone();
    return caches.open(cacheName).then(function(cache) {
      return cache.put(request, clone).catch(function() {});
    }).catch(function() {});
  } catch (e) {
    return Promise.resolve();
  }
}

function networkFirst(request) {
  return Promise.race([
    fetch(request).then(function(response) {
      safeCachePut(DYNAMIC_CACHE, request, response);
      return response;
    }),
    timeout(2000) // Cambiado de 4000 a 2000
  ]).catch(function() {
    return caches.match(request).then(function(cached) {
      if (cached) return cached;
      if (request.mode === 'navigate') {
        return caches.match('/index.html');
      }
      return new Response('Offline', { status: 503 });
    });
  });
}

function staleWhileRevalidate(request) {
  // Ignorar peticiones que no sean http/https (como chrome-extension://)
  if (!request.url.startsWith('http')) return fetch(request);

  var cachePromise = caches.open(DYNAMIC_CACHE);
  return cachePromise.then(function(cache) {
    return caches.match(request).then(function(cached) {
      var fetchPromise = fetch(request).then(function(response) {
        safeCachePut(DYNAMIC_CACHE, request, response);
        return response;
      }).catch(function() { return cached; });
      return cached || fetchPromise;
    });
  });
}

// -- Mensajes desde la página --
self.addEventListener('message', function(event) {
  var data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (data.type === 'PRECACHE_UPDATE') {
    // Descarga en background los recursos nuevos para una actualización silenciosa
    event.waitUntil(precacheUpdate());
  } else if (data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: APP_VERSION, cache: CACHE_VERSION });
  }
});

// -- Actualización silenciosa: ya no es necesaria con network-first --
async function precacheUpdate() {
  try {
    const cache = await caches.open(STATIC_CACHE);
    await Promise.all(PRECACHE_URLS.map(function(url) {
      return cache.add(url).catch(function() {});
    }));
    console.log('[SW] Precaché de actualización completado');
  } catch (e) {
    console.warn('[SW] Precaché de actualización falló:', e);
  }
}

// -- Leer versión de la app desde version.json --
async function cargarVersionApp() {
  try {
    const res = await fetch('version.json', { cache: 'no-cache' });
    if (res.ok) {
      const json = await res.json();
      APP_VERSION = json.version || null;
    }
  } catch (e) {}
}
