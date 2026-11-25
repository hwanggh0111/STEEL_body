// **소셜 콜백에 이상한 쿠키를 보내도 서버가 안 죽는가** (2026-11-25 · 근호).
//
//   node scripts/check-oauthstate.cjs              (npm run check 에도 들어 있다 — 찾아서 돈다)
//   node scripts/check-oauthstate.cjs --되돌려     옛 `mac.length` 꼴로 돌려 **우는지** 본다
//
// ── 무엇이 있었나 ──
//
// `routes/oauth.js` 의 `readState` 가 서명 길이를 **글자 수**(`mac.length`)로 재고
// `crypto.timingSafeEqual(Buffer, Buffer)` 를 불렀다. 쿠키에 `é` · 한글을 넣으면 글자 수는
// 같고 바이트 수가 달라 **던진다** — 콜백 손이 async 라 잡는 곳이 없어 unhandledRejection 으로
// **서버 프로세스가 죽었다.** 로그인 없이 콜백 주소 한 번이면 됐다(네 갈래 다).
//
// ── 어떻게 보나 ──
//
// 진짜 라우터를 작은 앱에 꽂아 빈 포트(0)로 띄우고, 네 콜백에 그 쿠키를 보낸다.
// **답이 오는가 · 이 프로세스에 unhandledRejection 이 없는가** 를 본다. 포트를 따로
// 안 정하므로 개발 서버(4000)와 안 부딪힌다.
const fs = require('fs');
const path = require('path');
const os = require('os');

const REVERT = process.argv.includes('--되돌려');
const TMP = path.join(os.tmpdir(), `oauthstate-${process.pid}.json`);
process.env.DB_FILE = TMP;
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
require('./_tmpdb.cjs')(TMP);

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const rejections = [];
process.on('unhandledRejection', (err) => { rejections.push(String(err && err.message || err)); });

// 되돌려: 옛 꼴의 사본을 부른다 (파일은 안 고친다)
const SRC = path.join(__dirname, '../src/routes/oauth.js');
let routerPath = SRC;
const copies = [];
if (REVERT) {
  const src = fs.readFileSync(SRC, 'utf-8');
  const from = /const macBuf = Buffer\.from\(mac\);[\s\S]*?if \(!same\) return null;/;
  if (!from.test(src)) { ok('되돌릴 자리를 찾았다', false, true); }
  const old = src.replace(from,
    'if (mac.length !== want.length) return null;\n  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;');
  routerPath = path.join(path.dirname(SRC), '.oauth.revert.js');
  fs.writeFileSync(routerPath, old);
  copies.push(routerPath);
}
process.on('exit', () => { for (const f of copies) { try { fs.unlinkSync(f); } catch { /* 없어도 된다 */ } } });

const express = require('express');
const cookieParser = require('cookie-parser');

(async () => {
  const app = express();
  app.use(cookieParser());
  app.use('/api/oauth', require(routerPath));
  const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api/oauth`;

  // 서명은 base64url 43 글자다(sha256). 같은 글자 수에 **여러 바이트 글자 하나**를 섞는다
  const mac = 'A'.repeat(42) + 'é';
  const cookie = `sb_oauth=${encodeURIComponent('e30.' + mac)}`;
  ok('  (쿠키 서명이 43 글자다 — 글자 수로는 같은 길이다)', mac.length, 43);

  for (const p of ['google', 'naver', 'instagram', 'twitter']) {
    let status = 0;
    try {
      // 옛 꼴에서는 손이 답하기 전에 던져서 **답이 영영 안 온다** — 3초에 끊는다
      const r = await fetch(`${base}/${p}/callback?state=x&code=y`,
        { headers: { cookie }, redirect: 'manual', signal: AbortSignal.timeout(3000) });
      status = r.status;
    } catch (err) { status = 'error:' + err.message; }
    await new Promise((r) => setTimeout(r, 30));
    ok(`${p} 콜백이 답한다 (4xx · 3xx — 500 도 죽음도 아니다)`, typeof status === 'number' && status < 500, true);
  }
  await new Promise((r) => setTimeout(r, 50));
  ok('**잡히지 않은 거절(unhandledRejection)이 없다** — 서버가 죽지 않는다', rejections, []);

  server.close();
  console.log('');
  if (bad > 0) { console.log(bad + '건 FAIL'); process.exit(1); }
  console.log('모두 통과');
  process.exit(0);
})().catch((err) => { console.error('터짐:', err); process.exit(1); });
