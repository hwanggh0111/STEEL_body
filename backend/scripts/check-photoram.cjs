// ── **Postgres 판에서 사진이 램에 두 벌로 있지 않은가** ── (2026-11-27 · 정석)
//
//   npm run photoram   (npm run check 에도 들어 있다)
//
// ── 왜 ──
//
// Postgres 판(운영이 그쪽이다)은 뜰 때 사진을 **글자로** 들고 온다(`preloaded`).
// 그 글자를 `db.js` 가 **한 번 풀어서** 제 캐시에 들고 있다 — 즉 같은 사진이
// **램에 두 벌**이다. 사진을 다 채운 **60명**이면 80MB + 80MB 고, 서버 뚜껑은
// **256MB**(`--max-old-space-size=256`)다. 저장이 겹치면 문자열이 한 벌 더 생겨
// **넘고, Render 무료 판은 메모리를 넘기면 바로 죽인다.**
//
// 푼 것을 들고 있는 동안 그 글자를 다시 읽을 일이 없다 — 그래서 **푼 뒤에 놓는다.**
//
// ── 어느 쪽을 놓느냐가 사는 곳에 따라 다르다 ──
//
//   파일 판      다시 읽는 것이 **동기로 공짜**다 → **푼 것**을 쉬면 놓는다
//                (`check-photofree` 가 그쪽을 본다)
//   Postgres 판  다시 읽는 길이 동기가 아니다 → **날글**을 놓고 푼 것은 들고 있는다
//
// 이 자는 **뒤쪽**을 본다. 가짜 Postgres 를 끼워 진짜 `storage` · `db` 를 돌린다.
//
// ── 무엇을 보는가 (전부 **값**으로) ──
//
//   1. 뜰 때는 날글을 들고 있다 (그래야 첫 번째 풀기가 된다)
//   2. ★ 한 번 풀면 **날글을 놓는다** (두 벌이 아니다)
//   3. ★ 놓은 뒤에도 사진이 **글자 하나까지** 그대로다
//   4. ★ **`existsSync` 가 그대로 선다** — 놓고 「없다」고 하면 `db.js` 가 **빈 판으로
//      시작해 다음 저장이 사람 사진을 덮는다**
//   5. 사진을 담은 **뒤에도** 두 벌이 아니다 (쓰는 손이 램에 다시 넣는다)
//   6. ★ Postgres 판에서는 **푼 것을 안 놓는다** — 놓으면 사람이 사진을 보는 길이
//      `readSync` 에서 터진다
//
// ── 되돌려-FAIL (잰 그대로 적는다) ──
//
//   `releasePreloaded` 를 아무것도 안 하게 → **3건 FAIL**(2 · 5 · 7)
//   `db.js` 의 「Postgres 면 푼 것을 안 놓는다」를 떼면 → **2건 FAIL**(6).
//     그때 로그에 「photos.json 파싱 실패, 초기화합니다」가 찍힌다 —
//     **빈 판으로 시작하는** 그 길이 눈에 보인다
//
// ★ `releasePreloaded` 안의 `known.add(name)` 한 줄은 **떼도 이 자가 안 운다.**
//   거짓으로 적지 않고 있는 대로 적는다 — 그 줄은 **띠(belt)** 다. 「있었다」를
//   정말 적는 자리는 둘이고 둘 다 그 앞에 있다: 뜰 때(`pgInit`)와 **쓸 때**
//   (`storage.write`). 7절이 보는 것은 **쓸 때 적는 그 줄**이다(갓 올린 배포에는
//   사진 줄이 없으니 뜰 때 적을 것이 없다). 띠를 남겨두는 까닭은 싸기 때문이다 —
//   앞으로 `preloaded` 에 넣는 자리가 하나 더 생기는 날 그 줄이 막아준다.
'use strict';
const path = require('path');
const os = require('os');
const fs = require('fs');
const Module = require('module');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'photoram-'));
process.env.DB_FILE = path.join(tmp, 'never.json');     // 파일 모드라면 여기에 쓸 것이다
process.env.DATABASE_URL = 'postgres://가짜/none';
process.env.JWT_SECRET = 'photoram-' + 'x'.repeat(40);
process.env.NODE_ENV = 'test';

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

const 장 = (kb) => 'data:image/jpeg;base64,' + Buffer.alloc(kb * 1024, 'A').toString('base64');
const 큰장 = 장(380);

(async () => {
  const storage = require('../src/storage');
  // **뜨기 전에 판을 심어둔다** — 그래야 「뜰 때 들고 온다」를 볼 수 있다
  // ★ **8MB 선을 넘겨 심는다** — 「쉬면 놓는다」가 작은 판에서는 다른 가드에서
  //   먼저 멎으므로, 작게 심으면 6번이 **조용히 통과**한다(첫 판이 그랬다)
  const 심은사진 = [
    { id: 1, user_id: 7, type: 'profile', data: 장(60), created_at: 'x', updated_at: 'x' },
    { id: 2, user_id: 7, type: 'before', data: 큰장, created_at: 'x', updated_at: 'x' },
    { id: 3, user_id: 7, type: 'after', data: 큰장, created_at: 'x', updated_at: 'x' },
  ];
  for (let u = 100; u <= 112; u += 1) {
    심은사진.push({ id: 심은사진.length + 1, user_id: u, type: 'before', data: 큰장, created_at: 'x', updated_at: 'x' });
  }
  const 심은것 = JSON.stringify({ photos: 심은사진, _nextId: 심은사진.length + 1 });
  table.set(storage.PHOTOS, 심은것);
  table.set(storage.MAIN, JSON.stringify({ users: [], workouts: [] }));
  await storage.init();

  const db = require('../src/db');

  console.log('── 1. 뜰 때 ──');
  ok('날글을 들고 왔다', storage.holdsPreloaded(storage.PHOTOS), true);
  ok('  Postgres 판으로 돈다', storage.isPostgres, true);

  console.log('');
  console.log('── 2·3·4. 한 번 풀면 날글을 놓는다 ──');
  const 사진 = db.getPhotos(7);                 // 여기서 푼다
  ok('사진 셋이 나온다', 사진.length, 3);
  ok('★ 푼 뒤에는 날글을 안 들고 있다 (두 벌이 아니다)', storage.holdsPreloaded(storage.PHOTOS), false);
  ok('★ 놓은 뒤에도 글자 하나까지 그대로다',
    사진.map((p) => [p.type, p.data.length]),
    [['profile', 장(60).length], ['before', 큰장.length], ['after', 큰장.length]]);
  // ★ 여기가 사진을 잃는 길이다 — 「없다」고 하면 `db.js` 가 빈 판으로 시작한다
  ok('★ `existsSync` 는 그대로 선다 (빈 판으로 시작하지 않는다)',
    storage.existsSync(storage.PHOTOS), true);

  console.log('');
  console.log('── 5. 담은 뒤에도 두 벌이 아니다 ──');
  db.savePhoto(8, 'before', 큰장);
  db.flushPhotosNow();                          // 동기 길
  ok('담겼다', db.getPhotos(8).length, 1);
  // 비동기 쓰기 쪽도 — 쓰는 손이 램에 다시 넣는다
  db.savePhoto(9, 'after', 큰장);
  db.photoFlushForTest();
  await new Promise((r) => setTimeout(r, 120));
  ok('★ 쓴 뒤에도 날글을 안 들고 있다', storage.holdsPreloaded(storage.PHOTOS), false);
  ok('  Postgres 에는 들어갔다 (램에만 두지 않는다)',
    JSON.parse(table.get(storage.PHOTOS)).photos.length, 심은사진.length + 2);

  console.log('');
  console.log('── 6. Postgres 판에서는 푼 것을 안 놓는다 ──');
  //
  // 놓으면 사람이 사진을 보는 길이 `readSync` 에서 터진다 — 그 글자는 이미 놓았다
  ok('★ 쉬어도 푼 것은 안 놓는다', db.freePhotosForTest(), false);
  ok('  그래서 사진을 계속 볼 수 있다', db.getPhotos(7).length, 3);

  console.log('');
  console.log('── 7. ★ 사진 판이 **없던** 서버에서도 — 담고 놓은 뒤 「있다」고 해야 한다 ──');
  //
  // 여기가 **사진을 잃는 길**이다. 갓 올린 배포에는 사진 줄이 아예 없다 —
  // 그때 누가 첫 사진을 담으면 쓰는 손이 램에 글자를 넣고, 우리가 그것을 놓는다.
  // 그 뒤에 `existsSync` 가 **「없다」고 하면** `db.js` 의 `loadPhotos` 가
  // **빈 판으로 시작하고, 다음 저장이 그 사람 사진을 덮는다.**
  //
  // 뜰 때 적어둔 「있었다」로는 이 자리를 못 본다(그때는 없던 이름이다) —
  // **쓰는 손도 적어야** 한다. 그래서 그 길을 따로 돌린다
  {
    const 빈자리 = fs.mkdtempSync(path.join(os.tmpdir(), 'photoram2-'));
    const 표2 = new Map();
    표2.set(storage.MAIN, JSON.stringify({ users: [], workouts: [] }));   // 사진 줄은 **없다**
    // 저장소 한 장을 새로 불러들인다 (같은 모듈을 다시 쓰면 앞의 판을 들고 있다)
    const 길 = require.resolve('../src/storage');
    const 앞 = require.cache[길];
    delete require.cache[길];
    const 옛표 = table;
    class Pool2 {
      async query(sql, params) {
        if (/CREATE TABLE/i.test(sql)) return { rows: [] };
        if (/^\s*SELECT/i.test(sql)) return { rows: [...표2.entries()].map(([name, body]) => ({ name, body })) };
        if (/INSERT INTO blobs/i.test(sql)) { 표2.set(params[0], params[1]); return { rows: [] }; }
        throw new Error('가짜 Postgres 가 모르는 질의: ' + sql.slice(0, 40));
      }
      async end() {}
    }
    const 앞로드 = Module._load;
    Module._load = function (req, parent, isMain) {
      if (req === 'pg') return { Pool: Pool2 };
      return 앞로드.call(this, req, parent, isMain);
    };
    process.env.DB_FILE = path.join(빈자리, 'never.json');
    const s2 = require('../src/storage');
    await s2.init();
    ok('사진 줄이 없던 서버다', s2.existsSync(s2.PHOTOS), false);
    await s2.write(s2.PHOTOS, JSON.stringify({ photos: [{ id: 1, user_id: 1, type: 'before', data: 큰장 }], _nextId: 2 }));
    ok('  담았다', JSON.parse(표2.get(s2.PHOTOS)).photos.length, 1);
    ok('  담은 뒤에는 들고 있다', s2.holdsPreloaded(s2.PHOTOS), true);
    s2.releasePreloaded(s2.PHOTOS);
    ok('★ 놓은 뒤에도 「있다」고 한다 (빈 판으로 시작하지 않는다)', s2.existsSync(s2.PHOTOS), true);
    ok('  정말 놓았다', s2.holdsPreloaded(s2.PHOTOS), false);
    // 되돌려놓는다
    Module._load = 앞로드;
    delete require.cache[길];
    if (앞) require.cache[길] = 앞;
    void 옛표;
    try { fs.rmSync(빈자리, { recursive: true, force: true }); } catch { /* 못 치워도 그만 */ }
  }

  console.log('');
  console.log('── 파일이 한 장도 안 생겼나 (디스크가 없는 자리다) ──');
  const 생긴것 = fs.readdirSync(tmp);
  ok('임시 자리에 파일이 없다', 생긴것, []);

  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* 못 치워도 그만 */ }
  console.log('');
  console.log(bad ? bad + '건 실패' : '전부 통과');
  process.exit(bad ? 1 : 0);
})();
