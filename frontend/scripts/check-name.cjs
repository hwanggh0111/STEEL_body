// **없는 이름을 쓰는 자리가 없는가** (2026-10-28).
//
//   npm run name     (npm run check 에도 들어 있다)
//
// ── 왜 ──
//
// 오늘 내가 **이 앱을 흰 화면으로 만들었다.** 관리자 보안 화면의 말 사전(`T`)을
// 걷으면서 `t.무엇` 꼴 열둘을 한국어로 바꿨는데 **`t[무엇]` 꼴 넷을 못 봤다** —
// 꺾쇠로 꺼내는 자리다. 그 화면을 열면 `t` 가 없어서 그 자리에서 터진다.
//
// **아무 자도 안 잡았다** — `npm run build` 는 통과한다(번들러는 이름이 있는지 안
// 본다). 검사 서른여섯도 통과했다. `npm run odd` 는 **계산하는 함수**에 이상한 값을
// 넣어보는 자리라 JSX 안의 이름은 안 본다. 그리고 **ESLint 가 아예 없다.**
//
// ── 어떻게 보나 ──
//
// **새 짐을 들이지 않는다.** 이미 있는 둘을 쓴다 —
//   · `esbuild` 로 JSX 를 걷어 보통 자바스크립트로 만든다(`React.createElement` 로 바뀐다)
//   · `rollup/parseAst` 로 나무를 얻는다
//
// 그리고 파일마다 ①선언된 이름과 ②쓰는 이름을 모아 **선언이 없는 것**을 FAIL 한다.
// **블록 범위는 안 본다** — 파일 어디에든 선언이 있으면 통과시킨다. 좁게 보면
// 멀쩡한 자리가 FAIL 하고(오늘만 세 번 밟았다), 넓게 봐도 **오늘 같은 자리는 잡힌다.**
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const { parseAst } = require('rollup/parseAst');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// 브라우저 · Node · 번들러가 주는 이름
const GLOBALS = new Set(`
window document console navigator location history localStorage sessionStorage
setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame
requestIdleCallback cancelIdleCallback queueMicrotask structuredClone reportError alert confirm
fetch Request Response Headers AbortController AbortSignal FormData URL URLSearchParams
Blob File FileReader Image Audio AudioContext webkitAudioContext MediaRecorder MediaStream
Math JSON Object Array String Number Boolean Date RegExp Error TypeError RangeError
Promise Map Set WeakMap WeakSet Symbol Proxy Reflect BigInt Intl ArrayBuffer Uint8Array
Float32Array Int32Array DataView TextEncoder TextDecoder atob btoa crypto performance
isNaN isFinite parseInt parseFloat encodeURIComponent decodeURIComponent encodeURI decodeURI
IntersectionObserver ResizeObserver MutationObserver PerformanceObserver SpeechRecognition
webkitSpeechRecognition SpeechSynthesisUtterance speechSynthesis
Notification ServiceWorkerRegistration PushManager Worker SharedWorker BroadcastChannel
CustomEvent Event KeyboardEvent MouseEvent TouchEvent CanvasRenderingContext2D
HTMLElement HTMLCanvasElement Node DOMParser XMLSerializer getComputedStyle matchMedia
process globalThis require module exports __dirname __filename caches
Buffer setImmediate clearImmediate
undefined NaN Infinity arguments React
`.trim().split(/\s+/).filter(Boolean));

// **양쪽을 다 본다** (2026-10-28). 백엔드에도 ESLint 가 없고, 짐(`esbuild` ·
// `rollup`)은 여기에만 있다 — 그러니 여기서 두 나무를 같이 훑는다.
// 처음 훑을 때 백엔드는 **51파일 · 13,268 쓰임에 0건**이었다. 지금 0 이라고
// 안 보면, 다음에 거기서 같은 일이 나도 아무도 모른다
const TREES = [
  { label: '앱', dir: path.join(__dirname, '..', 'src') },
  { label: '서버', dir: path.join(__dirname, '..', '..', 'backend', 'src') },
];
const walk = (d, out = []) => {
  if (!fs.existsSync(d)) return out;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/[.](jsx|js)$/.test(e.name)) out.push(p);
  }
  return out;
};

// 선언하는 자리에서 이름을 꺼낸다 (펼쳐 받기 · 기본값 · 나머지까지)
const namesOf = (node, out) => {
  if (!node || typeof node !== 'object') return;
  switch (node.type) {
    case 'Identifier': out.add(node.name); return;
    case 'ObjectPattern': node.properties.forEach((p) => namesOf(p.type === 'RestElement' ? p.argument : p.value, out)); return;
    case 'ArrayPattern': node.elements.forEach((e) => namesOf(e, out)); return;
    case 'AssignmentPattern': namesOf(node.left, out); return;
    case 'RestElement': namesOf(node.argument, out); return;
    default: return;
  }
};

console.log('── 선언 없이 쓰는 이름 ──');

for (const tree of TREES) {
const SRC = tree.dir;
const missing = [];
let files = 0;
let seen = 0;

for (const f of walk(SRC)) {
  const rel = tree.label + '/' + path.relative(SRC, f).split(path.sep).join('/');
  let js;
  try {
    js = esbuild.transformSync(fs.readFileSync(f, 'utf8'), { loader: 'jsx', format: 'esm' }).code;
  } catch (err) {
    bad += 1;
    console.log('FAIL ' + rel + ' 를 읽지 못했다 → ' + err.message.split('\n')[0]);
    continue;
  }
  let ast;
  try { ast = parseAst(js); } catch (err) { bad += 1; console.log('FAIL ' + rel + ' 나무를 못 얻었다'); continue; }
  files += 1;

  const declared = new Set();
  const used = [];

  const walkNode = (node, parent) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach((n) => walkNode(n, parent)); return; }
    if (typeof node.type !== 'string') return;

    switch (node.type) {
      case 'ImportDeclaration':
        // **이름을 바꿔 가져오는 자리**(`import { isAdmin as checkAdmin }`)에서는
        // 들어오는 쪽 이름(`isAdmin`)이 **이 파일의 이름이 아니다.** 처음에 그것을
        // 「쓰는 이름」으로 세어 멀쩡한 아홉 자리가 FAIL 했다 (2026-10-28)
        node.specifiers.forEach((sp) => declared.add(sp.local.name));
        return;
      case 'VariableDeclarator': namesOf(node.id, declared); break;
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        if (node.id) declared.add(node.id.name);
        (node.params || []).forEach((p) => namesOf(p, declared));
        break;
      case 'ClassDeclaration': if (node.id) declared.add(node.id.name); break;
      case 'CatchClause': if (node.param) namesOf(node.param, declared); break;
      case 'MetaProperty': return;      // `import.meta` — 이름이 아니다
      case 'ExportSpecifier': return;   // `export { x as default }`
      case 'ExportDefaultDeclaration':
        walkNode(node.declaration, node);
        return;
      case 'MethodDefinition':
      case 'PropertyDefinition':
        // 메서드 이름(`render` · `constructor`)은 이름이 아니다. 몸통만 본다
        walkNode(node.value, node);
        return;
      case 'Identifier': {
        // 칸 이름(`a.b` 의 b) · 객체 열쇠 · 이름표는 **쓰는 이름이 아니다**
        const isMember = parent && parent.type === 'MemberExpression' && parent.property === node && !parent.computed;
        const isKey = parent && (parent.type === 'Property' || parent.type === 'PropertyDefinition') && parent.key === node && !parent.computed;
        const isLabel = parent && (parent.type === 'LabeledStatement' || parent.type === 'BreakStatement' || parent.type === 'ContinueStatement');
        if (!isMember && !isKey && !isLabel) used.push(node.name);
        return;
      }
      default: break;
    }
    for (const k of Object.keys(node)) {
      if (k === 'type' || k === 'start' || k === 'end' || k === 'loc') continue;
      walkNode(node[k], node);
    }
  };
  walkNode(ast, null);

  for (const name of used) {
    seen += 1;
    if (declared.has(name) || GLOBALS.has(name)) continue;
    missing.push(rel + '  ' + name);
  }
}

console.log('     [' + tree.label + '] 파일 ' + files + '개 · 이름 쓰임 ' + seen + '개');
ok('  없는 이름을 쓰는 자리', [...new Set(missing)], []);
if (missing.length) {
  console.log('     ↑ 가져오거나 선언한다. **번들러는 이름이 있는지 안 본다** —');
  console.log('       열어봐야 터지고, 터지면 흰 화면이다');
}
}

// ── **안 쓰는 이름을 가져오는 자리** ── (2026-10-31)
//
// 위의 반대쪽이다. 선언 없이 쓰는 이름은 **열면 터지지만**, 가져오고 안 쓰는
// 이름은 아무 일도 안 난다 — 그래서 **아무도 안 본다.** 오늘 둘을 찾았다 —
// `AccountDeleteModal` 의 `toast`(옛 판에서 알리던 자리)와 홈트의 `tryLine`.
//
// 그 자체로는 해롭지 않지만 **읽는 사람을 속인다**: 「여기서 토스트를 띄우는구나」로
// 읽히고, `tryLine` 은 **「재보기 결과를 이 화면이 말하는구나」**로 읽힌다
// (실은 `RecoverTry` 가 말한다). 10/28 ⑬ 과 같은 결이다 — 만들고 아무도 안 부르는 것.
//
// **번들러는 걷어내 주지만** 코드는 그대로 남는다. 조각 크기가 아니라 **읽는 사람**의 일이다.
console.log('');
console.log('── 안 쓰는 이름을 가져오는 자리 ──');
{
  const B = '\\b';
  const 안쓰는것 = [];
  for (const tree of TREES) {
    for (const f of walk(tree.dir)) {
      const src = fs.readFileSync(f, 'utf8');
      // 가져오는 줄끼리는 서로를 쓰지 않는다 — 몸통만 본다
      const body = src.replace(/^import[^;]*?from[ ]+'[^']+';$/gm, '');
      for (const m of src.matchAll(/^import[ ]+[{]([^}]+)[}][ ]+from[ ]+'([^']+)';$/gm)) {
        for (const raw of m[1].split(',')) {
          const name = raw.includes(' as ') ? raw.split(' as ')[1].trim() : raw.trim();
          if (!name) continue;
          if (!new RegExp(B + name + B).test(body)) {
            안쓰는것.push(tree.label + '/' + path.relative(tree.dir, f).split(path.sep).join('/') + ' — ' + name);
          }
        }
      }
    }
  }
  ok('가져오고 안 쓰는 이름', 안쓰는것, []);
}
console.log('');
console.log(bad === 0 ? '모두 통과' : bad + '건 FAIL');
process.exit(bad === 0 ? 0 : 1);
