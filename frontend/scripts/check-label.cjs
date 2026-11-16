// 이름표가 **칸과 묶였는가** (2026-11-16 · 정석)
//
//   npm run label      (npm run check 에도 들어 있다)
//
// `<label className="label">날짜</label>` 를 칸 **옆에** 적어두면 눈에는 이름표로
// 보이지만 **묶인 것이 아니다.** 낭독기는 그 칸을 「편집 칸」이라고만 읽고, 이름표를
// 눌러도 칸으로 들어가지 않는다. 묶는 길은 둘뿐이다 —
//
//   ⑴ `<label htmlFor="x">` + `<input id="x">`
//   ⑵ `<label>` 이 칸을 **품는다** (`<label><input …/>이름</label>`)
//
// **`placeholder` 는 이름이 아니다** — 글자를 치면 사라진다. 치는 동안 이름이 없어지는
// 칸이고, 다 치고 나면 그 칸이 무엇이었는지 낭독기로는 알 길이 없다.
//
// 11/16 에 전수로 세니 **보이는 칸 105개 중 33개(31%)** 가 묶이지 않았고, 이름표
// 58개 중 **9개는 가리키는 칸이 없는 장식**이었다. 하나하나는 작지만 낭독기를 쓰는
// 사람에게는 **그 화면이 못 쓰는 화면**이다.
//
// ── 이 자가 **안 보는 것** ──
//
// 안 보이는 칸(`display: none` · `aria-hidden` · `type="hidden"`)은 뺀다 — 파일을
// 고르는 숨은 칸이 그렇고, 낭독기도 그것을 안 본다.
//
// ── 거짓을 안 내게 둔 것 둘 ──
//
// · 속성은 **여러 줄에 걸쳐** 적힌다. 한 줄씩 보면 윗줄의 `aria-label` 을 놓쳐
//   거짓 FAIL 이 난다(첫 판에서 여섯 건이 그랬다). 그래서 `<tag …>` 를 통째로 끊는다
// · `htmlFor` 와 `id` 는 **변수로도 온다**(`htmlFor={id}`). 글자 꼴만 보면 묶여 있는
//   칸을 안 묶였다고 센다(`NumberStep.jsx` 가 그 꼴이었다)
// · 주석을 걷는 손은 **줄 단위**다. `/\*[\s\S]*?\*\//` 로 걷으면 `accept="image/*"`
//   같은 자리에서 주석이 시작된 것으로 읽혀 **코드를 먹는다**(소스에서 241줄이다).
//   먹힌 자리는 자가 못 보니 **조용한 거짓 PASS** 가 된다
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const walk = (d, o = []) => {
  for (const n of fs.readdirSync(d)) {
    const f = path.join(d, n);
    if (fs.statSync(f).isDirectory()) { if (n !== 'dev') walk(f, o); }
    else if (/\.jsx$/.test(n)) o.push(f);
  }
  return o;
};

// 주석을 **줄 단위로** 걷는다 (위 머리글의 까닭). 줄 수는 지킨다 — 지우면 `파일:줄` 이 밀린다
function 주석걷기(raw) {
  let 안 = false;
  return raw.split('\n').map((l) => {
    if (안) { if (/\*\//.test(l)) 안 = false; return ''; }
    if (/^\s*\{?\/\*/.test(l)) { 안 = !/\*\//.test(l); return ''; }
    if (/^\s*\/\//.test(l)) return '';
    return l;
  }).join('\n');
}

// 여는 꺾쇠 하나를 통째로 끊는다 — 따옴표와 중괄호 깊이를 센다
function 요소들(src) {
  const out = [];
  for (let i = 0; i < src.length; i += 1) {
    if (src[i] !== '<') continue;
    const m = /^<(\/?)([A-Za-z][A-Za-z0-9.]*)/.exec(src.slice(i, i + 40));
    if (!m) continue;
    let j = i + 1; let brace = 0; let q = null;
    while (j < src.length) {
      const c = src[j];
      if (q) { if (c === q && src[j - 1] !== '\\') q = null; }
      else if (c === '"' || c === "'" || c === '`') q = c;
      else if (c === '{') brace += 1;
      else if (c === '}') brace -= 1;
      else if (c === '>' && brace === 0) break;
      j += 1;
    }
    out.push({ 닫음: !!m[1], tag: m[2], 글: src.slice(i, j + 1), at: i });
    i = j;
  }
  return out;
}
const 줄 = (src, at) => src.slice(0, at).split('\n').length;
const 열쇠글 = (m) => (m[1] || m[2] || m[3] || '').trim().replace(/\$\{[^}]*\}/g, '*');

const 묶이지않은칸 = [];
const 장식이름표 = [];
let 칸수 = 0;
let 이름표수 = 0;

for (const f of walk(SRC)) {
  const rel = path.relative(SRC, f).replace(/\\/g, '/');
  const src = 주석걷기(fs.readFileSync(f, 'utf8'));
  const els = 요소들(src);

  // `<label>` 이 품는 범위 — 그 안의 칸은 묶인 것이다
  const 품는범위 = [];
  for (let k = 0; k < els.length; k += 1) {
    const e = els[k];
    if (e.닫음 || e.tag !== 'label') continue;
    이름표수 += 1;
    if (/\/>\s*$/.test(e.글)) continue;
    let 깊이 = 1;
    for (let p = k + 1; p < els.length; p += 1) {
      if (els[p].tag !== 'label') continue;
      깊이 += els[p].닫음 ? -1 : 1;
      if (깊이 === 0) { 품는범위.push([e.at, els[p].at]); break; }
    }
  }
  const 품었나 = (at) => 품는범위.some(([a, b]) => at > a && at < b);

  const 가리킨id = new Set();
  els.forEach((e) => {
    const m = /htmlFor=(?:"([^"]+)"|\{`([^`]+)`\}|\{([^}]+)\})/.exec(e.글);
    if (m) 가리킨id.add(열쇠글(m));
  });

  for (const e of els) {
    if (e.닫음) continue;
    if (!['input', 'textarea', 'select'].includes(e.tag)) continue;
    if (/display:\s*['"]?none/.test(e.글) || /aria-hidden/.test(e.글) || /type="hidden"/.test(e.글)) continue;
    칸수 += 1;
    const 있다 = (a) => new RegExp(`(?:^|[\\s{])${a}[=\\s}]`).test(e.글);
    if (있다('aria-label') || 있다('aria-labelledby')) continue;
    if (품었나(e.at)) continue;
    const idm = /\sid=(?:"([^"]+)"|\{`([^`]+)`\}|\{([^}]+)\})/.exec(e.글);
    if (idm && 가리킨id.has(열쇠글(idm))) continue;
    묶이지않은칸.push(`${rel}:${줄(src, e.at)} <${e.tag}>`
      + (/placeholder=/.test(e.글) ? ' (placeholder 만 있다)' : '')
      + (idm ? ` (id 가 있는데 가리키는 이름표가 없다)` : ''));
  }

  // 이름표인데 가리키지도, 품지도 않는다 — **장식일 뿐이다.**
  // 묶음 제목을 `<label>` 로 적으면 낭독기가 가리킬 칸을 찾다가 못 찾는다.
  // 그런 자리는 `<div className="label">` 이 맞다
  for (const e of els) {
    if (e.닫음 || e.tag !== 'label') continue;
    if (/htmlFor=/.test(e.글)) continue;
    const 품음 = 품는범위.find(([a]) => a === e.at);
    if (!품음) { 장식이름표.push(`${rel}:${줄(src, e.at)} (짝을 못 찾았다)`); continue; }
    const 안에칸 = els.some((x) => !x.닫음 && ['input', 'textarea', 'select'].includes(x.tag)
      && x.at > 품음[0] && x.at < 품음[1]);
    if (!안에칸) 장식이름표.push(`${rel}:${줄(src, e.at)} (칸을 품지도, 가리키지도 않는다)`);
  }
}

console.log('── 이름표가 칸과 묶였는가 ──');
console.log(`       보이는 칸 ${칸수}개 · 이름표 ${이름표수}개`);
ok('이름표가 묶이지 않은 칸', 묶이지않은칸, []);
if (묶이지않은칸.length) {
  묶이지않은칸.forEach((x) => console.log('       ' + x));
  console.log('       → `aria-label` 을 주거나, `<label htmlFor>` + `id` 로 묶으세요.');
  console.log('         placeholder 는 이름이 아닙니다 — 글자를 치면 사라집니다.');
}
ok('가리키는 칸이 없는 이름표', 장식이름표, []);
if (장식이름표.length) {
  장식이름표.forEach((x) => console.log('       ' + x));
  console.log('       → 묶음 제목이면 `<div className="label">` 이 맞습니다.');
}

console.log(bad === 0 ? '\n모두 통과' : `\n${bad}건 FAIL`);
process.exit(bad === 0 ? 0 : 1);
