// 구글 로그인을 **구글 없이** 한 바퀴 돌려본다.
//
//   npm run oauth
//
// 열쇠(GOOGLE_CLIENT_ID)가 없으면 이 길은 끝까지 눌러볼 수가 없다. 열쇠를 넣기
// 전까지 「되는지 안 되는지」를 아무도 모르는 채로 두게 된다 — 그래서 **구글만
// 가짜로 세우고** 나머지는 진짜 코드로 돌린다. 바깥으로 나가는 요청은 axios 의
// 어댑터 자리에서 통째로 가로챈다 (구글에 진짜로 가지 않는다).
//
// 여기서 보는 것:
//   1. 처음 들어온 사람 — 계정이 만들어지고, 쿠키 셋이 나가고, created=1 이 붙는가
//   2. 두 번째 로그인 — created 가 **안 붙는가**. 화면의 「이름을 정하세요」가 이
//      표시로 갈린다. 9/3 까지는 소셜로 들어올 때마다 그 단계가 나왔다
//   3. 구글이 이메일을 안 준 경우 — 계정을 안 만들고 돌려보내는가. 계정을 찾는 열쇠는
//      이메일 하나라, 빈 값이면 **서로 다른 사람이 계정 하나에 묶인다**
//   4. 열쇠가 없을 때 — 구글로 보내지 않고 앱으로 돌려보내는가
//   5. 아이디는 대소문자를 가리지 않는가 (회원가입 쪽)

// ── 환경을 먼저 세운다. db.js 는 읽히는 순간 DB 경로를 정한다 ──
const path = require('path');
const fs = require('fs');
const TMP_DB = path.join(__dirname, '..', '.check-oauth.json');
fs.writeFileSync(TMP_DB, JSON.stringify({ users: [], _nextId: {} }), 'utf-8');
process.env.DB_FILE = TMP_DB;
process.env.JWT_SECRET = 'check-secret-check-secret-check-secret';
process.env.NODE_ENV = 'development';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.GOOGLE_CLIENT_ID = 'check-id';
process.env.GOOGLE_CLIENT_SECRET = 'check-secret';
delete process.env.ADMIN_EMAIL;   // 검사 계정이 관리자로 승격되면 안 된다

// ── 구글을 가짜로 세운다 ──
const axios = require('axios');
let PROFILE = { email: 'me@gmail.com', name: '근호' };
axios.defaults.adapter = async (config) => {
  const url = String(config.url || '');
  return {
    data: url.includes('/token') ? { access_token: 'tok' } : PROFILE,
    status: 200, statusText: 'OK', headers: {}, config,
  };
};

const express = require('express');
const cookieParser = require('cookie-parser');
const http = require('http');
const oauth = require('../src/routes/oauth');
const db = require('../src/db');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' -> ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const { successUrl, findOrCreateUser } = oauth;
const q = (url) => Object.fromEntries(new URL(url).searchParams);

console.log('── 소셜 로그인이 화면에 무엇을 들려 보내는가 ──');
ok('처음 만들어진 계정이면 created 를 붙인다',
  q(successUrl('http://x', { nickname: '근호', email: 'a@b.c', created: true })).created, '1');
ok('이미 있던 계정이면 안 붙인다',
  q(successUrl('http://x', { nickname: '근호', email: 'a@b.c', created: false })).created, undefined);
ok('되살아난 계정이면 restored 를 붙인다',
  q(successUrl('http://x', { nickname: '근호', email: 'a@b.c', restored: true })).restored, '1');
const tricky = successUrl('http://x', { nickname: 'a&b=c 근호', email: 'a+b@c.d', created: true });
ok('이름에 & 가 있어도 그대로 읽힌다', q(tricky).nickname, 'a&b=c 근호');
ok('이메일에 + 가 있어도 그대로 읽힌다', q(tricky).email, 'a+b@c.d');
ok('오는 곳은 로그인 화면이다', new URL(tricky).pathname, '/login');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/oauth', oauth);
const server = app.listen(0, run);

function get(p, headers) {
  return new Promise((res, rej) => {
    const req = http.get({
      host: 'localhost', port: server.address().port, path: p, headers: headers || {},
    }, (r) => {
      r.on('data', () => {});
      r.on('end', () => res({
        status: r.statusCode,
        loc: r.headers.location || '',
        cookies: r.headers['set-cookie'] || [],
      }));
    });
    req.on('error', rej);
  });
}

// 구글에 갔다 왔다고 치고 콜백까지 한 번 돈다
async function login() {
  const start = await get('/api/oauth/google', { Referer: 'http://localhost:5173/login' });
  const state = new URL(start.loc).searchParams.get('state');
  const back = await get('/api/oauth/google/callback?code=abc&state=' + state);
  return { start, loc: back.loc, cookies: back.cookies, status: back.status };
}

async function run() {
  try {
    console.log('');
    console.log('── 구글 로그인 한 바퀴 (구글만 가짜) ──');

    const first = await login();
    ok('구글로 보낸다', first.start.status, 302);
    ok('보내는 곳은 구글이다', new URL(first.start.loc).host, 'accounts.google.com');
    ok('돌아올 주소를 같이 준다',
      new URL(first.start.loc).searchParams.get('redirect_uri').endsWith('/api/oauth/google/callback'), true);

    ok('처음 들어온 사람은 로그인 화면으로 돌아온다', new URL(first.loc).pathname, '/login');
    ok('  성공이라고 말한다', q(first.loc).oauth, 'success');
    ok('  처음이라고 알려준다 (이름 정하기는 이때만)', q(first.loc).created, '1');
    ok('  로그인 열쇠 셋을 쥐여준다',
      first.cookies.map((c) => c.split('=')[0]).sort(), ['sb_access', 'sb_csrf', 'sb_refresh']);
    ok('  계정이 만들어졌다', !!db.findUserByEmail('me@gmail.com'), true);
    ok('  이름은 구글이 준 것이다', db.findUserByEmail('me@gmail.com').nickname, '근호');

    const idFirst = db.findUserByEmail('me@gmail.com').id;
    const second = await login();
    ok('두 번째 로그인도 성공한다', q(second.loc).oauth, 'success');
    ok('  이번에는 처음이 아니라고 한다', q(second.loc).created, undefined);
    ok('  같은 계정으로 들어간다 (하나 더 생기지 않는다)', db.findUserByEmail('me@gmail.com').id, idFirst);

    // 구글이 이메일을 안 주는 경우가 있다 (동의를 안 했거나 scope 가 빠졌을 때)
    PROFILE = { name: '이메일없음' };
    const noEmail = await login();
    ok('이메일을 안 주면 계정을 안 만든다', q(noEmail.loc).error, 'google_failed');
    ok('  빈 이메일 계정이 생기지 않았다', !!db.findUserByEmail(''), false);
    PROFILE = { email: 'me@gmail.com', name: '근호' };

    // 열쇠가 없으면 구글로 보내면 안 된다 — 구글의 영어 오류 화면에는 돌아올 길이 없다
    const saved = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;
    const noKey = await get('/api/oauth/google', { Referer: 'http://localhost:5173/login' });
    ok('열쇠가 없으면 앱으로 돌려보낸다', q(noKey.loc).error, 'google_not_configured');
    process.env.GOOGLE_CLIENT_ID = saved;

    // state 는 한 번 쓰면 끝이다. 뒤로 가기나 지난 링크로 다시 오는 자리
    const stale = await get('/api/oauth/google/callback?code=abc&state=zzz');
    ok('지난 링크로 오면 로그인 화면으로 돌려보낸다', q(stale.loc).error, 'invalid_state');

    console.log('');
    console.log('── 이메일 없이 계정을 만들지 않는가 (함수 자리에서) ──');
    const cases = [
      ['이메일이 없으면 거절한다', undefined],
      ['빈 글자도 거절한다', ''],
      ['골뱅이가 없으면 거절한다', 'nobody'],
    ];
    for (const [name, email] of cases) {
      let err = null;
      try { await findOrCreateUser(email, '아무개', 'google'); } catch (e) { err = e.message; }
      ok(name, err, 'OAUTH_NO_EMAIL');
    }

    // ── 아이디는 대소문자를 가리지 않는다 ──
    //
    // 회원가입 화면은 친 것을 소문자로 낮춰 보낸다. 그런데 서버 조회는 대소문자를
    // 그대로 가리고 있었다 — `Kevin12` 로 가입한 줄 아는 사람이 로그인 화면에
    // `Kevin12` 를 치면 **없는 계정**이 된다. 이메일은 이미 맞추고 있었다
    console.log('');
    console.log('── 아이디는 대소문자를 가리지 않는가 ──');
    db.createUser('case@test.local', 'x', '대소문자', 'CaseTest01');
    ok('소문자로 찾는다', !!db.findUserByUsername('casetest01'), true);
    ok('대문자로 찾는다', !!db.findUserByUsername('CASETEST01'), true);
    ok('친 그대로도 찾는다', !!db.findUserByUsername('CaseTest01'), true);
    ok('앞뒤 공백은 무시한다', !!db.findUserByUsername('  casetest01 '), true);
    ok('다른 아이디는 안 찾는다', !!db.findUserByUsername('casetest02'), false);
    let dup = null;
    try { db.createUser('other@test.local', 'x', '또', 'casetest01'); } catch (e) { dup = e.message; }
    ok('대소문자만 다른 아이디로는 못 만든다', dup, 'DUPLICATE_USERNAME');
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
