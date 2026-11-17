// **무엇이 무엇을 덮는가** — 층(z-index)이 복붙으로 갈리는 것을 막는다 (2026-11-17 · 맵시).
//
//   npm run layer     (npm run check 에도 들어 있다)
//
// ── 왜 이 자가 생겼나 ──
//
// 정석이 넘긴 류의 UI 몫을 훑다가 나왔다 — 「같은 생김새가 두 화면에 복붙되고
// **한쪽만 고쳐진** 자리」. 화면을 덮는 것이 열넷인데 층수를 저마다 손으로 적어
// 뒀고, **넷이 어긋나 있었다**:
//
//   ⑴ ★ **잠금이 탭바 아래였다** (`9000` < `9999`). `AppLock.jsx` 머리글은 「탭바도
//      머리도 통째로 가려야 한다」라고 적어두고 있었는데 실제로는 **탭바와 휴식
//      띠가 잠금 위에 떠 있었다** — 띠에는 지금 하는 종목 이름이 적혀 있고 탭바는
//      **눌린다.** 잠근 채로 화면을 옮길 수 있었다
//   ⑵ **비밀번호 찾기 창만 `9999`** 로 탭바와 **동점**이었다 — 설정에서 열면
//      본문이 탭바보다 DOM 앞이라 **탭바가 어두운 덮개 위로** 올라왔다
//   ⑶ **확인 창이 모달보다 아래**였다 (`99998` < `99999`)
//   ⑷ **겹쳐 찍기 · 말로 적기**(둘 다 `aria-modal`)가 `9996` 이라 **탭바·휴식 띠
//      아래**였다 — 카메라를 띄운 채로 탭이 눌렸다
//
// 숫자를 손으로 적는 동안은 이 넷이 계속 생긴다. 그래서 **차례를 뜻으로 적고
// 숫자는 `src/data/layers.js` 한 자리에서만 센다.** 이 자가 둘을 본다 —
// 표의 차례가 뜻대로 오르는가, 그리고 **표를 안 쓰고 숫자를 박은 자리가 없는가.**
//
// 표를 **베껴 적지 않는다** — `layers.js` 를 그 자리에서 읽는다(11/16 의 「자가
// 「지금」을 베끼면 거짓이 된다」 류).
//
//   node scripts/check-layer.cjs --되돌려   일부러 어긋낸 꼴 다섯을 먹여 빨개지는지 본다

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

function load(rel, tmp) {
  const file = path.join(ROOT, tmp);
  esbuild.buildSync({
    entryPoints: [path.join(ROOT, rel)], bundle: true, format: 'cjs',
    outfile: file, platform: 'node', logLevel: 'silent',
  });
  const m = require(file);
  fs.unlinkSync(file);
  return m;
}

const L = load('src/data/layers.js', '.cl-layers.cjs');

// ── 차례가 뜻대로 오르는가 ──
//
// 「서랍뒤판 → … → 점검」 차례는 `layers.js` 가 `LAYER_ORDER` 로 들고 있다.
// 그 차례대로 층수가 **오르기만** 해야 한다 (같은 값은 된다 — 휴식띠와 서랍은
// 서로 안 겹치는 자리라 일부러 같다)
console.log('── 층 차례 ──');
ok('`layers.js` 에서 표를 읽었다', Object.keys(L.LAYER || {}).length > 0, true);
ok('차례 목록이 있다', (L.LAYER_ORDER || []).length > 0, true);

{
  const 거꾸로 = [];
  for (let i = 1; i < L.LAYER_ORDER.length; i += 1) {
    const 앞 = L.LAYER_ORDER[i - 1];
    const 뒤 = L.LAYER_ORDER[i];
    if (!(L.LAYER[뒤] >= L.LAYER[앞])) 거꾸로.push(`${앞}(${L.LAYER[앞]}) > ${뒤}(${L.LAYER[뒤]})`);
  }
  ok('차례대로 층수가 오른다', 거꾸로, []);
  console.log('       ' + L.LAYER_ORDER.map((k) => `${k} ${L.LAYER[k]}`).join(' · '));
}

// ── 뜻으로 못 박아 두는 것 넷 ──
//
// 차례 목록만 보면 **목록을 고치면 자도 같이 따라간다.** 사람이 다친 자리 넷은
// 따로 못 박는다 — 이 넷이 뒤집히면 **버그가 돌아온 것**이다
console.log('\n── 사람이 막혔던 넷 ──');
ok('★ 잠금이 탭바보다 위다 (껍데기를 통째로 가려야 한다)', L.LAYER.잠금 > L.LAYER.탭바, true);
ok('★ 잠금이 휴식 띠보다 위다 (띠에 종목 이름이 적혀 있다)', L.LAYER.잠금 > L.LAYER.휴식띠, true);
ok('★ 모달이 탭바보다 위다 (덮개 위로 탭이 올라오면 눌린다)', L.LAYER.모달 > L.LAYER.탭바, true);
ok('★ 확인 창이 잠금보다 위다 (잠금의 「네 자리를 잊으셨나요」가 눌려야 한다)',
  L.LAYER.확인창 > L.LAYER.잠금, true);
ok('  확인 창이 모달보다 위다 (모달 안에서 묻는 창이 뒤에 깔리면 안 된다)',
  L.LAYER.확인창 > L.LAYER.모달, true);
ok('  점검 · 막힘이 제일 위다 (앱을 아예 못 쓰는 자리)',
  L.LAYER.점검 >= L.LAYER.막힘 && L.LAYER.막힘 > L.LAYER.스플래시, true);

// ── 표를 안 쓰고 숫자를 박은 자리 ──
//
// **네 자리를 넘는 생수**를 찾는다. 화면 안에서 쓰는 작은 층(`30` · `50` · `10`)은
// 서로 겨루는 자리가 아니라 둔다 — 겨루는 것은 **화면을 덮는 것들**이고 그것들은
// 전부 네 자리를 넘겼다(`LAYER_MIN`).
//
// 주석은 뗀다 — 까닭을 적어둔 줄에 숫자가 그대로 들어 있다(`check-daygap` 이 같은
// 자리에서 거짓 FAIL 을 세 번 냈다)
console.log('\n── 숫자를 박아둔 자리 ──');
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.jsx?$/.test(e.name)) files.push(p);
  }
}(SRC));

const codeOf = (s) => s.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, '$1').replace(/^\s*\/\/.*$/gm, '');
const 박은것 = [];
for (const f of files) {
  const rel = path.relative(SRC, f).split(path.sep).join('/');
  if (rel === 'data/layers.js') continue;             // 표 자신이다
  const src = codeOf(fs.readFileSync(f, 'utf8'));
  for (const m of src.matchAll(/zIndex:\s*(\d+)/g)) {
    if (Number(m[1]) >= L.LAYER_MIN) 박은것.push(`${rel} = ${m[1]}`);
  }
  // CSS 쪽은 `globals.css` 가 따로 본다 (아래)
}
ok('화면 코드에 덮개 층수를 박아둔 자리가 없다', 박은것, []);

// ── CSS 쪽 둘은 **맞대 본다** ──
//
// `globals.css` 는 `layers.js` 를 들일 수 없어 숫자를 그대로 적는다. 그래서
// **한쪽만 고치는 날**이 오는데, 그것이 바로 11/17 에 찾은 꼴이다(결산이 탭바
// 아래 · 토스트가 모달 아래). 자가 두 쪽을 맞댄다 — 표를 베끼지 않고 **읽는다**
{
  const css = fs.readFileSync(path.join(SRC, 'styles', 'globals.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const 어긋난것 = [];
  for (const [sel, 이름] of Object.entries(L.CSS_LAYERS || {})) {
    const 덩이 = new RegExp(`\\${sel}\\s*\\{([^}]*)\\}`).exec(css);
    if (!덩이) { 어긋난것.push(sel + ' 없음'); continue; }
    const m = /z-index:\s*(\d+)/.exec(덩이[1]);
    if (!m) { 어긋난것.push(sel + ' 층수 없음'); continue; }
    if (Number(m[1]) !== L.LAYER[이름]) 어긋난것.push(`${sel} = ${m[1]} (표의 ${이름} = ${L.LAYER[이름]})`);
  }
  ok('CSS 의 덮개 둘이 표와 같다 (결산 · 토스트)', 어긋난것, []);

  // 표에 없는 큰 층수가 CSS 에 또 생기는 것을 막는다. `.skip-link`(본문으로
  // 건너뛰기)는 **초점을 받을 때만 잠깐 서는 줄**이라 탭바와 같은 층으로 둔다
  const 아는값 = new Set([...Object.values(L.CSS_LAYERS || {}).map((k) => L.LAYER[k]), L.LAYER.탭바]);
  const 모르는것 = [...css.matchAll(/z-index:\s*(\d+)/g)]
    .map((m) => Number(m[1])).filter((n) => n >= L.LAYER_MIN && !아는값.has(n));
  ok('  표에 없는 덮개 층수가 CSS 에 없다', 모르는것, []);
}

// 표를 **실제로 들여다 쓰는지** 본다 — 표만 지어두고 아무도 안 부르면 그 표는 없는 것이다
{
  const 쓰는곳 = files.filter((f) => /from '\.\.?\/(\.\.\/)?data\/layers'/.test(fs.readFileSync(f, 'utf8')));
  ok('표를 들여다 쓰는 화면이 열 곳을 넘는다', 쓰는곳.length >= 10, true);
  console.log('       ' + 쓰는곳.length + '곳');
}

// ─────────────────────────────────────────────────────────────
// 되돌려-FAIL — 일부러 어긋낸 표와 코드를 먹여 **빨개지는지** 본다
// ─────────────────────────────────────────────────────────────
if (process.argv.includes('--되돌려')) {
  console.log('\n── 되돌려-FAIL: 일부러 어긋낸 꼴을 먹인다 ──');
  const 차례오름 = (LAYER, ORDER) => {
    for (let i = 1; i < ORDER.length; i += 1) if (!(LAYER[ORDER[i]] >= LAYER[ORDER[i - 1]])) return false;
    return true;
  };
  const 옛표 = { ...L.LAYER, 잠금: 9000, 모달: 99999, 확인창: 99998 };
  ok('옛 층수를 되돌리면 차례가 깨진다', 차례오름(옛표, L.LAYER_ORDER), false);
  ok('  잠금이 탭바 아래로 내려가면 걸린다 (11/17 의 그 버그)', 옛표.잠금 > 옛표.탭바, false);
  ok('  확인 창이 모달 아래로 내려가면 걸린다', 옛표.확인창 > 옛표.모달, false);
  const 동점 = { ...L.LAYER, 모달: L.LAYER.탭바 };
  ok('  모달이 탭바와 동점이면 걸린다 (DOM 차례가 정하게 된다)', 동점.모달 > 동점.탭바, false);
  // 숫자를 박은 자리를 하나 지어 먹인다
  const 가짜 = "const a = { zIndex: 99999 };";
  const 걸린수 = [...codeOf(가짜).matchAll(/zIndex:\s*(\d+)/g)]
    .map((m) => Number(m[1])).filter((n) => n >= L.LAYER_MIN);
  ok('  숫자를 박은 줄이 새로 생기면 걸린다', 걸린수, [99999]);
}

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
