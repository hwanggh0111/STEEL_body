// **정지가 맞게 걸리고, 맞게 풀리는가** (2026-09-19).
//
//   npm run abuse     (npm run check 에도 들어 있다)
//
// 여기는 검사가 **한 곳도 없던 자리**다. 사람을 못 쓰게 만드는 일인데 그렇다.
// 9/19 에 훑다가 심각한 것 하나가 나왔다 —
//
// **욕설 오탐 하나를 풀면 그 사람의 해킹 차단까지 같이 풀렸다.**
// 정지는 한 표(`suspensions`)에 모여 있다. AI 가드가 해킹 시도로 거는 것(level 3·4,
// 영구 포함)과 욕설로 거는 것(level 3, reason `abuse`)이 같은 표다. 관리자가
// 「사전이 틀렸음」 을 누르면 `clearSuspensions` 가 **그 사람의 정지를 통째로** 지웠다.
// 관리자가 하려던 일은 사전을 고치는 것이고, 차단을 푸는 것이 아니다.
//
// 두 번째로, 통째로 푸는 것은 **남은 진짜 기록까지 없던 일로 만들었다** — 세 번 걸려
// 3일 정지인 사람에서 한 번이 오탐이었다면 맞는 벌은 1일이다. 0일이 아니다.
//
// 이 검사는 값으로 본다. 진짜 DB 를 안 건드린다 (`DB_FILE` 로 임시 파일을 쓴다).
const path = require('path');
const fs = require('fs');

const TMP = path.join(__dirname, '..', '.abuse-check.json');
process.env.DB_FILE = TMP;
process.env.JWT_SECRET = 'x'.repeat(40);
const clean = () => {
  for (const f of fs.readdirSync(path.join(__dirname, '..'))) {
    if (f.startsWith('.abuse-check')) {
      try { fs.unlinkSync(path.join(__dirname, '..', f)); } catch { /* 없으면 그만 */ }
    }
  }
};
clean();

const db = require('../src/db');
const { daysFor, recomputeDays, MAX_DAYS } = require('../src/utils/abusePolicy');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

console.log('── 사다리 ──');
// 1회는 막기만 하고 정지는 없다. 화난 사람을 처음부터 정지시키지 않는다
ok('욕설 1회 — 정지 없음', daysFor(1), 0);
ok('2회 — 1일', daysFor(2), 1);
ok('3회 — 3일', daysFor(3), 3);
ok('4회 — 7일', daysFor(4), 7);
ok('스무 번을 해도 7일에서 멈춘다', daysFor(20), MAX_DAYS);
ok('  기록이 없으면 0일', daysFor(0), 0);

console.log('');
console.log('── 남은 기록으로 다시 계산하는가 ──');
const L = (level, dismissed = false) => ({ level, dismissed });
ok('욕설 셋 — 3일', recomputeDays([L('severe'), L('severe'), L('severe')]), 3);
ok('  그중 하나가 오탐이면 1일 (0일이 아니다)',
  recomputeDays([L('severe'), L('severe'), L('severe', true)]), 1);
ok('  둘이 오탐이면 0일', recomputeDays([L('severe'), L('severe', true), L('severe', true)]), 0);
// 짜증은 막지도 않고 세지도 않는다 — 그걸 세면 두 번 짜증 낸 사람이 다음에 3일 정지다
ok('짜증(mild)은 안 센다', recomputeDays([L('mild'), L('mild'), L('severe')]), 0);
// 비하는 사다리를 안 탄다. 하나라도 남아 있으면 7일이다
ok('비하가 남아 있으면 7일', recomputeDays([L('hate'), L('severe', true)]), MAX_DAYS);
ok('  비하가 오탐이면 사다리로 돌아간다', recomputeDays([L('hate', true), L('severe'), L('severe')]), 1);

console.log('');
console.log('── 오탐을 풀 때 해킹 차단은 그대로인가 ── (9/19 에 찾은 자리)');
const uid = db.createUser('a@t.local', 'x', '가', 'aaaa').lastInsertRowid;
const day = (n) => new Date(Date.now() + n * 86400000).toISOString();
// AI 가드가 거는 것 둘 (해킹 시도) — level 4 는 영구다
db.createSuspension(uid, 4, 'sql-injection', '해킹 시도', 'permanent');
db.createSuspension(uid, 3, 'xss-attempt', '해킹 시도', day(3));
// 욕설로 거는 것 (reason 이 abuse · abuse-hate 다)
db.createSuspension(uid, 3, 'abuse', '욕설 2회', day(1));
ok('정지 셋이 걸려 있다', db.getSuspensions().length, 3);

const removed = db.clearAbuseSuspensions(uid);
ok('욕설로 걸린 것만 풀린다', removed.changes, 1);
ok('  해킹 차단 둘은 그대로다',
  db.getSuspensions().map((s) => s.reason).sort(), ['sql-injection', 'xss-attempt']);
ok('  영구 정지가 남아 있다', db.getSuspensions().some((s) => s.expires_at === 'permanent'), true);
// 다시 걸어야 하는지 계산하려면 **처음 걸린 때**를 알아야 한다 — 지금부터 세면 벌이 늘어난다
ok('  처음 걸린 때를 같이 돌려준다', typeof removed.earliest, 'string');

// 통째로 푸는 길은 남겨 두지만, 그것을 욕설 되돌리기에 쓰면 안 된다
db.clearSuspensions(uid);
ok('통째로 푸는 길은 따로 있다 (여기서는 안 쓴다)', db.getSuspensions().length, 0);

console.log('');
console.log('── 제보 관리가 그 길을 쓰는가 ──');
const reports = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'reports.js'), 'utf-8');
ok('오탐 처리에 clearAbuseSuspensions 를 쓴다', /clearAbuseSuspensions\(userId\)/.test(reports), true);
ok('  통째로 푸는 것을 안 쓴다', /clearSuspensions\(result\.log\.user_id\)/.test(reports), false);
ok('  남은 누적으로 다시 계산한다', /recomputeDays\(db\.abuseLogsOf\(userId\)\)/.test(reports), true);
ok('  다시 걸 때는 처음 걸린 때부터 센다', /Date\.parse\(removed\.earliest\)/.test(reports), true);

console.log('');
console.log('── 누적을 세는 규칙이 한 벌인가 ──');
// `db.countAbuse` 와 `recomputeDays` 가 다른 규칙을 쓰면, 거는 벌과 되돌리는 벌이 갈린다
const u2 = db.createUser('b@t.local', 'x', '나', 'bbbb').lastInsertRowid;
db.addAbuseLog(u2, { level: 'mild', hits: ['짜증'], where: 'report', text: 'x', action: '기록만', days: 0 });
db.addAbuseLog(u2, { level: 'severe', hits: ['욕'], where: 'report', text: 'x', action: '차단', days: 0 });
db.addAbuseLog(u2, { level: 'severe', hits: ['욕'], where: 'report', text: 'x', action: '1일', days: 1 });
ok('countAbuse 는 짜증을 안 센다', db.countAbuse(u2), 2);
ok('  다시 계산도 같은 수를 센다', recomputeDays(db.abuseLogsOf(u2)), daysFor(db.countAbuse(u2)));

db.flushNow();
clean();
console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
