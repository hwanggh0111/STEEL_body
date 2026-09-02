// 화면이 **그려지기는 하는가** — 흰 화면 잡기.
//
//   npm run screens
//
// 2026-09-02 에 히스토리 화면이 흰 화면이 됐다. 계획을 빚는 `const` 를 그것이 읽는
// `ym` **위에** 뒀는데, `const` 는 선언 줄에 닿기 전에는 못 읽는다(TDZ).
//
//   const missed = useMemo(() => ...ym..., [ym]);   // ← 여기서 터진다
//   const [ym, setYm] = useState(...);              // ← 선언은 아래
//
// **빌드는 통과한다.** 검사도 통과했다 — 글자를 찾는 검사들은 이런 것을 못 잡는다.
// 화면을 열어야 터지고, 터지면 에러 경계가 「새로고침해 주세요」를 띄운다.
//
// 그래서 **화면을 실제로 한 번 그려본다.** 브라우저 없이 `react-dom/server` 로 그린다
// (8/31 에 그래프를 그렇게 봤고, 9/1 에 로고를 그렇게 봤다).
//
// **여기서 보는 것은 딱 하나다 — 터지지 않는가.** 무엇이 그려지는지는 다른 검사가 본다.
// effect 는 서버 렌더에서 안 돌기 때문에 네트워크도 안 나간다.
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

// 브라우저에만 있는 것들. 없으면 모듈을 읽는 순간 터진다
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
global.window = {
  localStorage: global.localStorage,
  matchMedia: global.matchMedia,
  location: { href: '', pathname: '/', search: '' },
  addEventListener() {}, removeEventListener() {},
  navigator: { userAgent: 'check' },
};
global.document = {
  documentElement: { style: { setProperty() {} }, classList: { add() {}, remove() {} } },
  addEventListener() {}, removeEventListener() {},
  createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
  body: { appendChild() {}, removeChild() {} },
  querySelector: () => null,
};
global.navigator = { userAgent: 'check', onLine: true };

const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { MemoryRouter } = require('react-router-dom');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// 화면 하나를 그려본다. 터지면 그 자리에서 무엇이 터졌는지 적는다
function draw(file) {
  const out = path.join(__dirname, '..', '.screen.cjs');
  // 서버 렌더는 `useLayoutEffect` 를 볼 때마다 경고를 찍는다 — 여기서는 당연한 일이라
  // (브라우저에서만 도는 것이다) 화면마다 스무 줄씩 쌓인다. 그동안만 막는다
  const realError = console.error;
  const realWarn = console.warn;
  console.error = () => {};
  console.warn = () => {};
  try {
    esbuild.buildSync({
      entryPoints: [path.join(__dirname, '..', file)],
      bundle: true, format: 'cjs', outfile: out, platform: 'node', jsx: 'automatic',
      external: ['react', 'react-dom', 'react-router-dom'],
      // vite 가 넣어주는 값이다. node 에는 없으므로 빈 것으로 둔다
      define: { 'import.meta.env': '{}' },
      logLevel: 'silent',
    });
    const mod = require(out);
    const Page = mod.default || mod;
    renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Page)));
    return null;
  } catch (e) {
    return e.message.split('\n')[0];
  } finally {
    console.error = realError;
    console.warn = realWarn;
    if (fs.existsSync(out)) fs.unlinkSync(out);
    delete require.cache[out];
  }
}

console.log('── 화면이 터지지 않고 그려지는가 ──');
// 로그인해야 열리는 화면들이다. 서버 렌더에서는 effect 가 안 돌아 비어 있는 채로
// 그려진다 — **그 상태에서도 안 터져야 한다.** 처음 열 때가 정확히 그 상태다
const SCREENS = [
  ['홈', 'src/pages/HomePage.jsx'],
  ['기록', 'src/pages/WorkoutPage.jsx'],
  ['히스토리', 'src/pages/HistoryPage.jsx'],
  ['루틴', 'src/pages/RoutinePage.jsx'],
  ['인바디', 'src/pages/InbodyPage.jsx'],
  ['비교', 'src/pages/ComparePage.jsx'],
  ['측정', 'src/pages/MeasurePage.jsx'],
  ['기능성운동', 'src/pages/HomeworkoutPage.jsx'],
  ['운동 검색', 'src/pages/SearchPage.jsx'],
  ['고객센터', 'src/pages/support/SupportPage.jsx'],
  ['운동 알림', 'src/pages/RemindersPage.jsx'],
  ['로그인', 'src/pages/LoginPage.jsx'],
  ['회원가입', 'src/pages/RegisterPage.jsx'],
];

for (const [name, file] of SCREENS) {
  ok(`${name} 화면이 그려진다`, draw(file), null);
}

console.log('');
console.log(bad ? `${bad}건 실패` : '전부 그려집니다');
process.exit(bad ? 1 : 0);
