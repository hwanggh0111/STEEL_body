// **워밍업 줄과 드롭세트 무게** (2026-10-24).
//
//   npm run setplan     (npm run check 에도 들어 있다)
//
// ── 왜 ──
//
// 기록 화면은 본세트 무게에서 **워밍업 줄**을 만들고(`warmupSets`), 적고 난 뒤에
// **「드롭세트 ○kg」 단추**를 띄운다(`dropSets`). 둘 다 **원판으로 만들 수 있는
// 무게**로 떨어뜨려야 한다 — 33.7kg 은 만들 수 없으니까.
//
// 떨어뜨리는 자(`toPlate`)가 **반올림**이라 가벼운 쪽에서 둘이 났다 —
//
//     2kg 의 80% = 1.6kg  →  2.5 단위로 반올림 → **2.5kg**   (드롭세트가 **올라갔다**)
//     3kg 의 40% = 1.2kg  →  2.5 단위로 반올림 → **0kg**     (워밍업에 「0kg 5회」)
//
// 2 · 3 · 4kg 덤벨은 어깨 재활에서 늘 쓰는 무게다. 5kg 단위 머신이면 4.5kg 까지 그랬다.
// 단추는 「드롭세트 2.5kg」으로 떴고, 누르면 「2.5kg 으로 내렸어요」라고 **올린 무게**를
// 말하면서 그 값을 무게 칸에 적어줬다.
//
// **읽기만 하면 맞는 코드로 보인다** — 「같은 무게가 겹치면 접는다」까지 적혀 있었다.
// 그래서 여기는 **멀쩡한 값 12,800 가지를 들이밀어** 규칙이 깨지는지 본다.
const esbuild = require('esbuild');
const fs = require('fs');

const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};

const S = bundle('src/data/setPlan.js', '.s1.cjs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

console.log('── 가벼운 무게 (이것이 틀렸다) ──');
// 어깨 재활 2kg 덤벨. 20% 를 내릴 수 없으면 **단추를 안 띄우는 것이 맞다**
ok('2kg 에는 드롭세트가 없다 (2.5kg 으로 올라가지 않는다)', S.dropSets(2).map((d) => d.kg), []);
// 3 · 4kg 은 **한 번은 내려갈 수 있다**(2.5kg). 거기서 멈추는 것이 맞다 —
// 2.5 의 80% 는 2kg 이고 2.5 단위로는 되올라간다
ok('  3kg · 4kg 은 2.5kg 까지만 내려간다',
  [S.dropSets(3).map((d) => d.kg), S.dropSets(4).map((d) => d.kg)], [[2.5], [2.5]]);
ok('  5kg 단위 머신의 4.5kg 도', S.dropSets(4.5, { step: 5 }).map((d) => d.kg), []);
ok('3kg 워밍업에 0kg 줄이 없다', S.warmupSets(3, { bar: 0 }).map((w) => w.kg), [2.5]);
ok('  만들 수 없는 무게는 「없다」로 말한다', [S.toPlate(1.2), S.toPlate(0.4, 2.5), S.toPlate(0)], [null, null, null]);

console.log('');
console.log('── 보통 무게 (전에도 맞았다 — 그대로인지 본다) ──');
ok('100kg 드롭세트는 80 · 65 다', S.dropSets(100).map((d) => d.kg), [80, 65]);
ok('  60kg 은 47.5 · 37.5', S.dropSets(60).map((d) => d.kg), [47.5, 37.5]);
ok('100kg 워밍업은 빈 바부터 올라간다',
  S.warmupSets(100).map((w) => w.kg), [20, 40, 60, 75, 90]);
ok('  빈 바로 되는 무게에는 워밍업이 없다', S.warmupSets(25).map((w) => w.kg), []);
ok('  덤벨(바 0)은 빈 바 줄이 없다', S.warmupSets(30, { bar: 0 }).map((w) => w.kg), [12.5, 17.5, 22.5, 27.5]);

console.log('');
console.log('── 멀쩡한 것을 수천 개 들이민다 ──');
//
// 규칙 넷만 본다. 숫자 하나하나를 적어두면 비율을 손볼 때 검사부터 고치게 되는데,
// 그러면 **검사가 코드를 따라가는** 꼴이 된다 — 깨져야 할 때 안 깨진다.
let n = 0;
const broke = { up: 0, over: 0, zero: 0, down: 0, step: 0, dup: 0 };
for (const bar of [20, 0, 15, 10]) {
  for (const step of [2.5, 5, 1, 0.5]) {
    for (let w = 0.5; w <= 400; w += 0.5) {
      n += 1;
      const warm = S.warmupSets(w, { bar, step }).map((x) => x.kg);
      let prev = 0;
      for (const kg of warm) {
        if (!(kg > prev)) broke.up += 1;                       // 올라가는 차례인가
        if (!(kg < w)) broke.over += 1;                        // 본세트보다 가벼운가
        if (!(kg > 0)) broke.zero += 1;                        // 0kg 줄이 없는가
        prev = kg;
      }
      if (new Set(warm).size !== warm.length) broke.dup += 1;
      const drop = S.dropSets(w, { step }).map((x) => x.kg);
      let p = w;
      for (const kg of drop) {
        if (!(kg < p)) broke.down += 1;                        // 내려가는가
        p = kg;
      }
      // 원판 단위로 떨어지는가 (빈 바 줄은 바 무게 그대로다)
      for (const kg of [...warm.filter((k) => k !== bar), ...drop]) {
        if (Math.abs(Math.round(kg / step) * step - kg) > 1e-9) broke.step += 1;
      }
    }
  }
}
ok(`${n} 가지 — 워밍업이 올라간다`, broke.up, 0);
ok('  워밍업이 본세트보다 가볍다', broke.over, 0);
ok('  0kg 줄이 없다', broke.zero, 0);
ok('  겹치는 줄이 없다', broke.dup, 0);
ok('드롭세트가 내려간다', broke.down, 0);
ok('  둘 다 원판 단위로 떨어진다', broke.step, 0);

console.log('');
console.log('── 1RM 의 몇 %인가 ──');
ok('반올림한다', [S.percentOf1RM(100, 150), S.percentOf1RM(149, 150)], [67, 99]);
ok('  구간 이름이 붙는다', [S.zoneOf(55).label, S.zoneOf(75).label, S.zoneOf(95).label],
  ['가볍게 · 자세 다듬기', '근비대', '최대근력']);
ok('  말이 안 되는 값은 null', [S.percentOf1RM(0, 100), S.percentOf1RM(50, 0), S.zoneOf(0)], [null, null, null]);

console.log('');
console.log(bad === 0 ? '모두 통과' : bad + '건 FAIL');
process.exit(bad === 0 ? 0 : 1);
