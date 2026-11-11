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
    // 창 바깥 눌러 닫기 — 그 파일에 Escape 가 있으면 겉장은 비킨다 (위 2번)
    const 창이고Esc있다 = /role\s*=\s*["']dialog["']/.test(code) && /['"]Escape['"]/.test(code);
    for (const t of openTags(code)) {
      if (t.tag[0] === t.tag[0].toUpperCase()) continue;   // 남의 컴포넌트 (위 1번)
      if (원래단추.has(t.tag)) continue;
      if (!/\bonClick\s*=/.test(t.attrs)) continue;
      if (손을썼나(t.attrs)) continue;                      // 위 3번까지 여기서 걸러진다
      if (창이고Esc있다 && /position:\s*['"]fixed['"]/.test(t.attrs)) continue;
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
const 남은자리 = {
  // 매일 지나는 자리 — 다음에 이것부터
  'components/Layout.jsx': 3,              // 머리글 워드마크 → 홈 · 그 밖 둘
  'components/RestBar.jsx': 1,             // 쉬는 띠
  // 고객센터 — 사용자가 쓴다
  'pages/support/SupportPage.jsx': 3,
  'pages/support/FeedList.jsx': 1,
  'pages/support/ReportList.jsx': 1,
  'pages/support/ReportBox.jsx': 2,
  'pages/support/AskFirst.jsx': 1,
  // 그 외 사용자 화면
  'pages/RoutinePage.jsx': 1,
  'pages/routine/RoutineNotes.jsx': 1,
  'components/measure/BodySizeSection.jsx': 1,
  'pages/IntroPage.jsx': 1,
  // 관리자 — 주인만 쓴다. 맨 뒤
  'pages/AdminPage.jsx': 1,
  'components/SecurityPanel.jsx': 1,
  'components/admin/ReportAdmin.jsx': 1,
};

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
console.log(`     남은 자리 ${합}개 / 파일 ${Object.keys(지금).length}개`);

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
for (const f of ['ConfirmModal.jsx', 'PasswordResetModal.jsx', 'AccountDeleteModal.jsx', 'PasswordChangeModal.jsx']) {
  const code = fs.readFileSync(path.join(SRC, 'components', f), 'utf8');
  ok('  ' + f + ' 에 Escape 가 있다', /['"]Escape['"]/.test(code), true);
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
}

console.log('');
if (bad === 0) console.log('눌리는 것이 자판으로도 눌립니다 (적어둔 자리를 뺀 나머지)');
else console.log(bad + '건 FAIL');
process.exit(bad === 0 ? 0 : 1);
