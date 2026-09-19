// **저장하다 죽어도 기록이 남는가**, 그리고 **사람별 색인이 맞는 것을 주는가** (2026-09-19).
//
//   npm run save      (npm run check 에도 들어 있다)
//
// 9/18~19 에 `db.js` 의 저장 길을 둘로 바꿨다 —
//
//   1. **원자적 쓰기.** 여태 파일을 제자리에 덮어썼다. 그 사이에 죽으면(Render 는 메모리를
//      넘기면 바로 죽인다) **파일이 잘린 채 남고**, 다음에 뜰 때 `JSON.parse` 가 터지고,
//      `load()` 는 그것을 기본값으로 되돌린다 — **기록 전부가 사라진다는 뜻이다.**
//      이제 딴 이름으로 다 쓴 뒤 `rename` 으로 갈아끼운다
//   2. **사람별 색인.** 목록을 받을 때마다 모든 사람의 모든 줄을 훑던 것을, 내 줄만 모아
//      들고 있게 했다. 표(5초)와 달리 **저절로 낡지 않는다** — 줄이 생기거나 사라진 것을
//      놓치면 지운 기록이 계속 보인다
//
// 둘 다 **눈으로는 확인할 수 없는 자리다.** 1번은 하필 쓰는 중에 죽어야 보이고,
// 2번은 틀려도 화면은 멀쩡해 보인다 (지난 것을 보여줄 뿐이다).
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TMP = path.join(ROOT, '.save-check.json');
const DB_SRC = require.resolve('../src/db');
const clean = () => {
  for (const f of fs.readdirSync(ROOT)) {
    if (f.startsWith('.save-check')) {
      try { fs.unlinkSync(path.join(ROOT, f)); } catch { /* 없으면 그만 */ }
    }
  }
};
process.env.DB_FILE = TMP;
process.env.JWT_SECRET = 'x'.repeat(40);
clean();

const db = require('../src/db');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

/**
 * 딴 프로세스에서 그 파일을 DB 로 읽게 한다.
 *
 * `db.js` 는 한 번 읽은 것을 메모리에 들고 있어서, **이 프로세스에서는 파일이 깨진 것을
 * 겪을 수 없다.** 다시 뜨는 자리를 보려면 프로세스를 새로 띄우는 수밖에 없다.
 */
const inFreshProcess = (file, expr) => {
  const code = 'const d=require(' + JSON.stringify(DB_SRC) + ');console.log(' + expr + ')';
  const out = execFileSync(process.execPath, ['-e', code], {
    env: { ...process.env, DB_FILE: file, JWT_SECRET: 'x'.repeat(40) },
    encoding: 'utf-8',
  });
  return out.trim().split('\n').pop();
};

const A = db.createUser('a@t.local', 'x', '가', 'aaaa').lastInsertRowid;
const B = db.createUser('b@t.local', 'x', '나', 'bbbb').lastInsertRowid;

console.log('── 사람별 색인이 맞는 것을 주는가 ──');
db.createWorkout(A, '2026-09-17', '벤치프레스', '80', 5, 8);
db.createWorkout(A, '2026-09-19', '스쿼트', '100', 5, 5);
db.createWorkout(B, '2026-09-18', '데드리프트', '140', 3, 5);
ok('내 줄만 온다', db.getWorkouts(A).map((w) => w.exercise), ['스쿼트', '벤치프레스']);
ok('  남의 줄은 안 섞인다', db.getWorkouts(B).map((w) => w.exercise), ['데드리프트']);
ok('  최신이 앞이다', db.getWorkouts(A)[0].date, '2026-09-19');

// **색인은 버리지 않고 그 자리만 고친다.** 그래서 빠뜨리기 쉬운 자리다 — 셋 다 본다
const w = db.getWorkouts(A).find((r) => r.exercise === '벤치프레스');
db.updateWorkout(w.id, A, { weight: '90' });
ok('고친 값이 보인다', db.getWorkouts(A).find((r) => r.id === w.id).weight, '90');
db.deleteWorkout(w.id, A);
ok('지운 줄은 사라진다', db.getWorkouts(A).map((r) => r.exercise), ['스쿼트']);

// **돌려주는 것은 사본이어야 한다.** 색인이 들고 있는 배열을 그대로 주면, 받은 쪽이
// 정렬하거나 뒤집는 순간 다음 사람이 뒤집힌 것을 본다 (화면 코드가 흔히 하는 일이다)
const handed = db.getWorkouts(A);
handed.reverse();
handed.push({ id: 999, exercise: '없는 것' });
ok('돌려준 것을 고쳐도 다음 조회는 멀쩡하다', db.getWorkouts(A).map((r) => r.exercise), ['스쿼트']);

// 색인으로 고른 것과 **통째로 훑어 고른 것**이 같아야 한다 — 색인이 틀리면 여기서 갈린다
ok('통째로 훑은 것과 같은 수다',
  db.getWorkouts(A).length,
  db.snapshot().workouts.filter((r) => r.user_id === A).length);

db.createInbody(A, '2026-09-17', 175, 80, 18, 35, 40, 24);
db.createInbody(A, '2026-09-19', 175, 79, 17, 35, 40, 24);
ok('인바디도 최신이 앞이다', db.getInbody(A).map((r) => r.date), ['2026-09-19', '2026-09-17']);
const rec = db.getInbody(A)[0];
db.deleteInbody(rec.id, A);
ok('  지우면 사라진다', db.getInbody(A).map((r) => r.date), ['2026-09-17']);

// 계정 삭제는 **줄을 세지 않고 통째로 버리는 길**이다. 여기서 안 버리면 없는 사람의
// 기록이 계속 나온다 — 표(5초)와 달리 색인은 저절로 낡지 않는다
db.deleteUserCompletely(B);
ok('계정을 지우면 그 사람 줄도 빠진다', db.getWorkouts(B).length, 0);
ok('  내 기록은 그대로다', db.getWorkouts(A).map((r) => r.exercise), ['스쿼트']);

console.log('');
console.log('── 날짜 비교를 바꿨는데 답이 같은가 ──');
// `localeCompare` 를 그냥 비교로 바꿨다 (29,200줄 정렬에 29.1ms → 4.3ms).
// ISO 날짜는 사전 순서가 곧 시간 순서라 같은 답이 나온다 — **값으로 맞춰본다**
const sign = (n) => (n < 0 ? -1 : n > 0 ? 1 : 0);
const desc = (a, b) => (a < b ? 1 : a > b ? -1 : 0);
const dates = ['2026-01-05', '2025-12-31', '2026-01-05', '2026-09-19', '2024-02-29', ''];
const pairs = [];
for (const a of dates) for (const b of dates) pairs.push([a, b]);
ok('모든 짝에서 localeCompare 와 같다',
  pairs.every(([a, b]) => sign(b.localeCompare(a)) === desc(a, b)), true);
const iso = ['2026-09-19T10:00:00.000Z', '2026-09-19T09:59:59.999Z', '2026-09-18T23:00:00.000Z'];
ok('  시각까지 붙은 것도 같은 차례다',
  [...iso].sort(desc),
  [...iso].sort((a, b) => b.localeCompare(a)));

const waitFor = (fn, limit = 4000) => new Promise((resolve) => {
  const until = Date.now() + limit;
  const tick = () => {
    if (fn()) return resolve(true);
    if (Date.now() > until) return resolve(false);
    setTimeout(tick, 50);
  };
  tick();
});

(async () => {
  console.log('');
  console.log('── 저장이 파일까지 가는가 (기다리지 않고 쓴다) ──');
  // 이제 파일에 쓰는 몫은 비동기다. **잠시 뒤에는 파일에 있어야 한다** — 안 그러면
  // 서버가 안 죽고 도는 동안 기록이 메모리에만 있는 셈이다
  db.createWorkout(A, '2026-09-19', '풀업', '0', 4, 10);
  const onDisk = () => {
    try { return JSON.parse(fs.readFileSync(TMP, 'utf-8')).workouts.some((r) => r.exercise === '풀업'); }
    catch { return false; }   // 쓰는 중이면 못 읽을 수 있다 — 그래서 기다린다
  };
  ok('기다리지 않고 부른 저장이 파일까지 간다', await waitFor(onDisk), true);
  ok('  다 쓴 뒤 임시 파일이 안 남는다', fs.existsSync(TMP + '.writing'), false);

  console.log('');
  console.log('── 쓰다 죽어도 앞의 것이 남는가 ──');
  // 잘린 임시 파일을 손으로 만들어 둔다 — **본체는 멀쩡해야 하고, 임시 파일은 읽지 않는다**
  fs.writeFileSync(TMP + '.writing', '{"workouts":[{"exer', 'utf-8');
  ok('잘린 임시 파일이 있어도 기록을 읽는다',
    inFreshProcess(TMP, 'd.getWorkouts(' + A + ').length'),
    String(db.getWorkouts(A).length));
  fs.unlinkSync(TMP + '.writing');

  // **깨진 파일을 만나면 지우지 말고 옆에 치워둔다.** 여태 조용히 기본값으로 되돌렸다 —
  // 그러면 사람은 「기록이 전부 사라졌다」를 보고, 되살릴 파일도 없다
  const broken = path.join(ROOT, '.save-check-broken.json');
  fs.writeFileSync(broken, '{"workouts":[{"exer', 'utf-8');
  ok('깨진 파일은 빈 DB 로 시작한다', inFreshProcess(broken, 'd.getWorkouts(1).length'), '0');
  ok('  깨진 파일은 옆에 치워둔다 (되살릴 수 있게)',
    fs.readdirSync(ROOT).filter((f) => f.startsWith('.save-check-broken.json.broken-')).length, 1);

  db.flushNow();
  clean();
  console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
  process.exit(bad ? 1 : 0);
})();
