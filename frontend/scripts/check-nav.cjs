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
// 걷은 것은 길찾기에 적힌 줄이고, 주소를 없애는 것은 다른 일이다.
//
// 2026-09-19: `/workout` 은 이제 **화면이 아니라 넘기는 자리다** (`/train` 으로).
// 주소가 살아 있는지는 여기서, 어디로 넘기는지는 `npm run reach` 가 본다
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

// ── 설정함에서 나가는 길 (2026-09-30) ──
//
// 설정은 **탭이 아니라 잠깐 들른 자리**다. 여태 나가는 길은 아래 탭바로 딴 데 가는 것
// 하나였고, 「보던 화면으로 돌아가기」가 없었다. 들어온 문(기어)이 나가는 문도 된다.
//
// 「나가기」 단추를 새로 달지 않는다 — 설정함 맨 아래의 「나가기」 칸이 **로그아웃**이라
// 같은 말이 두 가지 일을 하게 된다. 그 두 가지가 다시 겹치지 않는지도 여기서 본다.
console.log('');
console.log('── 설정함은 들어온 문으로 나간다 ──');
const layout = codeOf(read('src/components/Layout.jsx'));
const settings = codeOf(read('src/pages/SettingsPage.jsx'));
// 기어가 **조건 없이** 설정함으로 밀어 넣으면 한 번 더 눌러도 안 나간다
ok('기어가 그때그때 갈린다', /onClick=\{toggleSettings\}/.test(layout), true);
ok('  설정함에 서 있으면 나간다', /if \(!onSettings\)[\s\S]{0,120}navigate\('\/settings'/.test(layout), true);
// 새 칸을 밀어 넣으면 기기의 뒤로가 다시 설정함으로 데려온다
ok('  히스토리를 한 칸 되돌린다', /location\.state\?\.from\) navigate\(-1\)/.test(layout), true);
// 주소를 직접 열어 온 사람에게는 되돌릴 칸이 없다
ok('  적어둔 자리가 없으면 홈으로', /else navigate\('\/home'\)/.test(layout), true);
// 들어갈 때 어디서 왔는지 적어두지 않으면 위의 되돌리기가 늘 홈으로 간다
ok('들어갈 때 어디서 왔는지 적는다', /state: \{ from: location\.pathname/.test(layout), true);
// 읽어주는 이름도 갈려야 한다 — 눈으로는 불이 들어온 것이 보이지만 소리로는 안 보인다
ok('읽어주는 이름도 갈린다', /aria-label=\{onSettings \? '설정 닫기'/.test(layout), true);
// **같은 말을 두 가지 일에 쓰지 않는다.** 설정함의 「나가기」는 로그아웃이다
ok('설정함에 「나가기」 단추를 새로 달지 않았다', />나가기</.test(settings), false);
ok('  로그아웃 단추는 그대로 있다', />로그아웃</.test(settings), true);

// ── 회복 시간을 볼 자리 (2026-09-30) ──
//
// 붙인 날 이 값은 **홈트 안에서만** 보였다 — 쉬는 시간 줄과 끝 결산. 길찾기에 자리가
// 없고 쌓인 것을 볼 데가 없었다. **모으는 값을 볼 곳이 없으면 그 값은 없는 것과 같다.**
// 체형과 같은 까닭으로 「몸」 탭의 갈래로 붙였다 — **새 탭은 만들지 않는다.**
console.log('');
console.log('── 회복 시간을 볼 자리가 있는가 ──');
const recBody = codeOf(read('src/pages/BodyPage.jsx'));
const recHome = codeOf(read('src/pages/HomeworkoutPage.jsx'));
ok('「몸」 탭에 회복 갈래가 있다', /key: 'recover', label: '회복'/.test(recBody), true);
ok('  그 갈래가 화면을 그린다', /tab === 'recover' && <RecoverPage/.test(recBody), true);
ok('  따로 받는다 (열지 않는 사람에게 안 보낸다)', /lazy\(\(\) => import\('\.\/RecoverPage'\)\)/.test(recBody), true);
// 탭바는 늘릴 수 있는 자리가 아니다 (9/19 에 「기구」 탭을 걷은 것과 같은 선)
ok('새 탭을 만들지 않았다', /'\/recover'/.test(read('src/components/TabBar.jsx')), false);
ok('  서랍에도 같은 줄을 안 둔다', /회복/.test(read('src/data/navItems.js')), false);
// 홈트 결산에서 그 자리로 가는 길. 한 줄만 보여주고 끝내면 모아둔 값이 어디 있는지 모른다
ok('홈트 결산에서 그 자리로 간다',
  /navigate\('\/body', \{ state: \{ tab: 'recover' \} \}\)/.test(recHome), true);

// ── 홈페이지가 앱과 어긋나지 않는가 ── (2026-09-30)
//
// 「안 하는 것」에 **「회복 시간도 추정하지 않는다」**고 적혀 있었는데, 9/30 에 회복
// 시간을 붙였다. 짐작이 아니라 숨을 들어 **재는 것**이라 규칙을 깬 것은 아니지만,
// 읽는 사람에게는 거짓말로 보인다. 그리고 「하는 것」은 체형 읽기 · 회복 · 횟수 세기를
// **아예 모르고 있었다** — 읽은 사람은 없는 앱을 그려보고 들어온다.
//
// **앱에 그 파일이 있으면 홈페이지도 알아야 한다.** 그것을 여기서 값으로 본다.
console.log('');
console.log('── 홈페이지가 앱과 같은 말을 하는가 ──');
const fsx = require('fs');
const siteSrc = read('src/pages/SiteHome.jsx');
const intro = read('src/pages/support/introData.js');
const has = (f) => fsx.existsSync(f);

// 회복 시간이 앱에 있으면, 「회복 시간을 추정하지 않는다」고 적어둘 수 없다
if (has('src/data/breathRecover.js')) {
  ok('회복 시간이 있는데 「안 한다」고 안 적는다', /회복 시간도 칼로리도 추정하지 않는다/.test(siteSrc), false);
  ok('  하는 것에 실려 있다', /'회복 시간'/.test(siteSrc), true);
  ok('  앱 소개에도 실려 있다', /회복 시간/.test(intro), true);
}
if (has('src/data/repCount.js')) {
  ok('횟수 세기가 하는 것에 실려 있다', /'횟수 세기'/.test(siteSrc), true);
}
if (has('src/data/shapeRead.js')) {
  ok('체형 읽기가 하는 것에 실려 있다', /'체형 읽기'/.test(siteSrc), true);
  ok('  앱 소개에도 실려 있다', /'체형 읽기'/.test(intro), true);
}
// **안 밝히면 다음 거짓말이 된다** — 사진은 실제로 계정에 저장된다(견주기용)
ok('폰 안에서 끝난다고 적으면서 사진 저장을 같이 밝힌다',
  /읽는 일은 폰 안에서 끝난다/.test(siteSrc) && /계정에 저장되고/.test(siteSrc), true);
// 추정하지 않는다는 말 자체는 그대로 지킨다 (칼로리 · 체지방률)
ok('칼로리는 여전히 추정하지 않는다고 적는다', /칼로리도 체지방률도 추정하지 않는다/.test(siteSrc), true);

// ── 「하는 것」 여섯이 **눌러서 갈 수 있나** ── (2026-10-07 · 시안 B안)
//
// 여섯 줄이 글자일 뿐이었다. 읽고 「해보고 싶다」가 돼도 **어디 있는지 말해주지
// 않고, 눌러지지도 않았다.** 줄마다 가는 곳과 「어디서 하는 일인지」를 붙였다.
//
// **여기서 지키는 것은 둘이다.**
//
//   1. **가는 곳이 진짜 있는 주소인가** — `App.jsx` 에 그 라우트가 있나.
//      주소를 손으로 적는 자리라, 화면을 옮기는 날 여기만 옛 주소로 남는다
//   2. **「어디서 하는 일인지」가 적혀 있나** — 여섯 중 셋은 **자기 화면이 없다**
//      (결산은 마칠 때 · 횟수 세기는 카메라를 켤 때 · 기록의 벽은 「기록」의 갈래).
//      데려다줘도 그 말이 없으면 **무엇을 해야 그것이 나오는지** 모른다
console.log('');
console.log('── 「하는 것」을 눌러서 갈 수 있나 ── (2026-10-07)');
{
  // `['이름', '설명', '어디', '/주소'],` 꼴로 적힌 줄을 읽는다
  const does = [...siteSrc.matchAll(/\['([^']+)',\s*'[^']*',\s*\n?\s*'([^']+)',\s*'(\/[a-z]+)'\]/g)]
    .map((m) => ({ name: m[1], where: m[2], to: m[3] }));
  ok('여섯 줄을 읽었다', does.length, 6);

  // **아무것도 안 걸리면 그 자리에서 멈춘다** — 빈 목록을 보고 아래가 다 통과한다
  if (does.length === 6) {
    const routes = new Set(
      [...app.matchAll(/<Route\s+path="([^"]+)"/g)]
        .map((m) => (m[1].startsWith('/') ? m[1] : '/' + m[1])),
    );
    for (const d of does) {
      ok(d.name + ' → ' + d.to + ' 가 진짜 있는 주소다', routes.has(d.to), true);
      ok('  어디서 하는 일인지 적었다 (' + d.where + ')', d.where.length > 1, true);
    }
    // 자기 화면이 없는 셋은 **탭 이름이 들어가야** 한다 — 「운동」 탭 · 마칠 때
    for (const name of ['운동 끝 결산', '1년 기록 벽', '횟수 세기']) {
      const d = does.find((x) => x.name === name);
      ok(name + ' 은 어느 탭인지 말한다', /「(운동|기록|몸)」/.test(d ? d.where : ''), true);
    }
  }

  ok('누르면 그 자리로 간다 (go 를 부른다)', /onClick=\{\(\) => go\(to\)\}/.test(siteSrc), true);
  // 읽어주는 화면에 「열어보기」만 여섯 번 읽히면 무엇을 여는지 알 수 없다
  ok('  읽어주는 화면에는 이름이 통째로 들어간다', /aria-label=\{`\$\{t\} 열어보기/.test(siteSrc), true);
  // 설명 문장에 링크를 걸면 읽다가 손가락이 닿아 화면이 바뀐다
  ok('  설명 문장 자체는 안 눌린다 (누르는 칸이 따로 있다)',
    /열어보기 ›/.test(siteSrc) && !/onClick=\{\(\) => go\(to\)\}[\s\S]{0,80}\{d\}/.test(siteSrc), true);
}

console.log('');
console.log('── 갈래가 주소에 남는가 ── (2026-10-06)');
//
// 갈래(탭 안의 탭)를 쓰는 화면이 셋이다 — 몸 · 기록 · 루틴. 셋 다 `useState` 로
// 들고 있어서 **갈래가 주소에 안 남았다**:
//
//   · 당겨서 새로고침하면 첫 갈래로 돌아간다 (폰에서 흔히 하는 동작이다)
//   · 「몸 → 회복」 같은 링크·바로가기를 만들 수 없다
//   · `location.state` 로 들려 보낸 갈래는 **한 번만 산다** — 새로고침에 사라진다
//
// 이 앱은 주소가 길을 들고 있어야 한다는 것을 이미 알고 있었다 — 「운동」은
// `/train?q=` 로 받고(「로그인 화면을 거쳐도 남는 길이다」) 기구 목록이 그 주소로
// 운동을 들려 보낸다. **그 교훈이 갈래에는 안 와 있었다.**
const hook = codeOf(read('src/data/useTabParam.js'));
ok('갈래를 주소에서 읽는 고리가 있다', /useSearchParams/.test(hook), true);
// **히스토리를 쌓지 않는다.** 갈래마다 쌓으면 「몸」에서 나가려고 다섯 번 눌러야
// 한다 — 폰에서 뒤로는 「이 화면을 나간다」는 뜻이다
ok('  갈래 전환이 히스토리를 안 쌓는다', /replace: true/.test(hook), true);
// 첫 갈래를 주소에 적으면 `/body` 와 `/body?t=inbody` 가 **같은 화면의 두 주소**가
// 된다 — 공유된 링크마다 다르게 생긴다
ok('  첫 갈래는 주소에 안 적는다', /p\.delete\('t'\)/.test(hook), true);
// 주소는 **누가 손으로 고칠 수 있는 자리**다. 없는 갈래를 받으면 빈 화면이 뜬다
ok('  목록에 없는 갈래는 안 받는다', /keys\.includes\(v\)/.test(hook), true);
// 같은 주소로 다시 올 때는 들고 온 갈래가 이겨야 한다 — 바로 위의
// 「같은 자리에서 다시 찾아도 따라간다」가 그것이고, 처음 판이 그것을 깼다
ok('  같은 주소로 다시 오면 들고 온 것이 덮는다', /seen\.current !== visit/.test(hook), true);

for (const pair of [
  ['src/pages/BodyPage.jsx', '몸'],
  ['src/pages/HistoryPage.jsx', '기록'],
  ['src/pages/RoutinePage.jsx', '루틴'],
]) {
  const src = codeOf(read(pair[0]));
  ok(`${pair[1]} 화면이 그 고리를 쓴다`, /useTabParam\(/.test(src), true);
  // `useState` 로 되돌아가면 갈래가 또 주소에서 사라진다
  ok('  useState 로 되돌아가지 않았다', /useState\('(inbody|calendar|mine)'\)/.test(src), false);
}

console.log('');
if (bad > 0) { console.log(bad + '건 실패'); process.exit(1); }
console.log('전부 통과');
