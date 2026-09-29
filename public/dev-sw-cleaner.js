(function () {
  if (typeof window === 'undefined') return;

  const hostname = window.location.hostname;
  const isLocalhost = Boolean(
    hostname === 'localhost' ||
    hostname === '[::1]' ||
    hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
  );

  if (!isLocalhost) return;

  const hadController = Boolean(navigator.serviceWorker && navigator.serviceWorker.controller);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
      if (registrations.length > 0) {
        Promise.all(registrations.map(function (r) { return r.unregister(); })).then(function () {
          if ('caches' in window) {
            caches.keys().then(function (keys) {
              Promise.all(keys.map(function (k) { return caches.delete(k); })).then(function () {
                if (hadController) {
                  window.location.reload();
                }
              });
            });
          }
        });
      } else if ('caches' in window) {
        caches.keys().then(function (keys) {
          keys.forEach(function (k) { caches.delete(k); });
        });
      }
    });
  }
})();
