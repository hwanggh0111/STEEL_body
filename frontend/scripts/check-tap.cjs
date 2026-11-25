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

/**
 * ── **폭을 메우는 것은 `::after` 한 줄뿐이다** ── (2026-11-19 · 맵시)
 *
 * 위 전역 규칙은 **높이만** 44 로 키운다. 크기를 박은 단추(동그라미 34·36·40 ·
 * 네모 30·32·42)는 폭이 그대로라 폰에서 꼴이 찌그러지고 **과녁이 좁아 옆 단추가
 * 눌린다** (11/18 에 동그라미, 11/19 에 네모를 닫았다 — 운동 기록 줄에서 지우려다
 * 고치기가 났다). 그것을 메우는 것은 음수 `inset` 한 줄이고 **지우면 조용히
 * 좁아진다** — 화면은 멀쩡해 보이고 폰으로 눌러봐야 안다. 그래서 값으로 지킨다.
 * `min(0px, …)` 이라야 음수가 되고, 음수라야 칸 **밖으로** 뻗는다.
 *
 * ★ **식을 이 한 자리에 둔다** — 본 검사와 되돌려-FAIL 이 **같은 손**을 부른다.
 * 되돌려가 제 안에 정규식을 또 적으면 식을 넓히는 날 되돌려만 옛 식을 본다
 * (`check-shrink` 의 `cssMoJib` 와 같은 까닭 · 11/17 에 실제로 밟았다).
 */
function 폭메움(block, bare) {
  const 밖 = bare.replace(block, '');
  return {
    테두리: [/\.tap-round::after/.test(block), /\.tap-box::after/.test(block)],
    뻗음: /inset: *min\( *0px, *calc\(\(100% *- *44px\) *\/ *2\)\)/.test(block),
    높이되돌림: [/button\.tap-round/.test(block), /button\.tap-box/.test(block)],
    // `position: relative` 는 **묶음 밖**에 있다 — `::after` 의 기준이라 폰·PC 둘 다 쓴다
    기준: [/\.tap-round[\s,]/.test(밖), /\.tap-box[\s,]/.test(밖)],
  };
}

const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles', 'globals.css'), 'utf8');

// 주석을 걷어낸 알맹이와 `pointer: coarse` 묶음을 뽑는 손 — 본 검사와 되돌려가 같이 쓴다
const 알맹이 = (raw) => raw.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, '$1');
const 묶음 = (bare) => {
  const at = bare.indexOf('@media (pointer: coarse)');
  if (at < 0) return '';
  let depth = 0;
  for (let i = at; i < bare.length; i += 1) {
    if (bare[i] === '{') depth += 1;
    else if (bare[i] === '}') { depth -= 1; if (depth === 0) return bare.slice(at, i + 1); }
  }
  return '';
};

// ─────────────────────────────────────────────────────────────
// 되돌려-FAIL — 일부러 어긋낸 CSS 를 먹여 **빨개지는지** 본다
//
//   node scripts/check-tap.cjs --되돌려
// ─────────────────────────────────────────────────────────────
if (process.argv.includes('--되돌려')) {
  console.log('── 되돌려-FAIL: 일부러 어긋낸 꼴을 먹인다 ──');
  const 재기 = (raw) => { const b = 알맹이(raw); return 폭메움(묶음(b), b); };
  const 바름 = `.tap-round,
.tap-box { position: relative; }
@media (pointer: coarse) {
  button:not(.tap-tight) { min-height: 44px !important; }
  button.tap-round,
  button.tap-box { min-height: 0 !important; }
  .tap-round::after,
  .tap-box::after { content: ''; position: absolute; inset: min(0px, calc((100% - 44px) / 2)); }
}`;
  ok('바른 꼴은 울지 않는다 (거짓 FAIL 막이)', 재기(바름),
    { 테두리: [true, true], 뻗음: true, 높이되돌림: [true, true], 기준: [true, true] });
  ok('  네모 쪽 `::after` 를 지우면 걸린다 (네모만 조용히 좁아진다)',
    재기(바름.replace('  .tap-round::after,\n', '  ')).테두리, [false, true]);
  ok('  `inset` 을 0 으로 바꾸면 걸린다 (칸 밖으로 안 뻗는다)',
    재기(바름.replace(/inset: min\(0px, calc\(\(100% - 44px\) \/ 2\)\)/, 'inset: 0')).뻗음, false);
  ok('  높이 되돌림을 지우면 걸린다 (30×44 홀쭉이로 돌아간다)',
    재기(바름.replace('  button.tap-box { min-height: 0 !important; }', '')).높이되돌림, [true, false]);
  ok('  `position: relative` 를 지우면 걸린다 (`::after` 가 엉뚱한 칸을 기준 삼는다)',
    재기(바름.replace('.tap-round,\n.tap-box { position: relative; }', '')).기준, [false, false]);
  // **주석에 적힌 글자에 속지 않는다** — 11/16 의 「자가 「지금」을 베끼면 거짓이 된다」 류
  ok('  주석에만 적혀 있으면 안 센다 (거짓 PASS 막이)',
    재기('/* .tap-box::after { inset: min(0px, calc((100% - 44px) / 2)); } */').테두리, [false, false]);
  console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
  process.exit(bad ? 1 : 0);
}

console.log('── 전역 규칙이 살아 있는가 ──');

// 주석을 걷어낸 알맹이만 본다 — 주석에 적힌 글자에 속으면 안 된다.
// 뽑는 손은 위에 한 자리로 두었다 (되돌려도 같은 손을 쓴다)
const bare = 알맹이(css);
const block = 묶음(bare);

ok('`@media (pointer: coarse)` 묶음이 있다', block.length > 0, true);
ok('단추를 겨냥한다', /\bbutton\b/.test(block), true);
ok('닿는 높이를 44px 로 둔다', /min-height: *44px/.test(block), true);
// 인라인 스타일(열여섯 자리가 44 아래를 직접 적어뒀다)을 이겨야 실제로 적용된다
ok('인라인 스타일을 이긴다 (!important)', /min-height: *44px *!important/.test(block), true);
ok('PC 는 안 건드린다 (묶음 밖에 44px 를 안 건다)',
  /min-height: *44px/.test(bare.replace(block, '')), false);

const 폭 = 폭메움(block, bare);
ok('`tap-round`·`tap-box` 둘 다 닿는 자리를 넓힌다', 폭.테두리, [true, true]);
ok('  사방으로 뻗어 44 를 채운다 (음수 `inset`)', 폭.뻗음, true);
ok('  그 둘은 높이를 다시 꼴 크기로 되돌린다 (안 그러면 세로로 늘어난다)', 폭.높이되돌림, [true, true]);
ok('  `::after` 의 기준이 묶음 밖에 서 있다', 폭.기준, [true, true]);

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

// ── **높이는 44 인데 폭이 좁던 자리** ── (2026-11-25 · 맵시)
//
// 헤드리스 Chrome 에 터치를 켜고 열여섯 화면을 280 · 360 에서 재 보니, 전역 규칙 덕에
// 높이는 다 44 였지만 **폭이 20~37px** 인 단추가 남아 있었다. 글자만 있는 단추는
// 글자 폭이 곧 과녁이다. 고친 자리마다 그 한 줄을 값으로 본다 — 지우면 조용히 좁아진다
console.log('\n── 폭이 좁던 자리 (11/25) ──');
const SRC = path.join(__dirname, '..', 'src');
const src = (...p) => fs.readFileSync(path.join(SRC, ...p), 'utf8');
// ✕ 는 **제 폭**을 44 로 키운다. 처음엔 `::after` 로 사방 12 를 뻗게 했는데 운동 ·
// 인바디 카드의 ✎ 이 4px 옆이라 **✎ 오른쪽 8px 을 덮었다**(근호 판정) — 안 보이는
// 과녁은 이웃을 모른다. 그래서 `::after` 가 되살아나면 FAIL 이다
ok('기록 줄 ✕(`.delete-btn`)는 제 폭을 44 로 (폰에서만)',
  /\.delete-btn:not\(\.tap-tight\)\s*\{\s*min-width:\s*44px/.test(block), true);
ok('  ✕ 는 안 보이게 뻗지 않는다 — 옆 ✎ 을 덮는다',
  [/\.delete-btn::after/.test(bare), /\.delete-btn\s*\{\s*position:\s*relative/.test(bare)], [false, false]);
// 이웃을 값으로 센다 — ✎ 과 ✕ 가 한 줄에 선 카드는 둘 사이를 4px 밖에 안 둔다.
// 그 자리에서 ✕ 를 안 보이게 넓히는 손(`tap-box` · `tap-round`)이 붙으면 같은 겹침이다
// 사진 위에 **떠 있는** ✕(비교 화면)는 이웃이 없다 — 거기만 꼴을 작게 두고 `tap-box` 로
// 닿는 자리를 넓힌다. 제 폭 44 면 사진 모서리를 가린다 (근호 잔말 · 11/25)
ok('  사진 위 ✕ 는 꼴 작게 · 닿는 자리만 넓게 (`delete-btn tap-box` · 폭 0 되돌림)',
  [/className="delete-btn tap-box"/.test(src('pages', 'ComparePage.jsx')),
    /\.delete-btn\.tap-box\s*\{\s*min-width:\s*0/.test(block)], [true, true]);
// ✕ 가 44 가 되면서 1RM 줄이 320 에서 빠듯해졌다(약 282 / 256) — 「100kg × 10회」가
// 반으로 꺾여 떨어졌다. 처음부터 둘째 줄에 두고 그 토막은 안 꺾는다 (근호 잔말)
ok('  1RM 줄: 무게 × 횟수는 둘째 줄 · 안 꺾는다',
  /<div style=\{\{ minWidth: 0 \}\}>\s*<div[^>]*>\{r\.data\?\.exercise\}<\/div>\s*<div[^>]*whiteSpace: 'nowrap'[^>]*>\{r\.data\?\.weight\}kg/
    .test(src('components', 'measure', 'OneRMSection.jsx')), true);
for (const f of ['WorkoutCard.jsx', 'InbodyCard.jsx']) {
  const c = src('components', f);
  const del = (c.match(/<button[^>]*className="([^"]*delete-btn[^"]*)"/) || [])[1] || '';
  ok(`  ${f}: ✎ 옆 ✕ 에 안 보이게 넓히는 손이 없다`, /tap-(box|round)/.test(del), false);
}
const routine = src('pages', 'RoutinePage.jsx');
ok('루틴 「수정」 「삭제」 둘 다 여백으로 44 폭',
  [/padding: '0 11px' \}\}\s*>수정<\/button>/.test(routine), /padding: '0 11px' \}\}\s*>삭제<\/button>/.test(routine)], [true, true]);
ok('  그 둘 사이를 벌리지 않는다(넓힌 과녁이 겹치지 않게 gap 0)',
  /display: 'flex', gap: 0, alignItems: 'center', marginRight: -11/.test(routine), true);
const settings = src('pages', 'SettingsPage.jsx');
ok('설정 건너뛰는 칩 · 고르기 칩이 44 폭 아래로 안 줄어든다',
  (settings.match(/minWidth: 44/g) || []).length >= 2, true);
ok('목표 「다시」가 여백으로 44 폭', /padding: '0 11px', margin: '0 -11px'[^>]*>다시</.test(src('pages', 'GoalPage.jsx')), true);
ok('인바디 「접기」가 여백으로 44 폭', /padding: '0 11px', marginRight: -11,[\s\S]{0,120}>접기</.test(src('pages', 'InbodyPage.jsx')), true);
const layout = src('components', 'Layout.jsx');
ok('머리 로고(마크만 남은 280)가 44 폭 · 칸 바닥 32',
  [/aria-label="홈으로"[\s\S]{0,300}padding: '0 12px', marginLeft: -12/.test(layout), /head-logo-slot[^\n]*minWidth: 32/.test(layout)], [true, true]);
ok('  글자를 걷는 선도 그 12 만큼 올렸다 (128)', /@container \(max-width: 128px\)/.test(css), true);

console.log('');
if (bad) {
  console.log(bad + '건 실패 — 폰에서 작은 단추가 안 눌릴 수 있습니다.');
  process.exit(1);
}
console.log('폰에서는 작은 단추도 44px 로 닿습니다 (PC 는 그대로)');
