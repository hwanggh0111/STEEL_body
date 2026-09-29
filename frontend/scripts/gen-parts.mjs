// 부위 표를 사전에서 뽑는다 (2026-09-29).
//
//   npm run parts     (predev · prebuild 에도 들어 있다)
//
// ── 왜 뽑아 쓰나 ──
//
// 부위는 사전(`src/data/exerciseDict.js`)에 칸마다 적혀 있고 **그것이 원본이다.**
// 그런데 몸 지도 · 체형 읽기가 쓰는 `bodyPart.js` 가 사전을 통째로 들여오면,
// **홈 화면이 설명글 24KB 를 같이 받는다** — 홈은 부위만 알면 되는데 운동 설명
// (「평평한 벤치에서 바벨을 밀어올림…」) 151줄까지 따라온다.
//
// 그래서 **이름 → 부위**만 뽑아 `src/data/exercisePart.js` 로 적어둔다. 공지 목록을
// 커밋에서 뽑는 것과 같은 결이다(`gen-changelog.mjs`). 뽑은 파일은 커밋에 넣는다 —
// 받는 사람이 스크립트를 안 돌려도 앱이 돌아야 한다.
//
// **손으로 고치지 않는다.** 어긋나면 `npm run parts` 가 잡는다(`check-parts.cjs`).
import { readFileSync, writeFileSync } from 'node:fs';
import { EXERCISE_DICT } from '../src/data/exerciseDict.js';

// `bodyPart.js` · `exerciseDict.js` 가 쓰는 것과 **같은 다듬기**여야 한다.
// 다르면 표를 찾는 열쇠가 어긋나 조용히 안 맞는다
const norm = (s) => String(s || '').toLowerCase().replace(/[\s.,!?~·・\-_'"()]/g, '');

/** 지도가 아는 여섯 부위. 「전신 · 유산소」는 여기 없어서 '기타' 로 적는다. */
const MAP_PARTS = ['가슴', '등', '어깨', '하체', '팔', '코어'];

export function buildTable(dict = EXERCISE_DICT) {
  const table = {};
  for (const e of dict) {
    const part = MAP_PARTS.includes(e.part) ? e.part : '기타';
    for (const name of [e.ko, e.en]) {
      const k = norm(name);
      // **먼저 적힌 것이 이긴다.** 「사이드레이즈」와 「레터럴 레이즈」는 영어 이름이
      // 같다(lateral raise) — 뒤엣것이 앞엣것을 덮으면 안 된다
      if (k && !(k in table)) table[k] = part;
    }
  }
  return table;
}

export function render(table) {
  const rows = Object.entries(table)
    .map(([k, v]) => `  '${k}': '${v}',`)
    .join('\n');
  return `// **뽑아 적은 파일이다. 손으로 고치지 않는다.**
//
//   npm run parts        사전에서 다시 뽑는다 (scripts/gen-parts.mjs)
//   npm run check        사전과 어긋나면 잡는다 (scripts/check-parts.cjs)
//
// 원본은 \`exerciseDict.js\` 의 \`part\` 칸이다. 부위를 고치려면 **거기서** 고친다.
// 여기 따로 두는 까닭은 홈 화면이 운동 설명 24KB 까지 받지 않게 하기 위해서다 —
// 지도와 체형 읽기는 이름과 부위만 알면 된다.
//
// 열쇠는 이미 다듬어진 것(소문자 · 공백과 기호 없음)이라 앱은 다듬는 일을 안 한다.
// 「전신 · 유산소」는 지도에 없는 부위라 '기타' 로 적혀 있다 — 못 맞힌 것이 아니라
// 여섯 부위 중에 셀 곳이 없다는 뜻이다.
export const EXERCISE_PART = {
${rows}
};
`;
}

const OUT = new URL('../src/data/exercisePart.js', import.meta.url);
const next = render(buildTable());
let now = '';
try { now = readFileSync(OUT, 'utf8'); } catch { /* 처음이면 없다 */ }
if (now === next) {
  console.log(`[parts] 그대로 — ${Object.keys(buildTable()).length}개`);
} else {
  writeFileSync(OUT, next);
  console.log(`[parts] ${Object.keys(buildTable()).length}개 → src/data/exercisePart.js`);
}
