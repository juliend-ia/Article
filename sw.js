// Service Worker — Magasin 2K PWA
// Version du cache — incrémente pour forcer la mise à jour
const CACHE_VERSION = 'magasin2k-v1';
const CACHE_STATIC = 'magasin2k-static-v1';

// Fichiers à mettre en cache au premier chargement
const STATIC_FILES = [
  '/Article/',
  '/Article/index.html',
  '/Article/app.js',
  '/Article/manifest.json',
  '/Article/icons/icon-192.png',
  '/Article/icons/icon-512.png',
];

// ── INSTALLATION ─────────────────────────────────────────────────
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(function(cache) {
      return cache.addAll(STATIC_FILES);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATION ───────────────────────────────────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          return key !== CACHE_STATIC;
        }).map(function(key) {
          return caches.delete(key);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── FETCH : stratégie Network First pour l'API, Cache First pour le reste ──
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // API Supabase → toujours réseau (pas de cache)
  if (url.indexOf('supabase.co') >= 0) {
    event.respondWith(
      fetch(event.request).catch(function() {
        return new Response(JSON.stringify({ error: 'Hors ligne' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Fichiers statiques (index.html, app.js, icônes) → Network First avec fallback cache
  event.respondWith(
    fetch(event.request).then(function(response) {
      // Mettre en cache la nouvelle version
      if (response && response.status === 200 && event.request.method === 'GET') {
        var clone = response.clone();
        caches.open(CACHE_STATIC).then(function(cache) {
          cache.put(event.request, clone);
        });
      }
      return response;
    }).catch(function() {
      // Pas de réseau → utiliser le cache
      return caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        // Fallback ultime : page hors-ligne
        if (event.request.mode === 'navigate') {
          return caches.match('/Article/index.html');
        }
        return new Response('Hors ligne', { status: 503 });
      });
    })
  );
});
