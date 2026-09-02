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
}

ok('훅 · 길찾기 · client · toast 를 다 가져왔다', [...new Set(missing)], []);
ok('JSX 로 그리는 것을 다 가져왔다', [...new Set(missingComp)], []);

console.log('');
console.log(bad ? `${bad}건 실패` : '다 가져왔습니다');
process.exit(bad ? 1 : 0);
