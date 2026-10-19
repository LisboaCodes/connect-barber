const CACHE = 'connect-barber-shell-v2';
const SHELL = ['/', '/manifest.webmanifest', '/app-icon.svg', '/logo.png'];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request).catch(async () => {
    const cached = await caches.match(request) || (request.mode === 'navigate' ? await caches.match('/') : undefined);
    return cached || new Response('Connect Barber está sem conexão. Verifique a internet e tente novamente.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }));
});
