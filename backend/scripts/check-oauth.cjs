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
//   6. **카카오도 같은 길을 도는가** (2026-10-07) — 카카오는 메일을 선택 동의로
//      받으므로 「동의 안 함」과 「확인 안 됨」을 둘 다 눌러본다
//   7. **메일을 지어내는 자리가 없는가** — 페북 · 인스타가 `fb_<번호>@facebook.com`
//      같은 없는 주소를 만들어 9/18 의 「메일 없으면 계정 안 만든다」를 비껴갔다
//   8. **실패 까닭이 제공자마다 갈라지는가** — 구글만 갈래를 갖고 있었다

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
process.env.KAKAO_CLIENT_ID = 'check-kakao';
process.env.NAVER_CLIENT_ID = 'check-naver';
process.env.NAVER_CLIENT_SECRET = 'check-naver-secret';
process.env.FACEBOOK_APP_ID = 'check-fb';
process.env.FACEBOOK_APP_SECRET = 'check-fb-secret';
delete process.env.ADMIN_EMAIL;   // 검사 계정이 관리자로 승격되면 안 된다

// ── 구글을 가짜로 세운다 ──
const axios = require('axios');
let PROFILE = { email: 'me@gmail.com', name: '근호' };
axios.defaults.adapter = async (config) => {
  const url = String(config.url || '');
  // 페북의 토큰 주소는 `/oauth/access_token` 이라 `/token` 으로는 안 걸린다 —
  // 그러면 토큰 자리에 사람 정보가 와서 **무엇을 보고 있는지가 흐려진다**
  const isToken = url.includes('/token') || url.includes('access_token');
  return {
    data: isToken ? { access_token: 'tok' } : PROFILE,
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
    ok('카카오가 목록에 있다', list.kakao, true);
    ok('  구글 · 네이버 · 페북도 그대로다', [list.google, list.naver, list.facebook], [true, true, true]);
    // 인스타는 **키조차 없어야 한다.** `false` 로 남겨두면 화면은 「아직 준비 중」으로
    // 읽고, 열쇠만 꽂으면 될 것처럼 보인다 — 그 길은 메일을 안 줘서 애초에 안 된다
    ok('인스타는 목록에 없다 (false 가 아니라 아예 없다)', 'instagram' in list, false);
    const igGone = await get('/api/oauth/instagram');
    ok('  인스타 길 자체가 없다', igGone.status, 404);
    const igBack = await get('/api/oauth/instagram/callback?code=abc&state=zzz');
    ok('  돌아오는 길도 없다', igBack.status, 404);

    console.log('');
    console.log('── 카카오 한 바퀴 (카카오만 가짜) ── (2026-10-07)');
    const kakaoOK = { id: 9001, kakao_account: { email: 'kko@daum.net', is_email_valid: true, is_email_verified: true, profile: { nickname: '카카오근호' } } };
    PROFILE = kakaoOK;
    const k1 = await loginWith('kakao');
    ok('카카오로 보낸다', new URL(k1.start.loc).host, 'kauth.kakao.com');
    // **메일을 동의 화면에 올려야** 카카오가 준다. 안 적으면 묻지도 않고 안 주고,
    // 메일이 없으면 이 앱은 계정을 만들 수 없다 — 그러면 길이 통째로 죽는다
    ok('  메일을 동의 화면에 올린다',
      new URL(k1.start.loc).searchParams.get('scope').includes('account_email'), true);
    ok('  돌아올 주소를 같이 준다',
      new URL(k1.start.loc).searchParams.get('redirect_uri').endsWith('/api/oauth/kakao/callback'), true);
    ok('  state 를 쿠키로도 준다 (이걸 빠뜨리면 100% 막힌다)',
      (k1.start.cookies || []).some((c) => c.startsWith('sb_oauth=')), true);
    ok('처음 들어온 사람은 계정이 생긴다', q(k1.loc).oauth, 'success');
    ok('  처음이라고 알려준다', q(k1.loc).created, '1');
    ok('  로그인 열쇠 셋을 쥐여준다',
      k1.cookies.map((c) => c.split('=')[0]).filter((n) => n !== 'sb_oauth').sort(),
      ['sb_access', 'sb_csrf', 'sb_refresh']);
    ok('  이름은 카카오가 준 것이다', db.findUserByEmail('kko@daum.net').nickname, '카카오근호');
    ok('  아이디는 kakao_ 로 시작한다',
      /^kakao_[0-9a-f]{8}$/.test(db.findUserByEmail('kko@daum.net').username), true);
    ok('  소셜 계정이라고 적어둔다 (비밀번호를 모르는 사람이다)',
      db.isSocialAccount(db.findUserByEmail('kko@daum.net')), true);

    // 카카오에서 메일은 **선택 동의**다. 안 켜면 이 칸이 아예 없이 온다
    PROFILE = { id: 9002, kakao_account: { profile: { nickname: '동의안함' } } };
    const kNoMail = await loginWith('kakao');
    ok('메일 동의를 안 했으면 까닭을 말한다', q(kNoMail.loc).error, 'kakao_no_email');
    ok('  빈 이메일 계정이 생기지 않았다', !!db.findUserByEmail(''), false);

    // 카카오는 「확인됐나」를 알려준다 — 구글의 `verified_email` 과 같은 자리다
    PROFILE = { id: 9003, kakao_account: { email: 'notmine@daum.net', is_email_verified: false, profile: { nickname: '확인안됨' } } };
    const kUnver = await loginWith('kakao');
    ok('확인 안 된 메일이면 계정을 안 만든다', q(kUnver.loc).error, 'kakao_unverified');
    ok('  그 이메일로 계정이 생기지 않았다', !!db.findUserByEmail('notmine@daum.net'), false);
    // 「다른 데서 쓰이는 중」도 그 주소를 못 믿는다는 뜻이다
    PROFILE = { id: 9004, kakao_account: { email: 'taken@daum.net', is_email_valid: false, profile: { nickname: '쓰이는중' } } };
    ok('쓸 수 없는 주소도 막는다', q((await loginWith('kakao')).loc).error, 'kakao_unverified');
    // **모른다고 할 때는 막지 않는다** — 필드를 안 주는 제공자도 있다
    PROFILE = { id: 9005, kakao_account: { email: 'noflag@daum.net', profile: { nickname: '모름' } } };
    ok('확인 여부를 안 주면 막지 않는다', q((await loginWith('kakao')).loc).oauth, 'success');

    const kakaoKey = process.env.KAKAO_CLIENT_ID;
    delete process.env.KAKAO_CLIENT_ID;
    ok('열쇠가 없으면 앱으로 돌려보낸다',
      q((await get('/api/oauth/kakao', { Referer: 'http://localhost:5173/login' })).loc).error,
      'kakao_not_configured');
    process.env.KAKAO_CLIENT_ID = kakaoKey;

    console.log('');
    console.log('── 메일을 지어내는 자리가 없는가 ── (2026-10-07)');
    //
    // 9/18 에 「메일이 없으면 계정을 만들지 않는다」를 `findOrCreateUser` 한 곳에
    // 넣었다. 그런데 페북 · 인스타는 `fb_<번호>@facebook.com` 을 지어내 **그 검사를
    // 비껴갔다.** 그 계정은 비밀번호 찾기가 영구히 막히고, 그 사람이 나중에 진짜
    // 메일로 가입하면 **계정이 둘로 갈라진다**
    PROFILE = { id: 777, name: '메일안줌' };
    const fbNoMail = await loginWith('facebook');
    ok('페북이 메일을 안 주면 계정을 안 만든다', q(fbNoMail.loc).error, 'facebook_no_email');
    ok('  fb_777@facebook.com 같은 계정이 생기지 않았다',
      !!db.findUserByEmail('fb_777@facebook.com'), false);
    PROFILE = { id: 778, name: '페북근호', email: 'fb@real.com' };
    ok('메일을 주면 그대로 들어온다', q((await loginWith('facebook')).loc).oauth, 'success');
    ok('  준 주소로 계정이 생긴다', !!db.findUserByEmail('fb@real.com'), true);
    // 소스에도 남아 있으면 안 된다 — 다음에 누가 같은 줄을 되살릴 수 있다
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'oauth.js'), 'utf8');
    const made = src.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n');
    ok('코드가 @facebook.com 주소를 짓지 않는다', made.includes('@facebook.com'), false);
    ok('코드가 @instagram.com 주소를 짓지 않는다', made.includes('@instagram.com'), false);

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
    for (const p of ['google', 'kakao', 'naver', 'facebook']) {
      ok(p + ' — 메일 미확인', failCode(p, new Error('OAUTH_EMAIL_UNVERIFIED')), p + '_unverified');
      ok(p + ' — 메일 미제공', failCode(p, new Error('OAUTH_NO_EMAIL')), p + '_no_email');
      ok(p + ' — 그 밖의 일', failCode(p, new Error('그 밖')), p + '_failed');
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
    ok('  카카오 이름표가 있다', loginJsx.includes("kakao: '카카오'"), true);
    const btnJsx = fs.readFileSync(
      path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'SocialLoginButtons.jsx'), 'utf8');
    ok('단추 목록에 카카오가 있다', btnJsx.includes("key: 'kakao'"), true);
    ok('  인스타는 없다', btnJsx.includes("key: 'instagram'"), false);

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
