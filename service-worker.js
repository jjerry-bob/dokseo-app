/* ===== 독서기록장 service-worker.js ===== */
const CACHE_NAME = "dokseo-cache-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

// 설치: 앱 셸 캐시
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// 활성화: 이전 버전 캐시 정리
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// 요청 처리
// - 핵심 앱 파일(html/js/css/json): 네트워크 우선 → 최신 버전을 항상 받아오고,
//   오프라인일 때만 캐시로 대체 (예전 파일이 계속 남아 갱신 안 되는 문제 방지)
// - 그 외 정적 자원(아이콘 등): 캐시 우선 → 빠르고 데이터 절약
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const req = event.request;
  const isAppShell = req.mode === "navigate" || /\.(html|js|css|json)(\?|$)/i.test(req.url);

  if (isAppShell) {
    event.respondWith(
      fetch(req, { cache: "no-cache" })
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(req, { ignoreSearch: true }).then(cached =>
            cached || (req.mode === "navigate" ? caches.match("./index.html") : undefined)
          )
        )
    );
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cached => {
      if (cached) return cached;
      return fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => undefined);
    })
  );
});
