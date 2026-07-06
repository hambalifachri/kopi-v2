const CACHE_NAME = 'fachrindah-pwa-v2'; // Nama cache baru
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './script.js'
];

// 1. Install & Simpan ke Memori
self.addEventListener('install', event => {
  self.skipWaiting(); // Memaksa PWA langsung update tanpa menunggu
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

// 2. Bersihkan Ingatan Lama (Cache v1)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Membersihkan cache lama...');
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 3. Trik Jitu: Selalu utamakan Internet, kalau Offline baru pakai Memori
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Jika sukses ambil dari internet, update juga memori cachenya
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, response.clone());
          return response;
        });
      })
      .catch(() => {
        // Jika gagal (tidak ada sinyal/offline), ambil dari memori HP
        return caches.match(event.request);
      })
  );
});