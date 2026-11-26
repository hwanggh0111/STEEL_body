// **알림이 바깥으로 몇 번 나갈 수 있나** (2026-11-26 · 정석, 전수검사 ① 의 같은 류)
//
//   node scripts/check-pushcap.cjs            (npm run check 가 찾아서 돈다)
//   node scripts/check-pushcap.cjs --되돌려    문을 떼어 보고 **빨개지는지** 본다
//
// ── 왜 생겼나 ──
//
// 알림을 보낼 때 서버가 **구독 줄마다 직접 POST** 한다(`utils/push.js` 의 `sendToUser`).
// 그런데 그 줄에 **상한이 없었다** —
//
//   · 구독은 기기마다 하나지만, 브라우저를 다시 깔거나 저장소를 비우면 **같은 기기가
//     새 주소**를 받는다. 즉 **사람이 가만히 있어도 는다**
//   · 「테스트 알림」은 누르면 그 자리에서 전부에게 보낸다. 전역 셈(분당 100)만으로는
//     **한 사람이 분당 100 × 기기 수**를 바깥으로 내보낼 수 있었다
//
// 11/26 전수검사 ① 에서 일곱 자리를 막았는데 **이 칸이 그 목록에 없었다** — 줄 수를
// 세는 자리가 아니라 **바깥으로 나가는 수**를 정하는 자리라서 눈에 덜 띄었다.
//
// ── 무엇을 보는가 ──
//
//   ⑴ 상한이 **`utils/rowCaps.js` 한 자리**에서 온다
//   ⑵ 가득 차면 **가장 오래 안 보인 줄을 밀어낸다** — 막지 않는다(새로 깐 기기가
//      알림을 못 받는 쪽이 더 나쁘다). 그래서 **마지막에 등록한 기기는 늘 산다**
//   ⑶ **남의 줄은 안 밀어낸다** — 내 칸이 찼다고 남의 기기를 지우면 안 된다
//   ⑷ 같은 주소를 다시 보내면 **줄이 안 는다** (앱을 열 때마다 보내는 길이다)
//   ⑸ 「테스트 알림」에 **전용 셈**이 있다 (`RATE_LIMITS.pushTest`)
const path = require('path');
const os = require('os');

const TMP = path.join(os.tmpdir(), `pushcap-${process.pid}.json`);
process.env.DB_FILE = TMP;
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
require('./_tmpdb.cjs')(TMP);

const 되돌림 = process.argv.includes('--되돌려');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const fs = require('fs');
const db = require('../src/db');
const { capOf } = require('../src/utils/rowCaps');
const HASH = '$2a$10$abcdefghijklmnopqrstuv';
const CAP = capOf('pushSubs');

// ── 되돌려: 밀어내는 묶음을 뗀 판을 지어 돌린다 ──
//
// 꼴을 세는 것이 아니라 **문이 없는 db 를 진짜로 돌려** 줄이 무한히 느는지 본다
function dbOf() {
  if (!되돌림) return db;
  const full = path.join(__dirname, '../src/db.js');
  const src = fs.readFileSync(full, 'utf-8');
  const 시작 = src.indexOf("    // 내 줄이 가득 찼으면 **가장 오래 안 보인 것부터** 밀어낸다");
  const 끝 = src.indexOf('    const record = {', 시작);
  if (시작 < 0 || 끝 < 0) throw new Error('뗄 문을 못 찾았다');
  const 흉내 = path.join(__dirname, '..', 'src', `.pushcap-${process.pid}.js`);
  fs.writeFileSync(흉내, src.slice(0, 시작) + src.slice(끝), 'utf-8');
  process.on('exit', () => { try { fs.unlinkSync(흉내); } catch { /* 없어도 된다 */ } });
  return require(흉내);
}

const 기기 = (n) => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/dev-' + n, keys: { p256dh: 'a', auth: 'b' } });

try {
  const D = dbOf();
  console.log('── ⑴ 상한이 한 자리에서 온다 ──');
  const dbSrc = fs.readFileSync(path.join(__dirname, '../src/db.js'), 'utf-8');
  ok('`capOf(\'pushSubs\')` 로 든다 (생글자가 아니다)', /capOf\('pushSubs'\)/.test(dbSrc), true);
  ok('  표에 그 칸이 있다', Number.isInteger(CAP) && CAP > 0, true);

  console.log('');
  console.log('── ⑵ 가득 차면 가장 오래 안 보인 줄을 밀어낸다 ──');
  const 나 = D.createUser('me@pc.local', HASH, '나', 'pcme0001').lastInsertRowid;
  // 상한보다 다섯 더 등록한다. 보인 시각을 갈라 **차례를 분명히** 해 둔다
  for (let i = 1; i <= CAP + 5; i += 1) {
    D.savePushSub(나, 기기(i));
    const mine = D.getPushSubs(나);
    const last = mine[mine.length - 1];
    if (last) last.seen_at = new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString();
  }
  const 남은것 = D.getPushSubs(나);
  ok('★ 줄이 상한에서 선다', 남은것.length, CAP);
  ok('  **마지막에 등록한 기기가 산다** (새로 깐 기기가 알림을 받는다)',
    남은것.some(s => s.endpoint.endsWith('-' + (CAP + 5))), true);
  ok('  가장 오래 안 보인 것(1번)은 밀려났다',
    남은것.some(s => s.endpoint.endsWith('-1')), false);

  console.log('');
  console.log('── ⑶ 남의 줄은 안 밀어낸다 ──');
  const 남 = D.createUser('other@pc.local', HASH, '남', 'pcot0001').lastInsertRowid;
  D.savePushSub(남, 기기('other-1'));
  for (let i = 1; i <= CAP + 3; i += 1) D.savePushSub(나, 기기('again-' + i));
  ok('남의 기기가 그대로 있다', D.getPushSubs(남).length, 1);
  ok('  내 줄은 여전히 상한이다', D.getPushSubs(나).length, CAP);

  console.log('');
  console.log('── ⑷ 같은 주소를 다시 보내면 줄이 안 는다 ──');
  const 전 = D.getPushSubs(나).length;
  const 그주소 = D.getPushSubs(나)[0].endpoint;
  D.savePushSub(나, { endpoint: 그주소, keys: { p256dh: 'c', auth: 'd' } });
  ok('줄 수가 같다 (앱을 열 때마다 보내는 길이다)', D.getPushSubs(나).length, 전);
  ok('  열쇠는 새것으로 바뀐다', D.getPushSubs(나).find(s => s.endpoint === 그주소)?.keys?.p256dh, 'c');

  console.log('');
  console.log('── ⑸ 「테스트 알림」에 전용 셈이 있다 ──');
  const { RATE_LIMITS } = require('../src/config/security');
  ok('`pushTest` 가 적혀 있다', !!RATE_LIMITS.pushTest, true);
  ok('  전역 셈(분당 100)보다 좁다',
    RATE_LIMITS.pushTest && RATE_LIMITS.pushTest.max < 100, true);
  const idx = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf-8');
  ok('그 길에 걸려 있다 (`/api/reminders/test`)',
    /app\.use\('\/api\/reminders\/test'[\s\S]{0,200}RATE_LIMITS\.pushTest/.test(idx), true);
  // 설정을 읽고 쓰는 길은 **막지 않는다** — 그쪽은 알림을 보내지 않는다
  ok('  설정 길 자체에는 안 걸었다',
    /app\.use\('\/api\/reminders',\s*rateLimit/.test(idx), false);

  console.log('');
  if (되돌림) {
    if (bad > 0) { console.log('되돌려: FAIL ' + bad + '건 — 자가 그 자리를 잡는다'); process.exit(0); }
    console.log('★ 되돌려인데 다 통과했다 — **이 자는 그 자리를 못 본다**');
    process.exit(1);
  }
  if (bad > 0) { console.log(bad + '건 FAIL'); process.exit(1); }
  console.log('모두 통과');
  process.exit(0);
} catch (err) {
  console.error('터짐:', err);
  process.exit(1);
}
