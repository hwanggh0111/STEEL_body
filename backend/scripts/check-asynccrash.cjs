// **async 라우트 손이 던져도 서버(프로세스)가 안 죽는가** (2026-11-25 · 근호 · 벼림 지적).
//
//   node scripts/check-asynccrash.cjs             (npm run check 에도 들어 있다 — 찾아서 돈다)
//   node scripts/check-asynccrash.cjs --되돌려    감싸기 없이 돌려 **우는지** 본다
//
// ── 무엇을 보는가 ──
//
// Express 4 는 async 손의 거절을 안 잡는다 — 11/25 `readState` 가 그 길로 서버를 죽였다.
// `utils/asyncRoute.js` 의 `guardAsyncRoutes` 가 길 전체의 async 손을 감싼다.
//
//   1. async 손이 있는 라우터 넷(auth · oauth · reminders · security)을 작은 앱에 꽂고 감싼다
//   2. **db 의 손을 전부 던지게** 바꿔, 로그인 없이 닿는 async 길을 두드린다 —
//      답이 오고(500 이어도 된다 — 죽지만 않으면) 잡히지 않은 거절이 0 인가
//   3. 감싼 뒤 남은 async 손이 0 인가 · `index.js` 가 라우터를 다 꽂은 **뒤**(404 손 앞)에 부르는가
//
// 빈 포트(0)로 띄운다 — 개발 서버(4000)와 안 부딪힌다.
const fs = require('fs');
const path = require('path');
const os = require('os');

const REVERT = process.argv.includes('--되돌려');
const TMP = path.join(os.tmpdir(), `asynccrash-${process.pid}.json`);
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
process.on('unhandledRejection', (err) => { rejections.push(String((err && err.message) || err)); });

const express = require('express');
const cookieParser = require('cookie-parser');
const db = require('../src/db');
const { guardAsyncRoutes, unguardedAsync } = require('../src/utils/asyncRoute');

(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', require('../src/routes/auth'));
  app.use('/api/oauth', require('../src/routes/oauth'));
  app.use('/api/reminders', require('../src/routes/reminders'));
  app.use('/api/security', require('../src/routes/security'));

  console.log('── 감싸기 ──');
  const before = unguardedAsync(app).length;
  ok('감싸기 전 async 손이 있다 (모집단 0 을 통과로 내보내지 않는다)', before >= 13, true);
  const n = REVERT ? 0 : guardAsyncRoutes(app);
  ok('감싼 수 = 있던 수', n, before);
  ok('**감싼 뒤 남은 async 손이 0**', unguardedAsync(app), []);
  ok('  두 번 불러도 더 감싸지 않는다', REVERT ? 0 : guardAsyncRoutes(app), 0);
  // 오류 손 — index.js 의 맨 끝 손과 같은 자리
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => { res.status(500).json({ error: 'x' }); });

  const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;

  // ── db 를 전부 던지게 ── (손 안의 어느 줄이 try 밖이든 던지게 한다)
  const keep = {};
  for (const [k, v] of Object.entries(db)) {
    if (typeof v === 'function') { keep[k] = v; db[k] = () => { throw new Error('가짜 고장: db.' + k); }; }
  }

  console.log('');
  console.log('── 로그인 없이 닿는 async 길을 던지는 db 로 두드린다 ──');
  const hits = [
    ['POST', '/auth/send-code', { email: 'a@b.cd', purpose: 'register' }],
    ['POST', '/auth/register', { email: 'a@b.cd', password: 'Passw0rd!x', nickname: '가', username: 'abcd1234', code: '123456' }],
    ['POST', '/auth/login', { email: 'a@b.cd', password: 'Passw0rd!x' }],
    ['POST', '/auth/reset-password', { email: 'a@b.cd', code: '123456', newPassword: 'Passw0rd!y' }],
    ['GET', '/oauth/google/callback?state=x&code=y', null],
    ['GET', '/oauth/naver/callback?state=x&code=y', null],
    ['GET', '/oauth/instagram/callback?state=x&code=y', null],
    ['GET', '/oauth/twitter/callback?state=x&code=y', null],
    ['POST', '/oauth/email', { email: 'a@b.cd' }],
  ];
  for (const [method, p, body] of hits) {
    let status = 0;
    try {
      const r = await fetch(base + p, {
        method, redirect: 'manual', signal: AbortSignal.timeout(3000),
        headers: { 'content-type': 'application/json', cookie: 'sb_oauth=e30.' + 'A'.repeat(43) },
        body: body ? JSON.stringify(body) : undefined,
      });
      status = r.status;
    } catch (err) { status = 'no-answer'; }
    ok(`${method} ${p.split('?')[0]} 가 답한다`, typeof status === 'number', true);
  }
  await new Promise((r) => setTimeout(r, 80));
  ok('**잡히지 않은 거절이 0 — 프로세스가 산다**', rejections.length, 0);

  for (const [k, v] of Object.entries(keep)) db[k] = v;
  server.close();

  // ── index.js 가 **다 꽂은 뒤**에 부르는가 ──
  console.log('');
  console.log('── index.js 의 자리 ──');
  const idx = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf-8');
  const at = idx.indexOf('guardAsyncRoutes(app)');
  const lastMount = idx.lastIndexOf("app.use('/api/");
  const notFound = idx.indexOf("app.use('/api', (req, res)");
  ok('부른다', at > 0, true);
  ok('  마지막 라우터를 꽂은 뒤 · 404 손 앞이다', at > lastMount && at < notFound, true);
  ok('마지막 그물(unhandledRejection 을 적고 넘어감)이 있다', /process\.on\('unhandledRejection'/.test(idx), true);

  console.log('');
  if (bad > 0) { console.log(bad + '건 FAIL'); process.exit(1); }
  console.log('모두 통과');
  process.exit(0);
})().catch((err) => { console.error('터짐:', err); process.exit(1); });
