// 쓰는데 안 가져온 것이 있는가 — **흰 화면의 제일 흔한 원인.**
//
//   npm run imports
//
// 2026-09-02 에 고객센터가 흰 화면이 됐다. 제보함 825줄을 넷으로 나누면서
// `AskFirst.jsx` 를 떼어냈는데, **`useRef` 와 `client` 를 안 가져왔다.**
//
//   import { useState } from 'react';   // ← useRef 가 빠졌다
//   ...
//   const sentRef = useRef(new Set());  // ← 열자마자 여기서 터진다
//
// **빌드는 통과한다.** esbuild 는 없는 이름을 전역으로 보고 그대로 둔다 —
// 브라우저에서 그 줄에 닿는 순간 `useRef is not defined` 로 터진다.
//
// 부품을 떼어낼 때마다 나는 일이라, 글자로 잡는다. 두 가지를 본다.
//   1. **자주 쓰는 이름**(훅 · 길찾기 · client · toast …)을 쓰면서 안 가져왔는가
//   2. **JSX 로 그리는 대문자 이름**을 안 가져왔는가 (`<DayPlan />` 같은 것)
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// 주석과 글자열을 지운다. 「예전에는 useRef 를 썼다」 같은 기록까지 잡으면 안 된다
const stripped = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
  .replace(/'(?:[^'\\]|\\.)*'/g, "''")
  .replace(/"(?:[^"\\]|\\.)*"/g, '""')
  .replace(/`(?:[^`\\]|\\.)*`/g, '``');

// 이 이름을 쓰면 반드시 가져와야 한다
const MUST_IMPORT = [
  'useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'useLayoutEffect',
  'useReducer', 'useContext', 'createContext', 'lazy', 'Suspense', 'Component',
  'useNavigate', 'useLocation', 'useParams', 'useSearchParams', 'Outlet', 'Navigate', 'Link',
  'client', 'toast', 'confirmDialog', 'NavIcon',
];

function filesIn(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) filesIn(full, out);
    else if (/\.(jsx|js)$/.test(e.name)) out.push(full);
  }
  return out;
}

const files = filesIn(SRC);
const rel = (f) => path.relative(path.join(__dirname, '..'), f).replace(/\\/g, '/');

console.log('── 쓰는데 안 가져온 것 ──');

const missing = [];
const missingComp = [];
const missingConst = [];

for (const file of files) {
  const raw = fs.readFileSync(file, 'utf-8');
  const code = stripped(raw);
  // 가져온 이름들 + 이 파일 안에서 만든 이름들
  const imported = new Set();
  for (const m of raw.matchAll(/import\s+([\s\S]*?)\s+from\s+['"][^'"]+['"]/g)) {
    for (const n of m[1].replace(/[{}]/g, ' ').split(',')) {
      const name = n.trim().split(/\s+as\s+/).pop().trim();
      if (name) imported.add(name);
    }
  }
  const declared = new Set();
  for (const m of code.matchAll(/\b(?:function|class)\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  for (const m of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  // 풀어서 받는 것도 만든 것이다 — `const { default: client } = await import(...)` 처럼
  // **그 자리에서 가져오는** 자리가 있다 (관리자 보안 검사가 그렇게 쓴다)
  for (const m of code.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}\s*=/g)) {
    for (const n of m[1].split(',')) {
      const name = n.trim().split(':').pop().split('=')[0].trim();
      if (name) declared.add(name);
    }
  }
  for (const m of code.matchAll(/\b(?:const|let|var)\s*\[([^\]]*)\]\s*=/g)) {
    for (const n of m[1].split(',')) {
      const name = n.trim().split('=')[0].trim();
      if (name) declared.add(name);
    }
  }
  // 함수의 매개변수로 받은 것도 있다 (부품이 props 로 받는 이름들)
  for (const m of code.matchAll(/\(\s*\{([^}]*)\}/g)) {
    for (const n of m[1].split(',')) {
      const name = n.trim().split(/[:=]/)[0].trim();
      if (name) declared.add(name);
    }
  }

  // 1. 자주 쓰는 이름
  for (const name of MUST_IMPORT) {
    const used = new RegExp(`(?<![\\w$.])${name}\\s*[(<.]`).test(code);
    if (used && !imported.has(name) && !declared.has(name)) {
      missing.push(`${rel(file)} — ${name}`);
    }
  }

  // 2. JSX 로 그리는 대문자 이름
  for (const m of code.matchAll(/<([A-Z][\w$]*)/g)) {
    const name = m[1];
    if (!imported.has(name) && !declared.has(name)) missingComp.push(`${rel(file)} — <${name}>`);
  }

  // 3. **밑줄 대문자 상수** (2026-09-22 에 더했다)
  //
  // 위 둘은 **미리 적어둔 이름**만 본다. 그래서 9/22 에 `HOME_LAST_KEY` 를
  // 다른 파일로 옮기면서 가져오는 줄을 빠뜨린 것을 **못 잡았다** — 빌드는 통과하고
  // 홈트 화면을 여는 순간 터지는, 이 검사가 막으려던 바로 그 사고다.
  //
  // `GYM_KEY` · `PER_USER_KEYS` 처럼 **밑줄이 든 대문자 이름**만 본다. 이 모양은
  // 이 앱에서 늘 상수라서 오탐이 없다(자바스크립트 내장에는 이런 이름이 없다).
  //
  // 만든 자리는 **원문에서** 찾는다. `stripped()` 는 따옴표를 짝지어 지우는데,
  // 운동 이름이 수백 개 든 목록처럼 따옴표가 많은 파일에서는 짝이 어긋나 **멀쩡한
  // 줄까지 삼킨다**(`bodyPart.js` 의 `const N_RULES` 가 그렇게 사라졌다).
  // 여기서는 「만들었나」만 보므로 주석 속 `const` 를 세어도 해롭지 않다 —
  // 놓치는 쪽으로 틀리지, **없는 것을 있다고 하지 않는다.**
  for (const m of raw.matchAll(/\b(?:const|let|var|function|class)\s+([A-Z][A-Z0-9_]*)/g)) declared.add(m[1]);
  for (const m of code.matchAll(/(?<![\w$.'"])([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\s*(?![\w$:])/g)) {
    const name = m[1];
    if (!imported.has(name) && !declared.has(name)) missingConst.push(`${rel(file)} — ${name}`);
  }
}

ok('훅 · 길찾기 · client · toast 를 다 가져왔다', [...new Set(missing)], []);
ok('JSX 로 그리는 것을 다 가져왔다', [...new Set(missingComp)], []);
ok('대문자 상수도 다 가져왔다', [...new Set(missingConst)], []);

// ── 없어진 상태를 아직 부르는 자리 ── (2026-09-04)
//
// 5차 리모델링에서 아래 탭바의 「더보기」를 걷었다. `showMore` 상태를 지우고,
// 그것을 쓰던 곳도 지웠는데 **`handleTab` 첫 줄의 `setShowMore(false)` 하나가
// 남았다.** 빌드는 통과하고 화면도 잘 그려진다 — **탭을 누르는 순간** 터진다.
// 그래서 화면이 통째로 안 움직였다.
//
// 위의 두 검사도, 화면을 그려보는 `npm run screens` 도 이것을 못 잡는다:
// 그리기만 하고 **누르지는 않기 때문**이다. 눌러야 도는 코드는 글자로 볼 수밖에 없다.
//
// 규칙은 하나다 — `setXxx(` 를 부르면 그 파일 어딘가에 그 이름이 있어야 한다.
// `useState` 로 만들었거나, 프로퍼티로 받았거나, 가져왔거나, 그냥 함수로 만들었거나.
const SETTER_BUILTIN = new Set(['setTimeout', 'setInterval', 'setImmediate']);
const orphanSetters = [];
for (const file of files) {
  const code = stripped(fs.readFileSync(file, 'utf-8'));
  // **점 뒤엣것은 남의 것이다** — `localStorage.setItem` · `d.setHours` ·
  // `useNoteStore.getState().setOnline` 은 이 파일이 만드는 이름이 아니다.
  // 브라우저가 주는 것(setTimeout · setInterval)도 뺀다
  for (const m of code.matchAll(/(?<![.\w$])(set[A-Z][\w$]*)\s*\(/g)) {
    const name = m[1];
    if (SETTER_BUILTIN.has(name)) continue;
    // 만들어진 자리가 있는가. useState 짝 · const/let · function · 프로퍼티 · 가져오기
    const made = new RegExp(
      '(,\\s*' + name + '\\s*\\]'          // const [x, setX] = useState()
      + '|\\b(const|let|var|function)\\s+' + name + '\\b'
      + '|\\b' + name + '\\s*[,}:]'          // { setX } 로 받았거나 { setX, ... }
      + '|\\b' + name + '\\s*=[^=]'          // setX = ...
      + ')'
    );
    if (!made.test(code)) orphanSetters.push(`${rel(file)} — ${name}()`);
  }
}
ok('없어진 상태를 아직 부르는 자리가 없다', [...new Set(orphanSetters)], []);

console.log('');
console.log(bad ? `${bad}건 실패` : '다 가져왔습니다');
process.exit(bad ? 1 : 0);
