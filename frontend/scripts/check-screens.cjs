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

console.log('── 화면이 터지지 않고 그려지는가 (데이터 없이) ──');
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
  ['공지함', 'src/pages/support/NoticeArchive.jsx'],
  ['운동 알림', 'src/pages/RemindersPage.jsx'],
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
  // 껍데기와 전면 화면
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
  // 칸에는 못 넣는다 — 폰에서 칸이 33~49px 이라 두세 글자에서 잘린다.
  // 그래서 **그 주 아래**에 화면 폭을 다 써서 한 줄씩 보여준다
  ok('적어둔 메모가 달력에 보인다 (그 주 아래)', plain.includes('어깨가 안 좋아 가볍게'), true);
  ok('  날짜를 같이 적는다', plain.includes('2일'), true);
  ok('  둘째 줄까지 늘어놓지는 않는다', plain.includes('벤치 5kg 내림'), false);
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
console.log(bad ? `${bad}건 실패` : '전부 그려집니다');
process.exit(bad ? 1 : 0);
