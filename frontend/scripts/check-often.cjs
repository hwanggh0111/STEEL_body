// **자주 하는 것 — 적는 자리가 그 사람 기록에서 이름을 꺼내는가** (2026-11-11).
//
//   npm run often        (npm run check 에도 들어 있다)
//
// ── 왜 자로 두나 ──
//
// 이 칸은 **그 사람 기록을 거슬러** 만든다. 눈으로 보려면 여러 날에 걸쳐 여러 운동을
// 적어야 하고, 차례(많이 한 순)는 날 수를 세어야 보인다.
//
// 그리고 틀리면 **엉뚱한 운동을 한 번 눌러 적게 된다.** 이름이 틀린 기록은 그 뒤로
// 최고 기록 · 추이 · 제자리가 전부 갈린다(10/28 에 「월요일   가슴」이 세 칸으로
// 보이던 그 류다). 이름을 다루는 자리는 값으로 못 박아둔다.
//
// ★ **셈을 새로 만들지 않았다.** 많이 한 순으로 주는 손은 `liftTrend.liftNames`
// 하나이고 통계가 이미 쓴다. 여기서 또 세면 **두 자리가 다른 차례를 말한다.**
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// `--root=<길>` 을 주면 그 **사본**을 본다 (되돌려-FAIL 은 사본에서 — 트리를 셋이 쓴다)
const ROOT = (process.argv.find((a) => a.startsWith('--root=')) || '').slice(7) || '.';
const at = (rel) => path.join(ROOT, rel);

const bundle = (entry, out) => {
  esbuild.buildSync({
    entryPoints: [entry], bundle: true, format: 'cjs', outfile: out,
    platform: 'node', logLevel: 'silent',
  });
  const m = require(path.resolve(out));
  fs.unlinkSync(out);
  return m;
};

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};
const codeOf = (s) => s
  .replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, '$1')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
/** `a` 가 `b` 앞에 있는가 — **둘 다 있어야** 본다 (없는 것이 통과하지 않게) */
const 앞에 = (src, a, b) => {
  const i = src.indexOf(a);
  const j = src.indexOf(b);
  return i >= 0 && j >= 0 && i < j;
};

const T = bundle(at('src/data/liftTrend.js'), '.often-lift.cjs');
const TODAY = '2026-11-11';

let seq = 0;
const row = (exercise, weight, date) =>
  ({ id: (seq += 1), date, exercise, weight, sets: 4, reps: 8, created_at: `${date}T19:00:00.000Z` });
const days = (...rows) => {
  const out = {};
  for (const r of rows) (out[r.date] = out[r.date] || []).unshift(r);
  return out;
};

console.log('── 많이 한 순으로 온다 ──');
const 표 = days(
  // 벤치프레스 3일 · 스쿼트 2일 · 풀업(맨몸) 2일 · 바벨 컬 1일
  row('벤치프레스', '80', '2026-11-02'), row('벤치프레스', '80', '2026-11-05'), row('벤치프레스', '82.5', '2026-11-09'),
  row('스쿼트', '100', '2026-11-02'), row('스쿼트', '100', '2026-11-09'),
  row('풀업', '', '2026-11-05'), row('풀업', '', '2026-11-09'),
  row('바벨 컬', '20', '2026-11-09'),
);
ok('**많이 한 순**', T.liftNames(표, TODAY, 8, { metric: 'any' }), ['벤치프레스', '스쿼트', '풀업']);
ok('  ★ 맨몸도 들어온다 (`metric: any`)', T.liftNames(표, TODAY, 8, { metric: 'any' }).includes('풀업'), true);
ok('  한 번 해본 것은 「자주」가 아니다 (서로 다른 날 둘 이상)',
  T.liftNames(표, TODAY, 8, { metric: 'any' }).includes('바벨 컬'), false);
ok('  같은 날수면 이름 차례 (흔들리지 않는다)',
  T.liftNames(표, TODAY, 8, { metric: 'any' }).slice(1), ['스쿼트', '풀업']);
ok('  여덟 개까지만', T.liftNames(표, TODAY, 2, { metric: 'any' }), ['벤치프레스', '스쿼트']);

console.log('');
console.log('── 처음 온 사람에게는 **빈 배열**이다 (칸을 안 그린다) ──');
ok('빈 판', T.liftNames({}, TODAY, 8, { metric: 'any' }), []);
ok('  하루만 적은 사람', T.liftNames(days(row('벤치프레스', '80', '2026-11-11')), TODAY, 8, { metric: 'any' }), []);
ok('  같은 날 여러 줄도 한 날이다',
  T.liftNames(days(row('벤치프레스', '80', '2026-11-11'), row('벤치프레스', '85', '2026-11-11')), TODAY, 8, { metric: 'any' }), []);
ok('  기록이 null', T.liftNames(null, TODAY, 8, { metric: 'any' }), []);

console.log('');
console.log('── 앞날 줄은 안 센다 ──');
// 달력의 「적기」는 앞날을 막지 않는다(내일 할 것을 미리 적는 사람이 있다). 그 줄로
// 「자주 하는 것」을 만들면 **하지도 않은 운동**이 맨 앞에 선다
const 앞날 = days(
  row('데드리프트', '140', '2026-11-20'), row('데드리프트', '140', '2026-11-21'), row('데드리프트', '140', '2026-11-22'),
  row('벤치프레스', '80', '2026-11-02'), row('벤치프레스', '80', '2026-11-09'),
);
ok('앞날에 적어둔 것은 안 온다', T.liftNames(앞날, TODAY, 8, { metric: 'any' }), ['벤치프레스']);

console.log('');
console.log('── 기본값은 그대로다 (통계의 선 그리는 자리) ──');
// `metric` 을 안 주면 **무게 운동만** 온다 — 맨몸은 선이 없다(`liftTrend` 머리글)
ok('기본값은 무게 운동만', T.liftNames(표, TODAY, 8), ['벤치프레스', '스쿼트']);

console.log('');
console.log('── ★ 적는 화면이 그 손을 쓰는가 ──');
const train = codeOf(fs.readFileSync(at('src/pages/TrainPage.jsx'), 'utf-8'));
ok('`liftNames` 를 불러 쓴다', /import \{ liftNames \} from '\.\.\/data\/liftTrend'/.test(train), true);
ok('  맨몸까지 센다', /liftNames\(workouts, today, 8, \{ metric: 'any' \}\)/.test(train), true);
ok('  ★ 이름을 **제자리에서 다시 세지 않는다**',
  /Object\.(values|entries)\(workouts\)[\s\S]{0,200}exercise/.test(train), false);
ok('  누르면 그 운동으로 바꾼다', /onClick=\{\(\) => pick\(n\)\}/.test(train), true);
ok('  하나도 없으면 칸을 안 그린다', /often\.length > 0 &&/.test(train), true);
ok('  운동 바꾸는 자리 안에 있다 (찾는 칸보다 위)',
  앞에(train, 'often.map((n)', '<ExerciseFinder onPick={pick}'), true);
// 찾는 부품은 그대로 둔다 — 이름이 생각 안 날 때 치는 자리다(9/1 에 떼어둔 부품)
ok('  찾는 칸을 치우지 않았다', /<ExerciseFinder onPick=\{pick\}/.test(train), true);

console.log('');
if (bad > 0) { console.log(bad + '건 실패'); process.exit(1); }
console.log('다 통과');
