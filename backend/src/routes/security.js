const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const adminAuth = require('../middleware/adminAuth');
const db = require('../db');
// 자체 검사가 **DB 파일 이름**을 알아야 한다 — 손으로 적으면 이름을 바꾼 날 어긋난다
const storage = require('../storage');
const { seoulDay } = require('../utils/seoulDay');
const keepWarm = require('../utils/keepWarm');
const aiGuard = require('../middleware/aiGuard');
const {
  RATE_LIMITS, JWT, BCRYPT_ROUNDS, BODY_LIMIT, PERMISSIONS_POLICY,
  LOGIN_LOCK_DESC, HSTS_MAX_AGE,
} = require('../config/security');
// CSP 도 **지금 나가는 것**을 읽어 적는다 — 손으로 적어두면 바꾼 날 화면만 옛말을 한다
const { DIRECTIVES } = require('../csp');
const CSP_SUMMARY = ['script-src', 'connect-src']
  .map((k) => `${k} ${(DIRECTIVES[k] || []).join(' ')}`).join(' · ');

// 보안 로그 (메모리 + 파일 영속화)
// 어디에 둘까. 기본은 저장소 옆 `security.log` 다.
//
// **자리를 바꿀 수 있게 둔다**(`SECURITY_LOG_PATH`). 두 가지 때문이다 —
// 검사가 진짜 기록을 건드리지 않고 돌 수 있어야 하고(`npm run logfile`), 배포한 곳의
// 디스크가 날아가는 자리면 다른 데를 가리켜야 한다. `DB_FILE` 과 같은 모양이다.
const LOG_PATH = process.env.SECURITY_LOG_PATH || path.join(__dirname, '../../security.log');
const securityLogs = [];

// ── 파일이 끝없이 커지던 것 ── (2026-10-01)
//
// 램에 든 목록은 1000건에서 자르는데 **파일은 안 잘랐다.** 붙이기만 하고 걷는 데가
// 없었다 — 만들면서 쓴 것만으로 이미 127KB 로, DB 본체(62KB)의 두 배였다.
// 로그인 실패 · 차단 · 인증번호는 30분마다 걷으면서 로그 파일만 빠져 있었다.
//
// **지우지는 않는다.** 보안 기록은 「언제부터 이랬나」를 보는 값이라, 넘치면
// **한 벌만 옆으로 밀어두고**(`.1`) 새로 쓴다. 두 벌이면 넉넉하다 — 그보다 옛것은
// 들여다볼 일이 없고, 무료 판은 디스크가 작다.
const LOG_MAX = 2 * 1024 * 1024;      // 2MB 쯤에서 민다
let _logBytes = null;                 // 지금 몇 바이트인가. 한 번만 재고 더해 간다

// 파일에 못 적었다고 **한 번** 말했나 (아래 `addLog`)
let _logWriteFailed = false;

function _rollIfBig(adding) {
  if (_logBytes === null) {
    try { _logBytes = fs.statSync(LOG_PATH).size; } catch { _logBytes = 0; }
  }
  _logBytes += adding;
  if (_logBytes < LOG_MAX) return;
  try {
    // 옛 한 벌은 버린다. 안 버리면 윈도에서 rename 이 막힌다
    try { fs.unlinkSync(LOG_PATH + '.1'); } catch { /* 없으면 그만 */ }
    fs.renameSync(LOG_PATH, LOG_PATH + '.1');
    _logBytes = adding;
  } catch (err) {
    // 못 밀어도 **로그는 계속 쌓는다.** 밀기에 실패했다고 기록을 멈추면 안 된다
    console.error('[security] 로그를 밀지 못했습니다:', err.message);
    _logBytes = 0;                    // 다시 재게 둔다
  }
}

// ── 램에 든 것만 보여주고 있었다 ── (2026-10-02)
//
// `/logs` 는 `securityLogs`(램)만 돌려줬다. 그런데 그 목록은 **서버가 다시 뜨면
// 사라진다.** 화면에 그렇게 적어두긴 했지만, 배포하면 Render 무료 판은 **조용하면
// 잠들었다 깨므로** 실질적으로 거의 아무것도 안 남는다 — 관리자가 들어가면 언제나
// 「기록이 없습니다」를 보게 된다. 10/14 에 배포하면 그 길로 간다.
//
// **파일에는 처음부터 다 남고 있었다**(`security.log`, 10/1 에 2MB 에서 미는 것까지
// 붙였다). 읽는 데만 없었다 — 보내는 쪽 · 받는 쪽 · 비우는 쪽은 있는데 **보는 쪽이
// 없던** 화면 오류와 같은 모양이다.
//
// ── 파일이 램의 윗집합이다 ──
//
// 모든 `addLog` 는 파일에도 쓴다. 그래서 파일을 읽으면 램에 든 것까지 다 들어 있다 —
// 다만 파일 쓰기는 **비동기**라 방금 쓴 한두 줄이 아직 디스크에 없을 수 있다.
// 그래서 **둘을 합치고 같은 줄을 접는다.**
//
// 통째로 읽지 않는다. 2MB 를 매번 다 읽어 쪼개면 그 자체가 느린 길이 된다 —
// **꼬리만** 읽는다(최근 100건을 고르는 데 넉넉하다).
const LOG_TAIL_BYTES = 256 * 1024;
const LOG_LINE = /^\[([^\]]+)\] \[([^\]]+)\] ([\s\S]*)$/;

/** 파일 끝에서 `bytes` 만큼. 앞이 잘린 반 토막 줄은 버린다. */
function readTail(file, bytes) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const size = fs.fstatSync(fd).size;
    if (!size) return '';
    const start = Math.max(0, size - bytes);
    const buf = Buffer.alloc(size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    const text = buf.toString('utf8');
    // 가운데서 자르면 **글자 하나가 반 토막** 날 수 있다. 첫 줄을 버리면 같이 사라진다
    if (start === 0) return text;
    const nl = text.indexOf('\n');
    return nl === -1 ? '' : text.slice(nl + 1);
  } catch {
    return '';      // 파일이 없거나 못 읽는다 — 램에 든 것만으로 간다
  } finally {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch { /* 이미 닫혔다 */ } }
  }
}

/** 파일에 적힌 줄을 `addLog` 가 만드는 모양으로 되돌린다. 못 읽는 줄은 버린다. */
function readLogFile() {
  // 민 뒤라 지금 파일이 짧을 수 있다 — 옛 한 벌(`.1`)을 **앞에** 붙인다
  const text = readTail(LOG_PATH + '.1', LOG_TAIL_BYTES) + readTail(LOG_PATH, LOG_TAIL_BYTES);
  const out = [];
  for (const line of text.split('\n')) {
    const m = line.match(LOG_LINE);
    if (!m) continue;               // 여러 줄로 적힌 detail 의 뒷줄 등
    out.push({ type: m[2], detail: m[3], timestamp: m[1] });
  }
  return out;
}

// ── 어디에 남기나 ── (2026-10-22 에 한 곳 더 늘렸다)
//
// 램 · 파일 · **DB** 셋이다. 램은 빠르고, 파일은 내 컴퓨터에서 꼬리를 보기 좋고,
// **DB 만 재시작을 넘긴다.**
//
// 10/02 에 「램에 든 것만 보여주던」 것을 고치며 파일을 읽게 했다. 그 까닭이
// 「서버가 다시 뜨면 사라진다」였는데 — **배포본에서는 파일도 같이 사라진다.**
// Render 무료 판은 디스크를 못 붙인다(`storage.js` 머리글. 그래서 10/14 에 DB 를
// Postgres 로 옮겼다). 즉 이 고침이 **운영에서는 아직 듣지 않고 있었다** —
// 관리자가 들어갈 때마다 「기록이 없습니다」를 본다.
//
// 이제 **데이터가 사는 곳에** 같이 적는다. 파일 모드면 blackiron.json, 배포본이면
// Postgres 로 간다 — 이 자리는 그것을 몰라도 된다.
function addLog(type, detail) {
  const entry = {
    type,
    detail,
    timestamp: new Date().toISOString(),
  };
  securityLogs.push(entry);
  if (securityLogs.length > 1000) securityLogs.shift();
  // **재시작을 넘는 한 벌.** 적다 터져도 기록은 멈추지 않는다 — 여기서 던지면
  // 로그인 · 가입 같은 길이 통째로 500 이 된다 (기록은 곁일이다)
  try { db.addSecurityLog(entry); } catch (err) {
    console.error('[security] 기록을 DB 에 남기지 못했습니다:', err.message);
  }
  // 파일에도 기록 (비동기)
  const line = `[${entry.timestamp}] [${type}] ${detail}\n`;
  _rollIfBig(Buffer.byteLength(line));
  fs.appendFile(LOG_PATH, line, (err) => {
    // **못 적으면 한 번은 말한다** (2026-10-26). 여태 `() => {}` 로 통째로 삼켰다 —
    // 디스크가 읽기 전용이거나 차면 그날부터 파일은 멈춘 채 남는데 아무도 모른다.
    // 화면은 「기록 파일에서 같이 읽어요」라고 적어두고 있고, 위의 `recentLogs` 는
    // 그 뒤처진 파일을 읽는다. 줄마다 떠들면 로그가 로그를 밀어내니 **처음 한 번만**
    if (!err || _logWriteFailed) return;
    _logWriteFailed = true;
    console.error('[security] 기록 파일에 못 적습니다 (DB 에는 남습니다):', err.message);
  });
}

// GET /api/security/dashboard - 보안 대시보드
router.get('/dashboard', adminAuth, (req, res) => {
  const users = db.getAllUsers();
  // **UTC 로 세면 안 된다.** 서버는 UTC 로 도는데 보는 사람은 한국에 있다 —
  // 한국 시간 자정부터 오전 9시까지 가입한 사람이 「오늘 가입」에서 빠졌다
  const today = seoulDay(Date.now());
  const todaySignups = users.filter(u => u.created_at && seoulDay(u.created_at) === today).length;

  // 화면(SecurityPanel)이 읽는 모양 그대로 돌려준다.
  //
  // 예전에는 여기서 jwtAccessExpiresIn · helmetEnabled · corsOrigin 처럼 평평한 이름으로
  // 보냈는데 화면은 jwt.expiry · helmet.enabled · cors.origins 를 읽었다. 그래서 대시보드가
  // JWT 만료를 빈칸으로, Helmet 을 '비활성화 · 위험' 으로 (실제로는 켜져 있는데) 보여줬다.
  // 숫자도 손으로 적어둔 값이라 실제와 달랐다 — 이제 config/security.js 를 읽는다.
  res.json({
    totalUsers: users.length,
    todaySignups,
    jwt: {
      expiry: JWT.accessExpiry,
      refreshExpiry: JWT.refreshExpiry,
      algorithm: JWT.algorithm,
    },
    rateLimit: RATE_LIMITS,
    bcryptRounds: BCRYPT_ROUNDS,
    helmet: { enabled: true },
    cors: { origins: (process.env.FRONTEND_URL || '').split(',').map(o => o.trim()).filter(Boolean) },
    bodyLimit: BODY_LIMIT,
    nodeVersion: process.version,
    // ── **깨워두기가 돌고 있는가** ── (2026-10-31)
    //
    // 무료 Render 는 15분 조용하면 잠들고, 깨는 데 **22초**다(10/15 실측).
    // 그걸 막는 자가 `utils/keepWarm.js` 인데 **돌고 있는지 밖에서 볼 길이 없었다** —
    // `BACKEND_URL` 이 빠지거나 `KEEP_WARM=0` 이 되면 조용히 멈추고, 그때 처음
    // 여는 사람만 22초를 기다린다. 아무도 모르는 채로.
    //
    // 오늘 하루 고친 것이 전부 그 모양이었다(**기능이 조용히 없는 것이 된다**).
    // 그래서 **관리자가 보는 자리에 적는다** — 지금 돌고 있나 · 어디를 두드리나 ·
    // 몇 분마다 · 시간대를 좁혀뒀나.
    keepWarm: {
      running: keepWarm.isRunning(),
      target: keepWarm.target(),
      everyMin: Math.round(keepWarm.TICK_MS / 60000),
      hours: String(process.env.KEEP_WARM_HOURS || '').trim() || null,
      // 꺼져 있으면 **왜인지** 적는다 — 「꺼짐」만 보면 고칠 데를 모른다
      why: keepWarm.isRunning() ? null
        : (process.env.KEEP_WARM === '0' ? 'KEEP_WARM=0 으로 꺼뒀습니다'
          : !keepWarm.target() ? 'BACKEND_URL 이 없거나 내 컴퓨터 주소입니다'
            : '아직 안 떴습니다'),
    },
  });
});

// GET /api/security/users - 전체 유저 목록 (password 제외)
router.get('/users', adminAuth, (req, res) => {
  const users = db.getAllUsers().map(({ password, ...rest }) => rest);
  res.json(users);
});

// GET /api/security/logs - 보안 로그 (최근 100건)
// 최근 100건. **램과 파일을 합쳐서** 본다 (위의 「램에 든 것만」 참고).
//
// 돌려주는 모양은 **배열 그대로** 둔다. 화면은 이것을 배열로 받아 쓴다 —
// 예전에 객체로 바꿔 읽다가 **로그 100건이 와도 언제나 「없습니다」**였던 자리다.
const LOG_WANT = 100;

/**
 * 최근 기록 — 셋에서 모아 접고 세운다. **한 자리에만 적는다** (2026-10-24).
 *
 * `/logs` 가 하던 일인데 **보고서(`/report`)는 램만 보고 있었다**(`securityLogs`).
 * 배포본에서 램은 거의 늘 비어 있다 — 조용하면 잠들었다 깨므로. 그래서 「최근 보안
 * 로그」 칸이 **언제나 텅 비어 있었고**, 비어 있는 목록은 「조용했다」로 읽힌다.
 * 10/02 에 `/logs` 에서 고친 바로 그 모양이 이쪽에 그대로 남아 있었다.
 *
 * **DB 가 먼저다** — 재시작을 넘은 것이 그쪽에 있다. 파일과 램은 그 위에 얹는다.
 * 셋 중 어디에 있어도 한 번만 보인다.
 */
function recentLogs(limit) {
  let fromDb = [];
  try { fromDb = db.getSecurityLogs(); } catch { /* DB 를 못 읽으면 나머지로 간다 */ }
  const merged = [...fromDb, ...readLogFile(), ...securityLogs];
  // ── **세운 다음에 센다** ── (2026-10-26)
  //
  // 여태 뒤에서부터 100건을 세고(= 출처 순) 그 100건만 세웠다. 출처 순은 「새 것
  // 순」이 아니다 — **파일이 뒤처져 있으면 100칸이 파일의 옛 줄로 다 차고, DB 에만
  // 있는 새 줄은 한 건도 안 나온다.** 관리자 화면은 그때 옛 기록을 보여주면서
  // 오늘 일을 숨긴다. 비어 있는 것보다 나쁘다 — 빈 목록은 못 받은 것으로 읽히지만,
  // 옛 목록은 **「조용했구나」로 읽힌다.**
  //
  // 파일은 뒤처질 수 있다. 쓰기가 비동기이고 **실패를 삼킨다**(아래 `addLog`) —
  // 디스크가 읽기 전용이거나 차면 그날부터 파일은 멈춘 채 남는다.
  //
  // 적힌 때는 ISO 라 글자 차례가 곧 시간 차례다. 셋을 합쳐도 몇백 줄이라
  // (DB 500 · 파일 꼬리 · 램 1000) 한 번 세우는 값은 싸다.
  merged.sort((a, b) => String(b?.timestamp || '').localeCompare(String(a?.timestamp || '')));
  // 같은 줄은 접는다 — 파일에도 있고 램에도 있는 것이 대부분이다
  const seen = new Set();
  const out = [];
  for (const e of merged) {
    if (out.length >= limit) break;
    const key = `${e.timestamp}|${e.type}|${e.detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

router.get('/logs', adminAuth, (req, res) => {
  res.json(recentLogs(LOG_WANT));
});

// POST /api/security/block-user/:id - 유저 차단
router.post('/block-user/:id', adminAuth, (req, res) => {
  const id = Number(req.params.id);
  const user = db.findUserById(id);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없어요' });
  if (user.role === 'admin') return res.status(400).json({ error: '관리자는 차단할 수 없어요' });

  db.updateUserRole(id, 'blocked');
  addLog('block', `유저 차단: id=${id}, email=${user.email}`);
  res.json({ message: '유저가 차단되었어요' });
});

// POST /api/security/unblock-user/:id - 유저 차단 해제
//
// 차단된 사람만 푼다.
//
// 예전에는 누구에게 걸든 역할을 'user' 로 덮어썼다. 관리자에게 실수로 누르면
// 그 자리에서 관리자 권한이 사라진다 — revoke-admin 에는 자기 자신을 지키는 장치가
// 있는데 이쪽으로는 그냥 통과했다. 관리자가 한 명이면 서비스가 통째로 잠긴다.
router.post('/unblock-user/:id', adminAuth, (req, res) => {
  const id = Number(req.params.id);
  const user = db.findUserById(id);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없어요' });
  if (user.role !== 'blocked') {
    return res.status(400).json({ error: '차단된 사용자가 아니에요' });
  }

  db.updateUserRole(id, 'user');
  addLog('unblock', `유저 차단 해제: id=${id}, email=${user.email}`);
  res.json({ message: '유저 차단이 해제되었어요' });
});

// POST /api/security/unban/:id — **영구 정지를 되돌린다** (2026-10-22)
//
// 자동 판정(`aiGuard` 의 LEVEL 4)은 네 가지를 한다 — 영구 정지 기록 · 로그인 차단 ·
// 블랙리스트(이메일 + 주소) · 주소 영구 잠금. 그 함수 머리글에는 **「데이터는 남긴다 —
// 오판이면 되돌려야 한다」**고 적혀 있다. 그런데 **되돌리는 길이 넷 중 하나뿐이었다**
// (주소 잠금만 「AI 차단 해제」로 풀렸다). 나머지 셋은 푸는 함수가 DB 에 있는데
// **아무도 안 불렀다** — 세어봤다: 거는 자리 2~5, 푸는 자리 0.
//
// 그래서 오판으로 걸린 사람은 기록은 남은 채 **영원히 못 들어오고**, 관리자도 풀 수가
// 없었다. 그 사람에게 할 수 있는 관리자 동작은 **지우기뿐**이었다(아래 `DELETE`).
// 방향이 거꾸로다 — 되돌릴 수 있어야 할 자리에 삭제만 있었다.
//
// **넷을 한 번에 되돌린다.** 하나만 풀면 다른 셋이 남아 「풀었는데 여전히 못
// 들어온다」가 된다 — 그게 제일 나쁜 꼴이다(관리자는 풀었다고 믿는다).
router.post('/unban/:id', adminAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '잘못된 ID에요' });
  const user = db.findUserById(id);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없어요' });

  const r = db.unbanUser(id);
  if (!r) return res.status(404).json({ error: '사용자를 찾을 수 없어요' });

  // **주소 잠금도 같이 푼다.** 블랙리스트에서 뺀 주소가 램과 파일에 잠긴 채 남으면
  // 그 사람은 여전히 못 들어온다 (`aiGuard.unblockIP` 가 둘 다 지운다)
  let unlocked = 0;
  for (const ip of r.ips) {
    try { if (aiGuard.unblockIP(ip)) unlocked += 1; } catch { /* 못 풀어도 나머지는 푼다 */ }
  }

  // 아무것도 안 걸려 있었으면 그렇게 말한다 — 「풀었습니다」라고만 하면
  // 관리자는 무언가를 되돌렸다고 믿는다
  const did = (r.wasBanned ? 1 : 0) + r.lifted + r.blacklist + unlocked;
  if (did === 0) {
    return res.status(400).json({ error: '이 사람에게 걸린 영구 정지가 없어요' });
  }

  addLog('unban', `영구 정지 해제: id=${id}, email=${user.email} `
    + `(정지기록 ${r.lifted} · 블랙리스트 ${r.blacklist} · 주소잠금 ${unlocked})`);
  res.json({
    message: '영구 정지를 풀었어요. 이 사람은 다시 로그인할 수 있어요',
    lifted: r.lifted,
    blacklist: r.blacklist,
    unlockedIps: unlocked,
  });
});

// DELETE /api/security/blacklist/:id — **한 줄을 뺀다** (2026-10-26)
//
// ── 또 거는 자리 2 : 푸는 자리 0 ──
//
// 10/22 에 영구 정지를 되돌리는 길(`POST /unban/:id`)을 냈다. 그 주석에 **「블랙리스트
// 거는 자리 2 · 푸는 자리 0 (`removeBlacklist` 도 아무도 안 부른다)」**고 적어두고 —
// 고친 뒤에도 `db.removeBlacklist` 를 **부르는 자리는 그대로 0** 이었다. 넷을 한 번에
// 되돌리는 길은 `removeBlacklistFor`(사람 단위)를 쓰기 때문이다.
//
// 그래서 **사람이 없어지면 그 줄을 뺄 길이 없다.** 계정을 지우면(`DELETE /user/:id` —
// 10/22 전까지 관리자가 그 사람에게 할 수 있는 유일한 일이었다) 블랙리스트 줄은
// `blacklist` 가 `USER_COLLECTIONS` 에 없어서 **주인 없이 남고**, `unbanUser` 는
// 「사용자를 찾을 수 없어요」로 404 다. 관리자 화면은 그 줄을 **보여주기만** 했다.
//
// 그 줄이 `ip` 면 **그 주소에서는 아무도 가입할 수 없다**(`isBlacklisted` 는 가입 길에서
// 본다). 이 앱에서 주소는 사람 하나가 아니다 — 통신사 NAT · 헬스장 와이파이 뒤의
// 모두가 영구히 막히고, 푸는 길이 없다. 같은 파일의 LEVEL 4 주석이 **대역 차단을 스스로
// 금지해 둔** 것과 같은 이유다.
//
// **지우는 것이 아니라 푸는 것이다** — 계정을 지울 때 이 줄을 같이 지우지는 않는다.
// 그러면 막아둔 사람이 그 자리에서 다시 가입할 수 있다. 사람이 보고 한 줄씩 푼다.
router.delete('/blacklist/:id', adminAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '잘못된 ID에요' });
  // 무엇을 풀었는지 기록에 남긴다 — 지운 뒤에는 값을 알 길이 없다
  const row = db.getBlacklist().find((b) => b.id === id);
  const result = db.removeBlacklist(id);
  if (result.changes === 0) return res.status(404).json({ error: '그 줄을 찾을 수 없어요' });
  addLog('unblock', `블랙리스트 해제: ${row?.type || '?'}=${row?.value || '?'}`
    + (row?.user_id ? ` (userId=${row.user_id})` : '') + ` — 관리자 ${req.userId}`);
  res.json({ message: '막아둔 것을 풀었어요', type: row?.type || null, value: row?.value || null });
});

// DELETE /api/security/user/:id - 계정과 모든 데이터를 지운다
//
// 되돌릴 수 없다. 그래서 자동 판정에서는 절대 부르지 않는다 —
// 예전에는 AI Guard 가 이걸 직접 불렀고, 판정이 틀리면 몇 년치 운동 기록이 사라졌다.
// 그 경로를 없애면서 대신 여기를 열었다. 사람이 보고, 사람이 지운다.
//
// 세 가지를 요구한다.
//   1. 관리자는 못 지운다
//   2. 이미 막혀 있는 사람만 지울 수 있다 (영구 정지 · is_banned · 차단)
//      — 목록에서 잘못 눌러 멀쩡한 사람이 사라지는 일이 없어야 한다
//   3. 지울 대상의 이메일을 본문에 그대로 적어야 한다 — 누구를 지우는지 보고 누르게
router.delete('/user/:id', adminAuth, (req, res) => {
  const id = Number(req.params.id);
  const user = db.findUserById(id);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없어요' });
  if (user.role === 'admin') return res.status(400).json({ error: '관리자는 지울 수 없어요' });

  const blocked = user.role === 'blocked' || user.is_banned ||
    db.getSuspension(id)?.expires_at === 'permanent';
  if (!blocked) {
    return res.status(400).json({
      error: '먼저 차단하거나 영구 정지한 뒤에 지울 수 있어요',
    });
  }

  if (String(req.body?.confirmEmail || '').trim().toLowerCase() !== String(user.email).toLowerCase()) {
    return res.status(400).json({ error: '지울 계정의 이메일을 정확히 적어주세요' });
  }

  db.deleteUserCompletely(id);
  addLog('CRITICAL', `계정 완전 삭제 (관리자 ${req.userId} → userId=${id}, ${user.email})`);
  res.json({ message: '계정과 기록을 모두 지웠어요' });
});

// POST /api/security/make-admin/:id - 관리자 권한 부여
router.post('/make-admin/:id', adminAuth, (req, res) => {
  const id = Number(req.params.id);
  const user = db.findUserById(id);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없어요' });

  db.updateUserRole(id, 'admin');
  addLog('make-admin', `관리자 권한 부여: id=${id}, email=${user.email}`);
  res.json({ message: '관리자 권한이 부여되었어요' });
});

// POST /api/security/revoke-admin/:id - 관리자 권한 해제
router.post('/revoke-admin/:id', adminAuth, (req, res) => {
  const id = Number(req.params.id);
  const user = db.findUserById(id);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없어요' });
  if (user.id === req.userId) return res.status(400).json({ error: '자신의 관리자 권한은 해제할 수 없어요' });
  // 마지막 관리자를 내리면 아무도 관리자 화면에 못 들어간다.
  // 자기 자신만 막아두면 관리자 둘이 서로를 내리는 길이 남는다
  if (db.getAllUsers().filter(u => u.role === 'admin').length <= 1) {
    return res.status(400).json({ error: '관리자가 한 명뿐이라 해제할 수 없어요' });
  }

  db.updateUserRole(id, 'user');
  addLog('revoke-admin', `관리자 권한 해제: id=${id}, email=${user.email}`);
  res.json({ message: '관리자 권한이 해제되었어요' });
});

// 이 프로세스가 뜬 시각. AI 관리자 화면의 숫자들이 **언제부터 센 것인지**를 말해준다 —
// 그 숫자는 전부 램에 있어서 서버가 다시 뜨면 0 부터 다시 센다
const START_AT = new Date().toISOString();

// ── AI Guard 엔드포인트 ──

// GET /api/security/ai-dashboard - AI 관리 현황 (강화)
router.get('/ai-dashboard', adminAuth, (req, res) => {
  const stats = aiGuard.getStats();
  const blockedIPsRaw = aiGuard.getBlockedIPs();
  const aiLogs = aiGuard.getAiLogs();
  const suspensions = db.getSuspensions();
  const blacklist = db.getBlacklist();
  const users = db.getAllUsers();

  // blocked IPs를 배열로 변환 + 남은 시간 계산
  const now = Date.now();
  const blockedIps = Object.entries(blockedIPsRaw).map(([ip, info]) => ({
    ip,
    level: info.level,
    until: info.until,
    // 언제 막았는지는 파일에 있다. 예전에는 이 자리가 `new Date(now)` 라 **늘 지금**이었다 —
    // 어제 막은 것도 방금 막은 것으로 보였다
    blockedAt: db.findBlock(ip)?.created_at || null,
    remaining: info.until === 'permanent' ? 'permanent' : Math.max(0, Math.ceil((new Date(info.until).getTime() - now) / 60000)),
  }));

  // 로그를 표시용으로 변환
  const logs = aiLogs.slice(-100).reverse().map(l => ({
    type: l.type?.toLowerCase().includes('critical') ? 'block' :
          l.type?.toLowerCase().includes('warning') ? 'warning' :
          l.type?.toLowerCase().includes('alert') ? 'suspicious' :
          l.type?.toLowerCase().includes('info') ? 'warning' : 'system',
    time: l.timestamp,
    message: l.message,
    ip: l.ip,
    userId: l.userId,
  }));

  // 위협 통계
  const threats = {
    ...stats.threats,
    blockedIpCount: blockedIps.length,
    todayWarnings: stats.threats.level2,
    suspiciousIpCount: stats.suspiciousIPs?.length || 0,
    totalSuspensions: suspensions.length,
    activeSuspensions: suspensions.filter(s => s.expires_at === 'permanent' || s.expires_at > new Date().toISOString()).length,
    blacklistEntries: blacklist.length,
    bannedUsers: users.filter(u => u.is_banned).length,
    blockedUsers: users.filter(u => u.role === 'blocked').length,
  };

  res.json({
    // 화면이 **손으로 적어두던 규칙**을 서버가 준다.
    //
    // 예전 화면에는 열한 줄이 박혀 있었는데 **숫자가 실제와 달랐다** — 대량 요청은
    // 「15/30/50회」라고 적혀 있었지만 200/300/500 이었고, 로그인 실패는 「3/5/10회」였지만
    // 7/10/20 이었다. 이미 없앤 SQL·몽고 인젝션도 그대로 적혀 있었다.
    // **틀린 방어 규칙을 보고 판단하는 것이 규칙을 모르는 것보다 나쁘다.**
    policy: aiGuard.policy(),
    // 이 서버가 언제 떴는지. 아래 숫자들은 **그때부터 센 것**이라 이게 없으면
    // 「총 요청 12건」이 하루치인지 방금 뜬 뒤 1분치인지 알 수가 없다
    since: START_AT,
    // 지금 막혀 있는 것 (파일에 남는다 — 재시작해도 그대로)
    shield: {
      blocks: db.listBlocks().length,
      loginLocks: db.listLoginLocks().length,
    },
    stats: {
      totalRequests: stats.totalRequests,
      totalBlocks: stats.blockedRequests,
      totalWarnings: stats.threats.level2,
      activeLocks: stats.activeLocks,
      requestTracking: stats.requestTracking,
      loginFailureTracking: stats.loginFailureTracking,
      spamTracking: stats.spamTracking,
    },
    threats,
    blockedIps,
    logs,
    blacklist: blacklist.slice(-20),
    suspensions: suspensions.slice(-20).reverse(),
  });
});

// GET /api/security/shield — **지금 막혀 있는 것**.
//
// 「해킹 보안」 화면이 그동안 보여준 것은 **로그뿐**이었다. 로그는 서버 메모리에 쌓이고
// 재시작하면 사라지는 「무슨 일이 있었나」다. 정작 **지금 누가 막혀 있는가**는 어느
// 화면에도 없었다 — 풀어달라는 사람이 와도 관리자가 볼 자리가 없었다.
//
// 여기서 주는 것은 로그와 반대로 **파일에 남는 것**이다. 서버가 다시 떠도 그대로다.
router.get('/shield', adminAuth, (req, res) => {
  const now = Date.now();
  const blocks = db.listBlocks().map(b => ({
    ip: b.ip,
    level: b.level,
    reason: b.reason,
    until: b.until,
    createdAt: b.created_at,
    // 남은 분. 영구면 null 이다 — 0 으로 주면 화면이 「곧 풀림」으로 읽는다
    remaining: b.until === 'forever' ? null : Math.max(0, Math.ceil((new Date(b.until).getTime() - now) / 60000)),
  }));

  // 로그인 잠금. 열쇠가 'acct:<친 아이디>' 또는 'ip:<주소>' 다.
  // **친 아이디는 있는 계정이 아닐 수도 있다** — 열쇠를 계정이 아니라 친 말로 만들기
  // 때문이다(있는 계정만 429 가 되면 그 차이가 아이디 확인 답이 된다)
  const loginLocks = db.listLoginLocks().map(r => ({
    key: r.key,
    kind: r.key.startsWith('acct:') ? 'account' : 'ip',
    target: r.key.slice(r.key.indexOf(':') + 1),
    count: r.count,
    until: new Date(r.until).toISOString(),
    remaining: Math.max(0, Math.ceil((r.until - now) / 60000)),
  }));

  res.json({ blocks, loginLocks });
});

// POST /api/security/unlock-login — 잠긴 로그인을 풀어준다.
//
// 계정 잠금은 **남이 일부러 걸 수 있다** (그 사람 아이디로 열 번 틀리면 된다).
// 15분이면 저절로 풀리지만, 기다리는 사람에게는 그 15분이 길다
router.post('/unlock-login', adminAuth, (req, res) => {
  const { key } = req.body || {};
  if (!key || typeof key !== 'string') return res.status(400).json({ error: '무엇을 풀지 알려주세요' });
  if (!key.startsWith('acct:') && !key.startsWith('ip:')) {
    return res.status(400).json({ error: '알 수 없는 잠금이에요' });
  }
  db.clearLoginFail(key);
  db.flushNow();
  addLog('login-unlock', `로그인 잠금 해제: ${key}`);
  res.json({ message: '잠금을 풀었어요' });
});

// IP 형식 검증
function isValidIP(ip) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) || /^[a-fA-F0-9:]+$/.test(ip) || ip === '::1';
}

// POST /api/security/ai-unblock/:ip - IP 차단 해제
router.post('/ai-unblock/:ip', adminAuth, (req, res) => {
  const ip = req.params.ip;
  if (!isValidIP(ip)) return res.status(400).json({ error: '올바른 IP 형식이 아니에요' });
  const result = aiGuard.unblockIP(ip);
  if (result) {
    addLog('ai-unblock', `AI Guard IP 차단 해제: ${ip}`);
    res.json({ message: `${ip} 차단이 해제되었어요` });
  } else {
    res.status(404).json({ error: '해당 IP는 차단 목록에 없어요' });
  }
});

// 수동 차단의 길이 (분). **이름을 준다** (2026-10-31) — `525600` 이 생글자로
// 박혀 있었고 **화면 칸에는 `max` 가 없어서**, 관리자가 큰 수를 적으면 누른
// 다음에야 「차단 시간은 1분~365일 범위여야 해요」를 들었다.
// 화면도 같은 이름으로 막는다 (`data/limits.js` · `npm run twins` 가 값을 견준다)
const BLOCK_MIN_MAX = 525600;

// POST /api/security/ai-block - IP 수동 차단
router.post('/ai-block', adminAuth, (req, res) => {
  const { ip, minutes } = req.body;
  if (!ip || !minutes) {
    return res.status(400).json({ error: 'ip와 minutes를 입력해주세요' });
  }
  if (!isValidIP(ip)) return res.status(400).json({ error: '올바른 IP 형식이 아니에요' });
  if (isNaN(Number(minutes)) || Number(minutes) <= 0 || Number(minutes) > BLOCK_MIN_MAX) {
    return res.status(400).json({ error: '차단 시간은 1분~365일 범위여야 해요' });
  }
  // 사설 주소는 사람이 아니라 프록시다 — 막으면 그 홉을 지나는 사람이 전부 걸린다
  // (2026-10-15, aiGuard 의 isPrivateIp 주석 참고). 조용히 거르면 「차단되었어요」라고
  // 말해놓고 아무 일도 안 한 것이 되므로 여기서 까닭까지 알려준다
  if (aiGuard.isPrivateIp(ip)) {
    return res.status(400).json({
      error: '내부(사설) 주소는 막을 수 없어요. 프록시 주소라서 막으면 다른 사람까지 함께 막힙니다',
    });
  }
  const blockedUntil = aiGuard.manualBlock(ip, Number(minutes));
  addLog('ai-block', `AI Guard IP 수동 차단: ${ip} (${minutes}분)`);
  res.json({ message: `${ip}가 ${minutes}분간 차단되었어요`, blockedUntil });
});

// ── 자동 보안 검사 시스템 ──

// POST /api/security/scan - 서버 자체 보안 검사 실행 (관리자 전용)
router.post('/scan', adminAuth, async (req, res) => {
  const results = [];
  const pass = (cat, name) => results.push({ category: cat, name, status: 'SAFE', severity: null });
  const fail = (cat, name, sev, detail) => results.push({ category: cat, name, status: 'VULN', severity: sev, detail });

  // 1. 환경변수 검사
  const cat1 = 'ENV';
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) pass(cat1, 'JWT_SECRET 강도');
  else fail(cat1, 'JWT_SECRET 강도', 'CRITICAL', '32자 미만');
  if (process.env.NODE_ENV === 'production') pass(cat1, 'NODE_ENV=production');
  else fail(cat1, 'NODE_ENV', 'HIGH', 'production이 아님: ' + process.env.NODE_ENV);
  if (process.env.ADMIN_EMAIL) pass(cat1, 'ADMIN_EMAIL 설정');
  else fail(cat1, 'ADMIN_EMAIL', 'MEDIUM', '미설정');

  // 2. DB 무결성
  const cat2 = 'DB';
  const users = db.getAllUsers();
  const noPassword = users.filter(u => !u.password);
  if (noPassword.length === 0) pass(cat2, '모든 유저 비밀번호 해시 존재');
  else fail(cat2, '비밀번호 누락', 'CRITICAL', noPassword.length + '명');
  // **대소문자를 가리지 않고 본다.** 앱이 이미 그렇게 다룬다 (`db.emailKey`) —
  // 예전에 `Kevin@x.com` 과 `kevin@x.com` 이 각각 가입돼 같은 사람의 기록이 갈린 적이 있다.
  // 그걸 잡으라고 있는 검사가 정작 대소문자만 다르면 못 잡고 있었다
  const emailKey = (e) => String(e || '').trim().toLowerCase();
  const duplicateEmails = users.filter((u, i) => users.findIndex(x => emailKey(x.email) === emailKey(u.email)) !== i);
  if (duplicateEmails.length === 0) pass(cat2, '이메일 중복 없음');
  else fail(cat2, '이메일 중복', 'HIGH', duplicateEmails.map(u => u.email).join(', '));
  const admins = users.filter(u => u.role === 'admin');
  if (admins.length > 0 && admins.length <= 3) pass(cat2, '관리자 수 적절 (' + admins.length + '명)');
  else if (admins.length === 0) fail(cat2, '관리자 없음', 'HIGH', '관리자가 0명');
  else fail(cat2, '관리자 과다', 'MEDIUM', admins.length + '명');

  // 3. 보안 헤더
  const cat3 = 'HEADERS';
  const http = require('http');
  const headerCheck = await new Promise(resolve => {
    http.get('http://localhost:' + (process.env.PORT || 4000) + '/api/health', r => {
      resolve(r.headers);
    }).on('error', () => resolve({}));
  });
  if (!headerCheck['x-powered-by']) pass(cat3, 'X-Powered-By 숨김');
  else fail(cat3, 'X-Powered-By 노출', 'MEDIUM', headerCheck['x-powered-by']);
  if (headerCheck['strict-transport-security']) pass(cat3, 'HSTS 활성');
  else fail(cat3, 'HSTS 미설정', 'HIGH', '미설정');
  if (headerCheck['x-content-type-options'] === 'nosniff') pass(cat3, 'X-Content-Type-Options');
  else fail(cat3, 'X-Content-Type-Options', 'MEDIUM', '미설정');
  if (headerCheck['x-frame-options']) pass(cat3, 'X-Frame-Options');
  else fail(cat3, 'X-Frame-Options', 'MEDIUM', '미설정');
  if (headerCheck['referrer-policy']) pass(cat3, 'Referrer-Policy');
  else fail(cat3, 'Referrer-Policy', 'LOW', '미설정');
  // 아래 둘은 안 보고 있었다. CSP 는 XSS 를 막는 마지막 벽이고,
  // Permissions-Policy 는 8/27 까지 **적혀만 있고 안 나가던** 헤더다 — 그래서 더 봐야 한다
  if (headerCheck['content-security-policy']) pass(cat3, 'Content-Security-Policy');
  else fail(cat3, 'Content-Security-Policy', 'HIGH', '미설정');
  if (headerCheck['permissions-policy']) pass(cat3, 'Permissions-Policy');
  else fail(cat3, 'Permissions-Policy', 'LOW', '미설정');

  // 4. AI Guard 상태
  const cat4 = 'AI_GUARD';
  const stats = aiGuard.getStats();
  pass(cat4, '요청 처리: ' + stats.totalRequests + '건');
  pass(cat4, '차단: ' + stats.blockedRequests + '건');
  if (stats.activeLocks > 0) pass(cat4, '활성 IP 잠금: ' + stats.activeLocks + '건');
  else pass(cat4, '활성 IP 잠금 없음');
  if (stats.threats.level4 > 0) fail(cat4, 'LEVEL4 위협 감지됨', 'CRITICAL', stats.threats.level4 + '건');
  else pass(cat4, 'LEVEL4 위협 없음');

  // 5. XSS 필터 검증
  //
  // **이 검사는 등급을 늘 F 로 만들고 있었다** (2026-10-22). 새니타이즈는
  // `<script>alert(1)</script>` 를 `script1)/script` 로 만든다. 꺾쇠도 `alert(` 도
  // 지워져 **어디에 꽂아도 실행되지 않는 글자**인데, 검사 패턴이 `/script|alert/i`
  // 라서 남은 글자 "script" 에 제가 걸렸다. CRITICAL 하나 → `grade === 'F'` —
  // 관리자 화면의 보안 등급이 **처음부터 F 였다.**
  //
  // 거짓 경보가 섞인 등급은 아무도 안 본다. 그래서 묻는 것을 바꿨다 —
  // 「위험한 낱말이 남았나」가 아니라 **「실행될 수 있는 모양이 남았나」**.
  // 실행에 필요한 것은 꺾쇠(태그) · `on___=`(핸들러) · `javascript:`(스킴) ·
  // 호출 괄호가 붙은 `eval(` `alert(` `expression(` 이다. 평문 "script" 는 위험이 아니다.
  const cat5 = 'XSS_FILTER';
  const { sanitize } = require('../utils/sanitize');
  // 새니타이즈를 지나고도 **남아 있으면 안 되는** 모양
  const EXECUTABLE = /[<>"'`]|\bon\w+\s*=|(?:java|vb)script\s*:|(?:eval|alert|expression)\s*\(/i;
  const xssTests = [
    '<script>alert(1)</script>',
    '<img onerror=alert(1)>',
    'javascript:alert(1)',
    '<svg onload=alert(1)>',
    '<a onclick=alert(1)>',
    // 아래 둘은 적혀 있던 다섯이 못 보던 우회다 — 이중 인코딩과 대소문자 섞기
    '%3Cscript%3Ealert(1)%3C/script%3E',
    '<IMG SRC=x OnErRoR=alert(1)>',
  ];
  for (const input of xssTests) {
    const result = sanitize(input);
    if (!EXECUTABLE.test(result)) pass(cat5, 'XSS 차단: ' + input.substring(0, 25));
    else fail(cat5, 'XSS 통과', 'CRITICAL', input + ' → ' + result);
  }
  // 6. 인젝션 필터 검증
  //
  // **여기는 아무것도 재지 않고 있었다** (2026-10-22). 패턴을 셋 적어놓고 그걸
  // 쓰지 않은 채 for 안에서 무조건 `pass` 를 불렀다 — 필터를 통째로 떼어내도
  // SAFE 가 셋 찍힌다. 재는 척하는 검사는 없는 검사보다 나쁘다.
  //
  // 게다가 적혀 있던 셋은 **이 앱에 없는 공격**이었다. SQL 도 MongoDB 도 없고
  // 저장소는 JSON 파일 하나다. 그래서 aiGuard 는 SQL·몽고 패턴을 일부러 안 본다
  // (오탐만 남아서다 — `middleware/aiGuard.js` 의 INJECTION_PATTERNS 주석).
  // 안 보는 것을 「감지 가능」이라 적던 셈이다.
  //
  // 실제로 막는 것 — **프로토타입 오염** — 을 aiGuard 의 판정에 그대로 넣어 본다.
  const cat6 = 'INJECTION';
  const injTests = [
    // 키로 들어오는 것 (JSON.parse 로 만들어야 진짜 `__proto__` 키가 된다)
    ['{"__proto__":{"admin":true}}', JSON.parse('{"__proto__":{"admin":true}}')],
    ['문자열 속 __proto__', '__proto__'],
    ['constructor[ 접근', 'constructor["prototype"]'],
    ['중첩된 키', { workout: { sets: [JSON.parse('{"__proto__":{"x":1}}')] } }],
  ];
  for (const [label, payload] of injTests) {
    const hit = aiGuard.inspect(payload);
    if (hit) pass(cat6, '인젝션 차단: ' + label);
    else fail(cat6, '인젝션 통과', 'CRITICAL', label + ' 를 aiGuard 가 못 잡는다');
  }
  // 안 보는 것은 **안 본다고 적는다.** SAFE 로 적으면 다음 사람이 믿고 만다
  pass(cat6, 'SQL·NoSQL 패턴은 보지 않음 (DB 가 없다 — JSON 파일 하나)');
  // 7. 파일 시스템 보안
  const cat7 = 'FILES';
  const fss = require('fs');
  const envPath = require('path').join(__dirname, '../../.env');
  // **배포본에는 `.env` 파일이 없다** (2026-10-22). Render 는 환경값을 프로세스에
  // 직접 넣어준다(`render.yaml` 의 envVars) — 파일을 쓰지 않는다. 그런데 이 검사는
  // 파일이 없으면 CRITICAL 을 매겼다. 즉 **운영 등급이 늘 F** 였다.
  // 파일이 없는 쪽이 오히려 안전하다 — 읽어 갈 파일이 없다.
  //
  // 봐야 하는 것은 파일이 아니라 **값이 들어왔는가**다. 값은 위의 ENV 검사가 본다.
  if (fss.existsSync(envPath)) {
    pass(cat7, '.env 파일 존재 (로컬)');
  } else if (process.env.JWT_SECRET) {
    pass(cat7, '.env 파일 없음 — 환경값이 프로세스에 직접 주입됨 (더 안전)');
  } else {
    fail(cat7, '환경값 없음', 'CRITICAL', '.env 파일도 없고 JWT_SECRET 도 비어 있다');
  }
  const gitignorePath = require('path').join(__dirname, '../../../.gitignore');
  // 없으면 pass 도 fail 도 없이 조용히 빠지고 있었다 — 검사가 사라져도 등급은 그대로다
  if (!fss.existsSync(gitignorePath)) {
    fail(cat7, '.gitignore 없음', 'HIGH', '.env · DB 파일이 커밋될 수 있다');
  } else {
    const gi = fss.readFileSync(gitignorePath, 'utf-8');
    if (gi.includes('.env')) pass(cat7, '.env가 .gitignore에 포함');
    else fail(cat7, '.env가 .gitignore에 없음', 'CRITICAL', '.env 커밋 위험');
    // **적어둔 말만큼 본다** (2026-10-24). 바로 위 「.gitignore 없음」의 까닭에
    // 「.env · **DB 파일**이 커밋될 수 있다」고 적어놓고 **DB 파일은 안 보고 있었다.**
    // 그 파일에는 회원 전부의 기록과 비밀번호 해시가 들어 있다 — 한 번 올라가면
    // 지워도 git 역사에 남는다. 이름은 `storage.js` 가 아는 그 둘이다
    const dbFiles = [storage.MAIN, storage.PHOTOS].map((n) => require('path').basename(n));
    const missing = dbFiles.filter((f) => !gi.includes(f));
    if (missing.length === 0) pass(cat7, 'DB 파일 두 장이 .gitignore에 포함');
    else fail(cat7, 'DB 파일이 .gitignore에 없음', 'CRITICAL', missing.join(' · ') + ' 커밋 위험');
  }
  // 결과 집계
  const safe = results.filter(r => r.status === 'SAFE').length;
  const vuln = results.filter(r => r.status === 'VULN').length;
  const critical = results.filter(r => r.severity === 'CRITICAL').length;
  const high = results.filter(r => r.severity === 'HIGH').length;

  const grade = critical > 0 ? 'F' : high > 0 ? 'C' : vuln > 0 ? 'B' : 'A';

  addLog('security-scan', `보안 검사 완료: ${safe}/${safe + vuln} SAFE, 등급 ${grade}`);

  res.json({
    grade,
    summary: { total: results.length, safe, vulnerable: vuln, critical, high },
    results,
    scannedAt: new Date().toISOString(),
  });
});

// GET /api/security/report - 보안 보고서 조회 (관리자 전용)
router.get('/report', adminAuth, (req, res) => {
  const stats = aiGuard.getStats();
  const users = db.getAllUsers();
  const suspensions = db.getSuspensions();
  const blacklist = db.getBlacklist();

  res.json({
    server: {
      nodeVersion: process.version,
      uptime: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
      env: process.env.NODE_ENV || 'development',
    },
    // ── 적어둔 값이 아니라 **지금 쓰는 값**을 보낸다 ── (2026-10-21)
    //
    // 여기 있던 숫자들은 **손으로 적어둔 것**이었다. 바로 아래 `permissionsPolicy` 가
    // 8/27 에 같은 까닭으로 고쳐진 자리다 — 「안 나가는 헤더를 있다고 적고 있었다」.
    // 그런데 이 뭉치는 그대로 남아서, 설정을 고치면 **화면만 옛 값을 말했다.**
    // 관리자 화면은 이것을 보고 판단하는 자리다. 틀린 숫자는 없는 것보다 나쁘다.
    auth: {
      jwtAlgorithm: JWT.algorithm,
      accessTokenExpiry: JWT.accessExpiry,
      refreshTokenExpiry: Math.round(JWT.refreshMs / 86400000) + 'd',
      bcryptRounds: BCRYPT_ROUNDS,
      csrfProtection: 'double-submit cookie',
      cookieFlags: 'httpOnly + secure(prod) + sameSite',
    },
    users: {
      total: users.length,
      admins: users.filter(u => u.role === 'admin').length,
      blocked: users.filter(u => u.role === 'blocked').length,
      banned: users.filter(u => u.is_banned).length,
    },
    threats: {
      ...stats.threats,
      totalBlocked: stats.blockedRequests,
      totalRequests: stats.totalRequests,
      blockRate: stats.totalRequests > 0 ? ((stats.blockedRequests / stats.totalRequests) * 100).toFixed(2) + '%' : '0%',
      activeLocks: stats.activeLocks,
      suspensions: suspensions.length,
      blacklistEntries: blacklist.length,
    },
    defense: {
      aiGuard: 'v2 (4-level threat system)',
      xssSanitize: 'HTML tags + event handlers + javascript URI',
      // 이 앱에는 SQL 도 몽고도 없다 — 저장소는 JSON 파일 하나다.
      // 없는 것을 노리는 패턴은 오탐만 냈다 (`---` 한 줄에 영구 정지). 8/27 에 걷어냈다
      sqlInjection: 'JSON 파일 DB — SQL 을 아예 안 쓴다',
      nosqlInjection: '몽고를 안 쓴다. 입력은 타입·범위로 검사한다',
      prototypePollution: 'JSON reviver + aiGuard scan',
      rateLimiting: `Global ${RATE_LIMITS.global.max}/${RATE_LIMITS.global.windowMs / 60000}min`
        + ` + Login ${RATE_LIMITS.login.max}/${RATE_LIMITS.login.windowMs / 60000}min`,
      botDetection: 'User-Agent pattern matching',
      csrfProtection: 'Double-submit cookie',
      // **여기가 틀려 있었다** — 「IP+email tracking + 5-attempt lock」이라고 적혀
      // 있었는데, 그 열쇠(IP+이메일)는 **고치기 전의 버그**다. IP 를 바꿔가며 한 계정을
      // 두들기면 카운터가 영영 안 찼다. 지금은 계정별 · 주소별로 따로 센다
      bruteForce: LOGIN_LOCK_DESC,
    },
    headers: {
      helmet: true,
      hsts: HSTS_MAX_AGE + 's',
      // CSP 도 `csp.js` 에서 받아 적는다 — 10/20 에 거기서 집 둘을 걷고 셋을 더했다
      csp: CSP_SUMMARY,
      xFrameOptions: 'SAMEORIGIN',
      xContentType: 'nosniff',
      referrerPolicy: 'strict-origin-when-cross-origin',
      // 화면이 「설정됨」이라고 읽는 자리다. 진짜로 나가는 값을 그대로 보낸다 —
      // 8/27 까지는 helmet 이 모르는 옵션이라 무시돼서, 안 나가는 헤더를 있다고 적고 있었다
      permissionsPolicy: PERMISSIONS_POLICY,
    },
    // **램만 보지 않는다** (2026-10-24) — 위 `recentLogs` 머리글에 까닭을 적어뒀다
    recentLogs: recentLogs(20),
  });
});

module.exports = router;
module.exports.addLog = addLog;
// 검사(npm run logfile)가 **재시작을 흉내 내려고** 램을 비운다.
// 배포본에서 보안 기록이 남는지 보려면 「파일도 램도 없는」 자리를 만들어야 하는데,
// 서버를 내렸다 올리면 그 안에서 적은 것도 같이 사라져 볼 수가 없다.
// 여기서만 쓰는 손잡이고, 이름에 그렇게 적어뒀다
module.exports.__dropRamLogsForCheck = () => { securityLogs.length = 0; return true; };
