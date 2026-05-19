// ================================================
// 智能宠物喂食器 PWA — Service Worker v2.0
// 修复 ESP32-CAM 摄像头缓存/拦截问题
// ================================================

const CACHE_NAME = 'pet-feeder-v2';

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

// ================================================
// 安装阶段：缓存静态资源
// ================================================
self.addEventListener('install', event => {

  event.waitUntil(

    caches.open(CACHE_NAME).then(cache =>

      cache.addAll(STATIC_ASSETS).then(() =>

        Promise.allSettled(

          CDN_ASSETS.map(url =>

            cache.add(url).catch(() =>

              console.warn('[SW] CDN 缓存失败:', url)

            )
          )
        )
      )
    ).then(() => self.skipWaiting())
  );
});

// ================================================
// 激活阶段：清理旧缓存
// ================================================
self.addEventListener('activate', event => {

  event.waitUntil(

    caches.keys().then(keys =>

      Promise.all(

        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ================================================
// 请求拦截
// ================================================
self.addEventListener('fetch', event => {

  // 只处理 GET
  if (event.request.method !== 'GET') return;

  // 非 http 不处理
  if (!event.request.url.startsWith('http')) return;

  // ============================================
  // ★ 关键修复：ESP32-CAM 请求完全放行
  // 不缓存
  // 不拦截
  // 不代理
  // ============================================
  if (

    event.request.url.includes('/capture') ||
    event.request.url.includes('/stream')  ||
    event.request.url.includes('192.168.') ||
    event.request.url.includes('172.20.')

  ) {

    return;
  }

  // MQTT WebSocket 不处理
  if (event.request.url.includes('8084')) return;

  // ============================================
  // 普通网页资源：缓存优先
  // ============================================
  event.respondWith(

    caches.match(event.request).then(cached => {

      // 后台更新缓存
      const fetchUpdate = fetch(event.request)

        .then(res => {

          if (res && res.status === 200) {

            caches.open(CACHE_NAME).then(c =>

              c.put(event.request, res.clone())
            );
          }

          return res;
        })

        .catch(() => {});

      // 有缓存直接返回
      if (cached) {

        return cached;
      }

      // 没缓存再请求网络
      return fetch(event.request)

        .then(res => {

          if (res && res.status === 200) {

            caches.open(CACHE_NAME).then(c =>

              c.put(event.request, res.clone())
            );
          }

          return res;
        })

        .catch(() => {

          // HTML 请求失败时返回首页
          if (
            event.request.headers
              .get('accept')
              ?.includes('text/html')
          ) {

            return caches.match('./index.html');
          }
        });
    })
  );
});
