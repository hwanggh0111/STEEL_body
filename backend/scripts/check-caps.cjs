// **한 사람이 쥘 수 있는 줄 수 — 일곱 자리가 다 막혀 있고, 두 길이 같은 수를 보는가**
// (2026-11-26 · 정석, 전수검사 ①)
//
//   node scripts/check-caps.cjs            (npm run check 가 찾아서 돈다)
//   node scripts/check-caps.cjs --되돌려    문을 하나씩 떼어 보고 **빨개지는지** 본다
//
// ── 왜 생겼나 ──
//
// 11/25 에 근호가 **측정 · 메모 둘에만** 상한을 붙였다. 11/26 전수검사에서 세어보니
// **같은 류가 다섯 자리 더** 있었다 — 운동(손으로 적는 길) · 인바디 · 계획(총량) ·
// 루틴(개수) · 제보. 이 DB 는 **파일 하나를 통째로 쓴다**: 한 사람이 불린 양이
// 모두의 저장 시간이 되고, 서버는 `--max-old-space-size=256` 으로 돈다.
//
// ── 무엇을 보는가 ──
//
//   ⑴ **값이 한 벌인가** — `utils/rowCaps.js` 하나에서 오고, 파일로 넣는 길
//      (`importData` 의 `KINDS[].max`)이 **그것을 든다.** 두 벌이면 한쪽을 올리는 날
//      사람은 「파일로는 들어가는데 손으로는 안 된다」를 겪는다
//   ⑵ **일곱 자리가 다 막혔나** — 손으로 적는 길을 **진짜로 돌려** 가득 찬 판에서
//      409 가 오는지 본다 (모르는 갈래를 물으면 터지는 것까지)
//   ⑶ **막는 말이 한 자리에서 오나** (`fullWhy`) — 자리마다 적으면 곧 다른 말을 한다
//   ⑷ **가득 차도 재전송은 막지 않는다** — 지하에서 세운 줄이 `clientKey` 로 다시
//      올라오는 것은 **새 줄이 아니다.** 그것까지 막으면 적어둔 것이 영영 못 올라간다
//   ⑸ **고치기 · 지우기는 막지 않는다** — 가득 찬 사람이 할 수 있는 일은 **지우는 것**이다
//
// 라우터의 **마지막 손**을 그대로 돌린다 (`check-sweep1125` 와 같은 결).
const path = require('path');
const os = require('os');

const TMP = path.join(os.tmpdir(), `caps-${process.pid}.json`);
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
const caps = require('../src/utils/rowCaps');

const handlerOf = (router, method, p) => {
  const layer = router.stack.find((l) => l.route && l.route.path === p && l.route.methods[method]);
  if (!layer) throw new Error('그 길을 못 찾았다: ' + method + ' ' + p);
  const hs = layer.route.stack;
  return hs[hs.length - 1].handle;
};
const call = async (router, method, p, req) => {
  const r = { code: 200, body: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.set = () => r; r.setHeader = () => r; r.send = (b) => { r.body = b; return r; };
  await handlerOf(router, method, p)({ params: {}, query: {}, body: {}, get: () => '', ip: '127.0.0.1', ...req }, r);
  return r;
};
const HASH = '$2a$10$abcdefghijklmnopqrstuv';
const DAY = new Date().toISOString().slice(0, 10);

// ── **되돌려는 문을 하나씩 뗀다** ──
//
// 소스에서 그 조건 줄을 지운 판을 지어 `require` 한다 — 꼴을 세는 것이 아니라
// **문이 없는 서버를 돌려** 가득 찬 판에서 담기는지 본다
const 문 = {
  운동: ['src/routes/workouts.js', "  if (!key && db.getWorkouts(req.userId).length >= capOf('workouts')) {"],
  인바디: ['src/routes/inbody.js', "  if (db.getInbody(req.userId).length >= capOf('inbody')) {"],
  계획: ['src/routes/plans.js', "  if (mine.length >= capOf('plans')) {"],
  루틴: ['src/routes/myRoutines.js', "  if (db.getMyRoutines(req.userId).length >= capOf('routines')) {"],
  제보: ['src/routes/reports.js', "  if (db.getReports(req.userId).length >= capOf('reports')) {"],
};

/** 그 길의 라우터를 준다. 되돌림이면 **문을 뗀 판**을 지어 준다 */
const made = [];
process.on('exit', () => { for (const f of made) { try { fs.unlinkSync(f); } catch { /* 없어도 된다 */ } } });
let 뗄것 = null;
function routerOf(이름) {
  const [rel] = 문[이름];
  const full = path.join(__dirname, '..', rel);
  if (뗄것 !== 이름) return require(full);
  const src = fs.readFileSync(full, 'utf-8');
  const 조건 = 문[이름][1];
  const 줄 = src.split(/\r?\n/);
  const at = 줄.findIndex((l) => l.replace(/\r$/, '') === 조건);
  if (at < 0) throw new Error('뗄 문을 못 찾았다 — ' + 이름 + ' : ' + 조건.trim());
  // 그 줄부터 닫는 중괄호까지 **셋 줄**을 비운다 (조건 · 409 · `}`)
  줄.splice(at, 3);
  const 흉내 = path.join(__dirname, '..', 'src', 'routes', `.caps-${이름}-${process.pid}.js`);
  made.push(흉내);
  fs.writeFileSync(흉내, 줄.join('\n'), 'utf-8');
  delete require.cache[흉내];
  return require(흉내);
}

/** 문을 뗀 판에서 **담겨 버리는지** 본다 (담기면 그 문이 일하고 있었다는 뜻이다) */
async function 떼고본다(이름) {
  const u = db.createUser(`rev-${이름}@caps.local`, HASH, 이름, 'rv' + Math.random().toString(36).slice(2, 10)).lastInsertRowid;
  const 내일 = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (이름 === '운동') {
    for (let i = 0; i < caps.capOf('workouts'); i += 1) db.createWorkout(u, DAY, '벤치', '60', 1, 10);
    const r = await call(routerOf('운동'), 'post', '/', {
      userId: u, body: { date: DAY, exercise: '스쿼트', weight: '100', sets: 1, reps: 5 } });
    ok('  문이 있으면 409 다 — **뗀 판에서는 담긴다(201)**', r.code, 409);
  } else if (이름 === '인바디') {
    for (let i = 0; i < caps.capOf('inbody'); i += 1) db.createInbody(u, DAY, 175, 70, 15, 33, 40, 22.9);
    const r = await call(routerOf('인바디'), 'post', '/', { userId: u, body: { date: DAY, weight: 70 } });
    ok('  문이 있으면 409 다 — **뗀 판에서는 담긴다(201)**', r.code, 409);
  } else if (이름 === '계획') {
    for (let i = 0; i < caps.capOf('plans'); i += 1) {
      const d = new Date(Date.now() + (i % 700) * 86400000).toISOString().slice(0, 10);
      db.createPlan(u, { date: d, kind: 'exercise', name: '벤치 ' + i, routine_id: null });
    }
    const r = await call(routerOf('계획'), 'post', '/', {
      userId: u, body: { date: 내일, kind: 'exercise', name: '새 계획' } });
    ok('  문이 있으면 409 다 — **뗀 판에서는 담긴다(201)**', r.code, 409);
  } else if (이름 === '루틴') {
    for (let i = 0; i < caps.capOf('routines'); i += 1) db.createMyRoutine(u, '루틴 ' + i, [{ name: '벤치', sets: 3, reps: 10 }]);
    const r = await call(routerOf('루틴'), 'post', '/', {
      userId: u, body: { name: '새 루틴', exercises: [{ name: '스쿼트', sets: 3, reps: 10 }] } });
    ok('  문이 있으면 409 다 — **뗀 판에서는 담긴다(201)**', r.code, 409);
  } else {
    for (let i = 0; i < caps.capOf('reports'); i += 1) db.createReport(u, { kind: 'bug', title: '제보 ' + i, body: '', meta: null, device: null });
    const r = await call(routerOf('제보'), 'post', '/', { userId: u, body: { kind: 'bug', title: '새 제보', body: '' } });
    ok('  문이 있으면 409 다 — **뗀 판에서는 담긴다(201)**', r.code, 409);
  }
}

(async () => {
  try {
    if (되돌림) {
      // 되돌려는 ⑴ · ⑵ 를 안 돈다 — 문마다 따로 본다 (아래 끝에서)
      console.log('');
    } else {
    console.log('── ⑴ 값이 한 벌인가 ──');
    const importSrc = fs.readFileSync(path.join(__dirname, '../src/routes/importData.js'), 'utf-8');
    ok('파일로 넣는 길이 그 값을 **든다** (생글자가 아니다)',
      (importSrc.match(/max: capOf\('(workouts|inbody|measures)'\)/g) || []).length, 3);
    ok('  갈래마다 생글자로 박힌 수가 없다', /max: \d/.test(importSrc), false);
    ok('모르는 갈래를 물으면 **터진다** (조용히 undefined 를 주지 않는다)',
      (() => { try { caps.capOf('없는것'); return '안 터졌다'; } catch { return '터진다'; } })(), '터진다');
    ok('  막는 말은 한 자리에서 온다', /줄까지\)/.test(caps.fullWhy('운동', 'workouts')), true);
    // 측정 · 메모도 같은 자리를 보는지 (11/25 것이 안 갈라졌나)
    const mSrc = fs.readFileSync(path.join(__dirname, '../src/routes/measures.js'), 'utf-8');
    const nSrc = fs.readFileSync(path.join(__dirname, '../src/routes/notes.js'), 'utf-8');
    ok('11/25 의 둘도 같은 자리를 본다 (측정 · 메모)',
      /capOf\('measures'\)/.test(mSrc) && /capOf\('notes'\)/.test(nSrc) && /capOf\('dayNotes'\)/.test(nSrc), true);

    console.log('');
    console.log('── ⑵ 일곱 자리가 다 막혔나 (가득 찬 판에서 409) ──');

    // ── 운동 ──
    {
      const u = db.createUser('w@caps.local', HASH, '운동', 'caps0001').lastInsertRowid;
      const cap = caps.capOf('workouts');
      // 상한만큼 **직접 담는다** (라우트로 6만 번 부르면 이 자가 몇 분을 먹는다)
      for (let i = 0; i < cap; i += 1) db.createWorkout(u, DAY, '벤치', '60', 1, 10);
      ok('  가득 채웠다 (모집단 0 을 통과로 내보내지 않는다)', db.getWorkouts(u).length, cap);
      const r = await call(routerOf('운동'), 'post', '/', {
        userId: u, body: { date: DAY, exercise: '스쿼트', weight: '100', sets: 1, reps: 5 },
      });
      ok('★ 운동 — 409 로 막는다', r.code, 409);
      ok('  까닭을 사람 말로 적는다', /가득해요/.test(r.body?.error || ''), true);
      // ⑷ 재전송은 막지 않는다 — 그 줄은 이미 담겨 있다
      const key = 'local-caps-1';
      const 담긴 = db.createWorkout(u, DAY, '데드', '120', 1, 3, key);
      const again = await call(routerOf('운동'), 'post', '/', {
        userId: u, body: { date: DAY, exercise: '데드', weight: '120', sets: 1, reps: 3, clientKey: key },
      });
      ok('⑷ 가득 차도 **재전송은 지나간다** (지하에서 세운 줄)', again.code, 201);
      ok('  새 줄을 만들지 않는다 (같은 번호)', again.body?.id, 담긴.lastInsertRowid);
      // ⑸ 고치기 · 지우기는 막히지 않는다
      const 아무줄 = db.getWorkouts(u)[0];
      const put = await call(require('../src/routes/workouts.js'), 'put', '/:id', {
        userId: u, params: { id: String(아무줄.id) },
        body: { date: DAY, exercise: '벤치', weight: '65', sets: 1, reps: 10 },
      });
      ok('⑸ 가득 차도 **고치기는 된다**', put.code, 200);
      const del = await call(require('../src/routes/workouts.js'), 'delete', '/:id', {
        userId: u, params: { id: String(아무줄.id) },
      });
      ok('  **지우기도 된다** (가득 찬 사람이 할 수 있는 일이 그것이다)', del.code, 200);
    }

    // ── 인바디 ──
    {
      const u = db.createUser('i@caps.local', HASH, '인바디', 'caps0002').lastInsertRowid;
      const cap = caps.capOf('inbody');
      for (let i = 0; i < cap; i += 1) db.createInbody(u, DAY, 175, 70, 15, 33, 40, 22.9);
      const r = await call(routerOf('인바디'), 'post', '/', {
        userId: u, body: { date: DAY, weight: 70 },
      });
      ok('★ 인바디 — 409 로 막는다', r.code, 409);
    }

    // ── 계획 (총량) ──
    {
      const u = db.createUser('p@caps.local', HASH, '계획', 'caps0003').lastInsertRowid;
      const cap = caps.capOf('plans');
      // 하루 상한(10)에 걸리지 않게 날짜를 갈아 담는다 — 총량만 보려는 판이다
      for (let i = 0; i < cap; i += 1) {
        const d = new Date(Date.now() + (i % 700) * 86400000).toISOString().slice(0, 10);
        db.createPlan(u, { date: d, kind: 'exercise', name: '벤치 ' + i, routine_id: null });
      }
      const 내일 = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const r = await call(routerOf('계획'), 'post', '/', {
        userId: u, body: { date: 내일, kind: 'exercise', name: '새 계획' },
      });
      ok('★ 계획 — **총량**으로 막는다 (하루 상한만 있던 자리)', r.code, 409);
    }

    // ── 루틴 (개수) ──
    {
      const u = db.createUser('r@caps.local', HASH, '루틴', 'caps0004').lastInsertRowid;
      const cap = caps.capOf('routines');
      for (let i = 0; i < cap; i += 1) db.createMyRoutine(u, '루틴 ' + i, [{ name: '벤치', sets: 3, reps: 10 }]);
      const r = await call(routerOf('루틴'), 'post', '/', {
        userId: u, body: { name: '새 루틴', exercises: [{ name: '스쿼트', sets: 3, reps: 10 }] },
      });
      ok('★ 루틴 — **개수**로 막는다 (안의 운동만 막던 자리)', r.code, 409);
    }

    // ── 제보 ──
    {
      const u = db.createUser('rp@caps.local', HASH, '제보', 'caps0005').lastInsertRowid;
      const cap = caps.capOf('reports');
      for (let i = 0; i < cap; i += 1) db.createReport(u, { kind: 'bug', title: '제보 ' + i, body: '', meta: null, device: null });
      const r = await call(routerOf('제보'), 'post', '/', {
        userId: u, body: { kind: 'bug', title: '새 제보', body: '' },
      });
      ok('★ 제보 — 409 로 막는다', r.code, 409);
    }

    // ── 측정 · 메모 (11/25 것이 그대로 서는가) ──
    {
      const u = db.createUser('m@caps.local', HASH, '측정', 'caps0006').lastInsertRowid;
      ok('측정 상한이 그대로 있다', caps.capOf('measures') > 0, true);
      ok('메모 둘도 그대로', [caps.capOf('notes'), caps.capOf('dayNotes')], [30, 4000]);
      ok('  (사람은 하나도 안 담긴 판에서 시작한다)', db.getMeasures(u).length, 0);
    }

    }
    console.log('');
    if (되돌림) {
      // 문을 **하나씩** 떼어 그 자리만 빨개지는지 본다 — 통째로 떼면 「어디가 울었나」를
      // 모른다(한 문만 남아도 「FAIL 떴다」로 통과해 버린다)
      console.log('── 되돌려-FAIL: 문을 하나씩 뗀다 ──');
      let 샌것 = 0;
      for (const 이름 of Object.keys(문)) {
        뗄것 = 이름;
        const 전 = bad;
        await 떼고본다(이름);
        뗄것 = null;
        if (bad > 전) console.log('  ■ ' + 이름 + ' → FAIL 떴다 (자가 잡는다)');
        else { console.log('  ■ ' + 이름 + ' → ★ 안 떴다 — **이 자는 그 문을 못 본다**'); 샌것 += 1; }
        bad = 전;
      }
      console.log('');
      if (샌것 > 0) { console.log(샌것 + '문을 못 잡는다'); process.exit(1); }
      console.log('되돌려 ' + Object.keys(문).length + '문 다 잡는다');
      process.exit(0);
    }
    if (bad > 0) { console.log(bad + '건 FAIL'); process.exit(1); }
    console.log('모두 통과');
    process.exit(0);
  } catch (err) {
    console.error('터짐:', err);
    process.exit(1);
  }
})();
