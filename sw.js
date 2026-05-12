const CACHE_NAME = 'homestech-ctv-v3'; // Tăng version để xóa cache cũ
const urlsToCache = [
  '/', 
  '/login.html',
  '/ctv.html',
  '/chinhsach.html',
  '/manifest.json',
  '/js/ctv.js', // Sử dụng đường dẫn tuyệt đối từ gốc domain
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting(); // Ép kích hoạt ngay
});
