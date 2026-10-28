// **만들고 아무도 안 부르는 것이 없는가** (2026-10-28).
//
//   npm run dead     (npm run check 에도 들어 있다)
//
// ── 왜 ──
//
// `Layout.jsx` 끝에 `menuStyle` · `hIn` · `hOut` 셋이 남아 있었다. 계정 시트에서
// **길찾기 열한 줄을 걷어낼 때** 그것들을 쓰던 자리가 같이 사라졌는데 본체만 남은
// 것이다. `LoginPage` 의 `BACKEND_BASE` · `API_URL` 도 같았다 — 소셜 단추를
// 부품으로 뺄 때(`SocialLoginButtons`) 쓰는 쪽이 그리로 갔다.
//
// 이것이 그냥 지저분한 것으로 끝나지 않는다. 10/22 에 세운 자가 그 까닭이다 —
// **「부르는 자리가 0 이면 장식이다.」** 장식은 **읽는 사람을 속인다**: 다음에 이
// 파일을 고치는 사람은 그 함수가 쓰이는 줄 알고 맞춰 고치고, 심지어 그것을 고쳐놓고
// 화면이 안 바뀐다고 딴 데를 뒤진다. 10/24 에 **부르는 자리 0 인 함수 일곱**을
// 걷어낸 것이 그 자리였다.
//
// ── 여기가 지키는 것 ──
//
// **내보내지 않는 것만 본다.** `export` 한 것은 다른 파일이 쓸 수 있고, 그쪽은
// `npm run keys` 의 「부르는 자리가 0 인 이름」이 열쇠에 대해 같은 일을 한다.
// 파일 안에서 만들고 그 파일에서 **한 번도 안 쓰이면** FAIL 한다.
const fs = require('fs');
const path = require('path');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const SRC = path.join(__dirname, '..', 'src');
const walk = (d, out = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/[.](jsx|js)$/.test(e.name)) out.push(p);
  }
  return out;
};
// 주석이 「쓰는 자리」로 셈되면 안 된다 — 걷어낸 이름을 까닭과 함께 적어두는 일이 많다
const codeOf = (s) => s
  .replace(/(^|[\s\{])\/\*[\s\S]*?\*\//g, '$1')
  .replace(/^\s*\/\/.*$/gm, '');

const dead = [];
let seen = 0;
for (const f of walk(SRC)) {
  const src = codeOf(fs.readFileSync(f, 'utf8'));
  const rel = path.relative(SRC, f).split(path.sep).join('/');
  const names = [];
  for (const m of src.matchAll(/^(?:const|let|function) ([A-Za-z_$][\w$]*)\s*[=(]/gm)) names.push(m[1]);
  for (const name of [...new Set(names)]) {
    // 내보낸 것은 다른 파일이 쓴다
    if (new RegExp('export (const|function|let|default) ' + name + '\\b').test(src)) continue;
    if (new RegExp('export \\{[^}]*\\b' + name + '\\b').test(src)) continue;
    seen += 1;
    const uses = [...src.matchAll(new RegExp('\\b' + name + '\\b', 'g'))].length;
    if (uses <= 1) dead.push(rel + '  ' + name);
  }
}

console.log('── 만들고 아무도 안 부르는 것 ──');
console.log('     파일 안에만 두는 이름 ' + seen + '개');
ok('부르는 자리가 0 인 것', dead, []);
if (dead.length) {
  console.log('     ↑ 걷거나, 부르는 자리를 만든다. **장식은 읽는 사람을 속인다** —');
  console.log('       다음에 고치는 사람이 그것을 고쳐놓고 화면이 안 바뀐다고 딴 데를 뒤진다');
}

console.log('');
console.log(bad === 0 ? '모두 통과' : bad + '건 FAIL');
process.exit(bad === 0 ? 0 : 1);
