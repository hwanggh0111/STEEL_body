// ── **배포판에서 보안 기록을 디스크에 적지 않는가** ── (2026-11-27 · 정석)
//
//   npm run seclogdisk   (npm run check 에도 들어 있다)
//
// ── 왜 ──
//
// 보안 줄(`addLog`)은 세 군데로 간다 — 램 · **데이터가 사는 곳**(`db.addSecurityLog`,
// 배포판이면 Postgres) · 그리고 **파일**(`security.log`).
//
// 배포판에서 그 파일은 **쓰는 값만 있고 읽는 값이 없었다** —
//
//   · 같은 줄이 이미 DB 에 있고, 보는 자리(`recentLogs`)는 셋을 합쳐 **같은 줄을
//     접는다**. 즉 파일 쪽이 없어도 **화면이 똑같다**
//   · 배포판 디스크는 **날아간다**(Render 무료 판은 디스크를 못 붙인다 — 그래서
//     10/14 에 DB 를 Postgres 로 옮겼다). 다시 뜨면 그 파일은 없다
//   · 그런데 값은 치른다: 보안 줄마다 `appendFile` 한 번, 2MB 마다 `rename`.
//     그것을 **CPU 0.1 코어** 한 줄짜리 서버에서 한다
//
// `check-pgrun` 이 「Postgres 모드에서 파일이 한 장도 생기면 안 된다」를 지키는데,
// 그 자는 **제 임시 자리만** 본다 — `security.log` 는 저장소 안(`backend/`)에
// 생기므로 **그 눈에 안 걸렸다.** 그 빈 자리를 여기서 본다.
//
// ── 무엇을 보는가 (전부 **값**으로) ──
//
//   1. ★ Postgres 판에서 보안 줄을 적으면 **파일이 안 생긴다**
//   2. ★ 그래도 **DB 에는 남는다** (기록을 잃는 것이 아니다)
//   3. ★ 보는 자리가 **그 줄을 보여준다** (화면이 똑같다)
//   4. **파일 판에서는 여태처럼 적는다** — 그쪽은 재시작을 넘겨 주는 값이 있다
//
// 되돌려-FAIL: `addLog` 의 `if (storage.isPostgres) return;` 를 떼면 1 이 뒤집힌다.
'use strict';
const path = require('path');
const os = require('os');
const fs = require('fs');
const Module = require('module');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : '  (기대: ' + JSON.stringify(want) + ')'));
};

// ── 가짜 Postgres ── (`check-pgrun` 과 같은 모양)
const table = new Map();
class Pool {
  async query(sql, params) {
    if (/CREATE TABLE/i.test(sql)) return { rows: [] };
    if (/^\s*SELECT/i.test(sql)) return { rows: [...table.entries()].map(([name, body]) => ({ name, body })) };
    if (/INSERT INTO blobs/i.test(sql)) { table.set(params[0], params[1]); return { rows: [] }; }
    throw new Error('가짜 Postgres 가 모르는 질의: ' + sql.slice(0, 40));
  }
  async end() {}
}
const realLoad = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'pg') return { Pool };
  return realLoad.call(this, req, parent, isMain);
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seclogdisk-'));
const 기록길 = path.join(tmp, 'security.log');
process.env.SECURITY_LOG_PATH = 기록길;
process.env.DB_FILE = path.join(tmp, 'never.json');
process.env.DATABASE_URL = 'postgres://가짜/none';
process.env.JWT_SECRET = 'seclogdisk-' + 'x'.repeat(40);
process.env.NODE_ENV = 'test';

(async () => {
  const storage = require('../src/storage');
  table.set(storage.MAIN, JSON.stringify({ users: [], workouts: [], securityLogs: [] }));
  await storage.init();
  ok('Postgres 판으로 돈다', storage.isPostgres, true);

  // 라우터를 들여오면 `addLog` 를 쓸 수 있다 — 내보내는 손으로 부른다
  const sec = require('../src/routes/security');
  const 적기 = sec.addLog || (sec.default && sec.default.addLog);
  ok('기록하는 손을 꺼낼 수 있다', typeof 적기, 'function');
  if (typeof 적기 !== 'function') {
    console.log('');
    console.log('1건 실패 — `addLog` 를 안 내놓는다. 이 자가 볼 수 없으니 그 손을 내놓게 해라');
    process.exit(1);
  }

  console.log('');
  console.log('── 1·2. 적으면 — 파일은 안 생기고 DB 에는 남는다 ──');
  적기('검사', '배포판에서 디스크에 안 적는지 본다');
  // 비동기 `appendFile` 이 설 틈을 준다 (없어야 하지만, 있으면 여기서 생긴다)
  await new Promise((r) => setTimeout(r, 120));
  ok('★ 기록 파일이 안 생겼다', fs.existsSync(기록길), false);
  ok('  옛 한 벌(.1)도 없다', fs.existsSync(기록길 + '.1'), false);
  const db = require('../src/db');
  const 디비것 = db.getSecurityLogs().filter((e) => e.type === '검사');
  ok('★ DB 에는 남았다 (기록을 잃는 것이 아니다)', 디비것.length, 1);
  ok('  적은 글이 그대로다', 디비것[0] && 디비것[0].detail, '배포판에서 디스크에 안 적는지 본다');

  console.log('');
  console.log('── 3. 보는 자리가 그 줄을 보여준다 (화면이 똑같다) ──');
  const 본다 = sec.recentLogs || (sec.default && sec.default.recentLogs);
  if (typeof 본다 === 'function') {
    const 목록 = 본다(100).filter((e) => e.type === '검사');
    ok('★ 목록에 그 줄이 있다', 목록.length, 1);
  } else {
    // 내놓지 않으면 DB 쪽으로 본다 — **그냥 넘기지 않는다**
    ok('보는 손을 못 꺼냈다 (DB 로 확인했다)', 디비것.length, 1);
  }

  console.log('');
  console.log('── 4. 파일 판에서는 여태처럼 적는다 ──');
  //
  // 사는 곳만 바꿔 같은 손을 다시 돌린다. 여기서 안 적으면 **내 컴퓨터에서 재시작을
  // 넘기는 값**이 사라진다 — 그쪽은 그 파일이 쓸모가 있다
  {
    const 두번째 = fs.mkdtempSync(path.join(os.tmpdir(), 'seclogdisk2-'));
    const 길2 = path.join(두번째, 'security.log');
    const 지울것 = [
      require.resolve('../src/storage'),
      require.resolve('../src/db'),
      require.resolve('../src/routes/security'),
    ];
    const 앞 = 지울것.map((k) => [k, require.cache[k]]);
    for (const k of 지울것) delete require.cache[k];
    process.env.SECURITY_LOG_PATH = 길2;
    process.env.DB_FILE = path.join(두번째, 'db.json');
    delete process.env.DATABASE_URL;                 // ★ 파일 판으로
    const s2 = require('../src/storage');
    await s2.init();
    ok('파일 판으로 돈다', s2.isPostgres, false);
    const sec2 = require('../src/routes/security');
    (sec2.addLog)('검사', '파일 판에서는 적어야 한다');
    await new Promise((r) => setTimeout(r, 150));
    ok('★ 파일 판에서는 파일에 적는다', fs.existsSync(길2), true);
    if (fs.existsSync(길2)) {
      ok('  적은 글이 그 파일에 있다', /파일 판에서는 적어야 한다/.test(fs.readFileSync(길2, 'utf-8')), true);
    }
    // 되돌려놓는다
    for (const [k, v] of 앞) { delete require.cache[k]; if (v) require.cache[k] = v; }
    // ★ **나가는 길에** 치운다 — `db.js` 의 끝내기 손이 그 자리에 마지막 판을 쓴다.
    //   먼저 지우면 `ENOENT … .writing.sync` 가 뜬다(해롭진 않지만 거짓 자취다)
    process.on('exit', () => { try { fs.rmSync(두번째, { recursive: true, force: true }); } catch { /* 그만 */ } });
  }

  process.on('exit', () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* 그만 */ } });
  console.log('');
  console.log(bad ? bad + '건 실패' : '전부 통과');
  process.exit(bad ? 1 : 0);
})();
