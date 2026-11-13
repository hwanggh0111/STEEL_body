// **눌리는 것이 자판으로도 눌리는가** (2026-11-11)
//
//   npm run keytap     (npm run check 에도 들어 있다)
//
// ── 왜 이 검사가 있나 ──
//
// `<div onClick>` 은 **마우스와 손가락으로는 눌린다.** 그래서 고치는 사람도 쓰는
// 사람도 모른다 — 그런데 **탭 키는 그 자리에 멈추지 않고**, 읽어주는 기계는 그것이
// 눌리는 것인지조차 모른다. 눈으로는 단추이고 자판에는 없는 자리다.
//
// 11/11 에 홈 주간 달력 칸에서 한 건을 닫았는데, 정석이 전수로 세어 **29건**을
// 넘겼다. 그중 첫째가 **하단 탭바**(`TabBar` 의 `NavCell`)였다 — 앱의 주 길찾기가
// `<div onClick>` 이라 **자판만 쓰는 사람은 화면을 하나도 옮길 수 없었다.**
//
// 한 건씩 고치면 또 생긴다. 그래서 **수를 적어두고 그 수로 본다** —
// 「자르고 그리는 자리」(`check-cut`)와 「일부러 작게 둔 단추」(`check-tap`)가
// 쓰는 그 꼴이다. 새 자리가 생기면 FAIL, 고쳐서 줄어도 FAIL(적어둔 수를 같이
// 내리게 한다 — 안 그러면 목록이 거짓이 된다).
//
// ── 세면서 비키는 것 셋 ── (정석의 규칙이 거짓을 세 번 낸 자리다)
//
//   1. **남의 컴포넌트에 넘기는 `onClick`** — `<Row onClick={…}>` 은 DOM 핸들러가
//      아니다. 그 안에서 단추로 그릴지는 그 컴포넌트가 정한다.
//      → **소문자 태그만** 센다
//   2. **창 바깥을 눌러 닫는 자리** — 그 창에 `Escape` 가 있으면 자판으로 빠져나갈
//      길이 있으니 결함이 아니다. → `role="dialog"` 가 든 파일에 `Escape` 가
//      있으면 그 파일의 겉장(`position: fixed` 를 든 칸)은 비킨다
//   3. **`role={조건 ? 'button' : undefined}`** — 조건부로 붙는 꼴이다.
//      → 줄이 아니라 **그 태그의 속성 묶음 전체**를 보고 `role` 이 있나 본다

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

/** 여는 태그 하나의 속성 묶음을 그대로 떠낸다 — 여러 줄에 걸쳐 있어도 통째로 본다 */
function openTags(code) {
  const out = [];
  const re = /<([a-zA-Z][\w.]*)/g;
  let m;
  while ((m = re.exec(code))) {
    let i = re.lastIndex;
    let depth = 0;      // { } 깊이
    let quote = null;   // ' " ` 안인가
    while (i < code.length) {
      const c = code[i];
      if (quote) { if (c === quote && code[i - 1] !== '\\') quote = null; }
      else if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      else if (c === '>' && depth === 0) break;
      i += 1;
    }
    out.push({ tag: m[1], attrs: code.slice(re.lastIndex, i), at: m.index });
    re.lastIndex = i;
  }
  return out;
}

const lineOf = (code, at) => code.slice(0, at).split('\n').length;

// 자판으로 눌릴 수 있게 된 자리인가 — 셋 중 하나라도 있으면 손을 쓴 것으로 본다
const 손을썼나 = (a) => /\brole\s*=/.test(a) || /\btabIndex\s*=/.test(a) || /\bonKeyDown\s*=/.test(a);
// 원래 단추인 것들 — 자판이 알아서 안다
const 원래단추 = new Set(['button', 'a', 'input', 'select', 'textarea', 'summary', 'label', 'option']);

const found = {};
const walk = (dir) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) { walk(full); continue; }
    if (!/\.jsx$/.test(f.name)) continue;
    const rel = path.relative(SRC, full).replace(/\\/g, '/');
    const code = fs.readFileSync(full, 'utf8');
    // 창 바깥 눌러 닫기 — 그 파일에 Escape 가 있으면 겉장은 비킨다 (위 2번).
    //
    // ★ 처음에는 `role="dialog"` 가 든 파일만 비켰다. 그랬더니 **`Layout` 의 서랍
    //   겉장**이 걸렸다 — 그 서랍은 `Escape` 를 갖췄는데(:370) `role="dialog"` 를
    //   안 쓴다. 겉장은 **화면을 덮는 칸**이라는 것으로 가리는 쪽이 맞다
    // 2026-11-13 — **Esc 를 제 파일에 적지 않는 길이 생겼다.** 덮개 여섯의 Esc ·
    // 첫 포커스 · 탭 가두기 · 닫은 뒤 돌려주기를 공용 손(`data/useModalFocus.js`)이
    // 맡는다. 글자 `Escape` 만 찾으면 **그 손을 쓴 파일이 거짓 FAIL** 이 된다 —
    // 오늘 넷이 그렇게 걸렸다. 자판으로 빠져나갈 길이 있는지를 보는 자이지
    // 그 길을 어디에 적었는지를 보는 자가 아니다
    const Esc있다 = /['"]Escape['"]/.test(code) || /useModalFocus\s*\(/.test(code);
    for (const t of openTags(code)) {
      if (t.tag[0] === t.tag[0].toUpperCase()) continue;   // 남의 컴포넌트 (위 1번)
      if (원래단추.has(t.tag)) continue;
      if (!/\bonClick\s*=/.test(t.attrs)) continue;
      if (손을썼나(t.attrs)) continue;                      // 위 3번까지 여기서 걸러진다
      // 화면을 덮는 겉장인가 — `inset: 0` 이나 네 변을 0 으로 깐 칸
      const 겉장 = /position:\s*['"]fixed['"]/.test(t.attrs)
        && (/inset:\s*0/.test(t.attrs) || (/top:\s*0/.test(t.attrs) && /bottom:\s*0/.test(t.attrs)));
      if (Esc있다 && 겉장) continue;
      (found[rel] = found[rel] || []).push(lineOf(code, t.at));
    }
  }
};
walk(SRC);

console.log('── 자판으로 못 닿는 자리 ──');

// **적어둔 수.** 고칠 때마다 같이 내린다. 사람이 쓰는 화면을 앞으로 올려 적는다.
//
// ★ 정석이 넘긴 29건 중 **다섯은 이미 멀쩡했다** — 읽어 보고 뺐다.
//   `RestTimer:93`·`RemindersPage:106`  `role="switch"` + `tabIndex` + Enter/Space 가
//                                        이미 있다 (스위치는 단추가 아니라 스위치다)
//   `SessionFinish:123`                  창 겉장이고 `Escape` 가 있다 (:89)
//   `SecurityPanel` 둘 중 하나            남의 컴포넌트에 넘기는 `onClick` 이다
//   `SiteHome:652`                       창 겉장 — 다만 **`Escape` 가 없었다.**
//                                        그래서 그 자리는 11/11 에 내가 고쳤다
// **다 닫았다** (2026-11-11). 19건을 그날 안에 전부 닫아서 목록이 비었다 —
// 이제 이 자는 「**새 자리가 생기면 FAIL**」 하나로 선다.
//
// 닫은 차례는 아픈 순이었다 — 하단 탭바(앱의 주 길찾기) → 머리글 이름 · 쉬는 띠
// (매일 지나는 자리) → 고객센터 여덟(사용자가 쓴다) → 루틴 · 측정 · 소개 →
// 관리자 셋(주인만 쓴다). 창 넷에는 `Escape` 를 달았다(계정 삭제 · 비밀번호 변경 ·
// 사진 크게 보기 둘 · 사람 지우는 확인).
//
// 새로 `<div onClick>` 을 적었다가 걸리면 **고치는 쪽이 맞다.** 그래도 둬야 하면
// 까닭과 함께 여기 적는다 — 꼴은 `{ '파일/경로.jsx': 수 }` 다.
const 남은자리 = {};

const 지금 = Object.fromEntries(Object.entries(found).map(([k, v]) => [k, v.length]));
const 새로생긴것 = Object.keys(지금).filter((k) => !(k in 남은자리));
const 줄었는데안내린것 = Object.entries(남은자리)
  .filter(([k, n]) => (지금[k] || 0) !== n)
  .map(([k, n]) => `${k} 적어둔 ${n} · 지금 ${지금[k] || 0}`);

ok('적어두지 않은 새 자리', 새로생긴것, []);
console.log('     ↑ `<div onClick>` 이면 `role="button"`·`tabIndex`·Enter/Space 를 같이 준다.');
console.log('       **원래 단추인 것**(`<button>`)을 쓰는 쪽이 늘 낫다 — 자판·낭독기·돋보기가 다 안다');
ok('적어둔 수와 같다 (고쳤으면 같이 내린다)', 줄었는데안내린것, []);
const 합 = Object.values(지금).reduce((a, b) => a + b, 0);
console.log(합 === 0 ? '     남은 자리 없음 — 다 닫혔다' : `     남은 자리 ${합}개 / 파일 ${Object.keys(지금).length}개`);
// 고치러 갈 때 자리를 바로 보려면 — `KEYTAP_LIST=1 npm run keytap`
// (적어둔 수는 줄이 밀리므로 **열쇠로 삼지 않는다**. 보는 데만 쓴다)
if (process.env.KEYTAP_LIST) {
  for (const [f, lines] of Object.entries(found)) console.log('       ' + f + ' → ' + lines.join(' · '));
}

console.log('');
console.log('── 닫은 자리가 다시 열리지 않았는가 ──');
// 주 길찾기와 홈 주간 달력 · 한 해 벽은 11/11 에 닫았다. 되돌아가면 여기서 걸린다
const tabbar = fs.readFileSync(path.join(SRC, 'components', 'TabBar.jsx'), 'utf8');
ok('하단 탭바의 칸이 **단추**다', /const NavCell[\s\S]{0,400}?<button/.test(tabbar), true);
ok('  고른 자리를 읽어준다 (aria-current)', /aria-current=/.test(tabbar), true);
ok('  안 읽은 수를 이름에 넣는다', /안 읽은 \$\{item\.badge\}/.test(tabbar), true);
const home = fs.readFileSync(path.join(SRC, 'pages', 'HomePage.jsx'), 'utf8');
ok('홈 주간 달력 칸이 자판에 멈춘다', /tabIndex=\{done \? 0 : undefined\}/.test(home), true);

console.log('');
console.log('── 창에서 자판으로 빠져나갈 길이 있는가 ──');
// 2026-11-13 — **「Escape 가 적혀 있나」가 아니라 「빠져나갈 길이 있나」를 묻는다.**
// 그 길을 공용 손(`data/useModalFocus.js`)이 맡게 되면서 넷 중 셋이 거짓 FAIL 이 됐다.
// 공용 손은 Esc 에 더해 **탭 가두기와 닫은 뒤 돌려주기**까지 한다 — 더 나은 길이다
for (const f of ['ConfirmModal.jsx', 'PasswordResetModal.jsx', 'AccountDeleteModal.jsx', 'PasswordChangeModal.jsx']) {
  const code = fs.readFileSync(path.join(SRC, 'components', f), 'utf8');
  const 길 = /['"]Escape['"]/.test(code) || /useModalFocus\s*\(/.test(code);
  ok('  ' + f + ' 에서 자판으로 빠져나간다 (Esc)', 길, true);
}

console.log('');
console.log('── 닿은 다음 — 포커스가 보이는가 ── (2026-11-11)');
//
// 「눌리는데 자판으로 못 닿는 자리」를 다 닫고 보니 **닿은 다음**이 남아 있었다 —
// 탭이 멈추는데 **어디에 멈췄는지 안 보이면** 자판으로 쓸 수 없다. 눌러보고 알아내는
// 수밖에 없고, **지우는 단추 앞에서 그건 위험하다.**
//
// 브라우저가 제 고리를 그려주긴 하는데 ⑴ 흰 고리는 검정 바탕에서 묻히고
// ⑵ 앱이 `outline: 'none'` 을 적어둔 자리에서는 아예 안 보였다(몸 지도의 부위 여섯 ·
// 홈페이지 운동 찾기 칸). 그래서 금색으로 우리가 그린다.
{
  const css = fs.readFileSync(path.join(SRC, 'styles', 'globals.css'), 'utf8');
  ok('포커스 표시가 있다 (:focus-visible)', /:focus-visible\s*\{[\s\S]{0,120}outline:/.test(css), true);
  // `:focus` 로 걸면 손가락으로 누를 때마다 고리가 번쩍인다 — 자판일 때만 뜨게 한다
  ok('  누를 때는 안 뜬다 (:focus 가 아니라 :focus-visible)',
    /\[role="button"\][\s\S]{0,40}:focus-visible/.test(css), true);
  ok('  몸 지도 조각은 선도 굵어진다 (SVG 는 고리를 잘 안 그린다)',
    /\.map-part:focus-visible/.test(css), true);
  ok('  테두리만 있는 칸은 겉 칸이 켜진다', /\.field:focus-within/.test(css), true);

  // 자판으로 닿는 자리에서 `outline: 'none'` 을 적으면 **포커스가 사라진다.**
  // `tabIndex={-1}`(프로그램이 옮기는 자리)은 고리를 안 그리는 것이 맞다
  const 지운자리 = [];
  const walk2 = (dir) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, f.name);
      if (f.isDirectory()) { walk2(full); continue; }
      if (!/\.jsx$/.test(f.name)) continue;
      const code = fs.readFileSync(full, 'utf8');
      // 겉 칸이 테두리를 들고 켜지는 꼴(`.field:focus-within`)이면 칸 자체는 비켠다
      const 겉칸이있다 = /className="field"/.test(code);
      for (const t of openTags(code)) {
        // ★ **주석에 적힌 글자에 걸렸다** (처음 돌렸을 때 내가 적어둔 「`outline: 'none'`
        //    이었다」는 주석이 그대로 FAIL 로 나왔다). 속성에서 주석을 걷고 본다
        const attrs = t.attrs.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\r\n]*/g, ' ');
        if (!/outline:\s*['"]none['"]/.test(attrs)) continue;
        if (겉칸이있다 && t.tag === 'input') continue;
        if (/tabIndex=\{-1\}/.test(attrs)) continue;        // 프로그램이 옮기는 자리
        if (!/tabIndex|role="button"|role="switch"/.test(attrs) && !/^(button|a|input|select|textarea|summary)$/.test(t.tag)) continue;
        지운자리.push(path.relative(SRC, full).replace(/\\/g, '/') + ':' + lineOf(code, t.at));
      }
    }
  };
  walk2(SRC);
  ok('  자판으로 닿는 자리에서 포커스를 지운 곳', 지운자리, []);
  console.log('     ↑ 겉 칸이 테두리를 들고 있으면 거기에 `className="field"` 를 주고,');
  console.log('       그럴 자리가 아니면 `outline` 을 지우지 않는다');
}

console.log('');
console.log('── 알림이 낭독기에 전해지는가 ── (2026-11-11)');
//
// `Toast` 는 **화면에 그려지기만** 했다 — `aria-live` 도 `role` 도 없었다. 눈으로
// 안 보는 사람에게는 「지웠어요」도 「되돌리기」도 전해지지 않았고, **8초가 지나면
// 그 줄은 되돌릴 수 없다**(`data/undoRow.js` 의 `UNDO_MS`). 꾸밈이 아니라 **기능이
// 통째로 안 닿은 것**이라 자로 박는다.
{
  const t = fs.readFileSync(path.join(SRC, 'components', 'Toast.jsx'), 'utf8');
  ok('알림이 제 존재를 알린다 (role · aria-live)', /aria-live/.test(t) && /role:/.test(t), true);
  // **되돌리기가 붙은 것만** 끼어든다 — 그냥 알림이 매번 끼어들면 쓰는 사람이 말을 못 듣는다
  ok("  되돌리기가 붙으면 'assertive'", /role: 'alert', 'aria-live': 'assertive'/.test(t), true);
  ok("  그냥 알림은 'polite'", /role: 'status', 'aria-live': 'polite'/.test(t), true);
  // 자판으로 지운 사람은 알림까지 탭으로 가는 동안 8초가 지난다 — 그때만 포커스를 옮긴다
  ok('  자판으로 한 일이면 되돌리기 단추로 포커스를 옮긴다', /btnRef\.current\.focus\(\)/.test(t), true);
  ok('  닫힐 때 있던 자리로 돌려준다', /back\.focus\(\)/.test(t), true);
  // 글 + 단추가 화면보다 넓어지면 단추 절반이 화면 밖으로 나가 **누를 수가 없다**
  const css = fs.readFileSync(path.join(SRC, 'styles', 'globals.css'), 'utf8');
  ok('  단추 붙은 알림이 화면 밖으로 안 나간다', /\.toast-action[\s\S]{0,200}max-width/.test(css), true);
  // 쉬는 띠(bottom 60 · 높이 50 쯤)와 알림(bottom 80)이 겹친다 — 알림이 위라서 덮었다
  ok('  쉬는 띠가 떠 있으면 알림이 위로 비킨다', /restBarUp/.test(t) && /bottom: 142/.test(t), true);
  const store = fs.readFileSync(path.join(SRC, 'store', 'restTimerStore.js'), 'utf8');
  ok('    뜨는 조건이 한 자리에 있다', /export const restBarUp/.test(store), true);
  const bar = fs.readFileSync(path.join(SRC, 'components', 'RestBar.jsx'), 'utf8');
  ok('    띠도 그 조건을 쓴다 (두 벌로 두면 한쪽만 고쳐진다)', /restBarUp\(/.test(bar), true);
}

console.log('');
if (bad === 0) console.log('눌리는 것이 자판으로도 눌립니다');
else console.log(bad + '건 FAIL');
process.exit(bad === 0 ? 0 : 1);
