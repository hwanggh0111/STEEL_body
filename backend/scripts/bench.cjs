// 어디가 느린가 — 재보는 자리 (2026-09-18).
//
//   npm run bench            5년치(사람 1명)로 잰다
//   npm run bench -- 50      사람 50명을 같이 넣고 잰다 (남의 줄이 내 값에 끼치는 것)
//
// **짐작으로 고치지 않으려고 만든다.** 이 앱에서 여태 잡은 느린 자리 둘은 둘 다
// 재본 뒤에 드러났다 —
//   · 남이 저장하면 내 조회 표가 통째로 비워졌다 (0.000ms → 1.162ms)
//   · 운동을 고를 때마다 최고 기록 표를 다시 만들었다 (한 번에 17.4ms)
// 둘 다 「그럴 것 같다」로는 안 보였고, 잰 뒤에는 고칠 자리가 한 줄이었다.
//
// **검사가 아니다.** 통과·실패가 없다 — 수를 적어 두고 다음에 견준다.
// 그래서 `npm run check` 에 넣지 않는다 (돌리는 데 오래 걸리고, 기계마다 다르다).
//
// **진짜 DB 를 안 건드린다.** `DB_FILE` 로 임시 파일을 쓰고 끝나면 지운다.
const fs = require('fs');
const path = require('path');

const TMP = path.join(__dirname, '.bench.json');
process.env.DB_FILE = TMP;
for (const f of [TMP, TMP.replace(/\.json$/, '.photos.json')]) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

const db = require('../src/db');
const rows = require('../src/utils/csvRows');

const PEOPLE = Math.max(1, Number(process.argv[2]) || 1);
const YEARS = 5;
const PER_DAY = 16;                       // 하루 열여섯 줄 (루틴 한 판)
const NAMES = ['벤치프레스', '스쿼트', '데드리프트', '랫풀다운', '오버헤드프레스', '바벨로우', '레그프레스', '바이셉스컬'];

const ms = (fn, times = 1) => {
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < times; i++) fn();
  return Number(process.hrtime.bigint() - t0) / 1e6 / times;
};
const say = (label, value, unit = 'ms') =>
  console.log('  ' + label.padEnd(46, ' ') + String(typeof value === 'number' ? value.toFixed(3) : value).padStart(10) + ' ' + unit);

console.log(`── 만든다 (사람 ${PEOPLE}명 · ${YEARS}년치 · 하루 ${PER_DAY}줄) ──`);
const made = ms(() => {
  for (let p = 1; p <= PEOPLE; p++) {
    for (let d = 0; d < YEARS * 365; d++) {
      const day = new Date(2021, 0, 1 + d).toISOString().slice(0, 10);
      for (let i = 0; i < PER_DAY; i++) {
        db.createWorkout(p, day, NAMES[(d + i) % NAMES.length], String(60 + (i % 40)), 5, 8);
      }
    }
    for (let m = 0; m < YEARS * 12; m++) {
      const day = new Date(2021, m, 1).toISOString().slice(0, 10);
      db.createInbody(p, day, 178, 78 + (m % 5), 15, 36, 45, 24.6);
    }
  }
});
const total = PEOPLE * YEARS * 365 * PER_DAY;
say('넣는 데 걸린 시간 (전부)', made / 1000, '초');
say('줄 수 (운동)', total.toLocaleString(), '줄');
say('한 줄 넣는 데', made / total);

console.log('');
console.log('── 파일에 쓰기 (이 DB 는 한 장을 통째로 쓴다) ──');
// **여기가 이 앱의 천장이다.** 줄이 늘면 저장 한 번이 그만큼 길어진다 —
// 그래서 `db.js` 는 500ms 동안 모아서 한 번만 쓴다(디바운스). 그 한 번의 값이다
// ── 저장할 때 **서버가 멈추는 시간** ── (2026-09-18)
//
// 노드는 한 줄로 돈다. 저장이 동기면 그동안 **아무 요청도 못 받는다** — 그래서 재야
// 하는 것은 「저장에 걸린 시간」이 아니라 **멈춘 시간**이다.
// 이제 문자열을 만드는 동안만 멈추고, 파일에 쓰는 몫은 비동기로 넘긴다.
{
  const snap = db.snapshot();
  const strMs = ms(() => JSON.stringify(snap), 2);
  const tmp2 = TMP + '.bench-write';
  const writeMs = ms(() => { fs.writeFileSync(tmp2, JSON.stringify(snap)); }, 1) - strMs;
  try { fs.unlinkSync(tmp2); } catch { /* 없으면 그만 */ }
  say('저장할 때 멈추는 시간 (문자열 만들기)', strMs);
  say('  비동기로 넘긴 몫 (파일에 쓰기)', writeMs > 0 ? writeMs : 0);
  say('  끝날 때 쓰는 동기 길 (flushNow)', ms(() => db.flushNow(), 2));
}
const size = fs.existsSync(TMP) ? fs.statSync(TMP).size : 0;
say('파일 크기', (size / 1048576).toFixed(2), 'MB');
// **힙을 따로 적는다.** 서버는 `--max-old-space-size=256` 으로 뜨는데 그것은 힙의 뚜껑이다 —
// rss 만 보면 넘었는지 못 넘었는지 알 수 없다
{
  const m = process.memoryUsage();
  say('메모리 (rss)', (m.rss / 1048576).toFixed(1), 'MB');
  say('  힙 쓰는 중 / 힙 잡아둔 것', `${(m.heapUsed / 1048576).toFixed(1)} / ${(m.heapTotal / 1048576).toFixed(1)}`, 'MB');
  say('  힙 뚜껑 (서버는 256으로 뜬다)', (require('v8').getHeapStatistics().heap_size_limit / 1048576).toFixed(0), 'MB');
}

console.log('');
console.log('── 사진 (제일 무거운 것) ──');
// **사진은 딴 파일이지만 메모리에는 같이 있다** (`photos.json` 을 통째로 캐시한다).
// 한 사람이 최대 세 장 × 2MB 라, 사람이 늘면 여기가 먼저 찬다 —
// 그래서 「마흔 명이면 넘는다」 같은 짐작 대신 그때그때 재서 본다
{
  // 2MB 상한 안쪽에서 진짜만 한 크기로 (1.4MB 짜리 base64).
  //
  // **글자를 돌려쓰면 안 된다** — 같은 글자를 서른 번 넣으면 자바스크립트가 하나만
  // 들고 있어서 메모리가 1.4MB 밖에 안 는다. 처음에 그렇게 재고 「사진은 가볍다」고
  // 읽을 뻔했다. 사람마다 다른 사진이라야 진짜 값이 나온다
  const photoOf = (p, t) => 'data:image/jpeg;base64,' + `${p}${t}`.padEnd(40, 'x').repeat(35_000);
  const put = ms(() => {
    for (let p = 1; p <= PEOPLE; p++) {
      for (const t of ['profile', 'before', 'after']) db.savePhoto(p, t, photoOf(p, t));
    }
  });
  say('넣기 (사람마다 세 장)', put / 1000, '초');
  // 사진은 딴 파일이고 딴 시계로 쓴다(500ms 디바운스) — 끝날 때 쓰는 것을 여기서 부른다
  say('한 번 쓰기 (사진 파일)', ms(() => db.flushPhotosNow(), 1));
  const pf = TMP.replace(/\.json$/, '.photos.json');
  say('사진 파일 크기', (fs.existsSync(pf) ? fs.statSync(pf).size / 1048576 : 0).toFixed(2), 'MB');
  const m2 = process.memoryUsage();
  say('  힙 쓰는 중 (사진까지 든 뒤)', (m2.heapUsed / 1048576).toFixed(1), 'MB');
  say('  한 사람이 더 늘 때마다', (3 * photoOf(1, 'x').length / 1048576).toFixed(1), 'MB');
}

console.log('');
console.log('── 목록 읽기 (화면이 뜰 때마다 한 번) ──');
// 표에 남아 있으면 0 에 가깝다. **남이 저장하면 비워지는지**가 오래 걸리던 자리였다
// 첫 조회는 **사람별 색인을 만드는 값**이 같이 든다 (프로세스에 한 번)
say('첫 조회 (색인 만들기 포함)', ms(() => db.getWorkouts(1), 1));
say('  표에 있을 때', ms(() => db.getWorkouts(1), 50));
// **이 값이 실제로 겪는 값이다** — 저장하면 표가 비워지므로 다음 조회는 여기를 지난다.
// 색인은 그 자리만 고치므로(버리지 않는다) 남의 줄은 안 훑고 정렬만 다시 한다
say('  저장한 뒤 조회 (실제로 겪는 값)', ms(() => {
  db.createWorkout(1, '2026-09-18', '벤치프레스', '80', 5, 8);
  db.getWorkouts(1);
}, 5));
if (PEOPLE > 1) {
  // 2026-09-17 에 고친 자리 — 남의 저장이 내 비용이 되면 안 된다
  db.createWorkout(2, '2026-09-18', '벤치프레스', '80', 5, 8);
  say('  남이 저장한 뒤 (내 표가 남아 있나)', ms(() => db.getWorkouts(1), 10));
}
// 「하루치만」은 2026-09-19 에 걷었다 — 그 길을 앱이 한 번도 안 불렀다.
// **재기 전에 「누가 부르는가」를 봤어야 했다** (9/18 에 여기를 0.48ms 로 줄였다).
say('인바디 전부', ms(() => db.getInbody(1), 20));

console.log('');
console.log('── 가져오기 (파일 한 장) ──');
const csv = '날짜,운동명,무게,세트,횟수\n'
  + Array.from({ length: 30000 }, (_, i) =>
    `${new Date(2021, 0, 1 + (i % 1825)).toISOString().slice(0, 10)},${NAMES[i % NAMES.length]},80,5,8`).join('\n');
say('CSV 크기', (csv.length / 1048576).toFixed(2), 'MB');
let parsed = null;
say('3만 줄 읽기 (모양·테두리까지)', ms(() => { parsed = rows.readWorkouts(csv); }));
say('  읽힌 줄', parsed.rows.length.toLocaleString(), '줄');
// 이미 있는 것과 견주는 열쇠 만들기 — 줄마다 다시 훑으면 여기서 멎는다
say('있는 것의 열쇠 만들기', ms(() => new Set(db.getWorkouts(1).map(rows.workoutKey))));

console.log('');
console.log('── 화면이 하는 계산 (같은 자료로) ──');
// 프론트 계산은 esbuild 로 묶어 와서 같은 자료로 잰다 — 화면에서 느린 자리가
// 서버와 다른 데 있을 수 있다 (2026-09-18 에 잡은 최고 기록 표가 그랬다)
try {
  // **esbuild 는 프론트 쪽에만 있다** (검사들이 거기서 쓴다). 백엔드에 또 넣지 않는다 —
  // 같은 것을 두 군데 두면 판이 갈린다
  const esbuild = require(path.join(__dirname, '../../frontend/node_modules/esbuild'));
  const out = path.join(__dirname, '.bench-pr.cjs');
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, '../../frontend/src/data/personalRecord.js')],
    bundle: true, format: 'cjs', outfile: out, platform: 'node',
  });
  const pr = require(out);
  fs.unlinkSync(out);
  const byDate = {};
  for (const w of db.getWorkouts(1)) (byDate[w.date] ||= []).push(w);
  say('최고 기록 표 (기록 전부를 훑는다)', ms(() => pr.bestRecords(byDate), 3));
  say('  한 운동의 지난 기록 찾기', ms(() => {
    for (const d of Object.keys(byDate).sort().reverse()) {
      if (byDate[d].find((w) => w.exercise === '바이셉스컬')) break;
    }
  }, 5));
} catch (err) {
  console.log('  (프론트 계산은 건너뜀 — ' + err.message + ')');
}

console.log('');
console.log('여기 적힌 수는 이 기계에서 이번에 잰 것이다. 다음에 견줄 때는 같은 명령으로 다시 재고,');
console.log('바꾼 것이 어느 줄을 움직였는지 README 개발 일지에 적는다.');

for (const f of [TMP, TMP.replace(/\.json$/, '.photos.json')]) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}
