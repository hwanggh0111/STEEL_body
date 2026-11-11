// **몇 주째 제자리인가** — 그 셈이 쉰 것과 제자리를 가리는가 (2026-11-11).
//
//   npm run plateau      (npm run check 에도 들어 있다)
//
// ── 왜 자로 두나 ──
//
// 「4주째 제자리」를 눈으로 보려면 **넉 주에 걸친 기록을 여러 판** 만들어야 한다.
// 화면에서 확인할 수 있는 셈이 아니다(`npm run nextstep` 과 같은 까닭).
//
// 그리고 이 셈은 **사람에게 사실을 통보한다.** 틀리면 「8주째 제자리」를 두 달 쉬고
// 돌아온 사람에게 말하게 된다. 제자리와 쉰 것을 가리는 선은 값으로 못 박아둔다.
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// ★ `--root=<길>` 을 주면 **그 사본**을 본다. 되돌려-FAIL 을 볼 때 운영 파일을
// 그 자리에서 고치지 않는다 — 이 트리는 셋이 나눠 쓴다 (11/09 에 서로의 미커밋
// 수정을 날린 일이 있다 · `npm run weighthands` 와 같은 손이다)
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

const P = bundle(at('src/data/plateau.js'), '.plateau.cjs');
const T = bundle(at('src/data/liftTrend.js'), '.lifttrend.cjs');
const TODAY = '2026-11-11';

let seq = 0;
const row = (exercise, weight, reps, date, { sets = 4 } = {}) =>
  ({ id: (seq += 1), date, exercise, weight, sets, reps, created_at: `${date}T19:00:00.000Z` });
const days = (...rows) => {
  const out = {};
  for (const r of rows) (out[r.date] = out[r.date] || []).unshift(r);
  return out;
};
/** 그 날에서 `n` 일 전 */
const back = (n, from = TODAY) => {
  const d = new Date(`${from}T00:00:00`);
  d.setDate(d.getDate() - n);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const 짧 = (d) => String(d).slice(5).replace('-', '/');

console.log('── 선이 평평하면 제자리라고 말한다 ──');
// 35일 전에 80kg 을 세우고, 그 뒤 다섯 판을 같은 무게로 했다
const flat = days(
  row('벤치프레스', '80', 8, back(35)),
  row('벤치프레스', '80', 8, back(28)),
  row('벤치프레스', '80', 7, back(21)),
  row('벤치프레스', '80', 8, back(14)),
  row('벤치프레스', '80', 8, back(7)),
  row('벤치프레스', '80', 8, back(2)),
);
const f = P.plateauOf(flat, '벤치프레스', TODAY);
ok('**제자리라고 말한다**', [f?.kind, f?.weeks, f?.after], ['flat', 4, 5]);
ok('  무게로 봤다', [f?.metric, f?.unit, f?.best.value], ['kg', 'kg', 80]);
ok('  최고를 세운 날은 **처음 그 값에 닿은 날**', f?.best?.date, back(35));
ok('  한 줄로 읽어준다', String(P.plateauLine(f)).startsWith('4주째 제자리 — '), true);
ok('  몇 판을 더 못 올렸는지 적는다', /그 뒤 5판은 더 못 올렸어요$/.test(P.plateauLine(f)), true);

console.log('');
console.log('── ★ 쉰 것을 제자리라고 말하지 않는다 ──');
// 같은 평평한 선인데 **마지막 판이 40일 전**이다 — 이 사람은 제자리가 아니라 안 했다
const rest = days(
  row('벤치프레스', '80', 8, back(68)),
  row('벤치프레스', '80', 8, back(54)),
  row('벤치프레스', '80', 8, back(40)),
);
const r = P.plateauOf(rest, '벤치프레스', TODAY);
ok('**쉰 것이다**', r?.kind, 'rest');
ok('  날수를 세어 말하고 판정은 안 한다', P.plateauLine(r),
  '40일째 안 했어요 — 마지막은 ' + 짧(back(40)) + ' 80kg. 제자리인지는 다시 해봐야 알아요');
ok('  「제자리」라는 말을 안 쓴다', /\d+주째 제자리/.test(P.plateauLine(r)), false);
ok('  모아 보여주는 칸에도 안 섞인다', P.plateauList(rest, TODAY).length, 0);
// 선: 2주까지는 쉰 것이 아니다 (주 1회 하는 사람)
const 주1 = days(
  row('데드리프트', '100', 5, back(42)),
  row('데드리프트', '100', 5, back(28)),
  row('데드리프트', '100', 5, back(14)),
);
ok('  14일 전이면 아직 쉰 것이 아니다', P.plateauOf(주1, '데드리프트', TODAY)?.kind, 'flat');
const 주1늦 = days(
  row('데드리프트', '100', 5, back(43)),
  row('데드리프트', '100', 5, back(29)),
  row('데드리프트', '100', 5, back(15)),
);
ok('  하루만 더 비면 쉰 것이다', P.plateauOf(주1늦, '데드리프트', TODAY)?.kind, 'rest');

console.log('');
console.log('── ★ 최고를 세운 뒤 한 판도 안 했으면 제자리가 아니다 ──');
// 최고가 마지막 판이다 — 「제자리」라고 할 근거가 그 사람 기록에 없다
const 최고가마지막 = days(
  row('스쿼트', '90', 5, back(40)),
  row('스쿼트', '95', 5, back(10)),
);
ok('올린 것이 마지막이면 제자리가 아니다', P.plateauOf(최고가마지막, '스쿼트', TODAY)?.kind, 'up');
// 한 판만 더 한 사람도 아직 아니다 (MIN_AFTER = 2)
const 한판만 = days(
  row('스쿼트', '95', 5, back(40)),
  row('스쿼트', '95', 5, back(5)),
);
ok('  그 뒤 한 판뿐이면 아직 말하지 않는다',
  [P.plateauOf(한판만, '스쿼트', TODAY)?.kind, P.MIN_AFTER], ['up', 2]);

console.log('');
console.log('── 늘고 있는 사람에게는 아무 말도 하지 않는다 ──');
const up = days(
  row('바벨 로우', '60', 8, back(28)),
  row('바벨 로우', '62.5', 8, back(21)),
  row('바벨 로우', '65', 8, back(14)),
  row('바벨 로우', '67.5', 8, back(7)),
);
const u = P.plateauOf(up, '바벨 로우', TODAY);
ok('**말을 걸지 않는다**', [u?.kind, P.plateauLine(u)], ['up', null]);
ok('  모아 보여주는 칸도 비어 있다', P.plateauList(up, TODAY), []);
// 28일 선. ★ **재는 구간은 「최고날 → 마지막 판」**이다 — 오늘까지가 아니다.
// 오늘까지로 재면 **쉰 날이 제자리 기간에 들어간다**(쉼은 `idle` 이 따로 센다).
// 그래서 마지막 판이 어제면 최고는 **29일 전**이어야 28일이 된다
const 이십칠 = days(row('풀다운', '55', 10, back(28)), row('풀다운', '55', 10, back(14)), row('풀다운', '55', 10, back(1)));
const 이십팔 = days(row('풀다운', '55', 10, back(29)), row('풀다운', '55', 10, back(14)), row('풀다운', '55', 10, back(1)));
ok('  27일은 아직 제자리가 아니다', [P.plateauOf(이십칠, '풀다운', TODAY)?.kind, P.plateauOf(이십칠, '풀다운', TODAY)?.days], ['up', 27]);
ok('  28일이 되면 제자리다',
  [P.plateauOf(이십팔, '풀다운', TODAY)?.kind, P.plateauOf(이십팔, '풀다운', TODAY)?.days, P.FLAT_DAYS], ['flat', 28, 28]);

console.log('');
console.log('── ★ 맨몸을 그림 밖에 두지 않는다 — 횟수로 본다 ──');
const 맨몸 = days(
  row('풀업', '', 12, back(35)),
  row('풀업', '', 12, back(28)),
  row('풀업', '', 11, back(14)),
  row('풀업', '', 12, back(3)),
);
const b = P.plateauOf(맨몸, '풀업', TODAY);
ok('**횟수로 제자리를 말한다**', [b?.kind, b?.metric, b?.unit, b?.best.value], ['flat', 'reps', '회', 12]);
ok('  「못 늘렸어요」로 적는다 (무게가 아니다)', /12회 가 가장 많고, 그 뒤 3판은 더 못 늘렸어요$/.test(P.plateauLine(b)), true);
ok('  kg 이라고 적지 않는다', /kg/.test(P.plateauLine(b)), false);
// 무게가 한 줄이라도 있으면 무게로 본다 (가중 풀업)
const 가중 = days(
  row('풀업', '', 12, back(35)),
  row('풀업', '10', 8, back(28)),
  row('풀업', '10', 8, back(3)),
);
ok('  무게를 적은 줄이 있으면 무게로 본다', P.plateauOf(가중, '풀업', TODAY)?.metric, 'kg');
// 0회 · 빈 값은 횟수가 아니다 — 안 한 것을 한 것으로 그리지 않는다
const 영회 = days(row('플랭크', '', 0, back(35)), row('플랭크', '', null, back(3)));
ok('  0회 · 빈 값은 점이 아니다', P.plateauOf(영회, '플랭크', TODAY), null);

console.log('');
console.log('── 말할 것이 없으면 아무것도 말하지 않는다 ──');
ok('빈 판', [P.plateauOf({}, '벤치프레스', TODAY), P.plateauList({}, TODAY)], [null, []]);
ok('  처음 온 사람 (한 판뿐)',
  P.plateauOf(days(row('벤치프레스', '60', 10, back(1))), '벤치프레스', TODAY), null);
ok('  한 주뿐 (같은 날 여러 줄도 한 날이다)',
  P.plateauOf(days(row('벤치프레스', '60', 10, back(1)), row('벤치프레스', '65', 8, back(1))), '벤치프레스', TODAY), null);
ok('  이름이 없거나 없는 운동', [P.plateauOf(flat, '', TODAY), P.plateauOf(flat, '없는운동', TODAY)], [null, null]);
ok('  기록이 null · 망가진 날짜', [P.plateauOf(null, '벤치프레스', TODAY), P.plateauOf({ 'x-x': null }, '벤치프레스', TODAY)], [null, null]);
ok('  상태가 없으면 줄도 없다', [P.plateauLine(null), P.plateauLine(undefined)], [null, null]);
ok('  오늘을 안 주면 쉰 것을 가릴 수 없다 (제자리까지만 말한다)',
  [P.plateauOf(rest, '벤치프레스', null)?.kind, P.plateauOf(rest, '벤치프레스', null)?.idle], ['flat', null]);

console.log('');
console.log('── 앞날 줄은 안 센다 ──');
const 앞날 = days(
  row('벤치프레스', '80', 8, back(35)),
  row('벤치프레스', '80', 8, back(17)),
  row('벤치프레스', '80', 8, back(3)),
  row('벤치프레스', '120', 8, back(-7)),      // 일주일 뒤에 120kg 을 적어둔 사람
);
const fut = P.plateauOf(앞날, '벤치프레스', TODAY);
ok('앞날 최고는 최고가 아니다', [fut?.kind, fut?.best?.value, fut?.last?.date], ['flat', 80, back(3)]);

console.log('');
console.log('── 모아 보여주는 칸 ──');
const 여럿 = days(
  row('벤치프레스', '80', 8, back(60)), row('벤치프레스', '80', 8, back(30)), row('벤치프레스', '80', 8, back(2)),
  row('스쿼트', '100', 5, back(40)), row('스쿼트', '100', 5, back(20)), row('스쿼트', '100', 5, back(1)),
  row('풀업', '', 12, back(50)), row('풀업', '', 12, back(25)), row('풀업', '', 12, back(4)),
  row('바벨 컬', '20', 10, back(14)), row('바벨 컬', '22.5', 10, back(1)),     // 늘고 있다
);
const list = P.plateauList(여럿, TODAY);
ok('**오래된 것이 먼저다**', list.map((x) => [x.name, x.weeks]), [['벤치프레스', 8], ['풀업', 6], ['스쿼트', 5]]);
ok('  늘고 있는 운동은 안 들어간다', list.some((x) => x.name === '바벨 컬'), false);
ok('  몇 개까지만 준다', P.plateauList(여럿, TODAY, { limit: 2 }).map((x) => x.name), ['벤치프레스', '풀업']);

console.log('');
console.log('── 읽는 손이 한 벌인가 ──');
// ★ 날짜별 최고를 모으는 셈은 `liftTrend.trendOf` 하나다. 여기서 또 세면 손이 둘이 된다
const src = fs.readFileSync(at('src/data/plateau.js'), 'utf-8');
const code = src.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, '$1').replace(/^\s*\/\/.*$/gm, '');
ok('`trendOf` 를 불러 쓴다', /import \{[^}]*trendOf[^}]*\} from '\.\/liftTrend'/.test(code), true);
ok('  날짜를 제자리에서 다시 돌지 않는다', /Object\.entries\(workouts/.test(code), false);
ok('  날수 셈도 불러 쓴다 (`daysBetween`)', /import \{ daysBetween \} from '\.\/personalRecord'/.test(code), true);
ok('  밀리초 86400000 을 직접 쓰지 않는다', /86400000/.test(code), false);
// `trendOf` 의 `metric` 은 **무게 쪽을 안 건드린다** — 기본값이 그대로여야 한다
ok('`metric` 기본값은 무게다 (맨몸은 선이 없다)', T.trendOf(맨몸, '풀업', { today: TODAY }), []);
ok('  무게 선은 그대로다', T.trendOf(flat, '벤치프레스', { today: TODAY }).length, 6);
ok('  고를 수 있는 이름도 그대로다 (맨몸은 빠진다)',
  [T.liftNames(맨몸, TODAY), T.liftNames(맨몸, TODAY, 12, { metric: 'any' })], [[], ['풀업']]);

console.log('');
if (bad > 0) { console.log(bad + '건 실패'); process.exit(1); }
console.log('다 통과');
