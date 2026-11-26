// **사람 줄의 칸이 밖으로 새지 않는가** (2026-11-26 · 정석)
//
//   node scripts/check-mefields.cjs            (npm run check 가 찾아서 돈다)
//   node scripts/check-mefields.cjs --되돌려    옛 꼴(빼는 목록)을 먹여 본다
//
// ── 왜 생겼나 ──
//
// `/auth/me` 가 여태 **빼는 목록**이었다 — `const { password, ...safeUser } = user`.
// 그러면 사용자 줄에 칸이 하나 생길 때마다 **그 칸이 묻지도 않고 밖으로 나간다.**
// 11/26 에 그 일이 났다: 소셜을 고유 번호로 잇게 하면서 `provider_ids`(네이버 · 구글이
// 준 그 사람의 번호)를 줄에 적었는데, 그 한 줄이 그것을 그대로 내보내고 있었다.
//
// 이 집은 다른 자리에서 **적는 목록**을 쓴다 — `routes/workouts.js` 의 `slim`
// (「읽지도 않는 칸을 보내지 않는다」) · `routes/exportAll.js` 의 `프로필`.
// 같은 선으로 바꿨고, 그것을 이 자가 지킨다.
//
// ── ★ 고치면서 하나 떨어뜨렸다 (그래서 이 자가 둘을 본다) ──
//
// 적는 목록으로 옮길 때 성별을 `gender` 라고 적었는데 **칸 이름은 `sex`** 다 —
// `checkAuth` 가 그 답의 `data.sex` 를 읽어 인바디 참고 범위에 쓴다. 10/01 에
// 「받아온다고 적어만 두고 실제로는 안 받아오던」 자리를 고쳤는데 하마터면 되돌릴
// 뻔했다. **적는 목록은 두 쪽을 다 봐야 한다** —
//
//   ⑴ 모르는 칸이 나가지 않는가 (새 칸은 **적어야** 나간다)
//   ⑵ 화면이 읽는 칸이 빠지지 않았는가 (**읽는 쪽을 보고** 센다)
const path = require('path');
const os = require('os');

const TMP = path.join(os.tmpdir(), `mefields-${process.pid}.json`);
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
const ROOT = path.join(__dirname, '..', '..');

// ── 나가도 되는 칸 ──
//
// **이 목록이 곧 약속이다.** 새 칸을 사용자 줄에 적는 사람은 여기에 올릴지 말지를
// 그 자리에서 정해야 한다 — 올리지 않으면 이 자가 운다(그리고 안 나간다).
const 나가도된다 = new Set([
  'id', 'email', 'nickname', 'username', 'role', 'created_at',
  'usernameChangedAt', 'username_changed_at',
  'has_password', 'is_social', 'sex',
  // 라우트가 `safeUser` 위에 더 얹는 것들 (줄의 칸이 아니라 그 자리에서 셈한 값)
  'grace_days', 'usernameDays', 'username_days_left', 'username_cooldown_days',
]);

// ── **절대 나가면 안 되는 칸** ──
// 지우기 유예 칸 둘도 **안 읽히는 칸**이다 — 옛 꼴(빼는 목록)에서는 새어 나갔다
const 나가면안된다 = ['password', 'provider_ids', 'deleting_at', 'delete_due_at'];

// 사람 줄에 있을 수 있는 칸을 **전부** 채워 둔다 — 그래야 「모르는 칸이 샌다」가 드러난다
function 사람만들기() {
  const id = db.createUser('me@mf.local', HASH, '나', 'mfme0001').lastInsertRowid;
  db.markHasPassword(id);
  db.markSocialAccount(id);
  db.updateUserSex(id, 'male');
  db.linkProvider(id, 'naver', 'NAVER-SECRET-12345');
  db.linkProvider(id, 'google', 'G-SECRET-9');
  // 삭제 유예 · 아이디 바꾼 날도 적어 둔다
  try { db.requestUserDeletion(id); } catch { /* 그 손이 없으면 건너뛴다 */ }
  try { db.updateUserUsername(id, 'mfme0002'); } catch { /* 30일 제한이면 건너뛴다 */ }
  return id;
}

/** `/auth/me` 의 마지막 손을 그대로 돌린다. 되돌림이면 **빼는 목록**으로 돌린다 */
function meOf() {
  const full = path.join(__dirname, '../src/routes/auth.js');
  let src = fs.readFileSync(full, 'utf-8');
  if (되돌림) {
    const 시작 = src.indexOf('  const safeUser = {');
    const 끝 = src.indexOf('  };', 시작) + 5;
    if (시작 < 0 || 끝 < 4) throw new Error('되돌릴 자리를 못 찾았다');
    src = src.slice(0, 시작) + '  const { password, ...safeUser } = user;\n' + src.slice(끝);
  }
  const 흉내 = path.join(__dirname, '..', 'src', 'routes', `.mefields-${process.pid}.js`);
  fs.writeFileSync(흉내, src, 'utf-8');
  process.on('exit', () => { try { fs.unlinkSync(흉내); } catch { /* 없어도 된다 */ } });
  const router = require(흉내);
  const layer = router.stack.find((l) => l.route && l.route.path === '/me' && l.route.methods.get);
  const hs = layer.route.stack;
  return hs[hs.length - 1].handle;
}

(async () => {
  try {
    const me = meOf();
    const uid = 사람만들기();
    const 줄 = db.findUserById(uid);
    const r = { code: 200, body: null };
    r.status = (c) => { r.code = c; return r; };
    r.json = (b) => { r.body = b; return r; };
    await me({ userId: uid, params: {}, query: {}, body: {}, get: () => '' }, r);

    console.log('── 판을 깔았다 ──');
    ok('줄에 칸이 넉넉히 들어 있다 (모집단 0 을 통과로 내보내지 않는다)',
      Object.keys(줄).length >= 10, true);
    ok('  그중 숨겨야 할 칸이 들어 있다',
      나가면안된다.every((k) => k in 줄), true);
    ok('답이 200 이다', r.code, 200);

    console.log('');
    console.log('── ⑴ 모르는 칸이 나가지 않는가 ──');
    const 나간칸 = Object.keys(r.body || {});
    const 모르는것 = 나간칸.filter((k) => !나가도된다.has(k));
    ok('★ 적어둔 칸만 나간다', 모르는것, []);
    if (모르는것.length) {
      console.log('     ↑ 사람 줄에 칸이 생겼다. **나가도 되는지 정하고** 위 `나가도된다` 에');
      console.log('       올리거나, `routes/auth.js` 의 적는 목록에서 빼세요');
    }
    for (const k of 나가면안된다) {
      ok('  `' + k + '` 는 안 나간다', k in (r.body || {}), false);
    }

    console.log('');
    console.log('── ⑵ 화면이 읽는 칸이 빠지지 않았는가 ──');
    // **읽는 쪽을 보고 센다** — 화면 소스에서 `/auth/me` 의 답을 읽는 자리를 훑는다
    const 읽는자리 = [
      'frontend/src/store/authStore.js',
      'frontend/src/components/AccountSheet.jsx',
      'frontend/src/components/AccountDeleteModal.jsx',
      'frontend/src/pages/SettingsPage.jsx',
    ];
    const 읽는칸 = new Set();
    for (const rel of 읽는자리) {
      const p = path.join(ROOT, rel);
      if (!fs.existsSync(p)) continue;
      const src = fs.readFileSync(p, 'utf-8')
        .split(String.fromCharCode(10))
        .filter((l) => !l.trim().startsWith('//'))
        .join(String.fromCharCode(10));
      // `data.sex` · `me?.is_social` 처럼 그 답에서 꺼내는 꼴만 센다
      for (const m of src.matchAll(/\b(?:data|me)\??\.([a-zA-Z_][\w]*)/g)) 읽는칸.add(m[1]);
    }
    // 그 답과 아무 상관 없는 이름은 뺀다 (딴 길의 답 · 함수 이름)
    const 딴것 = new Set(['token', 'restored', 'message', 'error', 'settings', 'vapidPublicKey',
      'available', 'daysLeft', 'devices', 'sent', 'workout', 'tag', 'js', 'map', 'filter', 'length',
      'then', 'catch', 'data', 'response', 'status', 'score', 'updatedAt', 'items', 'count', 'id']);
    const 읽지만안나가는것 = [...읽는칸].filter((k) => !딴것.has(k) && !(k in (r.body || {})));
    ok('★ 화면이 읽는 칸이 다 나간다', 읽지만안나가는것, []);
    if (읽지만안나가는것.length) {
      console.log('     ↑ 적는 목록에서 떨어뜨린 칸이다. 그 화면은 **조용히 빈 값**을 받는다');
      console.log('       (11/26 에 `sex` 를 `gender` 로 잘못 적어 하마터면 이 꼴이 났다)');
    }
    // 못 떨어뜨리게 못을 박는다 — 이 넷은 화면이 분명히 읽는다
    for (const k of ['email', 'nickname', 'role', 'sex']) {
      ok('  `' + k + '` 는 나간다', k in (r.body || {}), true);
    }

    console.log('');
    console.log('── ⑶ 관리자 목록도 같은 류다 ──');
    //
    // `GET /security/users` 도 **빼는 목록**이었다(`{ password, ...rest }`) — 그러면
    // 사용자 줄에 칸이 생길 때마다 **모든 사람의 그 칸**이 관리자 화면으로 나간다.
    // 「류를 하나 닫으면 앱 전체에서 그 류를 훑는 것까지가 한 건」이라 같이 본다.
    // 화면(`SecurityPanel`)이 읽는 것은 일곱이다
    {
      const sec = 되돌림
        ? null
        : require('../src/routes/security.js');
      const 화면이읽는것 = ['id', 'email', 'nickname', 'username', 'role', 'is_banned', 'created_at'];
      if (!sec) {
        ok('  (되돌려에서는 안 본다 — 그 판은 `/me` 만 되돌린다)', true, true);
      } else {
        const layer = sec.stack.find((l) => l.route && l.route.path === '/users' && l.route.methods.get);
        const hs = layer.route.stack;
        const r2 = { code: 200, body: null };
        r2.status = (c) => { r2.code = c; return r2; };
        r2.json = (b) => { r2.body = b; return r2; };
        await hs[hs.length - 1].handle({ userId: uid, params: {}, query: {}, body: {}, get: () => '' }, r2);
        const 한줄 = Array.isArray(r2.body) ? r2.body.find((x) => x.id === uid) : null;
        ok('그 목록에 내가 있다 (모집단 0 을 통과로 내보내지 않는다)', !!한줄, true);
        const 샌것 = 한줄 ? Object.keys(한줄).filter((k) => !화면이읽는것.includes(k)) : ['못 읽었다'];
        ok('★ 화면이 읽는 일곱만 나간다', 샌것, []);
        for (const k of ['password', 'provider_ids', 'sex', 'deleting_at']) {
          ok('  `' + k + '` 는 안 나간다', 한줄 ? (k in 한줄) : true, false);
        }
      }
    }

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
