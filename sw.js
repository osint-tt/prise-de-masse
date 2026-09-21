/* sw.js — cache d'abord pour les fichiers de l'app, index.html en secours hors ligne.
 *
 * APP_VERSION n'est pas dupliquée ici : elle arrive dans l'URL du worker
 * (`./sw.js?v=1.0.0`, voir js/app.js), et js/logic.js en est la source unique.
 */

const APP_VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE_NAME = `prise-de-masse-v${APP_VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/logic.js',
  './js/storage.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Une icône manquante ne doit pas faire échouer toute l'installation.
      Promise.all(
        ASSETS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined)
        )
      )
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('prise-de-masse-v') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation : réseau si possible, sinon la page mise en cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const fresh = await fetch(request);
          return fresh;
        } catch {
          return (
            (await cache.match('./index.html')) ||
            (await cache.match('./')) ||
            new Response('Hors ligne', { status: 503, headers: { 'Content-Type': 'text/plain' } })
          );
        }
      })()
    );
    return;
  }

  // Fichiers de l'app : cache d'abord.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const fresh = await fetch(request);
        if (fresh && fresh.ok && fresh.type === 'basic') cache.put(request, fresh.clone());
        return fresh;
      } catch {
        return new Response('', { status: 504, statusText: 'Hors ligne' });
      }
    })()
  );
});
