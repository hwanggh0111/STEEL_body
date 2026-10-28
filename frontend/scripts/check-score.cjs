// 인바디 점수 — 값으로 본다 (2026-09-29).
//
//   npm run score     (npm run check 에도 들어 있다)
//
// **이 화면은 눈으로 확인하기 어렵다.** 한 점수를 보려면 인바디를 두 번 넣고 성별을
// 고르고 설정을 켜야 한다. 그리고 여기서 보는 것 대부분은 **안 하기로 한 것들**이다 —
// 등급 안 붙이기 · 성별 없으면 점수 안 내기 · 근육 많은 것 안 깎기.
// 그런 규칙은 눈으로 보면 늘 통과한 것처럼 보이므로 값으로 본다.
const esbuild = require('esbuild');
const fs = require('fs');

const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};

const S = bundle('src/data/inbodyScore.js', '.sc1.cjs');
const R = bundle('src/data/bodyRanges.js', '.sc2.cjs');
const fsrc = (p) => fs.readFileSync(p, 'utf8');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

console.log('── 범위 안이면 만점 ──');
// 남성 참고 범위: 체지방률 8~20 · 골격근 비율 40~50 · BMI 18.5~23
const mid = { date: '2026-09-20', weight: 70, muscle_kg: 31.5, fat_pct: 15, bmi: 22 };
const a = S.scoreOf(mid, 'male');
ok('셋 다 범위 안이면 100', a.score, 100);
ok('항목 셋으로 냈다', a.parts.length, 3);
ok('깎인 데가 없다', a.parts.every((p) => p.inNormal), true);

console.log('── 벗어나면 범위 폭을 자로 깎는다 ──');
// 체지방률 26 → 범위(8~20) 위로 6 · 폭 12 → 100 - 50 = 50
const fat = S.metricScore('fat_pct', R.scaleFor('fat_pct', 'male'), 26);
ok('폭의 절반만큼 벗어나면 50점', fat.score, 50);
ok('위로 벗어난 것을 안다', fat.where, 'above');
ok('얼마나 벗어났는지 적는다', fat.off, 6);
// BMI 는 폭이 4.5 다. **절대값으로 깎으면 안 된다** — 1 벗어난 것이 체지방률 1%p 와 같아진다
const bmi = S.metricScore('bmi', R.scaleFor('bmi', 'male'), 24);
ok('BMI 1 벗어남은 체지방률 1 벗어남보다 크다', bmi.score < S.metricScore('fat_pct', R.scaleFor('fat_pct', 'male'), 21).score, true);
// 폭만큼 벗어나면 0 · 그 아래로는 안 내려간다
ok('폭만큼 벗어나면 0점', S.metricScore('bmi', R.scaleFor('bmi', 'male'), 27.5).score, 0);
ok('더 벗어나도 0 아래로 안 간다', S.metricScore('bmi', R.scaleFor('bmi', 'male'), 40).score, 0);

console.log('── 근육이 많아서 넘은 것은 안 깎는다 ──');
// 골격근 비율 55% (범위 40~50 위로 5)
const musc = S.metricScore('muscle_ratio', R.scaleFor('muscle_ratio', 'male'), 55);
ok('점수를 안 깎는다', musc.score, 100);
ok('그래도 벗어난 것은 벗어났다고 적는다', musc.inNormal, false);
ok('  위로 벗어났다', musc.where, 'above');
// 아래로 벗어난 것은 깎는다 (범위 40~50, 폭 10 → 35 면 절반)
ok('아래로 벗어나면 깎는다', S.metricScore('muscle_ratio', R.scaleFor('muscle_ratio', 'male'), 35).score, 50);

console.log('── 성별을 안 밝히면 점수를 안 낸다 ──');
const noSex = S.scoreOf(mid, null);
ok('점수가 없다', noSex.score, null);
ok('BMI 하나로는 안 낸다', noSex.parts.length < S.MIN_PARTS, true);
ok('까닭을 적는다', noSex.why.includes('성별'), true);
// 성별은 밝혔는데 칸이 비었을 때는 다른 까닭을 적는다
const thin = S.scoreOf({ weight: 70, bmi: 22 }, 'male');
ok('칸이 모자라도 점수가 없다', thin.score, null);
ok('  그때는 다른 까닭이다', thin.why.includes('체지방률'), true);

console.log('── 둘만 있어도 낸다 ──');
const two = S.scoreOf({ weight: 70, muscle_kg: 31.5, fat_pct: 15 }, 'male');
ok('체지방률 · 골격근 비율 둘로 낸다', two.parts.length, 2);
ok('점수가 나온다', two.score, 100);

console.log('── 견줄 상대는 지난 번의 나 ──');
const worse = { date: '2026-09-20', weight: 70, muscle_kg: 31.5, fat_pct: 26, bmi: 22 };
const c1 = S.scoreChange(mid, worse, 'male');
ok('지난 번보다 오른 것을 안다', c1.dir, 'up');
ok('  지난 점수를 같이 준다', c1.prev, S.scoreOf(worse, 'male').score);
// 지난 기록이 없으면 **0 으로 두지 않는다** — 그러면 「+100점」이 된다
const c2 = S.scoreChange(mid, null, 'male');
ok('지난 기록이 없으면 차이를 안 만든다', c2.delta, null);
ok('  방향도 없다', c2.dir, null);
// 2점 안쪽은 안 움직인 것으로 본다 — 인바디는 그날 물만 마셔도 흔들린다
const near = { date: '2026-09-01', weight: 70, muscle_kg: 31.5, fat_pct: 20.1, bmi: 22 };
const c3 = S.scoreChange(mid, near, 'male');
ok('조금 다른 것은 같다고 본다', c3.dir, 'flat');

console.log('── 여성 범위로도 같은 규칙 ──');
// 여성 참고 범위: 체지방률 15~28 · 골격근 비율 32~42
const f = S.scoreOf({ weight: 55, muscle_kg: 20, fat_pct: 25, bmi: 21 }, 'female');
ok('여성 범위 안이면 100', f.score, 100);
// 같은 체지방률 25% 가 남성 기준으로는 깎인다 — **성별을 안 가리면 안 되는 까닭이다**
ok('같은 값이 남성 기준으로는 깎인다', S.scoreOf({ weight: 55, muscle_kg: 20, fat_pct: 25, bmi: 21 }, 'male').score < 100, true);

console.log('── 등급을 안 붙인다 ──');
const src = fsrc('src/data/inbodyScore.js') + fsrc('src/components/BodyReading.jsx');
const code = src.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\{\/\*)/.test(l)).join('\n');
ok('등급 이름이 없다', /'보통'|'좋음'|'나쁨'|위험|비정상|등급 [A-D]/.test(code), false);
ok('또래 · 평균과 안 견준다', /또래|평균과|상위 \d/.test(code), false);

console.log('── 켠 사람에게만 보인다 ──');
const reading = fsrc('src/components/BodyReading.jsx');
ok('설정을 보고 그린다', /showScore && <ScoreCard/.test(reading), true);
const store = fsrc('src/store/settingsStore.js');
ok('기본은 꺼짐이다', /inbodyScore: readFlag\(SETTINGS_KEYS\.inbodyScore, false\)/.test(store), true);
const keys = fsrc('src/data/localKeys.js');
ok('열쇠 이름은 한 곳에 있다', /inbodyScore: 'steelbody_set_inbodyscore'/.test(keys), true);

console.log('');
// ══════════════════════════════════════════════════════════
// **말이 안 되는 수에 이름을 붙이지 않는가** (2026-10-28)
// ══════════════════════════════════════════════════════════
//
// FFMI 칸의 맨 끝이 `Infinity` 여서 **무슨 수가 와도 이름이 붙었다** —
// 체중 칸에 175 를 적으면 FFMI 48.9, 체중 500 · 체지방 0 이면 163.6 인데
// 화면은 둘 다 **「드문 자리」**라고 적었다. 칭찬처럼 읽히는 말이다.
//
// 이 파일이 지켜온 선이 「숫자를 보는 사람에게 누명을 씌우지 않는다」인데,
// **거꾸로 지어내 칭찬하는 것도 같은 잘못**이다.
//
// **자를 재는 대상에서 가져오지 않는다** — 오늘 원판에서 그 함정을 밟았다
// (상한을 되돌리니 `undefined` 와 견주어 검사가 통과했다). 여기서는 검사가
// 제 수를 들고 있고, **그 수가 코드와 같은지를 따로** 본다
{
  const BI = bundle('src/data/bodyIndex.js', '.sc-bi.cjs');
  const CHECK_ABOVE = 30;      // 이 위는 등급이 아니라 「다시 봐주세요」다

  console.log('\n── FFMI: 말이 안 되는 수 ──');
  const band = (h, w, f) => {
    const r = BI.ffmiOf({ height: h, weight: w, fatPct: f });
    return { ffmi: r && r.adjusted, b: BI.ffmiBand(r && r.adjusted) };
  };

  const ok30 = band(175, 95, 10);          // 28.2 — 사람의 몸이다
  ok('잘 키운 몸에는 이름이 붙는다', [ok30.ffmi < CHECK_ABOVE, ok30.b.tone], [true, 'high']);

  // 사람이 칠 수 있는 오타 셋
  for (const [label, h, w, f] of [
    ['체중 칸에 키를 적음', 175, 175, 15],
    ['체중 500 · 체지방 0', 175, 500, 0],
    ['큰 체격 · 체지방 5', 160, 120, 5],
  ]) {
    const got = band(h, w, f);
    ok('  ' + label + ' → 등급을 안 매긴다', [got.ffmi > CHECK_ABOVE, got.b.tone], [true, 'check']);
  }
  ok('  그 말이 「다시 봐주세요」다', band(175, 500, 0).b.label, '적은 값을 다시 봐주세요');

  // 코드가 든 상한이 이 검사의 수와 같은가 — 바뀌면 사람이 정한다
  const src = fsrc('src/data/bodyIndex.js');
  ok('  코드의 상한이 그 수다', new RegExp('max: ' + CHECK_ABOVE + ',').test(src), true);

  // 화면이 그 결을 **색으로도** 가르는가 — 모르는 결이 초록(잘됨)으로 떨어지면
  // 말과 색이 서로 다른 말을 한다
  const page = fsrc('src/pages/InbodyPage.jsx');
  ok("  화면이 'check' 를 따로 칠한다", /tone === 'check' \? 'var\(--warning\)'/.test(page), true);
}

console.log(bad ? bad + '건 어긋남' : '모두 통과');
process.exitCode = bad ? 1 : 0;
