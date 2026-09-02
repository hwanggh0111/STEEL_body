require('dotenv').config();

// 필수 환경변수 검증
const REQUIRED_ENV = ['JWT_SECRET'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[FATAL] 환경변수 ${key}가 설정되지 않았습니다.`);
    process.exit(1);
  }
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('[FATAL] JWT_SECRET은 최소 32자 이상이어야 합니다.');
  process.exit(1);
}

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { RATE_LIMITS, BODY_LIMIT, PERMISSIONS_POLICY } = require('./config/security');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const aiGuard = require('./middleware/aiGuard');
const db = require('./db');

const app = express();

// 터널/프록시 뒤에서 올바른 프로토콜 감지 (Render는 1 hop)
app.set('trust proxy', 1);

// 보안 헤더
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://api.open-meteo.com", "https://wger.de"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// 카메라 · 마이크 · 위치를 막는다.
//
// 예전에는 이걸 helmet 설정 안에 `permissionsPolicy: { features: {...} }` 로 적어뒀다.
// **helmet 에는 그런 옵션이 없다** — 모르는 옵션이라 조용히 무시됐고, 헤더는 한 번도
// 나간 적이 없다. 그런데 관리자 보안 보고서는 「camera=none, microphone=none,
// geolocation=none」이라고 적고 있었다. 있지도 않은 방어를 있다고 읽는 쪽이 더 나쁘다.
//
// 이 앱은 셋 다 안 쓴다. 안 쓰는 것은 막아둔다 — 나중에 끼어드는 스크립트가 있어도
// 브라우저가 먼저 거절한다.
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
  next();
});

// gzip compression (1KB 미만은 압축 생략)
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

// X-Powered-By 헤더 제거
app.disable('x-powered-by');

// CORS
//
// 예전에는 `*.onrender.com` 을 통째로 허용했다. Render 는 누구나 무료로 배포할 수 있는
// 곳이다 — 아무나 evil-xxx.onrender.com 을 띄우고 그 페이지에서 credentials 를 실어
// 이 API 를 부를 수 있었다는 뜻이다. 로그인해 있는 사람이 그 페이지를 열기만 하면
// 그 사람 자격으로 요청이 나가고 응답까지 읽힌다.
//
// 허용 목록은 이미 FRONTEND_URL 에 정확한 주소가 들어 있으므로 와일드카드는 필요 없다.
// Render 가 넣어주는 RENDER_EXTERNAL_URL 도 같이 받아, 배포 이름을 바꿔도 끊기지 않게 한다.
const allowedOrigins = [
  ...(process.env.FRONTEND_URL || 'http://localhost:5173').split(','),
  ...(process.env.BACKEND_URL || '').split(','),
  process.env.RENDER_EXTERNAL_URL || '',
]
  .map(o => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // 같은 서버 (프록시, SSR) 또는 허용 목록
    if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) return callback(null, true);
    // 개발 환경: 같은 네트워크 허용
    if (process.env.NODE_ENV !== 'production' && /^http:\/\/192\.168\.\d+\.\d+:\d+$/.test(origin)) {
      return callback(null, true);
    }
    callback(new Error('CORS not allowed'));
  },
  credentials: true,
}));

// 쿠키 파서
app.use(cookieParser());

// 요청 바디 크기 제한 + 프로토타입 오염 방지
app.use(express.json({
  limit: BODY_LIMIT,
  reviver: (key, value) => {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return undefined;
    return value;
  },
}));

// AI 자동 관리자 (의심 활동 감지/차단).
//
// **`express.json()` 뒤에 있어야 한다.** 예전에는 앞에 있었다. 그러면 여기서 `req.body` 는
// 아직 `undefined` 라, 몸통을 훑는 코드가
//
//     const allInput = { ...req.body, ...req.query, ...req.params };
//
// 사실상 `req.query` 하나만 보고 있었다. **입력 스캔이 통째로 죽어 있었다** — 주소창으로
// 보낸 `<script>` 는 잡히는데 제보 · 운동명 · 닉네임으로 보낸 것은 아무것도 안 잡혔다.
// 가입 블랙리스트도 `req.body?.email` 을 읽는데 늘 `undefined` 라 같이 죽어 있었다.
// 관리자 화면의 보안 숫자는 그 죽은 스캔을 세고 있었다.
app.use(aiGuard);

// CSRF 보호 (쿠키 인증 사용 시에만 double-submit cookie 패턴 적용)
app.use((req, res, next) => {
  // GET, HEAD, OPTIONS는 CSRF 검사 생략
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  // 인증/OAuth 경로는 CSRF 검사 생략 (로그인 전이므로)
  if (req.path.startsWith('/api/auth/') || req.path.startsWith('/api/oauth/')) return next();
  // 공개 API는 생략
  if (req.path === '/api/health') return next();
  // Bearer 토큰만 쓰는 요청은 CSRF 가 필요 없다 — 브라우저가 알아서 붙이지 않기 때문이다.
  //
  // 다만 "Bearer 헤더가 있으면 통과" 로 두면 안 된다. 인증 쿠키가 같이 붙어 있으면
  // auth 미들웨어가 쿠키를 먼저 쓰기 때문에, 아무 값이나 담은 Bearer 헤더 하나로
  // CSRF 검사만 건너뛰고 남의 자격으로 요청이 나간다. 쿠키가 없을 때만 건너뛴다.
  if (!req.cookies?.sb_access && req.headers.authorization?.startsWith('Bearer ')) return next();
  // 쿠키 인증일 때만 CSRF 검증: sb_csrf 쿠키와 X-CSRF-Token 헤더 비교
  const cookieToken = req.cookies?.sb_csrf;
  const headerToken = req.headers['x-csrf-token'];
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'CSRF token mismatch' });
  }
  next();
});

// 본체에 같이 들어 있던 사진을 photos.json 으로 옮긴다.
//
// 사진은 크고(한 장 최대 2MB) 드물게 바뀌는데, 본체는 기록 하나마다 통째로 다시 쓰인다.
// 같이 두면 세트 하나 저장할 때마다 사진 전부를 다시 쓰는 셈이었다 —
// 사람 열 명이 세 장씩 채우면 60MB 짜리 파일을 매번 다시 쓴다 (힙은 256MB 다)
try {
  const moved = db.migratePhotos();
  if (moved > 0) console.log(`[DB] 사진 ${moved}장을 photos.json 으로 옮겼습니다`);
} catch (e) { console.error('[DB] 사진 옮기기 실패:', e.message); }

// 있는 그대로 적혀 있던 옛 refresh token 을 걷어낸다.
//
// 이제 해시로 담는다. 옛 줄은 못 알아보므로 그냥 두면 만료될 때까지 파일에 남는데,
// 그 줄들이 바로 새면 안 되는 값이다. 몇 줄이었는지 적어둔다 — 그만큼의 사람이
// 한 번 다시 로그인해야 한다는 뜻이다
try {
  const dropped = db.dropLegacyRefreshTokens();
  if (dropped > 0) console.log(`[DB] 옛 방식으로 저장돼 있던 로그인 유지 ${dropped}건을 걷어냈습니다 (그만큼 다시 로그인해야 합니다)`);
} catch (e) { console.error('[DB] 옛 토큰 정리 실패:', e.message); }

// 파일에 남아 있던 차단을 램으로 올린다.
//
// **막아놓은 것은 서버가 다시 떠도 막힌 채여야 한다.** 8/31 까지 차단은 램에만 있어서
// 재시작 한 번이면 영구 차단까지 통째로 풀렸다 — Render 무료 플랜은 15분만 놀아도
// 프로세스를 내리므로, 공격자가 할 일은 기다리는 것뿐이었다.
try {
  const restored = aiGuard.hydrateBlocks();
  if (restored > 0) console.log(`[GUARD] 막아둔 주소 ${restored}건을 그대로 이어받았습니다`);
} catch (e) { console.error('[GUARD] 차단 목록 읽기 실패:', e.message); }

// 만료된 refresh token 정리 + 유예가 끝난 계정 삭제 (30분마다)
//
// 계정 삭제는 30일 뒤에 **실제로** 지워야 한다. 예약만 해두고 지우지 않으면
// 「30일 뒤에 지웁니다」가 거짓말이 된다. 스케줄러를 따로 들이지 않고 이미 도는
// 청소에 얹는다 — 서버가 꺼져 있던 동안 지날 때가 지난 것도 켜지면 곧 걷힌다.
function sweepDeletedAccounts() {
  for (const user of db.dueDeletions()) {
    db.deleteUserCompletely(user.id);
    console.log(`[CLEANUP] 유예가 끝난 계정을 지웠습니다 (id=${user.id})`);
  }
}
setInterval(() => {
  try { db.cleanExpiredRefreshTokens(); } catch (e) { console.error('[CLEANUP]', e.message); }
  // 지날 때가 지난 차단과 다 식은 로그인 실패 줄도 같이 걷는다 —
  // 안 걷으면 시도한 주소 수만큼 파일이 커진다
  try { db.cleanExpiredBlocks(); } catch (e) { console.error('[CLEANUP:block]', e.message); }
  try { db.cleanLoginFails(24 * 60 * 60 * 1000); } catch (e) { console.error('[CLEANUP:login]', e.message); }
  try { sweepDeletedAccounts(); } catch (e) { console.error('[CLEANUP:account]', e.message); }
}, 30 * 60 * 1000);
// 켜질 때도 한 번 본다 — 서버가 꺼져 있는 동안 지날 때가 지난 것이 있다
try { sweepDeletedAccounts(); } catch (e) { console.error('[CLEANUP:account]', e.message); }

// 글로벌 Rate Limit — 숫자는 config/security.js 에 있다 (보안 대시보드가 같은 값을 읽는다)
app.use(rateLimit({
  ...RATE_LIMITS.global,
  message: { error: '요청이 너무 잦아요. 잠시 뒤에 다시 해주세요' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// 인증 관련 엄격한 Rate Limit
const authLimiter = rateLimit({
  ...RATE_LIMITS.login,
  message: { error: '너무 여러 번 시도했어요. 잠시 뒤에 다시 해주세요' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/send-code', rateLimit({
  ...RATE_LIMITS.authCode,
  message: { error: '요청이 너무 잦아요. 잠깐만 기다려주세요' },
}));
app.use('/api/auth/verify-code', rateLimit({
  ...RATE_LIMITS.verifyCode,
  message: { error: '너무 여러 번 시도했어요. 잠시 뒤에 다시 해주세요' },
}));
// 비밀번호를 바꾸는 두 자리도 같은 값으로 묶는다.
//
// 여기만 전용 제한이 없었다 — 전역 제한(분당 100)에만 걸렸다. 안쪽에서 인증번호를
// 다섯 번 틀리면 번호를 버리게 돼 있지만, 그건 한 이메일에 대한 이야기다.
// 이메일을 바꿔가며 두드리는 것은 전역 제한만으로는 느슨하다
app.use('/api/auth/reset-password', rateLimit({
  ...RATE_LIMITS.verifyCode,
  message: { error: '너무 여러 번 시도했어요. 잠시 뒤에 다시 해주세요' },
}));
app.use('/api/auth/password', rateLimit({
  ...RATE_LIMITS.verifyCode,
  message: { error: '너무 여러 번 시도했어요. 잠시 뒤에 다시 해주세요' },
}));

// 계정 삭제도 비밀번호를 받는 자리다 — 같은 값으로 묶는다
app.use('/api/auth/delete', rateLimit({
  ...RATE_LIMITS.verifyCode,
  message: { error: '너무 여러 번 시도했어요. 잠시 뒤에 다시 해주세요' },
}));

app.use('/api/auth/check-username', rateLimit({
  ...RATE_LIMITS.checkName,
  message: { error: '요청이 너무 잦아요. 잠시 뒤에 다시 해주세요' },
}));
app.use('/api/auth/check-email', rateLimit({
  ...RATE_LIMITS.checkEmail,
  message: { error: '요청이 너무 잦아요. 잠시 뒤에 다시 해주세요' },
}));

// OAuth Rate Limit (IP당 시간당 10회)
app.use('/api/oauth', rateLimit({
  ...RATE_LIMITS.oauth,
  message: { error: '로그인을 너무 여러 번 시도했어요. 잠시 뒤에 다시 해주세요' },
}));

// API 보안 헤더 (JSON 응답에 추가 보호)
app.use('/api', (req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cache-Control', 'no-store');
  next();
});

// API 응답 캐싱 (변경이 드문 공개 엔드포인트)
app.use('/api/routines', (req, res, next) => {
  res.set('Cache-Control', 'public, max-age=3600'); // 1시간
  next();
});

// 라우터 연결
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/workouts',    require('./routes/workouts'));
app.use('/api/inbody',      require('./routes/inbody'));
app.use('/api/routines',    require('./routes/routines'));
app.use('/api/oauth',       require('./routes/oauth'));
app.use('/api/security',    require('./routes/security'));
app.use('/api/measures',    require('./routes/measures'));
app.use('/api/my-routines', require('./routes/myRoutines'));
app.use('/api/reports',     require('./routes/reports'));
app.use('/api/ratings',     require('./routes/ratings'));
app.use('/api/maintenance', require('./routes/maintenance'));
app.use('/api/photos',      require('./routes/photos'));
app.use('/api/faq-gaps',    require('./routes/faqGaps'));
app.use('/api/reminders',   require('./routes/reminders'));
app.use('/api/routine-session', require('./routes/routineSession'));
app.use('/api/plans',       require('./routes/plans'));
app.use('/api/export',      require('./routes/export'));

// 프론트엔드 정적 파일 서빙 (SPA용 완화된 CSP 적용)
const path = require('path');
const frontendDist = path.join(__dirname, '../../frontend/dist');
const spaCSP = (req, res, next) => {
  res.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://api.open-meteo.com https://wger.de",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; '));
  next();
};
app.use(spaCSP, express.static(frontendDist, {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
  etag: true,
  lastModified: true,
}));

// 헬스체크 (프로덕션에서는 최소 정보만)
app.get('/api/health', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.json({ status: 'OK' });
  }
  const mem = process.memoryUsage();
  res.json({
    status: 'OK',
    uptime: Math.floor(process.uptime()),
    memory: { rss: Math.round(mem.rss / 1024 / 1024), heap: Math.round(mem.heapUsed / 1024 / 1024) },
  });
});

// SPA 폴백 — API가 아닌 모든 요청은 index.html로
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  spaCSP(req, res, () => {
    res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
      if (err) res.status(500).send('화면을 불러오지 못했어요. 잠시 뒤에 다시 열어주세요.');
    });
  });
});

// 전역 에러 핸들러 (내부 정보 노출 방지)
app.use((err, req, res, next) => {
  // CORS 에러는 403으로
  if (err.message === 'CORS not allowed') {
    return res.status(403).json({ error: '허용되지 않은 곳에서 온 요청이에요' });
  }
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.message);
  }
  res.status(500).json({ error: '서버에 문제가 생겼어요. 잠시 뒤에 다시 해주세요' });
});

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  // 운동 알림 — VAPID 키가 없으면 스스로 안 뜬다 (설정이 없다고 서버가 못 뜨면 안 된다)
  require('./utils/reminderRunner').start();
});

// 서버 타임아웃 (Render 무료 = 30초 제한이므로 여유 있게)
server.keepAliveTimeout = 65000; // ALB/프록시 뒤에서 소켓 유지
server.headersTimeout = 66000;
server.timeout = 25000; // 요청 처리 최대 25초 (Render 30초 제한 여유)

// graceful shutdown (DB flush 보장)
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed, flushing DB...');
    process.exit(0); // exit 이벤트에서 _flush 호출됨
  });
  // 10초 안에 종료 안 되면 강제 종료
  setTimeout(() => { console.error('Forced shutdown'); process.exit(1); }, 10000);
});
