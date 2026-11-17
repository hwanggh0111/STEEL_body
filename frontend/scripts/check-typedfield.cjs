// **치는 칸을 같은 손으로 다듬는가** (2026-11-17 · 맵시).
//
//   npm run typed     (npm run check 에도 들어 있다)
//
// ── 왜 이 자가 생겼나 ──
//
// 정석이 넘긴 류의 UI 몫을 훑다가 **메일 칸에서** 나왔다 — 「같은 생김새가 여러
// 화면에 복붙되고 **한쪽만 고쳐진** 자리」.
//
// 11/03 에 `src/data/typedField.js` 를 세웠다. 까닭은 그 파일 머리글에 있다 —
// 눈에는 멀쩡한 ` kim@a.com ` 이 형식 자(`[^\s@]`)에 걸려 「올바른 이메일 형식이
// 아니에요」를 듣고, **사람은 보이지 않는 글자를 의심할 수 없다.** 그래서 저장할
// 때가 아니라 **칸이 받는 그 순간** 떼어내기로 했고, 가입 · 로그인 · 아이디
// 바꾸기 셋에 붙였다.
//
// **넷째 자리가 빠져 있었다** — `OauthEmailPage`(구글로 들어온 사람이 메일을
// 등록하는 화면)다. `onChange` 가 값을 그대로 담고 형식 자는 `trim()` 만 했다:
//
//   · 안쪽 공백(`kim @a.com` — 붙여넣기에 섞여 온다)은 **영영 안 떨어지고**
//     단추가 죽은 채로 남았다. 같은 값이 가입 화면에서는 통과한다
//   · 보내는 값은 `cleanEmailField(email)`(소문자 · 공백 없음)인데 화면은
//     「`Kim@A.com` 로 보냈어요」라고 적었다 — **화면과 서버가 다른 말**을 했다
//
// 그 화면 하나를 고치는 것으로는 다섯째가 또 온다. 그래서 **칸을 전수로 센다.**
//
// ── 무엇을 보는가 ──
//
// `@babel/parser` 로 JSX 를 파싱해 **`<input>` 전부**를 모은다. 그중 사람이 치는
// 메일 · 아이디 칸(아래 `메일칸`·`아이디칸`)은 `onChange` 가 **공용 손을 지나야**
// 한다. 숨긴 칸(`readOnly` · `aria-hidden` · `type="hidden"`)은 뺀다 — 비밀번호
// 관리자에게만 보이는 자리라 사람이 치지 않는다.
//
// 그리고 **화면이 제 손으로 다듬는 자리**를 막는다(`email.trim()` 같은 줄).
// 손이 두 벌이면 한쪽만 고치는 날이 오고, 그것이 바로 이번에 찾은 꼴이다.
//
// 손 이름은 `typedField.js` 에서 **읽는다** — 베껴 적으면 손이 하나 늘 때 자만
// 옛 목록을 본다(11/16 의 「자가 「지금」을 베끼면 거짓이 된다」 류).
//
//   node scripts/check-typedfield.cjs --되돌려   일부러 어긋낸 꼴 넷을 먹여 빨개지는지 본다

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

/** 공용 손 이름을 `typedField.js` 에서 읽는다 */
function 손이름() {
  const src = fs.readFileSync(path.join(SRC, 'data', 'typedField.js'), 'utf8');
  return [...src.matchAll(/export function (clean\w+Field)/g)].map((m) => m[1]);
}

/** JSX 속성 하나를 글자로 — 값이 식이면 그 식의 원문을 돌려준다 */
function attrText(a, code) {
  if (!a.value) return 'true';                       // `readOnly` 처럼 값 없는 것
  if (a.value.type === 'StringLiteral') return a.value.value;
  if (a.value.type === 'JSXExpressionContainer') {
    return code.slice(a.value.expression.start, a.value.expression.end);
  }
  return '';
}

function 칸모으기(code, file) {
  const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });
  const out = [];
  (function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n.type === 'JSXElement' && n.openingElement.name.name === 'input') {
      const attrs = {};
      for (const a of n.openingElement.attributes) {
        if (a.type !== 'JSXAttribute' || !a.name) continue;
        attrs[a.name.name] = attrText(a, code);
      }
      out.push({ file, line: n.loc.start.line, attrs });
    }
    for (const k of Object.keys(n)) {
      if (k === 'loc' || k === 'start' || k === 'end') continue;
      walk(n[k]);
    }
  }(ast));
  return out;
}

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.jsx')) files.push(p);
  }
}(SRC));

const 손 = 손이름();
console.log('── 다듬는 손 ──');
ok('`typedField.js` 에서 손 이름을 읽었다', 손.length >= 3, true);
console.log('       ' + 손.join(' '));

// ── 사람이 치는 메일 · 아이디 칸 전수 ──
const 칸 = [];
const 터진것 = [];
for (const f of files) {
  const rel = path.relative(SRC, f).split(path.sep).join('/');
  try {
    칸.push(...칸모으기(fs.readFileSync(f, 'utf8'), rel));
  } catch (e) {
    터진것.push(rel + ': ' + e.message.slice(0, 50));
  }
}
ok('모든 화면 파일이 파싱됐다', 터진것, []);

// ── 숨긴 칸만 뺀다 ──
//
// **`readOnly={making}` 처럼 조건부인 것은 빼지 않는다** (붙인 자리에서 잡았다).
// `PasswordResetModal` 의 메일 칸이 그 꼴인데 — 로그인한 사람이 비밀번호를
// **만드는** 때만 읽기 전용이고, **찾는** 때는 제 손으로 친다. 「`readOnly` 라는
// 글자가 있으면 숨은 칸」으로 세면 **사람이 치는 칸을 안 보게 된다.**
// 글자로 `true` 라고 적힌 것과 값 없는 것(`readOnly`)만 숨은 칸이다
const 늘읽기전용 = (v) => v === 'true';
const 숨은것 = (a) => 늘읽기전용(a.readOnly) || 늘읽기전용(a['aria-hidden']) || a.type === 'hidden';
// ── ★ **`autoComplete` 도 본다 — 모집단이 작으면 「전부 지난다」가 거짓이 된다** ──
// (2026-11-17 · 정석)
//
// 이 식이 `name` 만 보고 있었다. 그래서 **아이디 칸을 1곳만** 셌다 — 실제로 사람이
// 치는 아이디 칸은 셋이다(`LoginPage:408` 은 `readOnly` 라 빼는 것이 맞다):
//
//     RegisterPage.jsx:588    name="username"        ← 셌다
//     SettingsPage.jsx:811    autoComplete="username" · **`name` 이 없다**  ← 안 셌다
//
// `SettingsPage` 의 그 칸은 `typeId` → `cleanIdField` 를 **지난다.** 그러니 지금
// 사람에게 가는 피해는 없다. 문제는 **자가 그 칸을 아예 안 본다**는 것이다 —
// 다음에 누가 아이디 칸을 붙이고 다듬지 않으면 그 칸은 **조용히 통과한다.**
// 「치는 칸이 **전부** 공용 손을 지난다 → []」는 **세는 모집단이 맞을 때만** 참이다.
//
// 오늘 같은 자리를 세 번 만났다 — 자 0개인데 「모두 통과」 · 없는 깃발을 삼킴 ·
// 손상을 기대값으로 박음. **셈이 작은 것과 다 통과한 것은 말이 같아 보인다.**
//
// `autoComplete` 는 브라우저 자동완성 때문에 **빠뜨리기 어려운 속성**이라(빠지면
// 바로 눈에 띈다) `name` 보다 촘촘하다. 둘 중 하나라도 있으면 센다.
const 메일표 = (a) => a.type === 'email' || a.inputMode === 'email'
  || a.name === 'email' || a.autoComplete === 'email';
const 아이디표 = (a) => !메일표(a)
  && (a.name === 'username' || a.autoComplete === 'username');
// **아래 되돌려-FAIL 이 이 손을 부른다** — 베껴 적으면 식을 넓힐 때 **되돌려만 옛
// 식을 본다.** 실제로 그랬다: 11/17 에 `autoComplete` 를 더했는데 되돌려 쪽은
// `name` 만 보는 식을 제 안에 적어두고 있어서, 새로 박은 꼴 둘이 **안 걸렸다**
const 치는칸 = (r) => !숨은것(r.attrs) && (메일표(r.attrs) || 아이디표(r.attrs));
const 메일칸 = 칸.filter((r) => !숨은것(r.attrs) && 메일표(r.attrs));
const 아이디칸 = 칸.filter((r) => !숨은것(r.attrs) && 아이디표(r.attrs));

console.log('\n── 메일 · 아이디 칸이 그 손을 지나는가 ──');
ok('사람이 치는 메일 칸을 찾았다 (못 찾으면 자가 아무것도 안 본 것이다)', 메일칸.length >= 3, true);
console.log('       메일 칸 ' + 메일칸.length + '곳 · 아이디 칸 ' + 아이디칸.length + '곳');

// ── **한 칸 건너까지 본다** ── (붙인 자리에서 잡았다)
//
// `onChange={(e) => validateEmail(e.target.value)}` 처럼 **이름 붙인 손**으로
// 넘기는 자리가 있다(`RegisterPage` 의 메일 · 아이디 칸). 그 손 안에서 다듬는데도
// 「안 지난다」고 울면 **거짓 FAIL** 이다 — 자가 거짓이면 그날 판정이 오염된다.
// 그래서 `onChange` 안의 이름을 꺼내 **그 손의 몸통**까지 읽는다.
const 손몸통 = new Map();                       // 파일 → 전체 원문
const 원문of = (file) => {
  if (!손몸통.has(file)) 손몸통.set(file, fs.readFileSync(path.join(SRC, file), 'utf8'));
  return 손몸통.get(file);
};
const 건너서다듬나 = (r) => {
  const onChange = r.attrs.onChange || '';
  const src = 원문of(r.file);
  for (const m of onChange.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
    const 이름 = m[1];
    if (손.includes(이름)) return true;          // 그 자리에서 다듬는다
    // `const 이름 = (…) => {` 뒤 서른 줄 안에서 공용 손을 찾는다
    const 선언 = new RegExp(`(?:const|function)\\s+${이름}\\b`).exec(src);
    if (!선언) continue;
    const 몸통 = src.slice(선언.index, 선언.index + 2000);
    if (손.some((n) => 몸통.includes(n))) return true;
  }
  return false;
};

{
  const 안지나는것 = [];
  for (const r of [...메일칸, ...아이디칸]) {
    if (!건너서다듬나(r)) 안지나는것.push(r.file + ':' + r.line);
  }
  ok('치는 메일 · 아이디 칸이 **전부** 공용 손을 지난다', 안지나는것, []);
  if (안지나는것.length) {
    console.log('       → `onChange` 에서 `cleanEmailField` · `cleanIdField` 를 지나게 하세요.');
    console.log('         저장할 때 다듬는 것으로는 늦습니다 — 화면이 **치는 동안** 판단합니다.');
  }
}

// ── 화면이 제 손으로 다듬는 자리 ──
//
// `email.trim()` · `.toLowerCase()` 를 화면에서 또 하면 손이 두 벌이 된다.
// 보낼 때 공용 손을 한 번 더 부르는 것(`cleanEmailField(email)`)은 **센 쪽**이라 둔다
console.log('\n── 화면이 제 손으로 다듬는 자리 ──');
{
  const 제손 = [];
  for (const f of files) {
    const rel = path.relative(SRC, f).split(path.sep).join('/');
    const src = fs.readFileSync(f, 'utf8')
      .replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, '$1').replace(/^\s*\/\/.*$/gm, '');
    for (const m of src.matchAll(/\b(email|mail)\s*\.\s*(trim|toLowerCase)\s*\(/gi)) {
      제손.push(`${rel}: ${m[0]}`);
    }
  }
  ok('메일 값을 화면이 또 다듬지 않는다', 제손, []);
}

// ─────────────────────────────────────────────────────────────
if (process.argv.includes('--되돌려')) {
  console.log('\n── 되돌려-FAIL: 일부러 어긋낸 꼴을 먹인다 ──');
  const 꼴 = [
    {
      이름: '메일 칸이 값을 그대로 담으면 걸린다 (11/17 의 그 버그)',
      code: `const A = () => (<input name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />);`,
      기대: ['(되돌려):1'],
    },
    {
      이름: '공용 손을 지나면 안 걸린다 (거짓 FAIL 막이)',
      code: `const A = () => (<input name="email" type="email" value={email} onChange={(e) => setEmail(cleanEmailField(e.target.value))} />);`,
      기대: [],
    },
    {
      이름: '숨긴 칸은 안 센다 (비밀번호 관리자용 · 사람이 안 친다)',
      code: `const A = () => (<input name="username" autoComplete="username" value={email} readOnly aria-hidden="true" />);`,
      기대: [],
    },
    {
      이름: '조건부 `readOnly` 는 **사람이 치는 칸**이라 센다 (붙인 자리에서 잡았다)',
      code: `const A = () => (<input name="email" type="email" readOnly={making} value={email} onChange={(e) => setEmail(e.target.value)} />);`,
      기대: ['(되돌려):1'],
    },
    {
      이름: '`name` 없이 `autoComplete` 만 붙은 아이디 칸도 센다 (11/17 에 안 세던 자리)',
      code: `const A = () => (<input autoComplete="username" value={id} onChange={(e) => setId(e.target.value)} />);`,
      기대: ['(되돌려):1'],
    },
    {
      이름: '`autoComplete` 만 붙은 메일 칸도 센다',
      code: `const A = () => (<input autoComplete="email" value={m} onChange={(e) => setM(e.target.value)} />);`,
      기대: ['(되돌려):1'],
    },
    {
      이름: '아이디 칸도 같은 자로 본다',
      code: `const A = () => (<input name="username" value={id} onChange={(e) => setId(e.target.value)} />);`,
      기대: ['(되돌려):1'],
    },
  ];
  for (const t of 꼴) {
    const rows = 칸모으기(t.code, '(되돌려)');
    // **위 `치는칸` 을 부른다** — 식을 여기 또 적으면 되돌려만 옛 식을 본다
    const 볼것 = rows.filter(치는칸);
    const 난것 = 볼것
      .filter((r) => !손.some((n) => (r.attrs.onChange || '').includes(n)))
      .map((r) => r.file + ':' + r.line);
    ok(t.이름, 난것, t.기대);
  }
  const 다듬는줄 = [...'const x = email.trim();'.matchAll(/\b(email|mail)\s*\.\s*(trim|toLowerCase)\s*\(/gi)].map((m) => m[0]);
  ok('  화면이 또 다듬는 줄이 생기면 걸린다', 다듬는줄, ['email.trim(']);
}

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
