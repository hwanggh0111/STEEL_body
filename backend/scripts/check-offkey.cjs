// **지하에서 세운 줄의 로컬 id 로도 고치고 지울 수 있는가** (2026-11-26 · 정석)
//
//   node scripts/check-offkey.cjs            (npm run check 가 찾아서 돈다)
//   node scripts/check-offkey.cjs --되돌려    옛 꼴(숫자만 받는 길)을 흉내 내 본다
//
// ── 왜 이 자가 생겼나 ──
//
// TODO 11/26 높음 1. 지하에서 적은 줄은 화면에서 `local-…` id 를 달고, 올라가면
// 서버 번호가 생긴다 — 그런데 **수정 칸을 먼저 열어둔 사람 손에는 옛 로컬 id** 가
// 남는다. 화면 쪽은 `check-offedit`(frontend)이 닫았고, 여기는 **그 손이 서버에
// 닿았을 때** 서버가 알아보는지를 본다.
//
// 서버 줄에는 그 로컬 id 가 `client_key` 로 남아 있다 — 두 번 넣지 않으려고 두는
// 표인데, **그 표가 곧 「그 줄이 무엇이 되었나」**다.
//
// ── 무엇을 보는가 ──
//
//   ⑴ `PUT /workouts/local-…` 가 그 줄을 고친다 (DELETE 도 그 줄을 지운다)
//   ⑵ **남의 줄은 안 건드린다** — `client_key` 가 같아도 사람이 다르면 404 다
//      (로컬 id 는 기기에서 지은 것이라 두 사람 것이 같을 수 있다)
//   ⑶ 모양은 맞는데 그런 줄이 없으면 **404**(「없는 줄」) — 400 이 아니다
//   ⑷ 값이 아닌 id 는 여태처럼 **400** 이다 (`0` · 음수 · 글자 · 너무 긴 것)
//   ⑸ 찾는 손이 **색인으로** 돈다 — 모든 사람의 모든 줄을 훑지 않는다
//   ⑺ **적은 시각**(TODO 11/26 ④) — 줄에 세워뒀다 올린 줄이 「적은 순간」으로 찍히는가.
//      테두리를 넘는 값은 **거절**한다(조용히 지금으로 바꾸지 않는다). 그래야 그날
//      차례와 `data/pace.js` 의 운동 시간이 산다
//
// 임시 DB 에 담고 **라우터의 마지막 손**을 그대로 돌린다 (`check-sweep1125` 와 같은 결).
const path = require('path');
const os = require('os');

const TMP = path.join(os.tmpdir(), `offkey-${process.pid}.json`);
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
  return pass;
};

const db = require('../src/db');
const workouts = require('../src/routes/workouts');
const { normalizeCreatedAt } = require('../src/utils/workoutFields');

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
const DAY = new Date().toISOString().slice(0, 10);

// ── **되돌려는 「숫자만 받던 옛 길」을 흉내 낸다** ──
//
// 옛 코드는 `Number(req.params.id)` 하나였다 — `local-…` 은 `NaN` 이 되어
// 고치기는 **400**, 지우기는 `changes 0` 으로 **404** 였다. 그 꼴을 그대로 돌려
// 아래 ⑴ 판정이 빨개지는지 본다 (고침이 없으면 이 자도 조용하다는 뜻이 아닌지).
const 옛길 = (raw) => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
};

(async () => {
  try {
    const me = db.createUser('me@ok.local', HASH, '나', 'okuser001').lastInsertRowid;
    const other = db.createUser('other@ok.local', HASH, '남', 'okuser002').lastInsertRowid;

    // 지하에서 적어 올라간 줄 — `client_key` 에 그 로컬 id 가 남는다
    const KEY = 'local-abc123-xyz';
    const mineRow = db.createWorkout(me, DAY, '벤치프레스', '80', 1, 10, KEY);
    // **남도 같은 로컬 id 를 가질 수 있다** (기기에서 지은 글자다) — 남의 줄도 하나 둔다
    const otherRow = db.createWorkout(other, DAY, '스쿼트', '100', 1, 5, KEY);

    console.log('── ⑴ 로컬 id 로 찾는다 ──');
    ok('내 줄을 찾는다', db.findWorkoutByClientKey(me, KEY)?.id, mineRow.lastInsertRowid);
    ok('**남의 줄은 안 준다** (같은 열쇠여도)', db.findWorkoutByClientKey(other, KEY)?.id, otherRow.lastInsertRowid);
    ok('없는 열쇠는 null', db.findWorkoutByClientKey(me, 'local-없다'), null);
    ok('빈 열쇠도 null (모든 줄의 `client_key` 가 없는 것과 맞물리지 않는다)',
      db.findWorkoutByClientKey(me, null), null);

    console.log('');
    console.log('── ⑵ PUT /workouts/local-… ──');
    const put = await call(workouts, 'put', '/:id', {
      userId: me, params: { id: 되돌림 ? String(옛길(KEY)) : KEY },
      body: { date: DAY, exercise: '벤치프레스', weight: '85', sets: 1, reps: 10 },
    });
    ok('200 으로 고쳤다', put.code, 200);
    ok('**서버 줄의 무게가 바뀌었다**',
      db.getWorkouts(me).find((w) => w.id === mineRow.lastInsertRowid)?.weight, '85');
    ok('  남의 줄은 그대로다',
      db.getWorkouts(other).find((w) => w.id === otherRow.lastInsertRowid)?.weight, '100');

    console.log('');
    console.log('── ⑶ 모양은 맞는데 그런 줄이 없으면 404 ──');
    const gone = await call(workouts, 'put', '/:id', {
      userId: me, params: { id: 'local-없는것-999' },
      body: { date: DAY, exercise: '벤치프레스', weight: '85', sets: 1, reps: 10 },
    });
    ok('404 다 (400 이 아니다 — 「잘못 보냈다」가 아니라 「없는 줄」이다)', gone.code, 404);

    console.log('');
    console.log('── ⑷ 값이 아닌 id 는 400 ──');
    for (const [이름, id] of [['0', '0'], ['음수', '-3'], ['글자', 'abc'], ['긴 로컬 id', 'local-' + 'x'.repeat(70)]]) {
      const r = await call(workouts, 'put', '/:id', {
        userId: me, params: { id },
        body: { date: DAY, exercise: '벤치프레스', weight: '85', sets: 1, reps: 10 },
      });
      ok('  ' + 이름 + ' → 400', r.code, 400);
    }

    console.log('');
    console.log('── ⑸ DELETE /workouts/local-… ──');
    const del = await call(workouts, 'delete', '/:id', {
      userId: me, params: { id: 되돌림 ? String(옛길(KEY)) : KEY },
    });
    ok('200 으로 지웠다', del.code, 200);
    ok('**서버 줄이 사라졌다**', db.getWorkouts(me).some((w) => w.id === mineRow.lastInsertRowid), false);
    ok('  남의 줄은 남아 있다', db.getWorkouts(other).some((w) => w.id === otherRow.lastInsertRowid), true);
    const del2 = await call(workouts, 'delete', '/:id', { userId: me, params: { id: KEY } });
    ok('두 번 지우면 404 (두 번 눌러도 안 터진다)', del2.code, 404);

    console.log('');
    console.log('── ⑹ 찾는 손이 색인으로 돈다 ──');
    // 사람 하나에 줄 2,000 개를 담고, **없는 열쇠**를 천 번 찾아본다.
    // 모든 사람의 모든 줄을 훑으면(옛 꼴) 이 판에서 눈에 띄게 느려진다
    const many = db.createUser('many@ok.local', HASH, '많이', 'okuser003').lastInsertRowid;
    for (let i = 0; i < 2000; i += 1) db.createWorkout(many, DAY, '로우', '50', 1, 10, 'local-k' + i);
    const t0 = Date.now();
    for (let i = 0; i < 1000; i += 1) db.findWorkoutByClientKey(me, 'local-없다' + i);
    const ms = Date.now() - t0;
    ok('내 줄만 본다 — 천 번에 300ms 안 (실제 ' + ms + 'ms)', ms < 300, true);

    console.log('');
    console.log('── ⑺ 적은 시각 (TODO 11/26 ④) ──');
    const 적은때 = new Date(Date.now() - 3 * 3600 * 1000).toISOString();   // 세 시간 전
    const post = await call(workouts, 'post', '/', {
      userId: me, body: { date: DAY, exercise: '데드리프트', weight: '100', sets: 1, reps: 5,
        clientKey: 'local-t1-aaa', createdAt: 되돌림 ? undefined : 적은때 },
    });
    ok('201 로 담았다', post.code, 201);
    const 담긴줄 = db.getWorkouts(me).find((w) => w.client_key === 'local-t1-aaa');
    ok('**적은 순간으로 찍혔다** (받은 순간이 아니다)', 담긴줄?.created_at, 적은때);
    ok('  돌려주는 줄도 그 시각이다 (화면이 그것을 꽂는다)', post.body?.workout?.created_at, 적은때);

    // 안 보내면 지금을 찍는다 — 온라인에서 바로 적는 길이 그대로여야 한다
    const now = await call(workouts, 'post', '/', {
      userId: me, body: { date: DAY, exercise: '데드리프트', weight: '100', sets: 1, reps: 5 },
    });
    const 방금 = db.getWorkouts(me).find((w) => w.id === now.body?.id);
    ok('안 보내면 지금을 찍는다', Math.abs(Date.parse(방금?.created_at) - Date.now()) < 5000, true);

    // 테두리 — **거절**한다. 조용히 지금으로 바꾸면 ④ 를 고치나 마나다
    for (const [이름, 값] of [
      ['앞날 시각', new Date(Date.now() + 60 * 60 * 1000).toISOString()],
      ['1999년', '1999-12-31T23:59:59.000Z'],
      ['글자가 아닌 것', { a: 1 }],
      ['못 읽는 글자', '어제쯤'],
    ]) {
      const r = await call(workouts, 'post', '/', {
        userId: me, body: { date: DAY, exercise: '로우', weight: '50', sets: 1, reps: 10, createdAt: 값 },
      });
      ok('  ' + 이름 + ' → 400', r.code, 400);
    }
    // 시계가 조금 어긋난 폰은 봐준다 (5분)
    const skew = normalizeCreatedAt(new Date(Date.now() + 60 * 1000).toISOString());
    ok('1분 앞선 폰 시계는 받는다 (5분까지)', skew.ok, true);

    // **그날 차례가 적은 차례로 선다** — 지하에서 셋을 적어 한꺼번에 올린 판
    const 판 = db.createUser('batch@ok.local', HASH, '판', 'okuser004').lastInsertRowid;
    const 셋 = ['01:00', '01:05', '01:12'];
    for (const hh of 셋) {
      await call(workouts, 'post', '/', {
        userId: 판, body: { date: DAY, exercise: '벤치', weight: '60', sets: 1, reps: 10,
          clientKey: 'local-b-' + hh, createdAt: 되돌림 ? undefined : DAY + 'T' + hh + ':00.000Z' },
      });
    }
    // 서버 차례는 최신이 앞이다 (`ROW_CMP`) — 적은 시각이 살아 있으면 12분 것이 맨 위다
    const 그날 = db.getWorkouts(판).filter((w) => w.date === DAY);
    ok('**그날 차례가 적은 시각으로 선다** (최신이 앞)',
      그날.map((w) => String(w.created_at).slice(11, 16)), ['01:12', '01:05', '01:00']);

    console.log('');
    if (되돌림) {
      // 되돌려는 **빨개져야** 통과다 — 옛 길에서는 ⑵ · ⑸ 가 선다
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
