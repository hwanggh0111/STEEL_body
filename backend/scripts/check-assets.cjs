// **없는 파일을 조르면 404 를 주는가 — 화면 주소는 그대로 200 인가** (2026-11-11).
//
//   npm run assets        (포트를 쓰므로 `npm run check` 에서는 건너뛴다)
//
// ── 왜 진짜 서버로 보나 ──
//
// 이 자리의 결함은 **경로 하나에 세 미들웨어가 겹쳐** 생긴다 — 미리 압축한 것을
// 집어주는 길 · `express.static` · SPA 폴백. 함수만 봐서는 「없는 `.js` 가 어디서
// 무엇을 받는가」를 알 수 없다. 실제로 받아봐야 한다.
//
// ── 무엇이 터졌던가 (11/11, 정석 지시서 ①) ──
//
//     /assets/index-OLDOLD12.js   → 200  text/html   (index.html 을 그대로 줬다)
//
// 서비스워커는 해시 박힌 이름을 「절대 낡지 않는다」고 보아 **캐시를 먼저 보고**
// 빗나가면 받아서 담는다. 그래서 그 HTML 이 `.js` 주소로 담기면 **새로고침으로도
// 회복이 안 된다.** 조각 이름이 바뀌는 배포 날(11/09·11/10) 열려 있던 옛 탭이
// 정확히 그 길로 간다.
//
// ── 반대쪽도 같이 지킨다 ──
//
// **화면 주소는 반드시 200 html 이어야 한다.** 거기서 사람이 막히면 그게 더 큰
// 사고다 — 404 로 끊는 선은 **확장자**뿐이고, 이 앱의 화면 주소에는 점이 없다.
//
// 진짜 DB 도 진짜 포트도 안 건드린다 (`check-cardio-api.cjs` 와 같은 방식).
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, '..', 'frontend', 'dist');
const TMP = path.join(ROOT, '.check-assets.json');
let PORT = 4762;
let BASE = '';

const clean = () => {
  for (const f of [TMP, TMP.replace(/\.json$/, '') + '.photos.json']) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
};
clean();

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let child = null;
function startServer() {
  child = spawn(process.execPath, [path.join(ROOT, 'src', 'index.js')], {
    cwd: ROOT,
    env: {
      ...process.env, PORT: String(PORT), DB_FILE: TMP, NODE_ENV: 'test',
      // 32자 이상이어야 뜬다 (`src/index.js` 가 그렇게 막는다)
      JWT_SECRET: process.env.JWT_SECRET || 'assets-check-secret-0123456789-abcdef',
      VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
}
async function waitUp(ms = 15000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/api/health`)).ok) return true; } catch { /* 아직 */ }
    await sleep(200);
  }
  return false;
}
function stopServer() {
  if (!child) return Promise.resolve();
  const done = new Promise((r) => child.once('exit', r));
  child.kill();
  child = null;
  return done;
}
async function pickPort() {
  for (let p = 4762; p <= 4780; p += 1) {
    try { await fetch(`http://127.0.0.1:${p}/api/health`, { signal: AbortSignal.timeout(400) }); } catch { return p; }
  }
  return 0;
}

/** 받아서 **상태코드와 받은 것의 종류**를 본다. 몸통은 안 읽는다(큰 조각도 있다) */
async function head(url) {
  const res = await fetch(BASE + url, { redirect: 'manual' });
  const type = (res.headers.get('content-type') || '').toLowerCase();
  await res.arrayBuffer().catch(() => {});
  return { status: res.status, type: type.split(';')[0].trim() };
}
const kind = (t) => (t.includes('html') ? 'html' : t.includes('javascript') ? 'js'
  : t.includes('json') ? 'json' : t.includes('css') ? 'css'
  : t.startsWith('image/') ? 'image' : t.includes('text/plain') ? 'text' : t || '(없음)');

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.log('FAIL `frontend/dist` 가 없습니다 — `npm run build` 를 먼저 하십시오');
    process.exit(1);
  }
  PORT = await pickPort();
  if (!PORT) { console.log('FAIL 빈 포트를 못 찾았습니다'); process.exit(1); }
  BASE = `http://127.0.0.1:${PORT}`;
  startServer();
  if (!await waitUp()) { console.log('FAIL 서버가 안 떴습니다'); await stopServer(); clean(); process.exit(1); }

  console.log('── ★ 없는 파일은 404 다 (200+HTML 을 주지 않는다) ──');
  for (const url of [
    '/assets/index-OLDOLD12.js',
    '/assets/vendor-aaaaaaaa.js',
    '/assets/style-bbbbbbbb.css',
    '/icons/icon-999.png',
    '/없는것.json',
    '/fonts/none-cccccccc.woff2',
    // ── **여덟 자를 넘는 확장자도 선 안쪽이다** ── (2026-11-13)
    //
    // 선을 `{1,8}` 로 **길이로 재던 때**가 있었다. 그래서 이 둘이 라이브에서
    // `index.html` 을 200 으로 받았다 — `.webmanifest` 는 PWA 가 실제로 조르는
    // 이름이다. 길이로 재면 또 샌다. 이 자리를 자로 박아 둔다
    '/manifest.webmanifest',
    '/x.properties',
    '/a.b.tar.gz',
  ]) {
    const r = await head(url);
    ok('  ' + url, [r.status, kind(r.type)], [404, 'text']);
  }

  console.log('');
  console.log('── 화면 주소는 반드시 200 html 이다 (여기서 막히면 더 큰 사고다) ──');
  for (const url of ['/', '/home', '/train', '/history', '/body', '/site', '/site/',
    '/support/notices', '/login', '/register', '/oauth/email', '/없는주소라도']) {
    const r = await head(url);
    ok('  ' + url, [r.status, kind(r.type)], [200, 'html']);
  }

  console.log('');
  console.log('── 실재하는 파일은 그대로 나간다 (제 종류로) ──');
  const real = fs.readdirSync(path.join(DIST, 'assets'))
    .filter((f) => /-[A-Za-z0-9_-]{8,}\.js$/.test(f))[0];
  ok('  /assets/' + (real || '(없다)'), await head('/assets/' + real).then((r) => [r.status, kind(r.type)]), [200, 'js']);
  for (const [url, want] of [['/index.html', 'html'], ['/manifest.json', 'json'],
    ['/sw.js', 'js'], ['/feed-detail.json', 'json'], ['/robots.txt', 'text'],
    ['/app-offline.html', 'html']]) {
    if (!fs.existsSync(path.join(DIST, url.replace(/^\//, '')))) { console.log('     (' + url + ' 은 이 빌드에 없다)'); continue; }
    const r = await head(url);
    ok('  ' + url, [r.status, kind(r.type)], [200, want]);
  }

  console.log('');
  console.log('── 404 를 아무도 담지 않게 말해준다 ──');
  const res = await fetch(BASE + '/assets/index-OLDOLD12.js');
  await res.arrayBuffer().catch(() => {});
  ok('  `Cache-Control: no-store` 를 붙인다', (res.headers.get('cache-control') || ''), 'no-store');

  console.log('');
  console.log('── `/api` 는 이 선에 안 걸린다 ──');
  ok('  건강 확인은 그대로', await head('/api/health').then((r) => [r.status, kind(r.type)]), [200, 'json']);
  ok('  없는 API 는 API 쪽 답이다(html 이 아니다)',
    await head('/api/없는길').then((r) => [r.status, r.type.includes('html')]), [404, false]);

  await stopServer();
  clean();
  console.log('');
  if (bad > 0) { console.log(bad + '건 실패'); process.exit(1); }
  console.log('다 통과');
})().catch(async (e) => {
  console.log('FAIL 터졌습니다 — ' + (e && e.message));
  await stopServer();
  clean();
  process.exit(1);
});
