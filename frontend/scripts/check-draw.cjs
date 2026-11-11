// **그림 자리의 셈** — 도넛 조각과 오각형 점이 맞는 자리에 놓이는가 (2026-11-05).
//
//   npm run draw     (npm run check 에도 들어 있다)
//
// ── 왜 자로 두나 ──
//
// **틀린 그림은 틀려 보이지 않는다.** 도넛은 무엇을 먹여도 꽉 찬 원이고 오각형은
// 무엇을 먹여도 그럴듯한 별이다. 11/04 에 체성분 도넛이 **체중을 넘게** 그리고
// 있던 것도 눈으로는 멀쩡했다 — 수를 손으로 더해봐야 드러났다.
//
// 그래서 그려진 모양을 보지 않고 **각도와 좌표를 값으로 본다.** 이 자를 세우면서
// 넷을 잡았다 —
//
//   ⑴ 오각형이 **단위를 안 적었다** — 표는 「22%」, 그림은 「22」
//   ⑵ **좁은 폰에서 양옆 값이 잘렸다** — 자리를 76px 로 박아두고 `Math.max(40, …)`
//      이 그 자리를 다시 먹었다 (접은 폴더블 280px)
//   ⑶ **값 하나가 숫자가 아니면 다각형이 통째로 사라졌다** (`NaN ?? 0` 은 `NaN`)
//   ⑷ 도넛에서 **사이 벌린 폭보다 좁은 조각이 사라졌다** — 범례에는 적혀 있다
//
// 그리고 자를 짜다 **내 코드의 버그**를 하나 더 잡았다 — 라벨은 그물 **밖 18px**
// 자리에 적히는데, 옆자리를 잡는 셈에서 그 18px 을 빼놓지 않았다. 자리를 잡아놓고도
// 글자가 나간다.
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
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const G = bundle('src/data/chartGeom.js', '.geom.cjs');
const C = bundle('src/data/composition.js', '.geomcomp.cjs');
const r3 = (n) => Number(n.toFixed(3));

// ── 도넛 ────────────────────────────────────────────────
console.log('── 도넛: 앱 예시 숫자 (체중 73 · 체지방률 16% · 골격근 33) ──');
const comp = C.compositionOf({ weight: 73, fat_pct: 16, muscle_kg: 33 });
const d = G.donutSlices(comp.parts, { total: comp.total });

ok('조각 셋', d.slices.map((s) => s.name), ['골격근', '체지방', '기타(뼈·장기)']);
// ★ **한 바퀴를 꽉 채운다** — 조각 폭 + 사이 벌린 것 = 2π.
//    조각 셋이 틈 셋(0.03)을 쓰므로 폭의 합은 2π − 0.09 다
ok('**조각 폭 + 틈 = 한 바퀴**',
  r3(d.slices.reduce((s, x) => s + x.span, 0) + d.slices.length * d.gap), r3(G.TAU));
// ★ **각도 비율 = 값 비율.** 그림이 비율로 거짓말하지 않는가
ok('**각도 비율이 값 비율과 같다**',
  d.slices.map((s) => Number(((s.span + d.gap) / G.TAU).toFixed(4))),
  d.slices.map((s) => Number((s.value / d.sum).toFixed(4))));
ok('12시에서 시작한다', r3(d.slices[0].from - d.gap / 2), r3(G.TOP));
ok('  마지막 조각이 12시로 돌아온다', r3(d.slices[2].to + d.gap / 2), r3(G.TOP + G.TAU));
ok('조각 합이 가운데 수와 같다', [d.sum, d.center, d.over], [73, 73, 0]);
ok('  늘려 그린 조각이 없다', d.slices.filter((s) => s.widened).length, 0);

console.log('');
console.log('── 도넛: 아주 작은 조각 (여기서 조각이 사라졌다) ──');
// 체중 73 · 골격근 33 · 체지방률 54.6% → 체지방 39.9, 남는 것 **0.1kg**.
// 0.1/73 × 2π = 0.0086rad < 틈 0.03 → 폭이 음수가 되어 예전에는 0.001rad 로 눌렸다
const tinyComp = C.compositionOf({ weight: 73, fat_pct: 54.6, muscle_kg: 33 });
ok('범례에 0.1kg 이 적힌다', tinyComp.parts.map((p) => p.value).slice(-1), [0.1]);
const tiny = G.donutSlices(tinyComp.parts, { total: tinyComp.total });
const small = tiny.slices[tiny.slices.length - 1];
ok('**그림에도 보인다 (최소 폭)**', [small.span >= G.DONUT_MIN, small.widened], [true, true]);
// 늘려 그려도 **자리는 참값**이다 — 뒤의 조각이 밀려나지 않는다
ok('  자리는 참값 비율 그대로다',
  r3(small.from - tiny.gap / 2), r3(G.TOP + G.TAU * (1 - 0.1 / 73)));

console.log('');
console.log('── 도넛: 모자란 값 · 이상한 값 ──');
ok('빈 것은 안 그린다', G.donutSlices([]).slices.length, 0);
ok('  없는 것·0·음수는 조각이 아니다',
  G.donutSlices([null, { value: 0 }, { value: -3 }, { value: 'x' }]).slices.length, 0);
ok('  글자로 와도 숫자로 읽는다', G.donutSlices([{ value: '30' }, { value: '10' }]).sum, 40);
const one = G.donutSlices([{ name: '골격근', value: 30 }], { total: 30 });
ok('조각 하나는 원 하나다 (호로는 못 그린다)', [one.full, r3(one.slices[0].span)], [true, r3(G.TAU)]);
// 조각이 많으면 **틈을 줄인다** — 안 줄이면 벌린 것만 더해 한 바퀴를 먹는다
const many = G.donutSlices(Array.from({ length: 60 }, () => ({ value: 1 })));
ok('조각이 많으면 틈을 줄인다', many.gap < G.DONUT_GAP, true);
ok('  그래도 한 바퀴다', r3(many.slices.reduce((s, x) => s + x.span, 0) + 60 * many.gap), r3(G.TAU));
// 잘못 적은 값 — 조각 합이 체중을 넘는다. **얼마나 넘었는지 말한다** (화면이 그 수로 적는다)
const over = G.donutSlices([{ value: 50 }, { value: 18 }], { total: 60 });
ok('넘으면 얼마나 넘었는지 준다', over.over, 8);

console.log('');
console.log('── 오각형: 앱 예시 숫자 (78→73kg · 22→16% · 38→41L) ──');
const SERIES = [{ key: 'before', label: '과거' }, { key: 'after', label: '현재' }];
const LIST = [
  { subject: '체중', unit: 'kg', before: 78, after: 73 },
  { subject: '골격근량', unit: 'kg', before: 30, after: 33 },
  { subject: '체지방률', unit: '%', before: 22, after: 16 },
  { subject: '체수분', unit: 'L', before: 38, after: 41 },
  { subject: 'BMI', unit: '', before: 25.1, after: 23.5 },
];
const g = G.radarGeom(LIST, SERIES, { width: 320, height: 260 });
// ★★ **단위를 적는다** — 표는 「22%」라고 적는데 그림은 「22」라고만 적고 있었다.
//    체지방률 22 → 16 을 kg 으로 읽으면 6kg 을 뺀 것이 된다
ok('**축마다 단위가 적힌다**', g.axes.map((a) => a.valueText),
  ['78 → 73kg', '30 → 33kg', '22 → 16%', '38 → 41L', '25.1 → 23.5']);
ok('축 다섯', g.axes.map((a) => a.subject), ['체중', '골격근량', '체지방률', '체수분', 'BMI']);
// ★ **같은 축에서 길이 비율 = 값 비율** (축마다 눈금이 따로인 것이 이 그림의 규칙이다)
const lenOf = (key, i) => {
  const [x, y] = g.points[key][i];
  return Math.sqrt((x - g.cx) ** 2 + (y - g.cy) ** 2);
};
ok('**같은 축에서 길이 비율이 값 비율과 같다**',
  r3(lenOf('after', 0) / lenOf('before', 0)), r3(73 / 78));
// 그 축에서 큰 쪽은 늘 1/1.15 = 0.8696 자리에 선다
ok('  큰 쪽은 그물의 87% 자리다', r3(lenOf('before', 0) / g.r), r3(1 / 1.15));
ok('첫 축은 12시다', r3(g.axes[0].angle), r3(G.TOP));

console.log('');
console.log('── 오각형: 글자가 그림 밖으로 안 나가는가 ──');
// 라벨의 왼쪽 끝 · 오른쪽 끝을 재서 그림 안에 있는지 본다.
// **여기가 접은 폴더블(280px)에서 잘렸던 자리다** — 화면 폭에서 바깥 여백 40 ·
// 카드 안쪽 24 를 빼면 216px 이다
const inBox = (geom, w) => geom.axes.every((a) => {
  const left = a.anchor === 'start' ? a.lx : a.anchor === 'end' ? a.lx - a.width : a.lx - a.width / 2;
  return left >= -0.01 && left + a.width <= w + 0.01;
});
[[320, '넉넉한 폭'], [296, '360px 폰'], [256, '320px 폰'], [216, '접은 폴더블'], [200, '제일 좁은 자리']]
  .forEach(([w, label]) => {
    const geom = G.radarGeom(LIST, SERIES, { width: w, height: 260 });
    ok(`**${label} (${w}px) 에서 안 잘린다**`, inBox(geom, w), true);
  });
const narrow = G.radarGeom(LIST, SERIES, { width: 216, height: 260 });
ok('좁으면 값을 그물 밑에 모은다', narrow.tight, true);
ok('  그때도 그물은 그린다', narrow.r >= 24, true);
ok('넉넉하면 축 옆에 적는다', g.tight, false);
// 아주 긴 축 이름 — 잡아둔 자리를 넘는다. 그래도 글자는 안 잘린다
const long = G.radarGeom(
  LIST.map((x, i) => (i === 2 ? { ...x, subject: '체지방률(복부 포함)' } : x)), SERIES, { width: 256, height: 260 });
ok('축 이름이 아주 길어도 안 잘린다', inBox(long, 256), true);

console.log('');
console.log('── 오각형: 이상한 값 ──');
// ★★ 값 하나가 숫자가 아니면 **다각형이 통째로 사라졌다** — `NaN ?? 0` 은 `NaN` 이고
//    좌표가 "NaN,NaN" 이 되면 SVG 는 그 점만 버리지 않고 다각형 전체를 안 그린다.
//    그물만 남은 그림을 사람은 「변화가 없구나」로 읽는다
const dirty = G.radarGeom(
  LIST.map((x, i) => (i === 3 ? { ...x, after: '41L' } : x)), SERIES, { width: 320, height: 260 });
ok('**숫자로 안 읽히는 축은 뺀다**', dirty.axes.map((a) => a.subject), ['체중', '골격근량', '체지방률', 'BMI']);
ok('  뺐다고 말할 거리를 준다', dirty.dropped, ['체수분']);
ok('  남은 좌표는 다 숫자다',
  Object.values(dirty.points).every((pts) => pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))), true);
ok('  다각형이 그려진다', typeof G.pointsAttr(dirty.points.after), 'string');
// 축이 셋 미만이면 오각형이 아니다 — 안 그린다
ok('축이 둘이면 안 그린다', G.radarGeom(LIST.slice(0, 2), SERIES, {}).ok, false);
ok('  빈 것·없는 것도 안 터진다',
  [G.radarGeom(null, SERIES, {}).ok, G.radarGeom(LIST, null, {}).ok], [false, false]);
// 값이 다 0 인 축 (인바디를 0 으로 적을 수는 없지만, 0 으로 나누면 좌표가 NaN 이 된다)
const zero = G.radarGeom(LIST.map((x) => ({ ...x, before: 0, after: 0 })), SERIES, {});
ok('값이 다 0 이어도 0 으로 안 나눈다',
  zero.points.after.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)), true);
// 음수는 그물 안쪽(중심)으로 — 바깥으로 그리면 「제일 큰 값」으로 읽힌다
const neg = G.radarGeom(LIST.map((x) => ({ ...x, before: -5 })), SERIES, {});
ok('  음수를 바깥으로 그리지 않는다',
  neg.points.before.every(([x, y]) => Math.abs(x - neg.cx) < 0.01 && Math.abs(y - neg.cy) < 0.01), true);
ok('좌표가 하나라도 숫자가 아니면 아예 안 그린다',
  G.pointsAttr([[1, 2], [NaN, 3], [4, 5]]), null);

console.log('');
console.log('── 그리는 쪽이 그 셈만 쓰는가 ──');
const donut = codeOf(fs.readFileSync('src/components/charts/Donut.jsx', 'utf-8'));
ok('도넛이 각도를 제자리에서 세지 않는다', /value \/ sum|TAU/.test(donut), false);
ok('  셈 자리를 불러 쓴다', /donutSlices\(/.test(donut), true);
const radar = codeOf(fs.readFileSync('src/components/charts/Radar.jsx', 'utf-8'));
ok('오각형도 좌표를 제자리에서 세지 않는다', /Math\.cos|Math\.sin/.test(radar), false);
ok('  셈 자리를 불러 쓴다', /radarGeom\(/.test(radar), true);
ok('  좌표는 거르는 손을 거쳐 나간다', /pointsAttr\(/.test(radar), true);
const page = codeOf(fs.readFileSync('src/pages/ComparePage.jsx', 'utf-8'));
// ★ 단위를 안 넘기면 그림이 다시 단위 없이 적는다
ok('비교 화면이 **단위를 같이 넘긴다**', /unit: c\.unit/.test(page), true);

console.log('');
console.log('── 축에 적히는 날짜가 그 자리에 들어가는가 ── (2026-11-11)');
//
// 꺾은선의 날짜 자리는 **46px 간격**이다(`charts/useWidth.js` 의 `labelEvery`).
// 10px 글씨로 `2026-10-03`(열 글자)은 그만큼을 꽉 채워 **좁은 폰에서 옆 날짜와
// 맞닿는다.** 그런데 겹침을 보는 자(`check-data.cjs`)는 **`08-14`(다섯 글자)** 를
// 넣어 재므로 그 겹침을 **영영 못 본다** — 자가 보는 글자와 화면에 적히는 글자가
// 다른 자리였다. 11/11 에 운동 추이 그림이 실제로 통째로 넘기고 있었고,
// 같은 그림을 쓰는 인바디 화면은 줄여 넘기고 있었다 (**한 그림, 두 가지**).
//
// 그래서 **넘기는 쪽**을 본다 — 날짜 키를 통째로 축에 넘기는 자리가 있으면 FAIL.
{
  const 넘기는자리 = [
    ['운동 추이', 'src/components/LiftTrend.jsx'],
    ['인바디 추이', 'src/pages/InbodyPage.jsx'],
  ];
  const 통째로 = [];
  for (const [이름, 파일] of 넘기는자리) {
    const code = codeOf(fs.readFileSync(파일, 'utf-8'));
    // `date: p.date` 처럼 **자르지 않고** 넘기는 자리. `slice(5)` 가 붙으면 통과
    for (const m of code.matchAll(/date:\s*([A-Za-z_$][\w$]*)\.date(\.slice\(\d+\))?/g)) {
      if (!m[2]) 통째로.push(이름 + ' — ' + m[0]);
    }
  }
  ok('날짜를 통째로 축에 넘기는 자리', 통째로, []);
  console.log('     ↑ 걸리면 좁은 폰에서 축의 날짜가 맞닿는다. `.slice(5)` 로 달·일만');
  console.log('       넘긴다 — 날짜 통째는 카드의 글줄과 말풍선이 이미 적어준다');
}

console.log('');
if (bad > 0) { console.log(bad + '건 실패'); process.exit(1); }
console.log('다 통과');
