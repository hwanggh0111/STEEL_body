// **매초 바뀌는 글이 낭독기 영역 안에 있지 않은가** (2026-11-20 · 정석)
//
//   npm run live      (npm run check 에도 들어 있다)
//
// ── 왜 이 자가 생겼나 ──
//
// 쉬는 띠가 통째로 `role="status" aria-live="polite"` 였고, 그 안에 **매초 바뀌는 남은
// 시간**이 들어 있었다(`formatLeft(leftMs)`). `aria-live` 는 글이 바뀔 때마다 읽으므로
// **90초 휴식에 91번** 읽는다 — 화면을 보지 않는 사람에게는 운동 내내 쉬지 않고 떠드는
// 소리가 된다. 11/20 에 그것을 **거친 눈금**(1분 · 30초 · 10초 · 끝 — 네 번)으로 바꾸고
// 눈에 보이는 숫자는 `aria-hidden` 으로 가렸다.
//
// 그런데 **그 고침을 지키는 자가 없었다** — 되돌려 보니 `aria-live` 를 띠 통째로
// 되돌려도 검사가 전부 초록이었다(맵시가 되돌려 먹여 확인했다). 꼴을 되돌리기는
// 쉽고, **그 소리는 코드를 읽어서는 안 들린다.**
//
// ── 무엇을 보는가 ──
//
// `@babel/parser` 로 JSX 를 **실제로 파싱한다.** 낭독기 영역(`aria-live` ·
// `role="status"` · `role="alert"`)을 찾고, **그 영역의 자손**에서 **빠르게 바뀌는 값**이
// 읽히는지 본다. 빠르게 바뀌는 값은 이름으로 안다 —
//
//   ⑴ 이름이 `Ms` 로 끝나는 것 (`leftMs` · `elapsedMs`) — 밀리초는 **뜻이 곧 빠름**이다
//   ⑵ 그 값을 사람 말로 바꾸는 손 (`formatLeft`)
//
// ★ **이름으로 아는 것이 「지금을 베끼는 것」과 다른 까닭**: 「`leftMs` 를 쓰지 말라」가
// 아니라 **「밀리초 값을 낭독기 영역에서 읽히게 하지 말라」**다. 새 타이머가 생겨도
// 밀리초는 `Ms` 로 적히고, 그렇게 안 적는 날에는 이 자가 못 본다 — 그래서 **모집단을
// 세어 적는다**(낭독기 영역이 몇 곳인가). 0 으로 떨어지면 이 자가 장식이다.
//
// 가려둔 것은 안 센다 — `aria-hidden="true"` 안에 있으면 낭독기가 읽지 않으므로
// 매초 바뀌어도 소리가 안 난다. **눈으로 보는 숫자는 그렇게 둔다.**
//
//   node scripts/check-live.cjs --되돌려     일부러 어긋낸 꼴 여섯을 먹여 빨개지는지 본다

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const walkFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return walkFiles(p);
  return /\.jsx$/.test(e.name) ? [p] : [];
});

/** 빠르게 바뀌는 값인가 — 이름으로 안다 (위 머리글의 그 까닭) */
const 빠른이름 = (name) => /Ms$/.test(name) || name === 'formatLeft';

/**
 * ★ **식을 한 자리에 둔다** — 본 검사와 되돌려-FAIL 이 같은 손을 부른다.
 *
 * 돌려주는 것 — `{ 영역: n, 샌것: [...] }`. `샌것` 이 비어 있어야 한다.
 */
function 재기(code, file) {
  const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
  const 결과 = { 영역: 0, 샌것: [] };
  // ★ **한 자리는 한 건으로 센다.** `formatLeft(leftMs)` 는 손 이름과 값 이름에 둘 다
  // 걸려 **같은 자리를 두 번** 적었다(11/20 · 되돌려가 잡았다). 셈이 부풀면 「몇 군데가
  // 샜나」가 거짓이 된다 — 자리(`파일:줄`)로 묶고 이름은 그 자리에 모아 적는다
  const 자리별 = new Map();
  const 적기 = (자리, 이름) => {
    if (!자리별.has(자리)) 자리별.set(자리, new Set());
    자리별.get(자리).add(이름);
  };

  const 속성 = (el, 이름) => (el.openingElement.attributes || []).find(
    (a) => a.type === 'JSXAttribute' && a.name && a.name.name === 이름);
  const 글자값 = (a) => (a && a.value && a.value.type === 'StringLiteral' ? a.value.value : null);

  const 낭독기영역인가 = (el) => {
    if (속성(el, 'aria-live')) return true;
    const role = 글자값(속성(el, 'role'));
    return role === 'status' || role === 'alert';
  };
  const 가렸나 = (el) => {
    const a = 속성(el, 'aria-hidden');
    if (!a) return false;
    const v = 글자값(a);
    // `aria-hidden` 은 글자 `"true"` 로도, 식으로도 적는다. 식이면 **가린 쪽**으로 본다
    return v === null ? true : v === 'true';
  };

  // 영역 안을 훑는다. **가려진 가지는 들어가지 않는다** (낭독기가 안 읽는다)
  const 영역안훑기 = (el, 줄) => {
    const 타고가기 = (x) => {
      if (!x || typeof x !== 'object') return;
      if (Array.isArray(x)) { x.forEach(타고가기); return; }
      if (x.type === 'JSXElement') {
        if (가렸나(x)) return;                       // 가려둔 가지는 소리가 안 난다
        타고가기(x.children);
        return;
      }
      if (x.type === 'JSXExpressionContainer') { 타고가기(x.expression); return; }
      if (x.type === 'JSXFragment') { 타고가기(x.children); return; }
      if (x.type === 'Identifier') {
        if (빠른이름(x.name)) 적기(file + ':' + 줄, x.name);
        return;
      }
      if (x.type === 'CallExpression') {
        const 손 = x.callee && x.callee.name;
        if (손 && 빠른이름(손)) 적기(file + ':' + 줄, 손);
        타고가기(x.arguments);
        return;
      }
      // 조건 · 삼항 · 셈 · 틀 글 — 안을 다 본다
      for (const k of ['left', 'right', 'test', 'consequent', 'alternate', 'expressions',
        'quasis', 'object', 'property', 'argument', 'elements', 'properties', 'value', 'children']) {
        if (x[k]) 타고가기(x[k]);
      }
    };
    타고가기(el.children);
  };

  const 걷기 = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(걷기); return; }
    if (node.type === 'JSXElement' && 낭독기영역인가(node)) {
      결과.영역 += 1;
      영역안훑기(node, node.loc.start.line);
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'start' || k === 'end') continue;
      const v = node[k];
      if (v && typeof v === 'object') 걷기(v);
    }
  };
  걷기(ast.program.body);
  // 자리별로 묶어 적는다 — 한 자리는 한 건이다
  결과.샌것 = [...자리별.entries()].map(([자리, 이름들]) => 자리 + ' (' + [...이름들].join(' · ') + ')');
  return 결과;
}

// ── 되돌려 꼴 ──
const 되돌려꼴 = [
  {
    이름: '매초 바뀌는 값이 낭독기 영역에서 읽히면 운다 (11/20 의 그 띠)',
    code: `const A = () => (
  <div role="status" aria-live="polite">
    <span>{formatLeft(leftMs)}</span>
  </div>
);`,
    본다: (r) => r.샌것.length,
    기대: 1,
  },
  {
    이름: '  이름만으로도 집는다 (`Ms` 로 끝나는 값)',
    code: `const A = () => (<div aria-live="polite">{leftMs}</div>);`,
    본다: (r) => r.샌것.length,
    기대: 1,
  },
  {
    이름: '  가려둔 가지는 안 센다 (거짓 FAIL 막이 · 눈으로 보는 숫자)',
    code: `const A = () => (
  <div role="status" aria-live="polite">
    <span aria-hidden="true">{formatLeft(leftMs)}</span>
    <span>{거친눈금}</span>
  </div>
);`,
    본다: (r) => r.샌것.length,
    기대: 0,
  },
  {
    이름: '  거친 눈금만 읽히면 안 운다 (고친 꼴)',
    code: `const A = () => (<span role="status" aria-live="polite">{거친눈금}</span>);`,
    본다: (r) => r.샌것.length,
    기대: 0,
  },
  {
    이름: '  낭독기 영역이 아니면 안 본다 (거짓 FAIL 막이 · 눈으로만 보는 큰 숫자)',
    code: `const A = () => (<div><span>{formatLeft(leftMs)}</span></div>);`,
    본다: (r) => r.샌것.length,
    기대: 0,
  },
  {
    이름: '  영역을 세어 적는다 (0 이면 이 자가 장식이다)',
    code: `const A = () => (<div role="alert">못 했어요</div>);`,
    본다: (r) => r.영역,
    기대: 1,
  },
];

if (process.argv.includes('--되돌려')) {
  console.log('── 되돌려-FAIL: 일부러 어긋낸 꼴을 먹인다 ──');
  for (const t of 되돌려꼴) ok(t.이름, t.본다(재기(t.code, '(되돌려)')), t.기대);
  console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
  process.exit(bad ? 1 : 0);
}

console.log('── 낭독기가 매초 떠들지 않는가 ──');
let 영역 = 0;
const 샌것 = [];
for (const f of walkFiles(SRC)) {
  const rel = path.relative(SRC, f).split(path.sep).join('/');
  const r = 재기(fs.readFileSync(f, 'utf8'), rel);
  영역 += r.영역;
  샌것.push(...r.샌것);
}
// **모집단을 먼저 센다** — 0 으로 떨어지면 아래 줄이 「비어서 참」이 된다
ok('낭독기 영역을 찾았다 (모집단이 비면 이 자는 장식이다)', 영역 > 5, true);
console.log('       낭독기 영역 ' + 영역 + '곳');
ok('★ 매초 바뀌는 값이 낭독기 영역에서 읽히지 않는다', 샌것, []);
if (샌것.length) {
  console.log('       → 거친 눈금(1분 · 30초 · 10초 · 끝)만 읽히게 하고, 눈으로 보는');
  console.log('         숫자는 `aria-hidden="true"` 로 가리세요. `aria-live` 는 글이');
  console.log('         바뀔 때마다 읽으므로 **90초 휴식에 91번** 읽습니다.');
}

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
