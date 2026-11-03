// sw.js - BIMO Service Worker (Offline Cache v2)
const CACHE_NAME = 'bimo-cache-v2';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './bimo-core.js',
    './manifest.webmanifest',
    './icon.svg',
    './icon-180.png'
];

// Install Event: Cache all core assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => self.skipWaiting())
    );
});

// Activate Event: Clean up old outdated caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Event: Serve from cache first, fallback to network
self.addEventListener('fetch', (event) => {
    if (!event.request.url.startsWith(self.location.origin)) return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, networkResponse);
                        });
                    }
                }).catch(() => {/* Ignore network errors when offline */});
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                return networkResponse;
            }).catch(() => {
                // Offline fallback handling if needed
            });
        })
    );
});
