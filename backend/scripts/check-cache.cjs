// 조회 표(캐시)가 **맞는 것을 주는가, 그리고 남의 것까지 비우지 않는가** (2026-09-17).
//
//   npm run cache     (npm run check 에도 들어 있다)
//
// `db.js` 는 목록 조회를 5초 동안 표에 담아둔다. 표가 있는 자리에는 늘 두 가지 위험이 있다 —
//
//   1. **오래된 것을 준다.** 고치거나 지웠는데 표가 옛 것을 들고 있으면, 사람은
//      지운 기록이 되살아나는 것을 본다. 기록 앱에서 그것보다 나쁜 것은 없다
//   2. **너무 많이 비운다.** 예전에는 하나를 저장할 때마다 표를 통째로 비웠다.
//      그래서 **남이 세트 하나를 적으면 내 목록이 표에서 떨어져 나갔다** —
//      헬스장에서 여럿이 동시에 적는 시간대에 모두가 서로의 캐시를 계속 떨어뜨린다.
//
// 둘은 서로 당긴다. 덜 비우면 빠르지만 틀린 것을 줄 수 있다. 그래서 **둘 다** 본다.
// 눈으로는 확인할 수 없는 자리다 — 5초 안에 두 사람이 움직여야 한 번 보인다.
const path = require('path');
const fs = require('fs');

const TMP = path.join(__dirname, '..', '.cache-check.json');
process.env.DB_FILE = TMP;
process.env.JWT_SECRET = 'x'.repeat(40);
if (fs.existsSync(TMP)) fs.unlinkSync(TMP);

const db = require('../src/db');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const A = db.createUser('a@t.local', 'x', '가', 'aaaa').lastInsertRowid;
const B = db.createUser('b@t.local', 'x', '나', 'bbbb').lastInsertRowid;

console.log('── 표가 오래된 것을 주지 않는가 ──');
db.createWorkout(A, '2026-09-17', '벤치프레스', '80', 5, 8);
ok('저장하면 바로 보인다', db.getWorkouts(A).length, 1);

// 여기서 표가 채워진다. 아래 셋은 **표를 비우지 않으면 전부 틀린 답이 나온다**
const w = db.getWorkouts(A)[0];
db.createWorkout(A, '2026-09-17', '스쿼트', '100', 5, 5);
ok('하나 더 저장해도 바로 보인다', db.getWorkouts(A).length, 2);

db.updateWorkout(w.id, A, { weight: '90' });
ok('고치면 고친 값이 보인다', db.getWorkouts(A).find(r => r.id === w.id).weight, '90');

db.deleteWorkout(w.id, A);
ok('지우면 그 자리에서 사라진다', db.getWorkouts(A).length, 1);
// **지운 것이 되살아나면 안 된다** — 표가 남아 있으면 5초 동안 그렇게 보인다
ok('  지운 줄이 표에 안 남는다', db.getWorkouts(A).some(r => r.id === w.id), false);

db.createInbody(A, '2026-09-17', 175, 80, 18, 35, 40, 24);
ok('인바디도 바로 보인다', db.getInbody(A).length, 1);
const rec = db.getInbody(A)[0];
db.updateInbody(rec.id, A, { weight: 78 });
ok('  고치면 고친 값이 보인다', db.getInbody(A)[0].weight, 78);
db.deleteInbody(rec.id, A);
ok('  지우면 사라진다', db.getInbody(A).length, 0);

console.log('');
console.log('── 남의 것까지 비우지 않는가 ──');
//
// **이것이 2026-09-17 에 고친 것이다.** 표의 열쇠에는 이미 사람 번호가 들어 있는데
// 저장할 때마다 `clear()` 로 통째로 비우고 있었다. 사람 50명 · 기록 3만 건으로 재보면
//
//   아무도 안 썼을 때 내 목록   0.000 ms
//   남이 하나 저장한 뒤 내 목록  1.162 ms  → 고친 뒤 0.012 ms (97배)
//
// 값으로는 안 보이는 차이라(둘 다 맞는 답을 준다) **표에 남아 있는지**로 본다
db.createWorkout(A, '2026-09-16', '데드리프트', '120', 5, 3);
db.getWorkouts(A);                 // 내 것이 표에 담긴다
db.createWorkout(B, '2026-09-17', '랫풀다운', '50', 4, 12);  // 남이 저장한다
ok('남이 저장해도 내 것은 표에 남아 있다', db.cacheHas('w_' + A), true);
ok('  저장한 사람 것은 비워진다', db.cacheHas('w_' + B), false);
// 그래도 **답은 맞아야 한다** — 빠른 것보다 맞는 것이 먼저다
ok('  그래도 둘 다 제 것을 본다',
  [db.getWorkouts(A).length, db.getWorkouts(B).length], [2, 1]);

db.getInbody(A);
db.createInbody(B, '2026-09-17', 180, 75, 15, 33, 38, 23);
ok('인바디도 마찬가지다', db.cacheHas('i_' + A), true);
ok('  남의 인바디가 내 목록을 안 건드린다', db.getInbody(A).length, 0);

console.log('');
console.log('── 계정을 지우면 표에서도 사라지는가 ──');
//
// 여기는 **비어 있던 자리다.** 다른 자리는 저장할 때마다 비우니 눈에 안 띄었는데,
// 계정 삭제는 그 뒤로 아무 저장도 안 일어난다 — 없는 사람의 목록이 5초 동안 그대로 나왔다
db.getWorkouts(B);
ok('지우기 전에는 표에 있다', db.cacheHas('w_' + B), true);
db.deleteUserCompletely(B);
ok('  지우면 표에서도 빠진다', db.cacheHas('w_' + B), false);
ok('  없는 사람의 목록은 비어 있다', db.getWorkouts(B).length, 0);
// 남의 계정을 지웠다고 내 기록이 사라지면 안 된다
ok('  내 기록은 그대로다', db.getWorkouts(A).length, 2);

db.flushNow();
if (fs.existsSync(TMP)) fs.unlinkSync(TMP);
const photos = TMP.replace(/\.json$/, '') + '.photos.json';
if (fs.existsSync(photos)) fs.unlinkSync(photos);

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
