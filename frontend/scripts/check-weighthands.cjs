// 무게를 읽는 손은 **둘뿐이어야 한다** (2026-11-10).
//
//   cd frontend && npm run weighthands        (npm run check 에도 들어 있다)
//   node scripts/check-weighthands.cjs --root <딴 폴더>   ← 되돌려-FAIL 시험용
//
// ── 왜 이 자가 있나 ──
//
// 무게 칸은 **자유 입력**이다 — 「60」·「60kg」·「20kg 양쪽」·「맨몸」·「밴드」가
// 다 들어온다. 그래서 글자에서 수를 꺼내는 손이 필요하고, 그 손은 **두 자리에만**
// 있어야 한다 —
//
//   backend/src/utils/workoutFields.js   서버가 받을지 말지 정할 때
//   frontend/src/data/personalRecord.js  화면이 셀 때 (`parseWeight`)
//
// 그 둘이 같은 값을 같게 읽는지는 `npm run weightread` 가 **함수를 불러** 견준다.
// 그런데 그 자는 **세 번째 손을 못 본다** — 화면 안에 박힌 정규식은 함수가 아니라서
// 부를 수가 없다. 실제로 그런 손이 **둘 더** 있었다 (2026-11-10) —
//
//   TrainPage.jsx  todayKg        원판 · 1RM % · 워밍업이 쓰는 수
//   TrainPage.jsx  justSaved.kg   저장 직후 카드에 적히는 수
//
// 그 둘은 `String(x).match(/\d+(?:\.\d+)?/)` 였다. 그래서 —
//
//     적은 값     parseWeight   그 손
//     "-50"      null          **50**    ← 10/28 에 고친 「음수 부호」가 안 들어갔다
//     "1,000"    1000          **1**     ← 11/10 에 고친 「쉼표」가 안 들어갔다
//
// 「-50」을 적으면 원판 줄이 **「양쪽 15」**라고 말했다. 서버는 거부하는 줄인데
// 화면은 꽂을 것을 알려줬다.
//
// ── 그래서 이 자는 글자를 본다 ──
//
// 값을 견주는 자(`weightread`)가 이미 있다. 이 자가 보는 것은 **손이 몇 벌인가**다.
// 새 손이 생기는 순간 잡는다 — 생기고 나서 고치면 그 사이에 적은 기록이 틀린다.
const fs = require('fs');
const path = require('path');

const argRoot = (() => {
  const i = process.argv.indexOf('--root');
  return i > -1 ? process.argv[i + 1] : null;
})();
const ROOT = argRoot ? path.resolve(argRoot) : path.join(__dirname, '..', '..');

// 손을 들어도 되는 자리 — **셋이고, 저마다 까닭이 다르다.**
//
//   backend/src/utils/workoutFields.js     서버가 받을지 말지 정한다 (상한 999)
//   frontend/src/data/personalRecord.js    화면이 센다 (`parseWeight`)
//   frontend/src/components/DaySheet.jsx   달력에서 **저장 전에** 상한을 미리 말한다
//                                          (서버와 같은 선을 본다 — 11/3 `c241638`)
//
// 넷째가 생기면 여기서 막는다. 쓰려면 `parseWeight` 를 **가져다 써라.**
const ALLOWED = [
  path.join('backend', 'src', 'utils', 'workoutFields.js'),
  path.join('frontend', 'src', 'data', 'personalRecord.js'),
  path.join('frontend', 'src', 'components', 'DaySheet.jsx'),
];

// 무게가 아닌 것을 읽는 자리 — 목소리는 「이십오」 같은 말도 듣는다. 무게 손이 아니다
const NOT_WEIGHT = [path.join('frontend', 'src', 'data', 'voiceLog.js')];

const SKIP_DIRS = ['node_modules', 'dist', 'android', '.git', 'build'];
const SKIP_FILE = (p) => /check-[^\\/]*\.cjs$/.test(p);

const walk = (dir, out = []) => {
  let items;
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const it of items) {
    if (SKIP_DIRS.includes(it.name)) continue;
    const p = path.join(dir, it.name);
    if (it.isDirectory()) walk(p, out);
    else if (/\.(js|jsx|cjs|mjs)$/.test(it.name) && !SKIP_FILE(p)) out.push(p);
  }
  return out;
};

// 주석은 걷는다 — 왜 뺐는지 적은 주석에 그 꼴이 들어 있다 (다른 자들과 같은 모양).
//
// ★ **줄 수를 그대로 둔다.** 처음엔 여러 줄 주석을 통째로 지웠더니 그만큼 줄이
// 당겨져 **DaySheet 의 114 를 110 이라고 가리켰다.** 자가 엉뚱한 줄을 짚으면
// 받는 쪽이 거기 가서 아무것도 못 찾는다 — 그 자는 없느니만 못하다.
// 그래서 지우는 대신 **줄바꿈만 남긴다.**
const blank = (m) => m.replace(/[^\n]/g, ' ');
const codeOf = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/^(\s*)\/\/.*$/gm, '$1')
  .replace(/([^:])\/\/.*$/gm, '$1');

// 「글자에서 수를 꺼낸다」의 서명. `.match(…)` 든 `.exec(…)` 든 같은 손이다
const HAND = (line) => line.includes('\\d+(?:\\.\\d+)?');
// 쉼표·빈칸을 떼는가 — 11/10 에 어긋난 바로 그 자리다
const STRIPS = (line) => line.includes('[,\\s]');

const files = [
  ...walk(path.join(ROOT, 'frontend', 'src')),
  ...walk(path.join(ROOT, 'backend', 'src')),
];

let bad = 0;
const hands = [];
for (const f of files) {
  const rel = path.relative(ROOT, f);
  if (NOT_WEIGHT.some((n) => rel.endsWith(n))) continue;
  const lines = codeOf(fs.readFileSync(f, 'utf8')).split('\n');
  lines.forEach((line, i) => {
    if (!HAND(line)) return;
    hands.push({
      rel, line: i + 1,
      allowed: ALLOWED.some((a) => rel.endsWith(a)),
      strips: STRIPS(line),
      text: line.trim().slice(0, 78),
    });
  });
}

console.log('── 무게를 글자에서 읽는 손 ──');
if (!files.length) { console.log('FAIL 볼 파일이 없다 — --root 가 맞나'); process.exit(1); }
console.log(`     훑은 파일 ${files.length}개`);
for (const h of hands) {
  if (!h.allowed) { bad += 1; console.log(`FAIL ${h.rel}:${h.line}  허락 밖의 손이다 — parseWeight 를 가져다 써라`); console.log(`       ${h.text}`); continue; }
  if (!h.strips) { bad += 1; console.log(`FAIL ${h.rel}:${h.line}  쉼표·빈칸을 안 뗀다 — 「1,000」을 1 로 읽는다`); console.log(`       ${h.text}`); continue; }
  console.log(`OK   ${h.rel}:${h.line}`);
}

// 허락한 세 자리는 **있어야 한다.** 없어지면 그것도 어긋난 것이다
for (const a of ALLOWED) {
  const found = hands.some((h) => h.rel.endsWith(a));
  console.log(`${found ? 'OK   ' : 'FAIL '}있어야 할 손 — ${a}`);
  if (!found) bad += 1;
}

const extra = hands.filter((h) => !h.allowed).length;
console.log(`\n     손 ${hands.length}벌 · 허락 밖 ${extra}벌`);
console.log(bad ? `\nFAIL ${bad}건 — 무게를 읽는 손은 두 자리뿐이다. 새 자리는 parseWeight 를 가져다 써라` : '\n전부 통과');
process.exit(bad ? 1 : 0);
