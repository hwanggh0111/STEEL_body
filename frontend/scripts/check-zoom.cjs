// **글자를 키우면 그릇도 자라는가** (2026-11-27 · 맵시)
//
//   npm run zoom     (npm run check 에도 들어 있다)
//
// ── 왜 이 자가 생겼나 ──
//
// 안드로이드 WebView 는 시스템 글자 크기를 `textZoom` 으로 먹인다 — **`px` 로 적은
// 글자에도** 먹는다. 그래서 폰 설정에서 글자를 150~200% 로 키우면 이 앱의 글자는
// 전부 1.5~2배가 되는데, `width: 16` · `height: 32` 처럼 **px 로 박은 그릇은 그대로**다.
// 글자만 자라고 그릇이 안 자라면 **칸을 넘거나 잘린다.**
//
// 11/18 에 제보함 체크칸의 ✓ 가 **아래로 밀려 칸을 벗어난** 것을 고쳤는데(`lineHeight`),
// 그때 고친 것은 밀림이고 **넘침은 남아 있었다** — 16px 네모에 11px ✓ 는 200% 면
// 22px 다. 11/27 에 전수로 재니 같은 꼴이 다섯이었다.
//
// ── 어떻게 고치나 ──
//
//     width: 'max(16px, 1.45em)'
//
// 작은 글자에서는 **px 가 이겨** 꼴과 닿는 자리를 지키고, 글자를 키우면 **em 이 이겨**
// 그릇이 같이 자란다. `em` 은 그 칸의 글자 크기를 따르므로 `textZoom` 에 같이 밀린다.
//
// ── 무엇을 보는가 ──
//
// `style={{ … fontSize: N … }}` 에 **px 로 박힌 `height`** 가 있고, 글자가 200% 로
// 자랄 때(줄상자 1.2 로 봐서) 그 높이를 넘으면 울린다. **폭**은 안 본다 — 글자는
// 가로로는 접히므로(`nowrap` 이 아니면) 넘치지 않고, `nowrap` + 박힌 폭은 11/27 에
// 세어 보니 **0곳**이었다.
//
// ── 비키는 자리 ──
//
// **닿는 자리(터치 과녁)는 px 가 맞다.** 44 를 지키려고 깔아둔 칸을 `em` 으로 바꾸면
// 작은 글자에서 과녁이 줄어든다. 그 칸은 `tap-box` · `tap-round` 로 적혀 있고,
// 조용히 빼지 않고 **세어서 적는다** — 그래야 다음 사람이 「왜 이건 안 걸리나」를 안 묻는다.
//
// ★ **다른 자가 그 수를 읽고 있으면 px 로 둔다** (11/27 에 밟았다)
//
// 「맨 위로」 단추(`Layout.jsx`)를 `max(40px, 2.2em)` 으로 바꿨더니 `check-layer` 의
// 「본문이 떠 있는 것만큼 비키는가」가 **단추 키를 못 찾겠다**고 울었다. 그 자가 옳았다 —
// 본문 아래 여백은 **그 키를 읽어** 깔린다. 단추가 글자를 따라 88 까지 자라면 여백은
// 그대로여서 **맨 아래 글이 단추에 깔린다.** 그릇을 자라게 하는 것이 늘 맞는 게 아니다:
// **그 수를 베껴 쓰는 자리가 있으면** 키는 px 로 두고, 넘침은 다른 길로 막는다
// (거기서는 ↑ 한 글자라 flex 가 가운데 앉혀 잘리지 않는다). 자 둘이 서로를 잡아줬다.

const fs = require('fs');
const path = require('path');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

/** 그 자리를 감싼 가장 안쪽 중괄호 덩이 */
const 덩이 = (글, at) => {
  let 깊이 = 0;
  let 시작 = -1;
  for (let i = at; i >= 0; i--) {
    const c = 글[i];
    if (c === '}') 깊이 += 1;
    else if (c === '{') { if (깊이 === 0) { 시작 = i; break; } 깊이 -= 1; }
  }
  if (시작 < 0) return null;
  깊이 = 0;
  for (let i = 시작; i < 글.length; i++) {
    const c = 글[i];
    if (c === '{') 깊이 += 1;
    else if (c === '}') { 깊이 -= 1; if (깊이 === 0) return 글.slice(시작, i + 1); }
  }
  return null;
};

/** `이름: 숫자` 를 읽는다. `max(16px, 1.45em)` 처럼 **식으로 적힌 것은 안 읽는다** */
const 박힌수 = (덩, 이름) => {
  const m = new RegExp('(?<![a-zA-Z-])' + 이름 + "\\s*:\\s*(\\d+(?:\\.\\d+)?)\\s*[,}]").exec(덩);
  return m ? Number(m[1]) : null;
};

const 난것 = [];
const 비킨것 = [];

const 훑기 = (dir) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) { 훑기(full); continue; }
    if (!/[.]jsx$/.test(f.name)) continue;
    const 글 = fs.readFileSync(full, 'utf8');
    const 이름 = path.relative(ROOT, full).split(path.sep).join('/');
    for (const m of 글.matchAll(/style=\{\{/g)) {
      const 덩 = 덩이(글, m.index + 7);
      if (!덩) continue;
      const 글자 = 박힌수(덩, 'fontSize');
      if (!글자) continue;                 // 글자가 없는 칸은 넘칠 글자도 없다
      const 높이 = 박힌수(덩, 'height');
      if (높이 === null) continue;         // 안 박았으면 내용만큼 자란다 — 옳은 꼴이다
      // 200% 로 자란 글자가 줄상자(1.2)까지 쳐서 그릇을 넘는가
      const 자란것 = 글자 * 2 * 1.2;
      if (자란것 <= 높이) continue;
      const 줄 = 글.slice(0, m.index).split('\n').length;
      const 말 = 이름 + ':' + 줄 + ` (height ${높이} · fontSize ${글자} → 200% 면 ${Math.round(자란것)}px)`;
      // 그 수를 **다른 자가 읽고 있는** 칸 (위 머리글의 ★). 이 갈래를 **먼저** 본다 —
      // 뒤에 두면 둘레에 다른 `tap-box` 단추가 있을 때 까닭이 「닿는 자리」로 잘못 붙는다.
      // 범위를 넉넉히 본다 — 그 자리에 **까닭을 적은 주석**이 들어가면 그만큼 밀린다
      if (/aria-label="맨 위로"/.test(글.slice(m.index, m.index + 2000))) {
        비킨것.push(말 + ' ← 본문 여백이 이 키를 읽는다 (`check-layer`)');
        continue;
      }
      // **닿는 자리는 px 가 맞다** — 그 태그에 `tap-box` · `tap-round` 로 적혀 있다
      const 둘레 = 글.slice(Math.max(0, m.index - 500), m.index);
      if (/tap-box|tap-round/.test(둘레)) { 비킨것.push(말 + ' ← 닿는 자리'); continue; }
      난것.push(말);
    }
  }
};

console.log('── 글자를 200% 로 키우면 그릇을 넘는 칸 ──');
훑기(SRC);
ok('px 로 박힌 그릇 안에서 글자가 넘치는 자리', 난것, []);
console.log('     ↑ 걸리면 `width: 16` 을 **`max(16px, 1.45em)`** 꼴로 바꾼다 —');
console.log('       작은 글자에서는 px 가 이기고(꼴·닿는 자리), 키우면 em 이 이겨 같이 자란다');
if (비킨것.length) {
  console.log('     까닭을 적어 비킨 칸 ' + 비킨것.length + '곳 (까닭은 줄 끝에 적었다):');
  for (const x of 비킨것) console.log('       · ' + x);
}

// ── 고친 자리가 **식으로 적혀 있는가** ──
// 위 검사는 「px 가 박혀 있다」만 본다. 그래서 `max()` 를 그냥 지워도 **px 가 아니라
// 사라진 꼴**(`width` 없음)이면 안 울린다 — 그 되돌림까지 잡으려면 자리를 못 박아야 한다.
console.log('');
console.log('── 11/27 에 그릇을 식으로 바꾼 자리 셋이 그대로인가 ──');
const 식자리 = [
  ['src/pages/support/ReportBox.jsx', '제보함 체크칸 ✓'],
  ['src/pages/LoginPage.jsx', '돌아온 사람 머리글자 동그라미'],
  ['src/pages/OauthEmailPage.jsx', '소셜 제공자 마크'],
  // 「맨 위로」는 **일부러 px 다** (머리글의 ★) — 여기 적으면 그 판단과 반대로 운다
];
const 식없는것 = [];
for (const [파일, 무엇] of 식자리) {
  const 글 = fs.readFileSync(path.join(ROOT, 파일), 'utf8');
  if (!/width:\s*'max\(\d+px,\s*[\d.]+em\)'/.test(글)) 식없는것.push(파일 + ' — ' + 무엇);
}
ok('세 자리가 `max(px, em)` 으로 적혀 있다', 식없는것, []);

console.log('');
if (bad === 0) console.log('글자를 키워도 그릇이 따라옵니다');
else console.log(bad + '건 FAIL');
process.exit(bad === 0 ? 0 : 1);
