// **소셜 로그인이 무엇으로 계정을 잇는가** (2026-11-26 · 정석, 전수검사 ②)
//
//   node scripts/check-sociallink.cjs            (npm run check 가 찾아서 돈다)
//   node scripts/check-sociallink.cjs --되돌려    옛 꼴(메일로 잇기)을 먹여 본다
//
// ── 왜 생겼나 ──
//
// 이 앱은 여태 **메일 하나로 계정을 이었다**(`findUserByEmail`). 구글은 그 메일이
// 확인된 것인지 알려주지만(`verified_email`) **네이버는 안 알려준다.** 네이버가 제
// 저장소(naver/naveridlogin-API #107)에서 이렇게 답했다 —
//
//   「인증 절차를 거친 값이 아닐 수 있습니다 · 소유가 확인되지 않은 주소가 제공될 수
//    있습니다 · 과거 가입 회원은 이메일 인증 단계를 거치지 않은 사례가 있습니다」
//   「검증 여부를 나타내는 필드는 제공되지 않습니다」
//   「이메일을 계정 연결 기준값으로 쓰지 말고 고유 식별자 `id` 를 쓰십시오」
//
// 그러면 **남의 메일이 적힌 네이버 계정으로 그 사람 기록에 들어가는 길**이 열린다.
// 근호가 11/25 에 「의심만 — 문서로 볼 것」으로 남긴 자리고, 문서를 보니 진짜였다.
//
// ── 무엇을 보는가 ──
//
//   ⑴ **고유 번호로 찾는다** — 그 길의 그 번호로 아는 계정이면 메일을 안 본다
//   ⑵ ★ **비밀번호 계정은 자동으로 안 잇는다** — 메일 확인을 못 믿는 길(네이버)로
//      그 메일에 들어오려 하면 `OAUTH_EMAIL_TAKEN` 이고, 화면이 **할 일을 말한다**
//   ⑶ **쓰던 사람이 잠기지 않는다** — 비밀번호 없는 소셜 계정은 그 사람이다
//      (그 계정의 메일은 애초에 그 제공자가 준 것이다). 고치는 쪽이 사람을 막으면 안 된다
//   ⑷ **구글은 여태처럼** — 확인된 메일이면 메일로 잇는다
//   ⑸ **번호를 적어둔다** — 다음부터는 ⑴ 로 간다. 다른 번호를 덮지 않는다
//   ⑹ **모를 때는 막는 쪽** — 켜지지 않은 길(카카오 · 페북)도 못 믿는 목록에 들어 있다
const path = require('path');
const os = require('os');

const TMP = path.join(os.tmpdir(), `sociallink-${process.pid}.json`);
process.env.DB_FILE = TMP;
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
require('./_tmpdb.cjs')(TMP);

const 되돌림 = process.argv.includes('--되돌려');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const fs = require('fs');
const db = require('../src/db');
const HASH = '$2a$10$abcdefghijklmnopqrstuv';

// ── 잇는 손만 꺼내 돌린다 ──
//
// `findOrCreateUser` 는 내보내지 않는 손이라(라우터 안에 있다) **소스에서 그 손만**
// 떼어 돌린다. 되돌림이면 **고친 묶음을 지우고** — 즉 「메일로 잇던 옛 꼴」로 — 돌린다.
function 손만들기() {
  const full = path.join(__dirname, '../src/routes/oauth.js');
  let src = fs.readFileSync(full, 'utf-8');
  if (되돌림) {
    const 시작 = src.indexOf('  const pid = opts.providerId != null');
    const 끝 = src.indexOf('  const created = !user;');
    if (시작 < 0 || 끝 < 0) throw new Error('되돌릴 자리를 못 찾았다');
    // 옛 꼴: 메일로 찾는다 (그때는 그 한 줄이었다)
    src = src.slice(0, 시작) + '  const pid = null;\n  let user = db.findUserByEmail(email);\n' + src.slice(끝);
  }
  const 시작 = src.indexOf('async function findOrCreateUser');
  const 끝 = src.indexOf('\n}', src.indexOf('return { user, nickname: user.nickname', 시작)) + 2;
  const 몸통 = src.slice(시작, 끝);
  const 머리 = src.slice(0, src.indexOf('async function findOrCreateUser'));
  // 그 손이 쓰는 것만 추려 넣는다 — 라우터 전체를 돌리면 포트를 열려고 한다
  const 밑감 = `
const db = require(${JSON.stringify(path.join(__dirname, '../src/db.js'))});
const bcrypt = { hash: async () => '${HASH}' };
const crypto = require('crypto');
const BCRYPT_ROUNDS = 4;
const { socialNickname } = require(${JSON.stringify(path.join(__dirname, '../src/utils/nickname.js'))});
${머리.includes('MAIL_UNTRUSTED') ? 머리.slice(머리.indexOf('const MAIL_UNTRUSTED')).split('\n')[0] : "const MAIL_UNTRUSTED = new Set();"}
${몸통}
module.exports = { findOrCreateUser, MAIL_UNTRUSTED };
`;
  const 흉내 = path.join(__dirname, `.sociallink-${process.pid}.cjs`);
  fs.writeFileSync(흉내, 밑감, 'utf-8');
  process.on('exit', () => { try { fs.unlinkSync(흉내); } catch { /* 없어도 된다 */ } });
  return require(흉내);
}

(async () => {
  try {
    const { findOrCreateUser, MAIL_UNTRUSTED } = 손만들기();
    const 해봄 = async (...args) => {
      try { return { ok: true, info: await findOrCreateUser(...args) }; }
      catch (err) { return { ok: false, why: err.message }; }
    };

    console.log('── ⑹ 못 믿는 길 목록 ──');
    ok('네이버가 들어 있다 (문서가 그렇게 적혀 있다)', MAIL_UNTRUSTED.has('naver'), true);
    ok('  아직 안 켠 길도 들어 있다 (모를 때는 막는 쪽)',
      [MAIL_UNTRUSTED.has('kakao'), MAIL_UNTRUSTED.has('facebook')], [true, true]);
    ok('  구글은 안 들어 있다 (값으로 알려준다)', MAIL_UNTRUSTED.has('google'), false);

    console.log('');
    console.log('── ⑵ ★ 비밀번호 계정을 네이버로 열 수 있나 ──');
    // 사람이 메일 · 비밀번호로 가입해 둔 계정
    const 주인 = db.createUser('victim@sl.local', HASH, '주인', 'slowner01').lastInsertRowid;
    db.markHasPassword(주인);
    // 공격자가 **그 메일이 적힌 네이버 계정**으로 들어온다 (네이버는 확인 안 해 줄 수 있다)
    const r = await 해봄('victim@sl.local', '남', 'naver', { providerId: 'NAVER-ATTACKER' });
    ok('★ 자동으로 잇지 않는다', r.ok ? '들어갔다' : r.why, 'OAUTH_EMAIL_TAKEN');
    ok('  그 계정에 번호가 안 적혔다',
      db.findUserByProvider('naver', 'NAVER-ATTACKER'), null);

    console.log('');
    console.log('── ⑶ 쓰던 사람이 잠기지 않나 ──');
    // 11/26 전에 네이버로 만든 계정 — 비밀번호가 없고 번호도 안 적혀 있다
    const 옛사람 = db.createUser('naveruser@sl.local', HASH, '옛사람', 'naver_ab12').lastInsertRowid;
    db.markSocialAccount(옛사람);
    const r2 = await 해봄('naveruser@sl.local', '옛사람', 'naver', { providerId: 'NAVER-OLD' });
    ok('★ 들어온다 (막으면 쓰던 사람이 잠긴다)', r2.ok && r2.info.user.id, 옛사람);
    ok('  이번에 번호를 적어뒀다 (다음부터는 번호로 찾는다)',
      db.findUserByProvider('naver', 'NAVER-OLD')?.id, 옛사람);

    console.log('');
    console.log('── ⑴ 번호로 찾는다 (메일이 바뀌어도) ──');
    // 그 사람이 네이버에서 메일을 바꿨다 — 번호는 그대로다
    const r3 = await 해봄('changed@sl.local', '옛사람', 'naver', { providerId: 'NAVER-OLD' });
    ok('★ 같은 계정으로 들어온다 (메일이 달라도)', r3.ok && r3.info.user.id, 옛사람);
    ok('  새 계정을 만들지 않았다', r3.ok && r3.info.created, false);

    console.log('');
    console.log('── ⑷ 구글은 여태처럼 ──');
    const 구글사람 = db.createUser('g@sl.local', HASH, '구글', 'google_c3').lastInsertRowid;
    db.markHasPassword(구글사람);        // 비밀번호까지 만들어 둔 사람
    const r4 = await 해봄('g@sl.local', '구글', 'google', { emailVerified: true, providerId: 'G-1' });
    ok('확인된 메일이면 메일로 잇는다', r4.ok && r4.info.user.id, 구글사람);
    ok('  「확인 안 됐다」고 말하면 막는다 (여태 그대로)',
      (await 해봄('g@sl.local', '구글', 'google', { emailVerified: false })).why, 'OAUTH_EMAIL_UNVERIFIED');

    console.log('');
    console.log('── ⑸ 번호를 덮지 않는다 ──');
    const before = db.findUserByProvider('naver', 'NAVER-OLD')?.id;
    ok('그 계정에 다른 네이버 번호를 적으려 하면 안 적는다',
      db.linkProvider(옛사람, 'naver', 'NAVER-ANOTHER').changes, 0);
    ok('  옛 번호가 그대로다', db.findUserByProvider('naver', 'NAVER-OLD')?.id, before);
    // 길 둘로 들어오는 사람 — **같은 계정에 둘 다 적힌다**
    ok('한 사람이 길 둘로 들어오면 둘 다 적힌다',
      db.linkProvider(옛사람, 'google', 'G-OLD').changes, 1);

    console.log('');
    console.log('── ★ 관리자 승격 — 못 믿는 길로는 안 된다 (11/26 · 안전 3 의 남은 자리) ──');
    //
    // 위의 ⑵ 는 「**있는 계정에** 못 붙는다」를 본다. 그런데 그 메일로 계정이 **아직
    // 없으면** 막을 것이 없어서 바로 새로 만들어지고, 그때 `ADMIN_EMAIL` 승격 자리를
    // 지난다 — 즉 주인이 아직 가입하지 않은 동안, 그 주소를 제 네이버 계정에 적어둔
    // 사람이 **관리자로 들어올 수 있었다.**
    {
      const 전 = process.env.ADMIN_EMAIL;
      process.env.ADMIN_EMAIL = 'boss@sl.local';
      try {
        // 네이버(확인 못 믿는 길)로 그 주소를 들고 **처음** 들어온다
        const n = await 해봄('boss@sl.local', '사칭', 'naver', { providerId: 'NAVER-FAKE-BOSS' });
        const 네이버사람 = db.findUserByEmail('boss@sl.local');
        ok('계정은 만들어진다 (막는 자리가 아니다)', n.ok, true);
        ok('★ 그런데 관리자는 안 된다', 네이버사람 && 네이버사람.role, 'user');

        // 구글(확인된 길)로 같은 주소가 들어오면 — 그때는 승격된다
        const g = await 해봄('boss2@sl.local', '주인', 'google',
          { providerId: 'G-BOSS', emailVerified: true });
        process.env.ADMIN_EMAIL = 'boss2@sl.local';
        const g2 = await 해봄('boss2@sl.local', '주인', 'google',
          { providerId: 'G-BOSS', emailVerified: true });
        void g; void g2;
        const 구글사람 = db.findUserByEmail('boss2@sl.local');
        ok('  확인된 메일(구글)로는 승격된다 (주인이 막히지 않는다)',
          구글사람 && 구글사람.role, 'admin');

        // 네이버가 **확인됐다고 값으로 알려주면** 그때는 믿는다 (`emailVerified: true`)
        process.env.ADMIN_EMAIL = 'boss3@sl.local';
        await 해봄('boss3@sl.local', '주인', 'naver',
          { providerId: 'NAVER-VERIFIED', emailVerified: true });
        const 확인된 = db.findUserByEmail('boss3@sl.local');
        ok('  네이버가 확인됐다고 알려주면 믿는다', 확인된 && 확인된.role, 'admin');
      } finally {
        if (전 === undefined) delete process.env.ADMIN_EMAIL; else process.env.ADMIN_EMAIL = 전;
      }
    }

    console.log('');
    console.log('── 메일이 없거나 이상하면 (여태 그대로) ──');
    ok('메일이 없으면 계정을 안 만든다', (await 해봄('', 'x', 'naver', {})).why, 'OAUTH_NO_EMAIL');
    ok('  @ 가 없는 것도 그렇다', (await 해봄('abc', 'x', 'naver', {})).why, 'OAUTH_NO_EMAIL');

    console.log('');
    if (되돌림) {
      if (bad > 0) { console.log('되돌려: FAIL ' + bad + '건 — 자가 그 자리를 잡는다'); process.exit(0); }
      console.log('★ 되돌려인데 다 통과했다 — **이 자는 그 자리를 못 본다**');
      process.exit(1);
    }
    if (bad > 0) { console.log(bad + '건 FAIL'); process.exit(1); }
    console.log('모두 통과');
    process.exit(0);
  } catch (err) {
    console.error('터짐:', err);
    process.exit(1);
  }
})();
