// ── 같은 파일 안의 **똑같은 줄**을 버리지 않는다 ── (2026-11-26 · 벼림, 근호 점검 높음 2)
//
//   npm run importdup   (backend/ · npm run check 에도 들어 있다)
//
// 가져오기는 「이미 있는 줄」을 열쇠로 건너뛴다. 그 열쇠 표가 `Set` 이었을 때, 같은 날
// 벤치 60kg 1×10 을 **세 줄로 적은 사람**이 내보낸 파일을 빈 계정에 넣으면 첫 줄만 들어가고
// 둘은 「이미 있다」로 빠졌다 — **복원하려고 만든 길에서 세트가 사라졌다.**
// 지금은 열쇠마다 **몇 줄 있나**를 센다. 여기서 보는 것:
//
//   · 빈 계정에 세 줄 → 셋 다 들어간다
//   · 같은 파일을 다시 넣으면 → 하나도 안 늘어난다 (11/24 「두 번 넣어도 안 는다」 그대로)
//   · 한 줄만 있는 계정에 세 줄 → 둘만 들어간다
//   · 상한은 **줄 수**로 센다 (열쇠 수로 세면 남은 자리가 부풀었다)
//
// 진짜 라우트 손(`POST /api/import`)을 그대로 부른다. db 는 **같은 모듈 객체**의 함수만
// 잠깐 갈아 끼운다 — 파일 DB 는 안 건드린다.
// 되돌려-FAIL: `--되돌려` 를 주면 열쇠 표를 옛 `Set` 꼴로 되돌린 판을 돌린다 → FAIL 이 보여야 한다
const fs = require('fs');
const path = require('path');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const ROUTE = path.join(__dirname, '../src/routes/importData.js');
let routePath = ROUTE;
if (process.argv.includes('--되돌려')) {
  // 옛 꼴: 열쇠를 개수가 아니라 「있다/없다」로 — 넣은 줄도 곧바로 「있다」가 된다
  const src = fs.readFileSync(ROUTE, 'utf-8')
    .replace(/if \(nth <= \(have\.get\(k\) \|\| 0\)\) \{ skipped \+= 1; continue; \}/,
      'if (have.get(k)) { skipped += 1; continue; }')
    .replace(/spec\.put\(req\.userId, r\);/, 'spec.put(req.userId, r); have.set(k, 1);');
  routePath = path.join(path.dirname(ROUTE), '.importData.revert.cjs');
  fs.writeFileSync(routePath, src);
  process.on('exit', () => { try { fs.unlinkSync(routePath); } catch { /* 이미 없다 */ } });
  console.log('── 되돌려: 열쇠 표를 옛 Set 꼴로 — 아래에 FAIL 이 있어야 한다 ──');
}

const db = require('../src/db');
const router = require(routePath);
const layer = router.stack.find((l) => l.route && l.route.path === '/' && l.route.methods.post);
if (!layer) { console.log('FAIL 가져오기 길(POST /)을 못 찾았다'); process.exit(1); }
const handler = layer.route.stack[layer.route.stack.length - 1].handle; // auth 다음 손

// 가짜 계정 하나 — 넣은 줄을 그대로 쌓는다
let store = [];
const keep = { getWorkouts: db.getWorkouts, createWorkout: db.createWorkout };
db.getWorkouts = () => store.slice();
db.createWorkout = (userId, date, exercise, weight, sets, reps) => {
  const row = { id: store.length + 1, user_id: userId, date, exercise, weight, sets, reps };
  store.push(row);
  return row;
};

const call = (csv) => {
  let out = null;
  const res = { status() { return this; }, json(body) { out = body; return this; } };
  handler({ userId: 'u-dup', body: { kind: 'workouts', csv } }, res);
  return out;
};

const day = new Date(); day.setDate(day.getDate() - 3);
const D = day.toISOString().slice(0, 10);
const HEAD = '날짜,운동명,무게,세트,횟수\n';
const line = `${D},벤치프레스,60,1,10\n`;
const three = HEAD + line + line + line;

try {
  store = [];
  const a = call(three);
  ok('빈 계정에 똑같은 세 줄 → 셋 다 들어간다', [a && a.added, a && a.skipped], [3, 0]);
  ok('  계정에 세 줄이 있다', store.length, 3);

  const b = call(three);
  ok('같은 파일을 다시 넣으면 하나도 안 는다', [b && b.added, b && b.skipped], [0, 3]);
  ok('  계정은 여전히 세 줄', store.length, 3);

  store = [{ id: 1, user_id: 'u-dup', date: D, exercise: '벤치프레스', weight: 60, sets: 1, reps: 10 }];
  const c = call(three);
  ok('한 줄 있는 계정에 세 줄 → 둘만 들어간다', [c && c.added, c && c.skipped], [2, 1]);

  const src = fs.readFileSync(ROUTE, 'utf-8');
  ok('상한을 줄 수로 센다 (열쇠 수가 아니라)', /spec\.max - existing\.length/.test(src), true);
} finally {
  Object.assign(db, keep);
}

console.log(bad === 0 ? '모두 통과' : bad + '곳 어긋남');
process.exit(bad === 0 ? 0 : 1);
