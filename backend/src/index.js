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
  permissionsPolicy: {
    features: {
      camera: ["'none'"],
      microphone: ["'none'"],
      geolocation: ["'none'"],
    },
  },
}));

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

// AI 자동 관리�� (의심 활동 감지/차단)
app.use(aiGuard);

// CORS
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',');
app.use(cors({
  origin: (origin, callback) => {
    // 같은 서버 (프록시, SSR) 또는 허용 목록
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    // Render 도메인 (*.onrender.com)
    if (origin.endsWith('.onrender.com')) return callback(null, true);
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
  limit: '3mb',
  reviver: (key, value) => {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return undefined;
    return value;
  },
}));

// CSRF 보호 (쿠키 인증 사용 시에만 double-submit cookie 패턴 적용)
app.use((req, res, next) => {
  // GET, HEAD, OPTIONS는 CSRF 검사 생략
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  // 인증/OAuth 경로는 CSRF 검사 생략 (로그인 전이므로)
  if (req.path.startsWith('/api/auth/') || req.path.startsWith('/api/oauth/')) return next();
  // 공개 API는 생략
  if (req.path === '/api/health') return next();
  // Bearer 토큰 사용 시 CSRF 불필요 (브라우저가 자동 전송하지 않음)
  if (req.headers.authorization?.startsWith('Bearer ')) return next();
  // 쿠키 인증일 때만 CSRF 검증: sb_csrf 쿠키와 X-CSRF-Token 헤더 비교
  const cookieToken = req.cookies?.sb_csrf;
  const headerToken = req.headers['x-csrf-token'];
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'CSRF token mismatch' });
  }
  next();
});

// 만료된 refresh token 정리 (5분마다)
setInterval(() => { try { db.cleanExpiredRefreshTokens(); } catch {} }, 5 * 60 * 1000);

// 글로벌 Rate Limit (분당 100회)
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// 인증 관련 엄격한 Rate Limit
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 20,
  message: { error: 'Too many attempts. Try again later.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/send-code', rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 3,
  message: { error: 'Too many requests. Wait a moment.' },
}));
app.use('/api/auth/verify-code', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts.' },
}));
app.use('/api/auth/check-username', rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many requests.' },
}));

// OAuth Rate Limit (IP당 시간당 10회)
app.use('/api/oauth', rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many OAuth attempts. Try again later.' },
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
app.use('/api/notices', (req, res, next) => {
  if (req.method === 'GET') res.set('Cache-Control', 'public, max-age=300'); // 5분
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
app.use('/api/notices',     require('./routes/notices'));
app.use('/api/photos',      require('./routes/photos'));
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
      if (err) res.status(500).json({ error: 'Frontend not found' });
    });
  });
});

// 전역 에러 핸들러 (내부 정보 노출 방지)
app.use((err, req, res, next) => {
  // CORS 에러는 403으로
  if (err.message === 'CORS not allowed') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.message);
  }
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
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
