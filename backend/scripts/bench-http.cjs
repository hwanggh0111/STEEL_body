// **앱을 띄워 길마다 재본다** (2026-10-24).
//
//   npm run http            5년치 한 사람으로 잰다
//   npm run http -- 2       해를 줄여서 (빨리 보려고)
//
// `npm run bench` 는 **안쪽**(DB · 계산)을 잰다. 여기는 **바깥**이다 — 진짜 서버를
// 띄워 진짜 HTTP 로 받아보고, 몸통이 몇 바이트인지 · 몇 ms 걸리는지를 적는다.
// 사람이 앱을 한 번 열면 이 길들을 지나므로, 여기 적힌 수가 **그 사람이 치르는 값**이다.
//
// 재는 것 —
//   · 몸통 크기 (압축 전/후). Render 무료 판은 **CPU 0.1 코어**라 압축도 값이다
//   · 처음 받을 때 · **두 번째 받을 때**(바뀐 것이 없으면 304 여야 한다)
//   · 사진 셋을 통째로 받는 길과 한 장만 받는 길
//
// **검사가 아니다** — 통과·실패가 없다. 수를 적어두고 다음에 견준다.
const fs = require('fs');
const path = require('path');
const http = require('http');
const zlib = require('zlib');

const TMP = path.join(__dirname, '.bench-http.json');
process.env.DB_FILE = TMP;
process.env.JWT_SECRET = 'bench-http-' + 'x'.repeat(30);
process.env.NODE_ENV = 'test';
for (const f of [TMP, TMP.replace(/\.json$/, '.photos.json')]) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

const db = require('../src/db');

// 나가는 길에 임시 DB 를 치운다 — `db.js` 의 exit 손이 되살리는 것까지 (2026-10-28)

require('./_tmpdb.cjs')(TMP);
const jwt = require('jsonwebtoken');
const express = require('express');
const compression = require('compression');

const YEARS = Math.max(1, Number(process.argv[2]) || 5);
const PER_DAY = 16;
const NAMES = ['벤치프레스', '스쿼트', '데드리프트', '랫풀다운', '오버헤드프레스', '바벨로우', '레그프레스', '바이셉스컬'];
const IMG = 'data:image/png;base64,' + 'A'.repeat(300 * 1024);   // 사람 사진 한 장 ~300KB

const say = (label, value, unit = '') =>
  console.log('  ' + label.padEnd(44, ' ') + String(typeof value === 'number' ? value.toFixed(value < 10 ? 3 : 1) : value).padStart(10) + ' ' + unit);

// ── 자료를 만든다 ──
db.createUser('bench@http.test', 'x', '벤치', 'benchhttp');
const me = db.findUserByEmail('bench@http.test');
for (let d = 0; d < YEARS * 365; d++) {
  const day = new Date(2021, 0, 1 + d).toISOString().slice(0, 10);
  for (let i = 0; i < PER_DAY; i++) {
    db.createWorkout(me.id, day, NAMES[i % NAMES.length], String(40 + (i % 8) * 10), 5, 8 + (i % 5));
  }
}
for (const t of ['profile', 'before', 'after']) db.savePhoto(me.id, t, IMG);

// ── 다른 표도 **5년치로** 채운다 ── (2026-11-02)
//
// 운동만 많고 나머지가 비어 있으면 「이 길은 작다」는 틀린 답이 나온다.
// 주 한 번씩 적는 사람으로 센다 — 인바디 · 측정 · 달력 메모는 그 쯤이다
const WEEKS = YEARS * 52;
for (let k = 0; k < WEEKS; k++) {
  const day = new Date(2021, 0, 1 + k * 7).toISOString().slice(0, 10);
  db.createInbody(me.id, day, 175, 72 + (k % 5), 15 + (k % 4), 33, 44, 23.5);
  // 재는 도구는 여러 가지다 — 둘레 한 벌이 한 줄이다
  db.createMeasure(me.id, 'size', day, { chest: 100, waist: 80, hip: 95, arm: 35, thigh: 55, calf: 38, shoulder: 120 });
  // 달력의 그날 메모 (하루 한 장)
  db.createNote(me.id, '어깨가 좀 안 좋았다. 다음 주에 무게를 5kg 올려본다.', day);
}
// 루틴 메모장은 서른 장까지다 (`routes/notes.js` 의 MAX_NOTES)
for (let k = 0; k < 30; k++) db.createNote(me.id, '월요일 가슴 — 벤치 5x5 · 인클라인 4x10 · 펙덱 3x15');
// 앞날 계획 (2년까지 담을 수 있다)
for (let k = 0; k < 60; k++) {
  const day = new Date(2026, 10, 2 + k).toISOString().slice(0, 10);
  db.createPlan(me.id, { date: day, kind: 'exercise', name: '벤치프레스' });
}
// 내 루틴 — 열다섯 벌 · 한 벌에 열두 운동
for (let k = 0; k < 15; k++) {
  db.createMyRoutine(me.id, '분할 ' + (k + 1), NAMES.concat(NAMES).slice(0, 12).map((n) => ({ name: n, sets: 5, reps: 8 })));
}
const rows = db.getWorkouts(me.id).length;

// ── 앱을 띄운다 (진짜 라우트 · 진짜 미들웨어 몇 개) ──
const app = express();
app.use(express.json({ limit: '3mb' }));
app.use(require('cookie-parser')());
// 서버와 **같은 세기**로 눌러야 재는 값이 맞는다 (`src/index.js` — 2026-10-24 에 3)
app.use(compression({ threshold: 1024, level: 5 }));
app.use('/api/workouts', require('../src/routes/workouts'));
app.use('/api/inbody', require('../src/routes/inbody'));
app.use('/api/photos', require('../src/routes/photos'));
// ── **앱이 부르는 길을 다 꽂는다** ── (2026-11-02)
//
// 여태 셋만 재고 있었다(운동 · 인바디 · 사진). 그런데 앱을 한 번 열면 **열 길**을
// 지난다 — 재지 않은 길은 **아무도 안 본다**(「검사의 눈이 짧으면 그 밖은 아무도
// 안 본다」, 10/28). 아래 길들은 화면을 옮길 때마다 다시 불린다
app.use('/api/measures', require('../src/routes/measures'));
app.use('/api/notes', require('../src/routes/notes'));
app.use('/api/plans', require('../src/routes/plans'));
app.use('/api/my-routines', require('../src/routes/myRoutines'));
app.use('/api/goals', require('../src/routes/goals'));
app.use('/api/routines', require('../src/routes/routines'));
const server = app.listen(0, run);

const token = jwt.sign({ userId: me.id, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '15m' });

function get(p, headers = {}) {
  return new Promise((resolve, reject) => {
    const t0 = process.hrtime.bigint();
    const req = http.get({
      port: server.address().port,
      path: p,
      headers: { Authorization: 'Bearer ' + token, 'Accept-Encoding': 'gzip', ...headers },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks);
        resolve({
          status: res.statusCode,
          headers: res.headers,
          wire: raw.length,
          body: res.headers['content-encoding'] === 'gzip' && raw.length ? zlib.gunzipSync(raw) : raw,
          ms: Number(process.hrtime.bigint() - t0) / 1e6,
        });
      });
    });
    req.on('error', reject);
  });
}

/** 적는 길도 재야 한다 — `get` 과 같은 자로 둔다 (2026-10-31) */
function req(method, p, bodyObj, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = bodyObj === undefined ? null : Buffer.from(JSON.stringify(bodyObj));
    const t0 = process.hrtime.bigint();
    const r = http.request({
      port: server.address().port,
      path: p,
      method,
      headers: {
        Authorization: 'Bearer ' + token,
        'Accept-Encoding': 'gzip',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}),
        ...headers,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks);
        const body = res.headers['content-encoding'] === 'gzip' && raw.length ? zlib.gunzipSync(raw) : raw;
        resolve({
          status: res.statusCode,
          headers: res.headers,
          wire: raw.length,
          body: body.toString(),
          ms: Number(process.hrtime.bigint() - t0) / 1e6,
        });
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

const kb = (n) => (n / 1024).toFixed(1);

async function run() {
  try {
    console.log(`── 앱을 한 번 여는 값 (${YEARS}년치 · 운동 ${rows.toLocaleString()}줄) ──`);

    // 두 번 받아 **두 번째**를 적는다 (첫 번은 색인을 만든다)
    await get('/api/workouts');
    const w = await get('/api/workouts');
    say('GET /workouts — 몸통(압축 전)', Number(kb(w.body.length)), 'KB');
    say('  보낸 바이트(gzip)', Number(kb(w.wire)), 'KB');
    say('  걸린 시간', w.ms, 'ms');
    say('  ETag', w.headers.etag || '(없음)');

    // **바뀐 것이 없으면 다시 안 보내야 한다**
    if (w.headers.etag) {
      const again = await get('/api/workouts', { 'If-None-Match': w.headers.etag });
      say('다시 받기 (If-None-Match)', again.status === 304 ? '304 (안 보냄)' : again.status + ' · ' + kb(again.wire) + 'KB');
      say('  걸린 시간', again.ms, 'ms');
    }

    // ── **세트 하나를 적는 값** ── (2026-10-31)
    //
    // 이 앱에서 **가장 자주 겪는 왕복**이다. 여태 적은 뒤 목록을 통째로 다시 받았다 —
    // 아래 두 수가 그 차이다. 적는 길(`POST`)이 **담은 줄을 돌려주므로** 화면은
    // 그것을 꽂고 끝낸다 (`store/workoutStore.js` 의 `putRow`,
    // 차례는 `npm run order` 가 값으로 지킨다)
    const post = await req('POST', '/api/workouts', {
      date: '2026-10-24', exercise: '벤치프레스', weight: '100', sets: 5, reps: 5,
    });
    say('POST /workouts — 보낸 바이트(gzip)', Number(kb(post.wire)), 'KB');
    say('  담은 줄을 돌려준다', post.body && post.body.includes('"workout"') ? '그렇다' : '아니다');
    say('  걸린 시간', post.ms, 'ms');
    if (w.headers.etag) {
      const after = await get('/api/workouts', { 'If-None-Match': w.headers.etag });
      say('여태: 적은 뒤 통째로 다시 받으면', after.status === 200 ? Number(kb(after.wire)) + 'KB (200)' : String(after.status));
      say('  걸린 시간', after.ms, 'ms');
    }

    const ib = await get('/api/inbody');
    say('GET /inbody', Number(kb(ib.body.length)), 'KB');

    const p3 = await get('/api/photos');
    say('GET /photos (셋 다)', Number(kb(p3.body.length)), 'KB');
    say('  걸린 시간', p3.ms, 'ms');
    if (p3.headers.etag) {
      const p3b = await get('/api/photos', { 'If-None-Match': p3.headers.etag });
      say('  다시 받기', p3b.status === 304 ? '304 (안 보냄)' : String(p3b.status));
      say('    걸린 시간', p3b.ms, 'ms');
    }
    // **비교 화면은 전·후 둘만 받는다** (2026-11-02)
    const p2 = await get('/api/photos?type=before,after');
    say('  ?type=before,after (비교 화면)', Number(kb(p2.body.length)), 'KB');
    const p2b = p2.headers.etag ? await get('/api/photos?type=after,before', { 'If-None-Match': p2.headers.etag }) : null;
    if (p2b) say('    차례를 바꿔 물어도 같은 것', p2b.status === 304 ? '304 (안 보냄)' : String(p2b.status) + ' ← 두 번 받는다');
    const p1 = await get('/api/photos?type=profile');
    say('  ?type=profile (한 장)', Number(kb(p1.body.length)), 'KB');
    // **한 장만 받아둔 딱지로 셋을 달라고 하면 새로 받아야 한다** (몸통이 다르다)
    if (p1.headers.etag) {
      const mix = await get('/api/photos', { 'If-None-Match': p1.headers.etag });
      say('  한 장 딱지로 셋을 받으면', mix.status === 200 ? '200 (새로 받음)' : String(mix.status) + ' ← 틀렸다');
    }

    // ── **남은 길들** ── (2026-11-02)
    //
    // 화면을 옮길 때마다 다시 불린다 — **바뀐 것이 없으면 다시 안 보내야 한다**
    // (`utils/fresh.js`). 딱지가 없는 길은 **매번 몸통을 다 만들어 보낸다.**
    console.log('');
    console.log('── 화면을 옮길 때마다 다시 부르는 길 ──');
    for (const [label, p] of [
      ['GET /measures', '/api/measures'],
      ['GET /notes (루틴 메모)', '/api/notes'],
      ['GET /notes?month= (달력 한 달)', '/api/notes?month=2024-03'],
      ['GET /plans', '/api/plans'],
      ['GET /my-routines', '/api/my-routines'],
      ['GET /goals', '/api/goals'],
      ['GET /routines/머신 (사전)', '/api/routines/' + encodeURIComponent('머신')],
      ['GET /routines/맨몸', '/api/routines/' + encodeURIComponent('맨몸')],
      ['GET /routines/홈트', '/api/routines/' + encodeURIComponent('홈트')],
      ['GET /routines/기능성', '/api/routines/' + encodeURIComponent('기능성')],
      ['GET /routines/programs', '/api/routines/programs'],
    ]) {
      await get(p);                       // 첫 번은 버린다 (위와 같은 자)
      const r = await get(p);
      say(label, Number(kb(r.body.length)), 'KB');
      say('  보낸 바이트(gzip)', Number(kb(r.wire)), 'KB');
      say('  걸린 시간', r.ms, 'ms');
      // **딱지가 있나 · 그 딱지로 304 가 오나** (둘은 다른 질문이다)
      if (!r.headers.etag) {
        say('  다시 받기', '딱지 없음 — 매번 다 보낸다 ←');
      } else {
        const again = await get(p, { 'If-None-Match': r.headers.etag });
        say('  다시 받기', again.status === 304
          ? '304 (안 보냄)'
          : again.status + ' · ' + kb(again.wire) + 'KB ← 딱지가 있는데 또 보낸다');
      }
    }

    console.log('');
    console.log('여기 적힌 수는 이 기계에서 이번에 잰 것이다 — Render 무료 판은 CPU 0.1 코어라');
    console.log('ms 는 그보다 훨씬 크다. 바꾼 것이 어느 줄을 움직였는지 README 일지에 적는다.');
  } catch (err) {
    console.error(err);
  } finally {
    server.close();
    db.flushNow();
    // 사진도 지금 쓴다 — 안 쓴 것을 남기면 `process.on('exit')` 가 아래에서 지운
    // `.photos.json` 을 다시 만든다 (2026-10-28, `check-fresh` 와 같은 자리)
    db.flushPhotosNow();
    setTimeout(() => {
      for (const f of [TMP, TMP.replace(/\.json$/, '.photos.json')]) {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      }
      process.exit(0);
    }, 400);
  }
}
