// 손가락으로 **닿는가** (2026-10-15)
//
//   npm run tap     (npm run check 에도 들어 있다)
//
// ── 왜 이 검사가 있나 ──
//
// 마우스로는 16px 짜리 ✕ 도 눌린다. **손가락은 아니다.** 이 앱은 폰에서 쓰는 앱이고,
// 안드로이드·iOS 둘 다 **누르는 것은 최소 44px** 를 권한다.
//
// 처음에는 작은 단추마다 표를 붙이게 하려고 했다. 세어보니 **151 자리**였다 — 손으로
// 붙일 수에 없고, 붙이는 것을 잊는 일이 반드시 생긴다. 그래서 `styles/globals.css` 에
// **전역 한 줄**로 두었다: `@media (pointer: coarse)` 안에서 단추의 닿는 높이를 44px 로.
// 폰·태블릿만 걸리고 PC 는 그대로다.
//
// 그러면 이 검사가 볼 것은 **그 한 줄이 살아 있는가**다. 지우거나 조건을 바꾸면
// 151 자리가 조용히 다시 작아진다 — 화면은 멀쩡해 보이고, **폰으로 눌러보지 않으면
// 모른다.** 그래서 값으로 본다.
//
// 같이 보는 것 둘 —
//   · 격자 칸(기록의 벽 등)이 단추로 바뀌지 않았는가. 바뀌면 칸마다 44px 가 되어
//     서로 겹치고 **옆 날짜가 눌린다**
//   · `.tap-tight`(일부러 작게 두는 표)가 늘어나지 않았는가

const fs = require('fs');
const path = require('path');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles', 'globals.css'), 'utf8');

console.log('── 전역 규칙이 살아 있는가 ──');

// 주석을 걷어낸 알맹이만 본다 — 주석에 적힌 글자에 속으면 안 된다
const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
const block = (() => {
  const at = bare.indexOf('@media (pointer: coarse)');
  if (at < 0) return '';
  let depth = 0;
  for (let i = at; i < bare.length; i += 1) {
    if (bare[i] === '{') depth += 1;
    else if (bare[i] === '}') { depth -= 1; if (depth === 0) return bare.slice(at, i + 1); }
  }
  return '';
})();

ok('`@media (pointer: coarse)` 묶음이 있다', block.length > 0, true);
ok('단추를 겨냥한다', /\bbutton\b/.test(block), true);
ok('닿는 높이를 44px 로 둔다', /min-height: *44px/.test(block), true);
// 인라인 스타일(열여섯 자리가 44 아래를 직접 적어뒀다)을 이겨야 실제로 적용된다
ok('인라인 스타일을 이긴다 (!important)', /min-height: *44px *!important/.test(block), true);
ok('PC 는 안 건드린다 (묶음 밖에 44px 를 안 건다)',
  /min-height: *44px/.test(bare.replace(block, '')), false);

console.log('\n── 격자 칸이 단추로 바뀌지 않았는가 ──');
//
// 기록의 벽은 한 해를 365칸으로 깔아놓는다. 칸이 `<button>` 이 되면 위의 전역 규칙이
// **칸마다 44px** 를 주고, 3px 간격으로 놓인 칸들이 서로 겹쳐 **옆 날짜가 눌린다.**
const wall = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'YearWall.jsx'), 'utf8');
const gridAt = wall.indexOf('repeat(7');
const gridChunk = gridAt < 0 ? '' : wall.slice(gridAt, gridAt + 700);
ok('기록의 벽 칸을 찾았다', gridAt > 0, true);
ok('칸은 단추가 아니다', /<button/.test(gridChunk), false);

console.log('\n── 일부러 작게 둔 자리 (`.tap-tight`) ──');
const ROOTS = ['src/pages', 'src/components'];
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith('.jsx')) out.push(full);
  }
  return out;
};
const tight = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const src = fs.readFileSync(file, 'utf8');
    src.split('\n').forEach((line, i) => {
      if (line.includes('tap-tight')) tight.push(file.replace(/\\/g, '/') + ':' + (i + 1));
    });
  }
}
// 늘어나기 시작하면 「전역 규칙이 불편하다」는 뜻이고, 그때는 규칙을 다시 봐야 한다.
// 지금은 한 자리도 없다 — 없는 것이 맞는 상태다
ok('열 자리 아래다', tight.length <= 10, true);
if (tight.length) console.log('     ' + tight.join('\n     '));

console.log('');
if (bad) {
  console.log(bad + '건 실패 — 폰에서 작은 단추가 안 눌릴 수 있습니다.');
  process.exit(1);
}
console.log('폰에서는 작은 단추도 44px 로 닿습니다 (PC 는 그대로)');
