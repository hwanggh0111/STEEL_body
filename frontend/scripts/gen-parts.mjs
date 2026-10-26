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
//
// ── 서버 것도 같이 쓴다 (2026-09-29) ──
//
// 서버에도 부위 맞히기가 있다(`backend/src/utils/bodyPart.js`) — **알림은 앱이 닫혀
// 있을 때 나가서** 화면의 계산이 못 돌기 때문이다. 그쪽은 CommonJS 라 화면 파일을
// 들여올 수 없어서, 낱말 규칙을 **손으로 맞춰 두고 검사가 대조**하고 있었다
// (`backend/npm run cold`).
//
// 사전 151개까지 손으로 두 벌 적는 것은 반드시 어긋난다. 그래서 **여기서 두 판을
// 같이 쓴다** — 화면용(ESM)과 서버용(CommonJS). 한 곳에서 나오므로 어긋날 자리가 없다.
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

// ── **기구도 사전이 안다** ── (2026-10-26)
//
// 원판 계산(`plateMath.js`)은 「그 운동에 바가 있나」를 **이름의 낱말로만** 맞히고
// 있었다. 사전 219개를 넣어 보니 **91개가 「모름」**이었고, 「바벨」로 읽은 35개 중
// 아홉은 **맨몸·케틀벨 운동**이었다 — 「점프 스쿼트」·「의자 스쿼트」·「고블릿
// 스쿼트」가 「빈 바 20kg」 안내를 받았다(「스쿼트」가 들어 있어서다).
//
// 9/29 에 부위를 사전으로 옮긴 것과 **같은 까닭**이다: 낱말은 변형을 못 따라간다.
// 그래서 사전 칸에 `gear` 를 적고(`'bar'`=바벨 · `'none'`=바 없음 · 안 적으면 모름),
// 여기서 **이름 → 기구** 표만 뽑는다.
//
// **부위 표와 따로 둔다.** 부위는 홈 화면이 받고, 기구는 기록 화면만 쓴다 —
// 한 파일에 담으면 홈이 쓰지 않는 표를 같이 받는다(이 파일을 만든 그 까닭이다).
export function buildGear(dict = EXERCISE_DICT) {
  const table = {};
  for (const e of dict) {
    // **안 적은 것은 적지 않는다.** 「모름」은 사람이 고른 바를 그대로 쓴다는 뜻이고,
    // 여기에 'unknown' 을 적어두면 그 뜻이 「사전이 모른다」로 바뀐다
    if (e.gear !== 'bar' && e.gear !== 'none') continue;
    for (const name of [e.ko, e.en]) {
      const k = norm(name);
      if (k && !(k in table)) table[k] = e.gear;
    }
  }
  return table;
}

export function renderGear(table) {
  const rows = Object.entries(table).map(([k, v]) => `  '${k}': '${v}',`).join('\n');
  return `// **뽑아 적은 파일이다. 손으로 고치지 않는다.**
//
//   npm run parts        사전에서 다시 뽑는다 (scripts/gen-parts.mjs)
//   npm run plate        사전과 어긋나면 잡는다 (scripts/check-plate.cjs)
//
// 원본은 \`exerciseDict.js\` 의 \`gear\` 칸이다. 기구를 고치려면 **거기서** 고친다.
//
//   'bar'   바벨이다 — 양쪽에 같은 원판을 꽂는다
//   'none'  바가 없다 — 덤벨 · 머신 · 케이블 · 맨몸. 표시 무게가 곧 그 무게다
//
// **안 적힌 이름은 「모름」이다** — 바벨로도 덤벨로도 하는 것(숄더프레스 · 슈러그 ·
// 스컬크러셔 …)은 일부러 비워 둔다. 그때는 사람이 고른 바를 그대로 쓴다.
export const EXERCISE_GEAR = {
${rows}
};
`;
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

/** 서버용 판. 내용은 같고 내보내는 방식만 CommonJS 다. */
export function renderCjs(table) {
  const body = render(table)
    .replace('export const EXERCISE_PART = {', 'const EXERCISE_PART = {')
    .replace(
      '//   npm run parts        사전에서 다시 뽑는다 (scripts/gen-parts.mjs)',
      '//   cd frontend && npm run parts     사전에서 다시 뽑는다 (화면 것과 같이 나온다)',
    );
  return `${body}module.exports = { EXERCISE_PART };
`;
}

const table = buildTable();
const gear = buildGear();
const FILES = [
  [new URL('../src/data/exercisePart.js', import.meta.url), render(table), 'frontend/src/data/exercisePart.js'],
  [new URL('../../backend/src/utils/exercisePart.cjs', import.meta.url), renderCjs(table), 'backend/src/utils/exercisePart.cjs'],
  [new URL('../src/data/exerciseGear.js', import.meta.url), renderGear(gear), 'frontend/src/data/exerciseGear.js'],
];

const n = Object.keys(table).length;
let wrote = 0;
for (const [url, text, label] of FILES) {
  let now = '';
  try { now = readFileSync(url, 'utf8'); } catch { /* 처음이면 없다 */ }
  if (now === text) continue;
  writeFileSync(url, text);
  wrote += 1;
  console.log(`[parts] ${n}개 → ${label}`);
}
if (wrote === 0) console.log(`[parts] 그대로 — ${n}개 · 두 판 · 기구 ${Object.keys(gear).length}개`);
