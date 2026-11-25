// **11/25 밤 둘째 점검에서 고친 서버 쪽 넷을 지킨다** (2026-11-25 · 근호).
//
//   node scripts/check-sweep1125.cjs     (npm run check 에도 들어 있다 — 찾아서 돈다)
//
//   ① 정지 다시 셈 — 옛 위반 하나를 걷으면 **지금 정지가 통째로 풀렸다** (reports.js)
//   ② revoke-admin — role 을 안 보고 'user' 로 바꿔 **막힌 사람이 풀렸다** (security.js)
//   ③ 측정 값 — 배열 · 참거짓이 수 칸을 지나 그 꼴로 담겼다 (measureRange.js)
//   ④ 측정 · 날짜 메모 — 한 사람이 쥘 수 있는 양에 상한이 없었다 (measures.js · notes.js)
//
// 임시 DB 에 담고 **라우터의 손을 그대로** 돌린다(인증 · 문지기 뒤의 마지막 손).
const path = require('path');
const os = require('os');

const TMP = path.join(os.tmpdir(), `sweep1125-${process.pid}.json`);
process.env.DB_FILE = TMP;
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
require('./_tmpdb.cjs')(TMP);

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const db = require('../src/db');
const handlerOf = (router, method, p) => {
  const layer = router.stack.find((l) => l.route && l.route.path === p && l.route.methods[method]);
  const hs = layer.route.stack;
  return hs[hs.length - 1].handle;
};
const call = async (router, method, p, req) => {
  const r = { code: 200, body: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  await handlerOf(router, method, p)({ params: {}, query: {}, body: {}, get: () => '', ip: '127.0.0.1', ...req }, r);
  return r;
};
const HASH = '$2a$10$abcdefghijklmnopqrstuv';
const DAY = 86400000;

(async () => {
  try {
    // ── ① 정지 다시 셈 ──
    console.log('── ① 옛 위반 하나를 걷어도 지금 정지는 남는다 ──');
    const admin = db.createUser('ad@sw.local', HASH, '관리', 'swadmin1').lastInsertRowid;
    db.updateUserRole(admin, 'admin');
    const u = db.createUser('u@sw.local', HASH, '사람', 'swuser01').lastInsertRowid;
    const now = Date.now();
    // 위반 넷: 24일 전 · 15일 전 · 5일 전 · 1일 전 (마지막 것에서 7일 정지 → 6일 남았다).
    // 하나를 걷으면 셋 = 3일 — 마지막(1일 전)부터면 이틀 남고, 처음(24일 전)부터면 이미 지났다
    const ago = [24, 15, 5, 1];
    for (const d of ago) db.addAbuseLog(u, { level: 'strong', hits: ['x'], where: 'report', text: 'x', action: 'x', days: 1 });
    const logs = db.abuseLogsOf(u);
    logs.forEach((a, i) => { a.created_at = new Date(now - ago[i] * DAY).toISOString(); });
    ok('위반 넷이 담겼다 (모집단 0 을 통과로 내보내지 않는다)', db.abuseLogsOf(u).map((a) => a.created_at === logs[0].created_at).length, 4);
    // 그때 선 정지들 — 처음 것은 24일 전에 서서 이미 지났고, 지금 것은 1일 전에 섰다.
    // `getSuspension` 이 담긴 줄 그 자체를 돌려주므로, 살아 있을 때 잡아 선 때를 옮긴다
    db.createSuspension(u, 3, 'abuse', 'x', new Date(now + DAY).toISOString());
    const s1 = db.getSuspension(u);
    s1.created_at = new Date(now - 24 * DAY).toISOString();
    s1.expires_at = new Date(now - 23 * DAY).toISOString();
    db.createSuspension(u, 3, 'abuse', 'x', new Date(now + 6 * DAY).toISOString());
    db.getSuspension(u).created_at = new Date(now - 1 * DAY).toISOString();
    ok('  지금 정지가 서 있다', !!db.getSuspension(u), true);
    const reports = require('../src/routes/reports');
    const r1 = await call(reports, 'patch', '/abuse/:id', { userId: admin, params: { id: String(logs[0].id) }, body: { dismissed: true } });
    ok('오탐 하나(24일 전)를 걷었다', r1.code, 200);
    ok('**남은 셋(3일)을 마지막 위반(1일 전)부터 세어 아직 정지다**', !!db.getSuspension(u), true);
    const hate = db.createUser('h@sw.local', HASH, '미움', 'swhate01').lastInsertRowid;
    db.addAbuseLog(hate, { level: 'hate', hits: ['y'], where: 'report', text: 'y', action: 'y', days: 7 });
    db.addAbuseLog(hate, { level: 'strong', hits: ['z'], where: 'report', text: 'z', action: 'z', days: 1 });
    const hl = db.abuseLogsOf(hate);
    db.createSuspension(hate, 3, 'abuse-hate', 'y', new Date(now + 7 * DAY).toISOString());
    await call(reports, 'patch', '/abuse/:id', { userId: admin, params: { id: String(hl[1].id) }, body: { dismissed: true } });
    ok('미움 표현이 남아 있으면 다시 선 정지도 그 이름이다', db.getSuspension(hate)?.reason, 'abuse-hate');

    // ── ② revoke-admin ──
    console.log('');
    console.log('── ② 관리자 해제는 관리자에게만 ──');
    const admin2 = db.createUser('ad2@sw.local', HASH, '관리둘', 'swadmin2').lastInsertRowid;
    db.updateUserRole(admin2, 'admin');
    const blocked = db.createUser('b@sw.local', HASH, '막힘', 'swblock1').lastInsertRowid;
    db.updateUserRole(blocked, 'blocked');
    const security = require('../src/routes/security');
    const r2 = await call(security, 'post', '/revoke-admin/:id', { userId: admin, params: { id: String(blocked) } });
    ok('**막힌 사람에게 부르면 거절한다**', r2.code, 400);
    ok('  막힌 채로 남는다', db.findUserById(blocked).role, 'blocked');
    const r3 = await call(security, 'post', '/revoke-admin/:id', { userId: admin, params: { id: String(admin2) } });
    ok('관리자에게는 그대로 된다', [r3.code, db.findUserById(admin2).role], [200, 'user']);

    // ── ③ · ④ 측정 ──
    console.log('');
    console.log('── ③ 측정 값의 꼴 · ④ 쥘 수 있는 양 ──');
    const measures = require('../src/routes/measures');
    const m = db.createUser('m@sw.local', HASH, '측정', 'swmeas01').lastInsertRowid;
    const post = (data) => call(measures, 'post', '/', { userId: m, body: { type: 'bodySize', date: '2026-11-20', data } });
    ok('수 칸에 배열이면 거절', (await post({ waist: [80] })).code, 400);
    ok('수 칸에 참거짓이면 거절', (await post({ waist: true })).code, 400);
    ok('  숫자 글자는 받는다', (await post({ waist: '80' })).code, 201);
    for (let i = 0; i < 20000; i += 1) db.createMeasure(m, 'bodySize', '2026-11-21', { waist: 80 });
    ok('**2만 줄이 차면 더 안 받는다**', (await post({ waist: '81' })).code, 409);

    const notes = require('../src/routes/notes');
    const n = db.createUser('n@sw.local', HASH, '메모', 'swnote01').lastInsertRowid;
    const base = Date.UTC(2010, 0, 1);
    for (let i = 0; i < 4000; i += 1) {
      db.createNote(n, '메모', new Date(base + i * DAY).toISOString().slice(0, 10));
    }
    const nr = await call(notes, 'post', '/', { userId: n, body: { body: '하나 더', date: '2024-06-01' } });
    ok('**날짜 메모가 4천 장이면 새 날짜는 안 받는다**', nr.code, 409);
    const nu = await call(notes, 'post', '/', { userId: n, body: { body: '고침', date: '2010-01-01' } });
    ok('  이미 있는 날짜는 고칠 수 있다', nu.code, 200);

    console.log('');
    if (bad > 0) { console.log(bad + '건 FAIL'); process.exit(1); }
    console.log('모두 통과');
    process.exit(0);
  } catch (err) {
    console.error('터짐:', err);
    process.exit(1);
  }
})();
