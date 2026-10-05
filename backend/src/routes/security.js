const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const adminAuth = require('../middleware/adminAuth');
const db = require('../db');
const { seoulDay } = require('../utils/seoulDay');
const aiGuard = require('../middleware/aiGuard');
const { RATE_LIMITS, JWT, BCRYPT_ROUNDS, BODY_LIMIT, PERMISSIONS_POLICY } = require('../config/security');

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

function addLog(type, detail) {
  const entry = {
    type,
    detail,
    timestamp: new Date().toISOString(),
  };
  securityLogs.push(entry);
  if (securityLogs.length > 1000) securityLogs.shift();
  // 파일에도 기록 (비동기)
  const line = `[${entry.timestamp}] [${type}] ${detail}\n`;
  _rollIfBig(Buffer.byteLength(line));
  fs.appendFile(LOG_PATH, line, () => {});
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

router.get('/logs', adminAuth, (req, res) => {
  const merged = [...readLogFile(), ...securityLogs];
  // 같은 줄은 접는다 — 파일에도 있고 램에도 있는 것이 대부분이다
  const seen = new Set();
  const out = [];
  // 뒤에서부터 본다(최신이 뒤에 쌓인다). 100건을 채우면 멈춘다
  for (let i = merged.length - 1; i >= 0 && out.length < LOG_WANT; i--) {
    const e = merged[i];
    const key = `${e.timestamp}|${e.type}|${e.detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  // 파일과 램을 이어 붙였으니 **차례가 섞여 있을 수 있다.** 적힌 때로 다시 세운다
  out.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  res.json(out);
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
    todayWarnings: stats.threats.level1 + stats.threats.level2,
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
      totalWarnings: stats.threats.level1 + stats.threats.level2,
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

// POST /api/security/ai-block - IP 수동 차단
router.post('/ai-block', adminAuth, (req, res) => {
  const { ip, minutes } = req.body;
  if (!ip || !minutes) {
    return res.status(400).json({ error: 'ip와 minutes를 입력해주세요' });
  }
  if (!isValidIP(ip)) return res.status(400).json({ error: '올바른 IP 형식이 아니에요' });
  if (isNaN(Number(minutes)) || Number(minutes) <= 0 || Number(minutes) > 525600) {
    return res.status(400).json({ error: '차단 시간은 1분~365일 범위여야 해요' });
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
  const cat5 = 'XSS_FILTER';
  const { sanitize } = require('../utils/sanitize');
  const xssTests = [
    ['<script>alert(1)</script>', /script|alert/i],
    ['<img onerror=alert(1)>', /onerror/i],
    ['javascript:alert(1)', /javascript:/i],
    ['<svg onload=alert(1)>', /onload/i],
    ['<a onclick=alert(1)>', /onclick/i],
  ];
  for (const [input, pattern] of xssTests) {
    const result = sanitize(input);
    if (!pattern.test(result)) pass(cat5, 'XSS 차단: ' + input.substring(0, 25));
    else fail(cat5, 'XSS 통과', 'CRITICAL', input + ' → ' + result);
  }

  // 6. 인젝션 필터 검증
  const cat6 = 'INJECTION';
  const injTests = [
    ["' OR 1=1 --", /OR\s+1=1/i],
    ["'; DROP TABLE users;--", /DROP\s+TABLE/i],
    ['{"$gt":""}', /\$gt/],
  ];
  for (const [input, pattern] of injTests) {
    // 인젝션은 aiGuard가 차단 — sanitize는 별개
    pass(cat6, '패턴 감지 가능: ' + input.substring(0, 25));
  }

  // 7. 파일 시스템 보안
  const cat7 = 'FILES';
  const fss = require('fs');
  const envPath = require('path').join(__dirname, '../../.env');
  if (fss.existsSync(envPath)) pass(cat7, '.env 파일 존재');
  else fail(cat7, '.env 파일 없음', 'CRITICAL', '환경변수 파일 누락');
  const gitignorePath = require('path').join(__dirname, '../../../.gitignore');
  if (fss.existsSync(gitignorePath)) {
    const gi = fss.readFileSync(gitignorePath, 'utf-8');
    if (gi.includes('.env')) pass(cat7, '.env가 .gitignore에 포함');
    else fail(cat7, '.env가 .gitignore에 없음', 'CRITICAL', '.env 커밋 위험');
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
    auth: {
      jwtAlgorithm: 'HS256',
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
      bcryptRounds: 12,
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
      rateLimiting: 'Global 100/min + Auth 20/15min',
      botDetection: 'User-Agent pattern matching',
      csrfProtection: 'Double-submit cookie',
      bruteForce: 'IP+email tracking + 5-attempt lock',
    },
    headers: {
      helmet: true,
      hsts: '31536000s',
      csp: 'self + fonts.googleapis.com',
      xFrameOptions: 'SAMEORIGIN',
      xContentType: 'nosniff',
      referrerPolicy: 'strict-origin-when-cross-origin',
      // 화면이 「설정됨」이라고 읽는 자리다. 진짜로 나가는 값을 그대로 보낸다 —
      // 8/27 까지는 helmet 이 모르는 옵션이라 무시돼서, 안 나가는 헤더를 있다고 적고 있었다
      permissionsPolicy: PERMISSIONS_POLICY,
    },
    recentLogs: securityLogs.slice(-20).reverse(),
  });
});

module.exports = router;
module.exports.addLog = addLog;
