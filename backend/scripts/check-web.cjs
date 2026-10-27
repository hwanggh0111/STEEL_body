// 웹이 **무엇을 어떻게 내주는가** (2026-10-15)
//
//   npm run web     (npm run check 에도 들어 있다)
//
// ── 왜 이 검사가 있나 ──
//
// 이 자리의 고장은 **화면에 아무것도 안 나타난다.** 느리거나, 같은 것을 다시 받거나,
// 캐시를 못 쓰는 것뿐이다 — 눌러봐도 멀쩡하다. 실제로 10/13 에 미리 압축을 켠 뒤로
// **해시가 없는 압축본이 전부 `max-age=0`** 으로 나가고 있었고(앱 아이콘이 열 때마다
// 다시 물어봤다), 그걸 10/15 에 재보고서야 알았다.
//
// 보는 것 넷 —
//   1. 미리 압축해 둔 것을 **집어 주는가** (요청마다 다시 압축하면 CPU 0.1 코어가 운다)
//   2. **캐시 머리가 제자리인가** — 해시 파일 1년 immutable · 화면 문서 no-cache ·
//      나머지 7일. 압축본도 같아야 한다
//   3. 주소에 맞는 문서를 주는가 — `/site` 로 들어오면 **그 화면 조각을 미리 적어** 보낸다
//      (안 그러면 받아서 실행한 뒤에야 요청하므로 왕복 한 번이 더 든다. 배포본 기준 180~200ms)
//   4. `/` 가 정적 쪽으로 새지 않는가 — 그 길에서는 미리 압축한 것을 못 쓴다
//      (재보니 3,059 vs 2,501바이트였다)
//
// 진짜 서버를 운영 모드로 띄워 진짜 HTTP 로 본다. `dist` 가 없으면 **건너뛴다** —
// 빌드 안 한 사람에게 틀린 실패를 보여주는 검사는 곧 무시된다.

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.resolve(ROOT, '..', 'frontend', 'dist');
const PORT = 4318;
const TMP = path.join(os.tmpdir(), `check-web-${process.pid}.json`);

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.log('── 웹이 무엇을 어떻게 내주나 ──');
  console.log('건너뜀 — frontend/dist 가 없습니다 (`cd frontend && npm run build` 뒤에 다시 보세요)');
  process.exit(0);
}

let fail = 0;
const ok = (label, got, want) => {
  const good = JSON.stringify(got) === JSON.stringify(want);
  if (!good) fail += 1;
  console.log(`${good ? 'OK  ' : 'FAIL'} ${label} -> ${JSON.stringify(got)}${good ? '' : ` (기대: ${JSON.stringify(want)})`}`);
};

/** 한 번 물어본다 — 몸통은 세지만 풀지 않는다 (br 로 올 수 있다) */
function get(urlPath, headers = {}) {
  return new Promise((done, nope) => {
    const req = http.get({
      host: 'localhost', port: PORT, path: urlPath,
      headers: { 'accept-encoding': 'br, gzip', 'user-agent': 'check-web', ...headers },
    }, (res) => {
      let bytes = 0;
      res.on('data', (c) => { bytes += c.length; });
      res.on('end', () => done({
        status: res.statusCode,
        enc: res.headers['content-encoding'] || null,
        cache: res.headers['cache-control'] || null,
        type: res.headers['content-type'] || null,
        vary: res.headers.vary || null,
        bytes,
      }));
    });
    req.on('error', nope);
    req.setTimeout(10000, () => nope(new Error('10초 안에 답이 없다')));
  });
}

function waitHealth(child) {
  return new Promise((done, nope) => {
    const guard = setTimeout(() => { clearInterval(poll); nope(new Error('20초 안에 안 떴다')); }, 20000);
    const poll = setInterval(() => {
      http.get({ host: 'localhost', port: PORT, path: '/api/health' }, (r) => {
        r.resume();
        if (r.statusCode === 200) { clearInterval(poll); clearTimeout(guard); done(); }
      }).on('error', () => { /* 아직 */ });
    }, 50);
    child.on('exit', (code) => { clearInterval(poll); clearTimeout(guard); nope(new Error('서버가 죽었다 (code ' + code + ')')); });
  });
}

// 해시가 박힌 파일 하나를 dist 에서 집어온다 — 이름은 빌드마다 바뀐다
const hashed = (() => {
  const dir = path.join(DIST, 'assets');
  const f = fs.readdirSync(dir).find((n) => /-[A-Za-z0-9_-]{8,}\.js$/.test(n) && fs.existsSync(path.join(dir, n + '.br')));
  return f ? '/assets/' + f : null;
})();

(async () => {
  console.log('── 웹이 무엇을 어떻게 내주나 ── (운영 모드로 띄워서 본다)');
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT), DB_FILE: TMP, DATABASE_URL: '',
      NODE_ENV: 'production',
      JWT_SECRET: process.env.JWT_SECRET || 'x'.repeat(40),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});

  try {
    await waitHealth(child);

    console.log('\n  미리 압축해 둔 것을 집어 주는가');
    const home = await get('/home');
    ok('  화면 문서가 압축돼 나간다', home.enc, 'br');
    ok('  받겠다고 한 압축에 따라 다른 몸통임을 알린다', /accept-encoding/i.test(home.vary || ''), true);
    if (hashed) {
      const a = await get(hashed);
      ok('  해시 파일도 압축돼 나간다', a.enc, 'br');
      ok('  해시 파일은 1년 immutable', a.cache, 'public, max-age=31536000, immutable');
    }

    console.log('\n  캐시 머리가 제자리인가');
    ok('  화면 문서는 늘 다시 물어본다', home.cache, 'no-cache');
    // **10/13~10/15 에 여기가 틀려 있었다** — 압축본은 res.sendFile 로 나가고
    // 그 기본 maxAge 는 0 이라, 해시 없는 압축본이 전부 max-age=0 이었다
    const icon = await get('/icons/icon.svg');
    ok('  해시 없는 압축본도 캐시된다 (0 이 아니다)', /max-age=(\d+)/.test(icon.cache || '') && Number(RegExp.$1) > 0, true);

    console.log('\n  주소에 맞는 문서를 주는가');
    // `/site` 는 그 화면 조각을 미리 적어 보내므로 `/support`(그 목록에 없는 주소)보다 크다
    const site = await get('/site');
    const plain = await get('/support');
    ok('  /site 가 열린다', site.status, 200);
    // ── 여기서 FAIL 하면 **`dist` 를 어떻게 지었는지부터 본다** ── (2026-10-27)
    //
    // 조각을 미리 적어 넣는 일은 **빌드 뒤에 따로 도는 걸음**이다
    // (`npm run build` → `[route-chunks] 주소 8개에 …`). `npx vite build` 로 지으면
    // 그 걸음이 **안 돌아서** 이 줄이 FAIL 한다 — 코드는 멀쩡한데 검사가 운다.
    // 오늘 그걸로 두 번 멈췄다. **`npm run build` 로 다시 짓고 보라.**
    ok('  /site 는 받을 조각을 미리 적어 보낸다 (문서가 더 크다)'
      + ' [FAIL 이면 frontend 에서 `npm run build` 로 다시 지어 보세요]',
    site.bytes > plain.bytes, true);
    ok('  목록에 없는 주소도 그냥 열린다', plain.status, 200);

    console.log('\n  / 가 정적 쪽으로 새지 않는가');
    const root = await get('/');
    ok('  / 도 미리 압축한 것으로 나간다', root.enc, 'br');
    ok('  / 도 늘 다시 물어본다', root.cache, 'no-cache');
    // 요청마다 압축하면 같은 문서가 더 크게 나간다 (품질을 낮게 쓸 수밖에 없어서다)
    ok('  / 가 폴백과 같은 크기다 (요청마다 다시 압축하지 않는다)', root.bytes, plain.bytes);
  } catch (e) {
    fail += 1;
    console.log('FAIL 서버를 못 띄웠다 ->', e.message);
  } finally {
    child.kill();
    for (const f of [TMP, TMP.replace(/\.json$/, '') + '.photos.json']) {
      try { fs.unlinkSync(f); } catch { /* 없으면 그만 */ }
    }
  }

  console.log('');
  if (fail) {
    console.log(`${fail}건 — 느려지거나 같은 것을 다시 받습니다 (화면에는 안 보입니다).`);
    process.exit(1);
  }
  console.log('미리 압축한 것을 집어 주고, 캐시 머리와 주소별 문서가 제자리입니다');
})();
