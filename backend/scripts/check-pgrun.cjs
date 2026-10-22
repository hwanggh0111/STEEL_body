// **배포본이 도는 모드로 앱을 한 바퀴 돌린다** (2026-10-22).
//
//   npm run pgrun     (npm run check 에도 들어 있다)
//
// ── 왜 ──
//
// 10/14 부터 운영은 Postgres 로 돈다(`DATABASE_URL`). 내 컴퓨터는 파일로 돈다.
// 그런데 **Postgres 모드로 앱 전체를 돌려본 적이 없었다** — `npm run storage` 는
// 저장소 한 장(`src/storage.js`)만 가짜 pg 로 재고, 그 위의 앱은 늘 파일로만 돌았다.
//
// 그 사이에서 나는 버그는 **배포한 뒤에만 보인다.** 오늘 그런 것을 둘 찾았다 —
// 보안 기록이 재시작을 못 넘긴 것(파일에만 적었다)과 백업이 내 컴퓨터를 뜬 것이다.
// 둘 다 「사는 곳이 바뀐 것을 안 따라간」 자리였다.
//
// 그래서 **가짜 Postgres 를 끼우고 진짜 서버를 띄워** 사람이 하는 일을 한 바퀴 한다:
// 가입 → 로그인 → 운동 적기 → 읽기 → 내보내기 → 가져오기 → 알림 설정 → 계정 지우기.
//
// 여기서 보는 것:
//   1. 파일이 **한 장도 안 생기는가** (디스크가 없는 자리라 생기면 그건 날아갈 자리다)
//   2. 적은 것이 **Postgres 쪽으로 갔는가** (램에만 있으면 재시작에 사라진다)
//   3. 다시 띄웠을 때 **그 줄이 돌아오는가** (잠들었다 깨는 자리다)
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const Module = require('module');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pgrun-'));
process.env.DB_FILE = path.join(tmp, 'never.json');     // 파일 모드라면 여기에 쓸 것이다
process.env.DATABASE_URL = 'postgres://가짜/none';
process.env.JWT_SECRET = 'pgrun-' + 'x'.repeat(40);
process.env.NODE_ENV = 'test';
process.env.PORT = '4042';                               // 검사용 자리
process.env.RATE_LIMIT_GLOBAL_MAX = '100000';
process.env.KEEP_WARM = '0';

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// ── 가짜 Postgres ── (`check-storage` 와 같은 모양. 표 하나에 「이름 → 글자」)
const table = new Map();
const writes = [];
class Pool {
  constructor(opts) { this.opts = opts; }
  async query(sql, params) {
    if (/CREATE TABLE/i.test(sql)) return { rows: [] };
    if (/^\s*SELECT/i.test(sql)) {
      return { rows: [...table.entries()].map(([name, body]) => ({ name, body })) };
    }
    if (/INSERT INTO blobs/i.test(sql)) {
      const [name, body] = params;
      table.set(name, body);
      writes.push([name, body.length]);
      return { rows: [] };
    }
    throw new Error('가짜 Postgres 가 모르는 질의: ' + sql.slice(0, 40));
  }
  async end() {}
}
// **끼운 채로 둔다** — 저장소는 `pg` 를 쓸 때 부른다 (`check-storage` 머리글)
const realLoad = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'pg') return { Pool };
  return realLoad.call(this, req, parent, isMain);
};

// ── 서버를 띄운다 (진짜 index.js) ──
const app = require('../src/index');

function call(method, p, { token, body } = {}) {
  return new Promise((resolve) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1', port: PORT_NOW, path: p, method,
      headers: {
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        'Content-Type': 'application/json',
        // 봇으로 안 보이게 (2026-10-22 에 그 자리를 고쳤지만 사람처럼 온다)
        'User-Agent': 'Mozilla/5.0 (pgrun)',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let t = '';
      res.on('data', (c) => { t += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(t); } catch (e) { /* 글이면 null */ }
        resolve({ status: res.statusCode, body: json, text: t });
      });
    });
    req.on('error', (e) => resolve({ status: 0, text: e.message }));
    if (data) req.write(data);
    req.end();
  });
}

const PORT_NOW = 4042;
const TODAY = new Date().toISOString().slice(0, 10);

async function run() {
  console.log('── 사람이 하는 일 한 바퀴 (Postgres 모드) ──');

  // 가입에는 **메일 인증번호**가 필요하다. 내 컴퓨터(또는 SMTP 없음)에서는 답에 번호가 실린다
  const sent = await call('POST', '/api/auth/send-code', { body: { email: 'pg@run.test' } });
  ok('인증번호를 받는다', sent.status, 200);
  const code = sent.body?.code || sent.body?.devCode;
  ok('  번호가 답에 실린다 (열쇠가 없는 자리)', typeof code, 'string');

  const reg = await call('POST', '/api/auth/register', {
    body: { email: 'pg@run.test', password: 'Abcd1234', username: 'pgrunner', nickname: '피지', code },
  });
  ok('가입된다', reg.status, 201);
  if (reg.status !== 201) console.log('   서버가 한 말:', JSON.stringify(reg.body));
  const token = reg.body?.accessToken || reg.body?.token;
  ok('  토큰을 준다', typeof token, 'string');

  const made = await call('POST', '/api/workouts', {
    token, body: { date: TODAY, exercise: '벤치프레스', weight: '60', sets: 3, reps: 10 },
  });
  ok('운동이 적힌다', made.status, 201);

  const list = await call('GET', '/api/workouts', { token });
  ok('적은 것이 읽힌다', (list.body || []).length, 1);

  const out = await call('GET', '/api/export/workouts', { token });
  ok('내보내기가 나온다', out.status, 200);
  ok('  적은 운동이 그 안에 있다', /벤치프레스/.test(out.text), true);

  // 내보낸 그 글자를 그대로 다시 넣는다 — 같은 줄이라 **건너뛴다**
  const back = await call('POST', '/api/import', { token, body: { kind: 'workouts', csv: out.text } });
  ok('가져오기가 받는다', back.status, 200);
  ok('  같은 줄은 건너뛴다', back.body?.skipped, 1);

  const rem = await call('PUT', '/api/reminders', { token, body: { enabled: true, tzOffset: -540 } });
  ok('알림 설정이 저장된다', rem.status, 200);
  // 2026-10-22: 켜기만 눌러도 기본값이 깔려야 한다
  ok('  시각이 비어 있지 않다', typeof rem.body?.time, 'string');

  console.log('\n── 디스크에 쓴 것이 없는가 ──');
  // 배포본은 디스크가 없다. 파일이 생겼다면 그건 **날아갈 자리에 쓴 것**이다
  const left = fs.readdirSync(tmp);
  ok('임시 자리에 파일이 안 생겼다', left, []);

  console.log('\n── Postgres 쪽으로 갔는가 ──');
  // 쓰기는 0.5초 모아 간다 (db.js 의 미뤄 쓰기). 재는 쪽이 먼저 보면 빈 판을 본다
  await new Promise((r) => setTimeout(r, 900));
  console.log('   (쓴 횟수 ' + writes.length + ' · 마지막 크기 ' + ((writes[writes.length - 1] || [])[1]) + ')');
  ok('쓴 적이 있다', writes.length > 0, true);
  ok('  본체가 들어 있다', table.has('blackiron.json'), true);
  const blob = JSON.parse(table.get('blackiron.json') || '{}');
  ok('  그 안에 운동이 한 줄', (blob.workouts || []).length, 1);
  ok('  사람도 한 명', (blob.users || []).length, 1);
  // 보안 기록도 그쪽에 남아야 한다 (10/22 에 고친 자리 — 파일만 쓰면 재시작에 사라진다)
  ok('  보안 기록도 들어 있다', (blob.securityLogs || []).length > 0, true);

  console.log('\n── 다시 띄우면 돌아오는가 (잠들었다 깬다) ──');
  // 램을 통째로 버리고 **Postgres 에 남은 것만**으로 다시 읽는다
  await new Promise((r) => setTimeout(r, 300));
  const dbPath = require.resolve('../src/db.js');
  const stPath = require.resolve('../src/storage.js');
  delete require.cache[dbPath];
  delete require.cache[stPath];
  const storage2 = require(stPath);
  await storage2.init();
  const db2 = require(dbPath);
  const again = db2.getAllUsers();
  ok('사람이 돌아온다', again.length, 1);
  ok('  운동도 돌아온다', db2.getWorkouts(again[0].id).length, 1);
  ok('  보안 기록도 돌아온다', db2.getSecurityLogs().length > 0, true);
}

// index.js 는 `storage.init()` 을 기다린 뒤에 띄운다 — 답할 때까지 기다린다
async function waitUp(tries = 60) {
  for (let i = 0; i < tries; i += 1) {
    const r = await call('GET', '/api/health');
    if (r.status === 200) return true;
    await new Promise((res) => setTimeout(res, 100));
  }
  return false;
}

(async () => {
  const up = await waitUp();
  if (!up) { console.log('FAIL 서버가 안 떴다'); process.exit(1); }
  try { await run(); } catch (err) { bad += 1; console.log('FAIL 검사가 도중에 터졌다 → ' + err.message); }
  console.log('');
  console.log(bad ? bad + '건 실패' : '전부 통과');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* 그만 */ }
  process.exit(bad ? 1 : 0);
})();
