// ============================================================
// Personal Hub - Service Worker
// ============================================================
var CACHE_VERSION = 'v5';
var STATIC_CACHE  = 'personal-hub-static-' + CACHE_VERSION;
var DYNAMIC_CACHE = 'personal-hub-dynamic-' + CACHE_VERSION;

// -- Resources to precache on install --
var PRECACHE_URLS = [
  // HTML Pages
  '/',
  '/index.html',
  '/login.html',
  '/offline.html',
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
  '/js/sidebar.js',
  '/js/swipe-nav.js',
  '/js/sentimientos-nav.js',
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

  // Stale-while-revalidate for static assets
  if (url.pathname.match(/\.(css|js|png|svg|ico|woff2?|ttf|otf|eot|mp3|wav|ogg|jpg|jpeg|webp)$/)) {
    event.respondWith(staleWhileRevalidate(request));
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

function networkFirst(request) {
  return Promise.race([
    fetch(request).then(function(response) {
      if (response.ok) {
        var clone = response.clone();
        caches.open(DYNAMIC_CACHE).then(function(cache) { cache.put(request, clone); });
      }
      return response;
    }),
    timeout(4000)
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
  var cachePromise = caches.open(DYNAMIC_CACHE);
  return cachePromise.then(function(cache) {
    return caches.match(request).then(function(cached) {
      var fetchPromise = fetch(request).then(function(response) {
        if (response.ok) cache.put(request, response.clone());
        return response;
      }).catch(function() { return cached; });
      return cached || fetchPromise;
    });
  });
}
