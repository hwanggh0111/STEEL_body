const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db     = require('../db');
const { BCRYPT_ROUNDS } = require('../config/security');
const { addLog } = require('./security');
const { recordLoginFailure } = require('../middleware/aiGuard');

// 인증번호 저장소 (메모리) + 실패 횟수 추적
const verifyStore = {};
const verifyAttempts = {};

// 인증번호는 **비밀번호를 바꾸는 열쇠**다. Math.random() 은 예측 가능한 난수라
// 여기에 쓰면 안 된다 (seed 를 알면 다음 값이 나온다). crypto 로 만든다
function makeCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

// 안 쓴 번호를 걷어낸다.
//
// 5분이 지나면 못 쓰는 값인데도 메모리에 그대로 남아 있었다. 한 번에 죽을 만큼은
// 아니지만 오래 켜두면 계속 쌓인다 — 새 번호를 만들 때마다 지난 것을 훑는다.
function sweepExpired(now = Date.now()) {
  for (const [email, v] of Object.entries(verifyStore)) {
    if (!v || now > v.expires) {
      delete verifyStore[email];
      delete verifyAttempts[email];
    }
  }
}

// 로그인 실패 추적
const loginAttempts = {};
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_TIME = 15 * 60 * 1000; // 15분

const { sanitize, cleanName } = require('../utils/sanitize');
const { issueTokens } = require('../utils/tokens');
const { sendVerificationCode, SMTP_CONFIGURED } = require('../utils/mailer');

// 이메일 형식 검증
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// 인증번호 발송
router.post('/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: '올바른 이메일을 입력해주세요' });
  }

  sweepExpired();
  const code = makeCode();
  verifyStore[email] = { code, expires: Date.now() + 5 * 60 * 1000 };
  verifyAttempts[email] = 0;

  // SMTP 미설정 + production: 인증 메일 발송 인프라 없음 → 명확한 안내
  if (process.env.NODE_ENV === 'production' && !SMTP_CONFIGURED) {
    delete verifyStore[email];
    console.error('[AUTH] SMTP 미설정 — 인증번호 발송 불가. 환경변수 SMTP_HOST/USER/PASS 설정 필요');
    return res.status(503).json({
      error: '이메일 인증이 일시적으로 비활성화됐어요. 관리자에게 문의해주세요',
    });
  }

  // SMTP 설정되어 있으면 실제 발송, 아니면 dev 모드에서 응답에 포함
  const sent = await sendVerificationCode(email, code);

  if (!sent && process.env.NODE_ENV === 'production' && SMTP_CONFIGURED) {
    // SMTP 설정되어 있는데 발송 실패한 경우
    delete verifyStore[email];
    return res.status(500).json({ error: '메일 발송에 실패했어요. 잠시 후 다시 시도해주세요' });
  }

  res.json({
    message: '인증번호가 발송됐어요',
    // dev 모드 + SMTP 미설정일 때만 응답에 코드 포함 (편의)
    ...(process.env.NODE_ENV !== 'production' && !sent ? { code } : {}),
  });
});

// 인증번호 확인 (Brute Force 방지)
router.post('/verify-code', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code || typeof email !== 'string' || typeof code !== 'string') return res.status(400).json({ error: '이메일과 인증번호를 입력해주세요' });

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

  // 타이밍 공격 방지 (고정 길이 패딩 후 상수 시간 비교)
  const codeStr = String(code).slice(0, 6).padEnd(6, '0');
  const storedStr = String(stored.code).slice(0, 6).padEnd(6, '0');
  const codeMatch = crypto.timingSafeEqual(Buffer.from(storedStr), Buffer.from(codeStr));
  if (!codeMatch || String(code).length !== 6) {
    return res.status(400).json({ error: '인증번호가 틀렸어요' });
  }

  delete verifyStore[email];
  delete verifyAttempts[email];
  res.json({ message: '인증 완료!', verified: true });
});

// 이메일 중복 확인
router.post('/check-email', (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') return res.status(400).json({ error: '이메일을 입력해주세요' });
  if (!isValidEmail(email)) return res.status(400).json({ error: '올바른 이메일 형식이 아니에요' });
  const exists = db.findUserByEmail(email);
  if (exists) return res.json({ available: false, message: '이미 가입된 이메일이에요' });
  res.json({ available: true, message: '사용 가능한 이메일이에요' });
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

  if (!email || !password || !nickname || !username ||
      typeof email !== 'string' || typeof password !== 'string' ||
      typeof nickname !== 'string' || typeof username !== 'string') {
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
  // 새니타이즈까지 끝낸 뒤에 본다. `'   '` 도 `'<<<>>>'` 도 여기서는 빈 이름이 되는데,
  // 길이만 재고 넘기면 **이름 없는 계정**이 만들어진다 — 닉네임은 홈 인사부터
  // 관리자 사용자 목록까지 온 앱에 나오는 이름이다
  const safeNickname = cleanName(nickname, 30);
  if (!safeNickname) {
    return res.status(400).json({ error: '닉네임은 1~30자여야 해요' });
  }
  const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
  if (!hashed || !hashed.startsWith('$2')) {
    return res.status(500).json({ error: '서버 오류가 발생했어요. 다시 시도해주세요' });
  }

  try {
    db.createUser(email, hashed, safeNickname, username);
    addLog('register', `New user: ${email} (${username})`);

    // 가입 직후 자동 로그인 — 토큰/쿠키 발급
    const newUser = db.findUserByEmail(email);
    if (process.env.ADMIN_EMAIL && db.emailKey(newUser.email) === db.emailKey(process.env.ADMIN_EMAIL) && newUser.role !== 'admin') {
      db.updateUserRole(newUser.id, 'admin');
      newUser.role = 'admin';
    }
    const { accessToken } = issueTokens(res, newUser);
    return res.status(201).json({
      message: '회원가입 완료!',
      token: accessToken,
      nickname: newUser.nickname,
      email: newUser.email,
      role: newUser.role || 'user',
    });
  } catch (err) {
    if (err.message === 'DUPLICATE_USERNAME') return res.status(409).json({ error: '이미 사용 중인 아이디에요' });
    return res.status(409).json({ error: '이미 사용 중인 이메일이에요' });
  }
});

// 로그인 (Brute Force 방지)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: '아이디(이메일)와 비밀번호를 입력해주세요' });
  }

  // 로그인 시도 잠금 확인 (IP + 입력값 조합으로 추적)
  const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
  const key = `${clientIp}:${email.toLowerCase()}`;
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
    // AI Guard에도 로그인 실패 기록 (clientIp는 상단에서 선언됨)
    recordLoginFailure(clientIp);
    return res.status(401).json({ error: '아이디(이메일) 또는 비밀번호가 틀렸어요' });
  }

  // 성공 시 시도 횟수 초기화
  delete loginAttempts[key];

  // 지우기로 해놓고 다시 온 사람. **묻지 않고 되살린다** —
  // 자기 비밀번호로 들어온 사람이 「아직 지우지 마세요」라고 말한 것과 같다.
  // 여기서 한 번 더 물으면 실수로 누른 사람을 두 번 시험하는 것이다
  const restored = db.cancelUserDeletion(user.id);
  if (restored) addLog('account_delete_cancel', `Deletion cancelled by login: ${user.email} (id=${user.id})`);

  // ADMIN_EMAIL이면 자동 관리자 승격
  if (process.env.ADMIN_EMAIL && db.emailKey(user.email) === db.emailKey(process.env.ADMIN_EMAIL) && user.role !== 'admin') {
    db.updateUserRole(user.id, 'admin');
    user.role = 'admin';
  }

  // httpOnly 쿠키에 토큰 설정 (accessToken 재사용)
  const { accessToken } = issueTokens(res, user);

  addLog('login_success', `Login success: ${user.email} (id=${user.id})`);
  res.json({ token: accessToken, nickname: user.nickname, email: user.email, role: user.role || 'user', restored });
});

// 토큰 갱신
router.post('/refresh', (req, res) => {
  const refreshToken = req.cookies?.sb_refresh;
  if (!refreshToken) {
    return res.status(401).json({ error: '로그인이 만료됐어요. 다시 로그인해주세요' });
  }
  const stored = db.findRefreshToken(refreshToken);
  if (!stored) {
    // 토큰이 유효하지 않으면 모든 쿠키 클리어
    res.clearCookie('sb_access', { path: '/' });
    res.clearCookie('sb_refresh', { path: '/api/auth' });
    res.clearCookie('sb_csrf', { path: '/' });
    return res.status(401).json({ error: '로그인이 만료됐어요. 다시 로그인해주세요' });
  }
  const user = db.findUserById(stored.user_id);
  if (!user || user.is_banned) {
    db.deleteRefreshToken(refreshToken);
    return res.status(401).json({ error: '계정을 찾을 수 없거나 정지된 계정이에요' });
  }
  // 기존 refresh token 삭제 (rotation)
  db.deleteRefreshToken(refreshToken);
  // 새 토큰 발급.
  //
  // **새 access token 을 몸통에도 담아 보낸다.** 예전에는 쿠키로만 줬다.
  // 미들웨어는 쿠키를 먼저 보므로 보통은 그걸로 돌아가지만, 쿠키가 막힌 브라우저
  // (사파리 ITP · 시크릿 창 · 서드파티 쿠키 차단)에서는 화면이 계속 **옛 토큰**을
  // 헤더로 보낸다. 그러면 갱신은 200 인데 다음 요청이 또 401 이고, 갱신이 실패한
  // 것이 아니니 실패 횟수도 안 올라간다 — **API 를 부를 때마다 갱신이 나가는 고리**에
  // 갇힌다. 화면은 아무것도 안 되고 서버만 두들겨 맞는다.
  const { accessToken } = issueTokens(res, user);
  res.json({ token: accessToken, nickname: user.nickname, role: user.role || 'user' });
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
  // 계정 삭제 화면이 **무엇을 물어야 하는지**를 여기서 안다. 소셜로만 들어온 사람은
  // 자기 비밀번호를 모르니 비밀번호를 물으면 안 된다
  res.json({ ...safeUser, is_social: db.isSocialAccount(user), grace_days: db.GRACE_DAYS });
});

// ── 계정 삭제 ──
//
// 누르는 순간 지우지 않는다. 30일 잠가두고 그 안에 다시 로그인하면 되살아난다.
// 그동안 서버에 남아 있는 것은 사실이므로 화면에도 그렇게 적는다.
//
// **관리자 계정은 여기서 못 지운다.** 관리자가 사라지면 남은 사람의 제보를 아무도
// 못 보고, 정지된 사람을 아무도 못 풀어준다 — 서비스가 잠긴다.
router.post('/delete', require('../middleware/auth'), async (req, res) => {
  const user = db.findUserById(req.userId);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없어요' });
  if (user.role === 'admin') {
    return res.status(400).json({ error: '관리자 계정은 앱에서 지울 수 없어요' });
  }

  const social = db.isSocialAccount(user);
  if (social) {
    // 비밀번호를 모르는 사람에게는 **자기 이메일을 손으로 적게** 한다.
    // 눌러서 지워지는 것이 아니라 한 번 더 손이 가야 지워진다
    const typed = String(req.body?.confirmEmail || '').trim().toLowerCase();
    if (typed !== String(user.email || '').toLowerCase()) {
      return res.status(400).json({ error: '이메일이 달라요. 쓰시는 이메일을 그대로 적어주세요', need: 'email' });
    }
  } else {
    const password = req.body?.password;
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: '비밀번호를 입력해주세요', need: 'password' });
    }
    if (!(await bcrypt.compare(password, user.password))) {
      addLog('account_delete_fail', `Delete password mismatch: ${user.email} (id=${user.id})`);
      return res.status(401).json({ error: '비밀번호가 틀렸어요', need: 'password' });
    }
  }

  const info = db.requestUserDeletion(user.id);
  addLog('account_delete_request', `Deletion requested: ${user.email} (id=${user.id}, due=${info.delete_due_at})`);

  // 예약과 동시에 로그아웃시킨다 — 잠갔다면서 그 기기에서 계속 쓰이면 안 된다
  res.clearCookie('sb_access', { path: '/' });
  res.clearCookie('sb_refresh', { path: '/api/auth' });
  res.clearCookie('sb_csrf', { path: '/' });
  res.json({ ...info, grace_days: db.GRACE_DAYS });
});

// 성별 — 인바디 참고 범위에만 쓴다.
//
// 'male' · 'female' · null(안 알려줌) 셋뿐이다. 안 알려줘도 인바디 화면은 그대로
// 돌아간다 — 범위를 안 그리고 숫자와 변화만 보여준다.
// 나이는 안 받는다. 범위를 조금 더 정밀하게 하자고 개인정보를 늘릴 이유가 없다.
router.put('/sex', require('../middleware/auth'), (req, res) => {
  const { sex } = req.body;
  if (sex !== 'male' && sex !== 'female' && sex !== null) {
    return res.status(400).json({ error: '성별 값이 올바르지 않아요' });
  }
  const result = db.updateUserSex(req.userId, sex);
  if (result.changes === 0) return res.status(404).json({ error: '사용자를 찾을 수 없어요' });
  res.json({ sex });
});

// 닉네임 변경
router.put('/nickname', require('../middleware/auth'), (req, res) => {
  const { nickname } = req.body;
  // 배열이 오면 `.trim()` 이 없어서 여기서 500 이 났다 — 사용자 잘못인데 서버 잘못처럼 답했다
  const safeNickname = cleanName(nickname, 30);
  if (!safeNickname) {
    return res.status(400).json({ error: '닉네임은 1~30자여야 해요' });
  }
  const result = db.updateUserNickname(req.userId, safeNickname);
  if (result.changes === 0) return res.status(404).json({ error: '사용자를 찾을 수 없어요' });
  res.json({ nickname: safeNickname, message: '닉네임이 변경됐어요' });
});

// 비밀번호 재설정 (분실 시 — 인증번호 검증 후 새 비밀번호 설정)
router.post('/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword ||
      typeof email !== 'string' || typeof code !== 'string' || typeof newPassword !== 'string') {
    return res.status(400).json({ error: '이메일, 인증번호, 새 비밀번호를 모두 입력해주세요' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: '올바른 이메일 형식이 아니에요' });
  }
  if (newPassword.length < 8 || newPassword.length > 100) {
    return res.status(400).json({ error: '새 비밀번호는 8~100자여야 해요' });
  }
  if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return res.status(400).json({ error: '새 비밀번호는 영문+숫자 조합이어야 해요' });
  }

  // 인증번호 검증 (verify-code와 동일 로직)
  const stored = verifyStore[email];
  if (!stored) return res.status(400).json({ error: '인증번호를 먼저 발송해주세요' });

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

  const codeStr = String(code).slice(0, 6).padEnd(6, '0');
  const storedStr = String(stored.code).slice(0, 6).padEnd(6, '0');
  const codeMatch = crypto.timingSafeEqual(Buffer.from(storedStr), Buffer.from(codeStr));
  if (!codeMatch || String(code).length !== 6) {
    return res.status(400).json({ error: '인증번호가 틀렸어요' });
  }

  // account enumeration 방지: 가입 여부와 무관하게 동일한 성공 응답.
  // 인증번호는 이미 통과했으므로(=메일 받은 사람), 가입된 경우에만 실제 변경.
  const user = db.findUserByEmail(email);

  delete verifyStore[email];
  delete verifyAttempts[email];

  if (user) {
    const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    if (!hashed || !hashed.startsWith('$2')) {
      return res.status(500).json({ error: '서버 오류. 다시 시도해주세요' });
    }
    db.updateUserPassword(user.id, hashed);
    db.deleteUserRefreshTokens(user.id);
    addLog('password_reset', `Password reset: ${email} (id=${user.id})`);
  } else {
    addLog('password_reset_unknown', `Reset attempt for unknown email: ${email}`);
  }

  res.json({ message: '비밀번호가 재설정됐어요. 다시 로그인해주세요' });
});

// 비밀번호 변경
router.put('/password', require('../middleware/auth'), async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return res.status(400).json({ error: '현재 비밀번호와 새 비밀번호를 입력해주세요' });
  }
  if (newPassword.length < 8 || newPassword.length > 100) {
    return res.status(400).json({ error: '새 비밀번호는 8~100자여야 해요' });
  }
  if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return res.status(400).json({ error: '새 비밀번호는 영문+숫자 조합이어야 해요' });
  }
  const user = db.findUserById(req.userId);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없어요' });
  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) return res.status(401).json({ error: '현재 비밀번호가 틀렸어요' });
  const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  if (!hashed || !hashed.startsWith('$2')) {
    return res.status(500).json({ error: '서버 오류. 다시 시도해주세요' });
  }
  // 비밀번호 변경 + 모든 refresh token 무효화
  db.updateUserPassword(req.userId, hashed);
  db.deleteUserRefreshTokens(req.userId);
  addLog('password_change', `Password changed: userId=${req.userId}`);
  res.json({ message: '비밀번호가 변경됐어요. 다시 로그인해주세요' });
});

module.exports = router;
