// ============================================================
// Personal Hub - Service Worker
// ============================================================
var CACHE_VERSION = 'v4';
var STATIC_CACHE  = 'personal-hub-static-' + CACHE_VERSION;
var DYNAMIC_CACHE = 'personal-hub-dynamic-' + CACHE_VERSION;

// -- Resources to precache on install --
var PRECACHE_URLS = [
  '/',
  '/index.html',
  '/login.html',
  '/offline.html',
  '/pages/admin.html',
  '/css/main.css',
  '/css/base.css',
  '/css/components.css',
  '/css/pages/logros.css',
  '/css/pages/mensajes.css',
  '/js/firebase-config.js',
  '/js/core.js',
  '/js/core/authGuard.js',
  '/js/core/profile.js',
  '/js/core/sync.js',
  '/js/core/analytics.js',
  '/js/sidebar.js',
  '/assets/Gemini_Generated_Image_6wkfln6wk.png'
];

// -- Install --
self.addEventListener('install', function(event) {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(function(cache) { return cache.addAll(PRECACHE_URLS); })
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
    url.hostname.indexOf('unpkg.com') !== -1
  ) {
    return;
  }

  // Cache-first for static assets
  if (url.pathname.match(/\.(css|js|png|svg|ico|woff2?|ttf|otf|eot|mp3|wav|ogg)$/)) {
    event.respondWith(cacheFirst(request));
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

function cacheFirst(request) {
  return caches.match(request).then(function(cached) {
    if (cached) return cached;
    return fetch(request).then(function(response) {
      if (response.ok) {
        var clone = response.clone();
        caches.open(STATIC_CACHE).then(function(cache) { cache.put(request, clone); });
      }
      return response;
    }).catch(function() {
      return new Response('Offline resource unavailable', { status: 503 });
    });
  });
}

function networkFirst(request) {
  return fetch(request).then(function(response) {
    if (response.ok) {
      var clone = response.clone();
      caches.open(DYNAMIC_CACHE).then(function(cache) { cache.put(request, clone); });
    }
    return response;
  }).catch(function() {
    return caches.match(request).then(function(cached) {
      if (cached) return cached;
      if (request.mode === 'navigate') {
        return caches.match('/offline.html');
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
