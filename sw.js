var CACHE = 'magasin2k-v87';
var IMG_CACHE = 'magasin2k-img-v1';   // cache des photos — PERSISTANT à travers les versions
var ASSETS = [
  '/Article/',
  '/Article/index.html',
  '/Article/app.js',
  '/Article/favicon.ico',
  '/Article/icon-192.png',
  '/Article/icon-512.png',
  '/Article/manifest.json'
];

// Chemins des photos hébergées sur Supabase Storage (buckets publics)
function isPhoto(url) {
  return url.indexOf('/storage/v1/object/public/photos-articles/') >= 0
      || url.indexOf('/storage/v1/object/public/outillage/') >= 0;
}

self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(ASSETS); }));
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  var keep = [CACHE, IMG_CACHE];
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return keep.indexOf(k) < 0; })
                            .map(function(k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

// Cache-First pour les photos : téléchargées une seule fois, puis servies
// depuis le cache local → économise la bande passante (egress) Supabase.
function cacheFirstImage(request) {
  return caches.open(IMG_CACHE).then(function(cache) {
    return cache.match(request).then(function(hit) {
      if (hit) return hit;
      return fetch(request).then(function(res) {
        // opaque (no-cors, status 0) OU 200 → on met en cache
        if (res && (res.ok || res.type === 'opaque')) {
          cache.put(request, res.clone());
        }
        return res;
      }).catch(function() {
        return cache.match(request).then(function(any) { return any || Response.error(); });
      });
    });
  });
}

self.addEventListener('fetch', function(e) {
  var url = e.request.url;
  // Photos Supabase → cache-first (uniquement les GET)
  if (e.request.method === 'GET' && isPhoto(url)) {
    e.respondWith(cacheFirstImage(e.request));
    return;
  }
  // Reste : réseau d'abord (données temps réel), cache en secours
  e.respondWith(
    fetch(e.request).catch(function() { return caches.match(e.request); })
  );
});

// Purge du cache images sur demande de l'app (ex: photo remplacée/supprimée)
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'evict-image' && e.data.url) {
    caches.open(IMG_CACHE).then(function(cache) { cache.delete(e.data.url); });
  }
});
