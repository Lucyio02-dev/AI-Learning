// 退役旧版 cache-first worker。必须继续在原 URL 发布此文件，
// 否则旧页面会一直命中缓存，连新 app.js 中的清理逻辑也无法执行。
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await caches.delete("ai-learning-platform-v1");
      await self.clients.claim();
      const scope = new URL(self.registration.scope);
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      await self.registration.unregister();
      // 只刷新本应用的页面；保留路径、课程锚点和所有 localStorage 数据。
      await Promise.allSettled(windows.map((client) => {
        const url = new URL(client.url);
        if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
        url.searchParams.set("app-upgrade", "3.1.0");
        return client.navigate(url.href);
      }));
    })(),
  );
});
