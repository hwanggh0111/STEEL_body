// 오류를 글로 보여주는 칸이 **낭독기에도 알리는가** (2026-11-16 · 맵시).
//
//   npm run checkalert     (npm run check 에도 들어 있다)
//
// ── 왜 생겼나 ──
//
// 저장이 실패하면 칸 아래에 빨간 한 줄이 뜬다. 그런데 **초점은 누른 단추에 그대로
// 있다** — 화면을 보지 않는 사람에게는 **아무 말도 없이 그냥 안 된 것**이다. 다시
// 누르고, 또 안 되고, 왜 안 되는지는 끝까지 모른다.
//
// `role="alert"` 한 마디면 낭독기가 그 줄을 **그 자리에서 읽는다.** 초점을 옮기지
// 않아도 되고, 사람이 하던 일을 끊지도 않는다.
//
// 11/16 에 세어 보니 **열셋 중 다섯만** 그 표를 달고 있었다(`LoginPage` ·
// `RegisterPage` · `OauthEmailPage` 등). **집안에 꼴이 이미 있는데 여덟 자리가
// 빠져 있던 것**이고, 이 앱에서 되풀이되는 그 모양이다 — 한 자리만 고쳐져 있다.
// 여덟을 닫고, 다시 벌어지지 않게 이 자를 세운다.
//
// ── 무엇을 보나 ──
//
// `{error && …}` 처럼 **오류 상태로 가르는 칸**을 찾아 그 첫 태그의 속성을 본다.
// `role="alert"` · `role="status"` · `aria-live` 중 하나가 있으면 통과다.
// **글자만 세지 않는다** — `{error && (` 와 태그 사이에 주석이 끼어도 따라간다.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');

let bad = 0;
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log(`${pass ? 'OK  ' : 'FAIL'} ${label} → ${JSON.stringify(got)}${pass ? '' : ` (기대: ${JSON.stringify(want)})`}`);
};

/** `<div` 의 `<` 자리에서 그 태그의 **속성 구간만** 돌려준다 (`{}` 중첩을 센다) */
function 속성(글, 시작) {
  let 깊이 = 0;
  let 따옴표 = null;
  for (let j = 시작; j < 글.length; j += 1) {
    const c = 글[j];
    if (따옴표) { if (c === 따옴표) 따옴표 = null; }
    else if (c === '"' || c === "'") 따옴표 = c;
    else if (c === '{') 깊이 += 1;
    else if (c === '}') 깊이 -= 1;
    else if (c === '>' && 깊이 === 0) return 글.slice(시작, j);
  }
  return '';
}

const 파일들 = [];
(function 훑기(dir) {
  for (const 이름 of fs.readdirSync(dir)) {
    const 자리 = path.join(dir, 이름);
    if (fs.statSync(자리).isDirectory()) 훑기(자리);
    else if (이름.endsWith('.jsx')) 파일들.push(자리);
  }
})(SRC);

const 안알리는것 = [];
let 알리는수 = 0;

for (const 자리 of 파일들) {
  const 글 = fs.readFileSync(자리, 'utf8');
  const 상대 = path.relative(SRC, 자리).split(path.sep).join('/');
  const re = /\{\s*(?:err|error|errMsg|errorMsg|failMsg)\s*&&/g;
  let m = re.exec(글);
  while (m) {
    // 그 뒤에서 **첫 태그**를 찾는다. 주석(`{/* … */}`)이 끼어도 지나간다
    const 뒤 = 글.slice(m.index, m.index + 600);
    const t = /<(div|span|p)[\s>]/.exec(뒤);
    if (t) {
      const a = 속성(글, m.index + t.index);
      const 줄 = 글.slice(0, m.index).split('\n').length;
      if (/role="alert"|role="status"|aria-live/.test(a)) 알리는수 += 1;
      else 안알리는것.push(`${상대}:${줄}`);
    }
    m = re.exec(글);
  }
}

console.log('── 오류 글이 낭독기에도 알리는가 ──\n');
console.log(`오류를 글로 보여주는 칸 ${알리는수 + 안알리는것.length}개 · 알리는 것 ${알리는수}`);
for (const h of 안알리는것) console.log(`FAIL ${h} — role="alert" 가 없다`);
console.log('');
ok('오류 글은 모두 낭독기에 알린다', 안알리는것.length, 0);
// **하나도 못 찾았으면 자가 거짓이다** — 찾는 꼴이 바뀌었는데 자만 통과하는 날이 온다
ok('  찾은 자리가 있다 (찾는 꼴이 안 썩었나)', 알리는수 + 안알리는것.length > 8, true);

console.log('');
if (bad) {
  console.log('오류 글이 떠도 **초점은 누른 단추에 그대로 있다** — `role="alert"` 가 없으면');
  console.log('낭독기는 **아무 말도 안 하고**, 쓰는 사람은 왜 안 되는지 끝까지 모릅니다.');
  console.log("그 칸에 `role=\"alert\"` 한 마디를 붙이세요 (`LoginPage.jsx:486` 이 그 꼴입니다).");
  process.exit(1);
}
console.log('오류는 보이는 사람에게도, 듣는 사람에게도 전해집니다');
