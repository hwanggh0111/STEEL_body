// 명조로 그리는 글자가 **무엇인가** (2026-10-20).
//
// 만드는 쪽(`gen-serif.mjs`)과 보는 쪽(`check-font.cjs`)이 **같은 것을 세야 한다.**
// 두 벌로 적으면 잘라둔 글꼴과 화면이 조용히 어긋난다 — 어긋나면 그 글자만
// 기기 글꼴로 떨어져서 **한 줄 안에서 글꼴이 섞인다.**
//
// ── 넉넉히 센다 ──
//
// 「`.serif-display` 가 붙은 줄의 글자만」 세는 것이 가장 작지만, 그걸 세려면
// JSX 를 읽어 그 줄의 글자를 가려내야 한다 — 그 자리는 조건이 갈라지고(`cold.days`),
// 다른 파일에서 만든 줄을 받아 그린다(`weekLine` · `spokenLabel`).
//
// 그래서 **명조를 그리는 파일의 한글을 통째로** 센다. 주석은 뺀다. 재보니 —
//
//     딱 그 줄만      217 자  →  30.2KB
//     파일 통째로     460 자  →  59.7KB     ← 이것
//     구글에서 받기 (지금)    →  236.6KB
//
// 29KB 를 더 받는 대신 **세는 규칙이 한 줄**이 된다. 그 줄에 새 문구를 적어도
// 글꼴이 안 깨지고, 깨질 수 있는 자리(사전이 늘어날 때)는 검사가 잡는다.
const fs = require('fs');
const path = require('path');

// 명조를 그리는 파일(`.serif-display`)과, 그 줄에 들어갈 글을 **만드는** 파일.
// 여기에 빠진 파일이 명조를 쓰면 그 화면의 글자가 기기 글꼴로 섞인다 —
// 그래서 `check-font.cjs` 가 `.serif-display` 를 쓰는 파일이 이 목록에 다 있는지 본다.
const FILES = [
  'src/pages/SiteHome.jsx',
  'src/pages/HomePage.jsx',
  'src/pages/GoalPage.jsx',
  'src/components/BodyMap.jsx',
  'src/components/SessionFinish.jsx',
  'src/components/YearWall.jsx',
  'src/components/home/GoalCard.jsx',
  'src/components/VoiceSet.jsx',
  // 홈페이지의 증거 둘 (2026-10-20) — 각인 줄을 명조로 적는다
  'src/components/site/FinishPreview.jsx',
  'src/components/site/WallPreview.jsx',
  // 그 줄에 들어가는 글을 **만드는** 자리 — 「이번 주 세 번 하셨어요」(`weekLine`) ·
  // 「벤치프레스 80kg 10회」(`spokenLabel`)
  'src/data/goal.js',
  'src/data/voiceLog.js',
];

// 숫자 · 기호 · 라틴. 한글 조각과 달리 이쪽은 글리프 하나가 몇십 바이트다
const ALWAYS = '0123456789 ,.·%()「」:;~-–+/「」’‘“”kgKG';

// 운동 이름은 **사전이 원본**이다(`exerciseDict.js` 의 `ko`). 결산의 각인과
// 말로 적기가 그 이름을 명조로 적는다 — 사전이 늘면 글자도 늘어난다.
function exerciseNames(root) {
  const src = fs.readFileSync(path.join(root, 'src/data/exerciseDict.js'), 'utf8');
  return [...src.matchAll(/ko:\s*'([^']+)'/g)].map((m) => m[1]).join('');
}

// 부위 이름도 원본이 따로 있다 (`partNames.js`)
function partNames(root) {
  const src = fs.readFileSync(path.join(root, 'src/data/partNames.js'), 'utf8');
  const m = src.match(/export const PARTS = \[([^\]]+)\]/);
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).join('') : '';
}

/** 주석을 뺀다 — 이 코드베이스의 주석은 한글이 길다. 담으면 글꼴이 두 배가 된다 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join('\n');
}

const HANGUL = /[가-힣ㄱ-ㆎ]/g;

/**
 * 명조에 들어가야 하는 글자. **차례를 고정해서** 돌려준다 —
 * 같은 입력이면 같은 글자열이 나와야 잘라둔 파일이 쓸데없이 바뀌지 않는다.
 */
function collect(root) {
  const chars = new Set(ALWAYS.split(''));
  const perFile = {};
  for (const rel of FILES) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) { perFile[rel] = null; continue; }
    const found = stripComments(fs.readFileSync(full, 'utf8')).match(HANGUL) || [];
    perFile[rel] = new Set(found).size;
    for (const ch of found) chars.add(ch);
  }
  for (const ch of exerciseNames(root)) chars.add(ch);
  for (const ch of partNames(root)) chars.add(ch);
  return { text: [...chars].sort().join(''), perFile };
}

module.exports = { collect, FILES, stripComments };
