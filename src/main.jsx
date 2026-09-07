import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FeedbackProvider } from './components/FeedbackProvider';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <FeedbackProvider>
        <App />
      </FeedbackProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// Service Worker management:
// In development / localhost, proactively unregister workers and clear caches so Vite dev server updates are immediate.
// In production, register PWA Service Worker for offline capabilities.
const isLocalhost = Boolean(
  typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
  )
);

if (import.meta.env.DEV || isLocalhost) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(async (registrations) => {
      const hadController = Boolean(navigator.serviceWorker.controller);
      for (const reg of registrations) {
        await reg.unregister();
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if (hadController) {
        console.info('[ResearchVault] Localhost Service Worker unregistered. Refreshing cleanly...');
        window.location.reload();
      }
    });
  }
} else if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        reg.update().catch(() => {});
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (installing) {
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                installing.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn('PWA ServiceWorker registration failed:', err);
      });
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}



