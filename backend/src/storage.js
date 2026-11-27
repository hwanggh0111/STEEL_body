// 파일 두 장을 **어디에 둘까** (2026-10-01).
//
// ── 왜 생겼나 ──
//
// 이 앱의 기록 전부가 두 장이다 — `blackiron.json`(본체) · `photos.json`(사진).
// 내 컴퓨터에서는 그냥 파일이면 된다. 그런데 **Render 무료 판은 디스크를 못 붙인다** —
// 재시작할 때마다, 잠들었다 깰 때마다 그 두 장이 **사라진다.** 배포하면 다음 날
// 회원들의 기록이 없다.
//
// 길은 둘이었다. 월 $7 짜리 디스크를 사거나, **무료 Postgres 에 그 두 장을 그대로
// 얹거나.** 뒤쪽을 골랐다 — 표를 스무 개로 쪼개 옮기는 일이 아니라, **글자 두 덩이를
// 둘 자리만 바꾸는 일**이라 하루 안쪽이고 되돌리기도 쉽다.
//
// ── 어떻게 생겼나 ──
//
// `db.js` 는 **램에 들고**(`_cache`) 파일은 그것을 흘려둔 자취다. 그 구조가 그대로
// 쓰인다 — Postgres 도 똑같이 「흘려두는 자리」가 된다. 그래서 `db.js` 가 바뀌는 곳은
// **읽고 쓰는 네 줄**뿐이고, 질의·색인·캐시는 손대지 않는다.
//
// ── 한 가지 지켜야 하는 것 ──
//
// `db.js` 의 `load()` 는 **기다리지 않는다**(동기). Postgres 는 기다려야 한다.
// 그래서 **서버가 뜰 때 한 번 미리 읽어둔다**(`init`). 그 뒤로 읽기는 램에서 나가고,
// 쓰기만 뒤에서 Postgres 로 간다. 이 순서가 깨지면(미리 안 읽고 요청을 받으면)
// 빈 DB 로 보인다 — 그래서 `index.js` 가 **듣기 시작하기 전에** 부른다.
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');

const URL = process.env.DATABASE_URL || '';
const KIND = URL ? 'postgres' : 'file';

// 두 장의 이름. Postgres 에서는 이것이 그대로 열쇠가 된다
const MAIN = 'blackiron.json';
const PHOTOS = 'photos.json';

// ── 파일로 둘 때 ──
const TMP_SUFFIX = '.writing';

// ── **동기 쓰기도 사슬을 비껴갈 수 없다** ── (2026-11-24)
//
// `fileWriteSync` 는 아래 `fileChains` 를 **안 지난다** — 기다릴 수 없으니 못 지난다.
// 그래서 비동기 쓰기가 도는 중에 동기로 쓰면 둘이 **같은 임시 파일**(`.writing`)에 붓고,
// 쓰다 만 바이트가 본 파일 자리에 끼이거나 뒤쪽 `rename` 이 `ENOENT` 로 터진다.
// 10/22 에 비동기끼리는 사슬로 막았고, 11/23 에 `db.js` 의 `flushNow` **한 자리**를
// 막았는데 — 동기로 쓰는 손은 거기 하나가 아니다(메일 번호 · 소셜 쪽지 · 끝내기 셋).
// **부르는 쪽마다 적어두면 반드시 한 곳이 빠진다**(10/22 에 이 파일에 적어둔 그 말이다).
//
// 여기서 둘을 뗀다.
//   1. **임시 이름을 갈라 쓴다** — 동기 쪽은 `.writing.sync`. 서로의 임시 파일을
//      밟는 길이 사라진다
//   2. **나중에 부른 쓰기가 이긴다** — 동기로 쓴 뒤에 닿는 비동기 `rename` 은
//      **옛 판**이다(둘 다 같은 램을 찍는데 동기 쪽이 나중에 찍었다). 그 판은
//      갈아끼우지 않고 버린다 — 안 버리면 방금 쓴 번호·쪽지가 옛 판에 덮인다.
//      끝내기(`drain`)가 사슬을 비우는 것과 **같은 뜻**이고, 기다릴 수 없는 자리
//      (`process.on('exit')`)에서는 이것만 남는다
let writeSeq = 0;                 // 쓰기를 **부른** 차례. 파일과 상관없이 하나로 센다
const syncSeq = new Map();        // 파일 이름 → 마지막 동기 쓰기의 차례

function fileWriteSync(file, text) {
  const mySeq = ++writeSeq;
  // 쓰다 죽어도 앞의 것이 남게 — 딴 이름으로 다 쓴 뒤 이름을 바꿔 끼운다
  const tmp = file + TMP_SUFFIX + '.sync';
  fs.writeFileSync(tmp, text, 'utf-8');
  // ── ★ **류가 반만 닫혀 있었다** ── (2026-11-27 · 정석)
  //
  // 11/26 에 「갈아끼우다 터지면 내가 만든 것은 내가 치운다」를 붙였는데(전수검사 ③)
  // **비동기 쪽에만** 붙였다. 동기 쪽은 `renameSync` 가 터지면 `.writing.sync` 가
  // 그 자리에 남는다 — 그리고 **그 꼴이 실제로 나왔다**: 11/27 에 창 셋이 자를 겹쳐
  // 돌릴 때 `check-write` 가 `EPERM: rename` 으로 터지면서 `.writing.sync` 를 남기고,
  // 그것이 `check-tidy` 까지 울렸다(거짓이 거짓을 낳았다). 윈도에서는 남이 그 파일을
  // 열고만 있어도 `rename` 이 `EPERM` 이다 — 드문 일이 아니다.
  //
  // 뜰 때 걷는 손(`sweepTemp`)이 있지만 그것은 **다음에 뜰 때**다. 끝내는 자리에서
  // 터진 찌꺼기를 그때까지 두면 `git status` 가 더럽고 훅 나눠 담는 자리가 어긋난다
  try {
    fs.renameSync(tmp, file);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch { /* 이미 없으면 그만 */ }
    throw err;
  }
  // 갈아끼운 **뒤에** 적는다 — 적는 사이에 비동기 쪽이 끼어들 틈은 없다(동기가 줄을 쥔다)
  syncSeq.set(file, mySeq);
}

// **겹쳐 쓰면 서로의 임시 파일을 밟는다** (2026-10-22).
//
// 임시 이름은 `파일명 + .writing` 하나다. 두 쓰기가 겹치면 둘이 **같은 임시 파일**에
// 붓고, 먼저 끝난 쪽의 `rename` 이 **상대가 쓰던 것**을 본 파일 자리에 끼운 뒤
// 뒤쪽 `rename` 은 `ENOENT` 로 터진다. 재현했다 — 12MB 두 장을 1~5ms 차로 쓰면
// 쓰기 하나가 매번 실패한다.
//
// 본 DB 는 `db.js` 가 제 손으로 줄을 세워(`_writeLock` · `_writeQueue`) 여태
// 안 걸렸다. **사진은 그 줄이 없다** — 그리고 사진이 더 크다(40MB · 196ms).
// 500ms 미뤄 쓰는 사이에 쓰기가 끝나지 않으면 다음 쓰기와 겹친다.
//
// 줄 세우는 자리를 **여기 하나로** 모은다. Postgres 쪽은 이미 `writeChain` 으로
// 그렇게 하고 있고(아래), 까닭도 같다 — 나중 것이 먼저 닿으면 옛 판이 이긴다.
// 부르는 쪽마다 잠금을 적어두면 반드시 한 곳이 빠진다.
const fileChains = new Map();     // 파일 이름 → 지금까지의 쓰기 사슬

function fileWrite(file, text) {
  const mySeq = ++writeSeq;
  const prev = fileChains.get(file) || Promise.resolve();
  const next = prev.then(async () => {
    const tmp = file + TMP_SUFFIX;
    await fsp.writeFile(tmp, text, 'utf-8');
    // 내가 기다리는 동안 **나중에 부른 동기 쓰기**가 이 파일을 갈아끼웠다면 내 판은
    // 옛것이다 — 끼우지 않고 임시 파일만 걷는다 (위 머리글 2번)
    if ((syncSeq.get(file) || 0) > mySeq) {
      await fsp.unlink(tmp).catch(() => { /* 이미 없으면 그만 */ });
      return;
    }
    try {
      await fsp.rename(tmp, file);
    } catch (err) {
      // ── ★ **갈아끼우다 터지면 임시 파일이 남는다** ── (2026-11-26 · 정석, 전수검사 ③)
      //
      // 다 쓴 뒤 `rename` 이 실패하면(디스크가 찼다 · 파일이 잠겼다) `.writing` 이
      // 그 자리에 남는다. 사람 화면에는 안 닿지만 **`git status` 가 늘 더럽고**,
      // 훅 나눠 커밋하는 자리가 매번 어긋난다. **내가 만든 것은 내가 치운다**
      await fsp.unlink(tmp).catch(() => { /* 이미 없으면 그만 */ });
      throw err;
    }
  });
  // 사슬은 **실패해도 이어진다.** 한 번 터진 쓰기가 뒤의 모든 쓰기를 막으면 안 된다.
  // 터진 것은 부르는 쪽이 받는다 (`db.js` 가 다시 쓴다고 표시한다)
  fileChains.set(file, next.catch(() => {}));
  return next;
}
// ── Postgres 로 둘 때 ──
//
// 표는 하나다. 「이름 → 글자」. 파일 두 장이 두 줄이 된다.
let pool = null;
const preloaded = new Map();      // 뜰 때 읽어둔 것 (이름 → 글자)
let writeChain = Promise.resolve();

function pgPool() {
  if (pool) return pool;
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: URL,
    // Neon · Render 의 Postgres 는 TLS 를 쓰는데 인증서가 사슬로 안 붙는 일이 잦다.
    // 여기서 끊기면 **서버가 아예 못 뜬다** — 연결 자체는 암호화된다
    ssl: { rejectUnauthorized: false },
    max: 3,                       // 무료 판은 연결 수가 적다. 이 앱은 한 대로 돈다
    idleTimeoutMillis: 30000,
  });
  // ── **쉬는 연결이 끊겨도 서버는 안 죽는다** (2026-11-23) ──
  //
  // `pg.Pool` 은 쉬고 있는 연결이 저쪽에서 끊기면(DB 재시작 · 망 끊김) `'error'` 를
  // 낸다. 듣는 손이 없으면 Node 가 그것을 **잡히지 않은 예외로 던져 프로세스가 죽는다**
  // — 끝내기 길을 안 거치니 램에 남은 것(모아 쓰기 500ms 몫)이 사라진다.
  // 끊긴 연결은 풀이 버리고 다음 쿼리가 새로 붙는다. 적어만 둔다
  if (typeof pool.on === 'function') pool.on('error', (err) => {
    console.error('[DB] Postgres 쉬는 연결이 끊겼습니다:', err.message);
  });
  return pool;
}

async function pgInit() {
  const p = pgPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS blobs (
      name       text PRIMARY KEY,
      body       text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const { rows } = await p.query('SELECT name, body FROM blobs');
  for (const r of rows) preloaded.set(r.name, r.body);

  // ── 처음 한 번은 **파일에서 옮겨 온다** ──
  //
  // 이미 쓰던 파일이 옆에 있는데 Postgres 가 비어 있으면, 그것이 **첫 배포**다.
  // 그때 빈 DB 로 시작하면 여태 적은 것이 없는 앱이 된다. 그래서 한 번만 얹는다.
  // (이미 Postgres 에 있으면 **절대 안 덮는다** — 파일 쪽이 옛것일 수 있다)
  for (const [name, file] of [[MAIN, mainPath()], [PHOTOS, photosPath()]]) {
    if (preloaded.has(name)) continue;
    if (!fs.existsSync(file)) continue;
    try {
      const text = fs.readFileSync(file, 'utf-8');
      JSON.parse(text);                        // 깨진 것을 옮기지 않는다
      await pgWrite(name, text);
      preloaded.set(name, text);
      console.log(`[DB] ${name} 을 파일에서 Postgres 로 한 번 옮겼습니다 (${Math.round(text.length / 1024)}KB)`);
    } catch (err) {
      console.error(`[DB] ${name} 을 옮기지 못했습니다:`, err.message);
    }
  }
  console.log(`[DB] Postgres 를 씁니다 (${preloaded.size}장을 들고 왔습니다)`);
}

async function pgWrite(name, text) {
  await pgPool().query(
    `INSERT INTO blobs (name, body, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (name) DO UPDATE SET body = EXCLUDED.body, updated_at = now()`,
    [name, text],
  );
}

// ── 바깥으로 내보내는 것 ──

function mainPath() {
  return process.env.DB_FILE
    ? path.resolve(process.env.DB_FILE)
    : path.join(__dirname, '../blackiron.json');
}

function photosPath() {
  return process.env.DB_FILE
    ? path.resolve(process.env.DB_FILE).replace(/\.json$/, '') + '.photos.json'
    : path.join(__dirname, '../photos.json');
}

const pathOf = (name) => (name === PHOTOS ? photosPath() : mainPath());

/**
 * 남아 있는 임시 파일(`*.writing` · `*.writing.sync`)을 걷는다.
 *
 * **본 파일 옆만 본다** — 아무 파일이나 지우지 않는다. Postgres 판에서도 파일 쪽
 * 찌꺼기가 남아 있을 수 있어(파일로 쓰다 옮겨온 판) 갈래를 안 가린다.
 */
function sweepTemp() {
  for (const base of [mainPath(), photosPath()]) {
    for (const suffix of [TMP_SUFFIX, TMP_SUFFIX + '.sync']) {
      try { fs.unlinkSync(base + suffix); } catch { /* 없으면 그만 */ }
    }
  }
}

module.exports = {
  KIND,
  sweepTemp,
  MAIN,
  PHOTOS,
  isPostgres: KIND === 'postgres',
  pathOf,

  /** 서버가 **듣기 시작하기 전에** 한 번. 파일일 때는 할 일이 없다. */
  async init() {
    // ── **지난번에 죽으면서 남긴 임시 파일을 치운다** ── (2026-11-26 · 정석, 전수검사 ③)
    //
    // 쓰는 중에 프로세스가 죽으면(Render 가 메모리를 넘겨 죽이는 일이 있다 · 검사를
    // Ctrl+C 로 끊는 일이 더 흔하다) `파일.writing` 이 남는다. **그 파일은 누가 봐도
    // 쓰레기다** — 이름이 임시 이름이고, 본 파일은 그 옆에 온전히 있다(원자적 쓰기의
    // 뜻이 그것이다). 뜰 때 한 번 걷는다. 지우다 실패해도 **뜨는 것을 막지 않는다**
    sweepTemp();
    if (KIND === 'file') return;
    await pgInit();
  },

  /** 있는가. 없으면 `db.js` 가 빈 판을 만든다. */
  existsSync(name) {
    if (KIND === 'postgres') return preloaded.has(name);
    return fs.existsSync(pathOf(name));
  },

  /** 글자를 읽는다. **기다리지 않는다** — Postgres 는 뜰 때 읽어둔 것을 준다. */
  readSync(name) {
    if (KIND === 'postgres') {
      const v = preloaded.get(name);
      if (v === undefined) throw new Error(name + ' 을 아직 안 읽었습니다 (init 을 안 불렀습니다)');
      return v;
    }
    return fs.readFileSync(pathOf(name), 'utf-8');
  },

  /**
   * 기다리지 않고 쓴다.
   *
   * Postgres 는 **순서대로** 쓴다(`writeChain`) — 두 저장이 겹치면 나중 것이
   * 먼저 닿아 **옛 판이 이기는** 일이 난다.
   */
  write(name, text) {
    if (KIND === 'postgres') {
      preloaded.set(name, text);              // 램이 먼저 맞는다. 읽기는 여기서 나간다
      // ── **실패를 부른 쪽에 돌려준다** (2026-11-23) ──
      //
      // 여태 `.catch` 가 오류를 삼킨 그 약속을 돌려줬다 — 늘 「됐다」로 끝났다.
      // `db.js` 의 `_flush` 는 실패해야 `_dirty = true` 로 다시 쓰는데, 그 손이
      // **한 번도 안 돌았다.** Postgres 가 잠깐 끊긴 사이 적은 세트는 램에만 남고,
      // 다음 저장이 없으면 배포 · 재시작 때 사라졌다(파일 쪽은 실패를 돌려준다).
      // 줄(`writeChain`)은 계속 이어져야 하니 줄 쪽만 삼키고, 부른 쪽에는 그대로 준다
      const p = writeChain.then(() => pgWrite(name, text));
      writeChain = p.catch((err) => {
        console.error('[DB] Postgres 에 쓰지 못했습니다:', err.message);
      });
      return p;
    }
    return fileWrite(pathOf(name), text);
  },

  /**
   * 지금 당장 쓴다 (끝날 때 부른다).
   *
   * **Postgres 는 동기로 쓸 수 없다.** 그래서 끝내는 쪽(`index.js`)이 기다려 준다 —
   * 기다릴 수 없는 자리(`process.on('exit')`)에서는 할 수 있는 데까지만 한다.
   */
  writeSync(name, text) {
    if (KIND === 'postgres') {
      // 끝내는 자리는 이 약속을 안 받는다 — 실패가 잡히지 않은 거부로 새지 않게
      const p = module.exports.write(name, text);
      p.catch(() => {});
      return p;
    }
    fileWriteSync(pathOf(name), text);
    return Promise.resolve();
  },

  /** 못 쓴 것이 남아 있으면 그것을 기다린다. 끝내기 전에 부른다. */
  async drain() {
    if (KIND === 'postgres') return void (await writeChain);
    // **파일일 때도 기다릴 것이 있다** (2026-10-22). 여태 파일 쪽은 할 일이 없다고
    // 봤는데, 끝내는 자리에서 `writeSync` 가 같은 임시 파일에 붓는다 — 아직 안 끝난
    // 비동기 쓰기가 남아 있으면 그쪽 `rename` 이 **나중에** 닿아 옛 판이 이긴다.
    // 끝내기 전에 사슬을 비운다
    await Promise.allSettled([...fileChains.values()]);
  },

  /**
   * 파일이 마지막으로 바뀐 때. **파일일 때만 뜻이 있다.**
   *
   * 「바깥에서 누가 파일을 고쳤나」를 보는 데 쓴다 — Postgres 에서는 그런 일이
   * 없으므로(사는 곳이 한 대다) `null` 을 주고, `db.js` 는 그 검사를 건너뛴다.
   */
  statMs(name) {
    if (KIND === 'postgres') return null;
    try { return fs.statSync(pathOf(name)).mtimeMs; } catch { return null; }
  },

  /**
   * 깨진 판을 **옆으로 치운다.** 되살릴 것이 남아야 한다.
   *
   * ── ★ **Postgres 에서는 사본이 안 남고 있었다** ── (2026-11-26 · 정석)
   *
   * 여기서 `null` 을 돌려주면 `db.js` 의 `load()` 는 「치우지 못했다」고 적고 그대로
   * 간다 — 그리고 **바로 뒤의 `_flushSync` 가 빈 판을 쓴다.** 파일일 때는 깨진
   * 파일이 `.broken-…` 으로 옆에 남아 사람이 손으로 꺼낼 수 있는데,
   * **Postgres 에서는 그 줄이 빈 판으로 덮여 아무것도 안 남았다** (운영이 그쪽이다).
   * 깨질 일은 드물지만, 걸리는 날은 **아홉 사람 기록 전부가 걸린 날**이다.
   *
   * 글자는 이미 램에 들고 있다(`preloaded` — 뜰 때 읽어둔 그 판이다). **다른 이름의
   * 줄로 한 장 떠둔다.** 쓰는 것은 비동기지만 **글자는 지금 손에 있으므로**, 뒤이어
   * 빈 판이 `MAIN` 을 덮어도 이 사본은 그 글자다(이름이 달라 줄이 겹치지도 않는다).
   */
  keepBroken(name) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    if (KIND === 'postgres') {
      const body = preloaded.get(name);
      if (body === undefined) return null;      // 읽은 것이 없으면 뜰 것도 없다
      const kept = name + '.broken-' + stamp;
      preloaded.set(kept, body);
      // 못 떠도 뜨는 것을 막지는 않는다 — 적어만 둔다 (뜨지 못하면 앱이 아예 안 열린다)
      pgWrite(kept, body).catch((err) => {
        console.error('[DB] 깨진 판을 Postgres 에 떠두지 못했습니다:', err.message);
      });
      return kept;
    }
    const file = pathOf(name);
    const kept = file + '.broken-' + stamp;
    fs.renameSync(file, kept);
    return path.basename(kept);
  },

  async close() {
    if (pool) { await pool.end(); pool = null; }
  },
};
