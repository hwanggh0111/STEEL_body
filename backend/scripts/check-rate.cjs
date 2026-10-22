// 속도 제한은 **사람별**인가 (2026-10-22).
//
//   npm run rate      (npm run check 에도 들어 있다)
//
// 이 앱은 **헬스장에서 쓰는 앱**이다. 회원 여럿이 같은 와이파이에 붙어 있고, 통신사
// 데이터도 NAT 로 묶여 수백 명이 한 주소로 보인다. 그런데 막는 셈이 전부 **주소별**
// 이었다 — 전역 제한 분당 100(express-rate-limit 의 기본 열쇠가 `req.ip` 다)과
// aiGuard 의 사다리 200/300/500(넘으면 **1시간 · 하루 · 이레** 잠근다).
//
// 한 사람이 운동을 몰아 적으면 분당 수십 건이다(세트 하나가 요청 하나다). 네댓 명이면
// 100 을 넘고, 대여섯이면 200 을 넘는다. 그 순간 **그 와이파이 전체**가 막힌다 —
// 공격이 아니라 영업 시간에.
//
// **눈으로 못 보는 자리다.** 내 폰 하나로는 평생 안 걸리고, 걸리는 날은 헬스장에
// 사람이 몰린 날이다. 그래서 요청을 수백 번 **돌려서** 본다.
//
// 지키려는 것 셋:
//   1. 한 주소 뒤의 **두 사람이 서로를 밀어내지 않는다**
//   2. 로그인한 사람이 넘치면 **그 계정만** 429 를 받는다 (주소는 잠기지 않는다)
//   3. 로그인 안 한 요청은 여태처럼 **주소별로** 센다 (훑고 다니는 것을 막는 길)
const path = require('path');
const fs = require('fs');

const TMP = path.join(__dirname, '..', '.rate-check.json');
process.env.DB_FILE = TMP;
process.env.JWT_SECRET = 'rate-check-' + 'x'.repeat(40);
process.env.NODE_ENV = 'test';

// 관리자가 제 주소 잠금에 갇히지 않는지 보려면 **관리자 계정이 하나** 있어야 한다
// (aiGuard 가 토큰의 주인을 DB 에서 찾아 역할을 본다)
const ADMIN_ID = 999;
fs.writeFileSync(TMP, JSON.stringify({
  users: [{ id: ADMIN_ID, email: 'admin@check', role: 'admin' }],
  _nextId: {},
}), 'utf-8');

const jwt = require('jsonwebtoken');
const aiGuard = require('../src/middleware/aiGuard');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const token = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { algorithm: 'HS256' });

// 와이파이 하나 뒤의 요청 한 번. `who` 가 null 이면 로그인 안 한 사람.
// `ua` 는 봇 판정을 보는 자리에서 쓴다 (2026-10-22)
function hit(ip, who, path2 = '/api/workouts', ua = 'Mozilla/5.0 (iPhone)') {
  const req = {
    ip,
    path: path2,
    method: 'GET',
    body: {},
    query: {},
    params: {},
    cookies: who ? { sb_access: token(who) } : {},
    headers: {},
    get: () => ua,
  };
  let status = 200;
  const res = {
    status(c) { status = c; return res; },
    json() { return res; },
    set() { return res; },
    on() { return res; },            // 404 를 세려고 `finish` 를 듣는다
    statusCode: 200,
  };
  let passed = false;
  aiGuard(req, res, () => { passed = true; });
  return { status, passed, rateKey: req.rateKey };
}

const IP = '203.0.113.77';          // 헬스장 와이파이 한 대

console.log('── 1. 열쇠는 사람이다 ──');
ok('로그인한 요청은 계정 열쇠', hit(IP, 501).rateKey, 'u:501');
ok('로그인 안 한 요청은 열쇠 없음 (주소로 센다)', hit(IP, null).rateKey, null);

console.log('\n── 2. 한 주소 뒤의 두 사람 ──');
// 한 사람이 계정 몫(분당 200)을 통째로 쓴다
let firstBlockedAt = 0;
for (let i = 0; i < 260; i++) {
  const r = hit(IP, 501);
  if (r.status === 429 && !firstBlockedAt) firstBlockedAt = i + 1;
}
ok('넘치면 그 계정은 429 를 받는다', firstBlockedAt > 0, true);
ok('  200회 근처에서 걸린다', firstBlockedAt >= 195 && firstBlockedAt <= 205, true);
// **옆 사람은 아무 일도 없다** — 고치기 전에는 이 주소가 1시간 잠겨 있었다
const 옆사람 = hit(IP, 502);
ok('같은 와이파이의 옆 사람은 그대로 지나간다', 옆사람.passed, true);
ok('  403 이 아니다 (주소가 잠기지 않았다)', 옆사람.status, 200);
ok('그 주소가 잠긴 목록에 없다', aiGuard.getSuspiciousIPs().includes(IP), false);

console.log('\n── 3. 로그인 안 한 요청은 주소로 센다 ──');
const 낯선주소 = '198.51.100.9';
let anonBlocked = 0;
for (let i = 0; i < 260; i++) {
  const r = hit(낯선주소, null);
  if (r.status === 403 && !anonBlocked) anonBlocked = i + 1;
}
ok('넘치면 그 주소를 잠근다', anonBlocked > 0, true);
ok('  잠긴 목록에 들어간다', aiGuard.getSuspiciousIPs().includes(낯선주소), true);

console.log('\n── 3-2. 봇 판정이 그 주소를 잠그지 않는가 ── (2026-10-22)');
// UA 하나로 **72시간** 잠그고 있었다. UA 는 증거가 아니라 힌트고(꾸며내기가 한 줄이다)
// 실수로 걸리기가 너무 쉽다 — 운영에 curl 로 읽기 한 번 했다가 집 주소가 사흘 잠겼다.
// 한 주소 뒤에는 여럿이 있다 (2·3 에서 고친 그 자리와 같은 결이다)
{
  const 봇주소 = '198.51.100.77';
  const r = hit(봇주소, null, '/api/workouts', 'curl/8.0');
  ok('자동화된 접근은 그 요청을 막는다', r.status, 403);
  ok('  **주소는 잠그지 않는다**', aiGuard.getSuspiciousIPs().includes(봇주소), false);
  ok('  옆 사람은 그대로 지나간다', hit(봇주소, 601).passed, true);
  // 모니터링은 여태처럼 지나간다 (Render 가 데우려고 두드린다)
  ok('  Render 헬스체크는 봇이 아니다', hit(봇주소, null, '/api/workouts', 'Render/1.0 HealthCheck').status, 200);
}

console.log('\n── 3-3. 관리자가 제 주소 잠금에 갇히지 않는가 ──');
// 주소 잠금은 **토큰을 보기 전에** 걸러진다. 그래서 관리자가 한 번 걸리면 푸는 길
// (`POST /security/ai-unblock`)에도 닿지 못한다 — 「자기 정지를 자기가 못 풀어서
// 서비스가 잠긴다」와 같은 자리인데, 그 규칙이 주소 잠금에는 없었다
{
  const 잠긴주소 = '198.51.100.78';
  aiGuard.manualBlock(잠긴주소, 60);
  ok('잠긴 주소에서 보통 사람은 막힌다', hit(잠긴주소, 601).status, 403);
  ok('  로그인 안 한 사람도 막힌다', hit(잠긴주소, null).status, 403);
  ok('  **관리자는 지나간다**', hit(잠긴주소, ADMIN_ID).passed, true);
  ok('  두 번째 검사(속도 사다리 뒤)도 지나간다', hit(잠긴주소, ADMIN_ID).status, 200);
}

console.log('\n── 4. 로그인 자리도 주소로 묶이지 않는가 ──');
{
  // 전역 로그인 제한은 **들어온 로그인까지** 센다(주소별). 실제로 두들기는 것을 막는
  // 것은 `LOGIN_LOCK` 이고 그쪽은 **틀린 시도만** 센다. 거친 뚜껑이 먼저 닫히면
  // 공격자가 아니라 회원이 걸린다 — 한 와이파이에 스무 명이면 스물한 번째가 못 들어온다
  const { RATE_LIMITS, LOGIN_LOCK } = require('../src/config/security');
  ok('틀린 시도 잠금이 먼저 닫힌다', RATE_LIMITS.login.max > LOGIN_LOCK.maxPerIp, true);
  ok('  창의 길이가 같다 (견줄 수 있게)', RATE_LIMITS.login.windowMs, LOGIN_LOCK.windowMs);
}

console.log('\n── 5. 화면에 적히는 말이 숫자와 같은가 ──');
const rate = aiGuard.policy().find((p) => p.title === '너무 잦은 요청');
ok('계정 몫이 적혀 있다', rate.detail.includes(String(aiGuard.THRESHOLDS.ACCOUNT_RATE_PER_MIN)), true);
ok('주소 몫도 적혀 있다', rate.detail.includes('주소'), true);

for (const f of [TMP, TMP.replace(/\.json$/, '') + '.photos.json']) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}
console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
