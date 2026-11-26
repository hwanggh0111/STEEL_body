// ── 내보낸 파일을 다시 넣으면 **그날 차례가 그대로다** ── (2026-11-26 · 정석, 근호 점검 중간 7)
//
//   npm run importorder   (backend/ · npm run check 에도 들어 있다)
//
// 내보내기는 **최신이 앞**으로 쓴다(`db.js` ROW_CMP). 가져오기가 파일 차례대로 넣으면
// 넣는 순간이 `created_at` 으로 찍혀 **그날 줄이 거꾸로** 들어갔다 — 화면은 그날의
// 앞뒤를 `created_at` 오름으로 보므로(`TrainPage` 의 `linkBoundary`) **60kg → 40kg 드롭**이
// 뒤집혀 **드롭이 엉뚱한 줄에 붙었다.**
//
// 지금은 내보내기가 「순서」 칸을 적고(그날 가장 먼저 적은 줄이 1) 가져오기가 그 차례로
// 세워 넣는다. 여기서 보는 것:
//
//   · 내보낸 파일에 「순서」가 있다 · 그날 가장 먼저 적은 줄이 1 이다
//   · 그 파일을 빈 계정에 넣으면 **적은 차례 그대로** 들어간다 (드롭이 뒤에 온다)
//   · 「순서」가 없는 파일(손으로 만든 것)은 **파일 차례 그대로** 넣는다 (뒤집지 않는다)
//   · 「순서」 칸이 늘어도 **같은 파일을 두 번 넣으면 안 늘어난다** (열쇠에 안 들었다)
//
// 진짜 라우트 손 둘(`GET /api/export/workouts` · `POST /api/import`)을 그대로 부른다.
// db 는 **같은 모듈 객체**의 함수만 잠깐 갈아 끼운다 — 파일 DB 는 안 건드린다.
// 되돌려-FAIL: `--되돌려` 를 주면 차례 세우기를 뺀 판을 돌린다 → FAIL 이 보여야 한다
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
  // 옛 꼴: 파일 차례대로 그대로 넣는다 (차례 세우기를 뺀다)
  const src = fs.readFileSync(ROUTE, 'utf-8')
    .replace(/for \(const r of orderForInsert\(rows\)\) \{/, 'for (const r of rows) {');
  routePath = path.join(path.dirname(ROUTE), '.importOrder.revert.cjs');
  fs.writeFileSync(routePath, src);
  process.on('exit', () => { try { fs.unlinkSync(routePath); } catch { /* 이미 없다 */ } });
  console.log('── 되돌려: 파일 차례대로 넣는다 — 아래에 FAIL 이 있어야 한다 ──');
}

const db = require('../src/db');
const importRouter = require(routePath);
const exportRouter = require('../src/routes/export');

const handlerOf = (router, method, p) => {
  const layer = router.stack.find((l) => l.route && l.route.path === p && l.route.methods[method]);
  if (!layer) { console.log(`FAIL 길(${method.toUpperCase()} ${p})을 못 찾았다`); process.exit(1); }
  return layer.route.stack[layer.route.stack.length - 1].handle; // auth 다음 손
};
const importHandler = handlerOf(importRouter, 'post', '/');
const exportHandler = handlerOf(exportRouter, 'get', '/workouts');

// 가짜 계정 — 넣은 줄을 그대로 쌓는다. **적은 차례대로 번호가 커진다**(진짜 db 와 같다)
let store = [];
const keep = { getWorkouts: db.getWorkouts, createWorkout: db.createWorkout };
db.getWorkouts = () => store.slice().sort((a, b) =>
  (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || (b.id - a.id));   // 최신이 앞
db.createWorkout = (userId, date, exercise, weight, sets, reps, clientKey, link) => {
  const row = { id: store.length + 1, user_id: userId, date, exercise, weight, sets, reps };
  if (link) row.link = link;
  store.push(row);
  return { lastInsertRowid: row.id, record: row };
};

const doImport = (csv) => {
  let out = null;
  const res = { status() { return this; }, json(body) { out = body; return this; } };
  importHandler({ userId: 'u-order', body: { kind: 'workouts', csv } }, res);
  return out;
};
const doExport = () => {
  let body = '';
  const res = { setHeader() {}, send(s) { body = s; } };
  exportHandler({ userId: 'u-order' }, res);
  return body.replace(/^﻿/, '');
};

// 적은 차례: 60kg → 40kg(드롭) → 20kg(드롭). 화면은 이 차례로 묶음을 읽는다
const day = new Date(); day.setDate(day.getDate() - 2);
const D = day.toISOString().slice(0, 10);
const 적은차례 = [
  [D, '벤치프레스', '60', 1, 10, null],
  [D, '벤치프레스', '40', 1, 8, 'drop'],
  [D, '벤치프레스', '20', 1, 6, 'drop'],
];
const 무게들 = () => store.slice().sort((a, b) => a.id - b.id).map((w) => w.weight);

try {
  // 1) 손으로 적은 것처럼 차례대로 담는다
  store = [];
  for (const [d, ex, w, s, r, link] of 적은차례) {
    db.createWorkout('u-order', d, ex, w, s, r, null, link);
  }
  ok('적은 차례', 무게들(), ['60', '40', '20']);

  // 2) 내보낸다 — 최신이 앞이고, 「순서」가 적혀 있다
  const csv = doExport();
  const lines = csv.trim().split('\n');
  ok('머리줄 끝이 「순서」다', lines[0].split(',').slice(-1), ['순서']);
  // 무게는 자유 입력 칸이라 따옴표로 감싸여 온다(`csvCell`) — 벗겨서 본다
  const 무게칸 = (l) => l.split(',')[2].replace(/^"|"$/g, '');
  ok('파일은 최신이 앞이다', lines.slice(1).map(무게칸), ['20', '40', '60']);
  ok('그날 가장 먼저 적은 줄이 1 이다', lines.slice(1).map((l) => l.split(',').slice(-1)[0]), ['3', '2', '1']);

  // 3) 빈 계정에 그 파일을 넣는다 — **적은 차례 그대로** 들어가야 한다
  store = [];
  const a = doImport(csv);
  ok('빈 계정에 넣으면 세 줄 다 들어간다', [a && a.added, a && a.skipped], [3, 0]);
  ok('★ 넣은 차례가 적은 차례와 같다', 무게들(), ['60', '40', '20']);
  ok('  드롭 표시도 그 줄에 그대로', store.slice().sort((x, y) => x.id - y.id).map((w) => w.link || ''),
    ['', 'drop', 'drop']);

  // 4) 같은 파일을 다시 넣어도 안 는다 — 「순서」는 열쇠에 안 들었다
  const b = doImport(csv);
  ok('같은 파일을 다시 넣으면 안 는다', [b && b.added, b && b.skipped], [0, 3]);
  ok('  계정은 여전히 세 줄', store.length, 3);

  // 5) 「순서」가 없는 파일(손으로 만든 것)은 **뒤집지 않는다**
  store = [];
  const 손파일 = '날짜,운동명,무게,세트,횟수\n'
    + `${D},스쿼트,100,1,5\n${D},스쿼트,80,1,5\n${D},스쿼트,60,1,5\n`;
  const c = doImport(손파일);
  ok('「순서」 없는 파일도 다 들어간다', [c && c.added, c && c.skipped], [3, 0]);
  ok('★ 파일 차례 그대로 넣는다 (모를 때는 그대로)', 무게들(), ['100', '80', '60']);
} finally {
  Object.assign(db, keep);
}

console.log(bad === 0 ? '\n모두 통과' : `\n${bad}건 FAIL`);
process.exit(bad === 0 ? 0 : 1);
