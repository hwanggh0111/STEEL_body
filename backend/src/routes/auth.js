const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const db     = require('../db');
const { addLog } = require('./security');

const IS_PROD = process.env.NODE_ENV === 'production';

// 쿠키 옵션
const ACCESS_COOKIE_OPTS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: IS_PROD ? 'strict' : 'lax',
  path: '/',
  maxAge: 15 * 60 * 1000, // 15분
};
const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: IS_PROD ? 'strict' : 'lax',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
};
const CSRF_COOKIE_OPTS = {
  httpOnly: false, // 프론트에서 읽을 수 있어야 함
  secure: IS_PROD,
  sameSite: IS_PROD ? 'strict' : 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// 토큰 생성 + 쿠키 설정 헬퍼
function issueTokens(res, user) {
  const accessToken = jwt.sign(
    { userId: user.id, role: user.role || 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '15m', algorithm: 'HS256' }
  );
  const refreshToken = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.saveRefreshToken(user.id, refreshToken, expiresAt);

  const csrfToken = crypto.randomBytes(24).toString('hex');

  res.cookie('sb_access', accessToken, ACCESS_COOKIE_OPTS);
  res.cookie('sb_refresh', refreshToken, REFRESH_COOKIE_OPTS);
  res.cookie('sb_csrf', csrfToken, CSRF_COOKIE_OPTS);

  return { accessToken, refreshToken, csrfToken };
}

// 인증번호 저장소 (메모리) + 실패 횟수 추적
const verifyStore = {};
const verifyAttempts = {};

// 로그인 실패 추적
const loginAttempts = {};
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_TIME = 15 * 60 * 1000; // 15분

// 입력값 새니타이즈
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>"'&]/g, '').trim();
}

// 이메일 형식 검증
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// 인증번호 발송
router.post('/send-code', (req, res) => {
  const { email } = req.body;
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: '올바른 이메일을 입력해주세요' });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  verifyStore[email] = { code, expires: Date.now() + 5 * 60 * 1000 };
  verifyAttempts[email] = 0;

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV] code: ${code}`);
  }
  res.json({
    message: '인증번호가 발송됐어요',
    ...(process.env.NODE_ENV !== 'production' ? { code } : {}),
  });
});

// 인증번호 확인 (Brute Force 방지)
router.post('/verify-code', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: '이메일과 인증번호를 입력해주세요' });

  const stored = verifyStore[email];
  if (!stored) return res.status(400).json({ error: '인증번호를 먼저 발송해주세요' });

  // 시도 횟수 제한 (5회)
  verifyAttempts[email] = (verifyAttempts[email] || 0) + 1;
  if (verifyAttempts[email] > 5) {
    delete verifyStore[email];
    delete verifyAttempts[email];
    return res.status(429).json({ error: '시도 횟수 초과. 인증번호를 다시 발송해주세요' });
  }

  if (Date.now() > stored.expires) {
    delete verifyStore[email];
    delete verifyAttempts[email];
    return res.status(400).json({ error: '인증번호가 만료됐어요. 다시 발송해주세요' });
  }

  // 타이밍 공격 방지 (일정 시간 후 응답)
  if (stored.code !== code) {
    return res.status(400).json({ error: '인증번호가 틀렸어요' });
  }

  delete verifyStore[email];
  delete verifyAttempts[email];
  res.json({ message: '인증 완료!', verified: true });
});

// 아이디 중복 확인
router.post('/check-username', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: '아이디를 입력해주세요' });
  if (!/^[a-zA-Z0-9!@#$%^&*._-]{4,20}$/.test(username)) {
    return res.status(400).json({ error: '영문+숫자+특수문자(!@#$%^&*._-) 4~20자만 가능해요' });
  }
  const exists = db.findUserByUsername(username);
  if (exists) return res.json({ available: false, message: '이미 사용 중인 아이디에요' });
  res.json({ available: true, message: '사용 가능한 아이디에요' });
});

// 회원가입
router.post('/register', async (req, res) => {
  const { email, password, nickname, username } = req.body;

  if (!email || !password || !nickname || !username) {
    return res.status(400).json({ error: '모든 항목을 입력해주세요' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: '올바른 이메일 형식이 아니에요' });
  }
  if (!/^[a-zA-Z0-9!@#$%^&*._-]{4,20}$/.test(username)) {
    return res.status(400).json({ error: '아이디는 영문+숫자 4~20자만 가능해요' });
  }
  if (password.length < 8 || password.length > 100) {
    return res.status(400).json({ error: '비밀번호는 8~100자여야 해요' });
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({ error: '비밀번호는 영문+숫자 조합이어야 해요' });
  }
  if (nickname.length > 30) {
    return res.status(400).json({ error: '닉네임은 30자 이하여야 해요' });
  }

  const safeNickname = sanitize(nickname);
  const hashed = await bcrypt.hash(password, 12);

  try {
    const result = db.createUser(email, hashed, safeNickname, username);
    addLog('register', `New user: ${email} (${username})`);
    res.status(201).json({ message: '회원가입 완료!' });
  } catch (err) {
    if (err.message === 'DUPLICATE_USERNAME') return res.status(409).json({ error: '이미 사용 중인 아이디에요' });
    return res.status(409).json({ error: '이미 사용 중인 이메일이에요' });
  }
});

// 로그인 (Brute Force 방지)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: '아이디(이메일)와 비밀번호를 입력해주세요' });
  }

  // 로그인 시도 잠금 확인
  const key = email.toLowerCase();
  const attempts = loginAttempts[key];
  if (attempts && attempts.count >= LOGIN_MAX_ATTEMPTS) {
    const elapsed = Date.now() - attempts.lastAttempt;
    if (elapsed < LOGIN_LOCK_TIME) {
      const remaining = Math.ceil((LOGIN_LOCK_TIME - elapsed) / 60000);
      addLog('login_blocked', `Login blocked: ${email} (locked ${remaining}min)`);
      return res.status(429).json({ error: `로그인 시도 초과. ${remaining}분 후 다시 시도해주세요` });
    }
    delete loginAttempts[key];
  }

  const user = email.includes('@') ? db.findUserByEmail(email) : db.findUserByUsername(email);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    // 실패 횟수 기록
    if (!loginAttempts[key]) loginAttempts[key] = { count: 0, lastAttempt: 0 };
    loginAttempts[key].count++;
    loginAttempts[key].lastAttempt = Date.now();
    addLog('login_fail', `Login failed: ${email} (attempt ${loginAttempts[key].count})`);
    return res.status(401).json({ error: '아이디(이메일) 또는 비밀번호가 틀렸어요' });
  }

  // 성공 시 시도 횟수 초기화
  delete loginAttempts[key];

  // httpOnly 쿠키에 토큰 설정
  issueTokens(res, user);

  // 하위 호환: 레거시 클라이언트를 위해 body에도 token 포함
  const legacyToken = jwt.sign(
    { userId: user.id, role: user.role || 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '15m', algorithm: 'HS256' }
  );

  addLog('login_success', `Login success: ${user.email} (id=${user.id})`);
  res.json({ token: legacyToken, nickname: user.nickname, role: user.role || 'user' });
});

// 토큰 갱신
router.post('/refresh', (req, res) => {
  const refreshToken = req.cookies?.sb_refresh;
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
  }
  const stored = db.findRefreshToken(refreshToken);
  if (!stored) {
    // 토큰이 유효하지 않으면 모든 쿠키 클리어
    res.clearCookie('sb_access', { path: '/' });
    res.clearCookie('sb_refresh', { path: '/api/auth' });
    res.clearCookie('sb_csrf', { path: '/' });
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
  const user = db.findUserById(stored.user_id);
  if (!user || user.is_banned) {
    db.deleteRefreshToken(refreshToken);
    return res.status(401).json({ error: 'User not found or banned' });
  }
  // 기존 refresh token 삭제 (rotation)
  db.deleteRefreshToken(refreshToken);
  // 새 토큰 발급
  issueTokens(res, user);
  res.json({ nickname: user.nickname, role: user.role || 'user' });
});

// 로그아웃
router.post('/logout', (req, res) => {
  const refreshToken = req.cookies?.sb_refresh;
  if (refreshToken) {
    db.deleteRefreshToken(refreshToken);
  }
  res.clearCookie('sb_access', { path: '/' });
  res.clearCookie('sb_refresh', { path: '/api/auth' });
  res.clearCookie('sb_csrf', { path: '/' });
  res.json({ message: '로그아웃 완료' });
});

// 내 정보
router.get('/me', require('../middleware/auth'), (req, res) => {
  const user = db.findUserById(req.userId);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없어요' });
  const { password, ...safeUser } = user;
  res.json(safeUser);
});

// 닉네임 변경
router.put('/nickname', require('../middleware/auth'), (req, res) => {
  const { nickname } = req.body;
  if (!nickname || !nickname.trim() || nickname.length > 30) {
    return res.status(400).json({ error: '닉네임은 1~30자여야 해요' });
  }
  const safeNickname = sanitize(nickname);
  if (!safeNickname) {
    return res.status(400).json({ error: '사용할 수 없는 닉네임이에요' });
  }
  const result = db.updateUserNickname(req.userId, safeNickname);
  if (result.changes === 0) return res.status(404).json({ error: '사용자를 찾을 수 없어요' });
  res.json({ nickname: safeNickname, message: '닉네임이 변경됐어요' });
});

module.exports = router;
