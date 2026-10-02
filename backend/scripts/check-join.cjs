// 가입은 **메일 주인에게만** 내어주는가.
//
//   npm run join
//
// 2026-10-02 에 붙인 자리다. 그 전까지 가입은 「그 주소를 적을 수 있는 사람」이면
// 통과였고, 주소를 적는 것은 주인이라는 뜻이 아니다. 그래서 길 둘이 열려 있었다:
//
//   1. **남의 주소로 미리 가입해두기.** 이 앱은 이메일 하나로 계정을 잇는다
//      (`oauth.js` 의 `findUserByEmail`). 내 주소로 누가 먼저 이메일 가입을 해두면,
//      내가 구글로 들어올 때 그 사람이 만든 계정에 붙는다 — 비밀번호는 그 사람이 안다
//   2. **관리자 가로채기.** `ADMIN_EMAIL` 과 같은 주소면 `admin` 이 달린다. 배포 직후
//      빈 DB 에 그 주소로 먼저 가입하는 사람이 관리자가 된다
//
// 둘 다 「주소가 제 것이 아닌」 경우라 번호 하나로 닫힌다. 여기서는 그 번호를
// **진짜 라우터에 http 로 쳐서** 본다 — 가짜로 흉내내면 정작 라우터가 빠뜨린 것을 못 본다.

const path = require('path');
const fs = require('fs');
const TMP_DB = path.join(__dirname, '..', '.check-join.json');
fs.writeFileSync(TMP_DB, JSON.stringify({ users: [], _nextId: {} }), 'utf-8');
process.env.DB_FILE = TMP_DB;
process.env.JWT_SECRET = 'check-secret-check-secret-check-secret';
process.env.NODE_ENV = 'development';
// SMTP 열쇠를 비워 둔다 — 메일이 안 나가므로 번호가 응답에 실려 온다(그래야 쳐볼 수 있다)
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;
delete process.env.DEV_ECHO_CODE;
// 관리자 가로채기를 재보려고 **일부러** 넣는다
process.env.ADMIN_EMAIL = 'boss@gmail.com';

const express = require('express');
const cookieParser = require('cookie-parser');
const http = require('http');
const auth = require('../src/routes/auth');
const db = require('../src/db');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' -> ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', auth);
const server = app.listen(0, run);

function post(p, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body || {});
    const req = http.request({
      port: server.address().port, path: p, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch (e) { /* 글로 떨어지면 null */ }
        resolve({ status: res.statusCode, body: json });
      });
    });
    req.on('error', reject);
    req.end(data);
  });
}

const join = (email, extra) => post('/api/auth/register', Object.assign({
  email, password: 'abcd1234', nickname: '아무개', username: 'u' + Math.random().toString(36).slice(2, 8),
}, extra));

async function codeFor(email) {
  const sent = await post('/api/auth/send-code', { email });
  return sent.body && sent.body.code;
}

async function run() {
  try {
    console.log('── 번호 없이는 가입이 안 된다 ──');
    const none = await join('nobody@test.local');
    ok('번호를 안 보내면 거절한다', none.status, 400);
    ok('  무엇이 빠졌는지 말해준다', none.body.error, '이메일로 받은 인증번호를 입력해주세요');
    ok('  계정이 생기지 않았다', !!db.findUserByEmail('nobody@test.local'), false);

    const blank = await join('nobody@test.local', { code: '' });
    ok('빈 번호도 거절한다', blank.status, 400);
    const notText = await join('nobody@test.local', { code: 123456 });
    ok('글이 아닌 번호도 거절한다', notText.status, 400);

    console.log('');
    console.log('── 받지 않은 번호를 꾸며 넣어도 안 된다 ──');
    const guess = await join('guess@test.local', { code: '000000' });
    ok('발송 기록이 없으면 거절한다', guess.status, 400);
    ok('  까닭을 말해준다', guess.body.error, '인증번호를 먼저 발송해주세요');
    ok('  계정이 생기지 않았다', !!db.findUserByEmail('guess@test.local'), false);

    console.log('');
    console.log('── 받은 뒤라도 틀리면 안 된다 ──');
    const real = await codeFor('me@test.local');
    ok('번호가 여섯 자리로 온다', /^[0-9]{6}$/.test(String(real)), true);
    const wrong = await join('me@test.local', { code: real === '999999' ? '111111' : '999999' });
    ok('틀린 번호는 거절한다', wrong.status, 400);
    ok('  까닭을 말해준다', wrong.body.error, '인증번호가 틀렸어요');
    ok('  계정이 생기지 않았다', !!db.findUserByEmail('me@test.local'), false);

    console.log('');
    console.log('── 맞는 번호면 들어간다 ──');
    const good = await join('me@test.local', { code: real });
    ok('가입된다', good.status, 201);
    ok('  그 자리에서 로그인된다 (토큰이 나온다)', !!good.body.token, true);
    ok('  계정이 생겼다', !!db.findUserByEmail('me@test.local'), true);

    // **번호는 한 번만 쓴다.** 안 지우면 같은 번호로 다른 계정을 또 만들 수 있다
    const again = await join('me@test.local', { code: real });
    ok('같은 번호를 다시 쓸 수 없다', again.status, 400);

    console.log('');
    console.log('── 다른 주소로 받은 번호는 그 주소에만 통한다 ──');
    //
    // 번호 해시에 주소를 섞는 까닭이다. 안 섞으면 내 주소로 번호를 받아
    // **남의 주소로** 가입하는 길이 열린다
    const mine = await codeFor('a@test.local');
    const crossed = await join('b@test.local', { code: mine });
    ok('내 번호로 남의 주소를 가입할 수 없다', crossed.status, 400);
    ok('  그 주소로 계정이 생기지 않았다', !!db.findUserByEmail('b@test.local'), false);

    console.log('');
    console.log('── 아이디가 겹쳐 되돌려질 때 번호가 살아 있는가 ──');
    //
    // 여기서 터지는 흔한 까닭은 아이디 중복이다. 번호를 먼저 지워버리면 아이디만
    // 바꿔 다시 누를 때 번호를 또 받아야 한다 — 사람이 가장 짜증내는 자리다
    const c2 = await codeFor('dup@test.local');
    const taken = await post('/api/auth/register',
      { email: 'dup@test.local', password: 'abcd1234', nickname: '아무개', username: 'dup01', code: c2 });
    ok('첫 가입은 된다', taken.status, 201);
    const c3 = await codeFor('dup2@test.local');
    const clash = await post('/api/auth/register',
      { email: 'dup2@test.local', password: 'abcd1234', nickname: '아무개', username: 'dup01', code: c3 });
    ok('같은 아이디는 409 로 막힌다', clash.status, 409);
    const retry = await post('/api/auth/register',
      { email: 'dup2@test.local', password: 'abcd1234', nickname: '아무개', username: 'dup02', code: c3 });
    ok('  아이디만 바꿔 **같은 번호로** 다시 된다', retry.status, 201);

    console.log('');
    console.log('── 관리자 가로채기 ── (ADMIN_EMAIL=boss@gmail.com)');
    const steal = await join('boss@gmail.com');
    ok('번호 없이 관리자 주소로 가입할 수 없다', steal.status, 400);
    ok('  계정이 생기지 않았다', !!db.findUserByEmail('boss@gmail.com'), false);
    const bossCode = await codeFor('boss@gmail.com');
    const boss = await join('boss@gmail.com', { code: bossCode });
    ok('메일을 받은 주인은 가입된다', boss.status, 201);
    ok('  그 사람에게 관리자가 붙는다', boss.body.role, 'admin');
    // 다른 주소는 번호가 맞아도 관리자가 아니다
    const other = await codeFor('nobody2@test.local');
    const plain = await join('nobody2@test.local', { code: other });
    ok('다른 주소는 관리자가 아니다', plain.body.role, 'user');

    console.log('');
    console.log('── 틀린 번호를 계속 넣으면 막히는가 ──');
    const brute = await codeFor('brute@test.local');
    const tries = [];
    for (let i = 0; i < 7; i++) tries.push((await join('brute@test.local', { code: '000000' })).status);
    // 넘긴 그 번에 429 가 뜨고, 그 자리에서 번호를 지운다. **그 다음 번은 다시 400** 이다
    // ('먼저 발송해주세요') — 마지막 하나만 보면 이 자리를 못 본다
    ok('여섯 자리는 백만 가지뿐이라 횟수를 막는다', tries.includes(429), true);
    ok('  막자마자 번호를 지운다 (다음 번은 발송부터)', tries[tries.length - 1], 400);
    const afterLock = await join('brute@test.local', { code: brute });
    ok('  막힌 뒤에는 맞는 번호도 안 통한다 (다시 받아야 한다)', afterLock.status, 400);
    ok('  계정이 생기지 않았다', !!db.findUserByEmail('brute@test.local'), false);
  } catch (err) {
    bad += 1;
    console.log('FAIL 검사가 도중에 터졌다 -> ' + err.message);
  } finally {
    server.close();
    console.log('');
    console.log(bad ? bad + '건 실패' : '전부 통과');
    // 검사용 DB 는 지운다. db 는 500ms 뒤에 파일을 쓰므로 **그 뒤에** 지운다
    setTimeout(() => {
      try { fs.unlinkSync(TMP_DB); } catch (e) { /* 이미 없으면 그만이다 */ }
      process.exit(bad ? 1 : 0);
    }, 900);
  }
}
