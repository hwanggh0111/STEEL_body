// 표가 **빠진** DB 파일을 들고도 도는가 (2026-10-22).
//
//   npm run tables     (npm run check 에도 들어 있다)
//
// ── 왜 ──
//
// 읽은 판에서 채우는 칸이 **하나뿐이었다**(`refreshTokens`). 그 한 줄이 이 문제를
// 이미 한 번 맞은 흔적인데, 나머지 표는 그대로 비어 있는 채 쓰였고 **담는 자리
// 대부분은 없는 표를 확인하지 않는다** —
//
//     data.workouts.push(workout);   // ← `workouts` 가 없으면 여기서 터진다
//
// 돌려보니 표가 빠진 파일로 운동 하나를 적을 때 **500** 이었다
// (`Cannot read properties of undefined (reading 'push')`).
//
// 표가 빠진 파일은 **실제로 쓰는 모양**이다 — 이 폴더의 검사 여럿이
// `{ users: [], _nextId: {} }` 로 씨를 심고, 사람이 손으로 고칠 수도 있고,
// 옛 판에서 올라온 Postgres 한 줄에는 뒤에 생긴 표가 아예 없다.
//
// 여기서 보는 것:
//   1. 표가 빠진 파일을 읽어도 **담는 자리가 안 터진다**
//   2. **있는 것은 건드리지 않는다** (빈 배열도 「있는 것」이다 — 지운 것을 되살리면 안 된다)
//   3. `_nextId` 의 빠진 칸도 채운다 (id 가 NaN 이 되면 그 줄을 다시 못 찾는다)
const path = require('path');
const os = require('os');
const fs = require('fs');

const TMP = path.join(os.tmpdir(), `check-tables-${process.pid}.json`);
process.env.DB_FILE = TMP;
process.env.JWT_SECRET = 'check-tables-' + 'x'.repeat(30);

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// **표가 거의 없는 파일.** 검사 여럿이 심는 그 모양이다
fs.writeFileSync(TMP, JSON.stringify({
  users: [{ id: 1, email: 'a@b.c', username: 'aaa', role: 'user' }],
  _nextId: { workouts: 1 },
}), 'utf-8');

const db = require('../src/db');
const TODAY = new Date().toISOString().slice(0, 10);

console.log('── 표가 빠져도 담을 수 있는가 ──');
const tries = [
  ['운동', () => db.createWorkout(1, TODAY, '벤치프레스', '60', 3, 10, null, null)],
  ['인바디', () => db.createInbody(1, TODAY, 175, 70, null, null, null, 22.9)],
  ['측정', () => db.createMeasure(1, 'bodySize', TODAY, { chest: 100 })],
  ['내 루틴', () => db.createMyRoutine(1, '가슴날', [{ name: '벤치프레스' }])],
  ['메모', () => db.createNote && db.createNote(1, { text: '메모' })],
  ['제보', () => db.createReport && db.createReport(1, { kind: 'bug', title: '제목', body: '본문', meta: {} })],
  ['알림 설정', () => db.saveReminder(1, { enabled: true })],
  ['보안 기록', () => db.addSecurityLog({ type: 'login_fail', detail: 'x' })],
  ['욕설 기록', () => db.addAbuseLog(1, { level: 'severe', hits: ['x'], where: 'report', text: 'x', action: '차단', days: 0 })],
  ['사진', () => db.savePhoto(1, 'profile', 'data:image/png;base64,iVBORw0KGgo=')],
];
for (const [label, run] of tries) {
  let threw = null;
  try { run(); } catch (err) { threw = err.message; }
  ok(`${label} — 안 터진다`, threw, null);
}

console.log('\n── 있는 것은 건드리지 않는가 ──');
// **빈 배열도 「있는 것」이다.** 지운 뒤 비어 있는 표를 기본값으로 되살리면
// 지운 것이 되살아난다 (알림 요일을 다 끈 사람에게 월·수·금을 입히면 안 되는 것과 같다)
ok('사람은 그대로 한 명', db.getAllUsers().length, 1);
ok('  방금 담은 운동이 한 줄', db.getWorkouts(1).length, 1);

console.log('\n── _nextId 의 빠진 칸도 채우는가 ──');
// 없으면 `nextId` 가 `undefined + 1` 로 NaN 을 주고, 그 줄은 **다시 찾을 수 없다**
const snap = db.snapshot();
const missing = Object.keys(snap._nextId).filter((k) => !Number.isInteger(snap._nextId[k]));
ok('셈이 전부 정수다', missing, []);
ok('  적어둔 셈은 그대로 쓴다 (workouts 는 1 로 시작했다)', db.getWorkouts(1)[0].id, 1);

db.flushNow();
setTimeout(() => {
  for (const f of [TMP, TMP.replace(/\.json$/, '') + '.photos.json']) {
    try { fs.unlinkSync(f); } catch (e) { /* 없으면 그만 */ }
  }
  console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
  process.exit(bad ? 1 : 0);
}, 700);
