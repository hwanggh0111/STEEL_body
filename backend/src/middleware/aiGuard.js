/**
 * AI Guard v2 — 제로 톨러런스 보안 시스템
 * 4단계 위협 레벨 + 자동 감지/정지/삭제 + AI 사유 생성
 */
const db = require('../db');

// ── 상태 저장소 (인메모리, 크기 제한) ──
const MAX_MAP_SIZE = 10000;
function limitedSet(map, key, value) {
  if (map.size >= MAX_MAP_SIZE) {
    const firstKey = map.keys().next().value;
    map.delete(firstKey);
  }
  map.set(key, value);
}

const requestCounts = new Map();    // IP → { count, firstRequest }
const blockedIPs = new Map();       // IP → { until, level, reason }
const loginFailures = new Map();    // IP → { count, lastFailure }
const notFoundCounts = new Map();   // IP → { count, firstHit }
const spamCounts = new Map();       // userId → { count, firstCreate }
const warningCounts = new Map();    // IP → count
const suspensionCounts = new Map(); // userId → count
const aiLogs = [];                  // max 500

let totalRequests = 0;
let blockedRequests = 0;
let threats = { level1: 0, level2: 0, level3: 0, level4: 0 };

// ── XSS 패턴 ──
const XSS_PATTERNS = [
  /<script/i, /<\/script/i, /onerror\s*=/i, /onload\s*=/i,
  /javascript:/i, /eval\s*\(/i, /document\.cookie/i,
  /window\.location/i, /innerHTML/i, /<iframe/i, /<svg\s+onload/i,
  /document\.write/i, /\.fromCharCode/i, /alert\s*\(/i,
];

// ── 인젝션 패턴 ──
const INJECTION_PATTERNS = [
  /'\s*OR\s/i, /'\s*AND\s/i, /--\s*$/m, /;\s*DROP\s/i,
  /UNION\s+SELECT/i, /\$gt/i, /\$ne/i, /\$regex/i,
  /\$where/i, /\{\s*\$/i, /__proto__/i, /constructor\s*\[/i,
];

// ── 봇 User-Agent 패턴 ──
const BOT_PATTERNS = [
  /bot/i, /crawler/i, /spider/i, /curl/i, /wget/i,
  /python-requests/i, /scrapy/i, /httpclient/i, /phantom/i,
];

// ── AI 사유 생성 ──
function generateAiReason(level, triggerType, details) {
  const reasons = {
    xss: {
      title: 'XSS(크로스 사이트 스크립팅) 공격 시도',
      detail: `요청 데이터에서 악성 스크립트 패턴이 감지되었습니다. 패턴: ${details || 'N/A'}. 이는 다른 사용자의 브라우저에서 악성 코드를 실행하려는 시도로 판단됩니다.`,
      verdict: '서비스 보안을 심각하게 위협하는 행위로, 즉시 계정이 삭제되었습니다.',
    },
    injection: {
      title: 'SQL/NoSQL 인젝션 공격 시도',
      detail: `요청에서 데이터베이스 조작을 시도하는 패턴이 감지되었습니다. 패턴: ${details || 'N/A'}. 데이터베이스에 무단 접근하거나 데이터를 탈취하려는 시도로 판단됩니다.`,
      verdict: '즉시 계정이 삭제되었습니다. 복구할 수 없습니다.',
    },
    token_forge: {
      title: 'JWT 토큰 위조 시도',
      detail: `유효하지 않은 서명의 JWT 토큰이 ${details || '다수'} 감지되었습니다. 다른 사용자의 계정에 무단 접근하려는 시도로 판단됩니다.`,
      verdict: '즉시 계정이 삭제되었습니다.',
    },
    unauthorized_access: {
      title: '다른 사용자 데이터 무단 접근 시도',
      detail: '본인 소유가 아닌 데이터에 접근하거나 수정/삭제를 시도했습니다. 이는 개인정보 침해에 해당합니다.',
      verdict: '즉시 계정이 삭제되었습니다.',
    },
    admin_access: {
      title: '관리자 API 무단 접근 시도',
      detail: '관리자 권한이 없는 상태에서 관리자 전용 API에 접근을 시도했습니다.',
      verdict: '즉시 계정이 삭제되었습니다.',
    },
    bypass: {
      title: '정지 우회 시도',
      detail: '계정 정지 상태에서 다른 계정 또는 방법으로 서비스에 접근을 시도했습니다.',
      verdict: '즉시 계정이 삭제되었습니다.',
    },
    rate_limit: {
      title: '비정상적인 대량 요청',
      detail: `1분 내 ${details || 'N/A'}회의 요청이 감지되었습니다. 자동화된 도구를 사용한 공격으로 판단됩니다.`,
      verdict: level === 4 ? '계정이 삭제되었습니다.' : `${details}간 정지되었습니다.`,
    },
    scan_attack: {
      title: 'API 스캔 공격',
      detail: `존재하지 않는 API 엔드포인트에 대한 반복적인 접근이 감지되었습니다 (${details || 'N/A'}회/분). 시스템 취약점을 탐색하려는 시도로 판단됩니다.`,
      verdict: '3일간 정지되었습니다.',
    },
    spam: {
      title: '스팸 데이터 대량 생성',
      detail: `1분 내 ${details || 'N/A'}건의 데이터가 생성되었습니다. 서비스 방해를 목적으로 한 스팸으로 판단됩니다.`,
      verdict: '7일간 정지되었습니다. 스팸 데이터는 자동 삭제되었습니다.',
    },
    bot: {
      title: '봇/크롤러 접근 감지',
      detail: `자동화된 도구(${details || 'N/A'})를 사용한 접근이 감지되었습니다.`,
      verdict: '3일간 정지되었습니다.',
    },
    accumulated: {
      title: '누적 위반에 의한 영구 정지',
      detail: `이전 정지 ${details || 'N/A'}회 누적으로 영구 정지 기준에 도달했습니다.`,
      verdict: '계정이 삭제되었습니다. 복구할 수 없습니다.',
    },
    login_lock: {
      title: '로그인 실패 횟수 초과',
      detail: `연속 ${details || 'N/A'}회 로그인에 실패했습니다.`,
      verdict: '계정 보호를 위해 일시적으로 잠겼습니다.',
    },
  };

  const r = reasons[triggerType] || { title: '보안 정책 위반', detail: details || '', verdict: '조치가 취해졌습니다.' };
  return `[AI Guard 판정]\n위협 레벨: LEVEL ${level}\n사유: ${r.title}\n상세: ${r.detail}\n판정: ${r.verdict}\n시각: ${new Date().toISOString()}`;
}

// ── 로그 ──
function addLog(type, message, ip, userId) {
  aiLogs.push({ type, message, ip, userId: userId || null, timestamp: new Date().toISOString() });
  if (aiLogs.length > 500) aiLogs.shift();
}

addLog('system', 'AI Guard v2 (제로 톨러런스) 활성화', null);

// ── LEVEL 4: 계정 즉시 삭제 ──
function executeLevel4(userId, ip, triggerType, details) {
  threats.level4++;
  const aiReason = generateAiReason(4, triggerType, details);
  addLog('CRITICAL', `LEVEL 4 — ${triggerType}: 계정 삭제 실행 (userId=${userId})`, ip, userId);

  // 정지 기록
  db.createSuspension(userId, 4, triggerType, aiReason, 'permanent');

  // 유저 정보 가져오기 (블랙리스트용)
  const user = db.findUserById(userId);

  // 즉시 비활성화 + 삭제
  if (user) db.banUser(userId);
  db.deleteUserCompletely(userId);
  addLog('CRITICAL', `계정 데이터 완전 삭제 완료 (userId=${userId})`, ip, userId);

  // 블랙리스트
  if (user?.email) db.addBlacklist('email', user.email, aiReason);
  if (ip) {
    db.addBlacklist('ip', ip, aiReason);
    const ipRange = ip.replace(/\.\d+$/, '.0/24');
    db.addBlacklist('ip_range', ipRange, aiReason);
  }

  // 정지 횟수 기록
  suspensionCounts.set(userId, (suspensionCounts.get(userId) || 0) + 1);

  // IP 영구 차단
  blockedIPs.set(ip, { until: Infinity, level: 4, reason: aiReason });

  return aiReason;
}

// ── LEVEL 3: 정지 ──
function executeLevel3(userId, ip, triggerType, details, days) {
  threats.level3++;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const aiReason = generateAiReason(3, triggerType, details);
  addLog('WARNING', `LEVEL 3 — ${triggerType}: ${days}일 정지 (userId=${userId})`, ip, userId);

  db.createSuspension(userId, 3, triggerType, aiReason, expiresAt);

  // 정지 횟수 누적 체크
  const count = (suspensionCounts.get(userId) || 0) + 1;
  suspensionCounts.set(userId, count);

  // 정지 2회 누적 → LEVEL 4
  if (count >= 2) {
    return executeLevel4(userId, ip, 'accumulated', `${count}회`);
  }

  // IP 차단 (정지 기간만큼)
  blockedIPs.set(ip, { until: Date.now() + days * 24 * 60 * 60 * 1000, level: 3, reason: aiReason });

  return aiReason;
}

// ── LEVEL 2: 잠금 ──
function executeLevel2(ip, triggerType, details, hours) {
  threats.level2++;
  const until = Date.now() + hours * 60 * 60 * 1000;
  const aiReason = generateAiReason(2, triggerType, details);
  addLog('ALERT', `LEVEL 2 — ${triggerType}: ${hours}시간 잠금`, ip);

  blockedIPs.set(ip, { until, level: 2, reason: aiReason });
  return aiReason;
}

// ── LEVEL 1: 경고 ──
function executeLevel1(ip, triggerType, details) {
  threats.level1++;
  const count = (warningCounts.get(ip) || 0) + 1;
  warningCounts.set(ip, count);
  addLog('INFO', `LEVEL 1 — ${triggerType}: 경고 (${count}회 누적)`, ip);

  // 경고 10회 누적 → LEVEL 2 (7일 잠금)
  if (count >= 10) {
    executeLevel2(ip, 'accumulated', `경고 ${count}회 누적`, 168); // 7일
    warningCounts.set(ip, 0);
  }
}

// ── 입력 스캔 (XSS/인젝션) ──
function scanInput(obj, depth) {
  if (depth > 5) return null; // prevent deep recursion
  if (typeof obj === 'string') {
    for (const p of XSS_PATTERNS) {
      if (p.test(obj)) return { type: 'xss', pattern: p.toString() };
    }
    for (const p of INJECTION_PATTERNS) {
      if (p.test(obj)) return { type: 'injection', pattern: p.toString() };
    }
  } else if (typeof obj === 'object' && obj !== null) {
    for (const val of Object.values(obj)) {
      const result = scanInput(val, (depth || 0) + 1);
      if (result) return result;
    }
  }
  return null;
}

// ── 스팸 체크 ──
function checkSpam(userId) {
  const now = Date.now();
  if (!spamCounts.has(userId)) {
    spamCounts.set(userId, { count: 1, firstCreate: now });
    return false;
  }
  const record = spamCounts.get(userId);
  if (now - record.firstCreate > 60000) {
    spamCounts.set(userId, { count: 1, firstCreate: now });
    return false;
  }
  record.count++;
  return record.count >= 10; // 10건/분 이상 = 스팸
}

// ── 로그인 실패 ──
function recordLoginFailure(ip) {
  const now = Date.now();

  if (!loginFailures.has(ip)) {
    loginFailures.set(ip, { count: 1, lastFailure: now });
  } else {
    const record = loginFailures.get(ip);
    if (now - record.lastFailure > 60 * 60 * 1000) { // 1시간 리셋
      loginFailures.set(ip, { count: 1, lastFailure: now });
    } else {
      record.count++;
      record.lastFailure = now;
    }
  }

  const record = loginFailures.get(ip);
  if (record.count >= 10) {
    executeLevel2(ip, 'login_lock', '10회', 168); // 7일
    loginFailures.delete(ip);
  } else if (record.count >= 5) {
    executeLevel2(ip, 'login_lock', '5회', 24);
    loginFailures.delete(ip);
  } else if (record.count >= 3) {
    executeLevel2(ip, 'login_lock', '3회', 1);
  }
}

// ── 요청 속도 체크 ──
function checkRequestRate(ip) {
  const now = Date.now();
  if (!requestCounts.has(ip)) {
    limitedSet(requestCounts, ip, { count: 1, firstRequest: now });
    return;
  }
  const record = requestCounts.get(ip);
  if (now - record.firstRequest > 60000) {
    requestCounts.set(ip, { count: 1, firstRequest: now });
    return;
  }
  record.count++;

  if (record.count >= 50) {
    executeLevel2(ip, 'rate_limit', `${record.count}회`, 168); // 7일
  } else if (record.count >= 30) {
    executeLevel2(ip, 'rate_limit', `${record.count}회`, 24);
  } else if (record.count >= 15) {
    executeLevel2(ip, 'rate_limit', `${record.count}회`, 1);
  }
}

// ── 404 체크 ──
function checkNotFound(ip) {
  const now = Date.now();
  if (!notFoundCounts.has(ip)) {
    notFoundCounts.set(ip, { count: 1, firstHit: now });
  } else {
    const record = notFoundCounts.get(ip);
    if (now - record.firstHit > 60000) {
      notFoundCounts.set(ip, { count: 1, firstHit: now });
    } else {
      record.count++;
    }
  }
  const record = notFoundCounts.get(ip);
  if (record.count >= 3) {
    executeLevel2(ip, 'scan_attack', `${record.count}회/분`, 72); // 3일
    notFoundCounts.delete(ip);
  }
}

// ── 자동 정리 ──
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [ip, info] of blockedIPs.entries()) {
    if (info.until !== Infinity && now >= info.until) {
      blockedIPs.delete(ip);
      addLog('system', '차단 만료 해제', ip);
    }
  }
  // 메모리 정리
  for (const [ip, r] of requestCounts.entries()) {
    if (now - r.firstRequest > 120000) requestCounts.delete(ip);
  }
  for (const [ip, r] of loginFailures.entries()) {
    if (now - r.lastFailure > 3600000) loginFailures.delete(ip);
  }
  for (const [ip, r] of notFoundCounts.entries()) {
    if (now - r.firstHit > 120000) notFoundCounts.delete(ip);
  }
  for (const [uid, r] of spamCounts.entries()) {
    if (now - r.firstCreate > 120000) spamCounts.delete(uid);
  }
}, 5 * 60 * 1000);
if (cleanup.unref) cleanup.unref();

// ── 메인 미들웨어 ──
function aiGuardMiddleware(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  totalRequests++;

  // localhost 화이트리스트
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return next();

  // 블랙리스트 체크 (가입 시)
  if (req.path === '/api/auth/register' && req.method === 'POST') {
    const email = req.body?.email;
    const ua = req.get('user-agent') || '';
    if (db.isBlacklisted(email, ip, ua)) {
      blockedRequests++;
      return res.status(403).json({ error: '서비스를 이용할 수 없습니다.' });
    }
  }

  // IP 차단 체크
  if (blockedIPs.has(ip)) {
    const info = blockedIPs.get(ip);
    if (info.until === Infinity || Date.now() < info.until) {
      blockedRequests++;
      const response = { error: '접근이 차단되었습니다.', level: info.level };
      if (info.until !== Infinity) response.blockedUntil = new Date(info.until).toISOString();
      if (info.level === 4) response.message = '보안 정책 위반으로 영구 차단되었습니다.';
      else response.message = 'AI Guard에 의해 일시 차단되었습니다.';
      return res.status(403).json(response);
    }
    blockedIPs.delete(ip);
  }

  // 봇 감지
  const ua = req.get('user-agent') || '';
  if (BOT_PATTERNS.some(p => p.test(ua)) && !ua.includes('Mozilla')) {
    executeLevel2(ip, 'bot', ua, 72);
    return res.status(403).json({ error: '자동화된 접근이 차단되었습니다.' });
  }

  // 요청 속도 체크
  checkRequestRate(ip);
  if (blockedIPs.has(ip)) {
    blockedRequests++;
    return res.status(403).json({ error: '비정상적인 요청으로 차단되었습니다.' });
  }

  // XSS/인젝션 스캔 (body + query + params)
  const allInput = { ...req.body, ...req.query, ...req.params };
  const threat = scanInput(allInput, 0);
  if (threat) {
    // userId가 있으면 (인증된 요청) → LEVEL 4
    if (req.userId) {
      const reason = executeLevel4(req.userId, ip, threat.type, threat.pattern);
      return res.status(403).json({
        error: '보안 정책 위반이 감지되었습니다.',
        message: '계정이 영구 정지되었습니다. 모든 데이터가 삭제됩니다.',
        reason: reason,
      });
    }
    // 비인증 → IP 차단
    executeLevel2(ip, threat.type, threat.pattern, 168);
    return res.status(403).json({ error: '악성 요청이 차단되었습니다.' });
  }

  // 404 감지
  res.on('finish', () => {
    if (res.statusCode === 404) checkNotFound(ip);
  });

  next();
}

// ── 스팸 체크 미들웨어 (POST 라우트에서 사용) ──
function spamCheck(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return next();
  if (req.userId && req.method === 'POST') {
    if (checkSpam(req.userId)) {
      const reason = executeLevel3(req.userId, ip, 'spam', `${spamCounts.get(req.userId)?.count || 10}건/분`, 7);
      return res.status(403).json({
        error: '스팸 활동이 감지되었습니다.',
        message: '7일간 정지되었습니다.',
        reason,
      });
    }
  }
  next();
}

// ── 계정 정지 체크 미들웨어 ──
function suspensionCheck(req, res, next) {
  if (!req.userId) return next();

  const user = db.findUserById(req.userId);
  if (!user) return next();

  // banned 유저
  if (user.is_banned) {
    return res.status(403).json({
      error: '계정이 영구 정지되었습니다.',
      message: '보안 정책 위반으로 계정 및 모든 데이터가 삭제되었습니다. 이 결정은 되돌릴 수 없습니다.',
    });
  }

  // 활성 정지
  const suspension = db.getSuspension(req.userId);
  if (suspension) {
    const response = {
      error: '계정이 정지되었습니다.',
      level: suspension.level,
      reason: suspension.ai_reason,
    };
    if (suspension.expires_at !== 'permanent') {
      response.expiresAt = suspension.expires_at;
      response.message = `정지 해제일: ${suspension.expires_at}`;
    } else {
      response.message = '영구 정지되었습니다.';
    }
    return res.status(403).json(response);
  }

  next();
}

// ── 내보내기 ──
module.exports = aiGuardMiddleware;
module.exports.spamCheck = spamCheck;
module.exports.suspensionCheck = suspensionCheck;
module.exports.recordLoginFailure = recordLoginFailure;
module.exports.executeLevel4 = executeLevel4;
module.exports.executeLevel3 = executeLevel3;

module.exports.getAiLogs = () => [...aiLogs];
module.exports.getBlockedIPs = () => {
  const result = {};
  for (const [ip, info] of blockedIPs.entries()) {
    result[ip] = { until: info.until === Infinity ? 'permanent' : new Date(info.until).toISOString(), level: info.level };
  }
  return result;
};
module.exports.getStats = () => ({ totalRequests, blockedRequests, threats, warningCounts: warningCounts.size, suspiciousIPs: [...blockedIPs.keys()] });
module.exports.getSuspiciousIPs = () => [...blockedIPs.keys()];
module.exports.unblockIP = (ip) => { const r = blockedIPs.delete(ip); if (r) addLog('system', '수동 차단 해제', ip); return r; };
module.exports.manualBlock = (ip, minutes) => { const until = Date.now() + minutes * 60000; blockedIPs.set(ip, { until, level: 2, reason: '관리자 수동 차단' }); return new Date(until).toISOString(); };
