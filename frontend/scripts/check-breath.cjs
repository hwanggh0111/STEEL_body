// 숨을 듣고 쉬는 시간을 늘리는 규칙 (2026-09-22).
//
//   npm run breath     (npm run check 에도 들어 있다)
//
// **화면으로는 확인할 수가 없는 자리다.** 한 줄을 눈으로 보려면 마이크를 켜고
// 실제로 숨이 차야 하고, 조용한 방과 시끄러운 방을 오가며 같은 것을 다시 해야 한다.
// 그래서 숫자를 넣어서 본다 — 규칙 쪽은 마이크를 아예 안 만진다.
const esbuild = require('esbuild');
const fs = require('fs');

const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};

const B = bundle('src/data/breathRest.js', '.b1.cjs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

console.log('── 기준선 ──');
ok('가운데 값을 쓴다', B.baselineOf([0.01, 0.02, 0.03]), 0.02);
ok('짝수면 가운데 둘의 평균', B.baselineOf([0.02, 0.04]), 0.03);
// **평균이면 문 닫는 소리 하나에 통째로 끌려간다.** 그 뒤로는 어떤 숨도 「조용하다」가 된다
ok('문 닫는 소리 하나에 안 끌려간다', B.baselineOf([0.01, 0.01, 0.01, 0.01, 0.9]), 0.01);
ok('잰 것이 없으면 없다고 한다', B.baselineOf([]), null);
ok('숫자가 아닌 것은 버린다', B.baselineOf([0.02, null, 'x', 0.02]), 0.02);

console.log('── 숨이 어느 쪽인가 ──');
const base = 0.02;
ok('기준선 그대로면 가라앉음', B.breathState(0.02, base), 'calm');
ok('1.4배는 아직 가라앉음', B.breathState(0.028, base), 'calm');
ok('1.5배부터 올라와 있음', B.breathState(0.03, base), 'mid');
ok('2.2배부터 차 있음', B.breathState(0.044, base), 'high');
ok('훨씬 크면 차 있음', B.breathState(0.5, base), 'high');
// **뺄셈이 아니라 나눗셈이다** — 시끄러운 방에서도 조용한 방에서도 같은 뜻이 되어야 한다
ok('시끄러운 방에서도 같은 판단', B.breathState(0.09, 0.03), B.breathState(0.06, 0.02));
ok('기준선이 없으면 판단 안 한다', B.breathState(0.5, null), null);
ok('기준선이 0 이면 판단 안 한다', B.breathState(0.5, 0), null);
// 무음에 가까운 기준선에서 나눗셈이 폭발하지 않는지 — 바닥(0.004)으로 나눈다
ok('아주 조용한 기준선도 안 터진다', B.breathState(0.05, 0.00001), 'high');
// 경계가 **부동소수점으로 흔들리면** 같은 숨이 어떤 날은 5초, 어떤 날은 10초가 된다
// (0.044 / 0.02 는 2.1999999999999997 로 나온다)
ok('경계가 부동소수점에 안 흔들린다', B.breathState(0.044, 0.02), 'high');

console.log('── 몇 초를 더 주나 ──');
ok('가라앉았으면 안 준다', B.extraFor('calm'), 0);
ok('올라와 있으면 5초', B.extraFor('mid'), 5);
ok('차 있으면 10초', B.extraFor('high'), 10);
ok('못 쟀으면 안 준다', B.extraFor(null), 0);
// **한 번에 20초를 주면 사람은 고장으로 읽는다.** 5초씩 쌓인다
ok('이미 10초 줬으면 5초까지만', B.extraFor('high', 10), 5);
ok('15초를 다 줬으면 그만', B.extraFor('high', 15), 0);
ok('넘겨 줬어도 그만', B.extraFor('high', 99), 0);
ok('최대는 15초', B.MAX_EXTRA, 15);
// 숨이 안 가라앉는 날도 판은 끝나야 한다
let given = 0;
for (let i = 0; i < 10; i += 1) given += B.extraFor('high', given);
ok('계속 차 있어도 15초에서 멈춘다', given, 15);

console.log('── 설정함이 정하는 것 (2026-09-22) ──');
//
// 예민도와 최대 연장은 **설정함이 넘긴다.** 규칙을 바꾼 것이 아니라 고를 수 있게 한 것이라,
// **안 넘기면 기본값 그대로**여야 한다 — 안 그러면 설정을 안 건드린 사람의 동작이 바뀐다
ok('안 넘기면 기본값 그대로', B.breathState(0.03, base), 'mid');
const LOOSE = { mid: 1.8, up: 2.6 };
const TIGHT = { mid: 1.3, up: 1.9 };
ok('느슨하게 — 1.5배는 아직 가라앉음', B.breathState(0.03, base, LOOSE), 'calm');
ok('예민하게 — 1.5배도 올라옴', B.breathState(0.03, base, TIGHT), 'mid');
ok('예민하게 — 2배면 차 있음', B.breathState(0.04, base, TIGHT), 'high');
ok('느슨하게 — 2배는 아직 올라온 것', B.breathState(0.04, base, LOOSE), 'mid');
// 이상한 값이 와도 기본값으로 돌아간다 (설정이 깨져도 판은 돌아야 한다)
ok('0 을 넘기면 기본값', B.breathState(0.03, base, { mid: 0, up: 0 }), 'mid');
ok('글자를 넘겨도 기본값', B.breathState(0.03, base, { mid: 'x', up: 'y' }), 'mid');

ok('최대 연장도 설정이 정한다 (5초)', B.extraFor('high', 0, 5), 5);
ok('  거기서 멈춘다', B.extraFor('high', 5, 5), 0);
ok('30초까지 고르면', B.extraFor('high', 20, 30), 10);
ok('안 넘기면 기본 15초', B.extraFor('high', 10), 5);

console.log('── 쓸 수 있는 자리인가 ──');
ok('조용하면 쓴다', B.usable(0.02).ok, true);
// 음악·TV 가 켜져 있으면 기준선이 높아 숨이 묻힌다. **틀린 값으로 시간을 조절하지 않는다**
ok('시끄러우면 안 쓴다', B.usable(0.5).ok, false);
ok('왜 못 쓰는지 적는다', B.usable(0.5).why.includes('시끄러'), true);
// **`Number(null)` 은 `0` 이다.** 이것에 물려서, 마이크가 죽었는데 「쓸 수 있다」고 했다
ok('마이크가 죽어 있으면 안 쓴다', B.usable(null).ok, false);
ok('그 까닭도 적는다', typeof B.usable(null).why === 'string', true);
ok('빈 칸도 없는 것으로 본다', B.usable('').ok, false);
ok('0 이라고 적은 것과는 다르다', B.usable(0).ok, true);
ok('숨 판단도 빈 칸을 0 으로 안 읽는다', B.breathState(0.05, null), null);

console.log('── 알림 소리를 흘려보낸다 ──');
// 단계가 바뀔 때 앱이 소리를 낸다. **그 소리를 마이크가 같이 듣는다** —
// 안 버리면 앱이 제 소리를 듣고 「숨이 찼다」고 한다
ok('흘려보내는 시간이 있다', B.BEEP_BLIND_MS >= 500, true);
ok('기준선 재는 시간도 있다', B.CALIBRATE_MS >= 2000, true);

console.log('── 말투 ──');
const says = ['high', 'mid', 'calm'].map((s) => B.breathLabel(s));
ok('세 가지를 다 말한다', says.filter(Boolean).length, 3);
// 점수 · 등급 · 칼로리를 안 적는다 (체형에서 정한 선과 같다)
ok('숫자를 안 적는다', says.filter((t) => /\d/.test(t)), []);
ok('점수·강도를 안 쓴다', says.filter((t) => /점수|강도|등급|칼로리/.test(t)), []);
ok('못 쟀으면 아무 말도 안 한다', B.breathLabel(null), null);

console.log('── 숨이 제일 찼던 동작 ──');
const marks = [
  { index: 0, name: '베어 크롤', peak: 0.031 },     // 1.55배
  { index: 7, name: '점핑 런지', peak: 0.048 },     // 2.4배
  { index: 11, name: '프로그 점프', peak: 0.07 },   // 3.5배
  { index: 5, name: '스쿼트 홀드', peak: 0.021 },   // 1.05배 — 안 찼다
];
const hard = B.hardestOf(marks, base);
ok('제일 찬 것이 앞', hard.map((m) => m.name), ['프로그 점프', '점핑 런지', '베어 크롤']);
// 기준선 근처는 **아예 안 올린다.** 안 찬 것을 「3등」으로 올리면 순위가 거짓말을 한다
ok('안 찬 동작은 안 올린다', hard.some((m) => m.name === '스쿼트 홀드'), false);
ok('셋까지만', B.hardestOf(marks, base, 3).length, 3);
ok('기준선이 없으면 아무것도 안 준다', B.hardestOf(marks, null), []);
ok('잰 것이 없으면 빈 것', B.hardestOf([], base), []);

console.log('');
console.log(bad ? bad + '건 어긋남' : '모두 통과');
process.exitCode = bad ? 1 : 0;
