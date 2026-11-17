// **화면이 말하는 한도가 상수에서 오는가** (2026-11-17 · 맵시).
//
//   npm run saysize     (npm run check 에도 들어 있다)
//
// ── 왜 이 자가 생겼나 ──
//
// 정석이 넘긴 선이다 — **「까닭이 가리키는 길이 실제로 통해야 그 글이 제 일을 한다.」**
// 그쪽이 서버에서 그 꼴을 잡았다(꺾쇠 거절이 「「L < R」 처럼 띄어 주세요」라고
// 안내하면서 **띄어 쓴 것도 거절**했다 — 식에 `\s*` 가 있었다). 같은 선을 화면의
// 글에 돌려보니 **한도를 글자로 적어둔 자리 넷**이 나왔다:
//
//     LoginPage.jsx    `nick.length > 30` · 「닉네임은 30자 이하여야 해요」 ·
//                      「{oauthNick.length}/30자」 — **`NICKNAME_MAX` 를 이미
//                      들여놓고도** 세 자리에 `30` 을 적었다
//     RoutineNotes.jsx `maxLength={2000}` · 「{draft.length}/2000」
//     support/faq.js   「메모는 30장까지, 한 장에 2000자까지예요」
//
// 메모 길이는 **이름이 아예 없었다** — 장수(`MAX_NOTES`)는 상수인데 길이는 네
// 자리(화면 둘 · 고객센터 글 · 서버)에 `2000` 이 흩어져 있었다. `limits.js` 머리글이
// 적어둔 그 꼴이다: **넷 중 하나만 다른 자리는 잊은 자리다.**
//
// **고객센터 글이 특히 나쁘다** — 사람이 그 수를 믿고 적는다. 상한이 바뀌면 안내가
// 거짓이 되고, **거짓인 안내는 그 수에 걸려본 사람만** 안다.
//
// ── 왜 훑지 않고 짝을 적는가 ──
//
// 처음에는 「`N자` 꼴 글에 적힌 수가 `limits` 값과 같으면 FAIL」로 **전수 훑기**를
// 지으려 했다. 그런데 그 식을 두 번 돌렸을 때 **같은 입력에 다른 답**이 나왔다
// (`VoiceSet` 의 보기 말 「60 12개 3세트」가 한 번은 걸리고 한 번은 안 걸렸다).
// **답이 흔들리는 식으로는 자를 세우지 않는다** — 자가 거짓이면 그날 판정이 전부
// 오염된다(11/16 의 그 교훈). 그래서 `check-cap` 과 같은 꼴로 **짝을 적는다**:
// 어느 파일이 어느 상수의 값을 생수로 적으면 안 되는지.
//
// 짝을 적는 대신 **값은 `limits.js` 에서 읽는다** — 상수가 바뀌면 자가 따라간다.
//
//   node scripts/check-saysize.cjs --되돌려   생수를 되박은 꼴을 먹여 빨개지는지 본다

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};
const codeOf = (s) => s
  .replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, '$1')
  .replace(/^\s*\/\/.*$/gm, '');

/** 한도 값을 `limits.js` 에서 읽는다 — 베껴 적지 않는다 */
const 한도 = (() => {
  const src = fs.readFileSync(path.join(SRC, 'data', 'limits.js'), 'utf8');
  const out = {};
  for (const m of src.matchAll(/export const (\w+)\s*=\s*(\d+)\s*;/g)) out[m[1]] = Number(m[2]);
  return out;
})();

// **어느 파일이 어느 한도를 말하는가.** 그 파일에 그 값이 생수로 있으면 FAIL —
// 이름을 들여왔으면 이름을 쓴다
const 짝 = [
  { file: 'pages/LoginPage.jsx', 이름: ['NICKNAME_MAX'], 뜻: '소셜 로그인 뒤 닉네임 정하는 칸' },
  { file: 'pages/routine/RoutineNotes.jsx', 이름: ['MAX_NOTES', 'NOTE_BODY_MAX'], 뜻: '루틴 메모 장수 · 한 장 길이' },
  { file: 'pages/support/faq.js', 이름: ['MAX_NOTES', 'NOTE_BODY_MAX'], 뜻: '고객센터가 적어주는 그 두 수' },
];

console.log('── 한도 상수 ──');
ok('`limits.js` 에서 값을 읽었다', Object.keys(한도).length > 10, true);
for (const n of ['NICKNAME_MAX', 'MAX_NOTES', 'NOTE_BODY_MAX']) {
  ok('  ' + n + ' 이 있다', Number.isFinite(한도[n]), true);
}

console.log('\n── 그 수를 글자로 적지 않았는가 ──');
for (const row of 짝) {
  const raw = fs.readFileSync(path.join(SRC, row.file), 'utf8');
  const src = codeOf(raw);
  const 생수 = [];
  for (const n of row.이름) {
    const v = 한도[n];
    if (!Number.isFinite(v)) continue;
    // 이름을 들여왔는지 — 안 들여왔으면 그것부터 적는다
    if (!new RegExp(`\\b${n}\\b`).test(src)) 생수.push(`${n} 이름을 안 쓴다`);
    // 글자 수를 말하는 자리에 그 값이 생수로 있나 (`30자` · `/2000` · `> 30` · `maxLength={2000}`)
    const 꼴 = [
      new RegExp(`\\b${v}\\s*(?:자|장)(?![a-zA-Z0-9])`),
      new RegExp(`maxLength=\\{\\s*${v}\\s*\\}`),
      new RegExp(`\\.length\\s*[<>]=?\\s*${v}\\b`),
      new RegExp(`/\\s*${v}\\s*자`),
      new RegExp(`slice\\(\\s*0\\s*,\\s*${v}\\s*\\)`),
    ];
    for (const re of 꼴) {
      const m = re.exec(src);
      if (m) 생수.push(`${n}(${v}) → «${m[0]}»`);
    }
  }
  ok(`${row.file} — ${row.뜻}`, 생수, []);
}

// ─────────────────────────────────────────────────────────────
if (process.argv.includes('--되돌려')) {
  console.log('\n── 되돌려-FAIL: 생수를 되박은 꼴을 먹인다 ──');
  // **본 검사와 같은 꼴 식**을 쓴다 — 되돌려가 제 식을 들면, 식을 넓히는 날
  // 되돌려만 옛 식을 본다 (정석이 `check-typedfield` 에서 실제로 밟은 자리다)
  const 잡히나 = (src, n, v) => {
    const 꼴 = [
      new RegExp(`\\b${v}\\s*(?:자|장)(?![a-zA-Z0-9])`),
      new RegExp(`maxLength=\\{\\s*${v}\\s*\\}`),
      new RegExp(`\\.length\\s*[<>]=?\\s*${v}\\b`),
      new RegExp(`/\\s*${v}\\s*자`),
      new RegExp(`slice\\(\\s*0\\s*,\\s*${v}\\s*\\)`),
    ];
    return 꼴.some((re) => re.test(src)) ? n : null;
  };
  const v닉 = 한도.NICKNAME_MAX;
  const v메모 = 한도.NOTE_BODY_MAX;
  ok('「30자 이하여야 해요」로 되박으면 걸린다',
    잡히나(`setNickError('닉네임은 ${v닉}자 이하여야 해요')`, 'NICKNAME_MAX', v닉), 'NICKNAME_MAX');
  ok('  「{length}/30자」 로 되박으면 걸린다',
    잡히나(`{oauthNick.length}/${v닉}자`, 'NICKNAME_MAX', v닉), 'NICKNAME_MAX');
  ok('  `.length > 30` 으로 되박으면 걸린다',
    잡히나(`if (nick.length > ${v닉})`, 'NICKNAME_MAX', v닉), 'NICKNAME_MAX');
  ok('  `maxLength={2000}` 으로 되박으면 걸린다',
    잡히나(`maxLength={${v메모}}`, 'NOTE_BODY_MAX', v메모), 'NOTE_BODY_MAX');
  ok('  `slice(0, 30)` 으로 되박으면 걸린다',
    잡히나(`nick.slice(0, ${v닉})`, 'NICKNAME_MAX', v닉), 'NICKNAME_MAX');
  ok('이름을 쓴 꼴은 안 걸린다 (거짓 FAIL 막이)',
    잡히나('maxLength={NOTE_BODY_MAX} · {draft.length}/{NOTE_BODY_MAX}', 'NOTE_BODY_MAX', v메모), null);
  ok('  다른 수는 안 걸린다 (보기 말 「60 12개 3세트」)',
    잡히나('「60 12개 3세트」처럼 말해보세요', 'NOTE_BODY_MAX', v메모), null);
}

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
