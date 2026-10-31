// **자유로 치는 숫자 칸에 테두리가 있는가** (2026-10-31).
//
//   npm run bounds     (`npm run check` 가 찾아서 돈다)
//
// ── 왜 ──
//
// 10/28 에 숫자 테두리를 한 바퀴 돌고 세운 자가 셋이었다 —
//
//   · **검사의 눈이 짧으면 그 밖은 아무도 안 본다** (원판은 400 까지만 넣고 있었다)
//   · **자를 재는 대상에서 가져오지 않는다** (상한을 되돌리니 거짓 통과했다)
//   · **자유 입력 칸은 반드시 테두리를 물어본다** — 그 값으로 화면이 **말을 짓는다**
//
// 그 셋을 글자로 지키는 자다. 보는 것은 두 가지다 —
//
//   1. **칸마다 `min` · `max` 가 있는가.** 없으면 그 칸은 다음에 또 빠진다.
//      일부러 없는 것은 **까닭과 함께** 아래 `테두리없음` 에 적는다
//   2. **서버와 화면이 같은 수 · 같은 규칙을 쓰는가.** `npm run twins` 는 숫자만
//      보니 **뽑는 규칙**(`'10~12'` → 10)은 못 본다. 그것을 여기서 글자로 견준다
//
// 이 검사는 **제 수를 들고 있다** — 재는 대상에서 가져오면 양쪽을 같이 고치는 날
// 거짓 통과한다 (10/28 에 밟은 그 자리다).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const FRONT = path.join(ROOT, 'frontend', 'src');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const read = (p) => fs.readFileSync(p, 'utf8');

// ── 1. 자유로 치는 숫자 칸에 테두리가 있는가 ──
//
// 사람이 **값을 치는** 화면만 본다. 재는 도구 · 루틴 폼 · 목표 · 인바디 · 휴식 길이.
// 한 줄로 안 적힌 태그가 많아 **태그 단위**로 자른다
const 칸있는파일 = [
  'components/measure/BodySizeSection.jsx',
  'components/measure/FitnessTestSection.jsx',
  'components/measure/FlexibilitySection.jsx',
  'components/measure/HeartRateSection.jsx',
  'components/measure/OneRMSection.jsx',
  'components/measure/ShoulderSection.jsx',
  'components/measure/StopwatchSection.jsx',
  'pages/RoutinePage.jsx',
  'pages/InbodyPage.jsx',
  'pages/GoalPage.jsx',
  'components/RestTimer.jsx',
  'components/AiAdminPanel.jsx',
];

// **일부러 테두리가 없는 칸**은 여기 까닭과 함께 적는다. 비어 있는 것이 맞는 상태다
const 테두리없음 = {};

const 빈칸 = [];
for (const rel of 칸있는파일) {
  const src = read(path.join(FRONT, rel));
  // `<input ... />` 를 태그째 자른다
  for (const m of src.matchAll(/<input[\s\S]*?\/>/g)) {
    const tag = m[0];
    if (!/type="number"/.test(tag)) continue;
    const 줄 = src.slice(0, m.index).split('\n').length;
    const 자리 = `${rel}:${줄}`;
    if (테두리없음[자리]) continue;
    if (!/\bmin=/.test(tag) || !/\bmax=/.test(tag)) 빈칸.push(자리);
  }
}
console.log(`── 자유로 치는 숫자 칸: ${칸있는파일.length} 파일 ──`);
ok('min · max 가 빠진 칸', 빈칸, []);

// 칸을 하나도 못 찾으면 **이 검사가 아무것도 안 재고 있다는 뜻**이다
let 센칸 = 0;
for (const rel of 칸있는파일) {
  for (const m of read(path.join(FRONT, rel)).matchAll(/<input[\s\S]*?\/>/g)) {
    if (/type="number"/.test(m[0])) 센칸 += 1;
  }
}
console.log(`   센 칸 ${센칸}개`);
ok('재고 있는 칸이 있다', 센칸 >= 20, true);

for (const [자리, 왜] of Object.entries(테두리없음)) console.log(`   일부러 뺌: ${자리} — ${왜}`);

// ── 2. 세트 · 횟수 — 서버와 화면이 같은 수 · 같은 규칙인가 ──
const back = require('../src/utils/setRange');
// **제 수를 들고 견준다** (대상에서 가져오지 않는다)
ok('서버 SETS_MAX', back.SETS_MAX, 100);
ok('서버 REPS_MAX', back.REPS_MAX, 1000);

const limits = read(path.join(FRONT, 'data', 'limits.js'));
// **정규식을 안 쓴다** — 역슬래시는 손으로 옮기다 한 겹 벗겨지기 쉽다
const num = (name) => {
  const head = `export const ${name} = `;
  const i = limits.indexOf(head);
  if (i < 0) return null;
  const v = parseInt(limits.slice(i + head.length), 10);
  return Number.isFinite(v) ? v : null;
};

ok('화면 SETS_MAX', num('SETS_MAX'), back.SETS_MAX);
ok('화면 REPS_MAX', num('REPS_MAX'), back.REPS_MAX);

// 뽑는 규칙. **두 벌인 것을 알고 두는 자리**라 글자로 견준다 —
// `firstNum` 이 쓰는 정규식을 양쪽에서 떼어내 **서로** 맞춰본다.
// 여기서는 제 수를 들 수가 없다(둘 중 어느 쪽이 맞다고 할 근거가 없다) —
// 대신 **달라지는 순간**을 잡는다. 한쪽만 고치는 날 FAIL 한다
const 뽑는자 = (file) => {
  const src = read(file);
  const i = src.indexOf('.match(');
  if (i < 0) return null;
  return src.slice(i + 7, src.indexOf(')', i));
};
const 뒤 = 뽑는자(path.join(ROOT, 'backend', 'src', 'utils', 'setRange.js'));
const 앞 = 뽑는자(path.join(FRONT, 'data', 'setRange.js'));
ok('첫 숫자를 뽑는 규칙이 양쪽에 같다', [뒤, 앞 === 뒤], [앞, true]);
ok('뽑는 자를 찾았다', 뒤 !== null && 뒤.includes('d+'), true);

// ── 3. 서버가 진짜로 막는가 ──
const why = (ex) => { const r = back.checkSetsReps(ex); return r.ok ? null : '거절'; };
ok('999999세트는 거절', why({ name: '벤치', sets: '999999', reps: '10' }), '거절');
ok('0세트는 거절', why({ name: '벤치', sets: '0', reps: '10' }), '거절');
ok('1001회는 거절', why({ name: '벤치', sets: '3', reps: '1001' }), '거절');
// **글로 적힌 것은 통과해야 한다** — 추천 프로그램이 이렇게 적는다
ok("'10~12' 는 통과", why({ name: '벤치', sets: '4', reps: '10~12' }), null);
ok('비어 있으면 통과', why({ name: '벤치' }), null);
ok('테두리 안은 통과', why({ name: '벤치', sets: '100', reps: '1000' }), null);

// ── 4. **이미 담긴** 루틴도 막는가 ──
// 막기 전에 들어간 「999999세트」가 진행표로 넘어가면 화면이 단추를 그 수만큼 그린다
ok("담긴 '999999' 는 모르는 것으로", back.saneSets('999999'), null);
ok("담긴 '4세트' 는 4", back.saneSets('4세트'), 4);
ok("담긴 '10~12회' 는 10", back.saneReps('10~12회'), 10);
ok('담긴 0 은 모르는 것으로', back.saneSets('0'), null);

// ── 5. 화면이 그릴 수를 막는가 ──
// `SetChecks` 가 `Array.from({ length })` 로 단추를 그린다. 그 수가 안 막히면 폰이 멈춘다
const train = read(path.join(FRONT, 'pages', 'TrainPage.jsx'));
const 그리는줄 = train.split('\n').find((l) => l.includes('const count =')) || '';
ok('SetChecks 가 그릴 수를 SETS_MAX 로 막는다', /Math\.min\(/.test(그리는줄) && 그리는줄.includes('SETS_MAX'), true);

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
