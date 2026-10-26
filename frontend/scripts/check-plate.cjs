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
const { platesFor, plateText, PLATES, BARS, equipOf, barFor } = P;

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
// 워밍업 줄은 **그 운동에 쓸 바**로 계산해야 한다. 고른 바를 그대로 쓰면
// 덤벨컬에 「빈 바 20×8」이 뜨고, 「덤벨 · 머신」을 골라둔 사람은 벤치프레스에서
// 원판 안내를 통째로 못 본다 (2026-10-22 에 고친 버그)
ok('  워밍업도 그 운동의 바를 쓴다', /warmupSets\(todayKg, \{ bar: useBar \}\)/.test(page), true);
ok('  원판 줄도 같은 값을 쓴다', /plateText\(todayKg, useBar\)/.test(page), true);
ok('  바 고르는 칸은 덤벨 운동에서 안 그린다', /barByName !== 'none' && \(/.test(page), true);
ok('바 목록이 셋이다 (20 · 15 · 덤벨)', BARS.map((b) => b.kg), [20, 15, 0]);
ok('원판에 1.25 가 있다 (2.5kg 증량)', PLATES.includes(1.25), true);

console.log('\n── 기구는 운동이 정한다 ── (2026-10-22)');
// 바 무게는 기기에 남지만(헬스장 사정) **꽂을 원판이 있느냐는 운동이 정한다.**
// 둘을 한 값으로 쓰다가 양쪽으로 틀렸다 — 벤치프레스에서 원판이 사라지고,
// 덤벨컬에 「양쪽 2.5 + 1.25」가 떴다
ok('벤치프레스는 바벨', equipOf('벤치프레스'), 'bar');
ok('  덤벨 벤치프레스는 아니다 (기구가 계열보다 세다)', equipOf('덤벨 벤치프레스'), 'none');
ok('  인클라인 덤벨프레스도', equipOf('인클라인 덤벨프레스'), 'none');
ok('랫풀다운 · 레그프레스는 바가 없다',
  [equipOf('랫풀다운'), equipOf('레그프레스')], ['none', 'none']);
ok('맨몸 운동도', [equipOf('푸시업'), equipOf('플랭크')], ['none', 'none']);
ok('모르는 이름은 모른다고 한다', equipOf('내맘대로운동'), 'unknown');

// **고친 버그 그 자체** — 덤벨컬에서 「덤벨 · 머신」을 골라둔 뒤 벤치프레스
ok('덤벨·머신을 골라뒀어도 벤치프레스는 바를 쓴다', barFor('벤치프레스', 0), 20);
ok('  짧은 바를 골랐으면 그것을 쓴다 (헬스장 바는 사람이 안다)', barFor('벤치프레스', 15), 15);
ok('바를 20 으로 둬도 덤벨컬은 0', barFor('덤벨컬', 20), 0);
ok('  모르는 이름은 고른 값을 그대로', [barFor('내맘대로운동', 20), barFor('내맘대로운동', 0)], [20, 0]);

// 사전 219개를 통째로 넣어 본다 — **덤벨이라 적힌 것이 바벨로 가면 안 된다**
const dict = bundle('src/data/exerciseDict.js', '.plate-dict.cjs').EXERCISE_DICT;
const wrongBar = dict.filter((e) => /덤벨|머신|케이블|밴드/.test(e.ko) && equipOf(e.ko) !== 'none');
ok('사전에 덤벨·머신이라 적힌 것이 바벨로 안 간다', wrongBar.map((e) => e.ko), []);
const barbells = dict.filter((e) => equipOf(e.ko) === 'bar');
ok('  바벨로 읽는 것이 사전에 스물은 넘는다', barbells.length >= 20, true);

console.log('\n── 기구는 **사전이 적어둔다** ── (2026-10-26)');
//
// 10/22 에는 낱말로만 맞혔다. 사전 219개를 세어보니 **91개(42%)가 「모름」**이었고,
// 「바벨」로 읽은 35개 중 **아홉이 바벨이 아니었다** — 「스쿼트」·「굿모닝」이 이름에
// 들어 있어서 **맨몸 운동이 「빈 바 20kg」 안내**를 받았다. 사전이 스스로 적어둔
// 설명과도 어긋났다(25개). 그래서 사전 칸에 `gear` 를 적고 빌드가 표를 뽑는다.
ok('사전이 기구를 적어둔다 (모름은 안 적는다)',
  [dict.filter((e) => e.gear === 'bar').length >= 25,
    dict.filter((e) => e.gear === 'none').length >= 150,
    dict.filter((e) => e.gear && e.gear !== 'bar' && e.gear !== 'none').length], [true, true, 0]);

// **뽑아둔 표가 사전과 같은가** — 손으로 고치면 여기서 걸린다 (`check-parts` 와 같은 결)
const gearTable = bundle('src/data/exerciseGear.js', '.plate-gear.cjs').EXERCISE_GEAR;
const norm = (s) => String(s || '').toLowerCase().replace(/[\s.,!?~·・\-_'"()]/g, '');
const stale = dict.filter((e) => (e.gear === 'bar' || e.gear === 'none')
  && gearTable[norm(e.ko)] !== e.gear);
ok('뽑아둔 표가 사전과 같다 (npm run parts)', stale.map((e) => e.ko), []);
ok('  안 적은 것은 표에도 없다 (「모름」이 「사전이 모른다」로 바뀌면 안 된다)',
  dict.filter((e) => !e.gear && gearTable[norm(e.ko)]).map((e) => e.ko), []);

// **설명과 어긋나지 않는가** — 사전이 「덤벨/케틀벨을 가슴 앞에 들고」라고 적어놓고
// 기구를 바벨로 적으면 두 곳이 서로 다른 말을 하는 것이다 (그게 10/26 에 찾은 모양이다)
const NONE_HINT = /덤벨|케틀벨|머신|케이블|밴드|튜브|맨몸|의자|수건|배낭|로프|철봉|문틀|벽에|평행봉/;
const BAR_HINT = /바벨|스미스|트랩바|랜드마인/;
const saysNone = dict.filter((e) => NONE_HINT.test(e.desc || '') && !BAR_HINT.test(e.desc || '')
  && equipOf(e.ko) === 'bar');
ok('설명이 덤벨·머신이라 적은 것을 바벨로 안 읽는다', saysNone.map((e) => e.ko), []);
// **견주는 말은 기구가 아니다** — 「덤벨로 하는 루마니안. 바벨보다 쉬움」의 설명에는
// 「바벨」이 있지만 그 운동은 덤벨이다. 둘 다 적힌 글은 이 자로 가릴 수 없으니 뺀다
const saysBar = dict.filter((e) => BAR_HINT.test(e.desc || '') && !NONE_HINT.test(e.desc || '')
  && equipOf(e.ko) === 'none');
ok('  설명이 바벨이라 적은 것을 바 없다고 안 한다', saysBar.map((e) => e.ko), []);

// **고친 그 아홉** — 이름에 「스쿼트」가 들어 있다고 바벨이 되면 안 된다
for (const n of ['점프 스쿼트', '시시 스쿼트', '의자 스쿼트', '피스톨 스쿼트', '코사크 스쿼트',
  '스쿼트 홀드', '스쿼트 펀치', '스쿼트 사이드킥', '고블릿 스쿼트', '굿모닝 (맨몸)',
  '월싯', '덕 워크', '불가리안 스플릿 스쿼트']) {
  ok(`  ${n}`, equipOf(n), 'none');
}
// 진짜 바벨은 그대로 바벨이다
for (const n of ['스쿼트', '프론트 스쿼트', '데드리프트', '벤치프레스', '오버헤드프레스', '굿모닝']) {
  ok(`  ${n}`, equipOf(n), 'bar');
}
// **사전이 품은 이름보다 기구 낱말이 세다** — 「스미스 벤치프레스」는 스미스머신이다
ok('이름에 적힌 기구가 제일 세다',
  [equipOf('스미스 벤치프레스'), equipOf('덤벨 스쿼트'), equipOf('머신 숄더프레스')],
  ['none', 'none', 'none']);
// 꾸며 적어도 뒤집히지 않는다 — bodyPart 가 10/22 에 같은 자리에서 60개를 맞았다
const WRAP = [(n) => n, (n) => `라잉 ${n}`, (n) => `인클라인 ${n}`, (n) => `원암 ${n}`,
  (n) => `${n} (좌)`, (n) => `집에서 ${n}`, (n) => `한손 ${n}`, (n) => `${n} 3세트`,
  (n) => `${n} 왼쪽`];
const flipped = [];
for (const e of dict) {
  const base = equipOf(e.ko);
  for (const w of WRAP) {
    const got = equipOf(w(e.ko));
    if (base !== 'bar' && got === 'bar') flipped.push(w(e.ko));
    if (base === 'bar' && got === 'unknown') flipped.push(`${w(e.ko)} (바를 잃었다)`);
  }
}
ok(`꾸며 적은 ${dict.length * WRAP.length}가지가 바벨로 뒤집히지 않는다`, flipped.slice(0, 5), []);

// **홈트 프로그램의 동작에는 바벨이 없다** — 집에 바벨이 없다
const H = bundle('src/data/homeworkoutPrograms.js', '.plate-home.cjs');
const homeNames = [...new Set(Object.values(H.PROGRAMS).flat().map((e) => e.name))];
ok(`집에서 하는 ${homeNames.length}동작에 바벨이 없다`,
  homeNames.filter((n) => equipOf(n) === 'bar'), []);
// 「모름」은 **바벨로도 덤벨로도 하는 것**만 남아야 한다 (사람이 고른 바를 쓴다)
const unknowns = dict.filter((e) => equipOf(e.ko) === 'unknown').map((e) => e.ko);
ok('모름은 열 개 안쪽이다 (91개였다)', unknowns.length <= 12, true);

console.log('\n── 빈 바 값이 두 벌이 아닌가 ──');
// `setPlan.BAR_KG`(워밍업의 바닥)와 `BARS[0]`(고를 수 있는 바)이 어긋나면
// 워밍업은 20kg 으로 세고 원판 안내는 15kg 으로 센다
const SP = bundle('src/data/setPlan.js', '.plate-setplan.cjs');
ok('워밍업의 빈 바와 고르는 바가 같다', SP.BAR_KG, BARS[0].kg);
// 무게 ± 단추는 **원판 1.25 짝**이라 2.5kg 이다 (화면 주석이 그렇게 적어뒀다)
ok('± 단추 단위가 제일 작은 원판 둘과 같다', Math.min(...PLATES) * 2, 2.5);
ok('  무게 칸이 그 값을 쓴다', /step=\{2\.5\}/.test(page), true);

console.log('\n── 원판 조합을 통째로 ──');
// 조합을 수천 개 넣어 **값으로** 본다 — 합이 목표와 맞나 · 넘기지 않나 ·
// 모자람이 음수가 아닌가 · 없는 원판을 쓰지 않나 · **더 쌓을 수 있는데 게으르지 않나**
const SETS = [PLATES, [25, 20, 15, 10, 5, 2.5], [20, 10, 5], [2.5], [25]];
let combos = 0;
const wrongAll = [];
for (const plates of SETS) {
  for (const bar of [20, 15]) {
    for (let t = 0; t <= 400; t += 0.25) {
      const r = platesFor(t, bar, plates);
      combos += 1;
      if (!r) { if (t >= bar) wrongAll.push(`${t}kg bar${bar}: null`); continue; }
      const sum = bar + r.perSide.reduce((a, b) => a + b, 0) * 2;
      if (Math.abs(sum - r.total) > 1e-6) wrongAll.push(`${t}kg: 합 ${sum} ≠ ${r.total}`);
      if (Math.abs(r.total + r.short - t) > 1e-6) wrongAll.push(`${t}kg: ${r.total}+${r.short} ≠ ${t}`);
      if (r.total > t + 1e-9) wrongAll.push(`${t}kg: 넘겼다`);
      if (r.short < -1e-9) wrongAll.push(`${t}kg: 모자람이 음수`);
      if (r.perSide.some((p) => !plates.includes(p))) wrongAll.push(`${t}kg: 없는 원판`);
      if (r.perSide.some((p, i) => i > 0 && p > r.perSide[i - 1])) wrongAll.push(`${t}kg: 차례 거꾸로`);
      const min = Math.min(...plates);
      if (r.short >= min * 2 - 1e-9 && r.perSide.filter((p) => p === min).length < 10) {
        wrongAll.push(`${t}kg bar${bar} [${plates}]: 더 쌓을 수 있는데 ${r.short}kg 모자라다고 한다`);
      }
    }
  }
}
ok(`${combos.toLocaleString()}가지가 전부 맞는다`, wrongAll.slice(0, 3), []);

// 워밍업 줄마다 **꽂을 것을 말할 수 있나** (빈 줄이면 바 앞에서 또 암산한다)
const noText = [];
for (const bar of [20, 15]) {
  for (let w = 2.5; w <= 300; w += 2.5) {
    for (const r of SP.warmupSets(w, { bar })) {
      if (!r.bar && !plateText(r.kg, bar)) noText.push(`${w}kg bar${bar} 줄 ${r.kg}`);
    }
  }
}
ok('워밍업 줄마다 꽂을 것을 말한다', noText.slice(0, 3), []);

console.log('\n' + (bad ? `${bad}건 어긋남` : '전부 통과'));
process.exit(bad ? 1 : 0);
