// **같은 화면이 두 수를 다르게 말하지 않는가** — 통계 칸 (2026-11-09).
//
//   npm run stats     (npm run check 에도 들어 있다)
//
// ── 왜 이 자가 생겼나 ──
//
// 11/09 에 한 해 벽을 고쳐 「올해 N일」이 **오늘까지만** 세게 했다. 그런데 바로
// 아래 통계 칸 셋은 안 걸러서, **같은 화면 안에서 두 수가 달라졌다** —
//
//     어제 하나 + 내일 하나 적어둔 사람
//       한 해 벽   올해 1일 · 가장 길게 1
//       통계 칸    운동일 2 · 총 운동 2      ← 같은 화면, 다른 수
//
// 11/05 에 주 연속 · 최고 N kg 에서 고친 그 류다(「같은 말로 다른 수」). 그때는
// 화면 둘이 달랐고, 이번에는 **한 화면 안에서** 갈렸다.
//
// ── 무엇을 보는가 ──
//
// 글자만 세지 않는다. **두 셈을 같은 데이터로 돌려 수를 견준다** — 화면이 쓰는
// 손(`upToToday`)과 한 해 벽(`yearWall`)을 묶어서 같은 기록을 먹이고, 나온 수가
// 같은지 본다. 그려진 수는 틀려도 틀려 보이지 않으므로 수로 잡아야 한다.
//
// ★ **목록은 걸러지면 안 된다.** `dates` 는 날짜별 목록을 그리는 데도 쓰인다 —
// 잘못 적은 앞날 줄을 사람이 찾아 고칠 자리가 거기뿐이다(11/05 에 정한 선).
// 그래서 「`dates` 자체를 거르지 않았는가」도 같이 본다.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
// 주석을 뗀 알맹이. 머리글에 적어둔 말이 자를 통과시키면 안 된다
const codeOf = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ── 셈을 묶어 들인다 ──
// `src/data` 는 ESM 이고 이 자는 cjs 다. 집안 다른 자들이 쓰는 그 방법을 쓴다
function bundle(entry, out) {
  execFileSync(process.execPath, [
    path.join(ROOT, 'node_modules', 'esbuild', 'bin', 'esbuild'),
    path.join(ROOT, entry), '--bundle', '--format=cjs', '--platform=node',
    '--outfile=' + path.join(ROOT, out),
  ], { stdio: 'pipe' });
  return require(path.join(ROOT, out));
}

const TMP = [];
let dateKey; let yearWall;
try {
  dateKey = bundle('src/data/dateKey.js', '.stats-datekey.cjs'); TMP.push('.stats-datekey.cjs');
  yearWall = bundle('src/data/yearWall.js', '.stats-yearwall.cjs'); TMP.push('.stats-yearwall.cjs');
} catch (e) {
  console.log('FAIL 셈을 묶지 못했다 → ' + String(e.message || e).slice(0, 200));
  process.exit(1);
}

const TODAY = '2026-11-09';
const 어제 = '2026-11-08';
const 내일 = '2026-11-10';
// 어제 하나 · 내일 하나. 앞날 줄이 수를 부풀리는 가장 작은 모양이다
const workouts = {
  [어제]: [{ id: 1, exercise: '벤치프레스', weight: '80', sets: 3, reps: 8, date: 어제 }],
  [내일]: [{ id: 2, exercise: '스쿼트', weight: '100', sets: 3, reps: 5, date: 내일 }],
};
const dates = Object.keys(workouts).sort().reverse();

console.log('── 통계 칸이 앞날 줄을 세지 않는가 ──');
{
  const { upToToday } = dateKey;
  ok('손이 있다', typeof upToToday, 'function');
  const counted = upToToday(dates, TODAY);
  ok('앞날 줄을 뺀다', counted, [어제]);
  ok('  운동일', counted.length, 1);
  ok('  총 운동', counted.reduce((n, d) => n + workouts[d].length, 0), 1);
  ok('날을 안 넘기면 다 준다', upToToday(dates, null).length, 2);
  ok('글자 아닌 열쇠는 뺀다', upToToday([어제, null, 7], TODAY), [어제]);
  // **목록은 거르지 않는다** — 손이 원본을 건드리면 목록이 함께 줄어든다
  ok('원본을 건드리지 않는다', dates.length, 2);
}

console.log('');
console.log('── ★ 같은 화면이 같은 수를 말하는가 (한 해 벽 ↔ 통계 칸) ──');
{
  const { upToToday } = dateKey;
  const build = yearWall.buildYear || yearWall.default;
  if (typeof build !== 'function') {
    ok('한 해 벽 셈을 들였다', typeof build, 'function');
  } else {
    // `buildYear` 는 `{ year, months, total }` 을 준다. 한 해 날 수는 `total.days` 다
    const wall = build(workouts, 2026, TODAY);
    const 벽일수 = wall && wall.total && wall.total.days;
    const 통계일수 = upToToday(dates, TODAY).length;
    ok('한 해 벽이 센 날 수', typeof 벽일수, 'number');
    ok('  앞날을 안 센다', 벽일수, 1);
    ok('  ★ 통계 칸과 같은 수다', 통계일수, 벽일수);
  }
}

console.log('');
console.log('── 화면이 그 손을 쓰는가 ──');
{
  const page = codeOf(read('src/pages/HistoryPage.jsx'));
  ok('upToToday 를 들였다', /from '\.\.\/data\/dateKey'/.test(page) && /upToToday/.test(page), true);
  ok('세는 자리가 그 손을 쓴다', /upToToday\(dates, today\)/.test(page), true);
  ok('  dates.length 로 세지 않는다', /totalDays = dates\.length/.test(page), false);
  ok('  총 운동도 걸러낸 것으로 센다', /Object\.values\(workouts\)\.flat\(\)\.length/.test(page), false);
  ok('인바디 칸이 걸러낸 줄을 센다', /number=\{weightRows\.length\} label="인바디"/.test(page), true);
  ok('  records.length 로 세지 않는다', /number=\{records\.length\} label="인바디"/.test(page), false);
  ok('  칸 수도 걸러낸 줄로 센다', /weightRows\.length > 0 \? 1 : 0/.test(page), true);
  // ★ 목록은 그대로여야 한다
  ok('★ 목록을 거르지 않는다 (dates 는 원본)',
    /const dates = useMemo\(\(\) => workouts \? Object\.keys\(workouts\)\.sort\(\)\.reverse\(\) : \[\]/.test(page), true);
}

for (const f of TMP) { try { fs.unlinkSync(path.join(ROOT, f)); } catch { /* 남아도 해롭지 않다 */ } }

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
