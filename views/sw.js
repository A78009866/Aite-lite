const CACHE_NAME = 'aite-cache-v1';
const urlsToCache = [
  '/', 
  '/chat_list.html',
  '/manifest.json',
  // يجب أن تنشئ مجلد 'icons' وتضع فيه أيقوناتك
  '/icons/icon-192x192.png',
  // ملفات CSS و JS الأساسية (لتمكين العمل دون اتصال)
  'https://cdn.tailwindcss.com', 
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  // ... إضافة أي ملفات خطوط أو ملفات JS أخرى حيوية
];

self.addEventListener('install', event => {
  console.log('[Service Worker] Install Event: Caching App Shell');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('Failed to cache resources:', err);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      // الرد من الذاكرة المؤقتة (Cache) إذا كان موجوداً
      if (response) {
        return response;
      }
      // إذا لم يكن موجوداً، قم بجلبه من الشبكة
      return fetch(event.request);
    })
  );
});

self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate Event: Cleaning up old caches');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
