// **체성분 비율** — 체중을 쪼개는 그림이 맞게 쪼개는가 (2026-11-04).
//
//   npm run composition     (npm run check 에도 들어 있다)
//
// ── 무엇이 틀렸었나 ──
//
// 도넛에 조각 넷을 넣고 있었다: 골격근 · 체지방 · **체수분** · 기타(뼈·장기).
// 그런데 **체수분은 골격근과 체지방 안에 이미 들어 있는 물**이다(근육의 70%쯤).
// 체중을 쪼개는 그림에 또 넣으면 이중 계산이다.
//
// 앱이 스스로 적어둔 예시 숫자(`ComparePage` 의 `SAMPLE_AFTER` — 체중 73 ·
// 체지방률 16% · 골격근 33 · 체수분 41L)로 재보면 셋이 어긋난다 —
//
//   조각 합      85.7kg   ← 도넛 가운데에는 73kg 이 적힌다
//   기타(뼈·장기) −12.7kg → `etc > 0` 이 거짓이라 **영영 안 나온다**
//   범례의 체지방 13.7%   ← 사람이 적어 넣은 체지방률은 **16%**
//
// 마지막이 특히 나쁘다 — **체지방률은 인바디에서 가장 많이 보는 수**인데, 자기가
// 적은 값이 그림에서 다르게 보인다.
//
// ── 왜 자로 두나 ──
//
// 눈으로는 **맞는 그림처럼 보인다.** 도넛은 늘 꽉 찬 원이고(합을 100%로 그린다)
// 색도 예쁘게 나온다. 어긋난 것은 **수를 손으로 더해봐야** 드러난다.
// 그래서 값으로 본다 — 이 셈이 화면 파일 안에 있던 동안에는 자를 댈 수가 없었다.
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

const C = bundle('src/data/composition.js', '.comp.cjs');

// 앱이 스스로 적어둔 예시 숫자다 (`ComparePage` 의 `SAMPLE_AFTER`)
const SAMPLE = { weight: 73, fat_pct: 16, muscle_kg: 33, water_l: 41 };

console.log('── 앱 예시 숫자로 ──');
const c = C.compositionOf(SAMPLE);
ok('조각은 셋이다 (체수분은 조각이 아니다)', c.parts.map((p) => p.name), ['골격근', '체지방', '기타(뼈·장기)']);
// ★ **조각 합이 체중과 같아야 한다** — 체중을 쪼개는 그림이다
ok('**조각 합이 체중과 같다**', c.parts.reduce((s, p) => s + p.value, 0), 73);
ok('  가운데에 적는 수도 체중이다', c.total, 73);
// ★ **체지방률이 적어 넣은 값과 같아야 한다** — 가장 많이 보는 수다
ok('**체지방률이 적어 넣은 값과 같다**', c.parts.find((p) => p.name === '체지방').pct, 16);
ok('  골격근도 체중 기준이다', c.parts.find((p) => p.name === '골격근').pct, 45.2);
// ★ **기타(뼈·장기)가 나온다** — 여태 영영 안 나왔다
ok('**기타(뼈·장기)가 나온다**', c.parts.find((p) => p.name === '기타(뼈·장기)').value, 28.3);
ok('  퍼센트도 다 더하면 100 쯤이다',
  Math.round(c.parts.reduce((s, p) => s + p.pct, 0)), 100);
// 체수분은 숫자로 들고 있다 — 화면이 「뺐어요」라고 말한다
ok('체수분은 따로 들고 있는다', c.water, 41);

console.log('');
console.log('── 적은 값이 모자랄 때 ──');
ok('체중이 없으면 안 그린다', C.compositionOf({ fat_pct: 16, muscle_kg: 33 }), null);
ok('  체지방·골격근이 둘 다 없으면 안 그린다', C.compositionOf({ weight: 73, water_l: 41 }), null);
ok('  기록이 없어도 안 터진다', [C.compositionOf(null), C.compositionOf({})], [null, null]);
// 골격근만 적은 사람 (체지방률을 안 재는 체중계도 있다)
const onlyMuscle = C.compositionOf({ weight: 70, muscle_kg: 30 });
ok('골격근만 있어도 쪼갠다', onlyMuscle.parts.map((p) => [p.name, p.value]), [['골격근', 30], ['기타(뼈·장기)', 40]]);
// 체지방률만 적은 사람
const onlyFat = C.compositionOf({ weight: 80, fat_pct: 25 });
ok('  체지방률만 있어도 쪼갠다', onlyFat.parts.map((p) => [p.name, p.value]), [['체지방', 20], ['기타(뼈·장기)', 60]]);
ok('  체수분이 없으면 null 이다', onlyFat.water, null);
// 0 은 안 적는 값이다 (인바디에 0kg 은 없다)
ok('0 은 없는 것으로 친다',
  [C.compositionOf({ weight: 70, muscle_kg: 0, fat_pct: 20 }).parts.length,
   C.compositionOf({ weight: 70, muscle_kg: 30, water_l: 0 }).water], [2, null]);
ok('  글자로 와도 숫자로 읽는다', C.compositionOf({ weight: '70', muscle_kg: '30' }).total, 70);

console.log('');
console.log('── 잘못 적었을 때 ──');
// 골격근 + 체지방이 체중을 넘는다. 조용히 기타만 빼면 「내 뼈는 0kg 인가」가 된다
const over = C.compositionOf({ weight: 60, muscle_kg: 50, fat_pct: 30 });
ok('넘으면 얼마나 넘었는지 알려준다', over.over, 8);
ok('  그때도 조각은 그린다 (둘만)', over.parts.map((p) => p.name), ['골격근', '체지방']);
ok('  멀쩡하면 0 이다', c.over, 0);
// 남는 것이 아주 조금이면 조각으로 안 그린다 (선만 생긴다).
// 70 × 28.6% = 20.02 → 20.0 이라 남는 것이 **0.0kg** 이다
const tiny = C.compositionOf({ weight: 70, muscle_kg: 50, fat_pct: 28.6 });
ok('남는 것이 없으면 조각으로 안 그린다', tiny.parts.map((p) => p.name), ['골격근', '체지방']);
// 테두리는 0.1kg 이다 — 그만큼은 그린다 (70 × 28.5% = 19.95 → 19.9)
const edge = C.compositionOf({ weight: 70, muscle_kg: 50, fat_pct: 28.5 });
ok('  0.1kg 은 그린다', edge.parts.map((p) => [p.name, p.value]).slice(-1), [['기타(뼈·장기)', 0.1]]);

console.log('');
console.log('── 화면이 그 셈만 쓰는가 ──');
const ui = codeOf(fs.readFileSync('src/components/InbodyCharts.jsx', 'utf-8'));
// 퍼센트를 화면에서 또 세면 분모가 갈린다 (그것이 이 버그의 모양이었다)
ok('퍼센트를 화면에서 또 세지 않는다', /\/ *sum *\* *100|reduce\(/.test(ui), false);
ok('  셈이 준 pct 를 그대로 적는다', /entry\.pct/.test(ui), true);
ok('체수분을 뺐다고 말한다', /골격근·체지방 안에 들어 있어서/.test(ui), true);
ok('  넘었으면 그 수로 말한다', /체중보다 \{over\}kg 많아요/.test(ui), true);

const page = codeOf(fs.readFileSync('src/pages/InbodyPage.jsx', 'utf-8'));
ok('화면 파일 안에 그 셈이 남아 있지 않다', /getCompositionData/.test(page), false);
ok('  셈 자리를 불러 쓴다', /compositionOf\(/.test(page), true);

console.log('');
if (bad > 0) { console.log(bad + '건 실패'); process.exit(1); }
console.log('다 통과');
