// **손이 막는데 단추는 멀쩡해 보이는 자리** (2026-11-20 · 정석)
//
//   npm run guard      (npm run check 에도 들어 있다)
//
// ── 왜 이 자가 생겼나 ──
//
// 11/20 에 잠금 화면에서 나왔다. 지문 단추의 손이 **이른 반환**으로 막고 있었다 —
// `if (busy.current || left > 0) return;`. 잠금 대기 중에는 아무 일도 안 하는데 단추는
// **멀쩡해 보였다.** 누르면 **조용히 아무 일도 안 나고, 까닭도 말해주지 않는다.**
//
// 그 자리를 자판 그리드로 옮기면서 그리드가 `opacity: 0.4` 라 **꼴은 「못 누른다」고
// 말하는데 손은 그대로**가 될 뻔했다. 꼴이 거짓말하는 자리다. `disabled` 를 붙이면
// 꼴·손·안내 줄이 **셋 다 같은 말**을 한다.
//
// ── 어디까지 세는가 (★ 이 선이 이 자의 전부다) ──
//
//   ⑴ **`useState` 로 막는 것은 센다** — 사람이 알아야 하는 막힘이다. 「지금은 안
//      된다」가 화면에 보일 수 있고, 보여야 한다
//   ⑵ **`ref` 로 막는 것은 안 센다**(`busy.current`) — 그것은 **재진입 막이**다.
//      같은 손이 두 번 들어오는 찰나를 막는 것이라 사람 눈에 보일 필요가 없다
//
// 그래서 `left > 0`(state)은 울고 `busy.current`(ref)는 조용하다. **빗장의 종류로
// 가른다** — 「어느 이름이 빗장인가」를 베껴 적으면 그 목록이 썩는다.
//
// `@babel/parser` 로 JSX 를 **실제로 파싱한다.** 글자 맞대기로는 어느 단추가 어느 손을
// 부르는지 알 수 없고, 그것을 모르면 이 류를 셀 수 없다.
//
//   node scripts/check-guard.cjs --되돌려     일부러 어긋낸 꼴 일곱을 먹여 빨개지는지 본다

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

/**
 * ★ **식을 한 자리에 둔다** — 본 검사와 되돌려-FAIL 이 같은 손을 부른다.
 *
 * 돌려주는 것 — `{ 짝: n, 샌것: [...] }`
 *   짝    — 「state 로 막는 손 + 그 손을 부르는 단추」 쌍의 수 (모집단)
 *   샌것  — 그중 단추에 `disabled` 가 없는 것
 */
function 재기(code, file) {
  const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
  const 결과 = { 짝: 0, 샌것: [], 꼴로막힘: [] };

  // ── ⑴ `useState` 로 지은 이름을 모은다 ──
  const 상태이름 = new Set();
  const 모으기 = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(모으기); return; }
    if (node.type === 'VariableDeclarator' && node.init && node.init.type === 'CallExpression'
      && node.init.callee && node.init.callee.name === 'useState'
      && node.id && node.id.type === 'ArrayPattern' && node.id.elements[0]
      && node.id.elements[0].type === 'Identifier') {
      상태이름.add(node.id.elements[0].name);
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc') continue;
      if (node[k] && typeof node[k] === 'object') 모으기(node[k]);
    }
  };
  모으기(ast.program.body);

  // ── ⑵ 손마다 **이른 반환 빗장**이 있나 ──
  //
  // 「이른」의 뜻: 손의 **앞 세 줄 안**에서 막고 바로 나간다. 뒤에서 막는 것은 일을
  // 하다가 돌아서는 것이라 다른 이야기다
  const 빗장손 = new Map();     // 이름 → 빗장 글
  const 몸통 = (fn) => (fn.body && fn.body.type === 'BlockStatement' ? fn.body.body : []);
  const 빗장찾기 = (fn) => {
    for (const st of 몸통(fn).slice(0, 3)) {
      if (st.type !== 'IfStatement') continue;
      const 안 = st.consequent;
      const 나가나 = 안.type === 'ReturnStatement'
        || (안.type === 'BlockStatement' && 안.body.length === 1 && 안.body[0].type === 'ReturnStatement');
      if (!나가나) continue;
      // 빗장이 **상태**를 보는가 — `ref.current` 는 재진입 막이라 안 센다
      let 상태를보나 = false;
      const 본이름 = new Set();
      const 보기 = (x) => {
        // **이름을 다 모은다** — 처음에 「하나 찾으면 그만」으로 적었더니 빗장이 둘을
        // 보는 자리(`if (!weight || !reps)`)에서 **한 이름만** 들고 나와, 아래 「꼴로
        // 이미 막혀 있나」를 견주는 자리가 반만 보였다 (11/20 · 그 자리에서 고쳤다)
        if (!x || typeof x !== 'object') return;
        if (Array.isArray(x)) { x.forEach(보기); return; }
        // `a.current` 꼴은 **속을 안 본다** — 그 안의 이름이 상태 이름과 겹쳐도 ref 다
        if (x.type === 'MemberExpression' && x.property && x.property.name === 'current') return;
        if (x.type === 'Identifier' && 상태이름.has(x.name)) {
          상태를보나 = true;
          본이름.add(x.name);
          return;
        }
        for (const k of ['left', 'right', 'argument', 'object', 'property', 'expressions', 'test',
          'consequent', 'alternate', 'elements', 'arguments', 'callee']) {
          if (x[k]) 보기(x[k]);
        }
      };
      보기(st.test);
      if (상태를보나) return { 줄: st.loc.start.line, 이름들: 본이름 };
    }
    return null;
  };
  const 손모으기 = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(손모으기); return; }
    if (node.type === 'VariableDeclarator' && node.id && node.id.type === 'Identifier'
      && node.init && (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression')) {
      const 빗장 = 빗장찾기(node.init);
      if (빗장) 빗장손.set(node.id.name, 빗장);
    }
    if (node.type === 'FunctionDeclaration' && node.id) {
      const 빗장 = 빗장찾기(node);
      if (빗장) 빗장손.set(node.id.name, 빗장);
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc') continue;
      if (node[k] && typeof node[k] === 'object') 손모으기(node[k]);
    }
  };
  손모으기(ast.program.body);

  // ── ⑶ 그 손을 부르는 **단추**에 `disabled` 가 있나 ──
  //
  // ★ **꼴이 이미 막고 있으면 안 센다.** 단추가 `{result && <button …>}` 처럼 **그
  // 상태일 때만 그려지면**, 빗장이 참인 동안에는 단추가 **아예 없다** — `disabled` 를
  // 달 자리도 없고 사람이 헛누를 일도 없다. 11/20 에 이 자를 처음 돌려 여섯을 울렸는데
  // **다섯이 그 꼴이었다**(거짓 FAIL): `{result && …}` · `{time > 0 && …}` ·
  // `{stash && …}` · `{running && …}`.
  //
  // 가르는 법: 조상 조건이 보는 **상태 이름**과 빗장이 보는 이름이 **겹치나**. 겹치면
  // 그 상태는 이미 꼴에 나와 있다. ★ **갈라낸 것은 세어 적는다** — 조용히 빼면 다음
  // 사람이 이 자를 못 믿는다(맵시가 11/20 에 같은 선을 세웠다).
  const 단추훑기 = (node, 조건이름 = new Set()) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach((n) => 단추훑기(n, 조건이름)); return; }
    // 조건부로 그려지는 가지인가 — 그 조건이 보는 상태 이름을 안으로 들고 간다
    if (node.type === 'JSXExpressionContainer' && node.expression) {
      const e = node.expression;
      const 모은것 = new Set(조건이름);
      const 이름줍기 = (x) => {
        if (!x || typeof x !== 'object') return;
        if (Array.isArray(x)) { x.forEach(이름줍기); return; }
        if (x.type === 'Identifier' && 상태이름.has(x.name)) { 모은것.add(x.name); return; }
        for (const k of ['left', 'right', 'argument', 'object', 'test', 'expressions', 'arguments', 'callee']) {
          if (x[k]) 이름줍기(x[k]);
        }
      };
      if (e.type === 'LogicalExpression') { 이름줍기(e.left); 단추훑기(e.right, 모은것); return; }
      if (e.type === 'ConditionalExpression') {
        이름줍기(e.test);
        단추훑기(e.consequent, 모은것);
        단추훑기(e.alternate, 모은것);
        return;
      }
    }
    if (node.type === 'JSXElement' && node.openingElement.name
      && node.openingElement.name.name === 'button') {
      const attrs = node.openingElement.attributes || [];
      const 속성 = (이름) => attrs.find((a) => a.type === 'JSXAttribute' && a.name && a.name.name === 이름);
      const onClick = 속성('onClick');
      if (onClick && onClick.value && onClick.value.type === 'JSXExpressionContainer') {
        const e = onClick.value.expression;
        // `onClick={손}` · `onClick={() => 손(...)}` 둘 다 본다
        const 부르는이름 = [];
        if (e.type === 'Identifier') 부르는이름.push(e.name);
        const 안보기 = (x) => {
          if (!x || typeof x !== 'object') return;
          if (Array.isArray(x)) { x.forEach(안보기); return; }
          if (x.type === 'CallExpression' && x.callee && x.callee.name) 부르는이름.push(x.callee.name);
          for (const k of ['body', 'expression', 'expressions', 'arguments', 'left', 'right',
            'consequent', 'alternate', 'argument']) {
            if (x[k]) 안보기(x[k]);
          }
        };
        if (e.type === 'ArrowFunctionExpression' || e.type === 'FunctionExpression') 안보기(e.body);
        for (const 이름 of 부르는이름) {
          if (!빗장손.has(이름)) continue;
          const 빗장 = 빗장손.get(이름);
          // 꼴이 이미 그 상태를 보고 있나 (위 머리글의 그 갈래)
          const 꼴로막힘 = [...빗장.이름들].some((n) => 조건이름.has(n));
          if (꼴로막힘) {
            결과.꼴로막힘.push(file + ':' + node.loc.start.line + ' (' + 이름 + ')');
            continue;
          }
          결과.짝 += 1;
          const 막나 = 속성('disabled') || 속성('aria-disabled');
          if (!막나) {
            결과.샌것.push(file + ':' + node.loc.start.line
              + ' (' + 이름 + ' 이 ' + 빗장.줄 + '줄에서 '
              + [...빗장.이름들].join('·') + ' 로 막는다)');
          }
        }
      }
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc') continue;
      // ★ **꾸러미를 들고 내려간다.** 처음에 여기서 `조건이름` 을 안 넘겼더니 조건이
      // **한 겹만** 보였다 — `{stash && (<div>…<button/></div>)}` 처럼 한 칸만 더
      // 깊어도 「꼴로 이미 막혀 있다」를 못 보고 **거짓 FAIL** 을 냈다 (11/20)
      if (node[k] && typeof node[k] === 'object') 단추훑기(node[k], 조건이름);
    }
  };
  단추훑기(ast.program.body);
  return 결과;
}

const 되돌려꼴 = [
  {
    이름: '상태로 막는데 단추에 `disabled` 가 없으면 운다 (11/20 의 지문 단추)',
    code: `const A = () => {
  const [left, setLeft] = useState(0);
  const 지문으로 = async () => {
    if (left > 0) return;
    await 풀기();
  };
  return <button onClick={지문으로}>지문으로</button>;
};`,
    본다: (r) => r.샌것.length,
    기대: 1,
  },
  {
    이름: '  `disabled` 가 있으면 안 운다 (고친 꼴)',
    code: `const A = () => {
  const [left, setLeft] = useState(0);
  const 지문으로 = async () => {
    if (left > 0) return;
  };
  return <button disabled={left > 0} onClick={지문으로}>지문으로</button>;
};`,
    본다: (r) => r.샌것.length,
    기대: 0,
  },
  {
    이름: '  `ref` 로 막는 것은 안 센다 (거짓 FAIL 막이 · 재진입 막이)',
    code: `const A = () => {
  const busy = useRef(false);
  const 보내기 = async () => {
    if (busy.current) return;
  };
  return <button onClick={보내기}>보내기</button>;
};`,
    본다: (r) => [r.짝, r.샌것.length],
    기대: [0, 0],
  },
  {
    이름: '  화살표 안에서 불러도 본다 (`onClick={() => 손()}`)',
    code: `const A = () => {
  const [busy, setBusy] = useState(false);
  const 지우기 = async (id) => {
    if (busy) return;
  };
  return <button onClick={() => 지우기(1)}>지우기</button>;
};`,
    본다: (r) => r.샌것.length,
    기대: 1,
  },
  {
    이름: '  빗장이 뒤에 있으면 안 센다 (거짓 FAIL 막이 · 일하다 돌아서는 것)',
    code: `const A = () => {
  const [busy, setBusy] = useState(false);
  const 보내기 = async () => {
    const x = await 읽기();
    const y = x + 1;
    const z = y + 1;
    if (busy) return;
  };
  return <button onClick={보내기}>보내기</button>;
};`,
    본다: (r) => [r.짝, r.샌것.length],
    기대: [0, 0],
  },
  {
    이름: '  빗장이 상태를 안 보면 안 센다 (거짓 FAIL 막이 · 값이 비었나)',
    code: `const A = () => {
  const 보내기 = async (file) => {
    if (!file) return;
  };
  return <button onClick={() => 보내기(f)}>보내기</button>;
};`,
    본다: (r) => [r.짝, r.샌것.length],
    기대: [0, 0],
  },
  {
    이름: '  `aria-disabled` 로 적어도 받는다 (거짓 FAIL 막이)',
    code: `const A = () => {
  const [busy, setBusy] = useState(false);
  const 보내기 = async () => {
    if (busy) return;
  };
  return <button aria-disabled={busy} onClick={보내기}>보내기</button>;
};`,
    본다: (r) => [r.짝, r.샌것.length],
    기대: [1, 0],
  },
];

if (process.argv.includes('--되돌려')) {
  console.log('── 되돌려-FAIL: 일부러 어긋낸 꼴을 먹인다 ──');
  for (const t of 되돌려꼴) ok(t.이름, t.본다(재기(t.code, '(되돌려)')), t.기대);
  console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
  process.exit(bad ? 1 : 0);
}

console.log('── 손이 막으면 단추도 막혀 보이는가 ──');
let 짝 = 0;
const 샌것 = [];
for (const f of walkFiles(SRC)) {
  const rel = path.relative(SRC, f).split(path.sep).join('/');
  const r = 재기(fs.readFileSync(f, 'utf8'), rel);
  짝 += r.짝;
  샌것.push(...r.샌것);
}
// **모집단을 먼저 센다** — 0 으로 떨어지면 아래 줄이 「비어서 참」이 된다
ok('상태로 막는 손과 그 단추를 찾았다 (모집단이 비면 이 자는 장식이다)', 짝 > 0, true);
console.log('       state 빗장 + 단추 짝 ' + 짝 + '쌍');
ok('★ 손이 막는 단추는 `disabled` 로도 막혀 있다', 샌것, []);
if (샌것.length) {
  console.log('       → 손이 `if (상태) return` 으로 막는데 단추가 멀쩡해 보이면,');
  console.log('         누르는 사람은 **조용히 아무 일도 안 나는 것**을 봅니다.');
  console.log('         `disabled` 를 붙이면 꼴과 손이 같은 말을 합니다.');
}

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
