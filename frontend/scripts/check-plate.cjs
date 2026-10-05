// 원판 계산이 맞는가 — `npm run plate` (2026-10-05)
//
// **틀려도 아무도 안 터진다.** 화면은 멀쩡히 「양쪽 25+15」라고 적고, 사람은 그대로
// 꽂는다. 그래서 잘못된 무게를 들고, 그 무게가 기록에 남고, 그 기록이 다음 주
// 무게를 정한다. 조용히 틀리는 자리라 숫자를 하나씩 못 박는다.

const fs = require('fs');
const esbuild = require('esbuild');

// 사전 검사(`check-data.cjs`)와 같은 방식 — ESM 을 한 번 묶어 node 에서 부른다
const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};

let bad = 0;
const ok = (name, got, want) => {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  const pass = g === w;
  if (!pass) bad += 1;
  console.log(`${pass ? 'OK  ' : 'FAIL'} ${name} → ${g}${pass ? '' : ` (기대: ${w})`}`);
};

const P = bundle('src/data/plateMath.js', '.plate.cjs');
const { platesFor, plateText, PLATES, BARS } = P;

console.log('── 양쪽 합이 목표와 맞는가 ──');
// 이 검사가 전부다. 어떤 조합이든 **바 + 양쪽 합**이 목표여야 한다
for (const bar of [20, 15]) {
  const wrong = [];
  for (let t = bar; t <= 300; t += 1.25) {
    const r = platesFor(t, bar);
    if (!r) { wrong.push(`${t}kg: null`); continue; }
    const sum = bar + r.perSide.reduce((a, b) => a + b, 0) * 2;
    if (Math.abs(sum - r.total) > 1e-6) wrong.push(`${t}kg: 합 ${sum} ≠ 적은 값 ${r.total}`);
    if (Math.abs(r.total + r.short - t) > 1e-6) wrong.push(`${t}kg: ${r.total}+${r.short} ≠ ${t}`);
    if (r.total > t + 1e-9) wrong.push(`${t}kg: ${r.total} 로 **넘겼다**`);
  }
  ok(`${bar}kg 바 — 20~300kg 전부 맞는다`, wrong.slice(0, 5), []);
}

console.log('\n── 몰래 반올림하지 않는가 ──');
// 가진 원판으로 딱 안 떨어지면 **모자란다고 말해야 한다.** 조용히 올려주면
// 실제로는 97.5 를 들고 기록에는 100 이 남는다 — 그게 다음 주 무게를 정한다
ok('안 떨어지면 모자란 만큼을 말한다', platesFor(61.25, 20).short, 1.25);
ok('  딱 떨어지면 0', platesFor(100, 20).short, 0);
ok('  넘겨서 맞추지 않는다', platesFor(61.25, 20).total <= 61.25, true);

console.log('\n── 아는 무게 몇 개 ──');
ok('100kg', plateText(100, 20), '양쪽 25 + 15');
ok('140kg', plateText(140, 20), '양쪽 25×2 + 10');
ok('60kg', plateText(60, 20), '양쪽 20');
ok('빈 바', plateText(20, 20), '빈 바 그대로');
// 아무것도 안 올라가는데 모자란 경우 — 「빈 바 그대로」로 끝내면 2kg 이 사라진다
ok('빈 바인데 모자라면 말한다', plateText(22, 20), '빈 바 그대로 (2kg 모자람)');
ok('  딱 빈 바면 안 붙인다', /모자람/.test(plateText(20, 20)), false);
ok('102.5kg (1.25 가 쓰인다)', plateText(102.5, 20), '양쪽 25 + 15 + 1.25');

console.log('\n── 안 되는 것은 안 된다고 한다 ──');
ok('바보다 가벼우면 null', platesFor(10, 20), null);
ok('  화면은 빈 줄을 받는다', plateText(10, 20), '');
ok('0 · 음수 · 글자', [platesFor(0, 20), platesFor(-5, 20), platesFor('맨몸', 20)], [null, null, null]);
// 덤벨 · 머신은 나눌 것이 없다 — 표시 무게가 곧 그 무게다
ok('덤벨 · 머신(바 0)은 원판이 없다', platesFor(30, 0).perSide, []);
ok('  화면도 빈 줄', plateText(30, 0), '');

console.log('\n── 읽을 수 있는 답인가 ──');
// 한 종류를 끝없이 쌓으면 답이 「2.5×40」 같은 것이 된다 — 읽어도 못 쓰고
// 헬스장에 그만큼 있지도 않다
const many = platesFor(300, 20).perSide;
ok('한쪽 원판이 열두 장을 안 넘는다', many.length <= 12, true);
// 같은 원판은 묶어 센다 — 「20+20+10」보다 「20×2 + 10」이 읽기 쉽다
ok('같은 원판은 묶어 적는다', /×2/.test(plateText(140, 20)), true);

console.log('\n── 쓰는 쪽과 어긋나지 않는가 ──');
const page = fs.readFileSync('src/pages/TrainPage.jsx', 'utf-8');
ok('기록 화면이 이것을 쓴다', /plateText\(/.test(page), true);
// 바를 고르는 자리가 없으면 20kg 바가 없는 헬스장에서는 계속 틀린 답을 본다
ok('  바를 고를 수 있다', /BARS\.map/.test(page), true);
// 워밍업 줄은 고른 바로 계산해야 한다 — 기본값으로 두면 15kg 바에서 다 어긋난다
ok('  워밍업도 고른 바를 쓴다', /warmupSets\(todayKg, \{ bar: barKg \}\)/.test(page), true);
ok('바 목록이 셋이다 (20 · 15 · 덤벨)', BARS.map((b) => b.kg), [20, 15, 0]);
ok('원판에 1.25 가 있다 (2.5kg 증량)', PLATES.includes(1.25), true);

console.log('\n' + (bad ? `${bad}건 어긋남` : '전부 통과'));
process.exit(bad ? 1 : 0);
