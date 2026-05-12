const CACHE_NAME = 'homestech-ctv-v2'; // Tăng version để trình duyệt nhận diện mới
const urlsToCache = [
  '/', // Cache trang gốc
  '/login.html',
  '/ctv.html',
  '/chinhsach.html',
  '/manifest.json',
  '/js/ctv.js', // Đường dẫn tuyệt đối
  '/js/auth.js', // Bổ sung file auth nếu có
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Dùng return cache.addAll để đảm bảo nếu 1 file lỗi, toàn bộ SW sẽ báo lỗi
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting(); // Ép buộc SW mới kích hoạt ngay
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache); // Xóa cache cũ
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
