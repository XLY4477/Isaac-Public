const CACHE = "isaac-eternal-pwa-v5";
const SHELL = [
  "./", "./index.html", "./style.css", "./app.js", "./manifest.webmanifest", "./favicon.ico",
  "./icons/icon-180.png", "./icons/icon-192.png", "./icons/icon-512.png",
  "./vendor/ruffle/ruffle.js",
  "./vendor/ruffle/core.ruffle.16d61072ac7fdc4d5013.js",
  "./vendor/ruffle/core.ruffle.994eeef0a471a88cd0e3.js"
];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith("isaac-eternal-pwa-") && name !== CACHE).map((name) => caches.delete(name)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && (url.pathname.endsWith(".wasm") || url.pathname.endsWith(".swf") || url.pathname.includes("/vendor/ruffle/"))) {
        const cache = await caches.open(CACHE);
        event.waitUntil(cache.put(request, response.clone()));
      }
      return response;
    } catch (error) {
      if (request.mode === "navigate") {
        const shell = await caches.match("./index.html");
        if (shell) return shell;
      }
      return new Response("此资源尚未缓存。请联网启动一次后再离线游玩。", {
        status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  })());
});
