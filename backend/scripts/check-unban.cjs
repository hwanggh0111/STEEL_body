// **영구 정지를 되돌릴 수 있는가** (2026-10-22).
//
//   npm run unban     (npm run check 에도 들어 있다)
//
// ── 왜 ──
//
// 자동 판정(`aiGuard` 의 LEVEL 4)은 네 가지를 한다 —
//
//     영구 정지 기록 · 로그인 차단(`is_banned`) · 블랙리스트(이메일 + 주소) · 주소 영구 잠금
//
// 그 함수 머리글에는 **「데이터는 남긴다 — 오판이면 되돌려야 한다」**고 적혀 있다.
// 그런데 세어보니 **되돌리는 길이 넷 중 하나뿐이었다** —
//
//     영구 정지 기록   거는 자리 5 · 푸는 자리 0   (`clearSuspensions` 를 아무도 안 불렀다)
//     is_banned       거는 자리 2 · 푸는 자리 0   (false 로 되돌리는 코드가 아예 없었다)
//     블랙리스트       거는 자리 2 · 푸는 자리 0   (`removeBlacklist` 도 아무도 안 불렀다)
//     주소 잠금        「AI 차단 해제」가 푼다      ← 이것만 있었다
//
// 오판으로 걸린 사람은 기록은 남은 채 **영원히 못 들어오고**, 관리자가 할 수 있는 일은
// **지우기뿐**이었다. 되돌릴 수 있어야 할 자리에 삭제만 있는 셈이다.
//
// **눈으로 볼 수 없는 자리다** — 보려면 진짜 사람을 영구 정지시켜 봐야 한다.
// 그래서 걸고 · 풀고 · **다시 들어올 수 있는지**까지 값으로 본다.
const path = require('path');
const os = require('os');
const fs = require('fs');

const TMP = path.join(os.tmpdir(), `check-unban-${process.pid}.json`);
process.env.DB_FILE = TMP;
process.env.JWT_SECRET = 'check-unban-' + 'x'.repeat(30);
process.env.NODE_ENV = 'test';

fs.writeFileSync(TMP, JSON.stringify({
  users: [
    { id: 11, email: 'victim@x.test', username: 'victim', role: 'user' },
    { id: 12, email: 'boss@x.test', username: 'boss', role: 'admin' },
  ],
  _nextId: {},
}), 'utf-8');

const db = require('../src/db');
const aiGuard = require('../src/middleware/aiGuard');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const IP = '203.0.113.55';

console.log('── 자동 판정이 영구 정지를 건다 ──');
aiGuard.executeLevel4(11, IP, 'token_forge', '서명이 틀린 토큰 30회');
const user = db.findUserById(11);
ok('로그인이 막혔다', !!user.is_banned, true);
ok('영구 정지 기록이 남았다', db.getSuspensions().filter((s) => s.user_id === 11).length, 1);
ok('이메일이 블랙리스트에 들어갔다',
  db.getBlacklist().some((b) => b.type === 'email' && b.value === 'victim@x.test'), true);
ok('주소도 들어갔다', db.getBlacklist().some((b) => b.type === 'ip' && b.value === IP), true);
ok('  그 줄에 주인이 적혀 있다 (2026-10-22)',
  db.getBlacklist().filter((b) => b.user_id === 11).length, 2);
ok('주소가 잠겼다', aiGuard.getSuspiciousIPs().includes(IP), true);
// 그 주소에서는 **가입도 못 한다** — 이것이 제일 조용한 벌이다
ok('그 주소에서 가입이 막힌다', db.isBlacklisted('누구@x.test', IP, 'Mozilla'), true);

console.log('\n── 관리자가 되돌린다 ──');
const r = db.unbanUser(11);
ok('되돌렸다고 답한다', !!r && r.wasBanned, true);
ok('  영구 정지 기록을 뺐다', r.lifted, 1);
ok('  블랙리스트 두 줄을 뺐다', r.blacklist, 2);
ok('  뺀 주소를 같이 알려준다 (잠금도 풀어야 한다)', r.ips, [IP]);

const after = db.findUserById(11);
ok('로그인이 풀렸다', !after.is_banned, true);
ok('정지 기록이 없다', db.getSuspensions().filter((s) => s.user_id === 11).length, 0);
ok('블랙리스트가 비었다', db.getBlacklist().length, 0);
ok('그 주소에서 가입이 된다', db.isBlacklisted('누구@x.test', IP, 'Mozilla'), false);
// 주소 잠금은 부르는 쪽(라우트)이 푼다 — 그 길이 있는지 본다
ok('주소 잠금을 풀 길이 있다', typeof aiGuard.unblockIP, 'function');
aiGuard.unblockIP(IP);
ok('  풀고 나면 잠긴 목록에 없다', aiGuard.getSuspiciousIPs().includes(IP), false);

console.log('\n── 건드리지 말아야 할 것 ──');
// 욕설로 걸린 정지는 **날이 정해져 있고 저절로 풀린다.** 여기서 같이 풀면 욕설 벌이 사라진다
db.createSuspension(11, 3, 'abuse', '욕설 2회', new Date(Date.now() + 86400000).toISOString());
db.banUser(11);
const r2 = db.unbanUser(11);
ok('영구 정지만 푼다', r2.lifted, 0);
ok('  욕설 정지는 그대로 남는다',
  db.getSuspensions().filter((s) => s.user_id === 11 && s.reason === 'abuse').length, 1);
ok('  그래도 로그인 차단은 풀린다', !db.findUserById(11).is_banned, true);

console.log('\n── 걸린 것이 없으면 ──');
const r3 = db.unbanUser(12);
ok('없는 것을 풀었다고 하지 않는다', r3.wasBanned || r3.lifted || r3.blacklist, 0);
ok('없는 사람은 null', db.unbanUser(9999), null);

console.log('\n── 라우트가 넷을 한 번에 되돌리는가 ──');
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'security.js'), 'utf-8');
  ok('풀어주는 길이 있다', /router\.post\('\/unban\/:id'/.test(src), true);
  ok('  DB 쪽을 부른다', /db\.unbanUser\(/.test(src), true);
  ok('  주소 잠금도 같이 푼다', /aiGuard\.unblockIP\(/.test(src), true);
  ok('  아무것도 안 걸려 있으면 그렇게 말한다', /영구 정지가 없어요/.test(src), true);
}

console.log('');
console.log('── 화면에도 그 길이 있는가 ──');
// 서버에 길만 만들고 화면에 단추가 없으면 **아무도 못 쓴다.** 이 앱에서 이미 겪었다 —
// 「관리자를 내리는 길이 화면에 없었다」(SecurityPanel 주석). 같은 함정을 또 파지 않는다
{
  const panel = fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'SecurityPanel.jsx'), 'utf-8');
  ok('화면이 그 길을 부른다', /'unban': 'unban'/.test(panel), true);
  ok('  누르는 단추가 있다', /영구 정지 풀기/.test(panel), true);
  ok('  무엇이 같이 풀리는지 적어준다', panel.includes('블랙리스트(이메일 · 주소) · 주소 잠금'), true);
  // **영구 정지는 역할이 아니다** — 역할만 그리면 그 사람이 「일반」으로 보인다
  ok('영구 정지를 딱지로 보여준다', panel.includes("is_banned ? '영구 정지'"), true);
  ok('  머리에도 센다', /영구 정지 <b/.test(panel), true);
}

console.log('');
console.log('── **주인이 없어진 줄은 뺄 수 있는가** ── (2026-10-26)');
//
// 위의 길은 **사람 단위**로 푼다(`removeBlacklistFor`). 그래서 10/22 에 고친 뒤에도
// **`db.removeBlacklist` 를 부르는 자리는 0 이었다** — 그 머리글이 「푸는 자리 0」이라고
// 적어둔 바로 그 함수다.
//
// 사람이 없어지면 그 줄을 뺄 길이 없다. 계정을 지우면(`DELETE /user/:id`)
// `blacklist` 는 `USER_COLLECTIONS` 에 없어 **주인 없이 남고**, `unbanUser` 는 404 다.
// 그 줄이 주소면 **그 주소에서는 아무도 가입할 수 없다** — 통신사 NAT 뒤의 모두가.
{
  const ORPHAN_IP = '198.51.100.77';
  db.addBlacklist('ip', ORPHAN_IP, '지워진 사람 때문에 들어간 줄', 777);
  db.addBlacklist('email', 'ghost@x.test', '지워진 사람', 777);
  ok('주인이 없는 줄이 가입을 막는다', db.isBlacklisted('누구@x.test', ORPHAN_IP, 'Mozilla'), true);
  ok('  사람 단위로는 못 푼다 (그 사람이 없다)', db.unbanUser(777), null);

  const row = db.getBlacklist().find((b) => b.value === ORPHAN_IP);
  ok('한 줄만 빼는 길이 있다', db.removeBlacklist(row.id).changes, 1);
  ok('  그 주소에서 가입이 된다', db.isBlacklisted('누구@x.test', ORPHAN_IP, 'Mozilla'), false);
  ok('  없는 줄은 0 이다 (화면이 404 로 받는다)', db.removeBlacklist(999999).changes, 0);
  ok('  남은 줄은 그대로다', db.isBlacklisted('ghost@x.test', null, 'Mozilla'), true);

  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'security.js'), 'utf-8');
  ok('라우트가 그 함수를 부른다 (부르는 자리 0 이 아니다)', /db\.removeBlacklist\(/.test(src), true);
  ok('  길이 있다', /router\.delete\('\/blacklist\/:id'/.test(src), true);
  ok('  무엇을 풀었는지 기록에 남긴다', /블랙리스트 해제/.test(src), true);

  const ai = fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'AiAdminPanel.jsx'), 'utf-8');
  ok('화면에 푸는 단추가 있다', /security\/blacklist\/\$\{b\.id\}/.test(ai), true);
  ok('  가입이 막힌다는 것을 적어준다', /가입이 막힙니다/.test(ai), true);
  ok('  누구 때문에 넣은 줄인지 보여준다', /회원 \{b\.user_id\}/.test(ai), true);
}

db.flushNow();
setTimeout(() => {
  for (const p of [TMP, TMP.replace(/\.json$/, '') + '.photos.json']) {
    try { fs.unlinkSync(p); } catch (e) { /* 없으면 그만 */ }
  }
  console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
  process.exit(bad ? 1 : 0);
}, 700);
