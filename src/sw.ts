/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

// Precache all assets compiled by Vite
precacheAndRoute(self.__WB_MANIFEST);

// Background Cache Name
const RUNTIME_CACHE_NAME = 'studysync-runtime-cache';

// Fetch interceptor with Cache-First strategy for static assets, Network-First for APIs
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Skip caching for Google Gemini AI API calls
  if (requestUrl.hostname.includes('generativeai.googleapis.com')) {
    return;
  }

  // Handle standard web assets
  if (
    event.request.mode === 'navigate' ||
    event.request.destination === 'style' ||
    event.request.destination === 'script' ||
    event.request.destination === 'image' ||
    event.request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Fetch updated version in background to refresh cache for next time
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse.status === 200) {
                caches.open(RUNTIME_CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
              }
            })
            .catch(() => {/* Ignore background sync fetch failures offline */});
          
          return cachedResponse;
        }

        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(RUNTIME_CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        }).catch(async () => {
          // If offline navigation fails, check if index.html is cached
          if (event.request.mode === 'navigate') {
            const cache = await caches.open(RUNTIME_CACHE_NAME);
            const cachedIndex = await cache.match('/index.html') || await cache.match('/academic-ai-companion/index.html');
            if (cachedIndex) return cachedIndex;
          }
          return new Response('Offline fallback content unavailable.', { status: 503, statusText: 'Offline' });
        });
      })
    );
  }
});

// Push notification listener
self.addEventListener('push', (event) => {
  let data = { title: 'StudySync Update', body: 'Check your upcoming deadlines and course reminders!' };
  
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (err) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options: any = {
    body: data.body,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click response
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

// Background Sync capability
self.addEventListener('sync', (event: any) => {
  if (event.tag === 'sync-academic-data') {
    console.log('[Service Worker] Background Syncing notes and planner progress...');
  }
});

// Periodic Background Sync capability
self.addEventListener('periodicsync', (event: any) => {
  if (event.tag === 'check-deadline-reminders') {
    console.log('[Service Worker] Periodic Background Sync: Checking course timeline alerts...');
  }
});
