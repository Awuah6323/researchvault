const VERSION = 'v7';

const isLocalhost = Boolean(
  self.location.hostname === 'localhost' ||
  self.location.hostname === '[::1]' ||
  self.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

if (isLocalhost) {
  self.addEventListener('install', () => {
    self.skipWaiting();
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys()
        .then((names) => Promise.all(names.map((name) => caches.delete(name))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.claim())
        .then(() => self.clients.matchAll({ type: 'window' }))
        .then((clients) => {
          clients.forEach((client) => {
            if ('navigate' in client) client.navigate(client.url);
          });
        })
    );
  });
} else {
  const SHELL_CACHE = `researchvault-shell-${VERSION}`;
  const ASSET_CACHE = `researchvault-assets-${VERSION}`;
  const CURRENT_CACHES = [SHELL_CACHE, ASSET_CACHE];

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

  function isImmutableAsset(url) {
    return url.pathname.startsWith('/assets/');
  }

  async function networkFirst(request) {
    const cache = await caches.open(SHELL_CACHE);
    try {
      const response = await fetch(request, { cache: 'reload' });
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

    if (url.origin !== self.location.origin) return;

    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/src/') || url.pathname.startsWith('/@')) {
      return;
    }

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

  self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  });
}
