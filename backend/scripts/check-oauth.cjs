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
//   6. **네 길이 다 도는가** (2026-10-07) — 구글 · 네이버 · 인스타그램 · 트위터(X)
//   7. **메일을 안 주는 제공자를 어떻게 다루는가** — 인스타 · X 는 메일을 주지
//      않는다. 지어내지 않고 **묻는 걸음**으로 보내는지, 그 사이에 계정을 안
//      만드는지, 쪽지 없이 그 길을 부르면 막히는지
//   8. **메일을 지어내는 자리가 없는가** — 전임 코드가 `ig_<번호>@instagram.com`
//      을 만들어 9/18 의 「메일 없으면 계정 안 만든다」를 비껴갔다
//   9. **실패 까닭이 제공자마다 갈라지는가** — 구글만 갈래를 갖고 있었다

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
// 나머지 제공자도 **열쇠가 있다고 치고** 한 바퀴 돌린다. 없으면 길 입구에서
// `*_not_configured` 로 되돌아와서 그 뒤를 아예 못 본다
process.env.NAVER_CLIENT_ID = 'check-naver';
process.env.NAVER_CLIENT_SECRET = 'check-naver-secret';
process.env.INSTAGRAM_APP_ID = 'check-ig';
process.env.INSTAGRAM_APP_SECRET = 'check-ig-secret';
process.env.TWITTER_CLIENT_ID = 'check-x';
delete process.env.ADMIN_EMAIL;   // 검사 계정이 관리자로 승격되면 안 된다

// ── 구글을 가짜로 세운다 ──
const axios = require('axios');
let PROFILE = { email: 'me@gmail.com', name: '근호' };
axios.defaults.adapter = async (config) => {
  const url = String(config.url || '');
  // 페북의 토큰 주소는 `/oauth/access_token` 이라 `/token` 으로는 안 걸린다 —
  // 그러면 토큰 자리에 사람 정보가 와서 **무엇을 보고 있는지가 흐려진다**
  const isToken = url.includes('/token') || url.includes('access_token');
  // ── 인스타는 **토큰 응답에 `user_id` 를 실어 보낸다** ── (2026-10-09)
  //
  // 가짜가 그걸 빠뜨리고 있었다. 그래서 「`/me` 가 아니라 토큰 응답으로 누구인지
  // 정한다」를 검사가 **못 보고 있었다** — 진짜 인스타가 주는 모양으로 맞춘다
  if (isToken) {
    return {
      data: { access_token: 'tok', ...(PROFILE.user_id ? { user_id: PROFILE.user_id } : {}) },
      status: 200, statusText: 'OK', headers: {}, config,
    };
  }
  // `/me` 가 죽는 날을 흉내 낸다 — 이름은 못 가져와도 **로그인은 계속돼야** 한다
  if (ME_DOWN && url.includes('graph.instagram.com')) {
    const e = new Error('Request failed with status code 400');
    e.response = { status: 400, data: { error: { message: 'Tried accessing nonexisting field' } } };
    throw e;
  }
  return {
    data: PROFILE,
    status: 200, statusText: 'OK', headers: {}, config,
  };
};
let ME_DOWN = false;

const express = require('express');
const cookieParser = require('cookie-parser');
const http = require('http');
const oauth = require('../src/routes/oauth');
const db = require('../src/db');
// 나가는 길에 임시 DB 를 치운다 — `db.js` 의 exit 손이 되살리는 것까지 (2026-10-28)
require('./_tmpdb.cjs')(TMP_DB);

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
// 번호를 받아야 메일 걸음을 끝까지 돌 수 있다 — 가입 쪽 길도 같이 세운다
app.use('/api/auth', require('../src/routes/auth'));
const server = app.listen(0, run);

function get(p, headers) {
  return new Promise((res, rej) => {
    const req = http.get({
      host: 'localhost', port: server.address().port, path: p, headers: headers || {},
    }, (r) => {
      let body = '';
      r.on('data', (c) => { body += c; });
      r.on('end', () => res({
        status: r.statusCode,
        loc: r.headers.location || '',
        cookies: r.headers['set-cookie'] || [],
        body,
      }));
    });
    req.on('error', rej);
  });
}

// 받은 쿠키를 다음 요청에 들고 간다 — **브라우저가 하는 일**이다.
// 2026-09-18 부터 서버가 state 를 쿠키로도 주고 콜백에서 그 둘을 맞춰본다
const jarOf = (res) => (res.cookies || []).map((c) => c.split(';')[0]).join('; ');

/** 메일을 받는 길은 POST 다 — 쪽지(쿠키)를 들고 가야 통한다 */
function post(p, body, headers) {
  const payload = JSON.stringify(body || {});
  return new Promise((res, rej) => {
    const req = http.request({
      host: 'localhost', port: server.address().port, path: p, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...(headers || {}),
      },
    }, (r) => {
      let out = '';
      r.on('data', (c) => { out += c; });
      r.on('end', () => res({
        status: r.statusCode,
        body: out,
        json: (() => { try { return JSON.parse(out); } catch { return null; } })(),
        cookies: r.headers['set-cookie'] || [],
      }));
    });
    req.on('error', rej);
    req.end(payload);
  });
}

// 제공자에 갔다 왔다고 치고 콜백까지 한 번 돈다.
//
// **구글 전용이었다** (2026-10-07 에 넓혔다). 카카오 · 네이버 · 페북은 같은 틀을
// 쓰는데 검사가 구글만 돌고 있어서, 그 셋은 9/18 에 `startOauth` 를 빠뜨려
// **100% invalid_state 로 떨어지던 것**도 사람이 손으로 찾았다
async function loginWith(provider, opts = {}) {
  const start = await get('/api/oauth/' + provider, { Referer: 'http://localhost:5173/login' });
  const state = new URL(start.loc).searchParams.get('state');
  const headers = opts.noCookie ? {} : { Cookie: opts.cookie || jarOf(start) };
  const back = await get('/api/oauth/' + provider + '/callback?code=abc&state=' + state, headers);
  return { start, state, loc: back.loc, cookies: back.cookies, status: back.status };
}
const login = (opts = {}) => loginWith('google', opts);

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
      first.cookies.map((c) => c.split('=')[0]).filter((n) => n !== 'sb_oauth').sort(),
      ['sb_access', 'sb_csrf', 'sb_refresh']);
    // **쓰고 나면 버린다.** state 쿠키를 그대로 두면 다음 로그인에 옛 값이 실려 온다
    ok('  쓰고 난 state 쿠키는 버린다',
      first.cookies.some((c) => c.startsWith('sb_oauth=') && /(Max-Age=0|Expires=Thu, 01 Jan 1970)/i.test(c)), true);
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
    // 오류를 구분해 보낸다 (2026-09-18) — 「다시 시도」로 뭉치면 영영 안 되는 일에 그 말을 한다
    ok('이메일을 안 주면 계정을 안 만든다', q(noEmail.loc).error, 'google_no_email');
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
    console.log('── 시작한 그 브라우저에서 돌아온 것인가 ── (2026-09-18)');
    //
    // state 는 무작위라 남이 맞힐 수는 없는데, **이미 제 손에 든 state 를 남의
    // 브라우저에 쓰게 할 수는 있었다** — 공격자가 제 구글 계정으로 시작해 만든 콜백
    // 링크를 누르게 하면 그 사람 브라우저에 **공격자 계정의 쿠키**가 심긴다.
    // 그 뒤로 그 사람이 적는 운동이 공격자 계정에 쌓인다 (로그인 CSRF).
    const startOnly = await get('/api/oauth/google', { Referer: 'http://localhost:5173/login' });
    ok('시작할 때 state 를 쿠키로도 준다',
      (startOnly.cookies || []).some((c) => c.startsWith('sb_oauth=')), true);
    ok('  그 쿠키는 스크립트가 못 읽는다 (HttpOnly)',
      (startOnly.cookies || []).some((c) => c.startsWith('sb_oauth=') && /HttpOnly/i.test(c)), true);
    ok('  돌아오는 길에 실리게 Lax 로 둔다 (Strict 면 아예 안 실린다)',
      (startOnly.cookies || []).some((c) => c.startsWith('sb_oauth=') && /SameSite=Lax/i.test(c)), true);

    const stolen = await login({ noCookie: true });
    ok('쿠키 없이 콜백에 오면 막는다', q(stolen.loc).error, 'invalid_state');
    ok('  로그인 열쇠를 안 준다', stolen.cookies.some((c) => c.startsWith('sb_access=')), false);
    const wrongJar = await login({ cookie: 'sb_oauth=deadbeefdeadbeef' });
    ok('남의 state 쿠키로 와도 막는다', q(wrongJar.loc).error, 'invalid_state');

    console.log('');
    console.log('── 서버가 다시 떠도 로그인이 이어지는가 ── (2026-10-13)');
    //
    // **이 앱이 사는 곳(Render 무료 판)은 15분만 놀면 잠든다.** 배포하면 프로세스가
    // 아예 새로 뜬다. state 를 서버 메모리의 Map 에 담던 동안은 그때마다 그 Map 이
    // 비어서, 자다 깬 서버에서 소셜 단추를 누른 사람은 **한 명도 못 들어왔다**
    // (`invalid_state`). 폰 앱도 같은 주소를 여니 앱에서도 똑같았다.
    //
    // 프로세스가 새로 뜬 것을 흉내 낸다 — 라우터를 캐시에서 지우고 다시 읽으면
    // 그 모듈의 모든 메모리가 새로 생긴다. DB 는 그대로 둔다(배포해도 남는 쪽이다).
    const woke = await get('/api/oauth/google', { Referer: 'http://localhost:5173/login' });
    const wokeState = new URL(woke.loc).searchParams.get('state');
    delete require.cache[require.resolve('../src/routes/oauth')];
    const app2 = express();
    app2.use(cookieParser());
    app2.use('/api/oauth', require('../src/routes/oauth'));
    const server2 = app2.listen(0);
    await new Promise((r) => server2.once('listening', r));
    const afterBoot = await new Promise((res, rej) => {
      const r = http.get({
        host: 'localhost', port: server2.address().port,
        path: '/api/oauth/google/callback?code=abc&state=' + wokeState,
        headers: { Cookie: jarOf(woke) },
      }, (x) => { x.resume(); res({ loc: x.headers.location || '', cookies: x.headers['set-cookie'] || [] }); });
      r.on('error', rej);
    });
    server2.close();
    ok('자다 깬 서버에서도 로그인이 끝난다', q(afterBoot.loc).oauth, 'success');
    ok('  로그인 열쇠를 쥐여준다',
      afterBoot.cookies.some((c) => c.startsWith('sb_access=')), true);
    // 담는 곳이 쿠키 하나이므로 **서명이 맞아야** 통한다. 손으로 고친 쿠키는 막힌다
    const forged = Buffer.from(JSON.stringify({ s: wokeState, t: Date.now(), r: '' })).toString('base64url');
    const tampered = await login({ cookie: 'sb_oauth=' + forged + '.' + 'x'.repeat(43) });
    ok('서명이 안 맞는 state 쿠키는 막는다', q(tampered.loc).error, 'invalid_state');
    const noSig = await login({ cookie: 'sb_oauth=' + forged });
    ok('  서명이 아예 없어도 막는다', q(noSig.loc).error, 'invalid_state');

    console.log('');
    console.log('── 구글이 「확인 안 된 메일」이라고 하면 ── (2026-09-18)');
    //
    // 이 앱은 **이메일 하나로 계정을 잇는다.** 그래서 확인 안 된 주소를 그대로 받으면
    // 남의 메일 주소를 적어둔 계정으로 들어와 그 사람의 기록을 그대로 받는 길이 된다
    PROFILE = { email: 'someone.else@gmail.com', name: '확인안됨', verified_email: false };
    const unverified = await login();
    ok('계정을 안 만들고 돌려보낸다', q(unverified.loc).error, 'google_unverified');
    ok('  그 이메일로 계정이 생기지 않았다', !!db.findUserByEmail('someone.else@gmail.com'), false);
    // **모른다고 할 때는 막지 않는다** — 그 필드를 안 주는 제공자도 있다
    PROFILE = { email: 'noflag@gmail.com', name: '모름' };
    const noFlag = await login();
    ok('확인 여부를 안 주면 막지 않는다', q(noFlag.loc).oauth, 'success');
    PROFILE = { email: 'me@gmail.com', name: '근호' };

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
    {
      let err = null;
      try {
        await findOrCreateUser('x@y.z', '아무개', 'google', { emailVerified: false });
      } catch (e) { err = e.message; }
      ok('확인 안 된 메일도 거절한다', err, 'OAUTH_EMAIL_UNVERIFIED');
    }

    console.log('');
    console.log('── 어느 길이 열려 있나 ── (2026-10-07)');
    const list = JSON.parse((await get('/api/oauth/providers')).body);
    // ── 목록은 넷이다 ── (2026-10-09)
    //
    // 10/7 에는 둘이었다. 인스타그램 · 트위터(X)는 열쇠를 못 받아 **목록에서만**
    // 뺐었고(길은 그대로 살아 있었다), 10/9 에 되돌렸다.
    //
    // **키가 있는 것과 `true` 인 것은 다르다** — 열쇠가 아직 안 꽂혔으면 `false` 로
    // 오고 화면에는 단추가 안 뜬다. 그래서 켜짐 여부는 아래에서 따로 본다
    // 인스타그램 · X 는 **10/9 에 뺐다.** 인스타는 열쇠까지 꽂았는데 인스타 쪽이
    // 막았고(프로페셔널 계정만), X 는 열쇠 받는 손을 안 쓰기로 했다.
    // **길은 둘 다 살아 있다** — 아래에서 끝까지 돌려보는 검사가 그 증거다
    ok('목록은 둘이다', Object.keys(list).sort(), ['google', 'naver']);
    // **이 길은 로그인 횟수에 같이 깎이면 안 된다** (2026-10-07).
    // 로그인·가입 화면이 열릴 때마다 부르는 길인데 시간당 10 에 같이 세고 있었다 —
    // 화면을 열두 번 열면 429 가 되고, 그때 화면은 「못 물어봤다」로 받아 **구글만
    // 그린다.** 눌러본 적도 없는데 소셜 단추가 통째로 사라졌다.
    // 제한은 index.js 에 있어서 이 검사판에는 안 실린다 — **소스로 본다**
    const indexSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
    ok('켜진 길 묻기는 로그인 횟수에서 뺀다',
      indexSrc.includes("req.path === '/providers'"), true);
    ok('  구글 · 네이버는 켜져 있다 (열쇠를 넣었으니)', [list.google, list.naver], [true, true]);
    // 인스타 · X 는 **열쇠가 들어오는 날 저절로 켜진다.** 지금 값이 무엇이든
    // 「켜짐 = 열쇠 있음」이 맞으면 통과다 — 값을 넣기 전에 검사가 빨개지지 않는다
    for (const gone of ['instagram', 'twitter']) {
      ok('  ' + gone + ' 는 목록에 없다 (안 하기로 했다)', gone in list, false);
    }
    // **길은 늘 살아 있다** — 목록에서 뺐던 동안에도 그랬다
    for (const alive of ['instagram', 'twitter']) {
      ok('  ' + alive + ' 길은 그대로 산다',
        (await get('/api/oauth/' + alive)).status, 302);
    }
    // 걷어낸 길은 **키조차 없어야 한다.** `false` 로 남겨두면 화면은 「아직 준비 중」
    // 으로 읽고, 열쇠만 꽂으면 될 것처럼 보인다
    for (const gone of ['kakao', 'facebook']) {
      ok(gone + ' 는 목록에 없다', gone in list, false);
      ok('  ' + gone + ' 길 자체가 없다', (await get('/api/oauth/' + gone)).status, 404);
    }

    console.log('');
    console.log('── 메일을 안 주는 제공자: 묻는 걸음으로 보내는가 ── (2026-10-07)');
    //
    // 인스타 · X 는 메일 주소를 주지 않는다. 지어내면(`ig_<번호>@instagram.com`)
    // 비밀번호 찾기가 영구히 막히고 나중에 기록이 두 계정으로 갈라진다.
    // 그래서 **계정을 아직 만들지 않고** 사람에게 한 번 묻는다.
    PROFILE = { user_id: 4242, username: 'keyboard_gh' };
    const ig = await loginWith('instagram');
    ok('인스타로 보낸다', new URL(ig.start.loc).host, 'www.instagram.com');
    ok('메일을 묻는 화면으로 보낸다', new URL(ig.loc).pathname, '/oauth/email');
    ok('  어디로 들어왔는지 같이 보낸다', q(ig.loc).provider, 'instagram');
    ok('  제공자가 준 이름도 보낸다 (이름을 또 묻지 않는다)', q(ig.loc).name, 'keyboard_gh');
    ok('  로그인 열쇠는 아직 안 준다',
      ig.cookies.some((c) => c.startsWith('sb_access=')), false);
    ok('  지어낸 주소로 계정이 생기지 않았다',
      !!db.findUserByEmail('ig_4242@instagram.com'), false);
    ok('  쪽지를 쥐여준다 (서버가 들고 있는 줄을 가리킨다)',
      ig.cookies.some((c) => c.startsWith('sb_social=')), true);
    ok('    그 쪽지는 스크립트가 못 읽는다 (HttpOnly)',
      ig.cookies.some((c) => c.startsWith('sb_social=') && /HttpOnly/i.test(c)), true);
    const igJar = jarOf(ig);

    // X 는 PKCE 를 쓴다 — 시작할 때 해시를 같이 보내야 한다
    PROFILE = { data: { id: '9191', username: 'gh_x', name: '근호' } };
    const tw = await loginWith('twitter');
    ok('X 로 보낸다', new URL(tw.start.loc).host, 'x.com');
    ok('  PKCE 해시를 같이 보낸다',
      !!new URL(tw.start.loc).searchParams.get('code_challenge'), true);
    ok('  그 방식이 S256 이다',
      new URL(tw.start.loc).searchParams.get('code_challenge_method'), 'S256');
    // **검증값 원본은 나가지 않는다** — 나가면 PKCE 가 아무 일도 안 한 것이 된다
    ok('  검증값 원본은 안 보낸다', tw.start.loc.includes('code_verifier'), false);
    ok('X 도 메일을 묻는 화면으로 보낸다', new URL(tw.loc).pathname, '/oauth/email');
    ok('  이름을 같이 보낸다', q(tw.loc).name, 'gh_x');

    console.log('');
    console.log('── 메일을 받는 걸음 ── (2026-10-07)');
    //
    // 세 가지가 다 맞아야 계정이 생긴다 — **쪽지 · 번호 · 15분.**
    const noNote = await post('/api/oauth/email', { email: 'x@y.com', code: '123456' });
    // **401 이 아니라 410 이다** (2026-10-07). 앱 전체가 401 을 「세션이 끊겼다」로
    // 읽어서, 세션을 가진 적도 없는 사람을 로그인 화면으로 통째로 튕겼다
    // (까닭은 `oauth.js` 의 그 자리에 적어뒀다)
    ok('쪽지 없이 부르면 막는다', noNote.status, 410);
    ok('  다시 로그인하라고 알려준다', noNote.json?.restart, true);
    ok('  계정이 생기지 않았다', !!db.findUserByEmail('x@y.com'), false);

    // 번호를 받아 온다 (내 컴퓨터에서는 응답에 번호가 실린다)
    const codeRes = await post('/api/auth/send-code', { email: 'gh@gmail.com' });
    const theCode = codeRes.json?.code;
    ok('번호를 받았다', typeof theCode === 'string' && theCode.length === 6, true);

    const wrong = await post('/api/oauth/email',
      { email: 'gh@gmail.com', code: '000000' }, { Cookie: igJar });
    ok('번호가 틀리면 계정을 안 만든다', wrong.status, 400);
    ok('  그 이메일로 계정이 생기지 않았다', !!db.findUserByEmail('gh@gmail.com'), false);

    const made = await post('/api/oauth/email',
      { email: 'gh@gmail.com', code: theCode }, { Cookie: igJar });
    ok('번호가 맞으면 계정이 생긴다', made.status, 200);
    ok('  로그인 열쇠 셋을 쥐여준다',
      made.cookies.map((c) => c.split('=')[0]).filter((n) => n !== 'sb_social').sort(),
      ['sb_access', 'sb_csrf', 'sb_refresh']);
    ok('  쓰고 난 쪽지는 버린다',
      made.cookies.some((c) => c.startsWith('sb_social=') && /(Max-Age=0|Expires=Thu, 01 Jan 1970)/i.test(c)), true);
    ok('  이름은 인스타가 준 것이다', db.findUserByEmail('gh@gmail.com').nickname, 'keyboard_gh');
    ok('  아이디는 instagram_ 로 시작한다',
      /^instagram_[0-9a-f]{8}$/.test(db.findUserByEmail('gh@gmail.com').username), true);
    ok('  소셜 계정이라고 적어둔다 (비밀번호를 모르는 사람이다)',
      db.isSocialAccount(db.findUserByEmail('gh@gmail.com')), true);
    // **쪽지는 한 번 쓰면 끝이다.** 안 버리면 같은 쪽지로 다른 메일에 또 붙일 수 있다
    const again = await post('/api/oauth/email',
      { email: 'gh@gmail.com', code: theCode }, { Cookie: igJar });
    ok('같은 쪽지를 두 번 쓰지 못한다', again.status, 410);

    // **이미 쓰는 메일이면 그 계정으로 들어간다** — 새로 만들면 기록이 갈라진다
    db.createUser('old@gmail.com', 'x', '전부터쓰던이름', 'oldhand01');
    const oldId = db.findUserByEmail('old@gmail.com').id;
    PROFILE = { user_id: 5555, username: 'same_person' };
    const ig2 = await loginWith('instagram');
    const code2 = (await post('/api/auth/send-code', { email: 'old@gmail.com' })).json?.code;
    const linked = await post('/api/oauth/email',
      { email: 'old@gmail.com', code: code2 }, { Cookie: jarOf(ig2) });
    ok('이미 쓰는 메일이면 그 계정으로 들어간다', linked.status, 200);
    ok('  계정이 하나 더 생기지 않았다', db.findUserByEmail('old@gmail.com').id, oldId);
    ok('  이름을 덮어쓰지 않는다 (쓰던 이름이 그대로다)',
      db.findUserByEmail('old@gmail.com').nickname, '전부터쓰던이름');
    ok('  처음 만든 계정이 아니라고 알려준다', linked.json?.created, false);

    console.log('');
    console.log('── 메일을 주면 묻지 않는가 ──');
    //
    // X 는 승인을 받으면 메일을 준다. 그날이 오면 **고칠 데가 없어야** 한다
    PROFILE = { data: { id: '7777', username: 'hasmail', confirmed_email: 'xmail@gmail.com' } };
    const twMail = await loginWith('twitter');
    ok('메일을 주면 바로 들어온다', q(twMail.loc).oauth, 'success');
    ok('  묻는 화면으로 안 보낸다', new URL(twMail.loc).pathname, '/login');
    ok('  준 주소로 계정이 생긴다', !!db.findUserByEmail('xmail@gmail.com'), true);

    console.log('');
    console.log('── 메일을 지어내는 자리가 없는가 ── (2026-10-07)');
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'oauth.js'), 'utf8');
    const made2 = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    ok('코드가 @instagram.com 주소를 짓지 않는다', made2.includes('@instagram.com'), false);
    ok('코드가 @facebook.com 주소를 짓지 않는다', made2.includes('@facebook.com'), false);

    console.log('');
    console.log('── 네이버도 까닭을 말하는가 ── (2026-10-07)');
    //
    // 네이버에서 메일은 선택 동의다. 여태 이 자리는 `naver_failed` 였고 화면은
    // 「다시 시도해주세요」를 띄웠다 — **동의를 켜지 않으면 다시 눌러도 영영 안 된다**
    PROFILE = { response: { nickname: '메일안줌' } };
    ok('메일 동의를 안 했으면 naver_no_email', q((await loginWith('naver')).loc).error, 'naver_no_email');
    PROFILE = { response: { email: 'nv@naver.com', nickname: '네이버근호' } };
    ok('메일을 주면 그대로 들어온다', q((await loginWith('naver')).loc).oauth, 'success');
    ok('  준 주소로 계정이 생긴다', !!db.findUserByEmail('nv@naver.com'), true);
    PROFILE = { email: 'me@gmail.com', name: '근호' };

    console.log('');
    console.log('── 실패 까닭이 제공자마다 갈라지는가 ── (2026-10-07)');
    const { failCode } = oauth;
    for (const p of ['google', 'naver', 'instagram', 'twitter']) {
      ok(p + ' — 메일 미확인', failCode(p, new Error('OAUTH_EMAIL_UNVERIFIED')), p + '_unverified');
      ok(p + ' — 메일 미제공', failCode(p, new Error('OAUTH_NO_EMAIL')), p + '_no_email');
      ok(p + ' — 그 밖의 일', failCode(p, new Error('그 밖')), p + '_failed');
    }

    console.log('');
    console.log('── 인스타: 누구인지를 어디서 정하는가 ── (2026-10-09)');
    //
    // 전에는 `/me` 가 준 `user_id` 만 믿었다. 메타가 작년에 이 API 를 통째로
    // 갈아엎은 자리라, 그 모양이 바뀌면 **로그인 자체가 실패**한다.
    // 이제 **토큰 응답의 `user_id`** 로 정하고 `/me` 는 이름만 가져온다.
    ME_DOWN = true;
    PROFILE = { user_id: 8888 };
    const igNoMe = await loginWith('instagram');
    ok('/me 가 죽어도 로그인은 계속된다', new URL(igNoMe.loc).pathname, '/oauth/email');
    ok('  이름만 못 가져온다 (못 물어봤으니 안 보낸다)', q(igNoMe.loc).name, undefined);
    ME_DOWN = false;
    // 반대로 **토큰 응답에 `user_id` 가 없으면** 누구인지를 모른다 — 그때는 멈춘다
    PROFILE = { username: 'noid' };
    const igNoId = await loginWith('instagram');
    ok('누구인지 모르면 멈춘다', q(igNoId.loc).error, 'instagram_failed');
    PROFILE = { user_id: 4242, username: 'keyboard_gh' };

    console.log('');
    console.log('── 취소는 실패가 아니다 ── (2026-10-09)');
    //
    // 동의 화면에서 취소를 누르면 `code` 없이 `?error=access_denied` 로 돌아온다.
    // 그 길이 따로 없어서 **빈 코드로 토큰 교환을 때리고** 「실패했어요. 다시
    // 시도해주세요」를 들려줬다 — 그만두기로 한 사람에게 할 말이 아니다
    for (const p of ['google', 'naver', 'instagram', 'twitter']) {
      const start = await get('/api/oauth/' + p, { Referer: 'http://localhost:5173/login' });
      const st = new URL(start.loc).searchParams.get('state');
      const back = await get('/api/oauth/' + p + '/callback?error=access_denied&state=' + st,
        { Cookie: jarOf(start) });
      ok(p + ' — 취소하고 돌아오면 그렇다고 말한다', q(back.loc).error, p + '_cancelled');
    }
    ok('  화면이 그 말을 갖고 있다',
      fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'LoginPage.jsx'), 'utf8')
        .includes("kind === 'cancelled'"), true);

    console.log('');
    console.log('── **고장은 취소가 아니다** ── (2026-10-24)');
    //
    // `error` 가 **무엇이든** 「그만뒀어요」로 말하고 있었다. 제공자는 취소만
    // 보내지 않는다 — `server_error` · `temporarily_unavailable` ·
    // `invalid_scope` · `invalid_client` 도 같은 칸으로 온다. 그러면 **본인이
    // 그만두지 않았는데 그만뒀다고 듣고**, 운영자는 **설정이 틀어진 것을 영영
    // 못 본다**(「취소한 사람이 많네」로 읽힌다).
    for (const e of ['server_error', 'temporarily_unavailable', 'invalid_scope', 'invalid_client']) {
      const start = await get('/api/oauth/google', { Referer: 'http://localhost:5173/login' });
      const st = new URL(start.loc).searchParams.get('state');
      const back = await get('/api/oauth/google/callback?error=' + e + '&state=' + st, { Cookie: jarOf(start) });
      ok('  ' + e + ' 는 실패로 말한다', q(back.loc).error, 'google_failed');
    }
    // 인스타가 때때로 보내는 취소 글자도 취소로 본다
    {
      const start = await get('/api/oauth/instagram', { Referer: 'http://localhost:5173/login' });
      const st = new URL(start.loc).searchParams.get('state');
      const back = await get('/api/oauth/instagram/callback?error=user_denied&state=' + st, { Cookie: jarOf(start) });
      ok('  user_denied 도 취소다', q(back.loc).error, 'instagram_cancelled');
    }
    // **날것 그대로 기록에 남는가** — 관리자 화면에서 그 글자를 봐야 어디가 틀어졌는지 안다
    {
      const logged = require('../src/db').getSecurityLogs()
        .filter((l) => l.type === 'oauth_error' || l.type === 'oauth_cancelled');
      ok('  까닭을 보안 기록에 남긴다', logged.length > 0, true);
      ok('    날것 글자가 들어 있다', /error=server_error/.test(logged.map((l) => l.detail).join(' ')), true);
    }

    console.log('');
    console.log('── 화면이 그 까닭을 읽는가 ── (2026-10-07)');
    //
    // 서버가 `kakao_no_email` 을 보내도 화면이 `code === 'google_no_email'` 로
    // 못을 박고 있으면 **갈래가 맞는데도** 맨 아래의 「다시 시도해주세요」를 듣는다
    const loginJsx = fs.readFileSync(
      path.join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'LoginPage.jsx'), 'utf8');
    ok('구글 이름을 박아두지 않았다', loginJsx.includes("code === 'google_unverified'"), false);
    ok('  갈래로 본다 (unverified)', loginJsx.includes("kind === 'unverified'"), true);
    ok('  갈래로 본다 (no_email)', loginJsx.includes("kind === 'no_email'"), true);
    // **걷어낸 제공자도 이름표는 남긴다** — 오래 열어둔 탭에서 그쪽 콜백이 돌아오면
    // 「소셜 로그인에 실패했어요」가 아니라 제 이름을 들어야 한다
    for (const [key, name] of [['instagram', '인스타그램'], ['twitter', '트위터(X)'], ['kakao', '카카오']]) {
      ok('  ' + key + ' 이름표가 있다', loginJsx.includes(key + ": '" + name + "'"), true);
    }
    const btnJsx = fs.readFileSync(
      path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'SocialLoginButtons.jsx'), 'utf8');
    ok('단추 목록에 naver 가 있다', btnJsx.includes("key: 'naver'"), true);
    // 하나만 남으면 **이름을 적는다** — 네모 하나에 그림만 있으면 「이게 뭐지」가 된다
    ok('  하나뿐일 때는 이름을 적는다', btnJsx.includes('others.length === 1'), true);
    for (const key of ['kakao', 'facebook', 'instagram', 'twitter']) {
      ok('  ' + key + ' 는 없다', btnJsx.includes("key: '" + key + "'"), false);
    }
    // ── B안: 로고만 ── 로고만 있는 단추는 **읽어주는 화면에 이름이 없으면**
    // 「단추」로만 읽힌다. `aria-label` 이 빠지는 순간 못 쓰는 화면이 된다
    // **조사는 손이 고른다** (2026-10-27) — 여기 `${o.ariaLabel || o.label}로` 가
    // 글자로 박혀 있었다. 「네이버로」는 맞지만 받침이 있는 이름이 오면 틀린다.
    // 이름이 `aria-label` 에 **들어가는지**만 본다 — 조사는 `particle.js` 가 맡는다
    ok('  로고만 단추에 이름을 붙였다',
      btnJsx.includes('aria-label={`${euro(o.ariaLabel || o.label)}'), true);
    // 제공자가 검정 바탕을 쓰면(X 가 그랬다) 앱 배경에 윤곽이 녹는다 — 테두리를
    // 받을 자리는 남겨둔다. 지금 그걸 쓰는 제공자는 없다
    ok('  테두리를 받을 자리가 있다', btnJsx.includes("o.border || 'none'"), true);
    // 메일을 묻는 화면이 **길에 걸려 있어야** 한다. 서버는 거기로 보내는데 길이
    // 없으면 인스타 · X 로 들어온 사람이 「없는 화면」에 떨어진다
    const appJsx = fs.readFileSync(
      path.join(__dirname, '..', '..', 'frontend', 'src', 'App.jsx'), 'utf8');
    ok('메일을 묻는 화면이 길에 있다', appJsx.includes('path="/oauth/email"'), true);
    ok('  로그인 밖이다 (계정이 아직 없는 사람이 본다)',
      appJsx.indexOf('path="/oauth/email"') < appJsx.indexOf('<PrivateRoute>'), true);

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
