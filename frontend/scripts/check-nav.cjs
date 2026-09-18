// 길찾기 마무리 — 옛 화면 둘을 걷었다 (2026-09-18).
//
//   npm run nav      (npm run check 에도 들어 있다)
//
// `data/navItems.js` 에 우리가 스스로 적어둔 약속이 있었다:
//
//   > **옛 화면 둘은 되돌릴 수 있게 남겨둔다** — 새 「운동」이 아직 못 하는 것이 있다
//   > (고치기 · 지우기 · 지난 날짜에 적기). 5차를 마치면 이 둘을 걷는다.
//
// 5차도 6차도 7차도 지나고 그대로였다. 그래서 앱에는 **같은 일을 하는 길이 두 벌**이었고,
// 쓰는 사람은 어느 쪽이 진짜인지 몰랐다. 오늘 셋을 「운동」 탭에 넣고 두 줄을 걷었다.
//
// **이 검사가 지키는 것은 「다시 두 벌이 되지 않는 것」이다.** 화면이 되는지는 눈으로
// 보면 알지만, 두 벌이 된 것은 **한쪽만 고친 날에야** 드러난다 — 그때는 늦다.
const fs = require('fs');
const path = require('path');

const read = (f) => fs.readFileSync(f, 'utf-8');
// 주석이 검사를 통과시키면 안 된다 — 코드만 본다.
// (`/*` 앞에 공백이나 `{` 가 있을 때만 주석으로 본다. 안 그러면 `accept="image/*"` 의
//  `/*` 가 주석 시작으로 읽혀 그 아래 코드가 통째로 사라진다 — check-data.cjs 의 함정)
const codeOf = (s) => s
  .replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, '$1')
  .replace(/^\s*\/\/.*$/gm, '');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const nav = read('src/data/navItems.js');
const app = read('src/App.jsx');
const train = codeOf(read('src/pages/TrainPage.jsx'));
const routine = codeOf(read('src/pages/RoutinePage.jsx'));

console.log('── 옛 화면 둘을 걷었는가 ──');
ok('서랍에 「옛 기록」이 없다', /label: '옛 기록'/.test(nav), false);
ok('서랍에 「옛 루틴」이 없다', /label: '옛 루틴'/.test(nav), false);
// **라우트는 남긴다.** 북마크 · 폰 홈 화면 바로가기로 그 주소를 직접 여는 사람이 있다.
// 걷은 것은 길찾기에 적힌 줄이고, 주소를 없애는 것은 다른 일이다
ok('  그래도 주소는 살아 있다 (/workout)', /path="workout"/.test(app), true);
ok('  그래도 주소는 살아 있다 (/routine)', /path="routine"/.test(app), true);

// 앱 안에서 **옛 기록 화면으로 데려가는 길이 없어야 한다.** 줄을 걷어도 이 길들이
// 남아 있으면 사람은 여전히 그리로 간다 — 서랍에만 없는 것이지 걷힌 것이 아니다
console.log('');
console.log('── 앱 안에서 옛 화면으로 보내는 길 ──');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p) : /\.(jsx|js)$/.test(e.name) ? [p] : [];
});
// `App.jsx` 는 그 주소를 그리는 자리라 빼고 본다
const senders = walk('src')
  .filter((f) => !/App\.jsx$/.test(f))
  .filter((f) => /['"]\/workout['"]/.test(codeOf(read(f))))
  .map((f) => f.replace(/\\/g, '/'));
ok('옛 기록 화면으로 보내는 곳이 없다', senders, []);

console.log('');
console.log('── 「운동」 탭이 셋을 할 수 있는가 ──');
// 1. 고치기 — 서버에 `PUT` 이 있고 스토어에 `updateWorkout` 이 있었다. 화면만 없었다
ok('고친다', /updateWorkout\(editingId/.test(train), true);
// **고치는 중에는 미리 채우기가 돌면 안 된다** — 사람이 고치려던 값이 지난 기록으로 덮인다
ok('  고치는 중에는 미리 채우기가 비켜준다', /if \(editingId\) \{ filledFor\.current = null; return; \}/.test(train), true);
// 고친 것은 **새로 한 세트가 아니다.** 최고 기록 배너 · 휴식 타이머 · 진행표 넘기기가
// 여기서 돌면 고쳤다고 쉬라는 말이 되고, 안 한 운동이 끝난 것이 된다
ok('  고쳤다고 쉬라고 하지 않는다', /stopEditing\(\{ keepDay: true \}\);\s*\n\s*return;/.test(train), true);
// 어제 것을 고치고 오늘로 돌아가 버리면 **방금 고친 줄이 화면에서 사라진다** —
// 고쳐졌는지 눈으로 확인할 자리가 없어진다 (2026-09-18 리뷰에서 잡았다)
ok('  고친 날에 그대로 서 있는다', /keepDay \? .*|if \(keepDay\)/.test(train), true);
// 2. 지우기 — **한 번 묻는다.** 지운 기록은 되돌릴 데가 없다 (서버에도 휴지통이 없다)
ok('지운다', /deleteWorkout\(w\.id\)/.test(train), true);
ok('  지우기 전에 한 번 묻는다', /confirmDialog\([\s\S]{0,400}?지울까요/.test(train), true);
// 3. 지난 날짜에 적기 — 여태 `date: today` 가 박혀 있었다
ok('지난 날짜에 적는다', /payload = \{ date,/.test(train), true);
ok('  오늘을 박아넣지 않는다', /date: today,/.test(train), false);
ok('  오늘 아닌 날은 화면에 적는다', /오늘이 아닌/.test(train), true);
// **지난 날짜에 적을 때는 쉬라고 하지 않고 진행표도 안 넘긴다.** 어제 한 것을 적어
// 넣는 중인데 휴식이 돌면 틀린 말이고, 지금 하는 루틴의 칸이 어제 기록으로 넘어간다
ok('  지난 날짜에는 휴식·진행표가 안 움직인다', /if \(isToday\) \{[\s\S]*?advance\('done', name\)/.test(train), true);

console.log('');
console.log('── 루틴 고치기 ──');
// 「운동」 탭의 루틴 줄에서 연필을 누르면 그 루틴을 들고 루틴 화면이 열린다.
// **폼을 여기 한 벌 더 그리지 않는다** — 두 벌이 되면 한쪽만 고쳐지는 날이 온다
ok('「운동」 탭이 루틴을 들고 보낸다', /state: \{ editId: r\.id \}/.test(train), true);
ok('루틴 화면이 그것을 받는다', /state\?\.editId/.test(routine), true);
// **한 번만 연다.** 뒤로 갔다 오거나 새로고침이 다시 받아올 때 state 가 남아 있어서,
// 매번 열면 사람이 닫아도 폼이 다시 펴진다
ok('  한 번만 연다', /openedEditRef/.test(routine), true);
// 목록의 「수정」과 「운동」에서 온 길이 **같은 함수**를 쓴다
ok('  고치는 자리는 한 벌이다', (routine.match(/setEditingId\(r\.id \?\? r\._id\)/g) || []).length, 1);
// 루틴을 시작하면 **새 「운동」**으로 데려간다 (옛 기록 화면이 아니다)
ok('루틴을 시작하면 「운동」으로 간다', /navigate\('\/train'\)/.test(routine), true);

console.log('');
console.log('── 홈 검색이 데려가는 자리 ──');
//
// 5차에 인바디 · 재는 도구 · 견주기를 **「몸」 탭 한 자리**에 모았는데, 홈 검색만
// 옛 단독 주소(`/inbody` · `/measure`)를 들고 있었다. 그리로 들어간 사람은
// **탭바에 아무 칸도 안 켜진 화면**에 서서 옆 갈래로 건너갈 수 없다 (2026-09-18)
const search = codeOf(read('src/components/home/HomeSearch.jsx'));
ok('인바디를 옛 단독 화면으로 안 보낸다', /path: '\/inbody'/.test(search), false);
ok('재는 도구를 옛 단독 화면으로 안 보낸다', /path: '\/measure'/.test(search), false);
ok('  「몸」의 갈래로 보낸다', (search.match(/path: '\/body'/g) || []).length, 10);
// 「1RM」을 찾은 사람이 **갈래를 고르고 또 한 번 고르지 않게** 둘을 같이 싣는다
ok('  갈래 안의 칸까지 실어 보낸다', /state\.sub = item\.sub/.test(search), true);

const body = codeOf(read('src/pages/BodyPage.jsx'));
const measure = codeOf(read('src/pages/MeasurePage.jsx'));
ok('「몸」이 갈래 안의 칸을 넘긴다', /subTab=\{sub\}/.test(body), true);
// `useState` 의 첫 값은 **처음 한 번만** 읽힌다 — 같은 주소로 다시 오면 화면이 안 바뀐다
ok('  같은 자리에서 다시 찾아도 따라간다', /location\.key/.test(body), true);
// **아는 칸만 받는다.** 「몸」 안에서는 `state.tab` 이 「몸」의 갈래 이름이라
// 여기 칸 이름이 아니다 — 그대로 믿으면 아무 칸도 아닌 **빈 화면**이 열린다
ok('재는 도구가 모르는 칸을 안 받는다', /const known = \(k\) =>/.test(measure), true);
// 아무도 안 가리키게 됐지만 **주소는 남긴다** — 옛 북마크 · 폰 홈 화면 바로가기.
// `/workout` 을 남긴 것과 같은 이유다
ok('  그래도 옛 주소는 살아 있다 (/inbody · /measure)',
  /path="inbody"/.test(app) && /path="measure"/.test(app), true);

console.log('');
console.log('── 홈페이지(/site) 머리 내비게이션 ── (2026-09-18)');
//
// 이 화면에는 길찾기가 없었다 — 상자 일곱을 쌓아 놓고 머리에는 로고와 「앱 열기」뿐이라
// 소식을 보러 온 사람도 시작하려고 온 사람도 끝까지 내려가며 찾았다.
// 시안 셋(칸 이름 줄 · 로그인·가입 · 따라오는 점)을 셋 다 붙였다.
const site = codeOf(read('src/pages/SiteHome.jsx'));
const css = fs.readFileSync('src/styles/globals.css', 'utf-8');

ok('칸 이름 줄이 있다', /aria-label="이 화면의 칸"/.test(site), true);
// **없는 자리를 가리키면 눌러도 아무 일도 안 일어난다.** 이름만 있고 자리표가 없는
// 칸은 눈으로는 멀쩡해 보이므로, 목록과 실제 자리표를 여기서 맞춰본다
{
  const listed = [...site.matchAll(/\{ id: '([a-z-]+)',\s*label:/g)].map((m) => m[1]);
  const anchored = new Set([...site.matchAll(/id="(site-[a-z-]+)"/g)].map((m) => m[1]));
  ok('  이름을 건 칸이 여섯 이상이다', listed.length >= 6, true);
  ok('  이름마다 실제 자리표가 있다', listed.filter((id) => !anchored.has(id)), []);
}
// 붙어 있는 머리가 제목을 덮으면 내려간 자리에서 무엇을 보는지 알 수 없다.
// 숫자를 손으로 적어두면 머리를 한 줄 고칠 때마다 어긋나므로 **재서** 쓴다
ok('  머리 높이를 재서 비운다', /scrollMarginTop: headH \+ 14/.test(site), true);
// OS 에서 「동작 줄이기」를 켠 사람에게 부드러운 밀기는 멀미가 나는 움직임이다
ok('  동작 줄이기를 지킨다', /prefers-reduced-motion: reduce/.test(site), true);

// 들어와 있는 사람에게 「가입하기」는 틀린 말이고, 아직인 사람에게 「앱 열기」만
// 있으면 가입할 자리가 머리에 없다
ok('머리가 사람에 따라 갈린다', /loggedIn \?/.test(site), true);
ok('  들어와 있으면 앱 열기', /앱 열기/.test(site), true);
ok('  아직이면 로그인 · 가입하기', /가입하기/.test(site) && /href="\/register"/.test(site), true);

// 3px 짜리 여섯 개를 손가락으로 겨냥할 수 없다 — 폰에서는 칸 이름 줄이 그 일을 한다
ok('따라오는 점은 폰에서 안 그린다', /\.site-dots \{ display: none; \}/.test(css), true);
ok('  넓은 화면에서만 나온다', /@media \(min-width: 1040px\)[\s\S]{0,80}\.site-dots \{ display: flex; \}/.test(css), true);
// 줄바꿈으로 두 줄이 되면 머리가 계속 자란다 — 폰에서는 좌우로 흐르게 둔다
ok('칸 이름 줄은 폰에서 흐른다', /\.site-nav \{[\s\S]{0,200}overflow-x: auto;/.test(css), true);

console.log('');
if (bad > 0) { console.log(bad + '건 실패'); process.exit(1); }
console.log('전부 통과');
