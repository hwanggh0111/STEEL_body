// **훅이 이른 반환 뒤에 있으면 그 화면은 쓰는 사람에게만 터진다** (2026-11-19 · 정석 2차)
//
//   npm run hooks
//   node scripts/check-hooks.cjs --되돌려     일부러 어긋낸 꼴 넷을 먹여 본다
//
// ── 왜 이 자가 생겼나 ──
//
// 11/19 에 지문 잠금(⑤)이 붙으면서 `AppLock.jsx` 의 훅 **넷**이 `return null` **뒤**에
// 놓였다. 그러면 React 는 길마다 훅 수가 달라진 것을 보고 **그 자리에서 터뜨린다** —
//
//     잠겨 있을 때   훅 14개
//     안 잠겼을 때   훅 10개  (`return null` 에서 끊긴다)
//
// `AppLock` 은 `App.jsx` 에 **늘 붙어 있고**, `locked` 는 앱을 덮었다 돌아올 때
// `maybeLock()` 으로 **그 자리에서** 켜진다. 즉 **잠금이 뜨는 순간**(10 → 14)과
// **푸는 순간**(14 → 10) 양쪽에서 터진다 —
// 「Rendered more/fewer hooks than during the previous render」.
//
// ★ **왜 아무도 못 봤나** — 잠금을 **안 쓰는** 사람에게는 늘 `return null` 이라 훅 수가
// 한결같다. 그래서 검사 110개도 빌드도 멀쩡했다. **그 기능을 켠 사람에게만** 터지는
// 꼴이고, 그 사람은 **잠금 화면 대신 오류 화면**을 본다(터진 글이 낡은 조각 꼴이
// 아니라 `ErrorBoundary` 가 저절로 새로 받지도 않는다).
//
// 이 저장소에는 eslint 가 없다. `react-hooks/rules-of-hooks` 가 잡아줄 것을
// **아무도 안 보고 있었다** — 그래서 이 자를 세운다.
//
// ── 무엇을 보는가 ──
//
//   ⑴ 컴포넌트(대문자로 시작하는 함수) 안에서 **몸통 바로 아래의 `if (…) return`** 뒤에
//      훅을 부르는 자리
//   ⑵ **모집단이 0 이면 그것이 실패다** — 훅을 부르는 컴포넌트를 하나도 못 찾았으면
//      걷는 손이 깨진 것이다 (셈 0 은 통과가 아니다)
//   ⑶ 되돌려 — 어긋난 꼴 넷을 먹여 **잡는지** 본다. 못 잡으면 이 자는 장식이다
//
// 글자를 세는 자다. 화면을 띄워서는 못 본다 — **그 기능을 켠 사람**이 되어야 보인다.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// 훅 이름 — React 의 것과 **이 앱이 쓰는 꼴**(`use…Store` · 라우터)을 함께 본다
const 훅이름 = /\b(use[A-Z]\w*)\s*\(/;

/** 주석을 지운 줄 배열 — 주석 속 `return` 에 속지 않는다 */
function 코드줄(글) {
  let 주석안 = false;
  return 글.split('\n').map((l) => {
    const t = l.trim();
    const 열림 = l.lastIndexOf('/*');
    const 닫힘 = l.lastIndexOf('*/');
    const 이줄 = 주석안;
    if (열림 >= 0 && 열림 > 닫힘) 주석안 = true;
    else if (닫힘 >= 0 && 닫힘 > 열림) 주석안 = false;
    if (이줄 || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return '';
    const i = l.indexOf('//');
    return i >= 0 ? l.slice(0, i) : l;
  });
}

/**
 * 한 파일에서 「이른 반환 뒤의 훅」을 찾는다.
 * @returns {{컴포넌트:string, 이른반환:number, 훅줄:number, 글:string}[]}
 */
function 훑기(이름, 글) {
  const L = 코드줄(글);
  const 걸린것 = [];
  let 안 = null;
  let 훅셈 = 0;
  L.forEach((l, i) => {
    const 머리 = /^(?:export\s+default\s+)?(?:export\s+)?function\s+([A-Z]\w*)\s*\(/.exec(l)
      || /^(?:export\s+)?const\s+([A-Z]\w*)\s*=\s*(?:\([^)]*\)|\w+)\s*=>/.exec(l);
    if (머리) { 안 = { 이름: 머리[1], 이른반환: null }; return; }
    if (!안) return;
    if (/^\}/.test(l)) { 안 = null; return; }
    // 몸통 **바로 아래**(들여쓰기 두 칸)의 `if (…) return …` — 중첩된 것은 길이 아니다
    if (안.이른반환 === null && /^ {2}if\s*\(.*\)\s*return\b/.test(l)) 안.이른반환 = i + 1;
    // 훅 부르기 — 들여쓰기 두 칸(컴포넌트 몸통)에서 부른 것만 본다.
    // 콜백 안(`() => { useX() }`)은 더 깊이 들어가 있고, 그건 다른 이야기다
    const 훅인가 = /^ {2}(?:const|let|var)\s+.*=\s*use[A-Z]/.test(l) || /^ {2}use[A-Z]\w*\s*\(/.test(l);
    if (훅인가) {
      훅셈 += 1;
      if (안.이른반환 !== null) {
        const m = 훅이름.exec(l);
        걸린것.push({
          파일: 이름, 컴포넌트: 안.이름, 이른반환: 안.이른반환, 훅줄: i + 1,
          훅: m ? m[1] : '?', 글: l.trim().slice(0, 70),
        });
      }
    }
  });
  return { 걸린것, 훅셈 };
}

const 파일들 = (d, out = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) 파일들(p, out);
    else if (/\.jsx?$/.test(e.name)) out.push(p);
  }
  return out;
};

// ── `--먹여 <파일>` — **그 판 하나**만 먹여 본다 ── (2026-11-19 · 정석)
//
// 되돌려를 **누구나 재현할 수 있게** 둔다. 고치기 전 판을 떠서 먹이면 그 자리가
// 보인다 — `git show b98547e:frontend/src/components/AppLock.jsx > /tmp/전.jsx`
// 한 뒤 `npm run hooks -- --먹여 /tmp/전.jsx`. 「고쳤다」는 말 대신 **그 꼴에서 울고
// 지금 꼴에서 안 우는 것**이 증거다
{
  const i = process.argv.indexOf('--먹여');
  if (i > 0 && process.argv[i + 1]) {
    const p = process.argv[i + 1];
    const r = 훑기(path.basename(p), fs.readFileSync(p, 'utf8'));
    console.log('── 먹인 판: ' + p + ' ──');
    console.log('   훅 부르기 ' + r.훅셈 + '곳 · 이른 반환 뒤 ' + r.걸린것.length + '곳');
    for (const x of r.걸린것) {
      console.log(`   ${x.훅줄}행 ${x.훅}  (${x.컴포넌트}, 이른 반환 ${x.이른반환}행)`);
    }
    process.exit(r.걸린것.length ? 1 : 0);
  }
}

console.log('── 훅이 이른 반환 뒤에 있는 자리 ──');
let 훅쓰는파일 = 0;
let 훅모두 = 0;
const 걸린것 = [];
for (const f of 파일들(SRC)) {
  const r = 훑기(path.relative(SRC, f).replace(/\\/g, '/'), fs.readFileSync(f, 'utf8'));
  if (r.훅셈) { 훅쓰는파일 += 1; 훅모두 += r.훅셈; }
  걸린것.push(...r.걸린것);
}

// **셈 0 은 통과가 아니다** — 걷는 손이 깨지면 「0곳」이 통과처럼 보인다
ok('훅을 부르는 컴포넌트를 찾았다 (셈 0 은 통과가 아니다)', 훅쓰는파일 > 0 && 훅모두 > 20, true);
console.log(`       훅을 부르는 파일 ${훅쓰는파일}개 · 훅 부르기 ${훅모두}곳`);

ok('이른 반환 **뒤**에 훅이 없다', 걸린것.map((r) => `${r.파일}:${r.훅줄}(${r.훅})`), []);
if (걸린것.length) {
  for (const r of 걸린것) {
    console.log(`       ${r.파일}:${r.훅줄}  ${r.컴포넌트} — 이른 반환이 ${r.이른반환}행에 있다`);
    console.log(`         ${r.글}`);
  }
  console.log('       → 길마다 훅 수가 달라진다. React 가 **그 자리에서 터뜨린다**.');
  console.log('         훅을 전부 이른 반환 **위**로 올리고, 조건은 훅 **안**에서 본다.');
}

// ── 되돌려 FAIL ──
if (process.argv.includes('--되돌려')) {
  console.log('');
  console.log('── 되돌려 FAIL — 어긋낸 꼴을 먹인다 ──');
  const 꼴 = [
    ['이른 반환 뒤의 `useState` 를 잡는다',
      훑기('가짜.jsx', 'export default function X() {\n  const a = useStore();\n  if (!a) return null;\n  const [b, setB] = useState(0);\n  return b;\n}').걸린것.length, 1],
    ['이른 반환 뒤의 `useEffect` 를 잡는다',
      훑기('가짜.jsx', 'export default function X() {\n  if (!a) return null;\n  useEffect(() => {}, []);\n  return 1;\n}').걸린것.length, 1],
    ['  훅이 **위에** 있으면 안 잡는다',
      훑기('가짜.jsx', 'export default function X() {\n  const [b, setB] = useState(0);\n  if (!b) return null;\n  return b;\n}').걸린것.length, 0],
    ['  **주석 속** `return` 에 속지 않는다',
      훑기('가짜.jsx', 'export default function X() {\n  // if (!a) return null;\n  const [b, setB] = useState(0);\n  return b;\n}').걸린것.length, 0],
    ['  소문자 함수(컴포넌트가 아니다)는 안 센다',
      훑기('가짜.js', 'function 고르기(a) {\n  if (!a) return null;\n  const b = useless(a);\n  return b;\n}').걸린것.length, 0],
  ];
  let 샌것 = 0;
  for (const [이름, 받은것, 기대] of 꼴) {
    const 집었다 = 받은것 === 기대;
    if (!집었다) { 샌것 += 1; bad += 1; }
    console.log((집었다 ? 'OK   잡는다: ' : 'FAIL 샌다  : ') + 이름 + ' → ' + 받은것
      + (집었다 ? '' : ' (기대: ' + 기대 + ')'));
  }
  console.log(샌것 ? '  ↑ **어긋낸 꼴을 못 집었다.** 이 자는 장식이다'
    : '  어긋낸 꼴 ' + 꼴.length + '개를 다 집었다');
}

console.log('');
console.log('── 시계를 거는 효과의 의존에 손이 들어 있나 ── (2026-11-24 · 정석 2차)');
// 11/23 이 `useModalFocus` 에서 **「닫는 손은 들고만 있는다」**로 고친 그 판단이다.
// 부르는 쪽은 거의 다 `onDone={() => …}` 처럼 **그릴 때마다 새 손**을 준다. 그것을
// 효과의 의존에 두면 주인이 다시 그릴 때마다 정리 → 다시 돈다.
//
// 듣는 손을 다시 붙이는 효과는 그래도 **결함이 아니다**(붙였다 떼는 값이 같다).
// **시계를 거는 효과는 다르다** — 지웠다 처음부터 다시 걸므로 **끝이 계속 밀리고**,
// 주인이 시계보다 자주 그려지면 **영영 안 끝난다.** 11/24 에 그 꼴 둘을 찾았다 —
// `MiniSplash`(450ms · 부르는 세 자리가 다 새 손) · `SplashScreen`(3.2초 · 로그인 뒤
// 홈으로 넘어가는 그 길). 둘 다 멈추면 **사람이 화면에 갇힌다.**
//
// 그래서 **시계가 든 효과만** 보고, 그 의존에 `on*` 꼴 이름이 있으면 운다.
// 식을 거의 안 쓴다 — 11/24 에 셸이 역슬래시를 먹어 다른 자의 과녁이 깨진 채
// 「전부 통과」가 났다. 글자 자리로 자른다.
const 시계 = ['setTimeout(', 'setInterval(', 'requestAnimationFrame('];
const 손이름꼴 = /^on[A-Z]/;
const 시계효과 = { 센것: 0 };
const 손을의존에둔것 = [];
for (const f of 파일들(SRC)) {
  if (!f.endsWith('.jsx') && !f.endsWith('.js')) continue;
  const code = fs.readFileSync(f, 'utf8');
  let at = 0;
  for (;;) {
    const s = code.indexOf('useEffect(() => {', at);
    if (s < 0) break;
    at = s + 10;
    // 중괄호 깊이로 효과의 몸을 떠낸다 — 식으로 자르면 안쪽 `}` 에서 끊긴다
    let i = code.indexOf('{', s + 'useEffect(('.length);
    let depth = 0;
    let quote = null;
    for (; i < code.length; i += 1) {
      const c = code[i];
      if (quote) { if (c === quote && code[i - 1] !== String.fromCharCode(92)) quote = null; continue; }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
      if (c === '{') depth += 1;
      else if (c === '}') { depth -= 1; if (depth === 0) break; }
    }
    const 몸 = code.slice(s, i);
    if (!시계.some((t) => 몸.includes(t))) continue;
    // 몸이 끝난 뒤의 `, [ … ]);` 가 의존이다
    const 뒤 = code.slice(i, i + 400);
    const a = 뒤.indexOf('[');
    const b = 뒤.indexOf(']');
    if (a < 0 || b < a) continue;        // 의존을 안 준 효과 — 매번 도는 것이 뜻이다
    시계효과.센것 += 1;
    const 들 = 뒤.slice(a + 1, b).split(',').map((x) => x.trim()).filter(Boolean);
    const 손 = 들.filter((d) => 손이름꼴.test(d));
    if (손.length === 0) continue;
    const 줄 = code.slice(0, s).split('\n').length;
    손을의존에둔것.push(path.relative(ROOT, f).split(path.sep).join('/') + ':' + 줄 + ' [' + 손.join(' ') + ']');
  }
}
// 0건은 통과가 아니다 — 센 효과가 0 이면 이 자가 눈이 먼 것이다
ok('시계를 거는 효과를 실제로 세었다', 시계효과.센것 > 5, true);
console.log('     시계가 든 효과 ' + 시계효과.센것 + '개');
ok('그중 의존에 손을 둔 것이 없다', 손을의존에둔것, []);

console.log('');
console.log(bad ? bad + '건 실패' : '전부 통과');
process.exit(bad ? 1 : 0);
