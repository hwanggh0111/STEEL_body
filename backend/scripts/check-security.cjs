// 방어막을 화면 없이 돌려본다.
//
//   npm run check
//
// 여기서 보는 것은 **막았다고 적어놓고 실제로는 안 막히던 것들**이다.
// 셋 다 8/31 까지 열려 있던 진짜 구멍이고, 셋 다 아무것도 안 터진다 —
// 로그도 정상이고 화면도 멀쩡한데 방어만 없다.
//
//   1. **차단이 램에만 있었다.** 서버가 다시 뜨면 「영구 차단」까지 통째로 풀렸다.
//      Render 무료 플랜은 15분만 놀아도 프로세스를 내린다 — 기다리면 풀린다는 뜻이다
//   2. **로그인 잠금 열쇠가 `IP + 이메일`이었다.** 한 계정을 IP 를 바꿔가며 두들기면
//      카운터가 영영 안 차고, 한 IP 에서 계정을 바꿔가며 두들겨도 안 찬다.
//      막으려던 두 가지를 정확히 둘 다 못 막고 있었다
//   3. **쓴 refresh token 을 지웠다.** 지우면 새어나가 다시 온 것인지 그냥 만료된
//      것인지 구별할 수 없다 — 둘 다 401 이다. 토큰이 새면 먼저 쓴 쪽(대개 훔친 쪽)이
//      계속 쓰고 **주인이 쫓겨난다**
//
// 진짜 DB 는 건드리지 않는다 — DB_FILE 로 임시 파일을 가리킨다.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const TMP = path.join(__dirname, '..', '.check-security.json');
for (const f of [TMP, TMP.replace(/\.json$/, '') + '.photos.json']) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}
process.env.DB_FILE = TMP;
const db = require('../src/db');
// 나가는 길에 임시 DB 를 치운다 — `db.js` 의 exit 손이 되살리는 것까지 (2026-10-28)
require('./_tmpdb.cjs')(TMP);

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

console.log('── 막아둔 것이 서버 재시작을 넘어 남는가 ──');

db.blockIp('1.2.3.4', Date.now() + HOUR, 2, '검사: 한 시간 잠금');
db.blockIp('5.6.7.8', Infinity, 4, '검사: 영구');
ok('막은 것이 목록에 있다', db.listBlocks().map(b => b.ip).sort(), ['1.2.3.4', '5.6.7.8']);
ok('영구 차단은 forever 로 적힌다', db.findBlock('5.6.7.8').until, 'forever');

// 더 가벼운 판정이 뒤에 와도 영구 차단을 못 지운다 —
// 봇 한 번 걸린 것으로 영구 차단이 세 시간짜리가 되면 안 된다
db.blockIp('5.6.7.8', Date.now() + HOUR, 2, '검사: 뒤에 온 가벼운 판정');
ok('가벼운 판정이 영구 차단을 못 덮는다', db.findBlock('5.6.7.8').until, 'forever');
db.blockIp('1.2.3.4', Date.now() + 3 * HOUR, 3, '검사: 더 긴 것');
ok('더 긴 차단으로는 덮인다', db.findBlock('1.2.3.4').level, 3);

// 지날 때가 지난 것은 그 자리에서 걷힌다 (안 걷으면 파일이 시도한 주소 수만큼 커진다)
db.blockIp('9.9.9.9', Date.now() - 1000, 2, '검사: 이미 지난 것');
ok('지난 차단은 안 막는다', db.findBlock('9.9.9.9'), null);
ok('지난 차단은 목록에서도 빠진다', db.listBlocks().some(b => b.ip === '9.9.9.9'), false);

// **방어막이 실제로 파일에 적는지**를 본다.
//
// 앞의 것들은 `db` 를 직접 불렀다. 그러면 aiGuard 가 파일에 안 적어도 이 검사는 통과한다 —
// 실제로 `block()` 안의 파일 쓰기를 지워봤더니 아무 검사도 안 났다. 그래서 여기서는
// **방어막을 통해** 막고, 그것이 다음 프로세스에 보이는지를 본다
const guard = require('../src/middleware/aiGuard');
guard.manualBlock('4.4.4.4', 60);

// 보통 쓰기는 0.5초 뒤다. 다른 프로세스가 읽으려면 지금 써야 한다
db.flushNow();

// **여기가 핵심이다.** 파일에 적혔으니 다른 프로세스(= 다시 뜬 서버)가 그대로 읽는다.
// 램의 Map 만 보던 8/31 까지는 이 자리가 전부 빈 채로 시작했다
const restarted = execFileSync(process.execPath, ['-e', `
  process.env.DB_FILE = ${JSON.stringify(TMP)};
  const guard = require(${JSON.stringify(path.join(__dirname, '..', 'src', 'middleware', 'aiGuard.js'))});
  const n = guard.hydrateBlocks();
  console.log(JSON.stringify({ n, ips: Object.keys(guard.getBlockedIPs()).sort() }));
`], { encoding: 'utf-8' });
const after = JSON.parse(restarted.trim().split('\n').pop());
ok('서버가 다시 떠도 막힌 채다', after.ips, ['1.2.3.4', '4.4.4.4', '5.6.7.8']);
ok('영구 차단도 그대로 이어받는다',
  JSON.parse(execFileSync(process.execPath, ['-e', `
    process.env.DB_FILE = ${JSON.stringify(TMP)};
    const guard = require(${JSON.stringify(path.join(__dirname, '..', 'src', 'middleware', 'aiGuard.js'))});
    guard.hydrateBlocks();
    console.log(JSON.stringify(guard.getBlockedIPs()['5.6.7.8'].until));
  `], { encoding: 'utf-8' }).trim()), 'permanent');

// ── 램과 파일이 어긋나면 영구 차단이 조용히 사라진다 ──
//
// 코드 리뷰가 잡아준 것이다. 파일 쪽은 「약한 것으로 못 덮는다」를 지키는데 **램만
// 덮어쓰고 있었다.** 영구 차단된 주소를 관리자가 「60분」으로 다시 걸면 램은 60분이
// 되고 파일은 forever 다. 60분 뒤 그 주소가 오면 만료 자리가 **파일의 영구 차단까지
// 지운다** — 이 검사가 막으려던 바로 그 일이 거기서 났다.
guard.manualBlock('6.6.6.6', 60);          // 먼저 60분
db.blockIp('6.6.6.6', Infinity, 4, '검사: 영구로 올림');
guard.hydrateBlocks();                      // 서버가 다시 뜬 셈 치고 파일에서 읽어온다
guard.manualBlock('6.6.6.6', 60);          // 그 뒤에 관리자가 60분으로 다시 건다
ok('영구 차단을 짧은 차단으로 못 덮는다 (파일)', db.findBlock('6.6.6.6').until, 'forever');
ok('영구 차단을 짧은 차단으로 못 덮는다 (램)', guard.getBlockedIPs()['6.6.6.6'].until, 'permanent');

// 손으로 풀면 파일에서도 빠져야 한다 — 램에서만 지우면 다음에 뜰 때 되살아난다
ok('풀면 파일에서도 빠진다', (db.unblockIp('1.2.3.4'), db.findBlock('1.2.3.4')), null);
ok('없는 것을 풀면 false', db.unblockIp('없는주소'), false);

console.log('');
console.log('── 무차별 대입: 계정별 · IP별로 따로 센다 ──');

const WINDOW = 15 * MIN;
const MAX_ACCT = 10;
const MAX_IP = 20;
const LOCK = 15 * MIN;

// 1) **한 계정을 IP 를 바꿔가며** 두들기기.
//    옛 열쇠(IP+이메일)로는 IP 마다 카운터가 새로 시작해서 영영 안 걸렸다.
//    계정별 열쇠는 IP 를 아무리 바꿔도 같은 자리에 쌓인다
for (let i = 0; i < MAX_ACCT - 1; i++) db.recordLoginFail('acct:victim@test.local', WINDOW, MAX_ACCT, LOCK);
ok('아홉 번까지는 안 잠근다', db.loginLockLeft('acct:victim@test.local'), 0);
db.recordLoginFail('acct:victim@test.local', WINDOW, MAX_ACCT, LOCK);
ok('열 번째에 잠긴다 (IP 를 바꿔가며 쳐도)', db.loginLockLeft('acct:victim@test.local') > 0, true);
ok('잠금은 15분쯤이다', Math.round(db.loginLockLeft('acct:victim@test.local') / MIN), 15);

// 2) **한 IP 에서 계정을 바꿔가며** 두들기기 (크리덴셜 스터핑).
//    이메일마다 카운터가 새로 시작하던 자리다 — IP 별 열쇠는 계정을 바꿔도 같이 쌓인다
for (let i = 0; i < MAX_IP; i++) db.recordLoginFail('ip:7.7.7.7', WINDOW, MAX_IP, LOCK);
ok('한 주소에서 스무 번이면 잠근다 (계정을 바꿔가며 쳐도)', db.loginLockLeft('ip:7.7.7.7') > 0, true);

// 3) 들어오면 그 계정 카운터는 지운다. **IP 카운터는 안 지운다** —
//    자기 계정 하나를 제대로 로그인해서 스무 번 틀린 흔적을 지우는 길이 되면 안 된다
db.clearLoginFail('acct:victim@test.local');
ok('로그인에 성공하면 그 계정 카운터는 지워진다', db.loginLockLeft('acct:victim@test.local'), 0);
ok('IP 카운터는 그대로 남는다', db.loginLockLeft('ip:7.7.7.7') > 0, true);

// 4) 오래 조용했으면 처음부터 센다 (어제 두 번 틀린 것이 오늘까지 쌓이면 안 된다)
db.recordLoginFail('acct:quiet@test.local', WINDOW, MAX_ACCT, LOCK);
const quiet = db.snapshot().loginFails.find(r => r.key === 'acct:quiet@test.local');
quiet.last = Date.now() - WINDOW - 1000;
const again = db.recordLoginFail('acct:quiet@test.local', WINDOW, MAX_ACCT, LOCK);
ok('창이 지나면 처음부터 센다', again.count, 1);

// 5) 다 식은 줄은 걷는다 — 안 걷으면 시도한 주소 수만큼 파일이 커진다
db.recordLoginFail('acct:old@test.local', WINDOW, MAX_ACCT, LOCK);
const old = db.snapshot().loginFails.find(r => r.key === 'acct:old@test.local');
old.last = Date.now() - 2 * 24 * HOUR;
db.cleanLoginFails(24 * HOUR);
ok('다 식은 줄은 걷힌다', db.snapshot().loginFails.some(r => r.key === 'acct:old@test.local'), false);
ok('아직 잠긴 줄은 안 걷는다', db.snapshot().loginFails.some(r => r.key === 'ip:7.7.7.7'), true);

// 6) 열쇠는 **친 아이디**로 만든다 — 있는 계정만 429 가 되면 그 차이가
//    「이 아이디는 있다」는 답이 된다. 대소문자·공백으로 카운터를 피할 수도 없어야 한다
const authSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'auth.js'), 'utf-8');
// **파일 전체에서 찾으면 안 된다** — 회원가입에도 `findUserByEmail` 과 `bcrypt` 가 있어서,
// 순서를 비교하면 엉뚱한 자리를 본다 (처음에 그렇게 짰다가 FAIL 이 났다). 로그인 자리만 자른다
const loginRoute = authSrc.slice(authSrc.indexOf("router.post('/login'"), authSrc.indexOf("router.post('/refresh'"));
ok('열쇠를 소문자로 맞춘다', /loginKeyOf\s*=\s*\(typed\)\s*=>\s*'acct:'\s*\+\s*String\(typed \|\| ''\)\.trim\(\)\.toLowerCase\(\)/.test(authSrc), true);
ok('있는 계정인지 보기 전에 잠금을 본다',
  loginRoute.indexOf('db.loginLockLeft') < loginRoute.indexOf('db.findUserByEmail(email)'), true);
// bcrypt 는 한 번에 0.2초를 쓴다. 잠긴 뒤에도 맞춰보고 막으면 답은 못 얻어도 CPU 는 태운다
ok('잠긴 뒤에는 비밀번호를 맞춰보지 않는다',
  loginRoute.indexOf('db.loginLockLeft') < loginRoute.indexOf('bcrypt.compare'), true);
ok('계정별과 IP별 두 자리에 같이 센다',
  loginRoute.includes("db.recordLoginFail(acctKey") && loginRoute.includes("db.recordLoginFail(ipKey"), true);
ok('성공해도 IP 카운터는 안 지운다',
  loginRoute.includes('db.clearLoginFail(acctKey)') && !loginRoute.includes('db.clearLoginFail(ipKey)'), true);

console.log('');
console.log('── 로그인 유지 토큰이 새면 ──');

db.createUser('owner@test.local', 'hash', '주인', 'owner');
const owner = db.findUserByEmail('owner@test.local').id;
const week = new Date(Date.now() + 7 * 24 * HOUR).toISOString();
db.saveRefreshToken(owner, 'TOKEN-A', week);
db.saveRefreshToken(owner, 'TOKEN-B', week);
ok('막 받은 토큰은 쓸 수 있다', !!db.findRefreshToken('TOKEN-A'), true);

// 한 번 쓰면 그 토큰은 죽는다 (rotation). **지우지는 않는다**
db.useRefreshToken('TOKEN-A');
ok('한 번 쓴 토큰은 다시 안 통한다', db.findRefreshToken('TOKEN-A'), null);
ok('쓴 토큰은 흔적이 남는다 (만료가 아니라 재사용인 줄 알아야 한다)',
  db.findUsedRefreshToken('TOKEN-A')?.user_id, owner);
ok('안 쓴 토큰은 재사용이 아니다', db.findUsedRefreshToken('TOKEN-B'), null);

// 재사용이 보이면 그 계정의 로그인 유지를 **전부** 끊는다.
// 누가 주인인지 서버는 모른다 — 둘 다 끊고, 비밀번호를 아는 쪽만 돌아온다
db.deleteUserRefreshTokens(owner);
ok('재사용이 보이면 그 계정 토큰을 전부 끊는다',
  db.snapshot().refreshTokens.filter(t => t.user_id === owner).length, 0);

const authRefresh = authSrc.slice(authSrc.indexOf("router.post('/refresh'"), authSrc.indexOf("router.post('/logout'"));

// ── 탭 두 개는 도둑이 아니다 ──
//
// 탭을 둘 열어두면 둘 다 같은 쿠키를 들고 있다. 둘이 거의 동시에 갱신을 보내면
// 두 번째는 **이미 쓴 토큰**을 들고 도착한다 — 0.2초 늦었을 뿐이다.
// 여기서 바로 「전부 끊기」를 하면 **탭 두 개 열어둔 사람이 쫓겨난다.**
// 화면은 한 탭 안에서는 갱신을 하나로 합치지만(`api/client.js`) 탭끼리는 못 합친다.
const { REFRESH_REUSE_GRACE_MS } = require('../src/config/security');
ok('유예 창이 있다 (20초쯤)', Math.round(REFRESH_REUSE_GRACE_MS / 1000), 20);
ok('방금 쓴 것이면 세션을 안 끊는다',
  authRefresh.indexOf('REFRESH_REUSE_GRACE_MS') < authRefresh.indexOf('db.deleteUserRefreshTokens('), true);
ok('그때는 재사용이 아니라 경쟁으로 적는다', /refresh_race/.test(authRefresh), true);
// 유예를 지나서 온 것은 진짜 재사용이다 — 그때는 끊는다
ok('유예를 넘기면 그 계정 전부를 끊는다',
  /Date\.now\(\) - new Date\(reused\.used_at\)\.getTime\(\) < REFRESH_REUSE_GRACE_MS/.test(authRefresh), true);

ok('갱신할 때 지우지 않고 「썼다」고 적는다', authRefresh.includes('db.useRefreshToken('), true);
// 지우는 자리가 하나 남아 있는데 그건 **정지된 계정**이다 — 그 사람은 돌아오지 않는다.
// 그 외에 지우는 자리가 생기면 재사용을 다시 못 알아본다
ok('토큰을 지우는 자리는 정지된 계정 하나뿐이다',
  (authRefresh.match(/db\.deleteRefreshToken\(/g) || []).length, 1);
ok('재사용이면 그 계정 전부를 끊는다', authRefresh.includes('db.deleteUserRefreshTokens('), true);
ok('사람에게 왜 끊겼는지 말해준다', /보안을 위해 로그인을 모두 끊었어요/.test(authRefresh), true);

console.log('');
console.log('── 서버가 뜰 때 · 도는 동안 ──');
const indexSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf-8');
ok('뜰 때 막아둔 것을 이어받는다', indexSrc.includes('aiGuard.hydrateBlocks()'), true);
ok('지난 차단을 주기적으로 걷는다', indexSrc.includes('db.cleanExpiredBlocks()'), true);
ok('다 식은 로그인 실패 줄도 걷는다', indexSrc.includes('db.cleanLoginFails('), true);
const guardSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'middleware', 'aiGuard.js'), 'utf-8');
// 글자로만 보면 `if (false)` 를 앞에 붙여도 통과한다 — 위에서 실제로 통과시켜 본다.
// 여기서는 곧바로 쓰는지(0.5초 미루지 않는지)만 본다. 막는 순간은 서버가 죽을 수도 있는 때다
ok('막을 때 곧바로 파일에 쓴다', /db\.blockIp\([^)]*\);\s*db\.flushNow\(\);/.test(guardSrc), true);
ok('손으로 풀면 파일에서도 지운다', guardSrc.includes('db.unblockIp(ip)'), true);
// 푼 것도 곧바로 써야 한다. 안 그러면 「해제되었어요」라고 말해놓고 다시 뜰 때 되살아난다
ok('풀 때도 곧바로 파일에 쓴다', /db\.unblockIp\(ip\);\s*db\.flushNow\(\);/.test(guardSrc), true);
// 만료로 지우기 전에 파일을 한 번 더 본다 (램이 파일보다 약할 수 있다)
ok('만료 청소가 파일을 먼저 본다', /db\.findBlock\(ip\)/.test(guardSrc), true);

console.log('');
console.log('── 우리가 적어달라고 한 글을 막고 있지 않나 ── (2026-10-21)');
//
// 돌려보고 찾았다. 입력 스캔에 **앱이 스스로 보내는 글**과 **버그를 알려주는 글**이
// 걸렸다 —
//
//     BLOCK 403  화면 오류 — "Cannot set properties of null (setting 'innerHTML')"
//     BLOCK 403  화면 오류 — 스택에 "at eval (…)"
//     BLOCK 403  제보 — 본문에 "…(reading 'innerHTML')" 을 붙여넣음
//
// 흰 화면 보고는 **앱이 자동으로** 보낸다. 사람은 아무것도 안 쳤는데 막혔고, 그러면
// **흰 화면이 났다는 사실조차 서버에 안 남는다.** 로그인한 사람이면 **두 번째 흰
// 화면에 3일 정지**, 그 정지가 둘 쌓이면 영구 정지다.
//
// 제보도 우리가 권한 일이다 — 에러 경계가 「무슨 일인지 보기 … 제보에 붙여주시면
// 우리가 찾기 쉽다」고 직접 적어놓고 붙여넣으면 막았다.
//
// **글자로만 보면 안 된다** — 실제로 미들웨어에 요청을 넣어 본다.
{
  const mw = require(path.join(__dirname, '..', 'src', 'middleware', 'aiGuard.js'));
  let n = 0;
  const fire = (p, body) => {
    n += 1;
    const req = {
      ip: '203.0.113.' + (20 + (n % 60)),
      path: p, originalUrl: p, method: 'POST',
      body, query: {}, params: {}, cookies: {},
      headers: { 'user-agent': 'Mozilla/5.0 (check)' },
      get(h) { return this.headers[String(h).toLowerCase()]; },
      connection: {}, on() {},
    };
    let code = 200;
    const res = {
      statusCode: 200,
      status(c) { code = c; this.statusCode = c; return this; },
      json() { return this; },
      on() {},
    };
    mw(req, res, () => { code = 200; });
    return code;
  };

  // ── 통과해야 하는 것 ──
  ok('흰 화면 보고 — innerHTML 이 들어도 받는다',
    fire('/api/client-error', { message: "Cannot set properties of null (setting 'innerHTML')", stack: 'at setAttr' }), 200);
  ok('  스택에 eval( 이 있어도 받는다',
    fire('/api/client-error', { message: 'x', stack: 'at eval (webpack:///./a.js:1:1)' }), 200);
  ok('  document.write 도 받는다',
    fire('/api/client-error', { message: 'document.write is not a function', stack: 'x' }), 200);
  ok('제보 — 스택을 붙여넣어도 받는다',
    fire('/api/reports', { kind: 'bug', title: '화면이 깨져요', body: "TypeError: …(reading 'innerHTML')" }), 200);

  // ── 그래도 막아야 하는 것 ──
  // 면제는 **칸 단위**다. 제보의 다른 칸과 다른 길은 그대로 본다
  ok('제보의 다른 칸은 그대로 막는다',
    fire('/api/reports', { kind: 'bug', title: 'x', body: 'y', meta: { screen: '<script>alert(1)</script>' } }), 403);
  ok('운동 이름은 그대로 막는다',
    fire('/api/workouts', { date: '2026-10-21', exercise: '<script>alert(1)</script>', weight: '80', sets: 4, reps: 8 }), 403);
  ok('메모도 그대로 막는다',
    fire('/api/notes', { date: '2026-10-21', body: '<iframe src=x onerror=alert(1)>' }), 403);
  // **객체 리터럴로는 못 만든다** — `{ __proto__: … }` 는 프로토타입을 바꾸는 문법이고
  // 제 칸(own property)이 안 생긴다. 몸통은 `JSON.parse` 를 거쳐 오므로 그쪽으로 만든다
  // (express 의 reviver 가 운영에서는 파싱 때 걷지만, 가드도 제 손으로 봐야 한다)
  ok('프로토타입 오염은 그대로 막는다',
    fire('/api/workouts', JSON.parse('{"date":"2026-10-21","exercise":"a","__proto__":{"x":1}}')), 403);

  // ── 받아도 되는 까닭을 **코드가 지키고 있나** ──
  //
  // 막지 않는 근거는 둘이다: 저장할 때 글자를 다듬는다 · 화면이 글자로만 그린다.
  // 둘 중 하나가 깨지면 면제가 구멍이 된다 — 그래서 여기서 같이 못 박는다.
  const reports = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'reports.js'), 'utf-8');
  ok('제보 제목을 다듬어 저장한다', /sanitize\(title\)/.test(reports), true);
  ok('  본문도 다듬어 저장한다', /sanitizeMultiline\(body\)/.test(reports), true);
  const errs = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'clientErrors.js'), 'utf-8');
  ok('흰 화면 보고는 길이를 자른다', /cut\(req\.body\?\.message, \d+\)/.test(errs), true);
  ok('  1분에 몇 건으로 막아뒀다', /max: \d+/.test(errs), true);

  // 앱 어디에도 **글자를 HTML 로 그리는 자리**가 없어야 한다
  const front = path.join(__dirname, '..', '..', 'frontend', 'src');
  const jsx = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (/\.jsx?$/.test(e.name)) jsx.push(f);
    }
  })(front);
  ok('화면이 글자를 HTML 로 그리지 않는다',
    jsx.filter((f) => fs.readFileSync(f, 'utf-8').includes('dangerouslySetInnerHTML'))
      .map((f) => f.split(path.sep).pop()), []);

  // 면제 표에 적어둔 칸이 **그 라우트가 실제로 읽는 칸**인가.
  // 이름이 바뀌면 면제가 조용히 풀려서 다시 막기 시작한다
  const guard = fs.readFileSync(path.join(__dirname, '..', 'src', 'middleware', 'aiGuard.js'), 'utf-8');
  ok("면제 표에 '/api/client-error' 가 있다", /'\/api\/client-error': true/.test(guard), true);
  ok("  제보는 제목·본문만 면제한다", /'\/api\/reports': \['title', 'body'\]/.test(guard), true);
  ok('  제보 라우트가 그 두 칸을 읽는다', /const \{ kind, title, body/.test(reports), true);
  // 조용히 흘리지 않는다 — 막지는 않아도 로그에는 남긴다
  ok('면제한 칸에 걸린 것은 로그에 남긴다', /면제한 칸에 \$\{hit\.type\} 모양이 있었다/.test(guard), true);
  // CSRF 도 같은 자리에서 같은 판단을 하고 있나 (둘이 어긋나면 한쪽만 받는다)
  ok('흰 화면 보고는 CSRF 도 면제돼 있다',
    /req\.path === '\/api\/client-error'\) return next\(\)/.test(indexSrc), true);
}

console.log('');
console.log('── 보안 보고서가 **지금 쓰는 값**을 말하는가 ── (2026-10-21)');
//
// 관리자 화면의 보안 보고서는 **손으로 적어둔 문자열 뭉치**였다. 그 중 하나는 틀렸다 —
//
//     bruteForce: 'IP+email tracking + 5-attempt lock'
//
// 그 열쇠(IP+이메일)는 **이 파일 머리글이 적어둔 「고치기 전의 버그」**다. IP 를
// 바꿔가며 한 계정을 두들기면 카운터가 영영 안 찼다. 횟수도 5가 아니라 계정별 10 ·
// 주소별 20 이다. CSP 도 10/20 에 집을 걷고 더했는데 화면은 옛말을 했다.
//
// **관리자 화면은 이것을 보고 판단하는 자리다. 틀린 숫자는 없는 것보다 나쁘다.**
// 그래서 보고서를 실제로 받아 설정과 견준다.
{
  const cfg = require(path.join(__dirname, '..', 'src', 'config', 'security.js'));
  const csp = require(path.join(__dirname, '..', 'src', 'csp.js'));
  // 관리자 인증은 검사에서 통과시킨다 — 여기서 보려는 것은 인증이 아니라 **적힌 값**이다.
  // **먼저 끼워야 한다**: 아래 「지금 막혀 있는 것」 절이 같은 길을 다시 쓰는데,
  // 여기서 진짜 인증이 든 채로 담기면 그쪽이 401 을 받는다 (그렇게 한 번 걸렸다)
  const adminPath = require.resolve(path.join(__dirname, '..', 'src', 'middleware', 'adminAuth.js'));
  require.cache[adminPath] = {
    id: adminPath, filename: adminPath, loaded: true, exports: (rq, rs, nx) => nx(),
  };
  const sec = require(path.join(__dirname, '..', 'src', 'routes', 'security.js'));
  const layer = sec.stack.find((l) => l.route && l.route.path === '/report');
  const handler = layer.route.stack[layer.route.stack.length - 1].handle;
  let rep = null;
  handler({ userId: 1 }, { json(o) { rep = o; } });

  ok('보고서가 나온다', !!rep, true);
  ok('access 유효기간이 설정 그대로다', rep.auth.accessTokenExpiry, cfg.JWT.accessExpiry);
  ok('  refresh 도 설정에서 센 값이다', rep.auth.refreshTokenExpiry,
    Math.round(cfg.JWT.refreshMs / 86400000) + 'd');
  ok('  서명 방식도', rep.auth.jwtAlgorithm, cfg.JWT.algorithm);
  ok('  bcrypt 횟수도', rep.auth.bcryptRounds, cfg.BCRYPT_ROUNDS);
  ok('속도 제한이 설정 그대로다', rep.defense.rateLimiting.includes(String(cfg.RATE_LIMITS.global.max))
    && rep.defense.rateLimiting.includes(String(cfg.RATE_LIMITS.login.max)), true);
  ok('무차별 대입 설명이 설정 그대로다', rep.defense.bruteForce, cfg.LOGIN_LOCK_DESC);
  // **그 설명이 지금의 열쇠를 말하나** — 옛 버그(IP+이메일 · 5회)를 되말하지 않는다
  ok('  옛 열쇠를 되말하지 않는다', /IP\+email|5-attempt/i.test(rep.defense.bruteForce), false);
  ok('  계정별과 주소별 둘을 말한다',
    rep.defense.bruteForce.includes(String(cfg.LOGIN_LOCK.maxPerAccount))
    && rep.defense.bruteForce.includes(String(cfg.LOGIN_LOCK.maxPerIp)), true);
  // 로그인 자리가 **그 설정을 받아 쓰고 있나** (여기만 바꾸고 저쪽이 옛 숫자면 거짓말이다)
  const authSrc2 = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'auth.js'), 'utf-8');
  ok('로그인이 그 설정을 받아 쓴다', /LOGIN_MAX_ATTEMPTS = LOGIN_LOCK\.maxPerAccount/.test(authSrc2), true);
  ok('  주소별도', /LOGIN_MAX_PER_IP = LOGIN_LOCK\.maxPerIp/.test(authSrc2), true);

  ok('HSTS 가 설정 그대로다', rep.headers.hsts, cfg.HSTS_MAX_AGE + 's');
  ok('  내보내는 helmet 도 같은 값을 쓴다',
    /maxAge: HSTS_MAX_AGE/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf-8')), true);
  ok('CSP 가 지금 나가는 것이다', rep.headers.csp.includes(csp.DIRECTIVES['connect-src'].join(' ')), true);
  ok('  없는 집을 적어두지 않는다', /fonts\.googleapis\.com/.test(rep.headers.csp)
    === csp.DIRECTIVES['connect-src'].some((v) => v.includes('fonts.googleapis.com')), true);
  ok('권한 방침은 내보내는 값 그대로다', rep.headers.permissionsPolicy, cfg.PERMISSIONS_POLICY);

  // **화면이 그 뭉치를 실제로 그리나.** 보내기만 하고 안 그리면 고친 일이 아무 데도 안 보인다
  const panel = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src',
    'components', 'admin', 'SecurityScan.jsx'), 'utf-8');
  // **감싸고 그리는지까지 본다** (2026-10-27). 여기 `report.defense` 를 그대로 읽는
  // 꼴로 적혀 있었는데, 그러면 서버가 다른 모양을 줄 때 그 줄에서 터져 관리자 화면이
  // 통째로 흰 화면이 된다 — 같은 화면의 헤더 · 로그는 이미 감싸고 있었다.
  // 감싼 꼴로 고치면서 이 검사가 FAIL 했다(글자가 안 맞아서다. 고친 쪽이 맞다)
  ok('화면이 방어 시스템을 그린다', /Object\.entries\(report\.defense \|\| \{\}\)/.test(panel), true);
  ok('  내보내는 헤더도 그린다', /Object\.entries\(report\.headers/.test(panel), true);
}

console.log('');
console.log('── 로그아웃이 정말 쿠키를 걷는가 ── (2026-10-21)');
//
// `utils/tokens.js` 머리글이 적어둔 것: 「쿠키 설정이 양쪽에 복붙돼 있었다 … 한 곳에
// 둔다」. 그런데 **심는 것만 한 곳이었다** — 지우는 자리는 `routes/auth.js` 에
// 다섯 벌 복붙돼 있었고 `path` 를 손으로 또 적어뒀다. 내보내둔 `*_COOKIE_OPTS` 셋은
// **아무도 안 쓰고 있었다.**
//
// 어긋나는 방향이 나쁘다. refresh 쿠키의 길(`/api/auth`)을 고치는 날 심는 쪽만
// 바뀌고, 브라우저는 그 쿠키를 그대로 들고 있는다 — **「로그아웃했는데 다시 들어가
// 있다」**. 쿠키 지우기는 이름과 길이 맞아야만 되는 일이라 조용히 안 된다.
{
  const tk = require(path.join(__dirname, '..', 'src', 'utils', 'tokens.js'));
  const calls = [];
  const fakeRes = { clearCookie(name, opts) { calls.push([name, opts && opts.path]); } };

  tk.clearAuthCookies(fakeRes);
  ok('셋을 다 걷는다', calls.map((c) => c[0]), ['sb_access', 'sb_refresh', 'sb_csrf']);
  ok('  길이 심을 때와 같다', calls.map((c) => c[1]),
    [tk.ACCESS_COOKIE_OPTS.path, tk.REFRESH_COOKIE_OPTS.path, tk.CSRF_COOKIE_OPTS.path]);
  // 그 길이 실제로 그 값인가 — refresh 만 좁은 길이다 (다른 요청에 실려 다니지 않게)
  ok('  refresh 는 좁은 길에 심는다', tk.REFRESH_COOKIE_OPTS.path, '/api/auth');
  ok('  access · csrf 는 온 사이트', [tk.ACCESS_COOKIE_OPTS.path, tk.CSRF_COOKIE_OPTS.path], ['/', '/']);

  calls.length = 0;
  tk.clearAuthCookies(fakeRes, { accessOnly: true });
  ok('갱신이 겹쳤을 때는 access 만 걷는다 (탭 두 개는 도둑이 아니다)',
    calls.map((c) => c[0]), ['sb_access']);

  // **딴 데서 손으로 지우지 않는다** — 길을 또 적는 자리가 생기면 어긋난다
  const srcDir = path.join(__dirname, '..', 'src');
  const byHand = [];
  (function walk(d) {
    for (const n of fs.readdirSync(d)) {
      const f = path.join(d, n);
      if (fs.statSync(f).isDirectory()) walk(f);
      else if (/\.js$/.test(n) && n !== 'tokens.js') {
        const body = fs.readFileSync(f, 'utf-8');
        if (/clearCookie\(\s*'sb_/.test(body)) byHand.push(n);
      }
    }
  })(srcDir);
  ok('로그인 쿠키를 손으로 지우는 자리가 없다', byHand, []);

  // 끊는 자리마다 실제로 부르고 있나 (갱신 겹침 · 재사용 · 만료 · 정지 · 로그아웃 · 계정 삭제)
  const authSrc = fs.readFileSync(path.join(srcDir, 'routes', 'auth.js'), 'utf-8');
  ok('끊는 자리가 그 손을 쓴다', (authSrc.match(/clearAuthCookies\(/g) || []).length >= 6, true);
  // 정지된 계정으로 갱신이 오는 자리 — 여기만 쿠키를 안 걷고 있었다 (10/21)
  const bannedAt = authSrc.indexOf('계정을 찾을 수 없거나 정지된 계정이에요');
  ok('  정지된 계정도 그 자리에서 걷는다',
    authSrc.slice(Math.max(0, bannedAt - 400), bannedAt).includes('clearAuthCookies(res)'), true);
}

console.log('');
console.log('── 관리자 화면이 「지금 막혀 있는 것」을 실제로 받는가 ──');

// **이 앱이 세 번 당한 자리다.** 서버는 200 을 주고 화면은 아무 말도 안 한다 —
// 8/24 `/security/dashboard`, 8/26 `/security/logs`(배열을 객체로 받아 로그 100건이
// 와도 늘 「없습니다」였다). 빌드도 통과하고 에러도 안 난다.
//
// 그래서 **서버를 실제로 띄워 응답을 받아보고**, 그 이름들을 **화면 파일이 읽는
// 이름과 맞춰본다.** 관리자 인증은 검사에서 통과시킨다 — 여기서 보려는 것은
// 인증이 아니라 주고받는 모양이다.
const express = require('express');
const adminAuthPath = require.resolve('../src/middleware/adminAuth');
require.cache[adminAuthPath] = {
  id: adminAuthPath, filename: adminAuthPath, loaded: true, exports: (req, res, next) => next(),
};
const securityRouter = require('../src/routes/security');

const panel = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'HackingSecurityPanel.jsx'), 'utf-8');

(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/security', securityRouter);
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/api/security';

  // `fetch` 를 쓰면 연결이 남아서, 검사가 다 끝나고도 프로세스가 깨끗하게 못 끝난다
  // (윈도우에서 `Assertion failed: ... UV_HANDLE_CLOSING` 으로 죽고 종료 코드가 127 이
  // 된다 — 전부 통과했는데 `npm run check` 는 실패로 읽었다). 연결을 안 남기고 부른다
  const http = require('http');
  const call = (method, url, body) => new Promise((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const req = http.request(url, {
      method,
      agent: new http.Agent({ keepAlive: false }),
      headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {},
    }, (res) => {
      let text = '';
      res.setEncoding('utf-8');
      res.on('data', (c) => { text += c; });
      res.on('end', () => resolve({ status: res.statusCode, json: text ? JSON.parse(text) : null }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });

  // 막아둔 것 하나와 잠긴 로그인 하나를 만들어 둔다
  db.blockIp('203.0.113.7', Date.now() + 2 * HOUR, 3, '검사: 이유가 이렇게 적힌다');
  db.blockIp('203.0.113.8', Infinity, 4, '검사: 영구');
  for (let i = 0; i < 10; i++) db.recordLoginFail('acct:locked@test.local', WINDOW, MAX_ACCT, LOCK);

  const shield = (await call('GET', base + '/shield')).json;

  ok('막힌 주소를 배열로 준다', Array.isArray(shield.blocks), true);
  ok('잠긴 로그인을 배열로 준다', Array.isArray(shield.loginLocks), true);
  // 앞 단락에서 막아둔 것들도 같이 온다 — 여기서는 **방금 것이 들어 있는지**만 본다
  // (목록을 통째로 비교했다가 앞의 것들 때문에 FAIL 이 났다)
  ok('막아둔 둘이 다 온다',
    ['203.0.113.7', '203.0.113.8'].filter((ip) => !shield.blocks.some((b) => b.ip === ip)), []);

  const one = shield.blocks.find((b) => b.ip === '203.0.113.7');
  ok('왜 막혔는지도 같이 온다 (이유를 모르면 풀지 말지 못 정한다)', one.reason, '검사: 이유가 이렇게 적힌다');
  ok('남은 시간을 분으로 준다', one.remaining, 120);
  ok('언제 막았는지도 온다', typeof one.createdAt, 'string');
  // 영구를 0 으로 주면 화면이 「곧 풀림」으로 읽는다 — null 이라야 「풀 때까지」로 그린다
  ok('영구 차단은 남은 시간이 null 이다', shield.blocks.find((b) => b.ip === '203.0.113.8').remaining, null);

  const lock = shield.loginLocks.find((l) => l.target === 'acct:locked@test.local'.slice(5));
  ok('잠긴 계정이 온다', !!lock, true);
  ok('계정 잠금인지 주소 잠금인지 말해준다', lock.kind, 'account');
  ok('몇 번 틀렸는지도 온다', lock.count, 10);

  // **화면이 읽는 이름과 맞는가.** 한쪽만 고치면 화면이 조용히 빈다
  const fields = ['blocks', 'loginLocks', 'remaining', 'reason', 'createdAt', 'count', 'kind', 'target'];
  ok('화면이 읽는 이름이 응답에 다 있다',
    fields.filter((f) => panel.includes('.' + f) && !JSON.stringify(shield).includes('"' + f.replace(/^\./, '') + '"')
      && !['remaining', 'reason', 'createdAt', 'count', 'kind', 'target'].every(() => false)),
    []);
  const flat = JSON.stringify(shield);
  ok('응답에 그 이름들이 실제로 적혀 있다', fields.filter((f) => !flat.includes('"' + f + '"')), []);
  ok('화면이 그 이름들을 읽는다', fields.filter((f) => !panel.includes(f)), []);

  // 푸는 자리 둘이 실제로 푸는가
  const unlock = await call('POST', base + '/unlock-login', { key: 'acct:locked@test.local' });
  ok('잠금을 풀어준다', unlock.status, 200);
  ok('풀고 나면 잠금이 없다', db.loginLockLeft('acct:locked@test.local'), 0);

  const bogus = await call('POST', base + '/unlock-login', { key: '아무거나' });
  ok('알 수 없는 잠금은 400', bogus.status, 400);

  const unblock = await call('POST', base + '/ai-unblock/203.0.113.7');
  ok('주소 차단도 화면에서 풀린다', unblock.status, 200);
  ok('풀고 나면 파일에서도 빠진다', db.findBlock('203.0.113.7'), null);

  // ── AI 관리자 화면이 규칙을 서버에서 받는가 ──
  //
  // 그 화면은 규칙 열한 줄을 **손으로 적어두고 있었고 숫자가 틀렸다** —
  // 대량 요청은 「15/30/50회」라고 적혀 있었지만 200/300/500 이었고, 로그인 실패는
  // 「3/5/10회」였지만 7/10/20 이었다. 스팸은 「10건/분」인데 60 이고, 이미 없앤
  // SQL·몽고 인젝션도 그대로 있었다. 틀린 방어 규칙을 보고 판단하는 것이 제일 나쁘다
  const ai = (await call('GET', base + '/ai-dashboard')).json;
  ok('규칙을 서버가 준다', Array.isArray(ai.policy) && ai.policy.length > 0, true);
  ok('규칙마다 제목과 설명이 있다',
    (ai.policy || []).filter((r) => !r.title || !r.detail), []);

  // ── 우리 자신은 안 막는다 (2026-09-29) ──
  //
  // 프록시를 안 믿는 자리에서는 모든 요청이 `127.0.0.1` 로 들어온다. 그때 로그인을
  // 몇 번 틀리면 **localhost 를 막은 기록**이 파일에 적혔다 — 막히지도 않으면서
  // (맨 앞 화이트리스트로 흘러간다) 보안 화면의 차단 목록에 우리 자신이 앉았다.
  for (let i = 0; i < 9; i += 1) guard.recordLoginFailure('127.0.0.1');
  ok('localhost 는 막은 기록을 안 남긴다', db.findBlock('127.0.0.1'), null);
  // 바깥 주소는 그대로 막는다 — 위의 것이 방어막을 무르게 한 것이 아니다
  for (let i = 0; i < 9; i += 1) guard.recordLoginFailure('203.0.113.77');
  ok('  바깥 주소는 그대로 막는다', !!db.findBlock('203.0.113.77'), true);
  db.unblockIp('203.0.113.77');

  // ── 위조 토큰은 쌓이면 막는다 (2026-09-29, 자체 침투에서 되살렸다) ──
  //
  // `token_forge` 는 AI 사유 문구에만 있고 세는 데가 없었다 — 위조 토큰을 아무리
  // 던져도 그 주소는 안 막혔다. 이제 `auth` 가 서명 위조를 이 함수로 세어 올린다.
  const T2 = guard.THRESHOLDS.TOKEN_FORGE_STEP;
  for (let i = 0; i < T2.count - 1; i += 1) guard.recordTokenForgery('198.51.100.9');
  ok('문턱 전에는 안 막는다', db.findBlock('198.51.100.9'), null);
  guard.recordTokenForgery('198.51.100.9');
  ok('문턱을 넘으면 막는다', !!db.findBlock('198.51.100.9'), true);
  db.unblockIp('198.51.100.9');
  // localhost 는 세지 않는다 (프록시를 안 믿는 자리에서 우리 자신을 막지 않으려고)
  for (let i = 0; i < T2.count + 2; i += 1) guard.recordTokenForgery('127.0.0.1');
  ok('localhost 위조는 안 막는다', db.findBlock('127.0.0.1'), null);
  // **치우고 간다.** 아래에서 「화면이 센 건수 = 파일의 건수」를 보는데, 화면 값은
  // 이 위에서 이미 받아둔 것이라 여기서 하나를 더 남기면 그 줄이 어긋난다
  db.unblockIp('203.0.113.77');

  // **숫자가 코드의 상수와 같아야 한다.** 여기서 어긋나면 화면이 또 거짓말을 한다
  const T = guard.THRESHOLDS;
  const joined = (ai.policy || []).map((r) => r.detail).join(' ');
  ok('대량 요청 문턱이 코드와 같다',
    T.RATE_STEPS.every((st) => joined.includes(String(st.count))), true);
  ok('로그인 실패 문턱이 코드와 같다',
    T.LOGIN_FAIL_STEPS.every((st) => joined.includes(String(st.count))), true);
  // 위조 토큰 규칙이 화면 정책에 실려 있어야 한다 (있는 방어만 적는다)
  ok('위조 토큰 규칙을 적는다', joined.includes('위조 토큰') || /서명이 틀린/.test(joined), true);
  ok('스팸 문턱이 코드와 같다', joined.includes(String(T.SPAM_PER_MINUTE)), true);
  // 없앤 것을 아직 한다고 적으면 안 된다
  ok('없는 규칙(SQL · 몽고)을 한다고 적지 않는다', /SQL 인젝션을 막는다|몽고 인젝션을 막는다/.test(joined), false);
  ok('계정을 자동으로 지운다고 적지 않는다', /자동으로 지운다|즉시 삭제/.test(joined), false);

  // 램에서 센 숫자가 **언제부터**인지 같이 줘야 한다
  ok('언제부터 센 것인지 알려준다', typeof ai.since, 'string');
  // 지금 막혀 있는 것은 파일에서 센다 (해킹 보안과 같은 값을 봐야 한다)
  ok('막혀 있는 건수를 같이 준다', typeof ai.shield?.blocks, 'number');
  ok('잠긴 로그인 건수도 같이 준다', typeof ai.shield?.loginLocks, 'number');
  // 두 화면이 **같은 자리(파일)** 를 본다 — 한쪽만 램을 보면 값이 갈린다
  ok('해킹 보안과 같은 자리를 본다', ai.shield.blocks, db.listBlocks().length);

  const aiPanel = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'AiAdminPanel.jsx'), 'utf-8');
  ok('화면이 그 규칙을 그린다', /data\?\.policy/.test(aiPanel), true);
  // **주석은 뺀다.** 「예전에는 15/30/50 이라고 적혀 있었다」는 왜 고쳤는지의 기록이다 —
  // 그것까지 잡으면 기록을 못 남긴다 (이모지 검사에서 같은 것을 겪었다)
  const aiCode = aiPanel.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  ok('화면이 규칙을 손으로 안 적는다', /1분에 \d+회|\d+\/\d+\/\d+회/.test(aiCode), false);
  ok('화면이 언제부터 센 것인지 적는다', aiPanel.includes('data?.since'), true);
  // 탭을 안 보고 있으면 안 부른다 (예전에는 10초마다 하루 8,640번 불렀다)
  ok('보고 있을 때만 부른다', /visibilitychange/.test(aiPanel) && /document\.hidden/.test(aiPanel), true);
  ok('앞 요청이 안 왔으면 건너뛴다', /inflight/.test(aiPanel), true);
  // 같은 목록을 두 화면이 각자 그리지 않는다
  ok('차단 목록을 여기서 또 그리지 않는다', /ai-unblock/.test(aiPanel), false);

  // 화면이 그리는 자리 — 있어도 안 그리면 없는 것과 같다
  ok('화면이 지금 막혀 있는 것을 그린다', panel.includes("client.get('/security/shield')"), true);
  ok('화면에 푸는 단추가 있다',
    panel.includes('/security/ai-unblock/') && panel.includes("client.post('/security/unlock-login'"), true);
  // 로그를 못 불러와도 막힌 목록은 보여야 한다 — 사람이 「왜 막혔냐」고 물어온 순간이 그때다
  ok('로그를 못 불러와도 막힌 목록은 그린다',
    panel.slice(panel.indexOf('if (failed)'), panel.indexOf('if (failed)') + 400).includes('shieldBlock'), true);
  // ── 두 자리의 성격을 적어두는가 ──
  //
  // 10/1 까지 로그는 램에만 있어서 **서버가 다시 뜨면 사라졌고**, 막힌 목록은 DB 에
  // 있어 남았다. 그 차이를 화면에 적어두게 했다.
  //
  // 10/2 에 로그를 **파일에서도 읽게** 하면서 앞엣것이 거짓이 됐다 — 그런데 이 검사는
  // 「사라진다고 적어라」를 지키고 있었다. **검사가 거짓을 지키면 고치는 쪽이 막힌다.**
  // 뜻을 새 사실로 옮긴다: 둘 다 남지만 **로그는 2MB 에서 밀려 옛것이 없어질 수 있다.**
  ok('차단 목록은 그대로 남는다고 적어둔다', /서버가 다시 떠도 그대로 남습니다/.test(panel), true);
  ok('로그도 남는다고 적어둔다', /서버를 다시 띄워도 남습니다/.test(panel), true);
  ok('  다만 밀린다는 것도 적어둔다 (0건과 날아간 것은 다르다)',
    /2MB/.test(panel) && /비어 있다고 아무 일도 없었다는 뜻은 아닙니다/.test(panel), true);

  // 서버는 닫고 **process.exit 는 부르지 않는다.**
  // 윈도우에서 닫히는 중인 손잡이를 두고 exit 하면 libuv 가 죽는다
  // (`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`) — 종료 코드가 127 이 되고
  // `npm run check` 가 거기서 끊긴다. 검사는 전부 통과했는데 실패로 보이던 자리다.
  await new Promise((r) => server.close(r));

  // 검사가 만든 파일은 스스로 치운다.
  // **먼저 파일에 쓴 다음 지운다** — 안 그러면 지운 뒤에 종료 훅이 다시 써놓는다
  db.flushNow();
  for (const f of [TMP, TMP.replace(/\.json$/, '') + '.photos.json']) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  // 커뮤니티 검사는 **기능과 함께 걷었다** (2026-09-16).
  // 「남의 글」이라는 갈래가 앱에서 없어졌다 — 이 앱에 남은 것은 다시 자기 것뿐이다.

console.log('');
console.log('── 받아도 되는 집이 앱이 받는 집과 맞나 (CSP) ── (2026-10-20)');
//
// **체형 읽기와 횟수 세기가 운영에서 막혀 있었다.** 그 둘은 미디어파이프를 쓰고,
// 미디어파이프는 wasm 과 모델을 남의 집에서 받는다(jsdelivr · storage.googleapis).
// 그런데 CSP 는 `script-src 'self'` · `connect-src 'self' …` 였다 — **둘 다 못 받는다.**
// 홈페이지에 「하는 것」으로 적어둔 둘이 배포본에서는 안 되는 셈이었다.
//
// **눈으로는 안 보인다** — 개발 서버(비테)는 CSP 를 안 붙인다. 막히는 것은 배포본이고,
// 그때 콘솔에만 한 줄 뜬다.
//
// 그리고 CSP 가 **두 벌**이었다(화면 문서용 · 나머지 응답용). 한쪽만 고치면 또 어긋난다.
{
  const csp = require('../src/csp');
  const idx = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  const pose = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'data', 'poseModel.js'), 'utf8');

  // 한 곳에서 받아 쓰나 — 글자로 두 벌 적어두면 또 어긋난다
  ok('CSP 를 한 곳에서 받는다', /csp\.helmetDirectives\(\)/.test(idx) && /csp\.headerValue\(\)/.test(idx), true);
  ok('  화면 문서에 글자로 다시 안 적었다', /"connect-src 'self'/.test(idx), false);

  // **앱이 받는 집**을 코드에서 긁어 CSP 와 맞춰본다 — 새 주소를 쓰는 날 여기서 걸린다
  const hosts = [...new Set([...pose.matchAll(/https:\/\/([a-z0-9.-]+)/g)].map((m) => `https://${m[1]}`))];
  ok('체형·횟수가 받는 집을 찾았다', hosts.length >= 2, true);
  const header = csp.headerValue();
  const connect = (header.match(/connect-src ([^;]+)/) || [])[1] || '';
  const script = (header.match(/script-src ([^;]+)/) || [])[1] || '';
  ok('  그 집들이 connect-src 에 다 있다', hosts.filter((h) => !connect.includes(h)), []);
  // wasm 글루는 **스크립트로** 들어온다 — connect 만 열어두면 그 자리에서 막힌다
  ok('  wasm 글루 집이 script-src 에 있다', script.includes('https://cdn.jsdelivr.net'), true);
  // WebAssembly 를 세우는 데 필요하다. `'unsafe-eval'` 과 다른 것이다
  ok('  wasm 을 세울 수 있다 (wasm-unsafe-eval)', script.includes("'wasm-unsafe-eval'"), true);
  ok('  eval 은 열지 않았다', /'unsafe-eval'/.test(script.replace(/'wasm-unsafe-eval'/g, '')), false);
  // 미디어파이프가 blob 으로 일꾼을 세운다
  ok('  blob 일꾼을 받는다', /worker-src [^;]*blob:/.test(header), true);

  // **앱 코드 전체**에서 바깥 집을 긁어 CSP 와 맞춰본다 (2026-10-20).
  //
  // 처음에는 `poseModel.js` 만 봤는데, 새 주소는 **어느 파일에서나** 생긴다 —
  // 날씨 · 외부 운동 DB 처럼 하나 더 붙는 날 그 파일만 조용히 막힌다.
  // 주석에 적어둔 주소는 뺀다(「예전에는 wger.de 에 물었다」까지 세면 안 된다).
  const srcDir = path.join(__dirname, '..', '..', 'frontend', 'src');
  const jsFiles = [];
  (function walk(d) {
    for (const n of fs.readdirSync(d)) {
      const f = path.join(d, n);
      if (fs.statSync(f).isDirectory()) walk(f);
      else if (/\.(js|jsx)$/.test(n)) jsFiles.push(f);
    }
  })(srcDir);

  const codeOnly = (t) => t
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');

  const outside = new Map();
  for (const f of jsFiles) {
    const t = codeOnly(fs.readFileSync(f, 'utf8'));
    for (const m of t.matchAll(/https:\/\/([a-z0-9.-]+)/g)) {
      const host = `https://${m[1]}`;
      // 우리 집은 CSP 의 'self' 다
      if (host.includes('steel-body.onrender.com')) continue;
      if (!outside.has(host)) outside.set(host, path.basename(f));
    }
  }
  // **둘이다** — 미디어파이프의 wasm(jsdelivr) · 모델(storage.googleapis).
  // 10/21 까지는 셋이었다(wger.de 가 있었다). 그 기능을 걷으면서 이 수도 같이 줄었다 —
  // 이 줄이 「조용히 아무것도 안 보는 것」을 막는 자리라 수를 적어둔다
  ok('앱이 적어둔 바깥 집을 찾았다', outside.size >= 2, true);
  const header2 = csp.headerValue();
  ok('  그 집이 CSP 에 다 있다',
    [...outside].filter(([h]) => !header2.includes(h)).map(([h, f]) => `${h} (${f})`), []);

  // ── **거꾸로도 본다** ── (2026-10-21)
  //
  // 위의 검사는 **코드 → CSP** 한 방향이다. 그래서 **CSP 에만 남은 집**은 조용히
  // 통과했다 — 10/21 에 둘이 걸렸다:
  //
  //   api.open-meteo.com  날씨로 운동을 고르던 화면은 **8/19 에 지웠다**
  //                       (`WeatherWorkout.jsx`, 커밋 d2a6cbe). **두 달** 동안
  //                       CSP 와 `index.html` 의 DNS 프리페치에만 남아 있었다
  //   wger.de             외부 운동 DB. 그쪽이 API 를 바꿔서 찾기 길이 404 가 됐다
  //
  // 더 나쁜 것은 10/20 에 **그 두 집의 DNS 를 미리 찾아두게 켠 것**이다 —
  // 「적어둔 두 줄이 아무 일도 안 한다」고 고쳤는데, 알고 보니 **안 가는 집**이었다.
  //
  // CSP 는 **좁을수록 지킨다.** 안 쓰는 집을 열어두면 지키는 힘만 줄어든다.
  // 그리고 이 검사가 있으면 **기능을 걷을 때 열어둔 자리도 같이 걷힌다.**
  {
    const allowed = new Set();
    for (const list of Object.values(csp.DIRECTIVES)) {
      for (const v of list) if (/^https:\/\//.test(v)) allowed.add(v);
    }
    ok('CSP 가 허락한 바깥 집을 찾았다', allowed.size >= 2, true);
    // 글꼴은 `index.html` 이 부른다 — 앱 코드(js·jsx)에는 안 적힌다
    const FROM_HTML = new Set(['https://fonts.googleapis.com', 'https://fonts.gstatic.com']);
    const html = fs.readFileSync(
      path.join(__dirname, '..', '..', 'frontend', 'index.html'), 'utf8');
    const unused = [...allowed]
      .filter((h) => !outside.has(h))
      .filter((h) => !(FROM_HTML.has(h) && html.includes(h)));
    ok('  허락했는데 앱이 안 묻는 집', unused, []);

    // `index.html` 의 DNS 프리페치도 같다 — **안 가는 집의 주소를 미리 찾지 않는다.**
    // CSP 에 있는 것만으로는 모른다(걷은 기능의 집이 CSP 에 남아 있을 수 있다) —
    // **실제로 묻는 집**과 맞춘다
    const reached = new Set([...outside.keys(), ...[...FROM_HTML].filter((h) => html.includes(h))]);
    const prefetch = [...html.matchAll(/rel="dns-prefetch"\s+href="(https:\/\/[^"]+)"/g)]
      .map((m) => m[1]);
    ok('  미리 찾아두는 집이 CSP 에 다 있다', prefetch.filter((h) => !allowed.has(h)), []);
    ok('  미리 찾아두는 집을 앱이 실제로 묻는다', prefetch.filter((h) => !reached.has(h)), []);
  }

  console.log('');
  console.log('── 앱이 쓰는 기기 권한이 열려 있나 ── (2026-10-20)');
  //
  // `Permissions-Policy` 에 적혀 있던 말은 **「이 앱은 셋 다 안 쓴다」**였다
  // (`camera=(), microphone=(), geolocation=()`). 그런데 **둘을 쓴다** —
  // 카메라(횟수 세기 · 체형 사진) · 마이크(회복 시간, 숨이 가라앉는 초를 듣는다).
  // `camera=()` 는 「아무도 못 쓴다」는 뜻이라 **배포본에서 그 둘이 통째로 막혀
  // 있었다** — 브라우저가 묻기도 전에 거절한다.
  //
  // **눈으로는 안 보인다** — 개발 서버(비테)는 이 헤더를 안 붙인다.
  //
  // 그래서 **코드가 쓰는 것과 이 줄을 맞춰본다.**
  {
    const policy = require('../src/config/security').PERMISSIONS_POLICY;
    const allowed = (f) => policy.includes(f + '=(self)');
    const blocked = (f) => policy.includes(f + '=()');

    // 앱 코드가 기기를 부르는 자리 — 주석은 뺀다
    const uses = (re) => jsFiles.some((f) => re.test(codeOnly(fs.readFileSync(f, 'utf8'))));
    const wantsCamera = uses(/getUserMedia\(\s*\{[^}]*video/s) || uses(/video:\s*\{/);
    const wantsMic = uses(/getUserMedia\(\s*\{[^}]*audio/s) || uses(/audio:\s*true/);
    const wantsGeo = uses(/navigator\.geolocation/);

    ok('카메라를 쓴다 (횟수 세기 · 체형 사진)', wantsCamera, true);
    ok('  그래서 우리 집에 열려 있다', allowed('camera'), true);
    ok('마이크를 쓴다 (회복 시간 — 숨을 듣는다)', wantsMic, true);
    ok('  그래서 우리 집에 열려 있다', allowed('microphone'), true);
    // 안 쓰는 것은 막아둔다 — 끼어든 스크립트가 있어도 브라우저가 먼저 거절한다
    ok('위치는 안 쓴다', wantsGeo, false);
    ok('  그래서 막아뒀다', blocked('geolocation'), true);
    // `*` 로 열면 iframe 에 끼어든 남의 페이지도 쓸 수 있다
    ok('아무에게나 열지 않았다', /\*/.test(policy), false);
  }
}
  console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
  process.exit(bad ? 1 : 0);

})();
