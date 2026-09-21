/* sw.js — cache d'abord pour les fichiers de l'app, index.html en secours hors ligne.
 *
 * APP_VERSION n'est pas dupliquée ici : elle arrive dans l'URL du worker
 * (`./sw.js?v=1.0.2`, voir js/app.js), et js/logic.js en est la source unique.
 *
 * Les fichiers sont servis depuis le cache (instantané, et hors ligne), puis
 * revalidés en arrière-plan. Sans cette revalidation, l'ancien js/app.js resterait
 * servi indéfiniment : il redemanderait l'ancienne URL du worker, et aucune nouvelle
 * version ne pourrait jamais être détectée. Quand un fichier a réellement changé,
 * le worker prévient les pages ouvertes, qui affichent « Mise à jour disponible ».
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

const ASSET_PATHS = new Set(ASSETS.map((url) => new URL(url, self.location.href).pathname));

/** Les fichiers texte sont comparés octet à octet ; les images, non. */
function isComparable(pathname) {
  return /\.(html|css|js|webmanifest|svg)$/.test(pathname) || pathname.endsWith('/');
}

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

/**
 * Signale une nouvelle version.
 * La revalidation peut se terminer avant que la page n'ait posé son écouteur : le
 * signal est donc aussi déposé dans un cache dédié, que l'app relit à chaque démarrage.
 * Ce cache n'est pas nommé `prise-de-masse-v…`, il survit donc au ménage des anciens caches.
 */
const MAJ_CACHE = 'prise-de-masse-maj';
const MAJ_MARQUEUR = './maj';

async function annonceMiseAJour() {
  try {
    const cache = await caches.open(MAJ_CACHE);
    await cache.put(MAJ_MARQUEUR, new Response('1'));
  } catch {
    /* le message ci-dessous reste la voie rapide */
  }
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) client.postMessage({ type: 'CONTENT_UPDATED' });
}

/**
 * Rafraîchit le cache en arrière-plan, et signale un vrai changement de contenu.
 * `cached` doit être un clone privé : l'original part vers la page et son corps
 * ne peut plus être lu ensuite.
 */
async function revalider(cache, request, cached) {
  let fresh;
  try {
    fresh = await fetch(request, { cache: 'no-store' });
  } catch {
    return; // hors ligne : le cache reste la référence
  }
  if (!fresh || !fresh.ok) return;
  const pourCache = fresh.clone();

  let change = false;
  if (cached && isComparable(new URL(request.url).pathname)) {
    try {
      const [avant, apres] = await Promise.all([cached.text(), fresh.text()]);
      change = avant !== apres;
    } catch {
      change = false;
    }
  }

  await cache.put(request, pourCache);
  if (change) await annonceMiseAJour();
}

/** event.waitUntil peut refuser une tâche tardive : on la laisse alors tourner seule. */
function prolonger(event, promesse) {
  try {
    event.waitUntil(promesse);
  } catch {
    /* la promesse continue de son côté */
  }
}

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
          if (fresh && fresh.ok) {
            // Clones pris tout de suite : la réponse originale part vers le navigateur.
            const pourComparaison = fresh.clone();
            const pourCache = fresh.clone();
            prolonger(
              event,
              (async () => {
                const cached = await cache.match('./index.html');
                let change = false;
                if (cached) {
                  try {
                    const [avant, apres] = await Promise.all([
                      cached.text(),
                      pourComparaison.text(),
                    ]);
                    change = avant !== apres;
                  } catch {
                    change = false;
                  }
                }
                await cache.put('./index.html', pourCache);
                if (change) await annonceMiseAJour();
              })()
            );
          }
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

  // Fichiers de l'app : cache d'abord, revalidation en arrière-plan.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) {
        if (ASSET_PATHS.has(url.pathname)) {
          prolonger(event, revalider(cache, request, cached.clone()));
        }
        return cached;
      }
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
