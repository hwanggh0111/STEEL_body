const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db     = require('../db');
const { BCRYPT_ROUNDS } = require('../config/security');
const { addLog } = require('./security');
const { recordLoginFailure } = require('../middleware/aiGuard');

// ── 인증번호는 파일에 둔다 ──
//
// 9/30 까지는 이 파일의 객체 하나였다(램). 그러면 **서버가 다시 뜰 때 사라진다** —
// 배포할 때마다, 그리고 Render 무료 판은 조용하면 잠들었다 깨므로, 비밀번호를
// 재설정하는 **도중에** 번호가 없어져 「인증번호를 먼저 발송해주세요」로 떨어졌다.
// 로그인 실패 카운터를 파일로 옮긴 것과 같은 까닭이다.
//
// 파일에 두니 **번호를 그대로 적을 수 없다.** 그 여섯 자리 하나로 비밀번호를
// 바꿀 수 있는 값이다 — 리프레시 토큰처럼 sha256 만 적고, 맞춰볼 때도 해시끼리 본다.
// 메일 주소를 같이 넣어 섞는다(한 해시를 다른 주소에 못 쓰게).
const CODE_TTL = 5 * 60 * 1000;
const CODE_MAX_ATTEMPTS = 5;

// 인증번호는 **비밀번호를 바꾸는 열쇠**다. Math.random() 은 예측 가능한 난수라
// 여기에 쓰면 안 된다 (seed 를 알면 다음 값이 나온다). crypto 로 만든다
function makeCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashCode(email, code) {
  return crypto.createHash('sha256').update(String(email) + ':' + String(code)).digest('hex');
}

// 번호 맞춰보기. verify-code 와 reset-password 가 **같은 판단**을 해야 해서 한 곳에 둔다
// (따로 적혀 있던 동안 둘이 조금씩 달라질 수 있는 자리였다).
// 돌려주는 것: 통과면 null, 아니면 그대로 보낼 { status, error }
// 번호가 맞나 본다. 맞으면 `null`, 틀리면 `{ status, error }`.
//
// ── 맞은 번호는 횟수를 안 깎는다 ── (2026-10-06)
//
// `bumpVerifyAttempt` 는 주석까지 **「틀린 횟수를 하나 올리고」**라고 적혀 있는데,
// 여기서는 **비교하기 전에** 불러서 맞은 번호도 똑같이 깎고 있었다. 한 번에 맞히는
// 사람도 다섯 번 중 하나를 쓰고 있었던 셈이다.
//
// 그게 그냥 아까운 정도가 아니다. 가입 화면을 **메일 확인 · 계정 만들기 두 걸음**으로
// 나누면서 번호를 **두 번** 본다 — 1걸음에서 「맞다」를 말해주려고 한 번(`/verify-code`),
// 가입할 때 서버가 또 한 번. 맞은 번호가 횟수를 깎으면 **한 번에 다 맞힌 사람이
// 다섯 번 중 둘을 쓴다.**
//
// 틀린 횟수를 막는 까닭은 **찍어보는 것**을 막으려는 것이다(여섯 자리는 백만 가지뿐이다).
// 맞힌 사람은 찍은 것이 아니다. 그래서 **틀렸을 때만** 깎는다 — 막는 힘은 그대로다.
function checkCode(email, code) {
  const row = db.getVerifyCode(email);
  if (!row) return { status: 400, error: '인증번호를 먼저 발송해주세요' };

  // 이미 넘긴 사람은 **비교도 하지 않는다.** 깎는 자리가 아래로 내려갔으니
  // 넘겼는지는 여기서 쌓인 수로 본다
  if ((row.attempts || 0) >= CODE_MAX_ATTEMPTS) {
    db.clearVerifyCode(email);
    return { status: 429, error: '시도 횟수 초과. 인증번호를 다시 발송해주세요' };
  }

  // 타이밍 공격 방지 — 길이가 같은 해시끼리 상수 시간 비교
  const typed = hashCode(email, String(code).slice(0, 6).padEnd(6, '0'));
  const same = crypto.timingSafeEqual(Buffer.from(row.hash, 'hex'), Buffer.from(typed, 'hex'));
  if (!same || String(code).length !== 6) {
    // **틀린 것만 깎는다**
    if (db.bumpVerifyAttempt(email) >= CODE_MAX_ATTEMPTS) {
      db.clearVerifyCode(email);
      return { status: 429, error: '시도 횟수 초과. 인증번호를 다시 발송해주세요' };
    }
    return { status: 400, error: '인증번호가 틀렸어요' };
  }
  return null;
}

// ── 로그인 실패 추적 ──
//
// 8/31 까지는 이 파일의 `loginAttempts` 객체 하나였고, 열쇠가 **`IP + 이메일`** 이었다.
// 그 조합은 무차별 대입 둘 다를 못 잡는다.
//
//   1. **한 계정을 IP 를 바꿔가며** 두들기기 — 프록시 목록만 있으면 IP 당 두 번씩만
//      시도하면 된다. 조합 카운터는 영영 5에 못 닿는다
//   2. **한 IP 에서 계정을 바꿔가며** 두들기기(크리덴셜 스터핑) — 어디서 샌 이메일·
//      비밀번호 목록을 그대로 붓는 방식이다. 이메일이 바뀔 때마다 카운터가 새로 시작한다
//
// 그래서 열쇠를 둘로 나눈다 — **계정별**(IP 무관)과 **IP별**(계정 무관).
// 그리고 램이 아니라 파일에 센다. 서버가 다시 뜨면 카운터가 0이 되던 것도 같은 구멍이다.
//
// **계정별 열쇠는 「친 아이디」로 만든다** (있는 계정인지 보지 않는다). 없는 계정은
// 401 인데 있는 계정만 429 가 되면, 그 차이가 「이 아이디는 있다」는 답이 된다.
//
// 계정을 잠그는 것은 **남이 일부러 잠글 수 있다**(그 사람 아이디로 열 번 틀리면 된다).
// 그래서 15분으로 짧게 두고, 그동안에도 비밀번호 찾기는 열려 있다. 잠금을 아예 안 두면
// 목록을 가진 쪽이 하루 종일 두들길 수 있어서, 둘 중에는 이쪽이 낫다.
const LOGIN_WINDOW = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;      // 계정 하나에 틀린 시도 열 번 (IP 를 바꿔도 같이 센다)
const LOGIN_MAX_PER_IP = 20;        // 한 주소에서 스무 번 (계정을 바꿔도 같이 센다)
const LOGIN_LOCK_TIME = 15 * 60 * 1000; // 15분

// 친 아이디를 하나의 말로 맞춘다 — 대소문자와 앞뒤 공백으로 카운터를 피할 수 있으면 안 된다
const loginKeyOf = (typed) => 'acct:' + String(typed || '').trim().toLowerCase();

const { REFRESH_REUSE_GRACE_MS } = require('../config/security');
const { sanitize, cleanName } = require('../utils/sanitize');
const { issueTokens } = require('../utils/tokens');
const { sendVerificationCode, SMTP_CONFIGURED, warmMailer } = require('../utils/mailer');

// 이메일 형식 검증
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── 메일을 보낼 수 있는 상태인가 ──
//
// 「비밀번호 찾기」는 **메일이 되어야** 되는 기능인데, 지금까지는 눌러서 보내봐야
// 알았다(서버가 「일시적으로 비활성화됐어요」라고 답했다). 막힌 단추를 누르기 전에
// 알려주는 쪽이 맞다 — 설정함의 운동 알림 줄을 9/30 에 고친 것과 같은 종류다.
//
// 소셜 단추를 그릴지 묻는 `/api/oauth/providers` 와 같은 모양으로 둔다.
// **열쇠 값은 절대 내보내지 않는다.** 되는지 안 되는지만 말한다.
router.get('/mail-status', (req, res) => {
  const dev = process.env.NODE_ENV !== 'production';
  // ── 여기서 메일 꾸러미를 **미리 데운다** ── (2026-10-07)
  //
  // `nodemailer` 는 쓸 때 불러오게 돼 있다(`utils/mailer.js`). 그건 맞다 —
  // 뜨는 자리에서 불러오면 **46ms** 가 더 붙는다(재봤다).
  //
  // 그런데 그 값을 **누군가는 치른다.** 여태는 「번호 받기」를 처음 누른 사람이었다.
  // Render 무료 판은 잠들었다 깨므로 **깰 때마다 그 사람이 또 생긴다.**
  //
  // 이 길은 **가입 화면과 비밀번호 찾기 화면이 열릴 때** 부른다 — 「메일을 보낼 수
  // 있는 자리인가」를 누르기 전에 묻는 자리다(2026-10-01). 그 사람이 메일 주소를
  // 치는 동안 꾸러미가 올라온다. **뜨는 길도 안 건드리고, 누르는 순간도 안 막는다.**
  //
  // 뜬 뒤에 타이머로 데우는 길도 있었는데 그건 안 했다 — node 는 한 줄로 돌아서
  // 그 46ms 동안 **그때 들어온 사람이 멈춘다.** 여기는 이미 그 사람의 차례다.
  warmMailer();
  res.json({
    // 메일이 실제로 나가는가
    mail: SMTP_CONFIGURED,
    // 번호를 받아볼 수 있는가 — 내 컴퓨터에서는 열쇠가 없어도 응답에 번호가 실린다
    canSend: SMTP_CONFIGURED || dev,
    dev,
  });
});

// 번호가 맞나만 본다 (2026-10-06).
//
// 가입 화면을 **메일 확인 · 계정 만들기 두 걸음**으로 나누면서 필요해졌다.
// 앞서는 번호를 **가입할 때** 한 번만 봤다 — 그러면 1걸음에서 번호를 적고 넘어가도
// 맞는지 알 길이 없고, 2걸음의 칸을 다 채운 **마지막에** 「번호가 틀렸어요」가 뜬다.
// 걸음을 나눈 까닭이 바로 그 헛수고를 없애려는 것인데, 확인을 미루면 그대로 남는다.
//
// **번호를 지우지 않는다.** 가입할 때 서버가 다시 본다 — 여기서 지우면 가입이
// 「인증번호를 먼저 발송해주세요」로 막힌다. 맞은 번호는 횟수를 안 깎으므로
// (`checkCode` 를 보라) 두 번 봐도 값이 안 든다.
//
// **계정을 만들지 않는다.** 여기는 「이 주소의 주인인가」만 답하는 자리다.
router.post('/verify-code', (req, res) => {
  const { email, code } = req.body;
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: '올바른 이메일을 입력해주세요' });
  }
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: '이메일로 받은 인증번호를 입력해주세요' });
  }
  const bad = checkCode(email, code);
  if (bad) return res.status(bad.status).json({ error: bad.error });
  res.json({ verified: true });
});

// 인증번호 발송
router.post('/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: '올바른 이메일을 입력해주세요' });
  }

  db.cleanVerifyCodes();
  const code = makeCode();
  db.putVerifyCode(email, hashCode(email, code), CODE_TTL);

  // SMTP 미설정 + production: 인증 메일 발송 인프라 없음 → 명확한 안내
  if (process.env.NODE_ENV === 'production' && !SMTP_CONFIGURED) {
    db.clearVerifyCode(email);
    console.error('[AUTH] SMTP 미설정 — 인증번호 발송 불가. 환경변수 SMTP_HOST/USER/PASS 설정 필요');
    return res.status(503).json({
      error: '이메일 인증이 일시적으로 비활성화됐어요. 관리자에게 문의해주세요',
    });
  }

  // SMTP 설정되어 있으면 실제 발송, 아니면 dev 모드에서 응답에 포함
  const sent = await sendVerificationCode(email, code);

  if (!sent && process.env.NODE_ENV === 'production' && SMTP_CONFIGURED) {
    // SMTP 설정되어 있는데 발송 실패한 경우
    db.clearVerifyCode(email);
    return res.status(500).json({ error: '메일 발송에 실패했어요. 잠시 후 다시 시도해주세요' });
  }

  res.json({
    message: '인증번호가 발송됐어요',
    // **번호를 응답에 싣는 두 경우.** 둘 다 내 컴퓨터(`NODE_ENV !== 'production'`) 에서만이다 —
    // 번호 하나로 남의 가입을 가로채고 비밀번호를 바꿀 수 있으니, 배포에서는 절대 안 싣는다.
    //
    //   1. **메일이 안 나갔다**(`!sent`) — SMTP 열쇠가 없는 컴퓨터. 안 실으면 가입을
    //      아예 못 해본다
    //   2. **`DEV_ECHO_CODE=1`** — 열쇠가 있어서 메일은 나갔지만, `npm run smoke` ·
    //      `seed` · `probe` 가 번호를 받아야 한 바퀴를 돌 수 있다. 10/2 에 가입에
    //      인증번호를 붙이자 이 스크립트들이 전부 400 에서 멈췄다.
    //      **`render.yaml` 에는 이 값을 두지 않는다**(둬도 production 이라 안 먹는다)
    ...(process.env.NODE_ENV !== 'production' && (!sent || process.env.DEV_ECHO_CODE === '1')
      ? { code } : {}),
  });
});

// 「인증번호만 따로 확인하는 길」은 **없다** (2026-10-01 에 걷어냄).
//
// `POST /verify-code` 가 있었는데 **앱에서 부르는 데가 한 곳도 없었다.** 비밀번호
// 재설정은 `/reset-password` 가 번호를 직접 확인한다(`checkCode`) — 번호를 미리
// 한 번 맞춰볼 이유가 없었다.
//
// 안 쓰는 길은 **고칠 때 잊히는 길**이다. 로그인 없이 부를 수 있는 자리면 더 그렇다.
//
// 가입에 인증번호를 붙일 때도 **이 모양으로 되살리지 않았다.** 번호를 따로 확인하고
// 그 다음에 가입을 받으면, 그 둘 사이가 비어 있다 — **가입을 받는 그 자리에서**
// 번호를 같이 본다. 10/2 에 `/register` 가 `checkCode` 를 부르게 했다(아래).

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
// 회원가입 — **메일 주인임을 보고 받는다** (2026-10-02)
//
// 그동안 가입은 「그 주소를 적을 수 있는 사람」이면 통과였다. 주소를 적는 것은
// 주인이라는 뜻이 아니고, 그래서 길 둘이 열려 있었다:
//
//   1. **남의 주소로 미리 가입해두기.** 이 앱은 **이메일 하나로 계정을 잇는다**
//      (`oauth.js` 의 `findUserByEmail`). 내 주소로 누가 먼저 이메일 가입을 해두면,
//      내가 구글로 들어올 때 **그 사람이 만든 계정에 붙는다** — 비밀번호는 그 사람이
//      안다. 내 기록을 그 사람이 비밀번호로 들어와 본다
//   2. **관리자 가로채기.** 아래에서 `ADMIN_EMAIL` 과 같은 주소면 `admin` 을 달아준다.
//      배포 직후 빈 DB 에 **그 주소로 먼저 가입하는 사람이 관리자**가 된다
//
// 번호를 확인하면 둘이 한 번에 닫힌다 — 둘 다 「주소가 제 것이 아닌」 경우라서다.
// 소셜은 제공자가 이미 주인을 봤으므로 번호를 묻지 않는다(`oauth.js`).
router.post('/register', async (req, res) => {
  const { email, password, nickname, username, code } = req.body;

  if (!email || !password || !nickname || !username ||
      typeof email !== 'string' || typeof password !== 'string' ||
      typeof nickname !== 'string' || typeof username !== 'string') {
    return res.status(400).json({ error: '모든 항목을 입력해주세요' });
  }
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: '이메일로 받은 인증번호를 입력해주세요' });
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
  // ── 이미 가입된 메일인지 **번호보다 먼저** 본다 ── (2026-10-06)
  //
  // 앞서는 번호 검사가 먼저였다. 그런데 가입이 끝나면 그 메일의 번호를 지우므로
  // (`clearVerifyCode`), **이미 가입된 메일로 다시 제출하면** 번호 검사에 먼저
  // 걸려서 이렇게 답했다 —
  //
  //     {"error":"인증번호를 먼저 발송해주세요"}
  //
  // **틀린 말이다.** 그 사람에게 필요한 말은 「이미 쓰는 메일이에요」다. 저 말을
  // 들은 사람은 번호를 **다시 받으러 가고**, 받아서 넣은 다음에야 비로소
  // 「이미 사용 중인 이메일이에요」를 듣는다 — **한 바퀴 헛걸음**이다.
  // (화면은 `check-email` 로 미리 막지만, 오래 열어둔 탭이나 다른 기기에서 그 사이에
  //  가입한 경우에는 이 길로 온다.)
  //
  // 메일을 찾는 것은 **값이 안 드는 일**이라 번호 앞에 둬도 손해가 없다.
  // 번호가 bcrypt 앞에 있는 까닭(틀린 번호마다 해시 비용을 치르지 않는다)은 그대로다.
  //
  // **없는 메일인지는 여기서 말하지 않는다** — 그건 이미 `check-email` 이 하는 일이고,
  // 가입 자리에서 「그 메일은 있다/없다」를 더 말해야 할 까닭이 없다.
  if (db.findUserByEmail(email)) {
    return res.status(409).json({ error: '이미 사용 중인 이메일이에요' });
  }

  // 번호는 **bcrypt 앞에서** 본다. 뒤에 두면 틀린 번호 하나마다 해시 비용을 치른다
  const bad = checkCode(email, code);
  if (bad) return res.status(bad.status).json({ error: bad.error });

  const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
  if (!hashed || !hashed.startsWith('$2')) {
    return res.status(500).json({ error: '서버 오류가 발생했어요. 다시 시도해주세요' });
  }

  try {
    db.createUser(email, hashed, safeNickname, username);
    // 번호는 **계정이 만들어진 뒤에** 지운다. 여기서 터지는 흔한 까닭은 아이디 중복인데,
    // 먼저 지워버리면 아이디만 바꿔 다시 누를 때 번호를 또 받아야 한다
    db.clearVerifyCode(email);
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
    if (err.message === 'DUPLICATE_EMAIL') return res.status(409).json({ error: '이미 사용 중인 이메일이에요' });
    // **중복이 아닌 것까지 「이미 쓰는 이메일」이라고 답하고 있었다.** 저장이 실패하든
    // 토큰 발급이 터지든 사람에게는 똑같이 보인다 — 멀쩡한 자기 주소를 못 쓰는 줄 알고
    // 다른 이메일로 가입하거나, 그냥 돌아간다. 우리가 터진 것은 우리가 터졌다고 말한다
    console.error('[AUTH] 회원가입 실패:', err.message);
    return res.status(500).json({ error: '가입 중에 문제가 생겼어요. 잠시 뒤에 다시 해주세요' });
  }
});

// 로그인 (Brute Force 방지)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: '아이디(이메일)와 비밀번호를 입력해주세요' });
  }

  // 잠겼는지 먼저 본다 — **비밀번호를 맞춰보기 전에.**
  //
  // bcrypt 는 한 번에 0.2초쯤 쓴다(rounds 12). 잠긴 뒤에도 맞춰보고 나서 막으면,
  // 두들기는 쪽은 답을 못 얻어도 **서버 CPU 는 계속 태운다**. 막을 때는 그 앞에서 막는다.
  const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
  const acctKey = loginKeyOf(email);
  const ipKey = 'ip:' + clientIp;
  const locked = Math.max(db.loginLockLeft(acctKey), db.loginLockLeft(ipKey));
  if (locked > 0) {
    const remaining = Math.ceil(locked / 60000);
    addLog('login_blocked', `Login blocked: ${email} (locked ${remaining}min)`);
    return res.status(429).json({ error: `로그인 시도 초과. ${remaining}분 후 다시 시도해주세요` });
  }

  const user = email.includes('@') ? db.findUserByEmail(email) : db.findUserByUsername(email);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    // 계정별 · IP별 두 자리에 같이 센다 (둘 중 하나만으로는 못 잡는 것이 있다)
    const acct = db.recordLoginFail(acctKey, LOGIN_WINDOW, LOGIN_MAX_ATTEMPTS, LOGIN_LOCK_TIME);
    db.recordLoginFail(ipKey, LOGIN_WINDOW, LOGIN_MAX_PER_IP, LOGIN_LOCK_TIME);
    addLog('login_fail', `Login failed: ${email} (attempt ${acct.count})`);
    // AI Guard에도 로그인 실패 기록 (clientIp는 상단에서 선언됨)
    recordLoginFailure(clientIp);
    return res.status(401).json({ error: '아이디(이메일) 또는 비밀번호가 틀렸어요' });
  }

  // 들어왔으면 그 계정 카운터는 지운다. **IP 쪽은 안 지운다** — 자기 계정 하나를
  // 제대로 로그인해서 스무 번 틀린 흔적을 지우는 길이 되면 안 된다
  db.clearLoginFail(acctKey);

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
    // ── 이미 쓴 토큰이 또 왔다면 그것은 만료가 아니라 **새어나간 것이다** ──
    //
    // 갱신할 때마다 토큰을 새 것으로 바꾼다. 그러니 한 번 쓴 토큰이 다시 오는 경우는
    // 하나뿐이다 — 그 값을 **두 곳이 들고 있다.** 하나는 주인이고 하나는 훔친 쪽이다.
    //
    // 여기서 그냥 401 만 주면 어떻게 되냐면, 먼저 갱신한 쪽(대개 공격자다. 훔치자마자
    // 쓴다)이 새 토큰을 받아 계속 쓰고 **주인이 쫓겨난다.** 누가 진짜인지 서버는
    // 모르므로, 그 계정의 로그인 유지를 **전부** 끊는다. 둘 다 다시 로그인해야 하고
    // 비밀번호를 아는 쪽만 돌아온다.
    const reused = db.findUsedRefreshToken(refreshToken);
    // **탭 두 개는 도둑이 아니다.**
    //
    // 탭을 둘 열어두면 둘 다 같은 쿠키를 들고 있다. 둘이 거의 동시에 갱신을 보내면
    // 두 번째는 이미 쓴 토큰을 들고 도착한다 — 0.2초 늦었을 뿐이다. 여기서 바로
    // 「전부 끊기」를 하면 **탭 두 개 열어둔 사람이 쫓겨난다.** 실제로 이 화면은
    // 한 탭 안에서는 갱신을 하나로 합치지만(`api/client.js`), 탭끼리는 못 합친다.
    //
    // 그래서 방금 쓴 것이면 세션을 끊지 않고 401 만 준다. 화면은 새 쿠키로 다시
    // 갱신하면 되고, 갱신 실패 세 번까지는 로그아웃하지 않는다
    if (reused && Date.now() - new Date(reused.used_at).getTime() < REFRESH_REUSE_GRACE_MS) {
      addLog('refresh_race', `Refresh race (탭 여럿): user ${reused.user_id}`);
      res.clearCookie('sb_access', { path: '/' });
      return res.status(401).json({ error: '잠시 뒤에 다시 시도해주세요' });
    }
    if (reused) {
      db.deleteUserRefreshTokens(reused.user_id);
      addLog('refresh_reuse', `Refresh token reuse detected: user ${reused.user_id} — 모든 세션 종료`);
      const u = db.findUserById(reused.user_id);
      try {
        // 관리자 화면의 보안 기록에도 남긴다 — 사람이 봐야 하는 종류의 일이다
        require('../middleware/aiGuard').noteRefreshReuse(reused.user_id, req.ip || 'unknown', u?.email || '');
      } catch { /* 기록이 안 남아도 세션은 끊는다 */ }
      res.clearCookie('sb_access', { path: '/' });
      res.clearCookie('sb_refresh', { path: '/api/auth' });
      res.clearCookie('sb_csrf', { path: '/' });
      return res.status(401).json({
        error: '보안을 위해 로그인을 모두 끊었어요. 다시 로그인해주세요',
        reason: 'refresh_reuse',
      });
    }
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
  // 쓴 토큰은 **지우지 않고 「썼다」고 적는다.** 지우면 새어나가 다시 온 것인지
  // 그냥 만료된 것인지 구별할 수 없다 — 둘 다 「없는 토큰」이 된다
  db.useRefreshToken(refreshToken);
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
  res.json({
    ...safeUser,
    is_social: db.isSocialAccount(user),
    grace_days: db.GRACE_DAYS,
    // 아이디를 **지금 바꿀 수 있는가**. 0 이면 된다.
    //
    // 화면이 `usernameChangedAt` 에서 직접 세게 두면 **같은 규칙이 두 벌**이 된다 —
    // 30일을 한쪽만 고치는 날 「바꿀 수 있다」고 적어놓고 저장에서 429 를 주게 된다.
    // 규칙은 서버에 하나만 두고 **답만 내려보낸다**
    username_days_left: usernameCooldown(user.usernameChangedAt),
    username_cooldown_days: USERNAME_COOLDOWN_DAYS,
  });
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

// ── 아이디 바꾸기 ── (2026-10-02)
//
// 계정 무리에 **이름 · 비밀번호 · 계정 삭제**는 있었는데 **아이디를 바꿀 길이 없었다.**
// `check-username`(중복 확인)은 가입 때만 쓰이고 있었다 — 절반만 있던 셈이다.
//
// 이것이 필요한 사람은 **소셜로 들어온 사람**이다. 구글로 들어오면 아이디가
// `google_ff791abd` 로 붙는다(`oauth.js` 가 지어준다). 자기가 고른 적이 없는 이름인데
// 로그인 화면에서 쓰는 이름이다.
//
// ── 30일에 한 번 ──
//
// 제한을 둬야 하는 까닭은 **아이디가 남을 가리키는 이름**이기 때문이다. 아무 때나
// 바꿀 수 있으면 쓰던 아이디를 놓고 다른 사람이 그것을 집어, 「그 아이디의 그 사람」이
// 누구인지가 흐려진다. 반대로 아예 못 바꾸게 하면 오타를 영영 못 고친다.
// 그 사이에 둔다 — **오타는 고칠 수 있고, 돌려 쓰기는 느리게.**
//
// **옛 아이디는 안 남긴다.** 남겨두고 로그인까지 받으면 아이디가 둘인 계정이 된다.
const USERNAME_COOLDOWN_DAYS = 30;

/**
 * 며칠을 더 기다려야 하나. **0 이면 지금 바꿀 수 있다.**
 *
 * 판단만 하는 함수로 떼어 둔다 — `npm run id` 가 값으로 본다. 라우터 안에 박아두면
 * 「31일이 지나면 되는가」를 보려고 검사가 날짜를 되돌려야 하고, 그러려면 검사
 * 하나 때문에 DB 에 함수를 늘려야 한다.
 *
 * 두 가지는 **막지 않는다**:
 *   - 한 번도 안 바꾼 사람(`null`). 가입할 때 정한 것은 「바꾼 것」이 아니다
 *   - 날짜가 깨져 있는 경우(`NaN`). 못 읽는 값 때문에 사람을 가두지 않는다
 */
function usernameCooldown(changedAt, now = Date.now()) {
  if (!changedAt) return 0;
  const then = new Date(changedAt).getTime();
  if (!Number.isFinite(then)) return 0;
  const left = USERNAME_COOLDOWN_DAYS - Math.floor((now - then) / 86400000);
  return left > 0 ? left : 0;
}

router.put('/username', require('../middleware/auth'), (req, res) => {
  const { username } = req.body;
  const typed = typeof username === 'string' ? username.trim() : '';
  // 가입과 **같은 규칙**을 쓴다. 여기만 느슨하면 가입에서 막히는 아이디가 바꾸기로는 들어온다
  if (!/^[a-zA-Z0-9!@#$%^&*._-]{4,20}$/.test(typed)) {
    return res.status(400).json({ error: '아이디는 영문+숫자+특수문자(!@#$%^&*._-) 4~20자만 가능해요' });
  }

  const user = db.findUserById(req.userId);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없어요' });

  // 대소문자만 다른 것은 같은 아이디다 — 그걸로 30일을 태우게 하지 않는다
  if (db.usernameKey(user.username) === db.usernameKey(typed)) {
    return res.status(400).json({ error: '지금 쓰는 아이디와 같아요' });
  }

  const left = usernameCooldown(user.usernameChangedAt);
  if (left > 0) {
    return res.status(429).json({
      error: `아이디는 ${USERNAME_COOLDOWN_DAYS}일에 한 번 바꿀 수 있어요. ${left}일 뒤에 다시 해주세요`,
      daysLeft: left,
    });
  }

  try {
    const result = db.updateUserUsername(req.userId, typed);
    if (result.changes === 0) return res.status(404).json({ error: '사용자를 찾을 수 없어요' });
  } catch (err) {
    if (err.message === 'DUPLICATE_USERNAME') {
      return res.status(409).json({ error: '이미 사용 중인 아이디에요' });
    }
    console.error('[AUTH] 아이디 변경 실패:', err.message);
    return res.status(500).json({ error: '아이디를 바꾸지 못했어요. 잠시 뒤에 다시 해주세요' });
  }

  // 아이디로도 로그인한다 — **바뀐 것을 기록에 남긴다.** 로그인 기록을 뒤질 때
  // 「이 아이디가 언제부터 이 사람인가」를 알아야 한다
  addLog('username_change', `Username: ${user.username} -> ${typed} (id=${user.id})`);
  // 바꾼 그 자리에서 **다음은 언제인지**를 같이 준다 — 화면이 30을 적어두지 않아도 된다
  res.json({ username: typed, daysLeft: USERNAME_COOLDOWN_DAYS, message: '아이디가 바뀌었어요' });
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

  const bad = checkCode(email, code);
  if (bad) return res.status(bad.status).json({ error: bad.error });

  // account enumeration 방지: 가입 여부와 무관하게 동일한 성공 응답.
  // 인증번호는 이미 통과했으므로(=메일 받은 사람), 가입된 경우에만 실제 변경.
  const user = db.findUserByEmail(email);

  db.clearVerifyCode(email);

  if (user) {
    const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    if (!hashed || !hashed.startsWith('$2')) {
      return res.status(500).json({ error: '서버 오류. 다시 시도해주세요' });
    }
    db.updateUserPassword(user.id, hashed);
    // **이제 자기 비밀번호를 안다.** 구글로만 가입한 사람이 여기로 들어와 비밀번호를
    // 「만드는」 길이 열려 있다(설정함 · 계정 시트). 적어두지 않으면 그 뒤에도
    // `isSocialAccount` 가 「비밀번호를 모른다」고 답해서, 계정을 지울 때
    // **비밀번호를 안 묻는다** — 덜 안전한 쪽으로 틀린다
    db.markHasPassword(user.id);
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
  // 여기까지 온 사람은 **현재 비밀번호를 맞혔다** — 아는 것이 확실하다
  db.markHasPassword(req.userId);
  db.deleteUserRefreshTokens(req.userId);
  addLog('password_change', `Password changed: userId=${req.userId}`);
  res.json({ message: '비밀번호가 변경됐어요. 다시 로그인해주세요' });
});

// 판단하는 함수는 라우터에 얹어 내보낸다 — `npm run id` 가 값으로 본다
// (`oauth.js` 가 `successUrl` · `findOrCreateUser` 를 내보내는 것과 같은 모양)
router.usernameCooldown = usernameCooldown;
router.USERNAME_COOLDOWN_DAYS = USERNAME_COOLDOWN_DAYS;
// ── 번호 확인은 **한 자리에만 둔다** ── (2026-10-07)
//
// 인스타 · X 로 들어온 사람에게 메일을 물을 때도 번호를 봐야 한다(`oauth.js`).
// 거기에 같은 것을 또 적으면 **한쪽만 고치는 날**이 온다 — 시도 횟수를 깎는 규칙 ·
// 상수 시간 비교 · 맞은 번호는 안 깎는다가 전부 여기 들어 있다.
router.checkCode = checkCode;
router.isValidEmail = isValidEmail;

module.exports = router;
