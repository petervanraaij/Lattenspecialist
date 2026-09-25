const CACHE_NAME = 'lattenspecialist-v25-solutions-logo';
const APP_SHELL = [
  '/',
  '/index.html',
  '/afspraak.html',
  '/homepage.css?v=4',
  '/homepage.js?v=1',
  '/package-choice.js?v=1',
  '/website-metrics.js?v=1',
  '/app.html',
  '/beheer.html',
  '/ervaring.html',
  '/privacy.html',
  '/service.html',
  '/styles.css?v=9',
  '/styles.css?v=13',
  '/styles.css?v=15',
  '/styles.css?v=16',
  '/styles.css?v=17',
  '/images/van-raaij-solutions-logo.webp',
  '/script.js?v=10',
  '/booking-config.js?v=2',
  '/booking.js?v=5',
  '/customer-booking.css?v=1',
  '/customer-booking.js?v=2',
  '/customer-app.css?v=1',
  '/customer-app.js?v=3',
  '/pwa-install.js?v=1',
  '/beheer.js?v=7',
  '/admin-metrics.css?v=1',
  '/review.js?v=9',
  '/manifest.webmanifest',
  '/beheer.webmanifest',
  '/images/badge.webp',
  '/images/logo-main.webp',
  '/images/app-icon-192.png',
  '/images/app-icon-512.png',
  '/images/family-ready.webp'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('lattenspecialist-v') && key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // Live prices, availability and customer status must not silently use cached data.
  if (event.request.cache === 'no-store' || url.pathname.startsWith('/data/') || url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)));
      }
      return response;
    }).catch(async () => {
      // Never load the app itself into its booking iframe, which could recurse offline.
      if (url.searchParams.get('app') !== 'klant') {
        const cached = await caches.match(event.request) || (url.pathname === '/app.html' ? await caches.match('/app.html') : null);
        if (cached) return cached;
      }
      return new Response('<!doctype html><html lang="nl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Geen verbinding</title><h1>Geen internetverbinding</h1><p>Voor het aanvraagformulier is internet nodig. Controleer je verbinding en laad het formulier opnieuw.</p></html>', {status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});
    }));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)));
    }
    return response;
  })));
});
