// 평생 누적 — **지금까지 들어올린 것 전부** (2026-11-16).
//
//   npm run lifetime      (npm run check 에도 들어 있다)
//
// `data/lifetime.js` 의 셈이다. 「1월 2일에 2년치의 절반이 화면에서 사라진다」를
// 닫으려고 벼림이 11/16 에 붙였다.
//
// **화면으로는 확인할 수 없는 셈이다.** 「1,284.6톤」이 맞는지 눈으로 보려면 2년치
// 기록을 만들어야 하고, 「열 톤부터 소수를 버린다」는 경계는 딱 그 자리에 수를
// 놓아야 보인다. 그래서 수를 손으로 먹여서 본다.
//
// 지키는지 보는 것:
//   · 접는 자리는 **글자로 박지 않는다** — `TON_FROM_KG`·`TON_ROUND_FROM` 을 읽는다
//     (자가 상수를 베끼면 셈이 바뀔 때 자만 옛 규칙을 본다 · 11/16 에 자 셋이 그랬다)
//   · **앞날 기록은 안 센다** — 달력에 미리 적어둔 줄이 톤에 들면 아직 안 든 무게다
//   · **무게 없는 세트는 톤에 안 들고** 세트로 갈린다 — 맨몸만 한 사람에게 0 을
//     크게 띄우지 않는다
//   · **크게 적는 수는 하나다** — ton · kg · set 중 하나로만 갈린다
//   · **「가져온 것 포함」을 말하지 않는다** — CSV 로 온 줄을 가를 값이 아무 데도
//     없다. 모르는 것을 아는 것처럼 말하지 않는다 (11/16 주인 결정 자리)
const esbuild = require('esbuild');
const fs = require('fs');

const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};

const L = bundle('src/data/lifetime.js', '.lt1.cjs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const TODAY = '2026-11-16';
// 무게 있는 세트 하나 = kg × reps × sets
const 든것 = (kg, reps, sets) => ({ name: '벤치프레스', weight: kg, reps, sets });
const 맨몸 = (sets) => ({ name: '풀업', weight: 0, reps: 10, sets });

// 접는 자리를 **셈에서 읽어온다** — 여기 숫자를 적지 않는다
const { TON_FROM_KG, TON_ROUND_FROM } = L;

console.log('── 접는 자리는 셈이 정한다 ──');
ok('셈이 접는 자리를 내놓는다', [typeof TON_FROM_KG, typeof TON_ROUND_FROM], ['number', 'number']);

// 톤 경계 **바로 아래**: kg 그대로 적는다 — 「0.9톤」도 「1톤」도 아니다
{
  const kg = TON_FROM_KG - 1;
  const r = L.buildLifetime({ '2026-11-15': [든것(kg, 1, 1)] }, TODAY);
  ok('1톤 바로 아래는 kg 그대로', [r.unit, r.value], ['kg', kg]);
}
// 톤 경계 **바로 위**: 톤으로 접고, 열 톤 아래라 소수 한 자리를 남긴다
{
  const r = L.buildLifetime({ '2026-11-15': [든것(TON_FROM_KG, 1, 1)] }, TODAY);
  ok('1톤에서 톤으로 갈린다', [r.unit, r.value], ['ton', 1]);
}
{
  // 1.5톤을 「2톤」으로 적으면 3분의 1이 지어낸 수가 된다
  const r = L.buildLifetime({ '2026-11-15': [든것(TON_FROM_KG * 1.5, 1, 1)] }, TODAY);
  ok('열 톤 아래는 소수 한 자리를 남긴다', r.value, 1.5);
}
{
  // 열 톤부터는 소수를 버린다 — 1,284.6톤을 적을 일이 없다
  const kg = TON_FROM_KG * (TON_ROUND_FROM + 0.46);
  const r = L.buildLifetime({ '2026-11-15': [든것(kg, 1, 1)] }, TODAY);
  ok('열 톤부터는 소수를 버린다', r.value, TON_ROUND_FROM);
  ok('  버린 쪽이지 올린 쪽이 아니다', r.value < (kg / TON_FROM_KG), true);
}

console.log('');
console.log('── 앞날은 아직 든 것이 아니다 ──');
{
  const 기록 = {
    '2026-11-15': [든것(100, 10, 1)],        // 1,000kg
    '2026-11-20': [든것(100, 10, 10)],       // 10,000kg — 달력에 미리 적어둔 줄
  };
  const r = L.buildLifetime(기록, TODAY);
  ok('앞날 기록은 톤에 안 든다', r.kg, 1000);
  ok('  날 수에도 안 든다', r.days, 1);
  ok('  첫 기록 날짜도 앞날을 안 집는다', r.first, '2026-11-15');
}
{
  // 오늘은 **든 것**이다 — 앞날의 선이 오늘을 자르면 오늘 한 것이 사라진다
  const r = L.buildLifetime({ [TODAY]: [든것(100, 10, 1)] }, TODAY);
  ok('오늘 적은 것은 센다', r.kg, 1000);
}

console.log('');
console.log('── 맨몸만 한 사람에게 0 을 크게 띄우지 않는다 ──');
{
  const r = L.buildLifetime({ '2026-11-15': [맨몸(4)] }, TODAY);
  ok('무게 없는 세트는 톤에 안 든다', r.kg, 0);
  ok('  세트로 갈린다', [r.unit, r.value], ['set', 4]);
  ok('  톤에 안 든 세트를 따로 센다', r.bodyweightSets, 4);
  ok('  셀 것이 있다고 말한다', r.any, true);
}
{
  // 섞여 있으면 **무게 쪽**을 크게 적는다 — 둘을 다 크게 적으면 무엇을 볼지 모른다.
  // 1톤 아래로 놓아 kg 쪽을 보게 한다(톤으로 접히면 접는 자리를 보는 셈이 된다)
  const r = L.buildLifetime({ '2026-11-15': [든것(50, 10, 1), 맨몸(3)] }, TODAY);
  ok('무게가 있으면 무게 쪽을 크게 적는다', [r.unit, r.value], ['kg', 500]);
  ok('  맨몸 세트는 세면서 톤에는 안 넣는다', [r.bodyweightSets, r.kg], [3, 500]);
}
{
  const r = L.buildLifetime({}, TODAY);
  ok('기록이 없으면 그릴 것이 없다고 한다', r.any, false);
  ok('  0 을 크게 띄우지 않는다 (화면이 칸을 안 그린다)', [r.kg, r.sets, r.days], [0, 0, 0]);
}
{
  // 빈 날이 끼어 있어도 「운동한 날」로 세지 않는다
  const r = L.buildLifetime({ '2026-11-14': [], '2026-11-15': [든것(100, 10, 1)] }, TODAY);
  ok('줄 없는 날은 운동한 날이 아니다', r.days, 1);
}

console.log('');
console.log('── 크게 적는 수는 하나다 ──');
{
  const 꼴 = new Set();
  [[0, 0], [TON_FROM_KG - 1, 0], [TON_FROM_KG, 0]].forEach(([kg]) => {
    const r = L.buildLifetime({ '2026-11-15': [kg ? 든것(kg, 1, 1) : 맨몸(1)] }, TODAY);
    꼴.add(r.unit);
  });
  ok('갈리는 꼴은 셋뿐이다', [...꼴].sort(), ['kg', 'set', 'ton']);
}

console.log('');
console.log('── 출처를 말하지 않는다 ──');
{
  // CSV 로 온 줄과 손으로 적은 줄을 가를 값이 **아무 데도 없다.** 셈이 그런 칸을
  // 내놓기 시작하면 화면이 「가져온 것 포함」이라고 적게 되고, 그것은 모르는 것을
  // 아는 것처럼 말하는 것이다 (11/16 주인 결정)
  const r = L.buildLifetime({ '2026-11-15': [든것(100, 10, 1)] }, TODAY);
  const 출처칸 = Object.keys(r).filter((k) => /import|csv|source|가져/i.test(k));
  ok('셈이 출처 칸을 내놓지 않는다', 출처칸, []);
  // 주석은 뺀다 — 머리글은 **왜 안 적는지**를 적는 자리다(거기 있어야 맞다).
  // 코드에 남아 있으면 그때가 말을 지어내기 시작한 때다
  const 코드 = fs.readFileSync('src/data/lifetime.js', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
    .filter((l) => !/^\s*\/\//.test(l)).join('\n');
  ok('  셈 코드에 출처를 말하는 글자가 없다', /가져온|가져오기|imported/i.test(코드), false);
  // 대신 **첫 기록 날짜**를 내놓는다 — 한 번에 올린 사람은 그 날짜를 보고 스스로 안다
  ok('  첫 기록 날짜로 대신한다', r.first, '2026-11-15');
}

console.log(bad === 0 ? '\n모두 통과' : `\n${bad}건 FAIL`);
process.exit(bad === 0 ? 0 : 1);
