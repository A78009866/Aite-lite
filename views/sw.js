// Service Worker - Smart Offline Caching + PWA Support
const CACHE_NAME = 'aite-cache-v6';
const OFFLINE_PAGE = '/offline';

// Assets to pre-cache (app shell)
const PRECACHE_URLS = [
  '/',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.ico',
  '/favicon-16.png',
  '/favicon-32.png',
  '/apple-touch-icon.png',
  '/notification.mp3',
  '/manifest.json',
  '/common.css',
  '/glass-theme.css',
  '/components.js',
  '/i18n.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
];

// Install: pre-cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Ignore failures for individual resources
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: Network-first for API, Cache-first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip WebSocket and SSE connections
  if (url.pathname.startsWith('/api/sse') || url.pathname.startsWith('/socket')) return;

  if (url.pathname.match(/\.(mp4|webm|mov|m4v|mp3|wav|ogg|m4a|aac|flac)$/)) return;

  // API requests: Network-first without persistent cache for chat/feed data
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => response)
        .catch(() => {
          return new Response(
            JSON.stringify({ ok: false, offline: true, message: 'أنت غير متصل بالإنترنت' }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // Static assets (CDN, fonts, images): Cache-first
  if (
    url.hostname !== self.location.hostname ||
    url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|woff2?|ttf|eot|ico)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, clone);
              });
            }
            return response;
          })
          .catch(() => {
            // Return empty response for failed static assets
            return new Response('', { status: 503 });
          });
      })
    );
    return;
  }

  // HTML pages: Network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Return a basic offline page
          return new Response(
            `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>غير متصل</title>
  <style>
    body { background:#000; color:#fff; font-family:Inter,system-ui,sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; text-align:center; }
    .offline-box { padding:40px; }
    .offline-box i { font-size:64px; color:#60a5fa; margin-bottom:20px; display:block; }
    .offline-box h1 { font-size:24px; margin-bottom:12px; }
    .offline-box p { color:#94a3b8; font-size:16px; margin-bottom:24px; }
    .retry-btn { background:#3b82f6; color:#fff; border:none; padding:12px 32px; border-radius:12px; font-size:16px; cursor:pointer; font-weight:600; }
    .retry-btn:hover { background:#2563eb; }
  </style>
</head>
<body>
  <div class="offline-box">
    <i>&#128268;</i>
    <h1>أنت غير متصل بالإنترنت</h1>
    <p>تحقق من اتصالك بالإنترنت وحاول مرة أخرى</p>
    <button class="retry-btn" onclick="location.reload()">إعادة المحاولة</button>
  </div>
</body>
</html>`,
            { headers: { 'Content-Type': 'text/html; charset=UTF-8' } }
          );
        });
      })
  );
});

// ================ Web Push Notifications ================
// استقبال إشعار Push من السيرفر
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || 'Aite';
    const options = {
      body: data.body || '',
      icon: data.icon || '/icon-192.png',
      badge: data.badge || '/favicon-32.png',
      tag: data.tag || 'aite-notification',
      renotify: true,
      vibrate: [0, 300, 200, 300],
      data: {
        url: data.url || '/chat_list',
        type: data.type || 'general'
      },
      actions: [
        { action: 'open', title: 'فتح' },
        { action: 'close', title: 'إغلاق' }
      ]
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    console.error('Push event error:', e);
  }
});

// عند النقر على الإشعار
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  const url = (event.notification.data && event.notification.data.url) || '/chat_list';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // إذا كان التطبيق مفتوحاً بالفعل، انتقل إليه
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // فتح نافذة جديدة
      return clients.openWindow(url);
    })
  );
});
