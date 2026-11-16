// 폰에서만 드러나는 자리 (2026-11-16 · 정석)
//
//   npm run onphone      (npm run check 에도 들어 있다)
//
// 입구 이름이 `phone` 이 아닌 까닭 — `npm run phone` 은 이미 **개발 화면을 폰 틀로
// 띄우는 손**(`scripts/phone-dev.mjs`)이 쓰고 있다. 자가 그 이름을 가져가면 그쪽이
// 조용히 안 돌게 된다.
//
// PC 에서 열면 셋 다 **멀쩡해 보인다.** 그래서 눈으로는 영영 안 걸린다.
//
// ── ① 숫자 칸에 자판을 지정했나 ──
//
// `type="number"` 만 적어두면 **안드로이드 자판이 소수점을 안 내주는 일이 있다**
// (자판 앱과 locale 에 따라 갈린다). 집 안의 다른 칸들은 이미 `inputMode` 를 함께
// 적고 있었다 — `InbodyPage` 의 다섯 칸이 그 꼴이다. 11/16 에 전수로 세니
// **측정 화면 여덟 자리와 관리자 화면 한 자리**만 빠져 있었다.
//
// ── ② 소수를 적는 칸에 `step` 이 있나 ──
//
// ★ 이것이 자판보다 무겁다. `step` 을 **안 적으면 1** 이라, 소수를 적으려는 칸이
// **그 값을 거부하는 칸**이 된다. `OneRMSection` 의 무게 칸이 그 꼴이었다 —
// **82.5kg 을 적을 수 없는 1RM 계산기**였고, 같은 집의 `InbodyPage` 무게 칸은
// 이미 `step="0.1"` 로 서 있었다. **있는 손을 한 자리만 안 쓰고 있었다.**
//
// 그래서 **`inputMode="decimal"` 과 `step` 은 짝으로 본다** — 소수 자판을 내밀면서
// 소수를 거부하면 사람이 친 것이 사라진다.
//
// ── ③ 높이를 `100vh` 로 적었나 ──
//
// 폰에서 `100vh` 는 **주소창이 펼쳐진 높이**다 — 접히면 화면보다 길어져 아래가
// 잘린다. `globals.css` 가 2026-10-05 에 그 까닭과 **두 줄 되돌림**(`100vh` →
// `100dvh`)을 적어두고 `.page-wrapper` · `.full-height` 로 내놨다.
//
// **인라인 꼴에는 두 줄을 적을 수 없다** — 한 칸에 한 값이다. 그러니 코드에서
// `100vh` 를 보면 그것은 「폰에서 잘리는 쪽을 골랐다」는 뜻이고, 있는 class 를
// 쓰는 쪽이 맞다. CSS 에서는 **바로 뒤에 `100dvh` 가 따라오면** 통과다.
//
// 자가 거짓을 안 내게 둔 것 — 속성은 여러 줄에 걸쳐 적히므로 `<tag …>` 를 통째로
// 끊어 읽고, 주석은 **줄 단위로** 걷는다(`accept="image/*"` 의 `/*` 에 속지 않게).
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

const walk = (d, o = [], ext = /\.(jsx|js)$/) => {
  for (const n of fs.readdirSync(d)) {
    const f = path.join(d, n);
    if (fs.statSync(f).isDirectory()) { if (n !== 'dev') walk(f, o, ext); }
    else if (ext.test(n)) o.push(f);
  }
  return o;
};

function 주석걷기(raw) {
  let 안 = false;
  return raw.split('\n').map((l) => {
    if (안) { if (/\*\//.test(l)) 안 = false; return ''; }
    if (/^\s*\{?\/\*/.test(l)) { 안 = !/\*\//.test(l); return ''; }
    if (/^\s*\/\//.test(l)) return '';
    return l;
  }).join('\n');
}

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

const 자판없음 = [];
const 소수거부 = [];
const 높이 = [];

for (const f of walk(SRC)) {
  const rel = path.relative(SRC, f).replace(/\\/g, '/');
  const src = 주석걷기(fs.readFileSync(f, 'utf8'));

  for (const e of 요소들(src)) {
    if (e.닫음 || e.tag !== 'input') continue;
    if (!/type="number"/.test(e.글)) continue;
    const 자리 = `${rel}:${줄(src, e.at)}`;
    const im = /inputMode="([a-z]+)"/.exec(e.글);
    const 소수step = /step="0?\.\d/.test(e.글);
    const step있다 = /\sstep=/.test(e.글);
    if (!im) {
      자판없음.push(`${자리}${소수step ? ' (소수 칸 — decimal)' : ' (정수 칸 — numeric)'}`);
    } else if (im[1] === 'decimal' && !step있다) {
      // 소수 자판을 내밀면서 `step` 이 없으면 **그 소수를 칸이 거부한다**
      소수거부.push(`${자리} (inputMode=decimal 인데 step 이 없다 — 1 단위만 받는다)`);
    } else if (소수step && im[1] !== 'decimal') {
      소수거부.push(`${자리} (step 이 소수인데 inputMode=${im[1]} 다)`);
    }
  }

  // 인라인 높이에 `100vh` — 두 줄 되돌림을 적을 수 없는 자리다
  src.split('\n').forEach((l, i) => {
    if (/100vh/.test(l) && !/translateY|translate3d|100dvh/.test(l)) {
      높이.push(`${rel}:${i + 1}  ${l.trim().slice(0, 70)}`);
    }
  });
}

// CSS 는 **두 줄로 적을 수 있다** — 바로 뒤에 `100dvh` 가 따라오면 통과
for (const f of walk(path.join(SRC, 'styles'), [], /\.css$/)) {
  const rel = path.relative(SRC, f).replace(/\\/g, '/');
  const 줄들 = fs.readFileSync(f, 'utf8').split('\n');
  줄들.forEach((l, i) => {
    if (!/100vh/.test(l)) return;
    if (/^\s*(\*|\/\*|\/\/)/.test(l)) return;              // 주석에 적어둔 설명
    // 같은 줄이나 바로 다음 줄에 `100dvh` 가 있으면 되돌림이 선 것이다
    if (/100dvh/.test(l) || /100dvh/.test(줄들[i + 1] || '')) return;
    높이.push(`${rel}:${i + 1}  ${l.trim().slice(0, 70)}`);
  });
}

console.log('── 숫자 칸이 폰 자판을 지정했나 ──');
ok('`type="number"` 에 `inputMode` 가 있다', 자판없음, []);
if (자판없음.length) {
  자판없음.forEach((x) => console.log('       ' + x));
  console.log('       → 소수를 적는 칸은 `inputMode="decimal"`, 정수 칸은 `"numeric"` 입니다.');
}

console.log('');
console.log('── 소수를 적는 칸이 소수를 받나 ──');
ok('`decimal` 과 `step` 이 짝이다', 소수거부, []);
if (소수거부.length) {
  소수거부.forEach((x) => console.log('       ' + x));
  console.log('       → `step` 을 안 적으면 1 입니다 — 82.5 를 적을 수 없는 칸이 됩니다.');
}

console.log('');
console.log('── 높이를 `100vh` 로 적은 자리 ──');
ok('코드에 짝 없는 `100vh` 가 없다', 높이, []);
if (높이.length) {
  높이.forEach((x) => console.log('       ' + x));
  console.log('       → 인라인이면 `globals.css` 의 `.page-wrapper` · `.full-height` 를 쓰세요.');
  console.log('         CSS 면 `100vh` 다음 줄에 `100dvh` 를 적으면 옛 브라우저까지 섭니다.');
}

console.log(bad === 0 ? '\n모두 통과' : `\n${bad}건 FAIL`);
process.exit(bad === 0 ? 0 : 1);
