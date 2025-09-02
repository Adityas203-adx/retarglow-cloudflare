const sw = `
const CACHE_NAME = 'pixel-cache-v1';
const RESOURCES = ['/pixel'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(RESOURCES))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/pixel')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      const network = fetch(event.request).then(res => {
        cache.put(event.request, res.clone());
        return res;
      });
      event.waitUntil(network);
      return cached || network;
    })());
  }
});
`;

export default {
  async fetch() {
    return new Response(sw, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
};
