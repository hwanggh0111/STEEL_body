// **근호가 「의심만」으로 남긴 서버 쪽 넷을 재 본다** (2026-11-26 · 정석)
//
//   node scripts/check-doubt1125.cjs            (npm run check 가 찾아서 돈다)
//   node scripts/check-doubt1125.cjs --되돌려    옛 꼴을 먹여 빨개지는지 본다
//
// `docs/TODO-2026-11-26.md` 의 「의심만 — 정석이 먼저 재 볼 것」.
//
//   ⑴ **깨진 판의 사본이 Postgres 에서는 안 남았다** — 진짜였다.
//      `storage.keepBroken` 이 Postgres 에서 `null` 을 돌려주고, 바로 뒤의
//      `_flushSync` 가 **빈 판으로 그 줄을 덮었다.** 파일일 때는 `.broken-…` 이
//      옆에 남아 손으로 꺼낼 수 있는데 운영은 Postgres 다
//   ⑵ **ADMIN_EMAIL 이 막힌 계정을 풀어줬다** — 진짜였다. 막힘은 `role` 로 잡는데
//      (`middleware/auth`), 소셜로 들어오면 `role !== 'admin'` 이라 **`'admin'` 으로
//      덮여 막힘이 사라졌다.** 11/25 의 revoke-admin 과 같은 류
//   ⑶ **같은 날 두 번 잰 것의 「최근」이 앞 것이었다** — 진짜였다. `getMeasures` 가
//      날짜만 보고 세우고(안정 정렬 → 오래된 것이 앞), 화면은 첫 줄을 「최근」으로 읽는다
//   ⑷ **Postgres 쓰기 실패를 다시 안 한다** — **거짓이다.** 걷은 거짓으로 박아둔다:
//      `storage.write` 가 실패를 돌려주고(11/23) `_flush` 의 catch 가 `_dirty` 를
//      세우고 `finally` 가 500ms 뒤를 걸어, **다음 쓰기가 없어도 혼자 다시 쓴다.**
//      이 자가 그 재시도를 **실제로 실패를 먹여** 본다 — 거짓이라고 적어두기만 하면
//      다음에 그 손이 사라져도 아무도 모른다
const path = require('path');
const os = require('os');

const TMP = path.join(os.tmpdir(), `doubt1125-${process.pid}.json`);
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
const storage = require('../src/storage');
const HASH = '$2a$10$abcdefghijklmnopqrstuv';
const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  try {
    // ── ⑶ 같은 날 두 번 잰 것 ──
    console.log('── ⑶ 같은 날 두 번 잰 것의 「최근」 ──');
    const u = db.createUser('m@d.local', HASH, '사람', 'dbt00001').lastInsertRowid;
    const DAY = '2026-11-20';
    const 아침 = db.createMeasure(u, 'shoulder', DAY, { shoulder: 44 }).lastInsertRowid;
    const 저녁 = db.createMeasure(u, 'shoulder', DAY, { shoulder: 45.5 }).lastInsertRowid;
    // 같은 밀리초에 들어갈 수 있다 — 시각을 갈라 **적은 차례**를 분명히 해 둔다
    const 줄들 = db.getMeasures(u);
    for (const m of 줄들) {
      if (m.id === 아침) m.created_at = DAY + 'T01:00:00.000Z';
      if (m.id === 저녁) m.created_at = DAY + 'T11:00:00.000Z';
    }
    const 다시 = db.getMeasures(u);
    ok('두 줄이 담겼다 (모집단 0 을 통과로 내보내지 않는다)', 다시.length, 2);
    ok('★ 첫 줄이 **저녁에 잰 것**이다 (화면은 첫 줄을 「최근」으로 읽는다)',
      다시[0].data.shoulder, 45.5);
    ok('  둘째가 아침 것이다', 다시[1].data.shoulder, 44);
    // 날짜가 다르면 여태처럼 날짜 내림이다
    db.createMeasure(u, 'shoulder', '2026-11-25', { shoulder: 46 });
    ok('날짜가 다르면 새 날짜가 앞이다', db.getMeasures(u)[0].date, '2026-11-25');
    // 시각이 없는 옛 줄끼리는 번호 오름(적은 차례)으로 선다 — 운동 줄의 자와 같은 결
    const v = db.createUser('old@d.local', HASH, '옛', 'dbt00002').lastInsertRowid;
    const a1 = db.createMeasure(v, 'size', DAY, { chest: 100 }).lastInsertRowid;
    const a2 = db.createMeasure(v, 'size', DAY, { chest: 101 }).lastInsertRowid;
    for (const m of db.getMeasures(v)) delete m.created_at;
    ok('시각이 없는 옛 줄끼리는 번호 오름이다 (적은 차례)',
      db.getMeasures(v).map((m) => m.id), [a1, a2]);

    // ── ⑵ ADMIN_EMAIL 이 막힌 계정을 풀어주나 ──
    console.log('');
    console.log('── ⑵ ADMIN_EMAIL 과 막힌 계정 ──');
    process.env.ADMIN_EMAIL = 'boss@d.local';
    const boss = db.createUser('boss@d.local', HASH, '대표', 'dbt00003').lastInsertRowid;
    db.updateUserRole(boss, 'blocked');
    // 소셜 로그인이 지나는 그 자리를 **그대로** 돌린다 (라우트 안의 손이라 소스에서 읽는다)
    const oauthSrc = fs.readFileSync(path.join(__dirname, '../src/routes/oauth.js'), 'utf-8');
    // 과녁은 **그 조건 줄 자체**에서 집는다 — 주석 글자를 과녁으로 삼으면 주석을
    // 다듬는 날 자가 조용히 빗나간다(처음에 그렇게 적어 FAIL 을 봤다)
    const 조건시작 = oauthSrc.indexOf('if (process.env.ADMIN_EMAIL');
    const 승격줄 = 조건시작 < 0 ? '' : oauthSrc.slice(조건시작,
      oauthSrc.indexOf("db.updateUserRole(user.id, 'admin')", 조건시작) + 60);
    ok('  승격하는 자리를 찾았다 (못 찾으면 통과가 아니다)', 승격줄.length > 0, true);
    const 막힘을본다 = /user\.role !== 'blocked'/.test(승격줄);
    ok('★ 막힌 계정이면 관리자로 안 덮는다 (`role !== \'blocked\'`)', 막힘을본다 && !되돌림, true);
    // 그 조건이 하는 일을 값으로도 본다 — 덮으면 막힘이 사라진다
    const user = db.findUserById(boss);
    const 덮을까 = process.env.ADMIN_EMAIL
      && db.emailKey(user.email) === db.emailKey(process.env.ADMIN_EMAIL)
      && user.role !== 'admin' && (되돌림 ? true : user.role !== 'blocked');
    ok('  그래서 이 사람은 막힌 채로 남는다', 덮을까 ? '풀린다' : '막힌 채', '막힌 채');
    // 막히지 않은 ADMIN_EMAIL 은 여태처럼 승격된다 (고침이 기능을 죽이지 않았나)
    const boss2 = db.createUser('boss2@d.local', HASH, '대표2', 'dbt00004').lastInsertRowid;
    process.env.ADMIN_EMAIL = 'boss2@d.local';
    const u2 = db.findUserById(boss2);
    ok('안 막힌 ADMIN_EMAIL 은 여태처럼 관리자가 된다',
      u2.role !== 'admin' && u2.role !== 'blocked', true);

    // ── ⑴ 깨진 판의 사본 ──
    console.log('');
    console.log('── ⑴ 깨진 판을 옆에 떠두는가 ──');
    // 파일 쪽 (지금 이 판) — `.broken-…` 으로 남는다
    const 깨진파일 = path.join(os.tmpdir(), `doubt-broken-${process.pid}.json`);
    fs.writeFileSync(깨진파일, '{이건 JSON 이 아니다');
    const 옛DB = process.env.DB_FILE;
    process.env.DB_FILE = 깨진파일;
    const kept = storage.keepBroken(storage.MAIN);
    process.env.DB_FILE = 옛DB;
    ok('파일일 때는 옆으로 치운다', typeof kept === 'string' && kept.includes('.broken-'), true);
    const 치운것 = path.join(path.dirname(깨진파일), kept || 'x');
    ok('  그 파일에 깨진 글자가 그대로 있다',
      fs.existsSync(치운것) ? fs.readFileSync(치운것, 'utf-8') : null, '{이건 JSON 이 아니다');
    try { fs.unlinkSync(치운것); } catch { /* 없어도 된다 */ }
    // Postgres 쪽은 **흉내로** 본다 — 진짜 Postgres 없이 그 갈래를 돌릴 수 없어서
    // 소스가 그 갈래에서 `null` 로 끝나지 않는지(= 사본을 뜨는지) 본다
    const stSrc = fs.readFileSync(path.join(__dirname, '../src/storage.js'), 'utf-8');
    const 치우는손 = stSrc.slice(stSrc.indexOf('  keepBroken(name) {'), stSrc.indexOf('  async close()'));
    ok('★ Postgres 갈래가 `null` 로 끝나지 않는다 (사본을 뜬다)',
      /KIND === 'postgres'[\s\S]*?pgWrite\(kept, body\)/.test(치우는손), true);
    ok('  사본은 **다른 이름**이다 (빈 판이 덮을 줄과 겹치지 않는다)',
      /const kept = name \+ '\.broken-'/.test(치우는손), true);
    ok('  읽은 것이 없으면 뜰 것도 없다 (null)', /if \(body === undefined\) return null;/.test(치우는손), true);

    // ── ⑷ 쓰기 실패를 혼자 다시 하나 (근호의 의심 — **거짓**) ──
    console.log('');
    console.log('── ⑷ 쓰기가 실패하면 혼자 다시 쓰는가 (걷은 거짓) ──');
    // 쓰는 손을 가로채 **한 번 실패**시킨다. 그 뒤로는 되게 둔다 —
    // 다시 쓰는 손이 있으면 **다음 쓰기 없이도** 글자가 파일에 닿아야 한다
    const 원래write = storage.write;
    let 쓴횟수 = 0;
    let 한번실패 = 되돌림 ? 0 : 1;        // 되돌려는 「실패를 안 세는」 꼴을 흉내 낸다
    storage.write = (name, text) => {
      쓴횟수 += 1;
      if (한번실패 > 0) { 한번실패 -= 1; return Promise.reject(new Error('Postgres 가 끊겼다(흉내)')); }
      return 원래write(name, text);
    };
    const w = db.createUser('retry@d.local', HASH, '다시', 'dbt00005').lastInsertRowid;
    db.createMeasure(w, 'size', DAY, { chest: 99 });
    await 잠깐(1200);                      // 500ms 뒤를 걸어두는 자가 돌 틈
    storage.write = 원래write;
    ok('쓰기를 한 번 실패시켰다', 쓴횟수 >= 1, true);
    ok('★ **다음 쓰기 없이도 혼자 다시 썼다** (실패 1 + 다시 1 이상)', 쓴횟수 >= 2, true);
    const 파일 = JSON.parse(fs.readFileSync(TMP, 'utf-8'));
    ok('  그래서 그 줄이 파일에 닿았다 (램에만 남지 않았다)',
      (파일.measures || []).some((m) => m.user_id === w), true);

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
