// 겹쳐 쓰기 — 사진 · 본체를 한꺼번에 저장할 때 (2026-10-22).
//
//   npm run write      (npm run check 에도 들어 있다)
//
// **읽어서는 안 보이는 자리다.** 두 쓰기가 겹칠 때만 나고, 겹치려면 쓰기 하나가
// 500ms 를 넘겨야 한다 — 내 컴퓨터의 작은 DB 로는 평생 안 걸린다. 사진은 다르다:
// 40MB 에 196ms + 215ms 이고, 사람이 사진 두 장을 잇따라 올리면 그대로 겹친다.
//
// 세 가지를 **돌려서** 본다.
//   1. 겹쳐 써도 쓰기가 터지지 않는가 (같은 임시 파일을 밟지 않는가)
//   2. 겹쳐 쓴 뒤 파일에 **나중 것**이 남는가 (옛 판이 이기지 않는가)
//   3. 끝내기(`drain`)가 안 끝난 쓰기를 **기다린 뒤에** 마지막 판을 쓰는가
const path = require('path');
const fs = require('fs');

const TMP = path.join(__dirname, '..', '.write-check.json');
process.env.DB_FILE = TMP;

const storage = require('../src/storage');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const PHOTOS_FILE = TMP.replace(/\.json$/, '') + '.photos.json';
const blob = (c, mb) => JSON.stringify({ who: c, pad: c.repeat(mb * 1024 * 1024) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function whoIsInFile() {
  if (!fs.existsSync(PHOTOS_FILE)) return '파일 없음';
  const text = fs.readFileSync(PHOTOS_FILE, 'utf8');
  try { return JSON.parse(text).who; } catch { return '깨짐(' + text.length + '바이트)'; }
}

(async () => {
  console.log('── 겹쳐 쓰기 ──');
  if (storage.isPostgres) {
    console.log('SKIP Postgres 로 돌고 있습니다 — 파일 겹침은 파일일 때만 봅니다');
    process.exit(0);
  }

  // 1·2. 12MB 두 장을 밀리초 차로 쓴다. 고치기 전에는 뒤쪽이 ENOENT 로 터지고
  //       먼저 끝난 쪽의 rename 이 **상대가 쓰던 임시 파일**을 끼웠다
  for (const gap of [0, 1, 5, 20]) {
    const first = storage.write(storage.PHOTOS, blob('A', 12));
    await sleep(gap);
    const second = storage.write(storage.PHOTOS, blob('B', 12));
    const r = await Promise.allSettled([first, second]);
    const failed = r.filter((x) => x.status === 'rejected').map((x) => x.reason.code || x.reason.message);
    ok(gap + 'ms 차로 겹쳐 써도 안 터진다', failed, []);
    ok('  나중 것이 파일에 남는다', whoIsInFile(), 'B');
  }

  // 임시 파일을 남기지 않는다 — 남으면 다음 쓰기가 그것을 덮고, 백업이 함께 뜬다
  ok('임시 파일이 안 남는다', fs.existsSync(PHOTOS_FILE + '.writing'), false);

  // 3. 끝내기는 안 끝난 쓰기를 기다린다. 기다리지 않으면 아래 `C` 가 파일에 닿기
  //    전에 끝내기가 지나가고, 남아 있던 쓰기가 **나중에** 닿아 옛 판이 이긴다
  const slow = storage.write(storage.PHOTOS, blob('C', 12));
  await storage.drain();
  ok('끝내기가 쓰기를 기다린다', whoIsInFile(), 'C');
  await slow.catch(() => {});

  // 끝내기 쪽 순서가 코드에 남아 있는가 — 되돌리면 이 검사가 먼저 깨진다
  const dbSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'db.js'), 'utf8');
  const at = dbSrc.indexOf('async drain()');
  const near = dbSrc.slice(at, at + 700);
  ok('db.drain 은 기다린 뒤에 쓴다',
    near.indexOf('await storage.drain()') < near.indexOf('_flushImmediate()'), true);
  // 사진 쓰기가 실패하면 **다시 걸어야** 한다 (표시만 하면 램에만 남는다)
  const ph = dbSrc.indexOf('function _flushPhotos()');
  ok('사진 쓰기 실패 뒤 다시 쓴다',
    /_photoTimer = setTimeout\(_flushPhotos/.test(dbSrc.slice(ph, ph + 1200)), true);

  for (const f of [TMP, PHOTOS_FILE, PHOTOS_FILE + '.writing']) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
  process.exit(bad ? 1 : 0);
})();
