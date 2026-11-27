// ── **쉬면 사진 판을 램에서 놓는가** ── (2026-11-27 · 정석, 주인 「서버 최적화」)
//
//   npm run photofree   (npm run check 에도 들어 있다)
//
// ── 왜 ──
//
// 서버는 `--max-old-space-size=256` 으로 돈다(`package.json` · `render.yaml`).
// 그런데 사진을 다 채운 **사람 60명**이면 사진 판만 이렇다 —
//
//   날글(파일 / Postgres 에 든 꼴)   80MB
//   푼 것(`_photoCache`)            80MB
//   저장할 때 만드는 문자열          +80MB   ← 그 순간 **세 벌**
//
// 즉 사진만으로 뚜껑의 2/3 를 쓰고, 저장이 겹치면 **넘는다.** Render 무료 판은
// 메모리를 넘기면 **바로 죽인다** — 그때 램에만 있던 것이 사라진다.
//
// 사진은 **드물게 보고 드물게 바꾼다.** 그래서 쉬면 놓는다. 다시 보는 사람이
// 한 번 다시 푸는 값을 치르고(`loadPhotos` 가 다시 읽는다), 그 대신 늘 비어 있다.
//
// ── 무엇을 보는가 (전부 **값**으로) ──
//
//   1. 큰 판은 쉬면 **놓는다** (들고있다 → false)
//   2. 놓은 뒤에도 **사진이 그대로 돌아온다** — 글자 하나까지
//   3. ★ **안 쓴 것이 있으면 안 놓는다** — 놓으면 그 사진이 사라진다
//   4. ★ **쓰기가 걸려 있으면 안 놓는다** — 그 손이 캐시를 본다
//   5. **작은 판은 안 놓는다** — 다시 푸는 값만 치르고 얻는 것이 없다
//   6. 놓은 뒤 **저장이 멀쩡하다** (다시 읽어 담는다)
//
// 되돌려-FAIL: 「안 쓴 것이면 안 놓는다」를 떼면 3번이 뒤집혀 **사진이 사라진다.**
'use strict';
const fs = require('fs');
const path = require('path');

const TMP = path.join(__dirname, '.check-photofree.json');
process.env.DB_FILE = TMP;
process.env.JWT_SECRET = 'photofree-' + 'x'.repeat(40);
process.env.NODE_ENV = 'test';

const db = require('../src/db');
require('./_tmpdb.cjs')(TMP);

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : '  (기대: ' + JSON.stringify(want) + ')'));
};

// 큰 판을 만든다 — 8MB 선을 넘겨야 놓는다. 사람 여섯 × 세 장 × 0.5MB ≈ 9MB
const 장 = (kb) => 'data:image/jpeg;base64,' + Buffer.alloc(kb * 1024, 'A').toString('base64');
const 큰장 = 장(380);
for (let u = 1; u <= 6; u++) {
  for (const type of ['profile', 'before', 'after']) db.savePhoto(u, type, 큰장);
}
db.flushPhotosNow();
const 처음 = db.getPhotos(3).map((p) => [p.type, p.data.length]);
const 판크기 = db.photoMem().날글바이트;

console.log('── 판 ──');
ok('사진이 담겼다 (사람 3의 세 장)', 처음.length, 3);
ok('판이 8MB 선을 넘었다 (놓을 값이 있는 판이다)', 판크기 > 8 * 1048576, true);
console.log('   판 크기 ' + (판크기 / 1048576).toFixed(1) + 'MB · 사람 6명 × 세 장');

console.log('');
console.log('── 1·2. 쉬면 놓고, 놓아도 그대로 돌아온다 ──');
ok('놓기 전에는 들고 있다', db.photoMem().들고있다, true);
// ★ **램이 정말 돌아오는지 적는다** — 통과·실패로 세지 않는다(기계마다 다르고,
//   V8 이 언제 걷을지 우리가 못 정한다). 그래도 **수를 눈으로 봐야** 이 손이
//   무엇을 하는지 안다. `--expose-gc` 로 돌리면 걷은 뒤의 수가 적힌다
const mb = (n) => (n / 1048576).toFixed(1) + 'MB';
const 힙 = () => process.memoryUsage().heapUsed;
const 전 = 힙();
ok('★ 쉬면 놓는다', db.freePhotosForTest(), true);
if (global.gc) global.gc();
console.log('   힙: ' + mb(전) + ' → ' + mb(힙())
  + (global.gc ? '  (걷은 뒤)' : '  ← `node --expose-gc` 로 돌리면 걷은 뒤의 수가 보인다'));
ok('  놓은 횟수가 하나다', db.photoMem().놓은횟수, 1);
// **여기가 핵이다** — 놓은 뒤 다시 물어서 글자 하나까지 같은지 본다
ok('★ 다시 물으면 그대로 돌아온다 (글자 하나까지)', db.getPhotos(3).map((p) => [p.type, p.data.length]), 처음);
ok('  다시 들고 있다', db.photoMem().들고있다, true);

console.log('');
console.log('── 3. 안 쓴 것이 있으면 안 놓는다 (여기서 사진이 사라질 수 있다) ──');
// 한 장을 바꾸고 **쓰기 전에** 놓아 본다
db.savePhoto(9, 'before', 장(300));
const 안쓴것 = db.getPhotos(9).map((p) => p.data.length);
ok('★ 안 쓴 것이 있으면 안 놓는다', db.freePhotosForTest(), false);
ok('  그 사진이 그대로 있다', db.getPhotos(9).map((p) => p.data.length), 안쓴것);
db.flushPhotosNow();
ok('  쓰고 나면 놓는다', db.freePhotosForTest(), true);
ok('★ 쓰고 놓은 뒤에도 그 사진이 살아 있다', db.getPhotos(9).map((p) => p.data.length), 안쓴것);

console.log('');
console.log('── 4. 코드에 적힌 선 (시늉할 수 없는 자리) ──');
const 손 = fs.readFileSync(path.join(__dirname, '..', 'src', 'db.js'), 'utf-8');
ok('안 쓴 것 · 걸린 쓰기면 비킨다', /_photoDirty \|\| _photoTimer/.test(손), true);
ok('작은 판은 안 놓는다', /_photoBytes < PHOTO_FREE_MIN/.test(손), true);
ok('깨우는 타이머가 프로세스를 붙잡지 않는다 (unref)', /_photoFreeTimer\.unref/.test(손), true);

console.log('');
console.log('── 5. 작은 판은 안 놓는다 ──');
// 판을 비우고 작은 것 하나만 — 다시 푸는 값만 치를 판이다
db.deleteUserPhotos(1); db.deleteUserPhotos(2); db.deleteUserPhotos(3);
db.deleteUserPhotos(4); db.deleteUserPhotos(5); db.deleteUserPhotos(6); db.deleteUserPhotos(9);
db.savePhoto(1, 'profile', 장(20));
db.flushPhotosNow();
console.log('   판 크기 ' + (db.photoMem().날글바이트 / 1048576).toFixed(2) + 'MB');
ok('★ 작은 판은 쉬어도 안 놓는다', db.freePhotosForTest(), false);

console.log('');
console.log('── 6. 놓은 뒤에도 저장이 멀쩡하다 ──');
// 큰 판으로 되돌려 놓고, 놓은 뒤에 저장해 본다.
// ★ 5번에서 큰 것을 다 지웠으니 **다시 8MB 선을 넘겨야** 한다 — 한 사람에 한 장씩
//   넣으면 3.6MB 라 안 놓이고, 그러면 이 절이 「안 놓는다」를 결함으로 읽는다
for (let u = 20; u <= 26; u++) {
  for (const type of ['profile', 'before', 'after']) db.savePhoto(u, type, 큰장);
}
db.flushPhotosNow();
console.log('   판 크기 ' + (db.photoMem().날글바이트 / 1048576).toFixed(1) + 'MB');
ok('다시 놓았다', db.freePhotosForTest(), true);
db.savePhoto(30, 'after', 장(300));            // 놓인 상태에서 저장 → 다시 읽어 담아야 한다
db.flushPhotosNow();
ok('★ 놓인 뒤 담은 것이 남는다', db.getPhotos(30).length, 1);
ok('  먼저 담은 세 장도 그대로다', db.getPhotos(21).length, 3);

console.log('');
console.log(bad ? bad + '건 실패' : '전부 통과');
process.exit(bad ? 1 : 0);
