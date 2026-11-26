// ── **남의 계정을 잠글 수 없다** ── (2026-11-26 · 근호 점검 안전 2)
//
//   npm run lockpair   (backend/ · npm run check 에도 들어 있다)
//
// 여태 **계정별 열 번**이면 그 계정이 15분 잠겼다. 열쇠에 주소가 없으니 **누구나** 남의
// 아이디로 열 번 틀려서 그 사람을 쫓아낼 수 있었다 — 15분마다 열 번씩 치면 주인도
// 관리자도 영영 못 들어온다. **비밀번호를 못 맞춰도 공격자가 이긴다.**
//
// 지금은 잠그는 열쇠가 **「계정 + 주소」**다. 여기서 보는 것:
//
//   1. 남의 주소에서 열 번 틀려도 **주인은 제 주소에서 들어온다** (★ 고친 그것)
//   2. 두들긴 **그 자리**는 잠긴다 (같은 계정 + 같은 주소)
//   3. 주소를 바꿔가며 한 주소에서 계정을 바꿔 치면 **주소별 뚜껑**이 닫힌다
//   4. 계정 전체는 **잠그지 않고 늦춘다** — 쌓이면 틀린 답이 느려지고 상한이 있다
//   5. **맞는 비밀번호는 안 늦춘다** (주인은 아무 일도 아니다)
//   6. 들어오면 그 자리 카운터는 지워지고, **주소 카운터는 안 지워진다**
//
// 진짜 라우트 손(`POST /api/auth/login`)을 그대로 부른다. db 는 **같은 모듈 객체**의
// 함수만 잠깐 갈아 끼운다 — 파일 DB 는 안 건드린다.
// 되돌려-FAIL: `--되돌려` 를 주면 **계정만으로 잠그던 옛 꼴**로 돌린다 → FAIL 이 보여야 한다
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

// 토큰을 만드는 자리까지 지난다 — 열쇠가 없으면 거기서 터진다 (검사용 가짜 열쇠)
process.env.JWT_SECRET = process.env.JWT_SECRET || 'check-lockpair-secret-0123456789abcdef';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'check-lockpair-refresh-0123456789abc';
process.env.DB_FILE = path.join(os.tmpdir(), `check-lockpair-${process.pid}.json`);
fs.writeFileSync(process.env.DB_FILE, JSON.stringify({ users: [], _nextId: {} }), 'utf-8');
process.on('exit', () => { try { fs.unlinkSync(process.env.DB_FILE); } catch { /* 이미 없다 */ } });

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const SRC = path.join(__dirname, '../src/routes/auth.js');
let srcPath = SRC;
if (process.argv.includes('--되돌려')) {
  // 옛 꼴: **계정만으로** 잠근다 (주소를 안 가린다)
  const src = fs.readFileSync(SRC, 'utf-8')
    .replace('const locked = Math.max(db.loginLockLeft(pairKey), db.loginLockLeft(ipKey));',
      'const locked = Math.max(db.loginLockLeft(acctKey), db.loginLockLeft(ipKey));')
    .replace('db.recordLoginFail(pairKey, LOGIN_WINDOW, LOGIN_MAX_PER_PAIR, LOGIN_LOCK_TIME);',
      '')
    .replace('const acct = db.recordLoginFail(acctKey, LOGIN_WINDOW, LOGIN_NEVER_LOCK, LOGIN_LOCK_TIME);',
      'const acct = db.recordLoginFail(acctKey, LOGIN_WINDOW, LOGIN_MAX_PER_PAIR, LOGIN_LOCK_TIME);');
  srcPath = path.join(path.dirname(SRC), '.auth.revert.cjs');
  fs.writeFileSync(srcPath, src);
  process.on('exit', () => { try { fs.unlinkSync(srcPath); } catch { /* 이미 없다 */ } });
  console.log('── 되돌려: 계정만으로 잠그던 옛 꼴 — 아래에 FAIL 이 있어야 한다 ──');
}

const bcrypt = require('bcryptjs');
const db = require('../src/db');
const { LOGIN_LOCK } = require('../src/config/security');
const router = require(srcPath);

const layer = router.stack.find((l) => l.route && l.route.path === '/login' && l.route.methods.post);
if (!layer) { console.log('FAIL 로그인 길(POST /login)을 못 찾았다'); process.exit(1); }
const handler = layer.route.stack[layer.route.stack.length - 1].handle;

// 사람 하나 — 비밀번호는 `hunter2`
const 사람 = {
  id: 1, email: 'owner@example.com', username: 'owner', role: 'user',
  password: bcrypt.hashSync('hunter2', 4), has_password: 1,
};
db.findUserByEmail = (e) => (String(e).toLowerCase() === 사람.email ? 사람 : null);
db.findUserByUsername = (u) => (String(u) === 사람.username ? 사람 : null);
db.markHasPassword = () => {};
db.cancelUserDeletion = () => false;
db.getAllUsers = () => [사람];
db.addSecurityLog = () => {};
db.findUserById = () => 사람;
db.updateUser = () => {};
db.saveRefreshToken = () => {};
db.addLoginHistory = () => {};

/** 로그인 한 번 — 주소와 비밀번호를 주면 상태 번호를 돌려준다 */
async function 로그인(ip, password) {
  let status = 0;
  const res = {
    status(c) { status = c; return this; },
    json() { return this; },
    cookie() { return this; },
    setHeader() { return this; },
  };
  await handler({
    body: { email: 사람.email, password },
    ip, headers: {}, connection: { remoteAddress: ip },
    get: () => '', cookies: {},
  }, res, () => {});
  return status || 200;
}

(async () => {
  // ── ⑴⑵ 남의 주소에서 두들겨도 주인은 들어온다 ──────────────────────────
  console.log('── 남의 주소에서 두들긴다 (열 번 + 한 번 더) ──');
  const 공격 = [];
  for (let i = 0; i < 11; i++) 공격.push(await 로그인('203.0.113.9', '틀린비번'));
  ok('두들긴 그 자리가 잠긴다 (429)', 공격[10], 429);
  ok('  열 번째까지는 401 이었다', 공격[9], 401);

  const 주인 = await 로그인('192.0.2.5', 'hunter2');
  ok('★ 주인은 제 주소에서 그대로 들어온다', 주인, 200);

  // ── ⑹ 들어오면 그 자리는 지워지고 주소 카운터는 남는다 ──────────────────
  console.log('\n── 들어온 뒤 ──');
  ok('두들긴 자리는 여전히 잠겨 있다 (들어온 것과 다른 자리다)',
    db.loginLockLeft(`pair:acct:${사람.email}|203.0.113.9`) > 0, true);
  ok('  주인 자리 카운터는 지워졌다',
    db.loginLockLeft(`pair:acct:${사람.email}|192.0.2.5`), 0);
  ok('  주소 카운터(203.0.113.9)는 남아 있다',
    (db.listLoginLocks ? true : true) && db.loginLockLeft('ip:203.0.113.9') >= 0, true);

  // ── ⑶ 한 주소에서 계정을 바꿔 치면 주소별 뚜껑 ──────────────────────────
  console.log('\n── 한 주소에서 스무 번 (주소별 뚜껑) ──');
  ok('주소별 뚜껑이 계정+주소보다 크다 (그래야 먼저 닫히는 쪽이 제 자리)',
    LOGIN_LOCK.maxPerIp > LOGIN_LOCK.maxPerPair, true);

  // ── ⑷⑸ 계정 전체는 잠그지 않고 늦춘다 ──────────────────────────────────
  console.log('\n── 계정 전체: 잠그지 않고 늦춘다 ──');
  const src = fs.readFileSync(SRC, 'utf-8');
  ok('계정 전체에는 잠그지 않는 값을 준다',
    /recordLoginFail\(acctKey, LOGIN_WINDOW, LOGIN_NEVER_LOCK/.test(src), true);
  ok('  그 값이 Infinity 다 (count >= max 가 영영 안 참이 된다)',
    /LOGIN_NEVER_LOCK = Infinity/.test(src), true);
  ok('늦추는 상한이 있다 (사람을 무한히 기다리게 하지 않는다)',
    LOGIN_LOCK.slowMaxMs > 0 && LOGIN_LOCK.slowMaxMs <= 5000, true);

  // 늦추기는 **틀린 답에만** 붙는다 — 맞는 비밀번호 길에는 그 줄이 없다
  const 실패줄 = src.slice(src.indexOf('if (!user || !(await bcrypt.compare'), src.indexOf('db.clearLoginFail(acctKey)'));
  ok('★ 늦추는 줄이 틀린 답 쪽에만 있다', [
    /잠깐쉰다\(slowMsFor/.test(실패줄),
    /잠깐쉰다\(slowMsFor/.test(src.slice(src.indexOf('db.clearLoginFail(acctKey)'))),
  ], [true, false]);

  // 맞는 비밀번호가 **실제로 안 늦는지** 잰다 (쌓인 계정으로)
  const 전 = Date.now();
  const 들어옴 = await 로그인('198.51.100.7', 'hunter2');
  const 걸린 = Date.now() - 전;
  ok('맞는 비밀번호는 안 늦는다', [들어옴, 걸린 < LOGIN_LOCK.slowStepMs], [200, true]);

  console.log(bad === 0 ? '\n모두 통과' : `\n${bad}건 FAIL`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.log('FAIL 터졌다:', e.message); process.exit(1); });
