// **바뀐 것이 없으면 다시 안 보내는가** (2026-10-24).
//
//   npm run fresh     (npm run check 에도 들어 있다)
//
// ── 왜 ──
//
// 앱은 목록을 통째로 받아 들고 있고, 화면을 옮길 때마다 다시 받는다(30초 지나면).
// 5년치면 몸통이 4MB 다 — 서버는 그때마다 줄을 모아 글자로 만들고 gzip 으로 누른다.
// `npm run http` 로 재보니 2년치에서 **1.65MB · 31ms**(이 기계), Render 무료 판은
// **CPU 0.1 코어**다. 그 네 번 중 세 번은 바뀐 것이 하나도 없다 → 304 한 줄.
//
// ── 여기가 지키는 것 (빠르게 하는 것보다 **안 틀리는 것**이 먼저다) ──
//
// 틀리는 쪽의 증상은 **「내가 적은 것이 안 보인다」**다. 그래서 값으로 못 박는다 —
//   1. 바뀐 것이 없으면 304 이고 **몸통을 만들지도 않는다**
//   2. 무엇이든 바뀌면 **반드시** 200 이다 (표마다 · 고치는 자리마다 다 본다)
//   3. 사람이 다르면 딱지가 다르다 (남의 딱지로 내 것을 받을 수 없다)
//   4. 몸통이 갈라지는 자리(`?type=profile`)는 딱지도 갈라진다
//   5. 서버가 다시 뜨면 딱지가 달라진다 (램의 번호가 0 으로 돌아가므로)
//   6. 브라우저가 **물어보게** 되어 있다 (`Cache-Control: no-cache, private`)
const path = require('path');
const fs = require('fs');
const http = require('http');
const { execFileSync } = require('child_process');

const TMP = path.join(__dirname, '.check-fresh.json');
process.env.DB_FILE = TMP;
process.env.JWT_SECRET = 'check-fresh-' + 'x'.repeat(30);
process.env.NODE_ENV = 'test';
for (const f of [TMP, TMP.replace(/\.json$/, '.photos.json')]) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

const db = require('../src/db');
const jwt = require('jsonwebtoken');
const express = require('express');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const IMG = 'data:image/png;base64,iVBORw0KGgo=';

db.createUser('me@fresh.test', 'x', '나', 'mefresh');
db.createUser('you@fresh.test', 'x', '너', 'youfresh');
const me = db.findUserByEmail('me@fresh.test');
const you = db.findUserByEmail('you@fresh.test');
db.createWorkout(me.id, '2026-10-24', '벤치프레스', '100', 5, 5);
db.createInbody(me.id, '2026-10-24', 175, 78, 15, 36, 45, 25.5);
db.createMeasure(me.id, 'bodySize', '2026-10-24', { chest: 100 });
db.savePhoto(me.id, 'profile', IMG);
db.savePhoto(me.id, 'before', IMG);
db.createWorkout(you.id, '2026-10-24', '스쿼트', '100', 5, 5);

const app = express();
app.use(express.json());
app.use(require('cookie-parser')());
app.use('/api/workouts', require('../src/routes/workouts'));
app.use('/api/inbody', require('../src/routes/inbody'));
app.use('/api/measures', require('../src/routes/measures'));
app.use('/api/photos', require('../src/routes/photos'));
const server = app.listen(0, run);

const tokenFor = (id) => jwt.sign({ userId: id, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '15m' });

function get(p, { token = tokenFor(me.id), tag = null } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get({
      port: server.address().port,
      path: p,
      headers: { Authorization: 'Bearer ' + token, ...(tag ? { 'If-None-Match': tag } : {}) },
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, len: raw.length, raw }));
    });
    req.on('error', reject);
  });
}

// 길마다 — 「무엇이 바뀌면 새로 받아야 하는가」를 같이 적는다
const ROUTES = [
  {
    path: '/api/workouts', label: '운동',
    changes: [
      ['적으면', () => db.createWorkout(me.id, '2026-10-23', '스쿼트', '90', 5, 5)],
      ['고치면', () => db.updateWorkout(db.getWorkouts(me.id)[0].id, me.id, { date: '2026-10-23', exercise: '스쿼트', weight: '95', sets: 5, reps: 5 })],
      ['지우면', () => db.deleteWorkout(db.getWorkouts(me.id)[0].id, me.id)],
    ],
  },
  {
    path: '/api/inbody', label: '인바디',
    changes: [
      ['적으면', () => db.createInbody(me.id, '2026-10-23', 175, 77, 15, 36, 45, 25.1)],
      ['지우면', () => db.deleteInbody(db.getInbody(me.id)[0].id, me.id)],
    ],
  },
  {
    path: '/api/measures', label: '측정',
    changes: [
      ['적으면', () => db.createMeasure(me.id, 'oneRM', '2026-10-23', { exercise: '벤치', weight: 100, reps: 3 })],
      ['지우면', () => db.deleteMeasure(db.getMeasures(me.id)[0].id, me.id)],
    ],
  },
  {
    path: '/api/photos', label: '사진',
    changes: [
      ['바꾸면', () => db.savePhoto(me.id, 'profile', IMG + 'x')],
      ['지우면', () => db.deletePhoto(me.id, 'before')],
    ],
  },
];

async function run() {
  try {
    for (const r of ROUTES) {
      console.log(`── ${r.label} (${r.path}) ──`);
      const first = await get(r.path);
      ok('처음에는 몸통을 준다', first.status, 200);
      ok('  딱지를 붙인다', !!first.headers.etag, true);
      // **브라우저가 물어보게** 해야 304 가 쓰인다 — 이 머리가 없으면 아예 안 묻는다
      ok('  담아두되 쓸 때마다 물어보라고 한다', first.headers['cache-control'], 'no-cache, private');

      const again = await get(r.path, { tag: first.headers.etag });
      ok('바뀐 것이 없으면 304', again.status, 304);
      ok('  몸통이 비어 있다', again.len, 0);

      // ── 남의 딱지로는 안 된다 ── (2026-10-24, 이 줄이 설계 하나를 잡았다)
      //
      // 처음에는 딱지에 **사람이 안 들어 있었다**(`표-뜬때-번호`). 두 사람의 번호가
      // 우연히 같으면 딱지가 같고, 주소는 둘 다 `/api/workouts` 다 — **한 폰에서
      // 사람이 바뀌면 앞 사람 몸통에 304 가 떨어진다.** 9/22 의 「다음 사람 화면에
      // 앞 사람 기록」과 같은 자리라 여기서 못 박는다
      const other = await get(r.path, { token: tokenFor(you.id), tag: first.headers.etag });
      ok('남의 딱지로는 304 가 안 난다', other.status, 200);

      for (const [what, mutate] of r.changes) {
        const before = (await get(r.path)).headers.etag;
        mutate();
        const after = await get(r.path, { tag: before });
        ok(`  ${what} 새로 받는다`, after.status, 200);
      }
      console.log('');
    }

    console.log('── 몸통이 갈라지는 자리 ──');
    // `?type=profile` 과 셋을 다 주는 길은 **다른 몸통**이다. 딱지가 같으면
    // 한 장만 받아둔 브라우저가 비교 화면에서 전·후 사진을 못 그린다
    const one = await get('/api/photos?type=profile');
    const all = await get('/api/photos');
    ok('한 장 딱지와 셋 딱지가 다르다', one.headers.etag !== all.headers.etag, true);
    ok('  한 장 딱지로 셋을 달라면 새로 받는다', (await get('/api/photos', { tag: one.headers.etag })).status, 200);
    ok('  한 장은 한 장으로 304', (await get('/api/photos?type=profile', { tag: one.headers.etag })).status, 304);

    console.log('');
    console.log('── 몸통을 만들지도 않는가 ──');
    // 304 가 **싸야** 이 일을 한 값이 있다. 줄을 모으고 4MB 를 글자로 만든 뒤에
    // 「안 바뀌었다」를 말하면 (express 의 기본 ETag 가 그렇다) 느린 건 그대로다
    const { sendFresh } = require('../src/utils/fresh');
    let built = 0;
    const fakeRes = () => ({
      headers: {}, code: 200,
      set(k, v) { this.headers[k.toLowerCase()] = v; return this; },
      removeHeader(k) { delete this.headers[k.toLowerCase()]; },
      status(c) { this.code = c; return this; },
      end(body) { this.body = body; return this; },
    });
    const r1 = fakeRes();
    sendFresh({ headers: {} }, r1, 'W/"t-1"', () => { built += 1; return [1, 2, 3]; });
    ok('처음에는 만든다', [built, r1.code, r1.body], [1, 200, '[1,2,3]']);
    const r2 = fakeRes();
    sendFresh({ headers: { 'if-none-match': 'W/"t-1"' } }, r2, 'W/"t-1"', () => { built += 1; return [1, 2, 3]; });
    ok('304 에서는 **안 만든다**', [built, r2.code], [1, 304]);
    // 머리에 여럿이 올 수 있다 (`If-None-Match: a, b`)
    const r3 = fakeRes();
    sendFresh({ headers: { 'if-none-match': 'W/"other", W/"t-1"' } }, r3, 'W/"t-1"', () => { built += 1; return []; });
    ok('  여럿 중에 있어도 304', [built, r3.code], [1, 304]);

    console.log('');
    console.log('── 서버가 다시 뜨면 딱지가 달라지는가 ──');
    // 번호는 램에 있다 — 다시 뜨면 0 으로 돌아간다. 그 사이에 자료가 바뀌었을 수
    // 있으므로(백업 되돌리기 · 다른 기기), 번호만 같으면 **옛 몸통을 그대로 쓰라고
    // 말하는** 셈이 된다. 그래서 뜰 때 만든 무작위 글자를 딱지에 같이 넣는다
    const tagIn = (extra) => execFileSync(process.execPath, ['-e',
      "const db=require('" + path.join(__dirname, '..', 'src', 'db.js').replace(/\\/g, '\\\\') + "');"
      + "process.stdout.write(db.dataTag('workouts', 1));"], {
      env: { ...process.env, ...extra }, encoding: 'utf8',
    });
    const t1 = tagIn({});
    const t2 = tagIn({});
    ok('두 번 띄우면 딱지가 다르다', t1 !== t2, true);
    ok('  표 · 사람은 그대로 적혀 있다', /^W\/"workouts-1-[0-9a-f]+-0"$/.test(t1), true);
  } catch (err) {
    bad += 1;
    console.error(err);
  } finally {
    server.close();
    db.flushNow();
    setTimeout(() => {
      for (const f of [TMP, TMP.replace(/\.json$/, '.photos.json')]) {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      }
      console.log('');
      console.log(bad === 0 ? '모두 통과' : bad + '건 FAIL');
      process.exit(bad === 0 ? 0 : 1);
    }, 300);
  }
}
