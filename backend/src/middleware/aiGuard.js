/**
 * AI Guard v2 — 제로 톨러런스 보안 시스템
 * 4단계 위협 레벨 + 자동 감지/정지 + AI 사유 생성
 *
 * **자동으로 지우지 않는다.** 예전 머리말에 「삭제」가 적혀 있었지만, 8/21 에
 * 자동 판정에서 계정 삭제를 떼어냈다 — 오판이면 되돌릴 것이 남아 있어야 한다.
 * 지우는 것은 관리자가 화면에서 보고 직접 한다 (executeLevel4 주석 참고).
 */
const jwt = require('jsonwebtoken');
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

// 1분에 이만큼 넘게 POST 하면 되돌려 보낸다.
//
// 예전에는 10건이었다. 그런데 운동은 기록 하나가 POST 하나다 — 운동을 끝내고 앉아서
// 몰아 적으면 5개 종목 × 3세트만 해도 15건이다. **정상적으로 쓰는 사람이 걸렸다.**
// 그리고 걸리면 7일 정지였고, 두 번 걸리면 계정이 지워졌다.
const SPAM_PER_MINUTE = 60;
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
  /\bon(?:click|focus|blur|mouse\w+|key\w+|change|submit|error|load|unload)\s*=/i,
  /expression\s*\(/i,
  /url\s*\(\s*javascript/i,
  /data:\s*text\/html/i,
];

// ── 인젝션 패턴 ──
//
// **이 앱에는 SQL 도 MongoDB 도 없다.** 저장소는 JSON 파일 하나다(`ironlog.json`).
// 그런데 여기 있던 열두 개 중 열은 SQL 과 몽고를 노린 것이었다 —
// `' OR ` · `; DROP ` · `UNION SELECT` · `$ne` · `$gt` · `$regex` · `$where` · `{ $` ·
// 그리고 SQL 주석 `--`.
//
// 없는 데이터베이스를 노리는 공격은 막을 것이 없고, 남는 것은 **오탐뿐이다.**
// 특히 `/--\s*$/m` 은 **줄 끝이 `--` 인 모든 줄**에 걸린다. 제보를 이렇게 적으면
//
//     안 되는 화면: 기록
//     ---
//     재현 절차
//
// 가운데 줄에서 걸린다. 우리가 「재현 절차를 줄로 나눠 적어달라」고 해놓고,
// 구분선을 그은 사람을 **영구 정지**시키는 셈이었다.
//
// 남긴 둘은 이 앱에 실제로 있는 것이다 — 자바스크립트 프로토타입 오염.
const INJECTION_PATTERNS = [
  /__proto__/i, /constructor\s*\[/i,
];

// ── 봇 User-Agent 패턴 ──
const BOT_PATTERNS = [
  /bot/i, /crawler/i, /spider/i, /curl/i, /wget/i,
  /python-requests/i, /scrapy/i, /httpclient/i, /phantom/i,
];

// ── AI 사유 생성 ──
//
// **여기 적히는 말이 사용자에게 그대로 간다.** 그런데 일곱 자리가
// 「즉시 계정이 삭제되었습니다. 복구할 수 없습니다」라고 통보하고 있었다.
//
// 8/21 과 8/24 에 자동 판정에서 계정 삭제를 떼어냈다 — LEVEL 4 는 이제
// **영구 정지 + 로그인 차단**이고 데이터는 그대로 남긴다 (executeLevel4 주석 참고).
// 동작은 바꿨는데 **사람에게 하는 말을 안 바꿨다.** 지우지도 않고서 지웠다고
// 통보하면, 되돌릴 수 있는 사람도 포기하고 떠난다.
const L4_NOTE = '로그인이 영구히 막혔습니다. **적어두신 운동 기록은 지우지 않았습니다** — 잘못 걸렸다고 생각되시면 고객센터 제보함으로 알려주세요. 확인해서 되돌립니다.';
function generateAiReason(level, triggerType, details) {
  const reasons = {
    xss: {
      title: 'XSS(크로스 사이트 스크립팅) 공격 시도',
      detail: `요청 데이터에서 악성 스크립트 패턴이 감지되었습니다. 패턴: ${details || 'N/A'}. 이는 다른 사용자의 브라우저에서 악성 코드를 실행하려는 시도로 판단됩니다.`,
      verdict: `서비스 보안을 위협하는 행위로 판단했습니다. ${L4_NOTE}`,
    },
    injection: {
      title: 'SQL/NoSQL 인젝션 공격 시도',
      detail: `요청에서 데이터베이스 조작을 시도하는 패턴이 감지되었습니다. 패턴: ${details || 'N/A'}. 데이터베이스에 무단 접근하거나 데이터를 탈취하려는 시도로 판단됩니다.`,
      verdict: L4_NOTE,
    },
    token_forge: {
      title: 'JWT 토큰 위조 시도',
      detail: `유효하지 않은 서명의 JWT 토큰이 ${details || '다수'} 감지되었습니다. 다른 사용자의 계정에 무단 접근하려는 시도로 판단됩니다.`,
      verdict: L4_NOTE,
    },
    unauthorized_access: {
      title: '다른 사용자 데이터 무단 접근 시도',
      detail: '본인 소유가 아닌 데이터에 접근하거나 수정/삭제를 시도했습니다. 이는 개인정보 침해에 해당합니다.',
      verdict: L4_NOTE,
    },
    admin_access: {
      title: '관리자 API 무단 접근 시도',
      detail: '관리자 권한이 없는 상태에서 관리자 전용 API에 접근을 시도했습니다.',
      verdict: L4_NOTE,
    },
    bypass: {
      title: '정지 우회 시도',
      detail: '계정 정지 상태에서 다른 계정 또는 방법으로 서비스에 접근을 시도했습니다.',
      verdict: L4_NOTE,
    },
    rate_limit: {
      title: '비정상적인 대량 요청',
      detail: `1분 내 ${details || 'N/A'}회의 요청이 감지되었습니다. 자동화된 도구를 사용한 공격으로 판단됩니다.`,
      verdict: level === 4 ? L4_NOTE : `${details}간 정지되었습니다.`,
    },
    scan_attack: {
      title: 'API 스캔 공격',
      detail: `존재하지 않는 API 엔드포인트에 대한 반복적인 접근이 감지되었습니다 (${details || 'N/A'}회/분). 시스템 취약점을 탐색하려는 시도로 판단됩니다.`,
      verdict: '3일간 정지되었습니다.',
    },
    spam: {
      title: '스팸 데이터 대량 생성',
      detail: `1분 내 ${details || 'N/A'}건의 데이터가 생성되었습니다. 서비스 방해를 목적으로 한 스팸으로 판단됩니다.`,
      verdict: '7일간 정지되었습니다. 적어두신 기록은 그대로 있습니다.',
    },
    bot: {
      title: '봇/크롤러 접근 감지',
      detail: `자동화된 도구(${details || 'N/A'})를 사용한 접근이 감지되었습니다.`,
      verdict: '3일간 정지되었습니다.',
    },
    accumulated: {
      title: '누적 위반에 의한 영구 정지',
      detail: `이전 정지 ${details || 'N/A'}회 누적으로 영구 정지 기준에 도달했습니다.`,
      verdict: L4_NOTE,
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

// ── LEVEL 4: 영구 정지 ──
//
// 예전에는 여기서 계정과 모든 데이터를 지웠다(deleteUserCompletely). 자동 판정이
// 틀렸을 때 되돌릴 방법이 전혀 없는 동작이다 — 몇 년치 운동 기록이 통째로 사라진다.
// 8/21 에 욕설 경로에서 이 함수를 떼어낸 것과 같은 이유로, 자동 경로에서는 지우지 않는다.
//
// 지우는 것은 관리자가 화면에서 확인하고 직접 한다. 막는 것(영구 정지 + 차단)은
// 자동으로 하되, 없애는 것은 사람이 한다.
function executeLevel4(userId, ip, triggerType, details) {
  threats.level4++;
  const aiReason = generateAiReason(4, triggerType, details);
  addLog('CRITICAL', `LEVEL 4 — ${triggerType}: 영구 정지 (userId=${userId})`, ip, userId);

  // 관리자는 자동 처벌 대상이 아니다.
  // 관리자가 잠기면 자기 정지를 자기가 못 풀어 서비스가 통째로 멎는다
  const user = db.findUserById(userId);
  if (user?.role === 'admin') {
    addLog('ALERT', `LEVEL 4 대상이 관리자라 건너뜀 (userId=${userId})`, ip, userId);
    return aiReason;
  }

  // 정지 기록
  db.createSuspension(userId, 4, triggerType, aiReason, 'permanent');

  // 로그인 자체를 막는다. 데이터는 남긴다 — 오판이면 되돌려야 한다
  if (user) db.banUser(userId);

  // 블랙리스트.
  // IP 대역(/24)까지 자동으로 막지 않는다 — 통신사 NAT 뒤에 있는 사람들이
  // 통째로 걸린다. 대역 차단이 필요하면 관리자가 보고 직접 넣는다
  if (user?.email) db.addBlacklist('email', user.email, aiReason);
  if (ip) db.addBlacklist('ip', ip, aiReason);

  // 정지 횟수 기록
  suspensionCounts.set(userId, (suspensionCounts.get(userId) || 0) + 1);

  // IP 영구 차단
  limitedSet(blockedIPs, ip, { until: Infinity, level: 4, reason: aiReason });

  return aiReason;
}

// ── LEVEL 3: 정지 ──
function executeLevel3(userId, ip, triggerType, details, days) {
  threats.level3++;
  const aiReason = generateAiReason(3, triggerType, details);

  // 관리자는 자동 처벌 대상이 아니다 (LEVEL 4 와 같은 이유)
  if (db.findUserById(userId)?.role === 'admin') {
    addLog('ALERT', `LEVEL 3 대상이 관리자라 건너뜀 (userId=${userId})`, ip, userId);
    return aiReason;
  }

  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
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
  limitedSet(blockedIPs, ip, { until: Date.now() + days * 24 * 60 * 60 * 1000, level: 3, reason: aiReason });

  return aiReason;
}

// ── LEVEL 2: 잠금 ──
function executeLevel2(ip, triggerType, details, hours) {
  threats.level2++;
  const until = Date.now() + hours * 60 * 60 * 1000;
  const aiReason = generateAiReason(2, triggerType, details);
  addLog('ALERT', `LEVEL 2 — ${triggerType}: ${hours}시간 잠금`, ip);

  limitedSet(blockedIPs, ip, { until, level: 2, reason: aiReason });
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

// 입력 스캔에 걸린 횟수. 첫 번은 막고 경고만, 되풀이하면 올린다.
// 사람을 알면 사람 단위로, 모르면 IP 단위로 센다
const inputHits = new Map();
const inputHitsByIp = new Map();

// 이 요청이 누구인지.
//
// **가드는 라우트보다 먼저 돈다.** 그래서 여기서는 `req.userId` 가 아직 없다 —
// 그것을 채우는 `middleware/auth` 는 라우트 안에서 돈다. 예전 코드는 `req.userId` 를
// 보고 갈래를 나눴는데, 그 값이 늘 없어서 **로그인한 사람 갈래가 통째로 죽어 있었다.**
// 걸린 사람이 누구든 전부 IP 를 막는 쪽으로 갔다.
//
// 여기서는 토큰만 풀어 본다. 정지·차단 확인은 `middleware/auth` 가 한다 —
// 이쪽은 「누구인가」만 알면 된다. 못 풀면 모르는 사람으로 친다.
function userIdOf(req) {
  try {
    const token = req.cookies?.sb_access || req.headers.authorization?.split(' ')[1];
    if (!token || token.length > 2000 || !process.env.JWT_SECRET) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    return decoded?.userId || null;
  } catch {
    return null;
  }
}

// ── 프로토타입 오염 패턴 ──
const PROTO_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// ── 입력 스캔 (XSS/인젝션/프로토타입오염) ──
function scanInput(obj, depth) {
  if (depth > 5) return null;
  if (typeof obj === 'string') {
    for (const p of XSS_PATTERNS) {
      if (p.test(obj)) return { type: 'xss', pattern: p.toString() };
    }
    for (const p of INJECTION_PATTERNS) {
      if (p.test(obj)) return { type: 'injection', pattern: p.toString() };
    }
  } else if (typeof obj === 'object' && obj !== null) {
    for (const [key, val] of Object.entries(obj)) {
      // 프로토타입 오염 감지
      if (PROTO_KEYS.has(key)) return { type: 'injection', pattern: `prototype pollution: ${key}` };
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
  return record.count >= SPAM_PER_MINUTE;
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
  if (record.count >= 20) {
    executeLevel2(ip, 'login_lock', '20회', 168); // 7일
    loginFailures.delete(ip);
  } else if (record.count >= 10) {
    executeLevel2(ip, 'login_lock', '10회', 24);
    loginFailures.delete(ip);
  } else if (record.count >= 7) {
    executeLevel2(ip, 'login_lock', '7회', 1);
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

  if (record.count >= 500) {
    executeLevel2(ip, 'rate_limit', `${record.count}회`, 168); // 7일
  } else if (record.count >= 300) {
    executeLevel2(ip, 'rate_limit', `${record.count}회`, 24);
  } else if (record.count >= 200) {
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
  if (record.count >= 30) {
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

  // localhost + 헬스체크 화이트리스트
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return next();
  if (req.path === '/api/health') return next();

  // 정적 파일 / SPA 경로는 보안 검사 스킵 (API만 검사)
  // — favicon, /assets/*, /icons/*, .js/.css/.png 등 → API 외 경로는 통과
  if (!req.path.startsWith('/api/')) return next();

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

  // 봇 감지 (Render/UptimeRobot 등 모니터링 서비스 제외)
  const ua = req.get('user-agent') || '';
  if (BOT_PATTERNS.some(p => p.test(ua)) && !ua.includes('Mozilla') && !ua.includes('Render') && !ua.includes('UptimeRobot') && !ua.includes('HealthCheck')) {
    executeLevel2(ip, 'bot', ua, 72);
    return res.status(403).json({ error: '자동화된 접근이 차단되었습니다.' });
  }

  // 요청 속도 체크
  checkRequestRate(ip);
  if (blockedIPs.has(ip)) {
    blockedRequests++;
    return res.status(403).json({ error: '비정상적인 요청으로 차단되었습니다.' });
  }

  // XSS/인젝션 스캔 (body + query + params + URL 디코딩)
  const allInput = { ...req.body, ...req.query, ...req.params };
  // URL 인코딩 우회 방지: 디코딩된 값도 스캔
  try {
    const decoded = decodeURIComponent(req.originalUrl);
    if (decoded !== req.originalUrl) allInput._decodedUrl = decoded;
  } catch {}
  const threat = scanInput(allInput, 0);
  if (threat) {
    // 로그인한 사람이면 사다리를 탄다.
    //
    // 예전에는 **첫 번에 영구 정지**였다. 그런데 걸리는 자리 중에는 사람이 그냥 쓸 만한
    // 것도 있다 — 「이 글자를 넣으면 화면이 깨져요: <script>」 라고 적은 제보가 그렇다.
    // **버그를 알려주러 온 사람을 영구히 잠그는** 것이 된다.
    //
    // 욕설에서 이미 같은 판단을 했다(`utils/abusePolicy.js`) — 처음에는 막고 경고만,
    // 되풀이하면 그때 올린다. 요청은 **어느 쪽이든 막힌다.** 실제로 지키는 것은 그쪽이고,
    // 정지는 되풀이하는 사람에게만 쓴다.
    //
    // 횟수는 메모리에 센다. 서버가 다시 뜨면 초회로 돌아가는데, 그래도 요청은 늘 막히므로
    // 보호에는 구멍이 없다 — 되돌릴 수 없는 처벌만 늦게 간다. 이 방향의 오차가 맞다.
    const userId = userIdOf(req);
    if (userId) {
      const hits = (inputHits.get(userId) || 0) + 1;
      limitedSet(inputHits, userId, hits);
      addLog('WARNING', `입력 스캔 ${hits}회 — ${threat.type} (userId=${userId})`, ip, userId);

      if (hits === 1) {
        return res.status(403).json({
          error: '보안 정책 위반이 감지되었습니다.',
          message: '보낼 수 없는 글자가 들어 있어 막았습니다. 계정은 그대로입니다 — 그 부분을 빼고 다시 보내주세요. 되풀이되면 정지될 수 있습니다.',
        });
      }

      const reason = executeLevel3(userId, ip, threat.type, threat.pattern, 3);
      return res.status(403).json({
        error: '보안 정책 위반이 감지되었습니다.',
        message: '되풀이되어 계정이 정지되었습니다. 기록은 지우지 않습니다 — 잘못 걸렸다면 관리자에게 알려주세요.',
        reason: reason,
      });
    }

    // 누구인지 모르면 IP 로 센다.
    //
    // 예전에는 **첫 번에 그 IP 를 7일** 막았다. 이 앱에서 IP 는 사람 하나가 아니다 —
    // 통신사 NAT 뒤에서는 수만 명이 같은 주소로 나온다. 한 사람이 제보에 `<script>` 를
    // 붙여넣으면 그 뒤의 모두가 일주일 동안 앱을 못 쓴다. 같은 파일의 LEVEL 4 주석이
    // 대역 차단을 스스로 금지해 둔 것과 같은 이유다.
    //
    // 요청은 어느 쪽이든 막힌다. 막는 시간만 되풀이한 만큼 올린다.
    const ipHits = (inputHitsByIp.get(ip) || 0) + 1;
    limitedSet(inputHitsByIp, ip, ipHits);
    addLog('WARNING', `입력 스캔 ${ipHits}회 — ${threat.type} (비로그인)`, ip);

    if (ipHits >= 5) executeLevel2(ip, threat.type, threat.pattern, 168);       // 7일
    else if (ipHits >= 3) executeLevel2(ip, threat.type, threat.pattern, 24);
    else if (ipHits >= 2) executeLevel2(ip, threat.type, threat.pattern, 1);

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
      // 정지를 걸지 않는다. 너무 빠른 것과 나쁜 뜻으로 하는 것은 다르고,
      // 이 판정만으로 사람을 일주일 막아 세우기에는 근거가 약하다.
      // 잠깐 되돌려 보내고 기록만 남긴다 — 진짜 공격은 IP 차단과 rate limit 이 잡는다
      const count = spamCounts.get(req.userId)?.count || SPAM_PER_MINUTE;
      addLog('INFO', `요청이 너무 빠름: ${count}건/분 (userId=${req.userId})`, ip, req.userId);
      return res.status(429).json({
        error: '조금 빠릅니다. 잠시 뒤에 다시 해주세요',
        retryAfterSec: 60,
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

  // banned 유저.
  //
  // 여기도 「계정 및 모든 데이터가 삭제되었습니다. 되돌릴 수 없습니다」라고 말하고
  // 있었다. **데이터는 그대로 있고 되돌릴 수도 있다** — `banUser` 는 로그인을 막을
  // 뿐이고, 지우는 것은 관리자가 화면에서 직접 할 때만 일어난다.
  if (user.is_banned) {
    return res.status(403).json({
      error: '계정이 영구 정지되었습니다.',
      message: L4_NOTE,
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
module.exports.getStats = () => ({
  totalRequests, blockedRequests, threats,
  warningCounts: warningCounts.size,
  suspiciousIPs: [...blockedIPs.keys()],
  activeLocks: blockedIPs.size,
  requestTracking: requestCounts.size,
  loginFailureTracking: loginFailures.size,
  spamTracking: spamCounts.size,
});
module.exports.getSuspiciousIPs = () => [...blockedIPs.keys()];
module.exports.unblockIP = (ip) => { const r = blockedIPs.delete(ip); if (r) addLog('system', '수동 차단 해제', ip); return r; };
module.exports.manualBlock = (ip, minutes) => { const until = Date.now() + minutes * 60000; limitedSet(blockedIPs, ip, { until, level: 2, reason: '관리자 수동 차단' }); return new Date(until).toISOString(); };
