const CACHE_NAME = 'prodigital-cache-v5';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  '/manifest.webmanifest',
  '/logo.png',
  '/pwa-icon.png'
];

// Install event: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event: serve from cache, fall back to network. For Firebase, always go to network.
self.addEventListener('fetch', (event) => {
  // Always go to network for Firebase Auth and Firestore requests to ensure live data
  if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('google.com/identitytoolkit')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For other requests, use a cache-first strategy
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // If we have a cached response, return it
      if (cachedResponse) {
        return cachedResponse;
      }

      // Otherwise, fetch from network, cache it, and return it
      return fetch(event.request).then((networkResponse) => {
        // Check if we received a valid response before caching
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            // Only cache GET requests to avoid caching form submissions etc.
            if (event.request.method === 'GET') {
              cache.put(event.request, responseToCache);
            }
          });
        }
        return networkResponse;
      }).catch(error => {
        console.log('[Service Worker] Fetch failed, and request is not in cache.', error);
        // This is where you might return a custom offline fallback page if you had one.
      });
    })
  );
});
