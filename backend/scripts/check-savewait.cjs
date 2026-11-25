// **쓰기가 끊이지 않아도 파일에 써지는가** (2026-11-25 · 근호).
//
//   node scripts/check-savewait.cjs              (npm run check 에도 들어 있다 — 찾아서 돈다)
//   node scripts/check-savewait.cjs --되돌려     옛 「부를 때마다 뒤로 미는」 꼴로 돌려 **우는지** 본다
//
// 여태 `db.js` 의 `save` 가 부를 때마다 타이머를 지우고 500ms 를 다시 걸어서, 0.5초 안에
// 쓰기가 계속 오면 **파일에 한 번도 안 썼다**(붐비는 동안 바뀐 것이 RAM 에만 있었다).
// 100ms 마다 한 줄씩 2.5초 동안 넣으면서, **넣는 동안** 파일에 앞 줄이 담기는지 본다.
const fs = require('fs');
const path = require('path');
const os = require('os');

const REVERT = process.argv.includes('--되돌려');
const TMP = path.join(os.tmpdir(), `savewait-${process.pid}.json`);
process.env.DB_FILE = TMP;
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
require('./_tmpdb.cjs')(TMP);

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const SRC = path.join(__dirname, '../src/db.js');
let dbPath = SRC;
const copies = [];
if (REVERT) {
  const src = fs.readFileSync(SRC, 'utf-8');
  const from = 'if (_saveTimer) return;                  // 이미 걸려 있다 — 뒤로 밀지 않는다';
  if (!src.includes(from)) ok('되돌릴 자리를 찾았다', false, true);
  const old = src.replace(from, 'if (_saveTimer) clearTimeout(_saveTimer);');
  dbPath = path.join(path.dirname(SRC), '.db.revert.js');
  fs.writeFileSync(dbPath, old);
  copies.push(dbPath);
}
process.on('exit', () => { for (const f of copies) { try { fs.unlinkSync(f); } catch { /* 없어도 된다 */ } } });

const db = require(dbPath);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const onDisk = () => {
  try { return (JSON.parse(fs.readFileSync(TMP, 'utf8')).workouts || []).length; } catch { return 0; }
};

(async () => {
  const u = db.createUser('sw@check.local', '$2a$10$abcdefghijklmnopqrstuv', '쓰기', 'savewait1').lastInsertRowid;
  await sleep(700);                           // 만든 사람이 먼저 써진다
  const start = onDisk();
  let seenWhileBusy = 0;
  for (let i = 0; i < 25; i += 1) {           // 100ms 마다 한 줄 · 2.5초
    db.createWorkout(u, '2026-11-25', '벤치프레스', '60', 1, 10);
    await sleep(100);
    seenWhileBusy = Math.max(seenWhileBusy, onDisk() - start);
  }
  ok('넣은 줄 수 (모집단 0 을 통과로 내보내지 않는다)', db.getWorkouts(u).length, 25);
  ok('**쓰기가 끊이지 않는 동안에도 파일에 담긴다**', seenWhileBusy > 0, true);
  ok('  넣는 동안 적어도 절반은 이미 파일에 있다', seenWhileBusy >= 12, true);
  // **끝낼 때(SIGTERM → `db.drain()`)는 타이머를 안 기다린다** — 간격이 늘어도 잃지 않는다
  db.createWorkout(u, '2026-11-25', '벤치프레스', '60', 1, 10);
  await db.drain();
  ok('**끝내는 길(drain)은 타이머를 안 기다리고 바로 쓴다**', onDisk() - start, 26);
  await sleep(800);
  ok('멈추면 끝까지 다 담긴다', onDisk() - start, 26);

  // 간격은 판 크기를 따라간다 — 0.5초 ~ 10초 (그 밖으로 안 나간다)
  const src = fs.readFileSync(SRC, 'utf-8');
  ok('간격 상한은 10초 · 하한은 0.5초다',
    /const SAVE_MIN_MS = 500;/.test(src) && /const SAVE_MAX_MS = 10000;/.test(src), true);

  console.log('');
  if (bad > 0) { console.log(bad + '건 FAIL'); process.exit(1); }
  console.log('모두 통과');
  process.exit(0);
})().catch((err) => { console.error('터짐:', err); process.exit(1); });
