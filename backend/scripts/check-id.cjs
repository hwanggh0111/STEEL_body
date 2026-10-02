// 아이디를 바꾸는 규칙.
//
//   npm run id
//
// 2026-10-02 에 붙인 자리다. 계정 무리에 **이름 · 비밀번호 · 계정 삭제**는 있었는데
// **아이디를 바꿀 길이 없었다.** 필요한 사람은 소셜로 들어온 사람이다 — 구글로
// 들어오면 `google_ff791abd` 가 붙는데, 자기가 고른 적 없는 이름이 로그인에 쓰이는 이름이다.
//
// 여기서 보는 것 (`npm run join` 과 같은 방식 — 진짜 라우터에 http 로 친다):
//   1. 가입과 **같은 규칙**인가 (4~20자 · 쓸 수 있는 글자)
//   2. 대소문자만 다른 것을 **같은 아이디**로 보는가 — 그걸로 30일을 태우면 안 된다
//   3. 남이 쓰는 것은 409 인가
//   4. 바꾸면 **옛 아이디로 로그인이 안 되는가** (둘 다 되면 아이디가 둘인 계정이 된다)
//   5. **메일로는 그대로 되는가** — 아이디를 바꿔도 못 들어오게 되면 안 된다
//   6. 30일에 한 번인가, 그리고 **한 번도 안 바꾼 사람은 막히지 않는가**
//   7. 로그인 없이 부를 수 있는가 (안 되어야 한다)

const path = require('path');
const fs = require('fs');
const TMP_DB = path.join(__dirname, '..', '.check-id.json');
fs.writeFileSync(TMP_DB, JSON.stringify({ users: [], _nextId: {} }), 'utf-8');
process.env.DB_FILE = TMP_DB;
process.env.JWT_SECRET = 'check-secret-check-secret-check-secret';
process.env.NODE_ENV = 'development';
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;
delete process.env.DEV_ECHO_CODE;
delete process.env.ADMIN_EMAIL;

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

function send(method, p, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body || {});
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) };
    if (token) headers.Authorization = 'Bearer ' + token;
    const req = http.request({ port: server.address().port, path: p, method, headers }, (res) => {
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

const post = (p, body, token) => send('POST', p, body, token);
const put = (p, body, token) => send('PUT', p, body, token);

// 한 사람을 만들고 그 사람의 열쇠를 받는다
async function makeUser(email, username) {
  const sent = await post('/api/auth/send-code', { email });
  const reg = await post('/api/auth/register', {
    email, password: 'abcd1234', nickname: '아무개', username, code: sent.body && sent.body.code,
  });
  return { status: reg.status, token: reg.body && reg.body.token };
}

const changeId = (token, username) => put('/api/auth/username', { username }, token);
const login = (who) => post('/api/auth/login', { email: who, password: 'abcd1234' });

async function run() {
  try {
    const me = await makeUser('me@test.local', 'oldname01');
    ok('가입해서 열쇠를 받는다', me.status, 201);
    // 남이 쓰는 아이디를 만들어 둔다
    await makeUser('other@test.local', 'taken01');

    console.log('');
    console.log('── 가입과 같은 규칙인가 ──');
    const cases = [
      ['너무 짧으면 거절한다', 'abc'],
      ['빈 값도 거절한다', ''],
      ['21자는 거절한다', 'a'.repeat(21)],
      ['한글은 거절한다', '한글아이디'],
      ['빈칸이 섞이면 거절한다', 'ab cd'],
    ];
    for (const [name, v] of cases) {
      const r = await changeId(me.token, v);
      ok(name, r.status, 400);
    }
    // **20자는 받는다.** 경계는 양쪽을 다 봐야 한다 — 한쪽만 보면 21자를 막는 코드가
    // 20자도 같이 막고 있어도 모른다. 이 사람은 여기서 아이디를 쓰고 끝낸다
    // (`me` 로 하면 30일 제한에 걸려 아래 검사가 전부 막힌다)
    const edge = await makeUser('edge@test.local', 'edgeone01');
    ok('  그래도 20자는 받는다', (await changeId(edge.token, 'a'.repeat(20))).status, 200);

    console.log('');
    console.log('── 대소문자만 다른 것은 같은 아이디다 ──');
    //
    // 이걸로 30일을 태우면 사람은 「바꿨는데 그대로네」를 겪고 한 달을 기다린다
    const same = await changeId(me.token, 'OLDNAME01');
    ok('같은 아이디라고 말해준다', same.status, 400);
    ok('  까닭을 말해준다', same.body.error, '지금 쓰는 아이디와 같아요');
    ok('  아이디는 그대로다', db.findUserById(db.findUserByUsername('oldname01').id).username, 'oldname01');

    console.log('');
    console.log('── 남이 쓰는 아이디 ──');
    const taken = await changeId(me.token, 'taken01');
    ok('409 로 막는다', taken.status, 409);
    // **대소문자만 바꿔 남의 것을 집을 수 없다** — 가입에서 막는 것과 같은 자리다
    const takenCase = await changeId(me.token, 'TAKEN01');
    ok('  대소문자만 달라도 막는다', takenCase.status, 409);

    console.log('');
    console.log('── 바꾸면 옛 아이디는 안 통한다 ──');
    const done = await changeId(me.token, 'newname01');
    ok('바뀐다', done.status, 200);
    ok('  새 아이디를 돌려준다', done.body.username, 'newname01');
    ok('  옛 아이디로는 로그인이 안 된다', (await login('oldname01')).status, 401);
    ok('  새 아이디로는 된다', (await login('newname01')).status, 200);
    ok('  **메일로는 그대로 된다**', (await login('me@test.local')).status, 200);
    ok('  옛 아이디는 비어 있다 (남이 쓸 수 있다)', !!db.findUserByUsername('oldname01'), false);

    console.log('');
    console.log('── 30일에 한 번 ──');
    const again = await changeId(me.token, 'thirdname1');
    ok('바로 또 바꾸면 막는다', again.status, 429);
    ok('  며칠 남았는지 말해준다', again.body.daysLeft, 30);
    ok('  아이디는 그대로다', !!db.findUserByUsername('newname01'), true);

    // **한 번도 안 바꾼 사람은 막히지 않는다** — 가입할 때 정한 것은 「바꾼 것」이 아니다
    const fresh = await makeUser('fresh@test.local', 'freshone1');
    const firstTime = await changeId(fresh.token, 'freshtwo1');
    ok('처음 바꾸는 사람은 안 막힌다', firstTime.status, 200);

    // ── 며칠 남았나는 **함수 자리에서** 본다 ──
    //
    // 「31일이 지나면 되는가」를 라우터로 보려면 적어둔 날을 되돌려야 하고, 그러려면
    // 검사 하나 때문에 DB 에 함수를 늘려야 한다. 판단은 떼어 뒀으니 값으로 본다
    const { usernameCooldown, USERNAME_COOLDOWN_DAYS } = auth;
    const ago = (d) => new Date(Date.now() - d * 86400000).toISOString();
    ok('제한이 30일이다', USERNAME_COOLDOWN_DAYS, 30);
    ok('  한 번도 안 바꿨으면 0 (지금 된다)', usernameCooldown(null), 0);
    ok('  방금 바꿨으면 30', usernameCooldown(ago(0)), 30);
    ok('  하루 지났으면 29', usernameCooldown(ago(1)), 29);
    ok('  29일 지났으면 1', usernameCooldown(ago(29)), 1);
    ok('  30일 지났으면 0', usernameCooldown(ago(30)), 0);
    ok('  31일 지났으면 0 (음수로 안 내려간다)', usernameCooldown(ago(31)), 0);
    ok('  날짜가 깨져 있으면 막지 않는다', usernameCooldown('어제쯤'), 0);

    console.log('');
    console.log('── 소셜 계정이 아이디를 바꿔도 소셜인가 ── (2026-10-02)');
    //
    // `isSocialAccount` 는 **아이디 모양**(`google_xxxxxxxx`)으로도 알아본다. 아이디를
    // 바꿀 수 있게 되자 그 증거가 사라질 수 있게 됐다 — 그러면 **비밀번호가 없는
    // 사람에게 비밀번호를 묻는 창**이 열리고(설정함 · 계정 시트), 계정도 못 지운다.
    // 바꿀 때 `is_social` 로 적어 두는지 본다
    const soc = await makeUser('soc@test.local', 'google_aabbccdd');
    ok('아이디 모양으로 소셜을 알아본다', db.isSocialAccount(db.findUserByUsername('google_aabbccdd')), true);
    ok('  바꿀 수 있다', (await changeId(soc.token, 'kevin12')).status, 200);
    const after = db.findUserByUsername('kevin12');
    ok('  모양은 더 이상 소셜이 아닌데', /^(google|naver|facebook|instagram)_[0-9a-f]{8}$/.test(after.username), false);
    ok('  **적어둔 표시로 여전히 소셜이다**', db.isSocialAccount(after), true);

    console.log('');
    console.log('── 화면이 미리 알 수 있는가 (`/auth/me`) ──');
    //
    // 「막힌 단추는 누르기 전에 막힌 줄 알려준다」가 이 앱의 방침이다. 그런데 화면이
    // `usernameChangedAt` 에서 **직접 세면 규칙이 두 벌**이 된다 — 30일을 한쪽만 고치는
    // 날 「바꿀 수 있다」고 적어놓고 저장에서 429 를 준다. 서버가 **답을 내려준다**
    // **한 번도 안 바꾼 사람**을 따로 만든다. 위의 사람들은 다 한 번씩 바꿨으므로
    // 그들로 보면 「0 이 나오는 경우」를 영영 못 본다
    const never = await makeUser('never@test.local', 'neverone1');
    const meNever = await send('GET', '/api/auth/me', null, never.token);
    const meUsed = await send('GET', '/api/auth/me', null, me.token);
    ok('한 번도 안 바꾼 사람은 0 (지금 된다)', meNever.body.username_days_left, 0);
    ok('  방금 바꾼 사람은 30', meUsed.body.username_days_left, 30);
    ok('  제한이 몇 일인지도 같이 준다', meUsed.body.username_cooldown_days, 30);
    ok('  바꾼 자리에서도 돌려준다', again.body.daysLeft, 30);

    console.log('');
    console.log('── 비밀번호를 만들면 그 뒤로는 묻는다 ── (2026-10-02)');
    //
    // 함수(`isSocialAccount`)가 맞게 답해도 **길이 적어주지 않으면** 그대로 깨진다.
    // `reset-password` 가 `markHasPassword` 를 부르는지 라우터로 본다
    const sent2 = await post('/api/auth/send-code', { email: 'soc@test.local' });
    const made = await post('/api/auth/reset-password', {
      email: 'soc@test.local', code: sent2.body && sent2.body.code, newPassword: 'newpw1234',
    });
    ok('비밀번호를 만든다', made.status, 200);
    const socAfter = db.findUserByUsername('kevin12');
    ok('  이제 안다고 적혀 있다', !!socAfter.has_password, true);
    ok('  **그래서 계정을 지울 때 비밀번호를 묻는다**', db.isSocialAccount(socAfter), false);
    ok('  만든 비밀번호로 들어올 수 있다',
      (await post('/api/auth/login', { email: 'kevin12', password: 'newpw1234' })).status, 200);

    console.log('');
    console.log('── 로그인 없이 ──');
    const anon = await changeId(null, 'anonname1');
    ok('열쇠 없이 부르면 막는다', anon.status, 401);
    ok('  아무 열쇠나 들고 와도 막는다', (await changeId('not-a-real-token', 'anonname1')).status, 401);
  } catch (err) {
    bad += 1;
    console.log('FAIL 검사가 도중에 터졌다 -> ' + err.message);
  } finally {
    server.close();
    console.log('');
    console.log(bad ? bad + '건 실패' : '전부 통과');
    setTimeout(() => {
      try { fs.unlinkSync(TMP_DB); } catch (e) { /* 이미 없으면 그만이다 */ }
      process.exit(bad ? 1 : 0);
    }, 900);
  }
}
