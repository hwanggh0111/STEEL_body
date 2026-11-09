// **유산소가 쌓여온 길** — 주마다 들인 시간 · 달린 거리 (2026-11-09).
//
//   npm run cardiotrend     (npm run check 에도 들어 있다)
//
// ── 무엇을 보는가 ──
//
// 11/05 에 유산소를 시간·거리로 적는 칸을 줬다. 그런데 **모이는 그림이 없었다** —
// 통계의 두 선은 무게를 보므로 둘 다 「유산소는 뺐습니다」라고 적어두고 있었다.
//
// 화면으로는 보기 어렵다. 반년치를 손으로 넣어야 선이 생기고, 「주 경계」와 「거리를
// 안 적은 주」는 눈으로 세어볼 수 없다 — **그려진 선은 틀려도 틀려 보이지 않는다**
// (11/05 에 도넛이 체중을 넘게 그리고 있던 것도 눈으로는 멀쩡했다). 그래서 값으로 본다.
//
// ── 특히 지키는 것 넷 ──
//
//   ⑴ ★ **시간만 적은 주는 거리 선에 없다** — 40분 걸은 주는 「0km 달린 주」가 아니다
//   ⑵ **안 한 주는 점이 없다** — 0 을 찍으면 안 한 주를 한 것처럼 보여준다
//   ⑶ **주는 월요일에 시작하고 반쪽 주는 뺀다** — `partVolume` 의 자를 **꺼내 쓴다**
//   ⑷ **이번 주는 선에 안 넣는다** — 안 끝난 주를 찍으면 늘 마지막이 꺾여 보인다
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

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
  .replace(/^\s*\/\/.*$/gm, '');

const T = bundle('src/data/cardioTrend.js', '.cardiotrend.cjs');

// 2026-11-09 는 **월요일**이다 — 그 주 월요일이 바로 오늘이다
const TODAY = '2026-11-09';
const run = (min, km) => ({ exercise: '런닝머신', minutes: min, distance_km: km });
const rowsOf = (o) => T.cardioTrend(o, { today: TODAY }).rows;
const weeks = (o) => rowsOf(o).map((r) => [r.week, r.min, r.km]);

console.log('── 주 안에서 더한다 ──');
ok('한 주에 세 번 한 것이 한 점이 된다',
  weeks({
    '2026-10-26': [run(30, 4)],
    '2026-10-28': [run(40, 5.5)],
    '2026-10-30': [run(20, 2.5)],
  }),
  [['2026-10-26', 90, 12]]);
ok('  며칠 했는지도 센다',
  T.cardioTrend({ '2026-10-26': [run(30, 4), run(10, 1)], '2026-10-28': [run(40, 5)] },
    { today: TODAY }).rows.map((r) => r.days),
  [2]);
ok('주가 다르면 점이 둘이다',
  weeks({ '2026-10-26': [run(30, 4)], '2026-11-02': [run(50, 7)] }),
  [['2026-10-26', 30, 4], ['2026-11-02', 50, 7]]);
// 분은 정수로, km 은 10m 자리까지 — 축에 0.30000000000000004 가 붙지 않는다
ok('소수 꼬리를 남기지 않는다',
  weeks({ '2026-10-26': [run(10.4, 0.1), run(10.4, 0.2)] }),
  [['2026-10-26', 21, 0.3]]);

console.log('');
console.log('── ★ 시간만 적은 주는 거리 선에 없다 ──');
// **런닝머신은 거리를 안 적어도 된다.** 그 주를 0km 로 찍으면, 열심히 걷고 온 사람에게
// 바닥을 기는 선을 보여주게 된다. 그래서 자마다 걸러내는 자리를 따로 둔다
const MIX = {
  '2026-10-12': [run(30, 4)],
  '2026-10-19': [run(40, null)],    // 거리를 안 적었다
  '2026-10-26': [run(50, 6)],
};
ok('시간 선에는 세 주가 다 있다',
  T.metricRows(rowsOf(MIX), 'min').map((r) => r.value),
  [30, 40, 50]);
ok('  거리 선에는 **두 주만** 있다',
  T.metricRows(rowsOf(MIX), 'km').map((r) => r.value),
  [4, 6]);
ok('  빈 자리는 0 이 아니라 null 이다',
  weeks(MIX).map((r) => r[2]), [4, null, 6]);
ok('거리만 적은 주도 거꾸로 같다',
  weeks({ '2026-10-26': [{ exercise: '달리기', distance_km: 5 }] }),
  [['2026-10-26', null, 5]]);
// 거리를 아예 안 적는 사람에게 **빈 칩을 주지 않는다**
ok('값이 없는 자는 칩으로 안 보여준다',
  T.metricsWith(rowsOf({ '2026-10-19': [run(40, null)], '2026-10-26': [run(50, null)] })).map((m) => m.key),
  ['min']);
ok('  둘 다 있으면 둘 다 보여준다', T.metricsWith(rowsOf(MIX)).map((m) => m.key), ['min', 'km']);

console.log('');
console.log('── 안 한 주는 점이 없다 ──');
// 0 을 넣으면 `LineChart` 가 선을 이어 **안 한 주를 한 것처럼** 보여준다
ok('가운데 쉰 주는 **점이 없다** (0 이 아니다)',
  weeks({ '2026-10-12': [run(30, 4)], '2026-10-26': [run(50, 6)] }),
  [['2026-10-12', 30, 4], ['2026-10-26', 50, 6]]);
ok('유산소가 아닌 줄은 안 센다',
  weeks({ '2026-10-26': [{ exercise: '벤치프레스', weight: '80kg', sets: 3, reps: 10 }, run(30, 4)] }),
  [['2026-10-26', 30, 4]]);
ok('  0 분 · 0 km 는 적은 것이 아니다',
  weeks({ '2026-10-26': [{ exercise: '런닝머신', minutes: 0, distance_km: 0 }] }), []);
ok('기록이 없으면 빈 선이다', weeks({}), []);
ok('  이상한 것을 줘도 안 터진다',
  [weeks(null), weeks(undefined), weeks({ '2026-10-26': null }), weeks({ x: [run(10, 1)] })],
  [[], [], [], []]);

console.log('');
console.log('── 이번 주는 선에 안 넣는다 ──');
const NOW = T.cardioTrend({ '2026-11-02': [run(30, 4)], '2026-11-09': [run(20, 3)] }, { today: TODAY });
ok('이번 주가 선에서 빠진다', NOW.rows.map((r) => r.week), ['2026-11-02']);
ok('  대신 따로 돌려준다', [NOW.current.week, NOW.current.min, NOW.current.km], ['2026-11-09', 20, 3]);
ok('이번 주 것이 없으면 null 이다',
  T.cardioTrend({ '2026-11-02': [run(30, 4)] }, { today: TODAY }).current, null);
// **앞날 기록으로 선을 그리지 않는다** — 11/05 에 네 자리에서 같은 것을 고쳤다
ok('앞날 기록은 아예 안 센다',
  weeks({ '2026-10-26': [run(30, 4)], '2026-11-16': [run(99, 99)] }),
  [['2026-10-26', 30, 4]]);

console.log('');
console.log('── 반쪽 주는 빼고, 자는 하나만 쓴다 ──');
// 창의 왼쪽 끝이 주 가운데를 자르면 그 점은 **덜 한 주처럼** 보인다.
// 92일 전은 2026-08-09(일요일)이므로, 온전히 들어오는 첫 월요일은 08-10 이다
const SPAN = { '2026-08-03': [run(30, 4)], '2026-08-10': [run(40, 5)], '2026-11-02': [run(50, 6)] };
ok('반쪽으로 걸린 앞 주는 뺀다',
  T.cardioTrend(SPAN, { today: TODAY, days: 92 }).rows.map((r) => r.week),
  ['2026-08-10', '2026-11-02']);
ok('  창을 안 주면 다 센다',
  T.cardioTrend(SPAN, { today: TODAY }).rows.map((r) => r.week),
  ['2026-08-03', '2026-08-10', '2026-11-02']);
ok('주 이름을 사람 말로 적는다', T.weekLabel('2026-11-02'), '11월 2일 주');
ok('기간 칩은 위의 두 선과 같은 것이다', T.SPANS.map((s) => s.key), ['3m', '6m', '1y']);
ok('  점 둘은 있어야 선이다', T.MIN_POINTS, 2);

console.log('');
console.log('── 한 줄로 읽어준다 ──');
const L = (rows, metric) => (T.cardioLine(rows, '6개월', metric) || {}).text || null;
const R = rowsOf({ '2026-08-03': [run(90, 10)], '2026-11-02': [run(150, 20)] });
ok('시간은 시간 말로 적는다', L(R, 'min'), '6개월 안 주 1시간 30분 → 2시간 30분 · +67%');
ok('  거리는 km 로 적는다', L(R, 'km'), '6개월 안 주 10km → 20km · +100%');
// ★ **단위를 섞지 않는다** — 11/05 에 오각형이 「체지방률 22」를 kg 으로 읽히게 한 그 모양
ok('  시간 줄에 km 가 안 섞인다', /km/.test(L(R, 'min')), false);
ok('  거리 줄에 분이 안 섞인다', /분/.test(L(R, 'km')), false);
// **꺾였으면 꺾인 그대로 적는다** — 그래프와 글이 다른 말을 하면 글을 안 믿게 된다
ok('줄었으면 줄었다고 적는다',
  L(rowsOf({ '2026-08-03': [run(150, 20)], '2026-11-02': [run(90, 10)] }), 'min'),
  '6개월 안 주 2시간 30분 → 1시간 30분 · -40%');
ok('  그대로면 그대로라고 적는다',
  L(rowsOf({ '2026-08-03': [run(90, 10)], '2026-11-02': [run(90, 10)] }), 'min'),
  '6개월 안 주 1시간 30분 → 1시간 30분 · 그대로');
// 처음 주가 가벼울 수 있다. 「+9900%」는 맞는 수인데도 **고장처럼 읽힌다**
ok('크게 늘면 배로 말한다',
  L(rowsOf({ '2026-08-03': [run(5, 1)], '2026-11-02': [run(150, 20)] }), 'min'),
  '6개월 안 주 5분 → 2시간 30분 · 30배');
ok('점이 하나면 줄을 안 적는다', L(rowsOf({ '2026-11-02': [run(90, 10)] }), 'min'), null);
// 시간만 적은 주가 거리 줄의 **첫 점이 되지 않는다** (0 에서 나누지도 않는다)
ok('거리 줄은 거리 있는 주끼리만 견준다',
  L(rowsOf({ '2026-08-03': [run(40, null)], '2026-08-10': [run(30, 4)], '2026-11-02': [run(50, 6)] }), 'km'),
  '6개월 안 주 4km → 6km · +50%');

console.log('');
console.log('── 가장 많이 한 주 ──');
ok('시간으로 가장 많은 주', T.cardioPeak(R, 'min').value, 150);
ok('  거리로는 다른 주일 수 있다',
  T.cardioPeak(rowsOf({ '2026-08-03': [run(150, 5)], '2026-11-02': [run(90, 20)] }), 'km').week,
  '2026-11-02');
ok('없으면 null 이다', T.cardioPeak([], 'min'), null);
ok('  그 자에 값이 없어도 null 이다',
  T.cardioPeak(rowsOf({ '2026-11-02': [run(40, null)] }), 'km'), null);

console.log('');
console.log('── 셈을 두 벌로 적지 않았는가 ──');
const src = codeOf(fs.readFileSync('src/data/cardioTrend.js', 'utf-8'));
// ★ 주 경계 · 반쪽 주 · 기간 칩을 **꺼내 쓴다**. 두 벌로 적으면 한쪽만 고쳐진다
ok('주 경계를 제자리에서 세지 않는다', /getDay\(\)|mondayOf/.test(src), false);
ok('  partVolume 의 자를 꺼내 쓴다', /from '\.\/partVolume'/.test(src), true);
ok('  반쪽 주도 그쪽 것을 쓴다', /firstFullWeek/.test(src), true);
ok('  기간 칩은 위의 선 것을 그대로 쓴다', /export \{ MIN_POINTS, SPANS \} from '\.\/liftTrend'/.test(src), true);
// 시간·거리를 읽는 자도 하나다 — 11/05 에 세운 `cardio.js` 다
ok('시간·거리를 제자리에서 읽지 않는다', /row\.minutes|distance_km/.test(src), false);
ok('  cardio.js 의 자를 쓴다', /from '\.\/cardio'/.test(src), true);

console.log('');
console.log('── 화면이 그 셈만 쓰는가 ──');
const ui = codeOf(fs.readFileSync('src/components/CardioTrend.jsx', 'utf-8'));
ok('계산을 화면에서 또 하지 않는다', /reduce\(|\+= /.test(ui), false);
ok('  거르는 손도 불러 쓴다', /metricRows/.test(ui), true);
ok('그리는 자를 다시 만들지 않았다', /from '\.\/charts\/LineChart'/.test(ui), true);
// ★ **단위를 그림에 같이 넘긴다** — 11/05 에 오각형이 안 넘겨서 수만 적혔다
ok('  단위를 그림에 같이 넘긴다', /unit=\{metric\.unit\}/.test(ui), true);
ok('점이 모자라면 그 말을 한다', /MIN_POINTS/.test(ui), true);
ok('  이번 주를 따로 말해준다', /이번 주/.test(ui), true);
ok('  거리를 안 적은 주를 비웠다고 말해준다', /0km/.test(ui), true);
ok('그릴 것이 없으면 아무것도 안 그린다', /return null/.test(ui), true);
// 통계 화면에 **부위 선 아래**로 붙었는가 (좁은 것 → 넓은 것)
const page = fs.readFileSync('src/pages/HistoryPage.jsx', 'utf-8');
ok('통계 화면에 붙어 있다', /<CardioTrend /.test(page), true);
ok('  부위 선 **아래**다', page.indexOf('<CardioTrend ') > page.indexOf('<PartTrend '), true);

console.log('');
if (bad > 0) { console.log(bad + '건 실패'); process.exit(1); }
console.log('다 통과');
