// **닿을 수 있는 화면인가, 그리고 거기 서면 내가 어디인지 아는가** (2026-09-19).
//
//   npm run reach     (npm run check 에도 들어 있다)
//
// 9/19 에 앱 구성을 기계로 훑다가 둘이 나왔다 —
//
//   1. **가는 길이 하나도 없는 화면이 셋 있었다** (`/workout` · `/inbody` · `/measure`).
//      링크를 걷을 때 라우트를 남겼는데, 그러면 화면은 계속 살아 있다. 옛 기록
//      화면(929줄)은 「운동」과 **같은 일을 하는 두 벌째 구현**이었고, 그 안에만 있던
//      「종목별 최고 기록」은 **앱 어디에서도 볼 수 없게 됐다** — 기능 하나가 조용히
//      사라진 것이다. 화면을 걷을 때 그 안에 뭐가 같이 묻히는지는 눈에 안 보인다
//   2. **아래 탭 다섯 칸이 하나도 안 켜지는 화면이 넷 있었다** (`/goal` · `/map` ·
//      `/search` · `/homeworkout`). 그 자리에 선 사람은 자기가 어디 있는지 알 수 없고
//      옆으로 건너갈 실마리도 없다 — 뒤로 가기밖에 없다
//
// 둘 다 **화면을 열어보면 멀쩡해 보인다.** 그래서 눈으로는 안 잡힌다.
const fs = require('fs');
const path = require('path');

const read = (f) => fs.readFileSync(f, 'utf-8');
// 주석이 검사를 통과시키면 안 된다 (check-nav.cjs 와 같은 규칙)
const codeOf = (s) => s
  .replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, '$1')
  .replace(/^\s*\/\/.*$/gm, '');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const app = codeOf(read('src/App.jsx'));
const tabbar = codeOf(read('src/components/TabBar.jsx'));
const nav = codeOf(read('src/data/navItems.js'));

// ── 앱 안의 모든 파일을 한 번 읽어 둔다 ──
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.jsx?$/.test(e.name)) files.push(p);
  }
})('src');
const sources = new Map(files.map((f) => [f.split(path.sep).join('/'), codeOf(read(f))]));

/**
 * `<Route path="x" element={…} />` 를 모은다. 넘기는 것(Navigate)인지도 같이 본다.
 *
 * **한 줄로 적힌 것만 본다.** 라우트 하나가 여러 줄로 늘어지면 `el` 이 비고, 아래
 * 「넘기는가」 검사가 그 자리에서 실패한다 — 조용히 통과하는 것보다 그게 낫다.
 * (처음엔 `element=\{([^]]*?)\}` 로 한 번에 잡으려 했는데, 자바스크립트에서 `[^]]` 은
 *  「무엇이든」 다음에 `]` 하나다 — 아무 라우트도 안 걸려서 **검사 전체가 빈 목록을
 *  보고 통과했다.** 검사가 조용히 아무것도 안 보는 것이 제일 나쁘다.)
 */
const routes = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => {
  const nl = app.indexOf('\n', m.index);
  return { p: m[1], el: app.slice(m.index, nl === -1 ? app.length : nl) };
}).filter((r) => r.p !== 'index' && r.p !== '*');
// **아무것도 안 걸리면 그 자리에서 멈춘다.** 위의 `[^]]` 사고가 그랬다 —
// 빈 목록을 보고 모든 줄이 통과했다. 검사가 조용히 눈을 감는 것이 제일 나쁘다
if (routes.length < 10) {
  console.log('FAIL 라우트를 못 읽었다 (App.jsx 를 읽는 규칙이 깨졌다) → ' + routes.length + '개');
  process.exit(1);
}

// 껍데기(Layout) 안에 있는 자리만 본다 — `/site` · `/login` · `/register` 는 탭바가 없다
const OUTSIDE = ['/site', '/login', '/register'];
const inApp = routes
  .map((r) => ({ ...r, url: r.p.startsWith('/') ? r.p : '/' + r.p }))
  .filter((r) => !OUTSIDE.includes(r.url));

console.log('── 가는 길이 있는 화면인가 ──');
// 화면을 그리는 라우트(넘기는 것이 아닌 것)는 **앱 안에서 누가 데려다줘야 한다**
const tabPaths = [...tabbar.matchAll(/path: '(\/[a-z/]+)'/g)].map((m) => m[1]);
const drawerPaths = [...nav.matchAll(/path: '(\/[a-z/]+)'/g)].map((m) => m[1]);
const linked = (url) => {
  if (tabPaths.includes(url) || drawerPaths.includes(url)) return true;
  // 화면 코드 어디에서든 그 주소로 보내는 줄이 있는가 (navigate · to= · href=)
  for (const [f, src] of sources) {
    if (f === 'src/App.jsx') continue;
    if (new RegExp("['\"`]" + url + "(?:[?'\"`]|/)").test(src)) return true;
  }
  return false;
};
const renders = inApp.filter((r) => !/Navigate/.test(r.el));
const unreachable = renders.filter((r) => !linked(r.url)).map((r) => r.url);
ok('가는 길이 없는데 살아 있는 화면', unreachable, []);

console.log('');
console.log('── 옛 주소는 살아 있고, 지금 자리로 넘기는가 ──');
// 주소를 아예 없애면 북마크 · 폰 홈 화면 바로가기 · 옛 PWA 캐시가 빈 화면을 본다.
// 그래서 **주소는 남기고 넘긴다** (2026-09-19)
for (const [url, to] of [['/workout', '/train'], ['/inbody', '/body'], ['/measure', '/body']]) {
  const r = inApp.find((x) => x.url === url);
  ok('주소가 살아 있다 (' + url + ')', Boolean(r), true);
  ok('  ' + to + ' 로 넘긴다', Boolean(r && r.el.includes('Navigate') && r.el.includes('to="' + to + '"')), true);
}
// 인바디 · 재는 도구는 「몸」의 갈래다. 갈래까지 안 주면 「재는 도구」를 북마크한
// 사람이 인바디를 본다
ok('인바디는 인바디 갈래로 넘긴다', /path="inbody"[\s\S]{0,140}tab: 'inbody'/.test(app), true);
ok('재는 도구는 그 갈래로 넘긴다', /path="measure"[\s\S]{0,140}tab: 'measure'/.test(app), true);
// 지운 화면이 되살아나면 안 된다 — 같은 일을 하는 두 벌째가 다시 생기는 자리다
ok('옛 기록 화면 파일이 없다', fs.existsSync('src/pages/WorkoutPage.jsx'), false);
ok('  그 화면만 쓰던 부품도 없다 (RoutineRun)', fs.existsSync('src/components/RoutineRun.jsx'), false);

console.log('');
console.log('── 그 자리에 서면 내가 어디인지 아는가 ──');
// 탭 밖에서 열리는 화면은 **자기를 열어준 탭을 켠다.** 서랍 화면은 예외다 —
// 그쪽은 머리의 내 계정과 PC 사이드바에서 자기 줄이 켜진다
const parentOf = Object.fromEntries(
  [...tabbar.matchAll(/'(\/[a-z]+)':\s*'(\/[a-z]+)'/g)].map((m) => [m[1], m[2]]),
);
const homeless = renders
  .map((r) => r.url)
  .filter((url) => url !== '/'
    && !tabPaths.includes(url)
    && !drawerPaths.includes(url)
    && !parentOf[url]
    && !drawerPaths.some((d) => url.startsWith(d + '/')));   // /support/notices 같은 하위 자리
ok('탭도 서랍도 안 켜지는 화면', homeless, []);
// 켜라고 적어둔 부모가 **실제로 탭에 있는 칸**이어야 한다
ok('  적어둔 부모가 다 실제 탭이다',
  Object.values(parentOf).filter((t) => !tabPaths.includes(t)), []);
ok('  「오늘」의 자식 둘 (목표 · 몸 지도)', [parentOf['/goal'], parentOf['/map']], ['/home', '/home']);
ok('  「운동」의 자식 둘 (검색 · 기능성운동)', [parentOf['/search'], parentOf['/homeworkout']], ['/train', '/train']);

console.log('');
console.log('── 화면을 걷을 때 같이 묻힌 것이 없는가 ──');
// 「종목별 최고 기록」이 정확히 그렇게 사라졌다 — 9/18 에 옛 기록 화면을 길찾기에서
// 걷으면서, 그 화면에만 붙어 있던 표가 같이 닿을 수 없게 됐다.
// **부품은 닿을 수 있는 화면에서 쓰여야 한다**
const usedIn = (name) => [...sources]
  .filter(([f, src]) => !f.endsWith('/' + name + '.jsx') && new RegExp("from '[^']*" + name + "'").test(src))
  .map(([f]) => f);
const reachableScreens = new Set(
  renders.map((r) => r.url).filter((url) => linked(url) || parentOf[url]),
);
const screenFileOf = (f) => f.replace(/^src\/pages\//, '').replace(/\.jsx$/, '');
const urlOfScreen = (f) => '/' + screenFileOf(f).toLowerCase().replace(/page$/, '');
for (const part of ['BestRecords', 'WorkoutCard', 'YearWall', 'WeightChart']) {
  const places = usedIn(part);
  // 쓰는 자리가 화면이면 그 화면에 닿을 수 있어야 한다. 부품이 부품을 쓰는 것은
  // 여기서 안 따진다 — 그 부품을 쓰는 화면이 이 목록에서 걸린다
  const alive = places.filter((f) => !f.startsWith('src/pages/') || reachableScreens.has(urlOfScreen(f)));
  ok(part + ' 가 닿을 수 있는 자리에서 쓰인다', alive.map((f) => f.replace('src/', '')).length > 0, true);
  // 묻힌 자리(닿을 수 없는 화면)에만 있으면 여기서 그 목록이 뜬다
  ok('  묻힌 화면에만 있지 않다', places.filter((f) => !alive.includes(f)).map((f) => f.replace('src/', '')), []);
}
// 최고 기록은 「기록 → 통계」에 있다 (9/19 에 여기로 옮겼다)
ok('최고 기록이 「기록」 화면에 있다', /BestRecords/.test(sources.get('src/pages/HistoryPage.jsx')), true);

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
