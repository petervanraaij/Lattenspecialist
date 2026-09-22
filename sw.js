const CACHE_NAME = 'lattenspecialist-v12';
const APP_SHELL = [
  '/',
  '/index.html',
  '/app.html',
  '/beheer.html',
  '/ervaring.html',
  '/privacy.html',
  '/service.html',
  '/styles.css?v=10',
  '/styles.css?v=12',
  '/script.js?v=10',
  '/booking-config.js?v=1',
  '/booking.js?v=1',
  '/app.js?v=11',
  '/beheer.js?v=1',
  '/review.js?v=9',
  '/manifest.webmanifest',
  '/beheer.webmanifest',
  '/images/badge.webp',
  '/images/logo-main.webp',
  '/images/app-icon-192.png',
  '/images/app-icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/data/')) {
    event.respondWith(fetch(event.request, {cache: 'no-store'}).catch(() => new Response('{"records":[],"items":[]}', {headers: {'Content-Type': 'application/json'}})));
    return;
  }
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request).then(response => response || caches.match('/app.html'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    return response;
  })));
});
