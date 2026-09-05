// public/sw.js - Service worker offline cache shell
const VERSION = 'v3';

// Split so a version bump can discard immutable bundles without throwing away
// the shell that serves the offline page.
const SHELL_CACHE = `researchvault-shell-${VERSION}`;
const ASSET_CACHE = `researchvault-assets-${VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, ASSET_CACHE];

// Enough to boot offline. Hashed bundles are deliberately absent: their names
// are unknown until Vite has run, and they are cached on first use instead.
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // addAll() is all-or-nothing: one 404 would reject the whole install and
      // leave the app with no service worker at all. Each file is allowed to
      // fail on its own instead.
      Promise.all(
        SHELL_ASSETS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
        )
      )
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => !CURRENT_CACHES.includes(name))
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

/** Content-hashed build output — immutable, because the hash is in the name. */
function isImmutableAsset(url) {
  return url.pathname.startsWith('/assets/');
}

/**
 * Newest HTML wins; the cache only answers when the network cannot.
 *
 * The successful response is written back, so the offline fallback is the most
 * recent index.html rather than whichever one happened to be cached first.
 */
async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    return (
      (await cache.match(request)) ||
      (await cache.match('/index.html')) ||
      (await cache.match('/')) ||
      Response.error()
    );
  }
}

/** For URLs whose bytes cannot change. No revalidation needed. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    return Response.error();
  }
}

/** Serve the cached copy, refresh it in the background for next time. */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response && response.ok && response.type === 'basic') {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) return cached;
  return (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Everything cross-origin is left entirely alone: Supabase auth, PostgREST and
  // Realtime, Gemini, OpenAlex, Google Fonts, cdnjs. Auth and vault responses
  // must never be answered from a cache, and passing the request through is a
  // stronger guarantee of that than a hostname allowlist that has to be kept in
  // step with every service the app talks to.
  if (url.origin !== self.location.origin) return;

  // A reload of a page the SW is serving arrives as a navigation, which is
  // exactly the request that used to be answered from a stale cache.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isImmutableAsset(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

// Lets the page trigger an update without a manual unregister in DevTools:
//   navigator.serviceWorker.controller?.postMessage({ type: 'SKIP_WAITING' })
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
