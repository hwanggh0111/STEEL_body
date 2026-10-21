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

// 껍데기(Layout) 안에 있는 자리만 본다 — `/site` · `/login` · `/register` 는 탭바가 없다.
// `/oauth/email` 도 그 부류다 (2026-10-07) — **아직 계정이 없는 사람**이 보는 화면이라
// 탭도 서랍도 켜질 수 없다. 인스타 · X 는 메일 주소를 주지 않아서, 그 둘로 들어온
// 사람에게 메일을 한 번 묻는 자리다. 데려다주는 것은 앱이 아니라 **서버의 콜백**이다
// `/privacy` 도 그 부류다 (2026-10-09) — **플레이스토어가 아무나 열 수 있는
// 방침 주소를 요구한다.** 로그인 뒤에 두면 심사자가 못 열어 그 자리에서 반려된다
const OUTSIDE = ['/site', '/login', '/register', '/oauth/email', '/privacy'];
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

// ── 들여왔는데 **라우트가 없는** 화면 ── (2026-10-21)
//
// 위의 검사는 **라우트가 있는 화면만** 본다. 그래서 라우트가 아예 없으면 목록에
// 안 들어오고 **조용히 통과한다** — 그 눈먼 자리에 `IntroPage` 가 들어가 있었다.
// `App.jsx` 가 `lazy(() => import('./pages/IntroPage'))` 로 들여오기까지 하고
// `<Route>` 만 안 걸어서, 소개 화면(308줄)은 **앱 어디에서도 열 수 없었다.**
// 고객센터의 단추는 `/home?v=about` 으로 보냈고 그 물음표를 읽는 자리는 없었다.
//
// 들여온 것은 **쓰려고 들여온 것**이다. 안 쓸 것이면 줄을 지우는 게 맞다 —
// 들여온 채로 두면 조각만 커지고, 무엇보다 **있는 줄 알게 된다.**
{
  const imported = [...app.matchAll(/lazy\(\(\) => import\('\.\/(pages\/[\w/]+)'\)\)/g)]
    .map((m) => m[1]);
  // 아무것도 안 걸리면 멈춘다 (이 파일이 거듭 배운 것이다)
  ok('App.jsx 가 들여오는 화면을 찾았다', imported.length >= 10, true);
  const routeEls = [...app.matchAll(/<Route\s[^>]*element=\{<(\w+)/g)].map((m) => m[1]);
  const nameOf = (p) => p.split('/').pop();
  ok('  들여왔는데 라우트가 없는 화면',
    imported.filter((p) => !routeEls.includes(nameOf(p))), []);
}

// ── **스토어의 손 가운데 화면에서 아무도 안 부르는 것** ── (2026-10-21)
//
// 아래의 「화면을 걷을 때 같이 묻힌 것이 없는가」는 **부품(.jsx)** 만 본다.
// 그래서 **스토어의 손과 서버의 길**은 안 봤고, 그 눈먼 자리에서 기능 하나가
// 통째로 묻혀 있었다 —
//
//   9/14   「세트마다 체크한다」를 붙였다(공지까지 나갔다). 서버에
//          `PATCH /routine-session {setsDone}`, 스토어에 `checkSet`, 그리고 그것을
//          그리는 자리는 **옛 기록 화면의 `RoutineRun`** 하나였다
//   9/19   그 화면을 「같은 일을 하는 두 벌째 구현」이라며 지웠다 —
//          **바로 이 검사를 붙인 그 커밋이다.** 최고 기록이 묻힌 것은 찾았는데
//          세트 체크는 못 찾았다. 부품만 보고 있었기 때문이다
//   10/21  한 달 넘게 이랬다: 서버는 받고, 스토어는 다 돼 있고, **화면은 아무도
//          안 불렀다.** 진행표는 「4세트」라고만 적었다
//
// 스토어에 손을 만들어 두는 까닭은 **화면이 쓰라고**다. 안 쓰면 그 기능은 없는 것이다.
{
  const storeFiles = [...sources.keys()].filter((f) => f.includes('/store/'));
  ok('스토어 파일을 찾았다', storeFiles.length >= 8, true);

  // **일부러 비워둔 자리**는 뺀다. 까닭이 그 파일에 적혀 있다
  const ONPURPOSE = {
    'langStore.js': ['setLang'],   // 한국어 전용 — 영어를 되돌릴 때를 위해 빈 함수로 남겼다
  };

  const buried = [];
  for (const f of storeFiles) {
    const base = f.split('/').pop();
    const src = sources.get(f);
    // `create(...)` 안의 최상위 열쇠 중 함수인 것 (들여쓰기 두 칸)
    const acts = [...new Set([...src.matchAll(/^ {2}(\w+):\s*(?:async\s*)?\(/gm)].map((m) => m[1]))];
    for (const a of acts) {
      if ((ONPURPOSE[base] || []).includes(a)) continue;
      const re = new RegExp(String.raw`\b` + a + String.raw`\b`);
      const used = [...sources].some(([g, t]) => g !== f && re.test(t));
      if (!used) buried.push(`${base}: ${a}()`);
    }
  }
  ok('  스토어의 손인데 아무도 안 부르는 것', buried, []);
}

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
// **짝은 `data/navItems.js` 에 있다** (2026-10-16 에 옮겼다). 여태 탭바 안에만
// 있었는데, 머리의 길 줄도 같은 짝을 봐야 한다 — 두 군데 적으면 머리는 「설정함」이라
// 하고 탭은 딴 데가 켜지는 날이 온다
const subs = [...nav.matchAll(/'(\/[a-z/]+)':\s*\{\s*label: '([^']+)',\s*tab: (?:'(\/[a-z]+)'|null)/g)]
  .map((m) => ({ url: m[1], label: m[2], tab: m[3] || null }));
// 조용히 아무것도 안 보면 안 된다 (위의 `[^]]` 사고와 같은 자리다)
if (subs.length < 10) {
  console.log('FAIL 탭 밖 화면 짝을 못 읽었다 (navItems.js 의 SUBSCREENS) → ' + subs.length + '개');
  process.exit(1);
}
const parentOf = Object.fromEntries(subs.filter((x) => x.tab).map((x) => [x.url, x.tab]));
// **머리에서 열리는 화면**도 서랍과 같은 부류다 (2026-09-22 에 설정함이 생겼다).
// 탭바가 아니라 머리의 단추에 불이 들어온다 — 아래에서 그 불을 실제로 확인한다
const HEAD_PATHS = ['/settings'];
const homeless = renders
  .map((r) => r.url)
  .filter((url) => url !== '/'
    && !tabPaths.includes(url)
    && !drawerPaths.includes(url)
    && !HEAD_PATHS.includes(url)
    && !parentOf[url]
    && !drawerPaths.some((d) => url.startsWith(d + '/')));   // /support/notices 같은 하위 자리
ok('탭도 서랍도 머리도 안 켜지는 화면', homeless, []);

// ── 탭 밖 화면은 **머리에 이름과 나가는 길**이 있어야 한다 ── (2026-10-16)
//
// 위의 「안 켜지는 화면」은 **서랍 화면을 면제해 주고 있었다** — 「서랍에 줄이 있으니
// 괜찮다」고 봤는데, 그 줄은 **PC 사이드바와 닫혀 있는 시트 안**에 있다. 폰에서 설정함 ·
// 고객센터 · 운동 알림에 서면 아래 넷이 다 꺼진 채였고, 나가는 길은 기기의 뒤로가기뿐이었다.
// 탭의 자식(기구 세팅 · 운동 찾기)도 「운동」에 불만 들어와 있을 뿐 **이름이 없었다.**
const crumbless = renders
  .map((r) => r.url)
  .filter((url) => url !== '/' && !tabPaths.includes(url))
  .filter((url) => !subs.some((x) => url === x.url || url.startsWith(x.url + '/')));
ok('탭 밖 화면에 머리 길 줄이 없다', crumbless, []);
ok('  길 줄은 탭 밖에서만 나온다', tabPaths.filter((t) => subs.some((x) => x.url === t)), []);
ok('  이름이 다 적혀 있다', subs.filter((x) => !x.label).map((x) => x.url), []);

// 머리에서 열리는 화면은 **그 단추에 불이 들어와야** 한다. 안 들어오면 아래 탭바도
// 안 켜진 채로 서 있게 되어, 내가 어디인지 알 길이 없다
const layout = fs.readFileSync('src/components/Layout.jsx', 'utf-8');
// 2026-09-30: 기어는 **한 번 더 누르면 나간다.** 그래서 `navigate('/settings')` 는
// 조건 안으로 들어갔다 — 글자만 보면 되지만, 여는 길이 살아 있는지는 여기서 본다
// (나가는 길이 제대로인지는 `npm run nav` 가 본다)
ok('설정함으로 가는 기어가 머리에 있다', /navigate\('\/settings'/.test(layout), true);
ok('  거기 서면 기어에 불이 들어온다',
  /onSettings/.test(layout) && /location\.pathname === '\/settings'/.test(layout), true);
// 켜라고 적어둔 부모가 **실제로 탭에 있는 칸**이어야 한다
ok('  적어둔 부모가 다 실제 탭이다',
  Object.values(parentOf).filter((t) => !tabPaths.includes(t)), []);
// 짝만 있고 그리는 데가 없으면 아무 일도 안 일어난다
ok('머리가 그 짝을 보고 길 줄을 그린다', /screenOf\(location\.pathname\)/.test(layout), true);
ok('  ← 가 들어온 데로 돌아간다', /location\.key !== 'default'\) navigate\(-1\)/.test(layout), true);
ok('  바로 열렸으면 부모 탭으로 (없으면 홈)', /navigate\(crumb\?\.tab \|\| '\/home'\)/.test(layout), true);
// 탭바가 짝을 한 벌 더 들고 있으면 머리와 어긋난다
ok('탭바는 짝을 베껴 적지 않았다', /const PARENT_OF = \{/.test(tabbar), false);
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
