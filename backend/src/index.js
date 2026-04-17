require('dotenv').config();
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

// 터널/프록시 뒤에서 올바른 프로토콜 감지
app.set('trust proxy', true);

// 보안 헤더
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.open-meteo.com", "https://wger.de", "https://*.lhr.life"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));

// gzip compression
app.use(compression());

// X-Powered-By 헤더 제거
app.disable('x-powered-by');

// AI 자동 관리�� (의심 활동 감지/차단)
app.use(aiGuard);

// CORS
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',');
app.use(cors({
  origin: (origin, callback) => {
    // 개발 환경: 같은 네트워크 허용
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // 개발 환경에서 192.168.x.x (같은 Wi-Fi) 허용
    if (process.env.NODE_ENV !== 'production' && /^http:\/\/192\.168\.\d+\.\d+:\d+$/.test(origin)) {
      return callback(null, true);
    }
    callback(new Error('CORS not allowed'));
  },
  credentials: true,
}));

// 쿠키 파서
app.use(cookieParser());

// 요청 바디 크기 제한
app.use(express.json({ limit: '3mb' }));

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

// 프론트엔드 정적 파일 서빙 (터널/모바일 지원, CSP 해제)
const path = require('path');
const frontendDist = path.join(__dirname, '../../frontend/dist');
const noCSP = (req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  next();
};
app.use(noCSP, express.static(frontendDist));

// 헬스체크
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

// SPA 폴백 — API가 아닌 모든 요청은 index.html로
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.removeHeader('Content-Security-Policy');
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// 전역 에러 핸들러 (내부 정보 노출 방지)
app.use((err, req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.message);
  }
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
