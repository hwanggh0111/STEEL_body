// **「유산소인가」를 판정하는 손이 몇 벌이고, 같은 줄에 같게 답하는가** (2026-11-11).
//
//   npm run cardiohands     (npm run check 에도 들어 있다)
//
// ── 왜 이 자가 생겼나 ──
//
// 이 저장소가 같은 류로 세 번 데었다 — **날짜 손 열세 벌**(`check-datehands`) ·
// **무게 손 넷**(`check-weighthands`) · **긴꼴 날짜 둘**(11/11). 모양이 늘 같다:
// 같은 것을 판정하는 손이 여러 벌인데 **규칙이 조금 다르고**, 어느 날 한쪽만
// 바뀌어서 **두 화면이 같은 줄을 다르게 말한다.**
//
// 유산소 쪽에 그 손이 **세 벌** 있는데 자가 없었다. 규칙이 실제로 다르다 —
//
//   frontend/src/data/cardio.js:76    isCardioRow   `num() > 0` 인가      ← 0 은 유산소가 아니다
//   frontend/src/data/undoRow.js:38   isCardio      `!= null` 인가        ← 0 도 유산소다
//   backend/src/utils/cardioFields.js isCardioRow   `!= null` 인가        ← 0 도 유산소다
//
// **지금은 안 닿는다** — 서버가 `0분`·`0km` 을 양쪽 다 거절한다
// (`normalizeCardio`: 「시간은 1 이상의 정수(분)」 · 「거리는 0보다 큰 수(km)」).
// 그래서 담긴 줄에는 0 이 없고 세 손이 늘 같게 답한다. 이 자는 **그 전제가 깨지는
// 날**을 잡는다: 0 을 받게 되거나, 손이 한 벌 더 생기거나, 한쪽 규칙만 바뀌는 날.
//
// ── 그리고 **칸 이름**을 본다 ──
//
// 적는 자리가 둘이다(`TrainPage` · `DaySheet`). 둘 다 **`distance_km`** 으로 보내야
// 한다 — 서버는 `distanceKm` 도 받지만(`routes/workouts.js:109`), **지하에 세워둔
// 줄은 올라가기 전에 그 몸통 그대로 화면에 그려진다**(`data/offline.js` 의
// `mergeQueue` 가 `...q.payload` 를 펴 넣는다). 보내는 이름과 읽는 이름이 다르면
// **그 줄만 거리가 안 보인다** — 신호가 돌아와 올라간 뒤에야 나타난다.
// `DaySheet.jsx:120~122` 주석에 그 까닭이 적혀 있는데 **지키는 자가 없었다.**
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BACK = path.resolve(ROOT, '..', 'backend');

// ── **글자를 보는 묶음은 사본에서도 돌 수 있다** ── (`--root <dir>`)
//
// 되돌려 FAIL 을 보려면 「캐멀로 보내기」·「네 벌째 손」을 만들어 봐야 하는데,
// 창이 셋이라 **공유 트리의 파일을 건드리면 남의 작업을 밟는다**. 그래서 글자를
// 세는 묶음만 사본을 보게 한다 (불러서 값을 견주는 묶음은 묶기 때문에 늘 실물이다)
const argRoot = (() => {
  const i = process.argv.indexOf('--root');
  return i !== -1 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : null;
})();
const SCAN = argRoot || ROOT;
if (argRoot) console.log('※ 글자 묶음은 사본을 본다: ' + argRoot);
let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const TMP = [];
function bundle(rel, out) {
  execFileSync(process.execPath, [
    path.join(ROOT, 'node_modules', 'esbuild', 'bin', 'esbuild'),
    path.join(ROOT, rel), '--bundle', '--format=cjs', '--platform=node',
    '--outfile=' + path.join(ROOT, out),
  ], { stdio: 'pipe' });
  TMP.push(out);
  return require(path.join(ROOT, out));
}
const clean = () => { for (const f of TMP) { try { fs.unlinkSync(path.join(ROOT, f)); } catch { /* 남아도 해롭지 않다 */ } } };

console.log('── 「유산소인가」를 판정하는 손 ──');

let front; let undo; let back;
try {
  front = bundle('src/data/cardio.js', '.ch-cardio.cjs');
  undo = bundle('src/data/undoRow.js', '.ch-undo.cjs');
  back = require(path.join(BACK, 'src', 'utils', 'cardioFields.js'));
} catch (e) {
  console.log('FAIL 손을 묶지 못했다 → ' + String(e.message || e).slice(0, 200));
  clean();
  process.exit(1);
}

// `undoRow` 는 그 판정을 안 내보낸다 — **값으로 본다**: 유산소로 보면 시간·거리만,
// 근력으로 보면 무게·세트·횟수만 담는다(그 파일의 「두 모양을 섞지 않는다」 규칙)
const undoSaysCardio = (row) => {
  const body = undo.rowPayload({ date: '2026-11-11', exercise: '런닝머신', ...row });
  if (!body) return null;
  return Object.prototype.hasOwnProperty.call(body, 'minutes');
};

// ── 담긴 줄로 올 수 있는 모양 ──
// 서버가 0 을 거절하므로 **시간은 1 이상 · 거리는 0 보다 큼 · 또는 없음**이다
const 담길수있는줄 = [
  { 이름: '시간만', row: { minutes: 32 }, 유산소: true },
  { 이름: '거리만', row: { distance_km: 5.2 }, 유산소: true },
  { 이름: '둘 다', row: { minutes: 32, distance_km: 5.2 }, 유산소: true },
  { 이름: '근력 줄', row: { weight: '60', sets: 3, reps: 8 }, 유산소: false },
  { 이름: '맨몸 줄', row: { weight: '맨몸', sets: 3, reps: 12 }, 유산소: false },
  // 빈 값이 **글자로** 올 수 있다 — 화면이 `null` 로 보내지만 옛 줄에 남아 있을 수 있다
  { 이름: '시간이 빈 글자', row: { minutes: '', distance_km: 5.2 }, 유산소: true },
];

for (const t of 담길수있는줄) {
  const a = front.isCardioRow(t.row);
  const b = back.isCardioRow(t.row);
  const c = undoSaysCardio(t.row);
  ok('★ 셋이 같게 답한다 — ' + t.이름, [a, b, c], [t.유산소, t.유산소, t.유산소]);
}

console.log('');
console.log('── 손이 몇 벌인가 (새로 생기는 것을 막는다) ──');
{
  // 허락 목록에 없는 **새 자리**가 생기면 FAIL — 네 벌째가 생기는 날을 잡는다.
  // 세는 것은 **짓는 자리**다(쓰는 자리는 12개 파일이고 그건 정상이다)
  const 허락 = ['src/data/cardio.js', 'src/data/undoRow.js'];
  const 자리 = [];
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, f.name);
      if (f.isDirectory()) { walk(full); continue; }
      if (!/\.(js|jsx)$/.test(f.name)) continue;
      const rel = path.relative(SCAN, full).split(path.sep).join('/');
      fs.readFileSync(full, 'utf8').split('\n').forEach((line) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
        if (/(function|const)\s+isCardio\w*\s*[(=]/.test(line) && !자리.includes(rel)) 자리.push(rel);
      });
    }
  };
  walk(path.join(SCAN, 'src'));
  ok('★ 유산소를 판정하는 손이 늘지 않았다', 자리.filter((r) => !허락.includes(r)), []);
  console.log('       지금 ' + 자리.length + '벌 (앱) + 1벌 (서버 `utils/cardioFields.js`)');
}

console.log('');
console.log('── 적는 자리가 서버와 같은 칸 이름을 쓰는가 ──');
{
  // **지하에 세워둔 줄은 올라가기 전에 그 몸통 그대로 화면에 그려진다.**
  // 그래서 보내는 이름(`distance_km`)과 읽는 이름이 같아야 한다 — 다르면 그 줄만
  // 거리가 안 보인다. 적는 자리가 둘이고, 셋째가 생기는 날 이 줄이 잡는다
  const 적는자리 = ['src/pages/TrainPage.jsx', 'src/components/DaySheet.jsx'];
  const 캐멀 = [];
  const 스네이크 = [];
  for (const rel of 적는자리) {
    const src = fs.readFileSync(path.join(SCAN, rel), 'utf8');
    src.split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      if (/distanceKm\s*:/.test(line)) 캐멀.push(rel + ':' + (i + 1));
      if (/distance_km\s*:/.test(line)) 스네이크.push(rel + ':' + (i + 1));
    });
  }
  ok('★ 적는 몸통에 `distanceKm`(캐멀)이 없다', 캐멀, []);
  ok('  두 자리 다 `distance_km` 으로 보낸다', 스네이크.length >= 2, true);
  console.log('       ' + 스네이크.join(' · '));

  // 그 전제가 되는 자리 — `mergeQueue` 가 몸통을 그대로 펴 넣는다
  const off = fs.readFileSync(path.join(SCAN, 'src/data/offline.js'), 'utf8');
  ok('  쌓인 줄은 몸통을 그대로 펴 넣는다 (그래서 이름이 같아야 한다)',
    /\.\.\.q\.payload/.test(off), true);

  // 서버는 두 이름 다 받는다 — 그물이 하나 더 있다는 것을 적어둔다
  const wr = fs.readFileSync(path.join(BACK, 'src/routes/workouts.js'), 'utf8');
  ok('  서버는 두 이름 다 받는다 (그물)',
    /req\.body\.distanceKm[\s\S]{0,80}req\.body\.distance_km/.test(wr), true);
}

console.log('');
console.log('── 0 은 담길 수 없다 (위 전제) ──');
{
  // 이 전제가 깨지면 **맨 위 묶음이 갈린다** (`cardio.js` 는 0 을 유산소로 안 보고
  // 나머지 둘은 본다). 그날 이 줄이 먼저 운다
  ok('0분은 거절한다', back.normalizeCardio(0, null).ok, false);
  ok('0km 은 거절한다', back.normalizeCardio(null, 0).ok, false);
  ok('30.5분은 거절한다', back.normalizeCardio(30.5, null).ok, false);
  ok('  32분 5.2km 는 받는다', back.normalizeCardio(32, 5.2).ok, true);
}

clean();
console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
