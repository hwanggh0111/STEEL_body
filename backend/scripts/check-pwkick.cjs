// ── **비밀번호를 바꾸면 옛 세션이 그 자리에서 끊긴다** ── (2026-11-26 · 근호 점검 안전 7)
//
//   npm run pwkick   (backend/ · npm run check 에도 들어 있다)
//
// 바꾸는 두 길(`PUT /auth/password` · `POST /auth/reset-password`)은 로그인 유지 열쇠를
// 전부 걷었다(`deleteUserRefreshTokens`). 그런데 그때 **남의 손에 들려 있던 접근
// 토큰(15분)은 그대로 살아 있었다** — 쫓아내려고 비밀번호를 바꾼 사람이 **15분을 더**
// 기다려야 했고, 훔쳐 간 쪽은 그 15분을 다 쓴다.
//
// 여기서 보는 것:
//
//   1. 바꾸기 **전에** 받은 토큰은 그 뒤 **401** 이다 (★ 고친 그것 · 까닭 코드까지)
//   2. 바꾼 **뒤에** 받은 토큰은 그대로 쓴다 (주인을 쫓아내면 안 된다)
//   3. 바꾼 시각을 **`db.updateUserPassword` 한 자리**에서 찍는다 (길 둘이 다 지난다)
//   4. **그 칸이 없는 옛 사람**(한 번도 안 바꾼 계정)은 검사하지 않는다 — 전부
//      쫓아내는 일이 없다
//   5. 바꾼 **그 초**에 받은 토큰은 안 걸린다 (`iat` 이 초라서 생기는 억울함 막기)
//
// 진짜 미들웨어(`middleware/auth.js`)를 그대로 부른다. db 는 **같은 모듈 객체**의
// 함수만 잠깐 갈아 끼운다 — 파일 DB 는 안 건드린다.
// 되돌려-FAIL: `--되돌려` 를 주면 **그 검사를 뺀 판**으로 돌린다 → FAIL 이 보여야 한다
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'check-pwkick-secret-0123456789abcdef';
process.env.DB_FILE = path.join(os.tmpdir(), `check-pwkick-${process.pid}.json`);
fs.writeFileSync(process.env.DB_FILE, JSON.stringify({ users: [], _nextId: {} }), 'utf-8');
process.on('exit', () => { try { fs.unlinkSync(process.env.DB_FILE); } catch { /* 이미 없다 */ } });

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const SRC = path.join(__dirname, '../src/middleware/auth.js');
let srcPath = SRC;
if (process.argv.includes('--되돌려')) {
  // 옛 꼴: 바꾼 시각을 **안 본다** (접근 토큰이 15분 더 살았다)
  const src = fs.readFileSync(SRC, 'utf-8')
    .replace('if (user.pw_changed_at && decoded.iat) {', 'if (false) {');
  srcPath = path.join(path.dirname(SRC), '.auth.pwkick.revert.cjs');
  fs.writeFileSync(srcPath, src);
  process.on('exit', () => { try { fs.unlinkSync(srcPath); } catch { /* 이미 없다 */ } });
  console.log('── 되돌려: 바꾼 시각을 안 보던 옛 꼴 — 아래에 FAIL 이 있어야 한다 ──');
}

const jwt = require('jsonwebtoken');
const db = require('../src/db');
const auth = require(srcPath);

let 사람 = { id: 7, email: 'a@b.c', username: 'owner', role: 'user' };
db.findUserById = () => 사람;

/** 그 토큰으로 미들웨어를 지나 본다 — 통과하면 200 */
function 지나본다(token) {
  let status = 200;
  let body = null;
  const res = { status(c) { status = c; return this; }, json(b) { body = b; return this; } };
  auth({ cookies: { sb_access: token }, headers: {} }, res, () => { status = 200; });
  return { status, code: body && body.code };
}

const 토큰 = (iatSec) => jwt.sign({ userId: 사람.id, iat: iatSec }, process.env.JWT_SECRET,
  { algorithm: 'HS256', expiresIn: '15m' });

const 지금 = Math.floor(Date.now() / 1000);

// ── ⑷ 한 번도 안 바꾼 계정 ─────────────────────────────────────────────────
console.log('── 한 번도 안 바꾼 계정 (칸이 없다) ──');
ok('★ 그 칸이 없으면 검사하지 않는다 (옛 사람을 쫓아내지 않는다)', 지나본다(토큰(지금 - 60)).status, 200);

// ── ⑴ 바꾸기 전에 받은 토큰 ────────────────────────────────────────────────
console.log('\n── 비밀번호를 바꿨다 ──');
const 옛토큰 = 토큰(지금 - 60);                       // 1분 전에 받은 것
사람 = Object.assign({}, 사람, { pw_changed_at: new Date(Date.now() - 10 * 1000).toISOString() });
const 옛결과 = 지나본다(옛토큰);
ok('★ 바꾸기 전에 받은 토큰은 401', 옛결과.status, 401);
ok('  까닭 코드를 같이 준다 (화면이 글자로 가려내지 않게)', 옛결과.code, 'pw_changed');

// ── ⑵ 바꾼 뒤에 받은 토큰 ──────────────────────────────────────────────────
console.log('\n── 다시 로그인했다 ──');
ok('바꾼 뒤에 받은 토큰은 그대로 쓴다', 지나본다(토큰(지금)).status, 200);

// ── ⑸ 바꾼 그 초에 받은 토큰 ───────────────────────────────────────────────
console.log('\n── 바꾼 바로 그 초 (iat 은 초다) ──');
const 바꾼순간 = new Date();
사람 = Object.assign({}, 사람, { pw_changed_at: 바꾼순간.toISOString() });
ok('★ 같은 초에 받은 토큰은 안 걸린다 (밀리초로 억울하게 걸리지 않는다)',
  지나본다(토큰(Math.floor(바꾼순간.getTime() / 1000))).status, 200);

// ── ⑶ 찍는 자리가 한 곳인가 ────────────────────────────────────────────────
console.log('\n── 찍는 자리 ──');
const dbSrc = fs.readFileSync(path.join(__dirname, '../src/db.js'), 'utf-8');
const 손 = dbSrc.slice(dbSrc.indexOf('updateUserPassword(id, hashedPassword)'));
ok('★ `updateUserPassword` 가 찍는다 (바꾸는 길 둘이 다 지난다)',
  /user\.pw_changed_at = /.test(손.slice(0, 400)), true);
const authSrc = fs.readFileSync(path.join(__dirname, '../src/routes/auth.js'), 'utf-8');
ok('  바꾸는 길 둘이 그 손을 부른다',
  (authSrc.match(/db\.updateUserPassword\(/g) || []).length >= 2, true);
ok('  그 길들은 로그인 유지 열쇠도 걷는다 (여태 하던 것 그대로)',
  (authSrc.match(/db\.deleteUserRefreshTokens\(/g) || []).length >= 2, true);

// 실제로 찍히는지 — **딴 프로세스에서** 본다. 이 프로세스의 `db` 는 뜰 때 판을 읽어
// 들고 있어서(캐시), 지금 파일을 고쳐 써도 그 손이 안 본다
console.log('');
console.log('── 진짜로 찍히나 (딴 프로세스) ──');
const { execFileSync } = require('child_process');
const DB2 = path.join(os.tmpdir(), `check-pwkick-real-${process.pid}.json`);
fs.writeFileSync(DB2, JSON.stringify({
  users: [{ id: 99, email: 'x@y.z', password: '$2a$04$x', role: 'user' }], _nextId: {},
}), 'utf-8');
try {
  execFileSync(process.execPath, ['-e',
    "const db=require('./src/db');db.updateUserPassword(99,'$2a$04$newnewnew');"],
  { cwd: path.join(__dirname, '..'), env: Object.assign({}, process.env, { DB_FILE: DB2 }), encoding: 'utf-8' });
  const 담긴 = JSON.parse(fs.readFileSync(DB2, 'utf-8')).users[0];
  ok('바꾸면 그 칸이 생긴다', typeof 담긴.pw_changed_at === 'string' && 담긴.pw_changed_at.length > 10, true);
  ok('  비밀번호도 바뀌었다', 담긴.password, '$2a$04$newnewnew');
} finally {
  try { fs.unlinkSync(DB2); } catch { /* 이미 없다 */ }
}

console.log(bad === 0 ? '\n모두 통과' : `\n${bad}건 FAIL`);
process.exit(bad === 0 ? 0 : 1);
