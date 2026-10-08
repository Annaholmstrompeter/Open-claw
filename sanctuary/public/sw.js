/* Offline support: after the first visit the whole sanctuary works without signal.
   Bump VERSION whenever files change so guests receive the update on their next visit. */
var VERSION = 'bme-sanctuary-v2';
var FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/style.css',
  'assets/content.js',
  'assets/art.js',
  'assets/app.js',
  'assets/logo.svg',
  'assets/icon.svg',
  'assets/icon-180.png',
  'assets/grain.svg',
  'assets/fonts/cormorant-garamond-latin-300-normal.woff2',
  'assets/fonts/cormorant-garamond-latin-400-normal.woff2',
  'assets/fonts/cormorant-garamond-latin-400-italic.woff2',
  'assets/fonts/cormorant-garamond-latin-500-normal.woff2',
  'assets/fonts/jost-latin-300-normal.woff2',
  'assets/fonts/jost-latin-400-normal.woff2',
  'assets/fonts/jost-latin-500-normal.woff2'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(VERSION).then(function (cache) { return cache.addAll(FILES); }).then(function () { return self.skipWaiting(); })
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
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(VERSION).then(function (cache) {
      return cache.match(req, { ignoreSearch: true }).then(function (hit) {
        var fresh = fetch(req).then(function (res) {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(function () { return hit; });
        return hit || fresh;
      });
    })
  );
});
