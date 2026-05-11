// ================================================
// 智能宠物喂食器 PWA — Service Worker v1.0
// ================================================
const CACHE_NAME = 'pet-feeder-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

const CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/mqtt/5.3.4/mqtt.min.js'
];

// ── 安装：预缓存所有资源 ────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(STATIC_ASSETS).then(() =>
        Promise.allSettled(CDN_ASSETS.map(url =>
          cache.add(url).catch(() => console.warn('[SW] CDN 缓存失败:', url))
        ))
      )
    ).then(() => self.skipWaiting())
  );
});

// ── 激活：清理旧缓存 ────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── 请求拦截：缓存优先，后台更新 ───────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;
  // MQTT WebSocket 请求不拦截
  if (event.request.url.includes('8084')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      // 后台静默更新缓存
      const fetchUpdate = fetch(event.request).then(res => {
        if (res && res.status === 200) {
          caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
        }
        return res;
      }).catch(() => {});

      // 命中则立即返回，未命中则等待网络
      return cached || fetch(event.request).then(res => {
        if (res && res.status === 200) {
          caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
        }
        return res;
      }).catch(() => {
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
