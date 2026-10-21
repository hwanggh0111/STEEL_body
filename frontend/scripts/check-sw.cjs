// 잠든 서버를 만났을 때 **담아둔 화면을 쓰는가** (2026-10-15)
//
//   npm run sw     (npm run check 에도 들어 있다)
//
// ── 왜 이 검사가 있나 ──
//
// 서비스 워커는 **눈으로 확인할 수 없는 자리**다. 잠든 서버를 만나려면 15분을 기다려야
// 하고, 폰에서 보더라도 「담아둔 것을 썼는지 네트워크를 썼는지」는 화면이 말해주지 않는다.
//
// 10/15 까지 주소로 들어오는 화면은 **네트워크를 먼저** 쳤고, 담아둔 것은 `fetch` 가
// **깨졌을 때만** 꺼냈다. 그런데 이 앱이 사는 곳은 15분 놀면 잠드는 무료 판이다 —
// **잠든 서버는 깨지지 않는다. 느릴 뿐이다.** 거절도 안 하고 답이 안 온다. 그래서
// `catch` 에 안 걸리고, 담아둔 화면이 폰에 있는 채로 안드로이드 앱이 15초에 포기했다
// (`MainActivity.LOAD_TIMEOUT_MS`).
//
// 이 검사의 핵심은 **아래 「잠든 서버」 항목 하나**다. `fetch` 를 **영영 안 끝나는 약속**으로
// 세워두고, 그래도 화면이 돌아오는지 본다. 네트워크 먼저로 되돌리면 이 검사가 멎는다.
//
// ── 어떻게 보나 ──
//
// 브라우저 없이 sw.js 를 그대로 읽어 돌린다. `self` · `caches` · `fetch` 를 가짜로
// 세우고 fetch 이벤트를 직접 집어넣어, 워커가 **무엇을 돌려주는지**를 본다.

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'public', 'sw.js');
const ORIGIN = 'https://steel-body.onrender.com';

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// ── 가짜 캐시 한 벌 ──
function makeCaches() {
  const stores = new Map();               // 캐시이름 → Map(주소 → 몸통글자)
  const keyOf = (req) => (typeof req === 'string' ? req : req.url);
  const api = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const m = stores.get(name);
      return {
        async put(req, res) { m.set(keyOf(req), await res.text()); },
        async addAll(list) { for (const u of list) m.set(new URL(u, ORIGIN).pathname, '담아둔 ' + u); },
        async match(req) {
          const hit = m.get(keyOf(req));
          return hit === undefined ? undefined : new Response(hit, { status: 200 });
        },
      };
    },
    async match(req) {
      for (const m of stores.values()) {
        // 주소로도, 경로로도 찾는다 (precache 는 경로로 담는다)
        const k = keyOf(req);
        const hit = m.has(k) ? m.get(k) : m.get(new URL(k, ORIGIN).pathname);
        if (hit !== undefined) return new Response(hit, { status: 200 });
      }
      return undefined;
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
    _stores: stores,
  };
  return api;
}

// ── sw.js 를 그대로 읽어 돌린다 ──
function loadWorker({ caches, fetchImpl }) {
  const listeners = new Map();
  const self_ = {
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    location: { origin: ORIGIN },
    skipWaiting() {},
    clients: { claim() {}, matchAll: async () => [], openWindow: async () => {} },
    registration: { showNotification: async () => {} },
  };

  const src = fs.readFileSync(SRC, 'utf8');
  // 빌드가 치환하는 자리 — 검사에서는 그대로 두면 'blackiron-dev' 가 된다
  const fn = new Function('self', 'caches', 'fetch', 'Response', 'URL', src);
  fn(self_, caches, fetchImpl, Response, URL);

  return {
    listeners,
    async install() {
      const waits = [];
      for (const fn2 of listeners.get('install') || []) fn2({ waitUntil: (p) => waits.push(p) });
      await Promise.all(waits);
    },
    /** fetch 이벤트를 넣고, 워커가 돌려주는 것을 기다린다 */
    fire(req) {
      let answered = null;
      const waits = [];
      const event = {
        request: req,
        respondWith: (p) => { answered = p; },
        waitUntil: (p) => { waits.push(p); },
      };
      for (const fn2 of listeners.get('fetch') || []) fn2(event);
      return { answered, waits };
    },
  };
}

const req = (url, { mode = 'no-cors', method = 'GET' } = {}) => ({ url, mode, method });

// **우리 집에서 온 응답을 흉내 낸다.**
//
// sw.js 는 `res.type === 'basic'` 인 것만 담아둔다 — 남의 집 응답을 캐시에 쌓지 않기
// 위한 선이다. 그런데 Node 의 `new Response()` 는 type 이 `'default'` 라서, 그대로
// 쓰면 **워커가 제대로 걸러낸 것을 검사가 「안 담았다」고 읽는다.** 처음에 그렇게
// 두 건이 틀렸다 — 코드가 아니라 흉내가 틀린 것이었다.
const mkRes = (body, type = 'basic') => ({
  status: 200,
  type,
  async text() { return body; },
  clone() { return mkRes(body, type); },
});

// 약속이 제 시간에 끝나는지 본다 — **잠든 서버**를 흉내 내려면 이게 필요하다
const within = (p, ms) => Promise.race([
  Promise.resolve(p).then((v) => ({ done: true, v })),
  new Promise((r) => setTimeout(() => r({ done: false }), ms)),
]);

(async () => {
  console.log('── 잠든 서버: 답이 영영 안 와도 화면이 뜨는가 ──');
  {
    // 이 fetch 는 **절대 끝나지 않는다.** 잠든 서버가 하는 일이 정확히 이것이다 —
    // 거절(reject)하지 않고 연결을 붙잡아 둔다
    let 불린횟수 = 0;
    const fetchImpl = () => { 불린횟수 += 1; return new Promise(() => {}); };
    const caches = makeCaches();
    const w = loadWorker({ caches, fetchImpl });
    await w.install();                                  // /index.html 을 담아둔다

    const { answered } = w.fire(req(ORIGIN + '/home', { mode: 'navigate' }));
    ok('화면을 돌려줬다 (네트워크를 안 기다린다)', (await within(answered, 300)).done, true);
    const res = await answered;
    ok('돌려준 것이 담아둔 화면이다', (await res.text()).includes('담아둔'), true);
    ok('그러면서 뒤로는 새 것을 받으러 갔다', 불린횟수, 1);
  }

  console.log('\n── 서버가 깨어 있을 때: 새 화면을 담아두는가 ──');
  {
    const fetchImpl = async () => mkRes('새 화면');
    const caches = makeCaches();
    const w = loadWorker({ caches, fetchImpl });
    await w.install();

    const { answered, waits } = w.fire(req(ORIGIN + '/history', { mode: 'navigate' }));
    const res = await answered;
    ok('사람에게는 담아둔 것을 먼저 준다', (await res.text()).includes('담아둔'), true);
    await Promise.all(waits);                            // 뒤에서 받아 담는 것을 기다린다
    const after = await caches.match('/index.html');
    ok('받아온 새 화면을 담아뒀다 (다음에 열면 이것)', await after.text(), '새 화면');
  }

  console.log('\n── 담아두는 것은 늘 /index.html 인가 ──');
  {
    // **오늘 넣은 둘이 서로 어긋나던 자리다.**
    //
    // 서버는 주소마다 다른 문서를 준다 — `/train` 으로 들어오면 그 화면 조각 열여덟
    // 개를 미리 받으라고 적어 보낸다. 빨라지는 장치다.
    //
    // 그런데 그 답을 **껍데기로 담으면** 그 뒤로 모든 주소가 그것을 쓴다 —
    // 다음에 `/site` 를 열 때 **train 조각 열여덟 개를 미리 받는다.** 안 쓸 것을.
    let 받은주소 = [];
    const fetchImpl = async (r) => {
      const url = typeof r === 'string' ? r : r.url;
      받은주소.push(url);
      return mkRes(url.includes('index.html') ? '공용 껍데기' : '주소별 문서');
    };
    const caches = makeCaches();
    const w = loadWorker({ caches, fetchImpl });
    await w.install();

    const { answered, waits } = w.fire(req(ORIGIN + '/train', { mode: 'navigate' }));
    await answered;
    await Promise.all(waits);
    ok('껍데기는 /index.html 을 따로 받아서 담는다', 받은주소.some((u) => u.includes('/index.html')), true);
    ok('주소별 문서를 껍데기로 담지 않는다', await (await caches.match('/index.html')).text(), '공용 껍데기');
  }

  console.log('\n── 깔고 나서 맨 처음 여는 사람 (담아둔 것이 없다) ──');
  {
    const fetchImpl = async () => mkRes('서버가 준 화면');
    const caches = makeCaches();
    const w = loadWorker({ caches, fetchImpl });
    // install 을 안 돌린다 = 담아둔 것이 없는 상태

    const { answered } = w.fire(req(ORIGIN + '/home', { mode: 'navigate' }));
    const res = await answered;
    ok('서버에서 받아 보여준다', await res.text(), '서버가 준 화면');
  }

  console.log('\n── 신호가 아예 없을 때 ──');
  {
    const fetchImpl = async () => { throw new Error('못 닿았다'); };
    const caches = makeCaches();
    const w = loadWorker({ caches, fetchImpl });
    await w.install();

    const { answered } = w.fire(req(ORIGIN + '/train', { mode: 'navigate' }));
    const res = await answered;
    ok('담아둔 화면으로 앱이 열린다', (await res.text()).includes('담아둔'), true);
  }
  {
    const fetchImpl = async () => { throw new Error('못 닿았다'); };
    const caches = makeCaches();
    const w = loadWorker({ caches, fetchImpl });     // 담아둔 것도 없다

    const { answered } = w.fire(req(ORIGIN + '/home', { mode: 'navigate' }));
    const res = await answered;
    ok('돌려줄 것이 없으면 「실패」를 알린다 (undefined 가 아니다)', res.type, 'error');
  }

  console.log('\n── 손대지 않은 규칙들이 그대로인가 ──');
  {
    let 불린횟수 = 0;
    const fetchImpl = async () => { 불린횟수 += 1; return mkRes('받아온 것'); };
    const caches = makeCaches();
    const w = loadWorker({ caches, fetchImpl });
    await w.install();

    // 1) API 는 워커가 아예 안 건드린다 — 손대면 로그인·기록이 캐시에 남는다
    const api = w.fire(req(ORIGIN + '/api/workouts'));
    ok('API 는 그냥 통과시킨다', api.answered, null);
    const oauth = w.fire(req(ORIGIN + '/oauth/google'));
    ok('OAuth 도 그냥 통과시킨다', oauth.answered, null);

    // 2) POST 는 안 건드린다
    const post = w.fire(req(ORIGIN + '/home', { method: 'POST', mode: 'navigate' }));
    ok('POST 는 그냥 통과시킨다', post.answered, null);

    // 3) 이름에 해시가 박힌 파일은 캐시를 먼저 본다
    const asset = ORIGIN + '/assets/index-DPpcnuu7.js';
    const first = w.fire(req(asset));
    await first.answered;
    const 받은뒤 = 불린횟수;
    const second = w.fire(req(asset));
    await second.answered;
    ok('해시 파일은 두 번째부터 네트워크를 안 탄다', 불린횟수, 받은뒤);

    // 4) 남의 집 것은 캐시하지 않는다
    //
    // **집을 바꿨다** (2026-10-21). 여기 `wger.de` 를 쓰고 있었는데 그 기능을
    // 걷었다(그쪽 API 가 404 다 — `components/ExerciseFinder.jsx` 머리글).
    // 지금 앱이 실제로 가는 남의 집은 미디어파이프의 모델이다 — **5MB 다.**
    // 담아두면 안 되는 까닭이 여기 더 분명하다(브라우저 캐시가 알아서 들고 있다)
    const OTHER = 'https://storage.googleapis.com/mediapipe-models/x.task';
    const outside = w.fire(req(OTHER));
    await outside.answered;
    const hit = await caches.match(OTHER);
    ok('남의 집 응답은 담아두지 않는다', hit === undefined, true);
  }

  console.log('');
  if (bad) {
    console.log(bad + '건 실패 — 잠든 서버에서 앱이 안 뜰 수 있습니다.');
    process.exit(1);
  }
  console.log('잠든 서버에서도 담아둔 화면으로 바로 뜹니다');
})();
