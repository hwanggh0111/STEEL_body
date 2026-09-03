// 소셜 로그인에서 **눈으로 못 보는 두 가지**를 본다.
//
//   npm run oauth
//
// 구글 열쇠가 없으면 끝까지 눌러볼 수가 없다. 그래도 여기 둘은 열쇠 없이 볼 수 있다.
//
// 1. 돌아가는 주소에 `created` 가 **새 계정일 때만** 붙는가.
//    9/3 까지는 소셜로 들어올 때마다 화면이 「이름을 정하세요」를 띄웠다 —
//    백 번째 로그인에도. 화면은 이제 이 표시를 보고 갈린다
// 2. 이메일 없이 계정을 만들지 않는가.
//    계정을 찾는 열쇠는 이메일 하나다. 빈 값이면 그 열쇠가 '' 가 되고,
//    **이메일 없이 들어온 서로 다른 사람이 계정 하나로 묶인다**
process.env.JWT_SECRET = process.env.JWT_SECRET || 'check';
const { successUrl, findOrCreateUser } = require('../src/routes/oauth');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' -> ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

console.log('── 소셜 로그인이 화면에 무엇을 들려 보내는가 ──');

const base = 'http://x';
const q = (url) => Object.fromEntries(new URL(url).searchParams);

ok('처음 만들어진 계정이면 created 를 붙인다',
  q(successUrl(base, { nickname: '근호', email: 'a@b.c', created: true, restored: false })).created, '1');
ok('이미 있던 계정이면 안 붙인다',
  q(successUrl(base, { nickname: '근호', email: 'a@b.c', created: false, restored: false })).created, undefined);
ok('되살아난 계정이면 restored 를 붙인다',
  q(successUrl(base, { nickname: '근호', email: 'a@b.c', created: false, restored: true })).restored, '1');
ok('그냥 로그인이면 안 붙인다',
  q(successUrl(base, { nickname: '근호', email: 'a@b.c', created: false, restored: false })).restored, undefined);

// 이름에 & 나 한글이 들어가도 주소가 안 깨져야 한다. 깨지면 화면이 이름을 잘못 읽는다
const tricky = successUrl(base, { nickname: 'a&b=c 근호', email: 'a+b@c.d', created: true });
ok('이름에 & 가 있어도 그대로 읽힌다', q(tricky).nickname, 'a&b=c 근호');
ok('이메일에 + 가 있어도 그대로 읽힌다', q(tricky).email, 'a+b@c.d');
ok('오는 곳은 로그인 화면이다', new URL(tricky).pathname, '/login');

console.log('');
console.log('── 이메일 없이 계정을 만들지 않는가 ──');

const rejects = async (name, email) => {
  let err = null;
  try { await findOrCreateUser(email, '아무개', 'google'); } catch (e) { err = e.message; }
  ok(name, err, 'OAUTH_NO_EMAIL');
};

(async () => {
  await rejects('이메일이 없으면 거절한다', undefined);
  await rejects('빈 글자도 거절한다', '');
  await rejects('골뱅이가 없으면 거절한다', 'nobody');
  await rejects('객체를 보내도 거절한다', { toString: () => 'a@b.c' });

  // ── 아이디는 대소문자를 가리지 않는다 ──
  //
  // 회원가입 화면은 친 것을 소문자로 낮춰 보낸다. 그런데 서버 조회는 대소문자를
  // 그대로 가리고 있었다 — `Kevin12` 로 가입한 줄 아는 사람이 로그인 화면에
  // `Kevin12` 를 치면 **없는 계정**이 된다. 화면은 「아이디 또는 비밀번호가
  // 틀렸어요」라고만 하니 사람은 비밀번호를 의심한다. 이메일은 이미 맞추고 있었다.
  //
  // 진짜 파일을 건드리지 않게 검사용 DB 로 돌린다
  console.log('');
  console.log('── 아이디는 대소문자를 가리지 않는가 ──');
  const fs = require('fs');
  const path = require('path');
  const tmp = path.join(__dirname, '..', '.check-oauth.json');
  fs.writeFileSync(tmp, JSON.stringify({ users: [], _nextId: {} }), 'utf-8');
  process.env.DB_FILE = tmp;
  // db 는 위에서 이미 읽혔을 수 있다. 새로 읽어 검사용 파일을 보게 한다
  delete require.cache[require.resolve('../src/db')];
  const db = require('../src/db');
  try {
    db.createUser('case@test.local', 'x', '대소문자', 'CaseTest01');
    ok('소문자로 찾는다', !!db.findUserByUsername('casetest01'), true);
    ok('대문자로 찾는다', !!db.findUserByUsername('CASETEST01'), true);
    ok('친 그대로도 찾는다', !!db.findUserByUsername('CaseTest01'), true);
    ok('앞뒤 공백은 무시한다', !!db.findUserByUsername('  casetest01 '), true);
    ok('다른 아이디는 안 찾는다', !!db.findUserByUsername('casetest02'), false);
    let dup = null;
    try { db.createUser('other@test.local', 'x', '또', 'casetest01'); } catch (e) { dup = e.message; }
    ok('대소문자만 다른 아이디로는 못 만든다', dup, 'DUPLICATE_USERNAME');
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }

  console.log('');
  console.log(bad ? `${bad}건 실패` : '전부 통과');
  process.exit(bad ? 1 : 0);
})();
