const CACHE_NAME = 'scantopdf-v1';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './image-processing.js',
  './pdf.js',
  './scanner.js',
  './storage.js',
  './manifest.json',
  './offline.html',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  // Don't cache user-generated blobs/data
  if (event.request.url.startsWith('blob:') || event.request.url.startsWith('data:')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./offline.html');
        }
      });
      return cached || fetchPromise;
    })
  );
});