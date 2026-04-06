// Claude Coach — Service Worker
// Strategy: network-first for HTML navigation, cache-first for hashed static assets.
// skipWaiting + clients.claim ensure updates apply immediately on next open.

const STATIC_CACHE = "cc-static-v1";

self.addEventListener("install", () => {
  self.skipWaiting(); // activate immediately, don't wait for old SW to finish
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim()) // take control of all open tabs immediately
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // HTML pages: network first, fallback to cache
    e.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Hashed static assets (_next/static/...): cache first
  if (url.pathname.includes("/_next/static/")) {
    e.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((res) => {
            caches.open(STATIC_CACHE).then((c) => c.put(request, res.clone()));
            return res;
          })
      )
    );
    return;
  }
});
