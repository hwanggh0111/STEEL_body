// ── **기록 위생 · 번호 상한 · 배포 깃발** ── (2026-11-26 · 근호 점검 안전 5 · 6 · 9)
//
//   npm run hygiene   (backend/ · npm run check 에도 들어 있다)
//
// 근호가 11/25 밤에 남긴 안전 아홉 중 셋을 한 자에서 본다. 셋 다 **조용히 새는 자리**다 —
// 터지지도 않고, 사람이 눌러봐도 안 보이고, 나중에 드러난다.
//
//   ⑥ **로그에 친 그대로가 남았다** — 아이디 칸에 비밀번호를 치는 사람이 있다.
//      그 비밀번호가 보안 기록에 평문으로 남았다. 줄바꿈으로 **없는 로그 줄을 지어낼**
//      수도 있었다(기록이 한 줄 꼴이라)
//   ⑤ **인증번호 보내기에 메일별 상한이 없었다** — 주소당 분 3번뿐이라 주소를 바꿔가며
//      한 메일로 몇백 번 보낼 수 있었다. 게다가 다시 보내면 **맞춰본 횟수가 0 으로
//      돌아가서** 여섯 자리 번호의 맞춰보기 상한이 사실상 없었다
//   ⑨ **개발 기능 전부가 `NODE_ENV` 한 글자에 기댔다** — 배포에서 그 값이 빠지면 서버가
//      조용히 개발판이 된다(번호를 답에 싣고 · CORS 가 사설망을 받는다). 경고가 없었다
//
// 되돌려-FAIL: `--되돌려` 를 주면 셋을 **고치기 전 꼴**로 돌린다 → FAIL 이 보여야 한다
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'check-hygiene-secret-0123456789abcdef';
process.env.DB_FILE = path.join(os.tmpdir(), `check-hygiene-${process.pid}.json`);
fs.writeFileSync(process.env.DB_FILE, JSON.stringify({ users: [], _nextId: {} }), 'utf-8');
process.on('exit', () => { try { fs.unlinkSync(process.env.DB_FILE); } catch { /* 이미 없다 */ } });

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const AUTH = path.join(__dirname, '../src/routes/auth.js');
const INDEX = path.join(__dirname, '../src/index.js');
const 되돌림 = process.argv.includes('--되돌려');
let authPath = AUTH;
let indexSrc = fs.readFileSync(INDEX, 'utf-8');
if (되돌림) {
  const src = fs.readFileSync(AUTH, 'utf-8')
    // ⑥ 옛 꼴: 친 그대로 적는다
    .replace(/maskId\(email\)/g, 'email')
    // ⑤ 옛 꼴: 메일별 상한이 없다
    .replace('  db.recordLoginFail(codeKey, CODE_SEND.windowMs, CODE_SEND.maxPerEmail, CODE_SEND.lockMs);', '')
    .replace('  const codeLock = db.loginLockLeft(codeKey);', '  const codeLock = 0;');
  authPath = path.join(path.dirname(AUTH), '.auth.hygiene.revert.cjs');
  fs.writeFileSync(authPath, src);
  process.on('exit', () => { try { fs.unlinkSync(authPath); } catch { /* 이미 없다 */ } });
  // ⑨ 옛 꼴: 배포 깃발을 안 본다
  indexSrc = indexSrc.replace(/if \(process\.env\.RENDER && process\.env\.NODE_ENV !== 'production'\) \{/,
    'if (false) {');
  console.log('── 되돌려: 셋을 고치기 전 꼴로 — 아래에 FAIL 이 있어야 한다 ──');
}

const db = require('../src/db');
const { CODE_SEND } = require('../src/config/security');
const router = require(authPath);

const 손 = (p, method) => {
  const l = router.stack.find((x) => x.route && x.route.path === p && x.route.methods[method]);
  if (!l) { console.log(`FAIL 길(${method.toUpperCase()} ${p})을 못 찾았다`); process.exit(1); }
  return l.route.stack[l.route.stack.length - 1].handle;
};

// ══ ⑥ 기록 위생 ════════════════════════════════════════════════════════════
console.log('── ⑥ 로그에 친 그대로가 남지 않는다 ──');
const 적힌것 = [];
db.addSecurityLog = (e) => { 적힌것.push(e); };
db.findUserByEmail = () => null;
db.findUserByUsername = () => null;

const 로그인 = 손('/login', 'post');
async function 틀리게(typed) {
  적힌것.length = 0;
  const res = { status() { return this; }, json() { return this; } };
  await 로그인({ body: { email: typed, password: 'x' }, ip: '203.0.113.1', headers: {},
    connection: { remoteAddress: '203.0.113.1' } }, res, () => {});
  return 적힌것.map((e) => e.detail).join(' ');
}

(async () => {
  // 아이디 칸에 비밀번호를 친 사람
  const 적힘1 = await 틀리게('Tr0ub4dor&3');
  ok('★ 친 그대로 안 남는다 (아이디 칸에 비번을 친 사람)', /Tr0ub4dor&3/.test(적힘1), false);
  ok('  앞 두 글자는 남는다 (같은 사람이 되풀이하는지 보려면 필요하다)',
    /Tr\*/.test(적힘1), true);

  // 메일이면 도메인은 남긴다 (관리자가 가려볼 수 있게)
  const 적힘2 = await 틀리게('someone@example.com');
  ok('메일은 도메인을 남긴다', /@example\.com/.test(적힘2), true);
  ok('  앞부분은 덮는다', /someone@/.test(적힘2), false);

  // 줄바꿈으로 없는 줄을 지어낼 수 없다
  const 적힘3 = await 틀리게('a@b.c\n[2026-01-01] [login_ok] 관리자 로그인 성공');
  ok('★ 줄바꿈을 걷는다 (없는 로그 줄을 못 지어낸다)', /\n/.test(적힘3), false);
  ok('  지어낸 말이 통째로 안 실린다', /login_ok/.test(적힘3), false);

  // ══ ⑤ 번호 보내기 상한 ═════════════════════════════════════════════════
  console.log('\n── ⑤ 인증번호 보내기에 메일별 상한 ──');
  const 보내기 = 손('/send-code', 'post');
  db.cleanVerifyCodes = () => {};
  db.putVerifyCode = () => {};
  db.clearVerifyCode = () => {};
  async function 보낸다(email, ip) {
    let status = 200;
    const res = { status(c) { status = c; return this; }, json() { return this; } };
    await 보내기({ body: { email }, ip, headers: {}, connection: { remoteAddress: ip } }, res, () => {});
    return status;
  }
  const 결과 = [];
  // **주소를 매번 바꾼다** — 주소당 뚜껑으로는 못 막는다는 것이 이 버그의 핵이다
  for (let i = 0; i < CODE_SEND.maxPerEmail + 1; i++) {
    결과.push(await 보낸다('victim@example.com', `203.0.113.${10 + i}`));
  }
  ok(`★ 메일 하나에 ${CODE_SEND.maxPerEmail}번까지 (주소를 바꿔도 같이 센다)`,
    결과.slice(0, CODE_SEND.maxPerEmail), new Array(CODE_SEND.maxPerEmail).fill(200));
  ok('  그 다음은 429', 결과[CODE_SEND.maxPerEmail], 429);
  ok('다른 메일은 안 막힌다 (한 사람이 모두를 막을 수 없다)',
    await 보낸다('other@example.com', '203.0.113.99'), 200);
  // 대소문자 · 공백으로 피할 수 없다 (`emailKey` 를 지난다)
  ok('★ 대문자로 피할 수 없다', await 보낸다('VICTIM@example.com', '203.0.113.50'), 429);

  // ══ ⑨ 배포 깃발 ═══════════════════════════════════════════════════════
  console.log('\n── ⑨ 배포 환경에서 개발판으로 뜨지 않는다 ──');
  ok('★ `RENDER` 가 있는데 운영이 아니면 그 자리에서 막는다',
    /process\.env\.RENDER && process\.env\.NODE_ENV !== 'production'/.test(indexSrc), true);
  ok('  막는 방식이 「그냥 넘김」이 아니다 (안 뜬다)',
    /RENDER[\s\S]{0,600}?process\.exit\(1\)/.test(indexSrc), true);

  // 진짜로 안 뜨는지 **딴 프로세스**로 본다 (이 프로세스를 내릴 수는 없다)
  if (!되돌림) {
    let 떴나 = '안 뜸';
    try {
      execFileSync(process.execPath, ['src/index.js'], {
        cwd: path.join(__dirname, '..'),
        env: Object.assign({}, process.env, {
          RENDER: 'true', NODE_ENV: '', PORT: '4097', KEEP_WARM: '0',
        }),
        encoding: 'utf-8', timeout: 15000, stdio: 'pipe',
      });
      떴나 = '떴다';
    } catch (e) {
      떴나 = /NODE_ENV 가 production 이 아닙니다/.test(String(e.stderr || '') + String(e.stdout || ''))
        ? '안 뜸' : `딴 까닭: ${String(e.stderr || e.message).slice(0, 120)}`;
    }
    ok('★ 진짜로 안 뜬다 (까닭을 적고 내린다)', 떴나, '안 뜸');
  }

  console.log(bad === 0 ? '\n모두 통과' : `\n${bad}건 FAIL`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.log('FAIL 터졌다:', e.message); process.exit(1); });
