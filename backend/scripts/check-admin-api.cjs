// **관리자 길이 처벌을 조용히 지우지 않는가** — 진짜 서버로 (2026-11-05).
//
//   npm run adminapi     (포트를 쓰므로 `npm run check` 에서는 건너뛴다)
//
// ── 왜 진짜 서버로 보나 ──
//
// 여기서 보는 것은 **역할이 오가는 자리**다 — `user` → `blocked` → `admin`.
// 그 사이의 규칙은 라우트에 있고(db 에도, 미들웨어에도 조금씩 있다), 글자로 보면
// 「`if` 가 있다」까지만 알 수 있다. **실제로 막히는지는 눌러봐야** 안다.
//
// ── 무엇이 틀렸었나 ──
//
// 막힘은 `role` 로 잡는다(`middleware/auth`: `role === 'blocked'` → 403).
// 그런데 `POST /security/make-admin/:id` 가 **아무 검사 없이 `role` 을 `'admin'` 으로
// 덮어썼다** — 그러면 **차단이 조용히 풀린다.**
//
// 정지는 더 나쁘다: 같은 미들웨어가 **관리자의 정지를 아예 안 본다**
// (`user.role === 'admin' ? null : db.getSuspension(...)`). 일부러 그렇게 둔
// 정책이지만(자기 정지를 자기가 못 풀면 서비스가 잠긴다), 그 덕에 이 길이
// **정지 해제 우회로**가 됐다 — 정지된 사람을 관리자로 올리면 정지가 사라지고
// 관리자 화면까지 열린다.
//
// 진짜 DB 도 진짜 포트도 안 건드린다 (`check-cardio-api.cjs` 와 같은 방식).
// 그리고 **DB 파일을 밖에서 쑤시지 않는다** — 정지도 앱의 길(제보)로 건다.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TMP = path.join(ROOT, '.check-adminapi.json');
const ADMIN_EMAIL = 'boss@adminapi.local';
let PORT = 4780;
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
      VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '', DEV_ECHO_CODE: '1',
      // **열쇠를 못 박는다** — 안 박으면 서버가 다시 뜰 때마다 새로 만들어서
      // 앞에서 받은 토큰이 전부 401 이 된다 (처음 판이 그래서 헛돌았다)
      // ★ **32자 이상**이어야 한다 — 짧으면 서버가 FATAL 로 안 뜬다().
      //   처음 판이 27자여서 「서버가 안 떴습니다」를 받았다 (자가 제대로 말해줬다)
      JWT_SECRET: 'check-admin-api-fixed-secret-0123456789abcdef',
      // 가입하면 그 자리에서 관리자가 되는 주소 (`routes/auth.js` 가 그렇게 한다)
      ADMIN_EMAIL,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
}
async function waitUp(ms = 15000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try { if ((await fetch(`${BASE}/health`)).ok) return true; } catch { /* 아직 */ }
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
  for (let p = 4780; p <= 4800; p += 1) {
    try { await fetch(`http://127.0.0.1:${p}/api/health`, { signal: AbortSignal.timeout(400) }); } catch { return p; }
  }
  return 0;
}

// 자리마다 다른 바깥 주소를 쓴다 — 로그인 제한이 따라오면 시험이 헛돈다
let ipSeq = 0;
const nextIp = () => `198.51.100.${(ipSeq += 1) % 180 + 20}`;

async function call(method, url, body, token, ip = nextIp()) {
  const headers = { 'Content-Type': 'application/json', 'X-Forwarded-For': ip };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + url, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* 몸통이 없는 답도 있다 */ }
  return { status: res.status, body: json };
}

/** 계정 하나 만들고 토큰을 받는다 (가입은 메일 번호를 같이 보낸다) */
async function join(email) {
  const ip = nextIp();
  const sent = await call('POST', '/auth/send-code', { email }, null, ip);
  const code = sent.body?.code;
  if (!code) return { token: null, why: '인증번호를 못 받았다' };
  const reg = await call('POST', '/auth/register', {
    email, password: 'adminapi12345', nickname: '시험', code,
    username: 'a' + Math.random().toString(36).slice(2, 8),
  }, null, ip);
  return { token: reg.body?.token || null, status: reg.status, body: reg.body };
}

(async () => {
  PORT = await pickPort();
  if (!PORT) { console.log('FAIL 빈 포트를 못 찾았습니다'); process.exit(1); }
  BASE = `http://127.0.0.1:${PORT}/api`;
  startServer();
  if (!await waitUp()) { console.log('FAIL 서버가 안 떴습니다'); await stopServer(); clean(); process.exit(1); }

  // ── 관리자 하나와 사람 둘 ──
  const boss = await join(ADMIN_EMAIL);
  if (!boss.token) {
    console.log('FAIL 관리자 계정을 못 만들었습니다 — 아래를 돌려도 뜻이 없습니다');
    await stopServer(); clean(); process.exit(1);
  }
  const A = await join('one@adminapi.local');
  const B = await join('two@adminapi.local');
  if (!A.token || !B.token) {
    console.log('FAIL 시험 계정을 못 만들었습니다');
    await stopServer(); clean(); process.exit(1);
  }

  console.log('── 문이 실제로 막는가 ──');
  const list = await call('GET', '/security/users', undefined, boss.token);
  ok('관리자는 사람 목록을 본다', list.status, 200);
  const sneak = await call('GET', '/security/users', undefined, A.token);
  ok('**관리자가 아니면 403**', [sneak.status, sneak.body?.error], [403, '관리자만 쓸 수 있어요']);
  const noToken = await call('GET', '/security/users');
  ok('  열쇠 없이도 못 본다', noToken.status, 401);

  // 사람 목록에서 번호를 찾는다
  const users = Array.isArray(list.body) ? list.body : (list.body?.users || []);
  const idOf = (email) => (users.find((u) => u.email === email) || {}).id;
  const idA = idOf('one@adminapi.local');
  const idB = idOf('two@adminapi.local');
  ok('목록에서 번호를 찾았다', [typeof idA, typeof idB], ['number', 'number']);

  console.log('');
  console.log('── 막힌 사람을 관리자로 올리면 ──');
  const blocked = await call('POST', `/security/block-user/${idA}`, {}, boss.token);
  ok('사람을 막는다', blocked.status, 200);
  const blockedTry = await call('GET', '/auth/me', undefined, A.token);
  ok('  막힌 사람은 들어오지 못한다', [blockedTry.status, blockedTry.body?.code], [403, 'blocked']);

  // ★★ 여기가 구멍이었다 — `role` 을 'admin' 으로 덮어쓰면 **차단이 조용히 풀린다**
  const promote = await call('POST', `/security/make-admin/${idA}`, {}, boss.token);
  ok('**막힌 사람은 관리자로 못 올린다**',
    [promote.status, promote.body?.error], [400, '차단된 계정이에요 — 먼저 차단을 풀고 올려주세요']);
  const stillBlocked = await call('GET', '/auth/me', undefined, A.token);
  ok('  그래서 여전히 막혀 있다', [stillBlocked.status, stillBlocked.body?.code], [403, 'blocked']);

  // 풀고 나면 올라간다 — **두 걸음이 되는 대신 처벌이 조용히 사라지지 않는다**
  const unblocked = await call('POST', `/security/unblock-user/${idA}`, {}, boss.token);
  ok('차단을 풀면', unblocked.status, 200);
  const promote2 = await call('POST', `/security/make-admin/${idA}`, {}, boss.token);
  ok('  그다음엔 관리자로 올라간다', promote2.status, 200);

  console.log('');
  console.log('── 정지 중인 사람을 관리자로 올리면 ──');
  // ★ **앱의 길로 정지를 건다** — 비하가 섞인 제보는 그 자리에서 정지다
  // (`utils/abusePolicy.punish`, 첫 번에 7일). 처음 판은 DB 파일을 직접 쑤셨는데,
  // 서버가 **쓰기를 미뤄 모아 쓰므로**(500ms) 내린 직후의 파일에는 방금 만든 사람이
  // 아직 없었다 — 그 파일을 읽어 다시 쓰면 **그 사람을 잃는다.** 밖에서 쑤시지 않는다.
  const abuse = await call('POST', '/reports',
    { kind: 'bug', title: '안 되네', body: '느금마 이거 왜 안 되냐' }, B.token);
  ok('비하가 섞인 제보는 그 자리에서 막힌다', abuse.status, 400);
  ok('  며칠 정지인지 같이 말해준다', abuse.body?.abuse?.days >= 1, true);
  const suspTry = await call('GET', '/auth/me', undefined, B.token);
  ok('정지된 사람은 들어오지 못한다', [suspTry.status, suspTry.body?.code], [403, 'suspended']);

  // ★★ 여기가 더 나쁜 구멍이었다 — 미들웨어는 **관리자의 정지를 아예 안 본다**
  //    (일부러 그렇게 둔 정책이다). 그래서 이 길이 **정지 해제 우회로**가 됐다
  const promote3 = await call('POST', `/security/make-admin/${idB}`, {}, boss.token);
  ok('**정지 중인 사람은 관리자로 못 올린다**',
    [promote3.status, promote3.body?.error], [400, '정지 중인 계정이에요 — 먼저 정지를 풀고 올려주세요']);
  const stillSusp = await call('GET', '/auth/me', undefined, B.token);
  ok('  그래서 여전히 정지 중이다', stillSusp.body?.code, 'suspended');

  console.log('');
  console.log('── 서비스가 잠기지 않는가 ──');
  const selfRevoke = await call('POST', `/security/revoke-admin/${idOf(ADMIN_EMAIL)}`, {}, boss.token);
  ok('자기 관리자 권한은 못 내린다',
    [selfRevoke.status, selfRevoke.body?.error], [400, '자신의 관리자 권한은 해제할 수 없어요']);
  const blockAdmin = await call('POST', `/security/block-user/${idOf(ADMIN_EMAIL)}`, {}, boss.token);
  ok('관리자는 막을 수 없다', [blockAdmin.status, blockAdmin.body?.error], [400, '관리자는 차단할 수 없어요']);
  const delAdmin = await call('DELETE', `/security/user/${idOf(ADMIN_EMAIL)}`,
    { confirmEmail: ADMIN_EMAIL }, boss.token);
  ok('관리자는 지울 수 없다', [delAdmin.status, delAdmin.body?.error], [400, '관리자는 지울 수 없어요']);

  await stopServer();
  clean();
  console.log('');
  if (bad > 0) { console.log(bad + '건 실패'); process.exit(1); }
  console.log('관리자 길 전부 통과');
})().catch(async (e) => {
  console.log('FAIL 터졌습니다 — ' + (e && e.message));
  await stopServer();
  clean();
  process.exit(1);
});
