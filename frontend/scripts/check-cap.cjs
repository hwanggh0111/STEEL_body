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
  // 차면 더 못 하게 막는가 (단추를 끄거나 그 자리를 안 그린다)
  ok('  차면 더 못 담는다', /disabled=\{[^}]*(MAX_|full)/.test(src) || /full \?\ s*null/.test(src) || /!full/.test(src), true);
  // 왜 안 되는지 적는가 — 막기만 하면 왜 안 눌리는지 모른다
  // 줄바꿈이 사이에 들어갈 수 있다 — **글자 사이의 빈칸을 보지 않는다**
  ok('  왜 안 되는지 적는다', /까지\s*담을 수 있어요/.test(src), true);
}

console.log('');
console.log(bad === 0 ? '모두 통과' : bad + '건 FAIL');
process.exit(bad === 0 ? 0 : 1);
