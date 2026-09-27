const SHELL_CACHE = "pr-shell-v1";
const RUNTIME_CACHE = "pr-runtime-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => ![SHELL_CACHE, RUNTIME_CACHE].includes(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls or non-GET requests. Every piece of app data
  // (cases, farms, weather, ML predictions...) must always come from a
  // live network response or fail explicitly — never a silently stale
  // cached copy presented as current. Offline handling for these lives in
  // src/lib/offline.ts (the pending-sync queue), not here.
  if (url.pathname.startsWith("/api/") || event.request.method !== "GET") {
    return;
  }

  // Page navigations: network-first, falling back to the last cached shell
  // (or the cached home page) when offline — this is what lets the app
  // itself open at all without a connection.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // Static assets (JS/CSS/images/icons/manifest): stale-while-revalidate.
  event.respondWith(
    caches.open(RUNTIME_CACHE).then((cache) =>
      cache.match(event.request).then((cached) => {
        const network = fetch(event.request)
          .then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    )
  );
});
