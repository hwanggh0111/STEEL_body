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
  // **관리자 화면도 본다** (2026-10-28) — 사이트 사진은 이미 「12 / 12장 · 지워야 더
  // 걸 수 있어요」로 세어 보여줬는데 **점검 쪽만** 아무 말이 없었다.
  // 넷 중 하나만 다른 자리는 잊은 자리다
  {
    name: 'MAINT_MAX',
    label: '점검 스케줄 개수',
    screen: 'src/components/admin/MaintAdmin.jsx',
    server: '../backend/src/routes/maintenance.js',
    says: '지워야 더 걸 수 있어요',
  },
  {
    name: 'MAX_COUNT',
    label: '홈페이지 사진 장수',
    screen: 'src/components/admin/SitePhotoAdmin.jsx',
    server: '../backend/src/routes/sitePhotos.js',
    says: '지워야 더 걸 수 있어요',
    // 이 수는 **그 화면 하나만** 쓴다 — 여럿이 쓰는 것만 `limits.js` 로 올린다
    where: 'screen',
  },
];

const limits = read('src/data/limits.js');


// **어디에 두는 것이 맞나는 자리마다 다르다** (2026-10-28). 여럿이 쓰는 것은
// `data/limits.js` 로 올리고, **그 화면 하나만 쓰는 것**은 그 화면에 둔다 —
// 올려두면 「여럿이 쓰는 것」이라고 거짓말하는 셈이다. 어느 쪽이든 **서버와 이름이
// 같으면** `npm run twins` 가 값을 견준다. 세 칸이 같은 손을 쓴다
const holderOf = (c) => {
  const screen = read(c.screen);
  const onScreen = c.where === 'screen';
  const holder = onScreen ? screen : limits;
  const decl = onScreen ? 'const ' : 'export const ';
  const lit = (holder.match(new RegExp(decl + c.name + ' = (\\d+);')) || [])[1];
  return { screen, holder, decl, lit };
};

console.log('── 한도를 한 자리에 두는가 ──');
for (const c of CAPS) {
  const { holder, decl } = holderOf(c);
  ok(c.label + ' 이름이 있다', new RegExp(decl + c.name + ' = \\d+;').test(holder), true);
}

console.log('');
console.log('── 서버에도 같은 이름이 있는가 (값은 npm run twins 가 견준다) ──');
for (const c of CAPS) {
  let srv = '';
  try { srv = codeOf(fs.readFileSync(path.join(__dirname, '..', c.server), 'utf8')); } catch { /* 없으면 아래에서 FAIL */ }
  ok(c.label + ' 서버가 이름으로 든다', new RegExp('const ' + c.name + ' = \\d+;').test(srv), true);
  // 글자로 박힌 수가 남아 있으면 한쪽만 고쳐지는 날이 온다
  const { lit } = holderOf(c);
  ok('  그 수를 글자로 또 적지 않는다',
    lit ? new RegExp('> ' + lit + '\\b').test(srv) : null, false);
}

console.log('');
console.log('── 화면이 누르기 전에 말하는가 ──');
for (const c of CAPS) {
  const { screen: src, lit } = holderOf(c);
  ok(c.label + ' 화면이 그 이름을 쓴다', new RegExp('\\b' + c.name + '\\b').test(src), true);
  // 수를 글자로 적어두면 서버가 바뀌는 날 거짓말이 된다
  ok('  수를 글자로 적지 않는다', lit ? new RegExp("'" + lit + "개|>" + lit + "개").test(src) : null, false);
  // 차면 더 못 하게 막는가. **막는 꼴이 둘이다** — 단추를 끄거나(`disabled`)
  // 그 자리를 아예 안 그린다(`length < MAX_… &&`). 처음에 앞의 것만 보고
  // 멀쩡한 두 화면을 FAIL 했다 (2026-10-28)
  const blocks = new RegExp('disabled=\{[^}]*(' + c.name + '|full)').test(src)
    || /(full \?[\s\S]{0,10}null|!full)/.test(src)
    || new RegExp('\\w+\\.length < ' + c.name).test(src);
  ok('  차면 더 못 담는다', blocks, true);
  // 왜 안 되는지 적는가 — 막기만 하면 왜 안 눌리는지 모른다.
  //
  // **말하는 꼴이 자리마다 다른 것은 글자로 알아볼 수 없다** (10/27 에 세운 자).
  // 느슨하게 보면 거짓 통과하고 좁게 보면 멀쩡한 자리가 FAIL 한다 — 관리자 화면 둘이
  // 「지워야 더 걸 수 있어요」라고 적는데 「까지 담을 수 있어요」만 찾아서 FAIL 했다.
  // 그래서 **자리마다 그 말을 표에 적어두고, 새 자리에서 FAIL** 하게 둔다.
  // 글자 사이의 빈칸은 안 본다 — 줄바꿈이 사이에 들어갈 수 있다
  const says = c.says || '까지 담을 수 있어요';
  ok('  왜 안 되는지 적는다 (「' + says + '」)',
    new RegExp(says.replace(/ /g, '\\s*')).test(src), true);
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
    // **관리자 화면도 본다** — 그 글은 쓰는 사람이 읽는다. 점검 사유는 점검 안내
    // 화면에 그대로 뜨고, 답장은 제보한 사람이 읽는다
    {
      name: 'REASON_MAX',
      label: '점검 사유 글자 수',
      screen: 'src/components/admin/MaintAdmin.jsx',
      server: '../backend/src/routes/maintenance.js',
    },
    {
      name: 'BODY_MAX',
      label: '제보 답장 글자 수',
      screen: 'src/components/admin/ReportAdmin.jsx',
      server: '../backend/src/routes/reports.js',
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
console.log('── 숫자 칸: 테두리를 칸에 붙였나 ──');
// ── 왜 (2026-10-28) ──
//
// 인바디 칸 다섯(키 · 체중 · 체지방률 · 골격근량 · 체수분)에 `max` 가 **하나도
// 없었다.** 201kg 을 적고 저장을 누른 다음에야 서버 말을 들었고, **골격근량과
// 체수분은 화면이 아무 검사도 안 했다.**
//
// 그리고 같은 테두리가 **세 자리**에 글자로 박혀 있었다(서버 두 번 · 파일로 넣는 길)
// — 거기서 **체지방률만 서로 달랐다**: 화면 60 : 서버·파일 100. `csvRows.js` 는 그 줄
// 위에 **「화면·서버가 쓰는 것과 같은 테두리」**라고 적어두고 있었다. 아니었다.
// 셋을 `backend/src/utils/inbodyRange.js` 한 자리로 모았다.
{
  const NUMS = [
    { name: 'INBODY_HEIGHT_MAX', label: '키' },
    { name: 'INBODY_WEIGHT_MAX', label: '체중' },
    { name: 'FAT_PCT_MAX', label: '체지방률' },
    { name: 'MUSCLE_KG_MAX', label: '골격근량' },
    { name: 'WATER_L_MAX', label: '체수분' },
  ];
  const page = read('src/pages/InbodyPage.jsx');
  const range = codeOf(fs.readFileSync(path.join(__dirname, '..', '..', 'backend', 'src', 'utils', 'inbodyRange.js'), 'utf8'));
  const csv = codeOf(fs.readFileSync(path.join(__dirname, '..', '..', 'backend', 'src', 'utils', 'csvRows.js'), 'utf8'));
  const route = codeOf(fs.readFileSync(path.join(__dirname, '..', '..', 'backend', 'src', 'routes', 'inbody.js'), 'utf8'));

  for (const c of NUMS) {
    ok(c.label + ' 이름이 한 자리에 있다', new RegExp('export const ' + c.name + ' = \\d+;').test(limits), true);
    ok('  서버도 그 이름으로 든다', new RegExp('const ' + c.name + ' = \\d+;').test(range), true);
    ok('  화면 칸이 그 이름으로 막는다', new RegExp('max=\{' + c.name + '\}').test(page), true);
  }
  // 파일로 넣는 길과 라우트가 **그 한 자리에서** 가져오는가 (제 표를 또 들지 않는다)
  ok('파일로 넣는 길이 같은 테두리를 쓴다', /require\('\.\/inbodyRange'\)/.test(csv), true);
  ok('  제 표를 또 들지 않는다', /fat_pct: \[0, 100\]/.test(csv), false);
  ok('라우트도 그 자리에서 가져온다', /require\('\.\.\/utils\/inbodyRange'\)/.test(route), true);
  ok('  거절하는 말이 그 수로 지어진다', /\${FAT_PCT_MAX}/.test(route), true);
}

console.log('');
console.log(bad === 0 ? '모두 통과' : bad + '건 FAIL');
process.exit(bad === 0 ? 0 : 1);
