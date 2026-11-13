/**
 * F-010: phone-shell service worker.
 * Caches the phone page and its static assets so the client UI still opens
 * when the server or network briefly disappears (offline the user sees the
 * familiar page with a reconnect status instead of a browser error page).
 * Streaming itself always requires the live server — the WebSocket is never
 * intercepted, and /api/* responses are never cached.
 */

const CACHE = 'darkmic-shell-v2';
const SHELL = [
  '/phone',
  '/client.js',
  '/gate-worklet.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Phone page: network-first so a running server always wins; fall back to
  // the cached shell only when the server is unreachable. Other navigations
  // (e.g. the PC dashboard) get no offline shell — they are meaningless
  // without the server anyway.
  if (req.mode === 'navigate') {
    if (url.pathname !== '/phone') return;
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            // Never cache error pages — the offline fallback must serve a
            // good shell (QAInspector P2, 2026-11-14).
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('/phone', copy));
          }
          return res;
        })
        .catch(() => caches.match('/phone'))
    );
    return;
  }

  // Static assets: cache-first (the cache version string bumps when the
  // shell changes — bump darkmic-shell-vN on release, see decisions.md).
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});
