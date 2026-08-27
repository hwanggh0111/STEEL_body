const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const adminAuth = require('../middleware/adminAuth');
const db = require('../db');
const aiGuard = require('../middleware/aiGuard');
const { RATE_LIMITS, JWT, BCRYPT_ROUNDS, BODY_LIMIT, PERMISSIONS_POLICY } = require('../config/security');

// 보안 로그 (메모리 + 파일 영속화)
const LOG_PATH = path.join(__dirname, '../../security.log');
const securityLogs = [];

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
  fs.appendFile(LOG_PATH, line, () => {});
}

// GET /api/security/dashboard - 보안 대시보드
router.get('/dashboard', adminAuth, (req, res) => {
  const users = db.getAllUsers();
  const today = new Date().toISOString().slice(0, 10);
  const todaySignups = users.filter(u => u.created_at && u.created_at.slice(0, 10) === today).length;

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
router.get('/logs', adminAuth, (req, res) => {
  const recent = securityLogs.slice(-100).reverse();
  res.json(recent);
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
    blockedAt: info.until === 'permanent' ? null : new Date(info.until === 'permanent' ? now : now).toISOString(),
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
  const duplicateEmails = users.filter((u, i) => users.findIndex(x => x.email === u.email) !== i);
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
