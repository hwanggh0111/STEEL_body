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
  //
  // ★ **창을 글자 수로 재지 않는다** (2026-11-27 · 정석). 여태 `ph + 1200` 으로
  //   잘라 봤는데, 그 함수에 **주석 열한 줄을 더하자 과녁이 창 밖으로 밀려** 이
  //   줄이 FAIL 했다 — 코드는 멀쩡한데 자가 운 것이다(거짓 FAIL). 자가 글자
  //   거리에 매이면 **주석을 적는 것이 위험한 일**이 된다. 함수 끝까지 본다
  const ph = dbSrc.indexOf('function _flushPhotos()');
  // 줄끝은 그 파일에서 읽는다 — 이 저장소에는 CRLF 와 LF 가 섞여 있다
  const NL_SRC = dbSrc.includes(String.fromCharCode(13, 10)) ? String.fromCharCode(13, 10) : String.fromCharCode(10);
  const 끝 = dbSrc.indexOf(NL_SRC + '}', ph);
  const 사진손 = dbSrc.slice(ph, 끝 > ph ? 끝 : ph + 4000);
  ok('사진 쓰기 실패 뒤 다시 쓴다',
    /_photoTimer = setTimeout\(_flushPhotos/.test(사진손), true);
  // **0건은 통과가 아니다** — 함수를 못 찾았으면 이 줄이 운다
  ok('  그 함수를 찾았다', ph > 0 && 사진손.length > 200, true);

  // ── 4. **동기 쓰기와 비동기 쓰기가 겹칠 때** ── (2026-11-24)
  //
  // 사슬(`fileChains`)은 비동기끼리만 줄을 세운다. **동기 쓰기는 그 줄을 안 지난다** —
  // 기다릴 수 없으니 못 지난다. 그래서 둘이 겹치면 **같은 임시 파일**(`.writing`)에
  // 붓고, 쓰다 만 바이트가 본 파일 자리에 끼이거나 뒤쪽 `rename` 이 `ENOENT` 로 터졌다.
  // 11/23 에 `db.js` 의 `flushNow` 한 자리를 막았지만 동기로 쓰는 손은 셋이었다.
  //
  // 정한 것은 **나중에 부른 쓰기가 이긴다**다 — 둘 다 같은 램을 찍으므로 나중에 찍은
  // 것이 새 판이다. 양쪽 차례를 다 본다 (한쪽만 보면 「늘 동기가 이긴다」로도 통과한다).
  for (const gap of [0, 1, 5, 20]) {
    const first = storage.write(storage.PHOTOS, blob('A', 12));
    await sleep(gap);
    storage.writeSync(storage.PHOTOS, blob('S', 12));     // **나중에** 부른 쪽
    const r = await Promise.allSettled([first]);
    const failed = r.filter((x) => x.status === 'rejected').map((x) => x.reason.code || x.reason.message);
    ok(gap + 'ms 뒤 동기가 끼어들어도 안 터진다', failed, []);
    ok('  나중에 부른 동기 쪽이 파일에 남는다', whoIsInFile(), 'S');
  }
  // 거꾸로 — 동기로 쓴 **뒤에** 부른 비동기는 새 판이므로 이겨야 한다.
  // (차례를 안 보고 「동기가 이긴다」로 막으면 여기서 운다)
  storage.writeSync(storage.PHOTOS, blob('S', 12));
  await storage.write(storage.PHOTOS, blob('B', 12));
  ok('동기 뒤에 부른 비동기가 이긴다', whoIsInFile(), 'B');
  ok('임시 파일이 둘 다 안 남는다',
    [fs.existsSync(PHOTOS_FILE + '.writing'), fs.existsSync(PHOTOS_FILE + '.writing.sync')],
    [false, false]);

  // ── 5. **요청 길에서 동기로 쓰는 손이 도는 쓰기에 끼어들지 않는가** ── (2026-11-24)
  //
  // 메일 번호 · 소셜 쪽지는 모아 쓰기(0.5초)를 기다리지 않고 **바로 쓴다** — 그 사이에
  // 서버가 죽으면 사람이 받은 번호가 못 쓰는 번호가 되니 맞는 판단이다. 그런데 그 길이
  // 도는 비동기 쓰기 중에도 동기로 38MB 를 부으면 **그동안 서버는 아무 요청도 못 받는다.**
  // 그래서 도는 쓰기가 있으면 **줄에 세우고 비킨다**(`_flushNowSafe`).
  //
  // **시간(ms)으로 재지 않는다** — 디스크가 빠른 자리에서 숫자가 썩는다. 뜻으로 본다:
  //   ⑴ 비켰으면 **그 순간 파일에는 아직 없다**  ⑵ 그러나 **잃지도 않는다**(끝내면 있다)
  // 잠긴 틈을 만드는 것은 쓰기를 늦추는 것으로 한다 — 시간에 안 기대고 **잠긴 것을
  // 본 뒤에** 부른다
  process.env.JWT_SECRET = 'x'.repeat(40);
  const db = require('../src/db');
  require('./_tmpdb.cjs')(TMP);
  const realWrite = storage.write;
  let 쓰는중 = 0;
  storage.write = (name, text) => {
    쓰는중 += 1;
    return sleep(200).then(() => realWrite(name, text)).finally(() => { 쓰는중 -= 1; });
  };
  // 한 번 적어 두고(여기서는 도는 쓰기가 없으니 그대로 쓴다), 다시 더럽혀 비동기 쓰기를 깨운다
  db.blockIp('9.9.9.9', Date.now() + 60000, 1, '겹침 자');
  db.flushNow();
  db.blockIp('9.9.9.8', Date.now() + 60000, 1, '겹침 자 둘');
  while (!쓰는중) await sleep(5);                  // 이제 `_writeLock` 이 서 있다
  const 적힌것 = () => { try { return JSON.parse(fs.readFileSync(TMP, 'utf8')); } catch (e) { return { 깨짐: e.message }; } };
  db.putVerifyCode('wr@check.local', 'hash'.repeat(8), 60000);
  const 바로 = 적힌것();
  ok('도는 쓰기 중에는 번호를 동기로 붓지 않는다',
    (바로.verifyCodes || []).length, 0);
  // 파일이 깨지지도, 옛 판으로 덮이지도 않았다 — 도는 쓰기 **전**의 판이 온전하다
  ok('  그 사이에도 파일은 온전하다 (앞 판 그대로)', (바로.blocks || []).map((b) => b.ip), ['9.9.9.9']);
  await db.drain();
  const 나중 = 적힌것();
  ok('  비켰어도 번호를 잃지 않는다',
    (나중.verifyCodes || []).map((r) => r.email), ['wr@check.local']);
  ok('  앞서 적은 것도 그대로다',
    (나중.blocks || []).filter((b) => String(b.reason || '').startsWith('겹침 자')).map((b) => b.ip),
    ['9.9.9.9', '9.9.9.8']);
  storage.write = realWrite;

  // ── 6. **갈아끼우다 터지면 임시 파일을 치우는가** ── (2026-11-27 · 정석)
  //
  // 11/26 에 「내가 만든 것은 내가 치운다」를 붙인 자리가 **비동기 쪽 하나**였다.
  // 동기 쪽(`fileWriteSync`)은 `renameSync` 가 터지면 `.writing.sync` 를 남겼고,
  // **그 꼴이 실제로 나왔다**: 11/27 에 창 셋이 자를 겹쳐 돌릴 때 이 자가
  // `EPERM: rename` 으로 터지면서 찌꺼기를 남기고 `check-tidy` 까지 울렸다.
  //
  // 터지게 만드는 법 — **갈 자리를 빈 디렉터리가 아닌 디렉터리로 둔다.** 파일을
  // 디렉터리 위로 옮길 수는 없으니 어느 운영체제에서나 터진다(윈도 `EPERM` ·
  // 리눅스 `EISDIR`/`ENOTEMPTY`). 시간에도 남의 창에도 안 기댄다
  console.log('');
  console.log('── 갈아끼우다 터져도 찌꺼기를 안 남긴다 ──');
  const 막는다 = () => {
    for (const f of [PHOTOS_FILE, PHOTOS_FILE + '.writing', PHOTOS_FILE + '.writing.sync']) {
      if (fs.existsSync(f) && fs.statSync(f).isFile()) fs.unlinkSync(f);
    }
    fs.mkdirSync(PHOTOS_FILE, { recursive: true });
    fs.writeFileSync(path.join(PHOTOS_FILE, '막음.txt'), 'x', 'utf-8');
  };
  const 치운다 = () => fs.rmSync(PHOTOS_FILE, { recursive: true, force: true });
  const 남은것 = () => [fs.existsSync(PHOTOS_FILE + '.writing'), fs.existsSync(PHOTOS_FILE + '.writing.sync')];

  막는다();
  let 터졌나 = '안 터졌다';
  try { storage.writeSync(storage.PHOTOS, blob('S', 1)); } catch (e) { 터졌나 = e.code || e.message; }
  ok('★ 동기 — 터진 것을 부른 쪽에 돌려준다', 터졌나 !== '안 터졌다', true);
  ok('★ 동기 — `.writing.sync` 를 안 남긴다', 남은것(), [false, false]);
  치운다();

  막는다();
  let 터졌나2 = '안 터졌다';
  try { await storage.write(storage.PHOTOS, blob('B', 1)); } catch (e) { 터졌나2 = e.code || e.message; }
  ok('★ 비동기 — 터진 것을 부른 쪽에 돌려준다', 터졌나2 !== '안 터졌다', true);
  ok('★ 비동기 — `.writing` 을 안 남긴다', 남은것(), [false, false]);
  치운다();

  // 터진 쓰기가 **뒤의 쓰기를 막지 않는다** — 사슬은 실패해도 이어진다
  await storage.write(storage.PHOTOS, blob('C', 1));
  ok('  터진 뒤에도 다음 쓰기가 간다', whoIsInFile(), 'C');

  for (const f of [TMP, PHOTOS_FILE, PHOTOS_FILE + '.writing', PHOTOS_FILE + '.writing.sync', TMP + '.writing', TMP + '.writing.sync']) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
  process.exit(bad ? 1 : 0);
})();
