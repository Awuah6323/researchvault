// src/utils/googleIdentity.js
// Waits until window.google.accounts is loaded before resolving

export function waitForGoogleIdentity(timeout = 10000) {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts) {
      return resolve(window.google);
    }

    const interval = setInterval(() => {
      if (window.google?.accounts) {
        clearInterval(interval);
        clearTimeout(timer);
        resolve(window.google);
      }
    }, 100);

    const timer = setTimeout(() => {
      clearInterval(interval);
      reject(new Error("Google Identity Services failed to load in time"));
    }, timeout);
  });
}
