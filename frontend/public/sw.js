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

// Fetch: **화면은 캐시 먼저, 나머지는 네트워크 먼저** (API 요청은 캐시 안 함)
//
// 세 가지를 지킨다.
//
// 1. 주소로 들어오는 화면(navigate)은 **담아둔 /index.html 을 먼저 준다** (아래 5번).
//    이 앱은 한 페이지짜리라 /support · /history 같은 주소에 해당하는 파일이 따로 없다.
//    예전에는 그 주소를 캐시에서 찾다 못 찾고 undefined 를 돌려줬고(비행기 모드에서
//    홈 화면 앱이 안 떴다), 그 뒤로는 네트워크를 먼저 쳤다 — 그러면 **잠든 서버**에
//    걸렸다. 10/15 에 담아둔 것을 먼저 주는 쪽으로 바꿨다.
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

  // ── 5. 화면은 **담아둔 것을 먼저 준다** ── (2026-10-15)
  //
  // 여태 주소로 들어오는 화면도 네트워크를 먼저 쳤고, 담아둔 것은 `fetch` 가
  // **깨졌을 때만** 꺼냈다. 그런데 이 앱이 사는 곳은 **15분 놀면 잠드는 무료 판**이다.
  //
  // **잠든 서버는 깨지지 않는다. 느릴 뿐이다.** 거절도 안 하고 그냥 답이 안 온다 —
  // 그래서 `catch` 에 안 걸리고, 담아둔 화면이 폰에 있는 채로 기다리기만 했다.
  // 안드로이드 앱은 15초에 포기하고(`MainActivity.LOAD_TIMEOUT_MS`) 오프라인 화면으로
  // 넘겼다. **한 번이라도 앱을 연 사람의 폰에 화면 한 벌이 있는데 그걸 안 쓴 것이다.**
  //
  // 이제 담아둔 것을 그 자리에서 주고, 새 것은 **뒤에서** 받아 담는다 — 다음에 열 때
  // 적용된다. 이름에 해시가 박힌 파일들이 이미 이렇게 돌고 있다(아래 4번).
  //
  // 낡은 화면을 오래 붙들 걱정은 없다: `CACHE_NAME` 이 빌드마다 바뀌므로 배포하면
  // 새 워커가 새 캐시를 채우고 옛 캐시를 지운다(install·activate).
  if (sameOrigin && isNavigate) {
    event.respondWith((async () => {
      const shell = await caches.match('/index.html');
      if (shell) {
        // 뒤에서 새 것을 받아 담는다. **여기서 기다리지 않는다** — 기다리면 고친 의미가 없다.
        // `waitUntil` 로 붙잡아 두어야 응답을 돌려준 뒤에도 워커가 끝까지 받아온다
        event.waitUntil(
          fetch(req)
            .then((res) => {
              if (res.status === 200 && res.type === 'basic') {
                return caches.open(CACHE_NAME).then((c) => c.put('/index.html', res.clone()));
              }
            })
            .catch(() => { /* 못 받아와도 사람은 이미 화면을 보고 있다 */ })
        );
        return shell;
      }
      // 담아둔 것이 없다 — **깔고 나서 맨 처음 여는 사람**이다. 이때는 서버를 기다린다
      // (그 기다림은 앱의 오프라인 화면이 「깨우고 있어요」로 받는다)
      try {
        const res = await fetch(req);
        if (res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put('/index.html', clone)).catch(() => {});
        }
        return res;
      } catch {
        return Response.error();
      }
    })());
    return;
  }

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
