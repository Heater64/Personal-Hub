// ============================================================
// Personal Hub - Service Worker
// ============================================================
var CACHE_VERSION = 'v12';
var STATIC_CACHE  = 'personal-hub-static-' + CACHE_VERSION;
var DYNAMIC_CACHE = 'personal-hub-dynamic-' + CACHE_VERSION;
var APP_VERSION   = null; // se rellena al instalar/activar vía version.json

// -- Resources to precache on install --
var PRECACHE_URLS = [
  // HTML Pages
  '/',
  '/index.html',
  '/login.html',
  '/offline.html',
  '/version.json',
  '/pages/admin.html',
  '/pages/calendario.html',
  '/pages/canciones.html',
  '/pages/ia-lab.html',
  '/pages/juegos.html',
  '/pages/maldia.html',
  '/pages/openwhen.html',
  '/pages/ositos-world.html',
  '/pages/razones.html',
  '/pages/rincon.html',
  '/pages/sentimientos.html',
  '/pages/series.html',
  '/pages/thoseeyes.html',
  // Games HTML
  '/games/torre.html',
  '/games/tiroarco.html',
  '/games/snake.html',
  '/games/meteoritos.html',
  '/games/memoria.html',
  '/games/laberinto.html',
  '/games/cuchillos.html',
  '/games/buscaminas.html',
  '/games/breakout.html',
  '/games/ahorcado.html',
  '/games/agujero-negro.html',
  // CSS
    '/css/main.css',
    '/css/base.css',
    '/css/components.css',
    '/css/components/pwa-system.css',
  '/css/pages/admin.css',
  '/css/pages/calendario.css',
  '/css/pages/canciones.css',
  '/css/pages/home.css',
  '/css/pages/ia-lab.css',
  '/css/pages/juegos.css',
  '/css/pages/login.css',
  '/css/pages/maldia.css',
  '/css/pages/openwhen.css',
  '/css/pages/ositos-world.css',
  '/css/pages/razones.css',
  '/css/pages/rincon.css',
  '/css/pages/sentimientos.css',
  '/css/pages/series.css',
  '/css/pages/thoseeyes.css',
  // Core JS
  '/js/firebase-config.js',
    '/js/core.js',
    '/js/core/authGuard.js',
    '/js/core/profile.js',
    '/js/core/sync.js',
    '/js/core/analytics.js',
    '/js/core/renderer.js',
    '/js/core/modalSystem.js',
    '/js/core/unlockEngine.js',
    '/js/core/gameSession.js',
    '/js/core/haptica.js',
    '/js/core/memoria.js',
    '/js/core/connection-indicator.js',
    '/js/core/notifications.js',
    '/js/core/update-manager.js',
    '/js/core/install.js',
    '/js/sidebar.js',
    '/js/swipe-nav.js',
    '/js/sentimientos-nav.js',
    '/js/ui/pull-to-refresh.js',
    '/js/ui/skeleton.js',
  // Page JS
  '/js/pages/home.js',
  '/js/pages/admin.js',
  '/js/pages/calendario.js',
  '/js/pages/canciones.js',
  '/js/pages/ia-lab.js',
  '/js/pages/juegos.js',
  '/js/pages/maldia.js',
  '/js/pages/openwhen.js',
  '/js/pages/ositos-world.js',
  '/js/pages/razones.js',
  '/js/pages/rincon.js',
  '/js/pages/sentimientos.js',
  '/js/pages/series.js',
  '/js/pages/thoseeyes.js',
  // Data JS
  '/js/data/canciones.js',
  '/js/data/rincon.js',
  '/js/data/ositos-characters.js',
  '/js/data/hubCards.js',
  '/js/data/homeData.js',
  '/js/data/giftProgress.js',
  '/js/data/giftLoader.js',
  // UI JS
  '/js/ui/hubGridLayout.js',
  '/js/ui/hubGrid.js',
  '/js/ui/calendarGrid.js',
  // Module JS
  '/js/modules/cassette/index.js',
  '/js/modules/beatingHeart/index.js',
  '/js/modules/typewriter/index.js',
  '/js/modules/holdButton/index.js',
  '/js/modules/polaroid/index.js',
  '/js/modules/ticket/index.js',
  '/js/modules/moodCard/index.js',
  '/js/modules/scratchCard/index.js',
  '/js/modules/memoryJar/index.js',
  '/js/modules/randomThought/index.js',
  '/js/modules/letter/index.js',
  '/js/modules/secretPlaylist/index.js',
  '/js/modules/giftBox/index.js',
  '/js/modules/instantCamera/index.js',
  '/js/modules/confidentialLetter/index.js',
  '/js/modules/emojiRain/index.js',
  '/js/modules/cipherMessage/index.js',
  '/js/modules/cloudReveal/index.js',
  '/js/modules/cinematic/index.js',
  '/js/modules/diary/index.js',
  '/js/modules/clickStar/index.js',
  '/js/modules/countdown/index.js',
  '/js/modules/constellation/index.js',
  '/js/modules/shared/dom.js'
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

  // Cache-first for static assets for maximum speed
  if (url.pathname.match(/\.(css|js|png|svg|ico|woff2?|ttf|otf|eot|mp3|wav|ogg|jpg|jpeg|webp)$/)) {
    event.respondWith(
      caches.match(request).then(function(cachedResponse) {
        return cachedResponse || fetch(request).then(function(response) {
            safeCachePut(DYNAMIC_CACHE, request, response);
            return response;
        });
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

// -- Actualización silenciosa: re-precachea todo en segundo plano --
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
