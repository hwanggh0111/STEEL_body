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

function fileWriteSync(file, text) {
  // 쓰다 죽어도 앞의 것이 남게 — 딴 이름으로 다 쓴 뒤 이름을 바꿔 끼운다
  const tmp = file + TMP_SUFFIX;
  fs.writeFileSync(tmp, text, 'utf-8');
  fs.renameSync(tmp, file);
}

async function fileWrite(file, text) {
  const tmp = file + TMP_SUFFIX;
  await fsp.writeFile(tmp, text, 'utf-8');
  await fsp.rename(tmp, file);
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

module.exports = {
  KIND,
  MAIN,
  PHOTOS,
  isPostgres: KIND === 'postgres',
  pathOf,

  /** 서버가 **듣기 시작하기 전에** 한 번. 파일일 때는 할 일이 없다. */
  async init() {
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
      writeChain = writeChain.then(() => pgWrite(name, text)).catch((err) => {
        console.error('[DB] Postgres 에 쓰지 못했습니다:', err.message);
      });
      return writeChain;
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
    if (KIND === 'postgres') return module.exports.write(name, text);
    fileWriteSync(pathOf(name), text);
    return Promise.resolve();
  },

  /** 못 쓴 것이 남아 있으면 그것을 기다린다. 끝내기 전에 부른다. */
  async drain() {
    if (KIND === 'postgres') await writeChain;
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

  /** 깨진 파일을 옆으로 치운다 (파일일 때만). 되살릴 것이 남아야 한다. */
  keepBroken(name) {
    if (KIND === 'postgres') return null;
    const file = pathOf(name);
    const kept = file + '.broken-' + new Date().toISOString().replace(/[:.]/g, '-');
    fs.renameSync(file, kept);
    return path.basename(kept);
  },

  async close() {
    if (pool) { await pool.end(); pool = null; }
  },
};
