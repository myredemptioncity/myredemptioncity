/* RC Go service worker
 * - Makes the app installable and lets it open without a connection.
 * - Network first for the app's own files, so updates show straight away;
 *   the cached copy is only used when the phone is offline.
 * - Never touches live data: Supabase, Google Maps and other outside
 *   requests always go straight to the network.
 * Bump VERSION when you want every phone to drop its old cache.
 */
const VERSION = 'rcgo-v9';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css?v=9',
  'js/config.js?v=9',
  'js/liquid.js?v=9',
  'js/store.js?v=9',
  'js/backend.js?v=9',
  'js/api-local.js?v=9',
  'js/map.js?v=9',
  'js/core.js?v=9',
  'js/auth.js?v=9',
  'js/customer.js?v=9',
  'js/rider.js?v=9',
  'js/vendor.js?v=9',
  'js/admin.js?v=9',
  'js/blog.js?v=9',
  'js/scene3d.js?v=9',
  'privacy.html',
  'terms.html',
  'css/legal.css?v=9',
  'assets/rccg-emblem.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // live data & CDNs: leave alone

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) =>
          hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined)
        )
      )
  );
});
