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

// 검사가 만든 파일은 스스로 치운다
for (const f of [TMP, TMP.replace(/\.json$/, '') + '.photos.json']) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
