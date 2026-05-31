const CACHE_NAME = 'prodigital-cache-v10';

// ─── Push Notifications ───────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
    if (!event.data) return;
    let payload;
    try { payload = event.data.json(); } catch { payload = { title: 'ProDigital', body: event.data.text() }; }

    const title = payload.notification?.title || payload.title || 'ProDigital';
    const options = {
        body: payload.notification?.body || payload.body || '',
        icon: '/pwa-icon.png',
        badge: '/pwa-icon.png',
        tag: payload.tag || 'prodigital',
        requireInteraction: payload.requireInteraction || false,
        data: payload.data || {},
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            return self.clients.openWindow('/');
        })
    );
});
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
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

// Fetch event: serve from cache, fall back to network. 
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Always go to network for Firebase/Google APIs.
  // These endpoints are dynamic and should not be served from app cache.
  if (
    url.hostname === 'firestore.googleapis.com' ||
    url.hostname === 'identitytoolkit.googleapis.com' ||
    url.hostname === 'securetoken.googleapis.com' ||
    url.hostname === 'firebaseinstallations.googleapis.com'
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network-first for index.html so users get latest hashed assets after deployment.
  if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clonedResponse);
          });
          return response;
        })
        .catch(() => caches.match(event.request))
    );
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
            // Also ensure we only cache http/https requests (excludes chrome-extension:// etc.)
            if (event.request.method === 'GET' && event.request.url.startsWith('http')) {
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
