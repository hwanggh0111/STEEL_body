// **서버가 못 박은 한도를 화면이 누르기 전에 말하는가** (2026-10-28).
//
//   npm run cap     (npm run check 에도 들어 있다)
//
// ── 왜 ──
//
// 서버는 넘치면 거절한다 — 루틴 한 벌에 운동 쉰 개, 하루에 담는 계획 열 개.
// 그런데 **화면이 그 수를 하나도 말하지 않았다.** 「+ 운동 추가」는 **쉰한 번**
// 눌리고, 저장을 누른 다음에야 「운동은 최대 50개까지 가능해요」가 떴다 — 그 자리에서
// 어느 줄을 지워야 하는지는 아무 말도 없다. 「+ 담기」도 같았다.
//
// 이 앱이 거듭 세워온 선이 그 반대다 — **누르기 전에 말한다**
// (아이디 30일 · 막힘 까닭과 풀리는 때 · 「며칠 남았나는 서버가 센다」).
//
// ── 여기가 지키는 것 ──
//
// 수를 **글자로 적지 않는다.** 화면이 `data/limits.js` 의 이름을 쓰는지 보고,
// 그 값이 서버와 같은지는 `npm run twins`(백엔드)가 이름으로 견준다 —
// 같은 숫자가 두 곳에 있으면 반드시 어긋난다(10/22 에 세운 자).
//
// **막는 것만으로는 모자란다** — 눌리지 않게만 해두면 왜 안 눌리는지 모른다.
// 그래서 ①더 못 하게 막는가 ②그 수를 적어 말하는가 둘을 같이 본다.
const fs = require('fs');
const path = require('path');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};
const codeOf = (s) => s
  .replace(/(^|[\s\{])\/\*[\s\S]*?\*\//g, '$1')
  .replace(/^\s*\/\/.*$/gm, '');
const read = (f) => codeOf(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'));

// 한도마다 — 이름 · 화면 · 서버 파일 · 막는 자리의 꼴
const CAPS = [
  {
    name: 'MAX_EXERCISES',
    label: '루틴 한 벌의 운동',
    screen: 'src/pages/RoutinePage.jsx',
    server: '../backend/src/routes/myRoutines.js',
  },
  {
    name: 'MAX_PER_DAY',
    label: '하루에 담는 계획',
    screen: 'src/components/DaySheet.jsx',
    server: '../backend/src/routes/plans.js',
  },
  {
    name: 'MAX_NOTES',
    label: '루틴 메모 장수',
    screen: 'src/pages/routine/RoutineNotes.jsx',
    server: '../backend/src/routes/notes.js',
  },
  {
    name: 'MAX_GYMS',
    label: '적어둘 헬스장',
    screen: 'src/pages/GymPage.jsx',
    server: '../backend/src/routes/gymSettings.js',
  },
];

const limits = read('src/data/limits.js');

console.log('── 한도를 한 자리에 두는가 ──');
for (const c of CAPS) {
  ok(c.label + ' 이름이 있다', new RegExp('export const ' + c.name + ' = \\d+;').test(limits), true);
}

console.log('');
console.log('── 서버에도 같은 이름이 있는가 (값은 npm run twins 가 견준다) ──');
for (const c of CAPS) {
  let srv = '';
  try { srv = codeOf(fs.readFileSync(path.join(__dirname, '..', c.server), 'utf8')); } catch { /* 없으면 아래에서 FAIL */ }
  ok(c.label + ' 서버가 이름으로 든다', new RegExp('const ' + c.name + ' = \\d+;').test(srv), true);
  // 글자로 박힌 수가 남아 있으면 한쪽만 고쳐지는 날이 온다
  const lit = (limits.match(new RegExp('export const ' + c.name + ' = (\\d+);')) || [])[1];
  ok('  그 수를 글자로 또 적지 않는다',
    lit ? new RegExp('> ' + lit + '\\b').test(srv) : null, false);
}

console.log('');
console.log('── 화면이 누르기 전에 말하는가 ──');
for (const c of CAPS) {
  const src = read(c.screen);
  ok(c.label + ' 화면이 그 이름을 쓴다', new RegExp('\\b' + c.name + '\\b').test(src), true);
  // 수를 글자로 적어두면 서버가 바뀌는 날 거짓말이 된다
  const lit = (limits.match(new RegExp('export const ' + c.name + ' = (\\d+);')) || [])[1];
  ok('  수를 글자로 적지 않는다', lit ? new RegExp("'" + lit + "개|>" + lit + "개").test(src) : null, false);
  // 차면 더 못 하게 막는가. **막는 꼴이 둘이다** — 단추를 끄거나(`disabled`)
  // 그 자리를 아예 안 그린다(`length < MAX_… &&`). 처음에 앞의 것만 보고
  // 멀쩡한 두 화면을 FAIL 했다 (2026-10-28)
  const blocks = new RegExp('disabled=\{[^}]*(' + c.name + '|full)').test(src)
    || /(full \?[\s\S]{0,10}null|!full)/.test(src)
    || new RegExp('\\w+\\.length < ' + c.name).test(src);
  ok('  차면 더 못 담는다', blocks, true);
  // 왜 안 되는지 적는가 — 막기만 하면 왜 안 눌리는지 모른다
  // 줄바꿈이 사이에 들어갈 수 있다 — **글자 사이의 빈칸을 보지 않는다**
  ok('  왜 안 되는지 적는다', /까지\s*담을 수 있어요/.test(src), true);
}

console.log('');
console.log('── 글자 수: 화면이 미리 막는가 ──');
// ── 왜 (2026-10-28) ──
//
// 서버는 긴 이름을 **말없이 자른다**(`cleanName(name, 100)`). 그런데 화면에는 아무
// 제한이 없어서 101자를 치면 저장한 뒤 **잘린 이름**이 된다. 제보함은 「{n}/600」으로
// **세어 보여주는데** 루틴 이름과 운동 이름은 아무 말도 없었다.
//
// 운동 이름은 더 나쁘다 — 잘린 이름은 **사전에 없는 이름**이 되고, 그러면 그 운동은
// **몸 지도에 영영 안 들어간다**(`RoutinePage` 머리글이 적어둔 그 위험이다).
//
// 개수 한도(위)와 달리 **「왜 안 되는지」는 안 묻는다** — 칸에서 글자가 더 안 쳐지는
// 것은 눈에 보인다. 대신 ①화면이 그 이름으로 막는가 ②서버도 그 이름을 쓰는가를 본다.
//
// **이름은 또렷해야 한다** — 처음에 `NAME_MAX`·`EXERCISE_MAX` 로 적었더니 둘 다
// 이미 쓰이는 이름이었다(앱의 만든 소리 이름 6자 · 서버의 헬스장 세팅 운동 이름 40자).
// `npm run twins` 가 「다르다 EXERCISE_MAX = 40 / 100」으로 그 자리에서 잡아줬다
{
  const LETTERS = [
    {
      name: 'ROUTINE_NAME_MAX',
      label: '루틴 이름 글자 수',
      screen: 'src/pages/RoutinePage.jsx',
      server: '../backend/src/routes/myRoutines.js',
    },
    {
      name: 'EXERCISE_NAME_MAX',
      label: '운동 이름 글자 수',
      screen: 'src/components/ExerciseNameInput.jsx',
      server: '../backend/src/routes/workouts.js',
    },
  ];
  for (const c of LETTERS) {
    ok(c.label + ' 이름이 한 자리에 있다', new RegExp('export const ' + c.name + ' = \\d+;').test(limits), true);
    let srv = '';
    try { srv = codeOf(fs.readFileSync(path.join(__dirname, '..', c.server), 'utf8')); } catch { /* 아래에서 FAIL */ }
    ok('  서버도 그 이름으로 든다', new RegExp('const ' + c.name + ' = \\d+;').test(srv), true);
    const src = read(c.screen);
    ok('  화면이 그 이름으로 막는다', new RegExp('maxLength=\{' + c.name + '\}').test(src), true);
    // 수를 글자로 적어두면 서버가 바뀌는 날 거짓말이 된다
    const lit = (limits.match(new RegExp('export const ' + c.name + ' = (\\d+);')) || [])[1];
    ok('  수를 글자로 적지 않는다', lit ? new RegExp('maxLength=\{' + lit + '\}').test(src) : null, false);
  }
}

console.log('');
console.log(bad === 0 ? '모두 통과' : bad + '건 FAIL');
process.exit(bad === 0 ? 0 : 1);
