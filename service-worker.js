// Transition from the old cache-first worker: remove only this app's cache.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await caches.delete("ai-learning-platform-v1");
      await self.registration.unregister();
      await self.clients.claim();
    })(),
  );
});
