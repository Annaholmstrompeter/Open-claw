/* Offline support: after the first visit the whole sanctuary works without signal.
   Bump VERSION whenever files change so guests receive the update on their next visit. */
var VERSION = 'bme-sanctuary-fc09e9a499';
var FILES = [
  './',
  'assets/app.js',
  'assets/content.js',
  'assets/fonts/cormorant-garamond-latin-300-normal.woff2',
  'assets/fonts/cormorant-garamond-latin-400-italic.woff2',
  'assets/fonts/cormorant-garamond-latin-400-normal.woff2',
  'assets/fonts/cormorant-garamond-latin-500-normal.woff2',
  'assets/fonts/jost-latin-300-normal.woff2',
  'assets/fonts/jost-latin-400-normal.woff2',
  'assets/fonts/jost-latin-500-normal.woff2',
  'assets/grain.svg',
  'assets/icon-180.png',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/img/balance-botanical.webp',
  'assets/img/balance-species.webp',
  'assets/img/balance-waves.webp',
  'assets/img/hero.webp',
  'assets/img/kindness-botanical.webp',
  'assets/img/kindness-species.webp',
  'assets/img/kindness-waves.webp',
  'assets/img/logo.webp',
  'assets/img/luminance-botanical.webp',
  'assets/img/luminance-species.webp',
  'assets/img/luminance-waves.webp',
  'assets/img/presence-botanical.webp',
  'assets/img/presence-species.webp',
  'assets/img/presence-waves.webp',
  'assets/img/ritual-balance.webp',
  'assets/img/ritual-kindness.webp',
  'assets/img/ritual-luminance.webp',
  'assets/img/ritual-presence.webp',
  'assets/img/ritual-serenity.webp',
  'assets/img/serenity-botanical.webp',
  'assets/img/serenity-species.webp',
  'assets/img/serenity-waves.webp',
  'assets/img/waves-gold.webp',
  'assets/img/welcome-hero.webp',
  'assets/style.css',
  'assets/together/player.js',
  'assets/together/session.js',
  'assets/together/together.css',
  'assets/together/together.js',
  'assets/together/transport.js',
  'index.html',
  'manifest.webmanifest'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    // 'reload': fetched from the server, never from the browser's short-term copy (a host may allow it ten minutes)
    caches.open(VERSION).then(function (cache) {
      return cache.addAll(FILES.map(function (f) { return new Request(f, { cache: 'reload' }); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Serve from cache straight away; refresh the cached copy quietly in the background.
self.addEventListener('fetch', function (event) {
  var req = event.request;
  var url = new URL(req.url);
  // the recordings are large and are streamed: the browser handles them itself.
  // TOGETHER's connection settings (config.js) are always read fresh, so a change to them applies at once.
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.indexOf('/assets/audio/') !== -1 ||
      url.pathname.indexOf('/assets/together/config.js') !== -1) return;
  event.respondWith(
    caches.open(VERSION).then(function (cache) {
      return cache.match(req, { ignoreSearch: true }).then(function (hit) {
        var fresh = fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(function (res) {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(function () { return hit; });
        return hit || fresh;
      });
    })
  );
});
