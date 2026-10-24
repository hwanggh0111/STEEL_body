// **정지된 사람이 까닭을 듣는가** (2026-10-24).
//
//   npm run blocked     (npm run check 에도 들어 있다)
//
// ── 왜 ──
//
// 자동 판정은 사람을 3일(`INPUT_SUSPEND_DAYS`) · 7일(욕설 누적)까지 멈출 수 있다.
// 서버는 그때 403 에 할 말을 다 적어 보낸다 — 까닭(`reason`)과 기한(`expiresAt`).
//
// **그런데 그 403 을 읽는 자리가 앱에 한 곳도 없었다**(`frontend/src/api/client.js`
// 는 401 만 다뤘다). 정지된 사람이 본 것은 이것이다 —
//
//     앱이 뜬다 → `/auth/me` 403 → `checkAuth` 가 로그아웃 꼴로 만든다 → 로그인 화면
//     로그인한다 (로그인은 정지를 안 본다. 일부러 그렇다) → 또 403 → 또 로그인 화면
//
// 까닭도 기한도 한 번 못 듣고 **되돌아오는 로그인 화면**만 본다. 오판으로 걸린
// 사람도 똑같다 — 10/22 에 「오후 3시 발목」을 욕으로 보던 사전과 같은 자리다.
//
// **눈으로 볼 수 없다** — 보려면 진짜 사람을 3일 정지시키고 그 계정으로 들어와야 한다.
// 그래서 값으로 본다: 403 에 **까닭 코드**가 붙는가 · 기한이 오는가 · 관리자는
// 걸리지 않는가 · 기한이 지난 정지는 통과하는가.
const path = require('path');
const os = require('os');
const fs = require('fs');

const TMP = path.join(os.tmpdir(), `check-blocked-${process.pid}.json`);
process.env.DB_FILE = TMP;
process.env.JWT_SECRET = 'check-blocked-' + 'x'.repeat(30);
process.env.NODE_ENV = 'test';

const DAY = 24 * 60 * 60 * 1000;
const future = new Date(Date.now() + 3 * DAY).toISOString();
const past = new Date(Date.now() - 1 * DAY).toISOString();

fs.writeFileSync(TMP, JSON.stringify({
  users: [
    { id: 1, email: 'plain@x.test', username: 'plain', role: 'user' },
    { id: 2, email: 'susp@x.test', username: 'susp', role: 'user' },
    { id: 3, email: 'banned@x.test', username: 'banned', role: 'user', is_banned: true },
    { id: 4, email: 'blocked@x.test', username: 'blocked', role: 'blocked' },
    { id: 5, email: 'boss@x.test', username: 'boss', role: 'admin' },
    { id: 6, email: 'over@x.test', username: 'over', role: 'user' },
    { id: 7, email: 'bye@x.test', username: 'bye', role: 'user', deleting_at: new Date().toISOString() },
  ],
  suspensions: [
    { id: 1, user_id: 2, level: 3, reason: 'abuse', ai_reason: '욕설이 쌓여 3일 멈춤', expires_at: future, created_at: past },
    // 관리자도 걸어 본다 — **걸려서는 안 된다**(자기 정지를 자기가 못 푼다)
    { id: 2, user_id: 5, level: 3, reason: 'abuse', ai_reason: '관리자도 걸어 본다', expires_at: future, created_at: past },
    // 기한이 지난 정지. 이것으로 막으면 7일이 지나도 못 들어온다
    { id: 3, user_id: 6, level: 3, reason: 'abuse', ai_reason: '지난 정지', expires_at: past, created_at: past },
  ],
  _nextId: {},
}), 'utf-8');

const jwt = require('jsonwebtoken');
const auth = require('../src/middleware/auth');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

/** 그 사람의 토큰으로 보호된 길을 한 번 두드려 본다. 돌아온 것을 그대로 준다. */
function knock(userId, role = 'user') {
  const token = jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: '15m', algorithm: 'HS256' });
  const req = { cookies: { sb_access: token }, headers: {}, ip: '203.0.113.9' };
  const out = { status: 200, body: null, passed: false };
  const res = {
    status(code) { out.status = code; return res; },
    json(body) { out.body = body; return res; },
  };
  auth(req, res, () => { out.passed = true; });
  return out;
}

console.log('── 막히지 않은 사람 ──');
ok('그냥 지나간다', knock(1).passed, true);
ok('기한이 지난 정지는 막지 않는다 (7일이 지나면 돌아온다)', knock(6).passed, true);
ok('관리자는 정지에 걸리지 않는다 (자기 정지를 자기가 못 푼다)', knock(5, 'admin').passed, true);

console.log('');
console.log('── 막힌 사람에게 **까닭 코드**가 간다 ──');
// 글자(`error`)로 가려내면 안내문을 다듬는 날 조용히 안 걸린다. 그래서 코드를 본다
const susp = knock(2);
ok('정지 → 403', susp.status, 403);
ok('  code 가 suspended 다', susp.body?.code, 'suspended');
ok('  **언제 풀리나**를 같이 준다', susp.body?.expiresAt, future);
ok('  까닭도 준다', susp.body?.reason, '욕설이 쌓여 3일 멈춤');
ok('  등급도 준다', susp.body?.level, 3);

const banned = knock(3);
ok('영구 정지 → 403 · banned', [banned.status, banned.body?.code], [403, 'banned']);
ok('  기한은 없다 (영구다)', banned.body?.expiresAt, undefined);
ok('  기록은 그대로라고 말한다', /기록은 그대로/.test(banned.body?.message || ''), true);

const blocked = knock(4);
ok('차단 → 403 · blocked', [blocked.status, blocked.body?.code], [403, 'blocked']);

const bye = knock(7);
ok('삭제 예약 → 401 · deleting (이건 다시 로그인하면 되살아난다)',
  [bye.status, bye.body?.code], [401, 'deleting']);

console.log('');
console.log('── 화면이 그것을 읽는가 ──');
//
// 서버가 적어 보내도 **읽는 자리가 없으면 아무 일도 없다** — 그것이 이 버그였다.
const read = (f) => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf-8');
const client = read('frontend/src/api/client.js');
const app = read('frontend/src/App.jsx');
ok('api 응답에서 막힌 403 을 읽는다', /blockOf\(err\)/.test(client), true);
ok('  받아 두는 자리가 있다', /useBlockStore/.test(client), true);
ok('앱이 그 화면을 덮어 그린다', /<AccountBlocked \/>/.test(app), true);

// 까닭 코드는 **두 곳이 같은 글자를 써야 한다** — 한쪽만 고치면 조용히 안 걸린다
const front = read('frontend/src/data/accountBlock.js');
for (const code of ['suspended', 'banned', 'blocked']) {
  ok(`  '${code}' 를 화면 쪽도 안다`, new RegExp(`\\b${code}:`).test(front), true);
}

console.log('');
console.log('── **막아둔 길을 가리키지 않는가** ── (2026-10-24)');
//
// 정지된 사람은 **제보를 보낼 수 없다**(`POST /reports` 도 `auth` 를 지난다 → 403).
// 그런데 정지 사유에 「관리자에게 알려주세요」라고 적어 보내고 있었다 — 그 글은
// 정지 안내 화면에 **그대로 뜬다.** 할 수 없는 일을 하라고 적는 셈이다.
// 고객센터 답변은 처음부터 「**풀린 뒤에** 알려주세요」였다 — 그 말과 같아야 한다.
const abuse = read('backend/src/utils/abusePolicy.js');
const guard = read('backend/src/middleware/aiGuard.js');
ok('정지 사유는 「풀린 뒤에」라고 적는다', /\*\*풀린 뒤에\*\* 고객센터 제보함으로/.test(abuse), true);
ok('  지금 제보하라고 하지 않는다', /생각되면 관리자에게 알려주세요/.test(abuse), false);
// 영구 정지에는 「풀린 뒤」가 없다 — 남는 길은 앱 밖의 연락처뿐이고 화면이 그것을 붙인다
// **영구 정지 글만** 본다 — 같은 파일의 3일 정지 글은 「풀린 뒤에 제보함으로」가
// 맞는 말이다(기간이 있으니까). 가려서 봐야 한다
const l4 = (guard.match(/const L4_NOTE = '[^']*'/) || [''])[0];
ok('영구 정지 글은 제보함을 가리키지 않는다', /제보함/.test(l4), false);
ok('  그래도 되돌릴 수 있다고 말한다', /되돌립니다/.test(l4), true);
// 기간이 있는 정지는 **풀린 뒤에** 라고 말할 수 있다
ok('  3일 정지 글은 「풀린 뒤에」라고 적는다', /\*\*풀린 뒤에\*\* 고객센터 제보함으로/.test(guard), true);
ok('  화면이 닿을 수 있는 주소를 붙인다',
  /SUPPORT_EMAIL/.test(read('frontend/src/components/AccountBlocked.jsx')), true);
// 주소는 **한 곳**에 있다 (방침과 정지 안내가 같은 것을 쓴다)
ok('  그 주소는 한 곳에서 온다',
  /SUPPORT_EMAIL/.test(read('frontend/src/pages/PrivacyPage.jsx'))
  && /@/.test(read('frontend/src/data/contact.js')), true);
ok('    서버에는 그 주소를 안 적는다', /withpapa/.test(abuse + guard), false);

try { fs.unlinkSync(TMP); } catch { /* 지워져 있으면 그만 */ }

console.log('');
console.log(bad === 0 ? '모두 통과' : bad + '건 FAIL');
process.exit(bad === 0 ? 0 : 1);
