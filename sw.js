const cacheName = "homebar-pwa-v34";
const assets = [
  "./",
  "./index.html",
  "./styles.css?v=34",
  "./app.js?v=34",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./assets/hero-glass.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(cacheName).then((cache) => cache.addAll(assets))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== cacheName).map((key) => caches.delete(key))
    ))
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
