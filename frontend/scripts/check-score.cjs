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
console.log(bad ? bad + '건 어긋남' : '모두 통과');
process.exitCode = bad ? 1 : 0;
