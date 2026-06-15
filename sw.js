var CACHE = 'magasin2k-v27';
var ASSETS = [
  '/Article/',
  '/Article/index.html',
  '/Article/app.js',
  '/Article/favicon.ico',
  '/Article/icon-192.png',
  '/Article/icon-512.png',
  '/Article/manifest.json'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) { return c.addAll(ASSETS); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  // Toujours chercher en réseau d'abord (données temps réel)
  e.respondWith(
    fetch(e.request).catch(function() {
      return caches.match(e.request);
    })
  );
});
