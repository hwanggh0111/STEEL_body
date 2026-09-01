// __SW_VERSION__는 빌드 시 vite plugin이 timestamp로 치환합니다.
// 개발 모드에서는 그대로 'blackiron-dev' 사용.
const CACHE_NAME = '__SW_VERSION__'.startsWith('__SW') ? 'blackiron-dev' : '__SW_VERSION__';
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

  // 4. 이름에 해시가 박힌 파일은 **캐시를 먼저 본다.**
  //
  //    빌드가 `index-DkeTsJR5.js` 처럼 내용으로 이름을 짓는다 — 내용이 바뀌면
  //    이름이 바뀐다. 그래서 이 파일들은 절대 낡지 않는다. 그런데도 매번 네트워크를
  //    먼저 치면 느린 망에서 그만큼 기다린다. 캐시에 있으면 그대로 쓰고,
  //    없을 때만 받아온다.
  if (sameOrigin && /\/assets\/.+-[A-Za-z0-9_-]{8,}\.(js|css|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => {});
        }
        return res;
      }).catch(() => Response.error()))
    );
    return;
  }

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

// ─── 운동 알림 ──────────────────────
//
// 서버가 정한 시각에 보낸다. 브라우저가 닫혀 있어도 이 워커가 깨어나 받는다.

self.addEventListener('push', (event) => {
  // 몸통이 깨져 있어도 알림은 띄운다 — 소리만 나고 아무것도 안 뜨는 게 제일 나쁘다
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || 'BLACK IRON';
  const options = {
    body: payload.body || '',
    // 이 앱이 가진 아이콘은 svg 하나뿐이다 (manifest 와 같은 것을 쓴다).
    // 안드로이드는 svg 를 알림 아이콘으로 못 쓰는 경우가 있는데, 그때는
    // 아이콘 없이 기본 모양으로 뜬다 — 알림 자체는 뜬다
    icon: '/icons/icon.svg',
    badge: '/icons/icon.svg',
    // 같은 tag 로 오면 덮어쓴다. 알림이 줄줄이 쌓이지 않게 한다
    tag: payload.tag || 'blackiron',
    data: { url: payload.url || '/home' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/home';

  // 이미 열려 있는 창이 있으면 그 창을 쓴다. 누를 때마다 새 창이 뜨면 창이 쌓인다
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
