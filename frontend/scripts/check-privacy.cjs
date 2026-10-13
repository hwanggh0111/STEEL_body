// 개인정보처리방침이 **지금 실제와 맞는가** (2026-10-13)
//
// 10/13 에 방침을 읽어보니 소셜 로그인에 **`카카오` 가 적혀 있었다.** 10/7 에
// 걷어낸 것이다. 코드에서는 지웠는데 방침은 아무도 다시 안 읽었다.
//
// **이 문서는 심사자가 읽고, 법이 요구하는 글이다.** 틀리면 반려이고, 반려가
// 아니라도 거짓말이다. 그런데 어긋나도 **아무것도 터지지 않는다** — 그래서
// 사람이 기억하지 않아도 되게 여기서 본다.
//
// 보는 것 넷 —
//   ① 꺼진 제공자의 이름이 방침에 남아 있지 않은가
//   ② 켜진 제공자는 방침에 적혀 있는가
//   ③ 서버가 **받고 있는 것**이 방침에 적혀 있는가 (오류 기록 · 고객센터 제보)
//   ④ 연락할 메일과 방침 날짜가 적혀 있는가
//
// 실행: npm run privacy  (npm run check 에 걸려 있다)

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const PAGE = path.join(ROOT, 'frontend/src/pages/PrivacyPage.jsx');
const OAUTH = path.join(ROOT, 'backend/src/routes/oauth.js');

let fail = 0;
const ok = (label, got, want) => {
  const good = got === want;
  if (!good) fail += 1;
  console.log(`${good ? 'OK  ' : 'FAIL'} ${label} -> ${JSON.stringify(got)}${good ? '' : ` (기대: ${JSON.stringify(want)})`}`);
};

const page = fs.readFileSync(PAGE, 'utf8');
const oauth = fs.readFileSync(OAUTH, 'utf8');

// 주석에 적힌 이름까지 세면 안 된다 — 사람에게 보이는 글만 본다
const visible = page
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')   // JSX 주석
  .replace(/^\s*\/\/.*$/gm, ' ');          // 줄 주석

// ── ① · ② 켜진 제공자 = 방침에 적힌 제공자 ──
//
// `/providers` 가 돌려주는 목록이 「켜진 것」의 유일한 출처다. 주석 처리된 줄은
// 세지 않는다 — 10/9 에 인스타 · X 를 그렇게 꺼뒀다.
// 이름은 **사람이 읽는 말**로 본다. `X` 한 글자로 보면 아무 데나 걸린다
// (`Xx` · 영문 토막 · 스타일 값까지) — 처음에 그렇게 썼다가 거짓 FAIL 이 났다
const PROVIDERS = { google: '구글', naver: '네이버', kakao: '카카오', facebook: '페이스북', instagram: '인스타그램', twitter: '트위터' };
const block = oauth.slice(oauth.indexOf("router.get('/providers'"), oauth.indexOf("router.get('/providers'") + 2000);

console.log('── 켜진 소셜 로그인이 방침과 맞는가 ──');
for (const [key, 이름] of Object.entries(PROVIDERS)) {
  const line = new RegExp(`^\\s*${key}:\\s*!!process\\.env`, 'm');
  const on = line.test(block);
  const written = visible.includes(이름);
  if (on) ok(`  ${이름} 은 켜져 있고 방침에도 있다`, written, true);
  else ok(`  ${이름} 은 껐으니 방침에도 없다`, written, false);
}

// ── ③ 받고 있으면 적혀 있어야 한다 ──
//
// 플레이스토어 「데이터 보안」 양식이 **크래시 로그 · 진단 정보**를 따로 적게 한다.
// 보내고 있으면서 방침에 없으면 어긋난다
console.log('');
console.log('── 받는 것이 방침에 적혀 있는가 ──');
const 받는것 = [
  ['화면이 터졌을 때의 기록', 'backend/src/routes/clientErrors.js', /router\.post\('\/'/],
  ['고객센터에 적어 보낸 글', 'backend/src/routes/reports.js', /router\.post\('\/'/],
  ['사진', 'backend/src/routes/photos.js', /router\.post\(/],
  ['알림 받을 주소', 'backend/src/routes/reminders.js', /router\.post\(/],
];
for (const [말, 파일, 길] of 받는것) {
  const src = path.join(ROOT, 파일);
  const 받고있다 = fs.existsSync(src) && 길.test(fs.readFileSync(src, 'utf8'));
  if (!받고있다) { console.log(`     (${파일} 이 안 받는다 — 건너뛴다)`); continue; }
  ok(`  「${말}」 을 적어뒀다`, visible.includes(말), true);
}

// ── ④ 빠지면 심사에서 걸리는 둘 ──
console.log('');
console.log('── 심사에서 보는 둘 ──');
ok('  연락할 메일이 적혀 있다', /[\w.]+@[\w.]+\.\w+/.test(visible), true);
ok('  방침 날짜가 적혀 있다', /20\d\d[.\-년]\s?\d{1,2}/.test(visible), true);

console.log('');
if (fail) {
  console.log(`${fail}건이 어긋났습니다 — 방침은 심사자가 읽고 법이 요구하는 글입니다.`);
  process.exit(1);
}
console.log('방침이 지금 실제와 맞습니다');
