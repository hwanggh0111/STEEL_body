// __SW_VERSION__는 빌드 시 vite plugin이 timestamp로 치환합니다.
// 개발 모드에서는 그대로 'steelbody-dev' 사용.
const CACHE_NAME = '__SW_VERSION__'.startsWith('__SW') ? 'steelbody-dev' : '__SW_VERSION__';
const PRECACHE_URLS = ['/', '/index.html'];

// Install: precache core static files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first strategy (API 요청은 캐시 안 함)
//
// 세 가지를 지킨다.
//
// 1. 주소로 들어오는 화면(navigate)은 네트워크가 없으면 /index.html 로 돌린다.
//    이 앱은 한 페이지짜리라 /support · /history 같은 주소에 해당하는 파일이 따로 없다.
//    예전에는 그 주소를 캐시에서 찾다 못 찾고 undefined 를 돌려줬다 —
//    홈 화면에 추가해둔 앱을 비행기 모드에서 열면 그냥 안 떴다.
//
// 2. 남의 집 것은 캐시하지 않는다. 운동 검색(wger.de)이나 날씨 응답까지 담아두면
//    캐시가 계속 부풀고, 옛 검색 결과가 되살아난다.
//
// 3. respondWith 에 undefined 를 넘기지 않는다. 넘기면 그 요청은 그냥 깨진다.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // API, OAuth 요청은 캐시 제외
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/oauth/')) return;

  const sameOrigin = url.origin === self.location.origin;
  const isNavigate = req.mode === 'navigate';

  event.respondWith(
    fetch(req)
      .then((response) => {
        // 우리 집 것이고 제대로 온 응답만 담아둔다
        if (sameOrigin && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        // 주소로 들어온 화면이면 앱 껍데기를 돌려준다 — 라우팅은 앱이 알아서 한다
        if (isNavigate) {
          const shell = await caches.match('/index.html');
          if (shell) return shell;
        }
        // 돌려줄 것이 없으면 '네트워크 실패' 를 명확히 알린다.
        // undefined 를 돌려주면 브라우저가 알 수 없는 오류로 끝낸다
        return Response.error();
      })
  );
});
