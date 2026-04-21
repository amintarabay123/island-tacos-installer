const CACHE = "island-tacos-v5";
const STATIC_ASSETS = [
  "/icon-192.png",
  "/icon-512.png",
  "/icon-pos-192.png",
  "/icon-pos-512.png",
  "/icon-kds-192.png",
  "/icon-kds-512.png",
  "/icon-admin-192.png",
  "/icon-admin-512.png",
  "/icon-display-192.png",
  "/icon-display-512.png",
  "/icon.svg",
  "/icon-pos.svg",
  "/icon-kds.svg",
  "/icon-admin.svg",
  "/athmovil-path-qr.jpg",
  "/athmovil-logo.webp",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // Never intercept API calls
  if (url.pathname.startsWith("/api/")) return;

  // For navigation requests (HTML pages) — always network-first so the app
  // always loads the latest HTML with correct JS asset references.
  // Only fall back to cache if the network is completely unreachable.
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(() => caches.match("/"))
    );
    return;
  }

  // For JS/CSS chunks (content-hashed filenames) — cache-first is safe
  // because the hash changes whenever the file changes.
  if (url.pathname.startsWith("/assets/")) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        });
      })
    );
    return;
  }

  // For everything else (icons, images, etc.) — stale-while-revalidate
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      });
      return cached || network;
    })
  );
});
