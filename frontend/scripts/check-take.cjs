// 챙겨 나가기 · 화면 잠금 · 찾던 말 들고 오기 (2026-09-17).
//
//   npm run take     (npm run check 에도 들어 있다)
//
// 셋 다 **눈으로는 확인이 오래 걸리는 자리**다 —
//   · 사진 내려받기는 파일이 실제로 저장돼야 알 수 있고 (그것도 이름까지 봐야 한다)
//   · 화면 잠금은 폰을 손에서 놓고 90초를 기다려야 한다
//   · `?q=` 는 다른 화면에서 말을 들고 와야 한 번 나온다
//
// 그래서 값과 글자로 본다.
const esbuild = require('esbuild');
const fs = require('fs');

const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};

const read = (f) => fs.readFileSync(f, 'utf-8');
// 주석에 적힌 말이 검사를 통과시키면 안 된다 — 코드만 본다
// 주석에 적힌 말이 검사를 통과시키면 안 된다 — 코드만 본다.
//
// **`/*` 앞에 공백이나 `{` 가 있을 때만 주석으로 본다.** 안 그러면
// `accept="image/*"` 의 `/*` 가 주석 시작으로 읽혀서, 거기부터 다음 `*/` 까지
// **코드가 통째로 사라진다** — 그러면 그 아래를 보던 검사는 **아무것도 안 보면서
// 통과한다.** 검사가 거짓말을 하는 것이 검사가 없는 것보다 나쁘다.
//
// 이 함정은 2026-09-02 에 이미 겪고 `check-data.cjs` 에 고쳐뒀는데,
// **여기(2026-09-17)가 옛 판을 그대로 베꼈다.** 견주기 화면을 보던 검사가
// 「안 이어져 있다」고 한 덕에 드러났다 — 실제로는 이어져 있었고 검사가 못 본 것이다.
const codeOf = (s) => s
  .replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, '$1')
  .replace(/^\s*\/\/.*$/gm, '');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// atob 은 Node 16+ 에 있다. 없으면 만들어 준다 (검사가 환경 때문에 죽지 않게)
if (typeof global.atob !== 'function') {
  global.atob = (s) => Buffer.from(s, 'base64').toString('binary');
}

const pf = bundle('src/data/photoFile.js', '.t1.cjs');

console.log('── 몸 사진 챙겨가기 ──');
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

ok('종류를 읽는다', pf.mimeOf(JPG), 'image/jpeg');
ok('사진이 아니면 null', pf.mimeOf('data:text/html;base64,PHNjcmlwdD4='), null);
ok('  빈 값도 안 터진다', pf.mimeOf(null), null);
// 사람이 아는 이름으로 — `.jpeg` 가 아니라 `.jpg`
ok('확장자', [pf.extOf('image/jpeg'), pf.extOf('image/png'), pf.extOf('image/webp')], ['jpg', 'png', 'webp']);
ok('  모르는 종류는 지어내지 않는다', pf.extOf('image/그림'), 'img');

// **언제 찍은 것인지가 이름에 있어야 한다.** 파일 셋이 내려받기 폴더에 섞이면
// `photo.jpg` 로는 어느 것이 과거인지 알 수 없다
ok('이름에 언제 것인지가 들어간다',
  pf.photoFileName('before', '2026-09-17T09:00:00Z', JPG), 'blackiron_과거_2026-09-17.jpg');
ok('  나중 · 프로필도 우리말로',
  [pf.photoFileName('after', '2026-09-17', PNG), pf.photoFileName('profile', '2026-09-17', PNG)],
  ['blackiron_나중_2026-09-17.png', 'blackiron_프로필_2026-09-17.png']);
// 날짜를 모르면 **안 적는다** — `unknown` 같은 말을 끼워 넣지 않는다
ok('날짜를 모르면 날짜를 안 적는다', pf.photoFileName('before', null, JPG), 'blackiron_과거.jpg');

// `data:` 를 `fetch` 로 읽으면 이 앱의 CSP(connect-src 'self')가 **조용히 막는다**.
// 그래서 base64 를 손으로 푼다 — 여기서 진짜 풀리는지 본다
const blob = pf.dataUrlToBlob(PNG);
ok('사진을 파일로 만든다', [blob && blob.type, blob && blob.size > 0], ['image/png', true]);
// 한 장이 망가졌다고 나머지까지 못 챙기면 안 된다 — 던지지 않고 null 을 준다
ok('망가진 것은 null (안 던진다)', pf.dataUrlToBlob('data:image/png;base64,!!!!'), null);
ok('사진이 아닌 것도 null', pf.dataUrlToBlob('data:text/plain;base64,aGk='), null);

const ROWS = [
  { type: 'profile', data: PNG, updated_at: '2026-09-10' },
  { type: 'after', data: JPG, updated_at: '2026-09-17' },
  { type: 'before', data: JPG, created_at: '2026-03-02' },
  { type: 'after', data: 'not-an-image' },          // 걸러진다
];
const files = pf.downloadable(ROWS);
// 화면에 놓인 차례대로 — 과거 → 나중 → 프로필
ok('화면에 놓인 차례로 준다', files.map(f => f.type), ['before', 'after', 'profile']);
// **프로필도 내 사진이다.** 챙겨 나가는 자리에서 골라낼 이유가 없다
ok('  프로필도 같이 챙긴다', files.some(f => f.type === 'profile'), true);
ok('  사진이 아닌 줄은 걸러낸다', files.length, 3);
ok('  이름이 다 붙어 있다', files.map(f => f.name),
  ['blackiron_과거_2026-03-02.jpg', 'blackiron_나중_2026-09-17.jpg', 'blackiron_프로필_2026-09-10.png']);
ok('서버가 딴 것을 줘도 안 터진다', [pf.downloadable(null), pf.downloadable({})], [[], []]);

console.log('');
console.log('── 화면을 언제 안 재우나 ──');
// 코드가 **한 곳에만** 있어야 한다. 세 곳에 복붙하면 반드시 한 곳만 고쳐진다
const hook = read('src/data/useWakeLock.js');
ok('잡는 코드는 한 곳에만 있다',
  ['src/pages/HomeworkoutPage.jsx', 'src/components/RestBar.jsx', 'src/pages/TrainPage.jsx']
    .filter((f) => codeOf(read(f)).includes("wakeLock.request")), []);
ok('  그 한 곳이 훅이다', hook.includes("navigator.wakeLock.request('screen')"), true);

// 세 자리가 다 쓰는가 — **휴식이 빠져 있던 것이 이번에 고친 것이다**
for (const [name, file] of [
  ['기능성운동 (원래 있던 곳)', 'src/pages/HomeworkoutPage.jsx'],
  ['휴식 타이머 띠', 'src/components/RestBar.jsx'],
  ['루틴 진행', 'src/pages/TrainPage.jsx'],
]) {
  ok(`${name} 가 쓴다`, /useWakeLock\(/.test(codeOf(read(file))), true);
}

// 돌아왔을 때 다시 잡는다 — 다른 앱을 봤다 오면 잠금이 풀려 있다
ok('돌아오면 다시 잡는다', hook.includes('visibilitychange'), true);
// 놓는 것을 잊으면 배터리가 탄다
ok('꺼지면 놓는다', /release\(\)/.test(hook), true);
// 안 되는 브라우저(사파리 일부 · 안드로이드 웹뷰)에서 조용히 넘어간다
ok('없는 브라우저에서 안 터진다', hook.includes('!navigator.wakeLock'), true);
// 서버 렌더 검사에서도 돈다 (navigator 자체가 없는 자리)
ok('  navigator 가 아예 없어도 안 터진다', hook.includes("typeof navigator === 'undefined'"), true);

// **루틴 진행은 그 화면에 있을 때만.** 진행 중인 루틴은 서버에 남아 있어서
// 끝내기를 안 누르면 밤새 「진행 중」이다 — 그것만 보고 잡으면 폰을 놔둬도 화면이 켜져 있다
const rest = codeOf(read('src/components/RestBar.jsx'));
ok('휴식은 쉬는 동안만 잡는다', /useWakeLock\(running \|\| paused\)/.test(rest), true);
// 훅은 이른 반환(`return null`)보다 위에 있어야 한다 — 아래면 React 규칙 위반이다
ok('  이른 반환보다 위에 있다',
  rest.indexOf('useWakeLock(') < rest.indexOf('return null'), true);

console.log('');
console.log('── 찾던 말을 들고 올 수 있는가 ──');
const search = codeOf(read('src/pages/SearchPage.jsx'));
ok('검색 화면이 물음표 뒤를 읽는다', /params\.get\('q'\)/.test(search), true);
// `initialQuery` 는 처음 한 번만 읽힌다 — 화면에 머문 채 다른 말이 오면 앞의 말이 남는다
ok('  말이 바뀌면 다시 연다 (key)', /key=\{q\}/.test(search), true);
// 주소창은 아무나 무엇이든 적는 자리다
ok('  너무 긴 말은 자른다', /slice\(0, MAX_Q\)/.test(search), true);
// 들고 온 말이 있으면 결과부터 보여준다 (자판이 올라오면 결과를 덮는다)
ok('  들고 온 말이 없을 때만 자판을 올린다', /autoFocus=\{!q\}/.test(search), true);

// 홈 검색의 막다른 길 — 「일치하는 항목이 없어요」로 끝나던 자리
const home = codeOf(read('src/components/home/HomeSearch.jsx'));
ok('홈 검색이 못 찾으면 운동 검색으로 넘긴다', /navigate\(`\/search\?q=\$\{encodeURIComponent/.test(home), true);
// 그림 자리에 **이름을 글자로 찍고 있었다** — 「chat 고객센터」로 나왔다
ok('결과 목록이 그림을 그린다 (이름을 글자로 안 찍는다)',
  /\{item\.icon\}<\/span>/.test(home), false);
ok('  NavIcon 을 쓴다', /<NavIcon name=\{item\.icon\}/.test(home), true);

console.log('');
console.log('── 홈페이지에서 앱으로 들어가는 길 ──');
//
// 홈페이지(`/site`)는 **로그인 없이 보는 자리**다. 그래서 거기서 앱 안쪽을 누르는
// 사람은 대개 아직 로그인 전이고, 반드시 로그인 화면을 한 번 거친다.
// 그 사이에 **무엇을 들고 갈 수 있고 무엇이 사라지는지**가 여기서 갈린다.
const app = codeOf(read('src/App.jsx'));
const login = codeOf(read('src/pages/LoginPage.jsx'));
const site = codeOf(read('src/pages/SiteHome.jsx'));
const train = codeOf(read('src/pages/TrainPage.jsx'));

// 여태 `<Navigate to="/login" />` 였다 — **가려던 곳이 그 자리에서 사라졌다.**
// 홈페이지에서 「몸 지도」를 눌러 로그인했더니 홈이 열리면, 보러 가려던 것을
// 다시 찾아 들어가야 한다
ok('못 여는 자리는 가려던 곳을 들려 보낸다', /state=\{\{ from:/.test(app), true);
ok('  뒤로 가기가 막히지 않게 replace 로 보낸다', /<Navigate to="\/login" replace/.test(app), true);
ok('로그인하면 그 자리로 돌아간다', /backTo/.test(login) && /goAfterLogin/.test(login), true);
// 이 값은 주소로도 들어올 수 있다(누가 링크를 만들어 보낼 수 있다) —
// 그대로 믿으면 **로그인 직후 딴 데로 보내는 길**이 된다
ok('  앱 밖으로는 안 보낸다 (오픈 리다이렉트)', /startsWith\('\/\/'\)/.test(login), true);
ok('  로그인·가입으로 되돌리지 않는다 (그 자리를 맴돈다)', /startsWith\('\/login'\)/.test(login), true);
ok('  들고 온 것이 없으면 홈으로', /: '\/home'/.test(login), true);

// 「벤치프레스」를 찾아 「기록 ›」을 눌렀는데 **빈 운동 화면**이 열려서,
// 거기서 이름을 다시 쳐야 했다 — 홈페이지가 찾아준 일이 아무 데도 안 이어졌다
ok('홈페이지가 찾은 운동을 들려 보낸다', /\/train\?q=\$\{encodeURIComponent/.test(site), true);
// **주소에 실어야 한다** — state 는 로그인 화면을 거치면 사라진다
ok('  state 가 아니라 주소에 싣는다', /go\('\/train'\)/.test(site), false);
ok('운동 화면이 물음표 뒤를 읽는다', /searchParams\.get\('q'\)/.test(train), true);
ok('  너무 긴 말은 자른다', /slice\(0, 40\)/.test(train), true);
// 몸 지도에서 들어오던 길(state.part)은 그대로 살아 있어야 한다.
// 2026-09-18 에 `useLocation().state` 를 `navState` 로 한 번 받게 바꿨다 —
// 이름(`state.exercise`)을 들고 오는 길이 늘어서 두 번 읽게 됐기 때문이다
ok('  몸 지도에서 오던 길도 그대로다', /(navState|state)\?\.part/.test(train), true);
// 이름을 들고 오는 길 — 홈의 「이 운동 적기」 · 운동 검색 · 기능성운동이 그렇게 보낸다.
// 여태 그 셋은 옛 기록 화면으로 갔다 (2026-09-18 에 여기로 왔다)
ok('  이름을 들고 오는 길도 받는다', /navState\?\.exercise/.test(train), true);

console.log('');
console.log('── 홈페이지가 첫 화면에 지고 오는 무게 ──');
//
// 여기는 **아직 이 앱을 쓸지 말지도 모르는 사람**이 처음 보는 자리다.
// 소식 두 파일은 73KB 인데(묶으면 gzip 23.7KB) 이 화면이 쓰는 것은 **다섯 줄뿐**이다 —
// 무게의 거의 전부는 「자세히」에 들어가는 `detail` 이고, 그건 공지함이 쓴다
ok('소식을 첫 화면에 같이 들여오지 않는다',
  /^import .*(notices|changelog)\.json/m.test(site), false);
ok('  화면이 뜬 뒤에 받아온다', /import\('\.\.\/data\/notices\.json'\)/.test(site), true);
// 다섯 줄짜리를 빌드 때 따로 뽑아둘 수도 있지만, 그러면 **같은 소식이 두 곳에**
// 있게 되고 한쪽만 낡는 날이 온다. 출처는 하나로 두고 받는 때만 미룬다
ok('  출처는 그대로 하나다 (다섯 줄짜리를 따로 안 만든다)',
  fs.existsSync('src/data/siteNews.json'), false);
// 빈 상자를 먼저 띄웠다가 채우면 그 사이에 아래 상자들이 한 번 밀린다
ok('  차기 전에는 상자를 안 그린다', /news\.length > 0 && \(/.test(site), true);
// 공지함·고객센터는 **전부** 보여주는 자리다 (「자세히」까지 편다).
// 거기서는 그대로 들여온다 — 미루는 것은 **홈페이지에서만** 하는 일이다.
// 목록은 두 화면이 한 곳(`feedData.js`)에서 같이 본다
ok('공지함 쪽은 그대로 통째로 읽는다',
  /^import .*changelog\.json/m.test(read('src/pages/support/feedData.js')), true);

console.log('');
console.log('── 누른 갈래가 대답하는가 ──');
//
// 「기록」 화면의 갈래 셋(달력 · 기록의 벽 · 통계) 가운데 **둘이 통째로 비어 있었다.**
// 기록이 한 건도 없는 사람에게 `{totalWorkouts > 0 && …}` 하나로 막혀 있어서,
// 눌러도 **아무 일도 안 일어났다.**
//
// 「없는 것을 크게 안 띄운다」는 이 앱의 규칙이 맞다 — 0 을 셋 늘어놓는 화면은
// 아무것도 안 알려주면서 「내가 아무것도 안 했다」만 크게 적어둔다.
// **그런데 그건 한 두루마리였을 때의 이야기다.** 9/16 에 갈래로 나누면서 그 자리는
// 지나가다 안 보이는 칸이 아니라 **사람이 일부러 누른 곳**이 됐다 —
// 눌렀는데 아무것도 없으면 절제가 아니라 **고장으로 보인다.**
const hist = codeOf(read('src/pages/HistoryPage.jsx'));

// 갈래마다 **빈 경우를 받는 갈래가 있는가.** 여기가 이번에 고친 자리다
for (const [name, seg] of [['기록의 벽', 'wall'], ['통계', 'stats']]) {
  const at = hist.indexOf(`seg === '${seg}' && (`);
  const block = at < 0 ? '' : hist.slice(at, at + 1400);
  ok(`${name} — 기록이 없을 때도 대답한다`, /totalWorkouts === 0/.test(block), true);
  ok(`  ${name} — 무엇을 하면 채워지는지 말한다`, /<EmptyTab/.test(block), true);
}
ok('달력 — 원래부터 대답하고 있었다', /아직 적은 운동이 없어요/.test(hist), true);

// **갈 곳까지 준다.** 「없어요」로 끝내면 어디서 만드는지를 또 찾아야 한다
ok('빈 갈래가 갈 곳을 준다', /운동 적으러 가기/.test(hist), true);
// `/workout` 은 서랍에 남겨둔 **옛 화면**이다 — 되돌릴 수 있게 둔 것이지
// 처음 온 사람을 데려다 놓을 자리가 아니다
ok('  옛 화면으로 안 보낸다', /navigate\('\/workout'\)/.test(hist), false);
ok('  새 「운동」으로 보낸다', /navigate\('\/train'\)/.test(hist), true);

console.log('');
console.log('── 새로고침이 정말로 다 잇는가 ──');
//
// **앱으로 쓰는 사람에게는 다시 받을 길이 하나도 없었다.** 목록은 30초 동안 받아둔
// 것을 다시 쓰는데(`FRESH_MS`), 안드로이드 앱(웹뷰)과 홈 화면에 얹은 PWA 에는
// **주소창이 아예 없다.** 폰과 PC 를 같이 쓰면 한쪽에서 적은 것이 다른 쪽에 안 보이고,
// 할 수 있는 일은 앱을 껐다 켜는 것뿐이었다.
//
// **반쪽 새로고침이 제일 나쁘다.** 눌렀는데 어떤 것은 새로 오고 어떤 것은 안 오면,
// 사람은 「새로고침했는데도 안 바뀐다」고 읽는다 — 아예 없는 것보다 못 믿게 된다.
// 그래서 **자기 것을 따로 받아오는 화면이 전부 이어져 있는지**를 여기서 센다.
// **주석을 걷고 본다.** 이 파일의 주석에는 「제일 쉬운 길은 `location.reload()` 다」가
// 적혀 있다 — 왜 안 썼는지를 적어둔 것인데, 날것으로 보면 **썼다고 읽힌다**
const refreshSrc = codeOf(read('src/store/refreshStore.js'));
const layout = codeOf(read('src/components/Layout.jsx'));

ok('머리에 단추가 있다', /aria-label="새로고침"/.test(layout), true);
ok('  도는 동안 돈다 (눌린 줄 모르면 또 누른다)', /animation: refreshing/.test(layout), true);
ok('  도는 동안 두 번 안 눌린다', /disabled=\{refreshing\}/.test(layout), true);
// **화면을 다시 띄우지 않는다** — 무게 칸에 80 을 쳐놓고 세트를 세는 중일 수 있다
ok('화면을 통째로 다시 띄우지 않는다', /location\.reload/.test(layout + refreshSrc), false);
// 연달아 누른 것을 한 번으로 치지 않으면 누를 때마다 서버를 때린다
ok('연달아 눌러도 한 번이다', /MIN_GAP_MS/.test(refreshSrc), true);
// 하나가 실패했다고 나머지까지 낡은 채로 두면 안 된다
ok('하나 실패해도 나머지는 받는다', /allSettled/.test(refreshSrc), true);

// 여럿이 같이 쓰는 목록은 새로고침이 직접 다시 받는다
for (const s of ['useWorkoutStore', 'useInbodyStore', 'useRoutineSessionStore', 'useGoalStore', 'useReportStore']) {
  ok(`  ${s} 를 다시 받는다`, new RegExp(s + '\\.getState\\(\\)').test(refreshSrc), true);
}

// **자기 것을 따로 받아오는 화면은 전부 이어져 있어야 한다.**
// 여기 빠진 화면이 생기면 그 화면만 조용히 낡는다
for (const [name, file] of [
  ['홈', 'src/pages/HomePage.jsx'],
  ['기록', 'src/pages/HistoryPage.jsx'],
  ['운동', 'src/pages/TrainPage.jsx'],
  ['견주기', 'src/pages/ComparePage.jsx'],
  ['루틴', 'src/pages/RoutinePage.jsx'],
  ['측정', 'src/pages/MeasurePage.jsx'],
  ['운동 알림', 'src/pages/RemindersPage.jsx'],
]) {
  const src = codeOf(read(file));
  // 훅을 부르기만 하고 deps 에 안 넣으면 **아무 일도 안 일어난다** — 둘 다 본다
  ok(`${name} 이 새로고침을 듣는다`,
    /useRefreshTick\(\)/.test(src) && /\[refreshTick\]|refreshTick\]/.test(src), true);
}

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
