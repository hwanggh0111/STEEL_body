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

/**
 * 화면 하나를 그려 **글자를 돌려준다** (2026-10-21).
 *
 * `draw` 는 「터졌나」만 본다. 빈 화면에 **있어서는 안 되는 말**이 남아 있는지는
 * 그려낸 글자를 봐야 안다 (홈의 「오늘 할 곳」 제목만 떠 있던 자리).
 * 못 그리면 `null` — 부른 쪽이 그걸 실패로 적는다.
 */
function drawHtml(file) {
  const out = path.join(__dirname, '..', '.screen-html.cjs');
  const realError = console.error;
  const realWarn = console.warn;
  console.error = () => {};
  console.warn = () => {};
  try {
    esbuild.buildSync({
      entryPoints: [path.join(__dirname, '..', file)],
      bundle: true, format: 'cjs', outfile: out, platform: 'node', jsx: 'automatic',
      external: ['react', 'react-dom', 'react-router-dom'],
      define: { 'import.meta.env': '{}' },
      logLevel: 'silent',
    });
    const mod = require(out);
    const Page = mod.default || mod;
    return renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Page)));
  } catch {
    return null;
  } finally {
    console.error = realError;
    console.warn = realWarn;
    if (fs.existsSync(out)) fs.unlinkSync(out);
    delete require.cache[out];
  }
}

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

console.log('── 화면이 터지지 않고 그려지는가 (데이터 없이) ──');
// 로그인해야 열리는 화면들이다. 서버 렌더에서는 effect 가 안 돌아 비어 있는 채로
// 그려진다 — **그 상태에서도 안 터져야 한다.** 처음 열 때가 정확히 그 상태다
const SCREENS = [
  ['홈', 'src/pages/HomePage.jsx'],
  // 옛 기록 화면은 2026-09-19 에 지웠다 (같은 일을 하는 두 벌째 구현이었다).
  // 5차 리모델링 — 루틴 · 기록 · 검색 · 기능성운동을 한 흐름으로 (2026-09-04)
  ['운동', 'src/pages/TrainPage.jsx'],
  ['히스토리', 'src/pages/HistoryPage.jsx'],
  ['루틴', 'src/pages/RoutinePage.jsx'],
  // 5차 리모델링 — 인바디 · 측정 · 견주기를 한 자리로 (2026-09-04)
  ['몸', 'src/pages/BodyPage.jsx'],
  ['인바디', 'src/pages/InbodyPage.jsx'],
  ['비교', 'src/pages/ComparePage.jsx'],
  ['측정', 'src/pages/MeasurePage.jsx'],
  // 체형 — 「몸」의 넷째 갈래 (2026-09-22). **사진 없이 열린 상태**가 첫 화면이라,
  // 여기서 그려보는 것이 실제로 사람이 처음 보는 그 화면이다
  ['체형', 'src/pages/ShapePage.jsx'],
  ['기능성운동', 'src/pages/HomeworkoutPage.jsx'],
  ['운동 검색', 'src/pages/SearchPage.jsx'],
  ['고객센터', 'src/pages/support/SupportPage.jsx'],
  // 소개는 2026-09-04 에 고객센터에서 갈라 나왔다
  ['앱 소개', 'src/pages/IntroPage.jsx'],
  // 홈페이지 — 새 화면으로 열리는 자리 (2026-09-04)
  ['홈페이지', 'src/pages/SiteHome.jsx'],
  ['공지함', 'src/pages/support/NoticeArchive.jsx'],
  ['운동 알림', 'src/pages/RemindersPage.jsx'],
  // 설정함 — 머리의 기어에서 들어온다 (2026-09-22). 스위치가 열일곱이라
  // 하나가 터지면 화면 전체가 안 나온다
  ['설정', 'src/pages/SettingsPage.jsx'],
  ['로그인', 'src/pages/LoginPage.jsx'],
  ['회원가입', 'src/pages/RegisterPage.jsx'],
  // 관리자 화면은 탭 하나가 화면 하나다. 관리자만 보는 자리라 더 늦게 들킨다
  ['관리자', 'src/pages/AdminPage.jsx'],
  ['관리자 · 보안 관리', 'src/components/SecurityPanel.jsx'],
  ['관리자 · 해킹 보안', 'src/components/HackingSecurityPanel.jsx'],
  ['관리자 · AI 관리자', 'src/components/AiAdminPanel.jsx'],
  ['관리자 · 제보 관리', 'src/components/admin/ReportAdmin.jsx'],
  ['관리자 · 점검 스케줄', 'src/components/admin/MaintAdmin.jsx'],
  ['관리자 · 보안 검사', 'src/components/admin/SecurityScan.jsx'],
  ['관리자 · 못 찾은 말', 'src/components/admin/FaqGapAdmin.jsx'],
  ['관리자 · 홈페이지 사진', 'src/components/admin/SitePhotoAdmin.jsx'],
  // 새 화면 셋 (2026-09-16). 앞 둘은 탭 안쪽이라 화면 목록에는 안 잡히고,
  // 결산은 루틴을 끝까지 돌려야 한 번 뜬다 — 눈으로 만나기 제일 어려운 자리들이다
  ['겹쳐 찍기 (카메라)', 'src/components/OverlayCamera.jsx'],
  ['말로 적기', 'src/components/VoiceSet.jsx'],
  ['몸 지도 (그림)', 'src/components/BodyMap.jsx'],
  ['몸 지도', 'src/pages/BodyMapPage.jsx'],
  ['1년 기록 벽', 'src/components/YearWall.jsx'],
  // 목표 (2026-09-17). 홈 카드 · 고리 · 목표 화면 셋.
  // 목표를 안 세운 사람에게는 카드가 한 줄로 줄어드는데, **그 갈래가 안 그려지면
  // 홈이 통째로 흰 화면**이 된다 — 홈 맨 위에 있는 자리라 더 그렇다
  ['목표 고리', 'src/components/GoalRing.jsx'],
  ['홈 목표 카드', 'src/components/home/GoalCard.jsx'],
  ['목표 화면', 'src/pages/GoalPage.jsx'],
  ['기구 탭', 'src/pages/GymPage.jsx'],
  // 기구 세팅 (2026-09-17). 갈래가 넷이라(어디인지 고르기 · 안 적음 · 적어둠 · 적는 중)
  // 눈으로 다 보려면 헬스장을 둘 만들고 세팅을 적었다 지워야 한다
  ['기구 세팅', 'src/components/GymSetting.jsx'],
  ['운동 끝 결산', 'src/components/SessionFinish.jsx'],
  // 껍데기와 전면 화면.
  //
  // **`Layout` 이 빠져 있었다** (2026-09-04 에 넣었다). 이것은 화면이 아니라
  // 모든 화면을 감싸는 껍데기라, 여기가 터지면 **안쪽이 전부 안 뜬다.**
  // 실제로 그날 `useMemo` 를 안 가져온 채로 써서 앱 전체가 흰 화면이 됐고,
  // 화면 스물넷이 다 통과하는 동안 아무도 못 잡았다
  ['껍데기 (Layout)', 'src/components/Layout.jsx'],
  ['아래 길찾기 (TabBar)', 'src/components/TabBar.jsx'],
  ['내 계정 시트', 'src/components/AccountSheet.jsx'],
  ['점검 화면', 'src/components/MaintenanceScreen.jsx'],
  ['스플래시', 'src/components/SplashScreen.jsx'],
];

for (const [name, file] of SCREENS) {
  ok(`${name} 화면이 그려진다`, draw(file), null);
}

// ── 데이터를 넣고 그려본다 ──
//
// 위의 것은 **빈 화면**을 본다. 그런데 화면이 터지는 자리는 대개 **데이터가 있을 때**다 —
// 목록을 돌리고, 날짜를 견주고, 없는 칸을 꺼내는 코드가 그때 처음 돈다.
// 그래서 부품에는 진짜 모양의 값을 넣어 한 번 더 그린다.
console.log('');
console.log('── 데이터를 넣고 그려본다 ──');

const TODAY = '2026-09-02';
const WORKOUTS = {
  '2026-09-01': [{ id: 1, exercise: '벤치프레스', weight: 60, sets: 4, reps: 10, date: '2026-09-01' }],
};
const PLANS = [
  { id: 1, date: '2026-09-02', kind: 'routine', name: '가슴+삼두', routine_id: 7 },
  { id: 2, date: '2026-09-05', kind: 'exercise', name: '데드리프트', routine_id: null },
  { id: 3, date: '2026-08-20', kind: 'exercise', name: '스쿼트', routine_id: null },  // 못 한 것
];
const ROUTINES = [{ id: 7, name: '가슴+삼두', exercises: [{ name: '벤치프레스', sets: 4, reps: 10 }] }];
const REPORTS = [
  { id: 3, kind: 'bug', status: 'checking', title: '안 됩니다', body: '이렇게요',
    created_at: '2026-09-01T00:00:00Z', reply: '고쳤습니다', reply_at: '2026-09-02T00:00:00Z', meta: { screen: '기록', freq: 'always' } },
  { id: 2, kind: 'ask', status: 'received', title: '궁금합니다', body: '', created_at: '2026-08-30T00:00:00Z', meta: {} },
];
const MEASURES = [
  { id: 2, date: '2026-09-01', data: { pushup: '34', run_1km: '300', chest: '95', sitreach: '15' } },
  { id: 1, date: '2026-08-25', data: { pushup: '30', run_1km: '312', chest: '94', sitreach: '12' } },
];

// 부품 하나를 props 와 함께 그려본다
function drawWith(file, props, wrap = true) {
  const out = path.join(__dirname, '..', '.screen2.cjs');
  const realError = console.error;
  const realWarn = console.warn;
  console.error = () => {};
  console.warn = () => {};
  try {
    esbuild.buildSync({
      entryPoints: [path.join(__dirname, '..', file)],
      bundle: true, format: 'cjs', outfile: out, platform: 'node', jsx: 'automatic',
      external: ['react', 'react-dom', 'react-router-dom'],
      define: { 'import.meta.env': '{}' },
      logLevel: 'silent',
    });
    const mod = require(out);
    const C = mod.default || mod;
    const el = React.createElement(C, props);
    renderToStaticMarkup(wrap ? React.createElement(MemoryRouter, null, el) : el);
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

// 그려본 **결과를 글자로** 돌려준다.
//
// 위의 `drawWith` 는 「터지지 않는가」만 본다. 그런데 화면이 **자리를 옮기는** 것은
// 그것으로 안 잡힌다 — 달력 칸에 있던 글이 아래 카드로 내려가도 둘 다 잘 그려진다.
// 그래서 무엇이 어디에 찍혔는지 봐야 하는 자리는 이것으로 본다
function html(file, props) {
  const out = path.join(__dirname, '..', '.screen3.cjs');
  const realError = console.error; const realWarn = console.warn;
  console.error = () => {}; console.warn = () => {};
  try {
    esbuild.buildSync({
      entryPoints: [path.join(__dirname, '..', file)],
      bundle: true, format: 'cjs', outfile: out, platform: 'node', jsx: 'automatic',
      external: ['react', 'react-dom', 'react-router-dom'],
      define: { 'import.meta.env': '{}' }, logLevel: 'silent',
    });
    const mod = require(out);
    const C = mod.default || mod;
    return renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(C, props)));
  } catch (e) {
    return 'FAILED: ' + e.message.split('\n')[0];
  } finally {
    console.error = realError; console.warn = realWarn;
    if (fs.existsSync(out)) fs.unlinkSync(out);
    delete require.cache[out];
  }
}

// 달력 — 한 날 · 할 날 · 못 한 날이 한 화면에 같이 있는 상태
ok('달력이 한 날과 할 날을 같이 그린다',
  drawWith('src/components/MonthCalendar.jsx', {
    year: 2026, month: 9, workouts: WORKOUTS,
    plans: { '2026-09-02': [PLANS[0]], '2026-09-05': [PLANS[1]] },
    selected: '2026-09-02', onSelect: () => {},
  }), null);

// 메모가 있는 날은 칸에 점이 찍힌다 — 쉰 날에도 메모는 있을 수 있다
// 「달력에 메모하게 해달라」는 말은 **달력에 적는다**는 뜻이었다 (9/3).
// 그래서 그리는 것만 보지 않고 **글이 칸에 실제로 찍히는지**까지 본다 —
// 달력 아래 카드로 되돌아가도 그리기는 통과하기 때문이다
const CAL_NOTES = { '2026-09-02': { id: 9, date: '2026-09-02', body: '어깨가 안 좋아 가볍게\n벤치 5kg 내림' } };
const calHtml = (props) => html('src/components/MonthCalendar.jsx', {
  year: 2026, month: 9, workouts: WORKOUTS, plans: {}, notes: CAL_NOTES,
  onSelect: () => {}, onSaveNote: () => {}, onDeleteNote: () => {}, savingNote: false, ...props,
});
{
  // **아무 날도 안 고른 채로 본다.** 고른 날에는 아래 편집칸에도 같은 글이 나오므로,
  // 그 상태로 보면 칸에서 글을 빼도 검사가 통과한다 (실제로 그렇게 헛돌았다)
  //
  // 그리고 **눈에 보이는 글자만** 본다. 칸의 `aria-label` 에도 메모가 들어 있어서
  // (읽어주는 프로그램을 위한 것이다) 통째로 찾으면 칸에서 글을 빼도 통과한다.
  // 이 검사는 그렇게 두 번 헛돌았다 — 검사가 조용히 통과하는 것이 제일 나쁘다
  const seen = (h) => h.replace(/aria-label="[^"]*"/g, '');
  const plain = seen(calHtml({ selected: null }));
  // **적어둔 글이 그 날짜 칸 안에 보여야 한다.** 「달력에 메모한다」는 말은 그 뜻이다.
  // 폰에서 칸이 33~49px 이라 9px 글자로 줄당 서너 자, 세 줄까지 넣는다 —
  // 넘치면 잘리지만 무슨 날이었는지는 읽힌다
  ok('적어둔 메모가 그 날짜 칸에 보인다', plain.includes('어깨가 안 좋아 가볍게'), true);
  ok('  둘째 줄까지 칸에 넣지는 않는다 (전문은 눌러서 본다)', plain.includes('벤치 5kg 내림'), false);
  const picked = calHtml({ selected: '2026-09-02' });
  ok('  고른 날 아래에 적는 자리가 열린다', picked.includes('9월 2일 메모'), true);
  ok('  적어둔 것이 있으면 「고치기」', picked.includes('고치기'), true);
  const empty = calHtml({ selected: '2026-09-10' });
  ok('아직 없으면 「적기」', empty.includes('적기') && !empty.includes('고치기'), true);
  ok('날짜를 안 골랐으면 적는 자리가 없다',
    calHtml({ selected: null }).includes('일 메모'), false);
}

for (const [name, extra] of [
  ['메모가 칸에 보인다', { selected: null }],
  ['고른 날 아래에서 적는다 (메모 있음)', { selected: '2026-09-02' }],
  ['고른 날 아래에서 적는다 (아직 없음)', { selected: '2026-09-04' }],
]) {
  ok(`달력 — ${name}`,
    drawWith('src/components/MonthCalendar.jsx', {
      year: 2026, month: 9, workouts: WORKOUTS,
      plans: { '2026-09-02': [PLANS[0]] },
      notes: CAL_NOTES, onSelect: () => {},
      onSaveNote: () => {}, onDeleteNote: () => {}, savingNote: false,
      ...extra,
    }), null);
}

// 그날 한 장 — 한 것 · 할 것 · 메모가 한 카드에 있다.
// **날짜마다 있는 것이 다르다** — 그 갈래를 다 그려본다
const DAY_NOTE = { id: 9, date: TODAY, body: '어깨가 안 좋아 가볍게\n벤치 5kg 내림' };
for (const [name, props] of [
  ['오늘 · 한 것도 할 것도 있음',
    { date: TODAY, plans: [PLANS[0]], dayWorkouts: WORKOUTS['2026-09-01'] }],
  ['앞날 · 할 것만',
    { date: '2026-09-05', plans: [PLANS[1]], dayWorkouts: [] }],
  ['지난 날 · 하기로 했는데 기록이 없음',
    { date: '2026-08-20', plans: [PLANS[2]], dayWorkouts: [] }],
  ['아무것도 없는 날',
    { date: '2026-09-04', plans: [], dayWorkouts: [] }],
  ['기록이 넷 (셋만 보이고 「외 1건」)',
    { date: TODAY, plans: [],
      dayWorkouts: [1, 2, 3, 4].map((i) => ({ id: i, exercise: '운동' + i, weight: 60, sets: 4, reps: 10 })) }],
]) {
  ok(`그날 한 장 — ${name}`,
    drawWith('src/components/DaySheet.jsx', {
      today: TODAY, myRoutines: ROUTINES,
      onAddPlan: () => {}, onDeletePlan: () => {}, addingPlan: false,
      onSeeRecords: () => {}, ...props,
    }), null);
}

// 홈의 「오늘」 — 갈래 다섯을 다 그려본다. 순서가 곧 우선순위라 갈래마다 다른 코드가 돈다
const SESSION = { routineId: 7, name: '가슴+삼두', done: 1, total: 4, current: 1,
  items: [{ name: '벤치프레스' }, { name: '인클라인' }] };
for (const [name, props] of [
  ['하던 루틴', { session: SESSION, todayWorkouts: [], todayPlans: [], myRoutines: ROUTINES }],
  ['오늘 기록', { session: null, todayWorkouts: WORKOUTS['2026-09-01'], todayPlans: [], myRoutines: ROUTINES }],
  ['오늘 담아둔 것', { session: null, todayWorkouts: [], todayPlans: [PLANS[0]], myRoutines: ROUTINES }],
  ['담아둔 루틴이 지워진 경우', { session: null, todayWorkouts: [], todayPlans: [{ ...PLANS[0], routine_id: 999 }], myRoutines: [] }],
  ['만들어둔 루틴', { session: null, todayWorkouts: [], todayPlans: [], myRoutines: ROUTINES }],
  ['아무것도 없음', { session: null, todayWorkouts: [], todayPlans: [], myRoutines: [] }],
]) {
  ok(`홈의 「오늘」 — ${name}`,
    drawWith('src/components/home/TodayCard.jsx', { ...props, onStartRoutine: () => {}, starting: false }), null);
}

// 홈 목표 카드 — 갈래가 넷이다 (2026-09-17).
//
// **홈 맨 위에 있는 카드**라 여기가 터지면 홈이 통째로 흰 화면이다. 목표를 안 세운
// 사람 · 주 횟수만 · 체중만 · 둘 다 — 넷이 각각 다른 가지를 탄다.
// 체중 목표는 세웠는데 인바디를 한 번도 안 적은 사람이 특히 잘 빠진다
for (const [name, props] of [
  ['목표 없음 (한 줄)', { goal: null, loaded: true, workouts: WORKOUTS, records: [], today: TODAY }],
  ['아직 못 불러옴', { goal: null, loaded: false, workouts: WORKOUTS, records: [], today: TODAY }],
  ['주 횟수만', { goal: { weeklyTarget: 4 }, loaded: true, workouts: WORKOUTS, records: [], today: TODAY }],
  ['체중만 (인바디 없음)', { goal: { weightTarget: 75 }, loaded: true, workouts: WORKOUTS, records: [], today: TODAY }],
  ['둘 다', { goal: { weeklyTarget: 3, weightTarget: 75, weightStart: 80 }, loaded: true, workouts: WORKOUTS,
    records: [{ id: 1, date: '2026-09-01', weight: 78 }], today: TODAY }],
]) {
  ok(`홈 목표 카드 — ${name}`,
    drawWith('src/components/home/GoalCard.jsx', { ...props, onGo: () => {} }), null);
}

// 제보 목록 — 답이 온 것 · 안 온 것 · 아직 못 불러온 것
for (const [name, props] of [
  ['답이 온 것이 섞여 있음', { items: REPORTS, loading: false, loadFailed: false }],
  ['아직 불러오는 중', { items: [], loading: true, loadFailed: false }],
  ['못 불러옴', { items: [], loading: false, loadFailed: true }],
  ['하나도 없음', { items: [], loading: false, loadFailed: false }],
]) {
  ok(`제보 목록 — ${name}`, drawWith('src/pages/support/ReportList.jsx', { ...props, onDelete: () => {} }), null);
}

// 내 계정 시트 — 9/3 에 다시 만들었다. 사진이 있을 때와 없을 때 그리는 것이 다르다
for (const [name, photo] of [['사진 없음', ''], ['사진 있음', 'data:image/png;base64,iVBOR']]) {
  ok(`내 계정 시트 — ${name}`,
    drawWith('src/components/AccountSheet.jsx', {
      nickname: '개발자3', email: 'me@example.com', photo,
      onPickPhoto: () => {}, onDeletePhoto: () => {}, onZoomPhoto: () => {},
      onSaveNick: () => {}, savingNick: false,
      onChangePw: () => {}, onLogout: () => {}, onDeleteAccount: () => {},
    }, false), null);
}
// 이름이 없는 계정도 있다 (소셜에서 이름을 못 받은 경우)
ok('내 계정 시트 — 이름도 이메일도 없음',
  drawWith('src/components/AccountSheet.jsx', {
    nickname: '', email: '', photo: '',
    onPickPhoto: () => {}, onDeletePhoto: () => {}, onZoomPhoto: () => {},
    onSaveNick: () => {}, savingNick: false,
    onChangePw: () => {}, onLogout: () => {}, onDeleteAccount: () => {},
  }, false), null);

// 루틴 메모장. 서버 렌더에서는 effect 가 안 돌아 **아직 아무것도 못 받은 상태**로
// 그려진다 — 처음 열었을 때와 같다
ok('루틴 메모가 그려진다', drawWith('src/pages/routine/RoutineNotes.jsx', { onToRoutine: () => {} }, false), null);

// 아직 못 올린 기록 — 신호가 없을 때 목록에 섞여 그려지는 자리다
for (const [name, extra] of [
  ['올리는 중', { pending: true }],
  ['못 올림', { failed: true, error: '무엇을 할지 적어주세요' }],
]) {
  ok(`기록 카드 — ${name}`,
    drawWith('src/components/WorkoutCard.jsx', {
      workout: { id: 'local-abc', date: TODAY, exercise: '벤치프레스', weight: 60, sets: 4, reps: 10, ...extra },
      onDelete: () => {}, onEdit: () => {},
    }, false), null);
}

// 측정 — 지난번과 견주는 자리. 기록이 하나뿐일 때가 견줄 것이 없는 자리다
for (const [name, file] of [
  ['체력 테스트', 'src/components/measure/FitnessTestSection.jsx'],
  ['전신 사이즈', 'src/components/measure/BodySizeSection.jsx'],
  ['유연성', 'src/components/measure/FlexibilitySection.jsx'],
]) {
  ok(`측정 · ${name} (두 번 잰 뒤)`,
    drawWith(file, { records: MEASURES, onSave: () => {}, onDelete: () => {} }), null);
  ok(`측정 · ${name} (처음 잰 날)`,
    drawWith(file, { records: [MEASURES[0]], onSave: () => {}, onDelete: () => {} }), null);
}


console.log('');
console.log('── 빈 화면에 **제목만 떠 있지 않나** ── (2026-10-21)');
//
// 홈의 「오늘 할 곳」이 그랬다. 제목은 그냥 그리고 카드만 「기록이 없으면 안 그린다」로
// 돼 있어서, **처음 온 사람의 홈에 제목만 떠 있고 아래가 비어 있었다.** 유산소만 하는
// 사람도 같다 — 그 여섯 부위에 자리가 없어서 카드가 안 그려진다.
//
// 바로 위의 목표 카드는 **이미 제목까지 같이 가리고 있었다**(`hasGoal`). 하나만 달랐다.
//
// 여기는 **빈 상태**로 그려보는 자리라(위 머리글) 이 물음에 딱 맞는다 —
// 빈 화면에 있어서는 안 되는 말이 글자로 남아 있나.
{
  const html = drawHtml('src/pages/HomePage.jsx');
  ok('홈을 빈 상태로 그렸다', html !== null && html.length > 100, true);
  // 셀 것이 없을 때 안 그리는 자리들. 제목만 남으면 사람은 **고장으로 읽는다**
  for (const word of ['오늘 할 곳', '내 목표']) {
    ok(`  빈 홈에 「${word}」 제목이 없다`, (html || '').includes(word), false);
  }
  // 거꾸로도 본다 — 늘 있어야 하는 제목은 있어야 한다 (검사가 아무것도 안 보면 안 된다)
  ok('  「오늘」 · 「이번 주 운동」 은 늘 있다',
    ['오늘', '이번 주 운동'].filter((w) => !(html || '').includes(w)), []);
}

console.log('');
console.log('── 「어느 날 적는가」 칸이 자정을 따라가고 테두리가 있나 ── (2026-10-21)');
//
// 이 앱은 폰 홈 화면에 붙여 쓰는 PWA 라 **며칠씩 열려 있는다.** `useToday` 머리글에
// 그 말이 적혀 있다 — 「날짜 칸이 어제라 그대로 저장하면 어제 기록이 된다」.
// 그런데 그 고침이 **「운동」 화면에만** 가 있었다(9/18). 인바디와 재는 도구 넷은
// 열 때의 날짜를 `useState` 로 붙잡고 있어서, **어젯밤에 열어둔 앱으로 오늘 아침에
// 적으면 어제 줄로 들어갔다** — 「운동 가기 전에 몸무게를 잰다」가 이 앱을 여는
// 가장 흔한 때다.
//
// 테두리도 넷 중 하나(어깨)에만 있었다. `max` 만 걸면 **연도는 직접 칠 수 있다**
// (2026 대신 1026). 서버가 막지만 사람에게는 **까닭 없는 실패**로 보인다.
//
// 눈으로는 못 잡는다 — 자정을 넘겨봐야 하고, 1026년은 서버가 거절하고 끝난다.
{
  // 기록을 적는 칸이 있는 화면들. 점검 스케줄(`MaintAdmin`)은 **앞날을 고르는
  // 자리**라 여기 규칙이 아니다 — 거기는 `min` 이 오늘이고 `max` 가 없다
  const WRITERS = [
    'src/pages/InbodyPage.jsx',
    'src/components/measure/BodySizeSection.jsx',
    'src/components/measure/FitnessTestSection.jsx',
    'src/components/measure/FlexibilitySection.jsx',
    'src/components/measure/ShoulderSection.jsx',
  ];
  // 날짜 칸을 가진 화면이 더 생기면 여기도 늘어야 한다 — 목록이 어긋나면 그 칸만
  // 옛 방식으로 남는다 (「운동」은 제 손으로 들고 있다: 오늘·어제 단추가 붙어 있다)
  const withDate = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.name.endsWith('.jsx') && fs.readFileSync(f, 'utf8').includes('type="date"')) {
        withDate.push(f.split(path.sep).join('/').replace(/^.*?src\//, 'src/'));
      }
    }
  })(path.join(__dirname, '..', 'src'));
  const EXEMPT = ['src/components/admin/MaintAdmin.jsx', 'src/pages/TrainPage.jsx'];
  ok('날짜 칸을 가진 화면을 다 알고 있다',
    withDate.filter((f) => !WRITERS.includes(f) && !EXEMPT.includes(f)), []);

  for (const f of WRITERS) {
    const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    const name = f.split('/').pop().replace(/\.jsx$/, '');
    // 한 곳에서 오는가 — 다섯 군데에 같은 `ref` 를 흩어놓으면 한쪽만 고쳐진다
    ok(`${name} 의 날짜가 한 곳에서 온다`, /useRecordDate\(\)/.test(src), true);
    // 제 손으로 다시 들고 있으면 자정 따라가기가 그 자리에서 끊긴다
    ok(`  ${name} 이 날짜를 따로 들고 있지 않다`, /useState\(dateKey\(\)\)/.test(src), false);
    // 위아래 테두리 둘 다
    ok(`  ${name} 의 날짜 칸에 위 테두리가 있다`, /max=\{today\}/.test(src), true);
    ok(`  ${name} 의 날짜 칸에 아래 테두리가 있다`, /min=\{minDay\}/.test(src), true);
  }
  // 아래 테두리 값은 **서버가 보는 벽과 같아야** 한다 (`utils/dayRange.js` 의 2000년)
  const hook = fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'useRecordDate.js'), 'utf8');
  ok('아래 테두리가 서버와 같은 해다 (2000-01-01)', /MIN_RECORD_DAY = '2000-01-01'/.test(hook), true);
}

console.log('');
console.log('── 크롤러에게 적어준 것이 라우트 표와 맞나 ── (2026-10-20)');
//
// `robots.txt` 와 `sitemap.xml` 은 **손으로 적는 파일**이다(10/14). 그런데 화면은
// 계속 늘어난다 — 새 화면을 `PrivateRoute` 안에 넣고 robots 에 적는 것을 잊으면,
// 크롤러가 그 주소로 와서 **로그인 화면을 색인한다.** 같은 화면 스무 개가 색인되는
// 것을 막으려고 적어둔 파일인데, 적어두는 것을 잊으면 그 일이 그대로 돌아온다.
//
// 눈으로는 안 보인다 — 색인은 몇 주 뒤에 일어나고, 그때는 아무도 이 파일을 안 본다.
{
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');
  const robots = fs.readFileSync(path.join(__dirname, '..', 'public', 'robots.txt'), 'utf8');
  const sitemap = fs.readFileSync(path.join(__dirname, '..', 'public', 'sitemap.xml'), 'utf8');

  // `<Route path="/" element={<PrivateRoute>…` 안쪽의 자리들 — 거기가 로그인 뒤다
  const at = app.indexOf('<PrivateRoute>');
  const privateBlock = at > -1 ? app.slice(at) : '';
  const privatePaths = [...privateBlock.matchAll(/<Route path="([a-z][a-z/-]*)"/g)]
    .map((m) => `/${m[1]}`)
    // 옛 주소를 살려둔 넘김 자리(`/workout` → `/train`)도 로그인 뒤다
    .filter((p) => p !== '/');
  ok('로그인 뒤 화면을 찾았다', privatePaths.length >= 10, true);

  const disallowed = new Set([...robots.matchAll(/^Disallow:\s*(\S+)/gm)].map((m) => m[1]));
  const covered = (p) => [...disallowed].some((d) => d.endsWith('/') ? p.startsWith(d) : p === d || p.startsWith(`${d}/`));
  ok('  robots 가 그것들을 다 막는다', privatePaths.filter((p) => !covered(p)), []);

  // 거꾸로도 본다 — 공개 화면을 막아두면 **아무도 못 찾는다**
  const PUBLIC = ['/site', '/privacy', '/login', '/register'];
  ok('  공개 화면은 막지 않았다', PUBLIC.filter((p) => covered(p)), []);
  ok('  공개 화면이 sitemap 에 다 있다', PUBLIC.filter((p) => !sitemap.includes(`${p}</loc>`)), []);
  // 로그인 뒤 화면이 sitemap 에 끼면 크롤러가 로그인 화면 스무 개를 색인한다
  ok('  로그인 뒤 화면은 sitemap 에 없다',
    privatePaths.filter((p) => sitemap.includes(`${p}</loc>`)), []);
}

console.log('');
console.log(bad ? `${bad}건 실패` : '전부 그려집니다');
process.exit(bad ? 1 : 0);
