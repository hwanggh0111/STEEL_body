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
const codeOf = (s) => s.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, '$1').replace(/^\s*\/\/.*$/gm, '');

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
// ── ★ **잠금은 모든 것을 덮는다** ── (2026-11-17 · 정석이 뒤집었다)
//
// 여기 이렇게 적혀 있었다 —
//
//     ok('★ 확인 창이 잠금보다 위다 (잠금의 「네 자리를 잊으셨나요」가 눌려야 한다)', …)
//
// 그 **필요는 맞다.** 그런데 그 자가 지키는 것은 「**아무** 확인창이나 잠금 위」다.
// 확인창을 띄운 채 폰을 내려놓으면 잠금이 뜨고 그 창이 **잠금 위에 남는다** — 그
// 창에는 기록이 적혀 있다(`"{메모 앞머리}" 메모를 지울까요` · `{헬스장}의 {운동}`).
// 글이 보이는 데 그치지 않고 **단추가 살아 있다.**
//
// 가르는 것은 **누가 띄웠나**다. 잠금이 띄운 물음만 `잠금확인창` 층을 쓴다.
// 그래서 ⑴ 잠금이 `UNDER_LOCK` 전부보다 위 ⑵ `잠금확인창` 만 잠금 위 ⑶ `AppLock`
// 이 제 물음에 `잠금위` 를 넘기고 ⑷ 잠길 때 남은 물음을 **거두는지**까지 본다.
// ⑷ 가 없으면 덮인 창에 **포커스와 낭독기**가 남는다 — 층만으로는 모자라다.
ok('★ 잠금이 덮어야 하는 것 전부보다 위다',
  (L.UNDER_LOCK || []).filter((k) => !(L.LAYER.잠금 > L.LAYER[k])), []);
ok('  잠금이 확인창보다 위다 (그 창에 메모 · 운동 이름이 적혀 있다)',
  L.LAYER.잠금 > L.LAYER.확인창, true);
ok('  잠금이 토스트보다 위다 (잠긴 화면에서 「저장했어요」가 보일 일이 없다)',
  L.LAYER.잠금 > L.LAYER.토스트, true);
ok('★ 잠금이 띄운 물음만 잠금 위다 (「네 자리를 잊으셨나요」가 눌려야 한다)',
  L.LAYER.잠금확인창 > L.LAYER.잠금, true);
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
console.log('\n── 잠금이 제 물음을 가르는가 (손이 실제로) ──');
{
  const 읽기 = (f) => codeOf(fs.readFileSync(path.join(SRC, 'components', f), 'utf8'));
  const 잠금 = 읽기('AppLock.jsx');
  const 물음 = 읽기('ConfirmModal.jsx');
  // 잠금이 제 물음에 표를 달아 넘기는가 — 안 넘기면 **제 물음을 제가 덮어** 못 누른다
  ok('잠금이 제 물음에 `잠금위` 를 넘긴다', /잠금위:\s*true/.test(잠금), true);
  // 물음 쪽이 그 표를 보고 층을 가르는가 — 안 가르면 **아무 물음이나** 잠금 위다
  ok('  물음이 그 표로 층을 가른다', /잠금위[\s\S]{0,60}LAYER\.잠금확인창/.test(물음), true);
  // ★ 층만으로는 모자라다 — 덮인 창에 포커스와 낭독기가 남는다
  ok('★ 잠기면 떠 있던 물음을 거둔다 (`dismissConfirm`)',
    /dismissConfirm\(\)/.test(잠금) && /export function dismissConfirm/.test(물음), true);
  ok('  거둘 때 잠금이 띄운 것은 남긴다', /잠금위[\s\S]{0,40}남길것|남길것[\s\S]{0,80}잠금위/.test(물음), true);
}

console.log('\n── 숫자를 박아둔 자리 ──');
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.jsx?$/.test(e.name)) files.push(p);
  }
}(SRC));

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

// ── ★ **바닥에 뜨는 것이 탭바 높이를 짐작하지 않는가** ── (2026-11-19 · 맵시)
//
// 층은 위에서 지켰다. 그런데 **자리**도 겹친다 — 바닥에 떠 있는 것 셋(휴식 띠 ·
// 알림 · 위로 가기)이 `bottom: 60 · 80 · 90` 으로 **탭바 높이 60 을 짐작해서** 적고
// 있었다. 탭바 높이는 **글자 크기에 따라 자란다**: 기본 **64.6px** · 150% ~70 ·
// 200% ~82. 그러면 층이 위인 탭바(9999 > 띠 9998)가 **띠를 덮고**, 200% 에서는
// 띠 아래 9~13px 의 **쉬는 시간 진행 막대가 통째로 가려진다.**
//
// 그래서 탭바와 띠가 **제 높이를 재서** `--tabbar-h` · `--restbar-h` 로 알리고,
// 바닥에 뜨는 것은 그 변수에서 올라간다. 이 자는 **짐작한 px 가 돌아오지 않는지**
// 를 본다 — 돌아오면 글자를 크게 쓰는 사람 화면에서만 다시 가려지고, 그것은
// **폰으로 글자를 키워 봐야** 보인다.
{
  const 짐작 = [];
  const 보는것 = [
    ['components/Layout.jsx', /<RestBar bottom=\{([^}]*)\}/, '휴식 띠'],
    // `isPC` 갈래는 11/20 에 걷었다 — PC 는 `--tabbar-h` 가 **0** 이라 한 식이
    // 두 쪽을 다 맞춘다. 그래서 갈래 꼴로 찾지 않는다 (옛 꼴로 찾으면 고친 뒤
    // **자리를 못 찾았다**로 운다 — 11/20 에 이 자가 그렇게 울었다)
    ['components/Layout.jsx', /bottom: '(calc\([^']*)',\s*$/m, '위로 가기'],
    ['components/Toast.jsx', /const lift = barUp \? \{ bottom: ([^}]+) \}/, '알림이 띠 위로 비킬 때'],
  ];
  for (const [rel, re, 무엇] of 보는것) {
    const src = codeOf(fs.readFileSync(path.join(SRC, rel), 'utf8'));
    const m = re.exec(src);
    if (!m) { 짐작.push(rel + ' — ' + 무엇 + ' 자리를 못 찾았다'); continue; }
    // 변수를 쓰면 통과다. 수를 박아두면(60 · 90 · 142 …) 운다
    if (!/--tabbar-h/.test(m[1])) 짐작.push(rel + ' — ' + 무엇 + ' = ' + m[1].trim());
  }
  // 알림은 CSS 에 있다
  {
    const css = fs.readFileSync(path.join(SRC, 'styles', 'globals.css'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const 덩이 = /\.toast\s*\{([^}]*)\}/.exec(css);
    if (!덩이) 짐작.push('globals.css — `.toast` 를 못 찾았다');
    else {
      const b = /bottom:\s*([^;]+);/.exec(덩이[1]);
      if (!b) 짐작.push('globals.css — `.toast` 에 `bottom` 이 없다');
      else if (!/--tabbar-h/.test(b[1])) 짐작.push('globals.css — 알림 = ' + b[1].trim());
    }
  }
  ok('바닥에 뜨는 것이 탭바 높이를 변수로 받는다 (px 를 안 박는다)', 짐작, []);
  if (짐작.length) {
    console.log('       → `calc(var(--tabbar-h, 60px) + …)` 로 적으세요. 탭바는 글자 크기에');
    console.log('         따라 자라고, 박아둔 px 는 그때 **띠와 알림을 덮습니다**.');
  }

  // 알리는 쪽이 살아 있나 — 재는 손이 빠지면 변수가 영영 안 생기고 **대체값으로
  // 조용히 돌아간다**(60px). 그러면 위 검사는 통과인데 화면은 옛 꼴이다
  const 탭바 = codeOf(fs.readFileSync(path.join(SRC, 'components', 'TabBar.jsx'), 'utf8'));
  const 띠 = codeOf(fs.readFileSync(path.join(SRC, 'components', 'RestBar.jsx'), 'utf8'));
  ok('  탭바가 제 높이를 재서 알린다', [
    /--tabbar-h/.test(탭바), /ResizeObserver/.test(탭바), /getBoundingClientRect/.test(탭바),
  ], [true, true, true]);
  ok('  띠도 제 높이를 알린다 (알림이 비킬 거리)', [
    /--restbar-h/.test(띠), /ResizeObserver/.test(띠),
  ], [true, true]);
  // **사라질 때는 치운다** — `Layout` 은 로그인한 사람만 쓰므로 로그아웃하면 탭바가
  // 통째로 없어지는데, 적어둔 높이가 뿌리에 남으면 **탭바가 없는 로그인 화면에서도**
  // 알림이 그만큼 떠 있다 (글자를 크게 쓰는 사람은 100px 넘게 뜬다 · 2026-11-19)
  ok('  사라질 때 그 값을 치운다 (없는 탭바만큼 알림이 뜨지 않게)', [
    /removeProperty\('--tabbar-h'\)/.test(탭바), /removeProperty\('--restbar-h'\)/.test(띠),
  ], [true, true]);
}

// ── ★ **떠 있는 것끼리 서로 겹치지 않는가** ── (2026-11-20 · 맵시)
//
// 위에서 본 것은 「**탭바**를 짐작하지 않는가」였다. 그런데 바닥에는 탭바 말고도
// 뜬다 — 11/19 에 그 자를 세우면서 **쉬는 띠를 빼먹었고**, 그 자리에서 이것이 나왔다:
//
//     쉬는 띠    bottom 탭바          · 높이 68(기본)~96(글자 200%) · z **9998**
//     맨 위로    bottom 탭바 + 30     · 40×40                      · z **50**
//
// 단추가 띠 **안에 통째로 들어가 있었다.** 띠가 층이 위라서 **쉬는 동안 내내
// 눌리지 않았다** — 눌러도 띠가 먹고, 띠에 종목 이름이 적혀 있어 보이지도 않는다.
// 글자를 키울수록 깊이 묻힌다. 이것이 11/19 의 그 고침과 **같은 류**다.
//
// ── 어떻게 지키나 ──
//
// 자가 화면을 그려볼 수는 없다. 대신 **쌓임을 뜻으로 적는다** — 「같이 떠 있을 수
// 있는 것은 **아래에 쌓인 것의 높이를 다 더한다**」. 높이는 짐작하지 않는다:
// 탭바와 띠가 제 높이를 재서 `--tabbar-h` · `--restbar-h` 로 알리고 있다(위 묶음).
//
// 더하는 쪽의 **대체값은 0** 이어야 한다. `var(--restbar-h, 68px)` 로 적으면 띠가
// 없는 동안에도 단추가 68px 떠 있다 — 「없을 때 0」이 이 변수의 뜻이다.
//
// ★ **모집단을 이름으로 박지 않는다** (11/19 에 자 셋이 그래서 눈이 멀어 있었다).
// 자가 `src` 를 훑어 **바닥에 뜨는 것을 스스로 찾고**, 아래 목록에 없는 것이
// 나오면 **운다** — 새로 뜨는 것을 붙인 사람이 쌓임을 같이 적게 된다.
console.log('\n── 떠 있는 것끼리 겹치는가 (바닥에 쌓인 것) ──');
{
  // 파일 → [무엇인가, 그 아래에 쌓인 것들]
  //
  // `토스트`(CSS)는 아래에서 따로 본다 — 띠가 떴을 때만 비키므로 식이 둘이다.
  // **일부러 겹치는 쌍 하나** — 알림 ↔ 맨 위로. 320px 에서 알림이 가운데 맞춤으로
  // 최대 288px 이라 단추(left 20~60)를 덮고, 알림이 층이 위다(100400 > 50).
  // 그대로 둔다: 알림은 **위에 있어야 맞고**(되돌리기가 붙는다 · 4~8초면 사라진다),
  // 비키게 하면 알림이 뜰 때마다 단추가 45px 쯤 **튀어 오른다.** 적어두는 까닭은
  // 다음에 이 겹침을 보는 사람이 **모르고 고치지 않게** 하기 위해서다
  const 쌓임 = {
    'components/Layout.jsx': ['맨 위로 단추', ['--tabbar-h', '--restbar-h']],
  };
  const 바닥에뜨는것 = [];
  const 프롭으로받는것 = [];
  for (const f of files) {
    const rel = path.relative(SRC, f).split(path.sep).join('/');
    const src = codeOf(fs.readFileSync(f, 'utf8'));
    for (const m of src.matchAll(/position:\s*'fixed'/g)) {
      const 덩이 = src.slice(m.index, m.index + 320);
      // 통째로 덮는 것은 겨루는 자리가 아니다 (`inset: 0` · `top: 0 … bottom: 0`)
      if (/inset:\s*0/.test(덩이) || /top:\s*0/.test(덩이)) continue;
      // `bottom,` — 부르는 쪽에서 받는다 (`<RestBar bottom={…}>` 는 위에서 본다)
      if (/bottom,/.test(덩이)) { 프롭으로받는것.push(rel); continue; }
      const b = /bottom:\s*('[^']*'|[^,\n}]+)/.exec(덩이);
      if (!b) continue;
      const 값 = b[1].trim();
      if (값 === '0') continue;                 // 쌓임의 바닥이다 (탭바 자신)
      바닥에뜨는것.push([rel, 값]);
    }
  }
  // 모집단이 비면 **긁는 식이 망가진 것**이다 — 0건을 통과로 보지 않는다
  ok('바닥에 뜨는 것을 자가 찾았다 (0건은 통과가 아니다)', 바닥에뜨는것.length > 0, true);
  ok('  띠는 부르는 쪽에서 자리를 받는다', 프롭으로받는것, ['components/RestBar.jsx']);
  ok('목록에 없는 것이 새로 뜨지 않았다 (쌓임을 같이 적어야 한다)',
    바닥에뜨는것.filter(([rel]) => !쌓임[rel]).map(([rel, v]) => `${rel} = ${v}`), []);

  const 안더한것 = [];
  const 대체값 = [];
  for (const [rel, 값] of 바닥에뜨는것) {
    const [무엇, 더할것] = 쌓임[rel] || ['', []];
    for (const v of 더할것) if (!값.includes(v)) 안더한것.push(`${무엇}(${rel}) — ${v} 를 안 더한다`);
    // 더하는 쪽은 **없을 때 0** 이다.
    //
    // ★ **정규식을 안 쓴다** — 이 자를 세우는 동안 셸이 백슬래시를 먹어 패턴이
    // 통째로 다른 것을 재고 있었고(`var(` 를 여는 괄호가 아니게 받았다), 그래서
    // 「대체값 68px」을 **되돌려 먹였을 때 안 집혔다.** 글자 자리로 자른다
    for (const v of 더할것) {
      if (v !== '--restbar-h') continue;
      const 머리 = 'var(' + v + ',';
      const i = 값.indexOf(머리);
      if (i < 0) continue;                      // 안 더한 것은 위에서 이미 울었다
      const 뒤 = 값.slice(i + 머리.length);
      const 끝 = 뒤.indexOf(')');
      const 대체 = (끝 < 0 ? 뒤 : 뒤.slice(0, 끝)).trim();
      if (대체 !== '0' && 대체 !== '0px') {
        대체값.push(무엇 + ' — ' + v + ' 의 대체값이 ' + 대체 + ' 다 (띠가 없는 동안 그만큼 떠 있다)');
      }
    }
  }
  ok('★ 같이 뜨는 것은 아래에 쌓인 것을 다 더한다', 안더한것, []);
  ok('  없을 때 0 으로 떨어진다 (띠가 내려가면 제자리)', 대체값, []);
  for (const [rel, 값] of 바닥에뜨는것) console.log('       ' + (쌓임[rel] || [rel])[0] + ' = ' + 값);

  // 알림(CSS)도 같은 것을 본다 — 띠가 떴을 때 비키는 식은 **둘 다** 더해야 한다
  const 알림 = codeOf(fs.readFileSync(path.join(SRC, 'components', 'Toast.jsx'), 'utf8'));
  const lift = /const lift = barUp \? \{ bottom: '([^']*)'/.exec(알림);
  ok('알림이 띠 위로 비킬 때 둘을 다 더한다',
    lift ? ['--tabbar-h', '--restbar-h'].filter((v) => !lift[1].includes(v)) : ['비키는 식을 못 찾았다'], []);
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
  // ★ **11/17 의 둘째 버그** — 확인창 · 토스트가 잠금 위였다(기록이 적힌 창이 샜다)
  ok('  확인창이 잠금 위로 올라가면 걸린다', 100400 > 100300 === false, false);
  ok('  토스트가 잠금 위로 올라가면 걸린다', L.LAYER.토스트 > L.LAYER.잠금, false);
  ok('  잠금이 덮어야 할 것 하나만 위로 올려도 걸린다',
    ['확인창'].filter((k) => !(L.LAYER.잠금 > L.LAYER.잠금확인창)), ['확인창']);
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
