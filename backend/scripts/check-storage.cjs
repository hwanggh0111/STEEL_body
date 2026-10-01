// 두 장을 어디에 두는가 (2026-10-01).
//
//   npm run storage     (npm run check 에도 들어 있다)
//
// Render 무료 판은 디스크를 못 붙여서, 파일로 두면 **재시작마다 기록이 사라진다.**
// 그래서 배포하면 Postgres 에 둔다. 그 갈림을 `src/storage.js` 한 곳에 넣었다.
//
// **이 길은 눈으로 못 본다.** 진짜로 틀렸는지는 배포하고 하루 뒤 「기록이 없다」로
// 알게 되는데, 그때는 이미 늦었다. 그래서 **가짜 Postgres** 를 끼워 넣고 본다 —
// 진짜 DB 가 없어도 순서·옮기기·덮어쓰기는 다 볼 수 있다.
//
// 여기서 지키려는 것 셋:
//   1. **첫 배포에 파일을 한 번 옮긴다** (안 그러면 빈 앱으로 시작한다)
//   2. **이미 Postgres 에 있으면 절대 안 덮는다** (파일 쪽이 옛것일 수 있다)
//   3. **쓰는 차례가 안 뒤집힌다** (뒤집히면 옛 판이 이긴다)
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

// ── 가짜 Postgres ──
//
// 진짜 `pg` 대신 이것이 들어간다. 한 줄짜리 표를 흉내내고, **무엇이 언제 들어왔는지**
// 적어둔다 — 차례가 뒤집히는 것을 보려면 그 기록이 있어야 한다.
function makeFakePg() {
  const table = new Map();
  const log = [];
  let delayNext = 0;

  class Pool {
    constructor(opts) { this.opts = opts; log.push(['pool', opts.connectionString]); }
    async query(sql, params) {
      if (/CREATE TABLE/i.test(sql)) { log.push(['create']); return { rows: [] }; }
      if (/^\s*SELECT/i.test(sql)) {
        log.push(['select']);
        return { rows: [...table.entries()].map(([name, body]) => ({ name, body })) };
      }
      if (/INSERT INTO blobs/i.test(sql)) {
        const [name, body] = params;
        // 첫 쓰기만 일부러 늦춘다 — 차례가 안 지켜지면 두 번째가 먼저 닿는다
        if (delayNext > 0) { const ms = delayNext; delayNext = 0; await new Promise(r => setTimeout(r, ms)); }
        table.set(name, body);
        log.push(['write', name, body.length]);
        return { rows: [] };
      }
      throw new Error('가짜 Postgres 가 모르는 질의: ' + sql.slice(0, 40));
    }
    async end() { log.push(['end']); }
  }

  return { pg: { Pool }, table, log, slowNext: (ms) => { delayNext = ms; } };
}

// `require('pg')` 를 가로채 가짜를 끼운다.
//
// **끼운 채로 둬야 한다.** 저장소는 `pg` 를 불러올 때가 아니라 **쓸 때** 부른다 —
// 모듈을 읽는 동안만 끼웠다 빼면 진짜 pg 가 들어와 진짜 주소를 찾으러 나간다
// (처음에 그렇게 짰다가 `ENOTFOUND 가짜` 로 걸렸다).
let currentFake = null;
const realLoad = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'pg' && currentFake) return currentFake.pg;
  return realLoad.call(this, req, parent, isMain);
};

function loadStorage(fake) {
  currentFake = fake;
  const p = require.resolve('../src/storage.js');
  delete require.cache[p];
  return require(p);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'blackiron-storage-'));

async function main() {
  // ── 1. 파일로 둘 때 ──
  console.log('── 열쇠가 없으면 파일로 둔다 ──');
  {
    delete process.env.DATABASE_URL;
    process.env.DB_FILE = path.join(tmp, 'a.json');
    const st = loadStorage(makeFakePg());
    ok('파일이다', st.KIND, 'file');
    ok('  아직 없다', st.existsSync(st.MAIN), false);
    await st.write(st.MAIN, '{"users":[1]}');
    ok('  쓰면 생긴다', st.existsSync(st.MAIN), true);
    ok('  읽으면 쓴 것이 나온다', st.readSync(st.MAIN), '{"users":[1]}');
    ok('  바뀐 때를 잴 수 있다', typeof st.statMs(st.MAIN), 'number');
    ok('  반쯤 쓴 파일이 안 남는다', fs.existsSync(path.join(tmp, 'a.json.writing')), false);
  }

  // ── 2. 첫 배포 — 파일이 옆에 있고 Postgres 가 비어 있다 ──
  console.log('\n── 첫 배포: 쓰던 파일을 한 번 옮긴다 ──');
  {
    const file = path.join(tmp, 'b.json');
    fs.writeFileSync(file, '{"users":["근호"]}', 'utf8');
    process.env.DB_FILE = file;
    process.env.DATABASE_URL = 'postgres://가짜';
    const fake = makeFakePg();
    const st = loadStorage(fake);
    ok('Postgres 다', st.KIND, 'postgres');
    await st.init();
    ok('  쓰던 파일이 옮겨졌다', fake.table.get('blackiron.json'), '{"users":["근호"]}');
    ok('  읽으면 그것이 나온다', st.readSync(st.MAIN), '{"users":["근호"]}');
    ok('  바깥 고침 검사는 꺼진다', st.statMs(st.MAIN), null);
  }

  // ── 3. 두 번째 배포 — 이미 들어 있으면 **안 덮는다** ──
  console.log('\n── 두 번째 배포: 이미 있는 것을 안 덮는다 ──');
  {
    const file = path.join(tmp, 'c.json');
    // 파일 쪽은 **옛것**이다 (처음 배포할 때 올라간 판)
    fs.writeFileSync(file, '{"users":["옛것"]}', 'utf8');
    process.env.DB_FILE = file;
    process.env.DATABASE_URL = 'postgres://가짜';
    const fake = makeFakePg();
    fake.table.set('blackiron.json', '{"users":["사람들이 적은 것"]}');
    const st = loadStorage(fake);
    await st.init();
    ok('Postgres 쪽이 이긴다', st.readSync(st.MAIN), '{"users":["사람들이 적은 것"]}');
    ok('  파일 쪽으로 안 덮인다', fake.table.get('blackiron.json'), '{"users":["사람들이 적은 것"]}');
  }

  // ── 4. 깨진 파일은 안 옮긴다 ──
  console.log('\n── 깨진 파일을 옮기지 않는다 ──');
  {
    const file = path.join(tmp, 'd.json');
    fs.writeFileSync(file, '{깨진', 'utf8');
    process.env.DB_FILE = file;
    process.env.DATABASE_URL = 'postgres://가짜';
    const fake = makeFakePg();
    const st = loadStorage(fake);
    await st.init();
    ok('아무것도 안 올라갔다', fake.table.size, 0);
    ok('  없는 것으로 친다', st.existsSync(st.MAIN), false);
  }

  // ── 5. 쓰는 차례가 안 뒤집힌다 ──
  console.log('\n── 쓰는 차례가 안 뒤집힌다 ──');
  {
    process.env.DB_FILE = path.join(tmp, 'e.json');
    process.env.DATABASE_URL = 'postgres://가짜';
    const fake = makeFakePg();
    const st = loadStorage(fake);
    await st.init();
    fake.slowNext(80);              // 첫 쓰기를 늦춘다
    st.write(st.MAIN, '{"n":1}');   // 느린 것
    st.write(st.MAIN, '{"n":2}');   // 빠른 것 — 차례를 안 지키면 이것이 먼저 닿는다
    await st.drain();
    ok('마지막에 쓴 것이 남는다', fake.table.get('blackiron.json'), '{"n":2}');
    const writes = fake.log.filter(l => l[0] === 'write').map(l => l[2]);
    ok('  두 번 다 썼다', writes.length, 2);
    // 읽기는 **기다리지 않는다** — 램이 먼저 맞는다
    ok('  쓰자마자 읽으면 새것이 나온다', st.readSync(st.MAIN), '{"n":2}');
  }

  // ── 6. 안 읽고 읽으려 하면 **말해준다** ──
  console.log('\n── init 을 안 부르고 읽으면 말해준다 ──');
  {
    process.env.DB_FILE = path.join(tmp, 'f.json');
    process.env.DATABASE_URL = 'postgres://가짜';
    const st = loadStorage(makeFakePg());
    let msg = '';
    try { st.readSync(st.MAIN); } catch (e) { msg = e.message; }
    ok('조용히 빈 것을 주지 않는다', /init/.test(msg), true);
  }

  delete process.env.DATABASE_URL;
  delete process.env.DB_FILE;
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(bad === 0 ? '\n전부 통과' : '\n' + bad + '건 실패');
  process.exit(bad === 0 ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
