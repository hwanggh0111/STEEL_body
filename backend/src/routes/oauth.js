const router = require('express').Router();
const axios = require('axios');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { BCRYPT_ROUNDS } = require('../config/security');
const { sanitize } = require('../utils/sanitize');
const { issueTokens } = require('../utils/tokens');

const crypto = require('crypto');
const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:5173';
const oauthStates = new Map();
const MAX_OAUTH_STATES = 1000;

const IS_PROD = process.env.NODE_ENV === 'production';

// 허용된 frontend origin 목록 (open redirect 방지)
const ALLOWED_FRONTENDS = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
// Render 가 넣어주는 배포 주소. 배포 이름을 바꿔도 로그인이 끊기지 않게 같이 받는다
const RENDER_ORIGIN = (process.env.RENDER_EXTERNAL_URL || '').trim().replace(/\/$/, '');

// 로그인이 끝난 뒤 돌려보낼 곳. 여기가 헐거우면 열린 리다이렉트가 된다.
//
// 예전에는 `*.onrender.com` 을 통째로 허용했다. Render 는 누구나 배포할 수 있는 곳이라,
// 아무나 띄운 페이지로 로그인한 사람을 실어 보낼 수 있었다는 뜻이다.
// 허용 목록에는 이미 정확한 주소가 들어 있으므로 와일드카드는 필요 없다.
function isAllowedFrontendOrigin(origin) {
  if (!origin) return false;
  const clean = String(origin).replace(/\/$/, '');
  if (ALLOWED_FRONTENDS.includes(clean)) return true;
  if (RENDER_ORIGIN && clean === RENDER_ORIGIN) return true;
  // 개발 환경: localhost / 같은 네트워크 IP
  if (!IS_PROD) {
    try {
      const url = new URL(clean);
      if (url.hostname === 'localhost' || /^127\./.test(url.hostname)) return true;
      if (/^192\.168\.\d+\.\d+$/.test(url.hostname)) return true;
    } catch {}
  }
  return false;
}

// 소셜로 들어온 사람에게도 이메일로 들어온 사람과 **똑같이** 쥐여준다.
//
// 예전에는 이 파일에 쿠키 설정이 통째로 복붙돼 있었다. 값이 같아 보여도 한쪽만 고치는
// 날 두 길이 갈린다 — 「이메일로는 유지되는데 구글로 들어오면 자꾸 풀린다」 같은,
// 원인이 안 보이는 버그가 된다. `utils/tokens.js` 한 곳에서 만든다
const setAuthCookies = issueTokens;

// 요청 기반으로 백엔드/프론트엔드 URL 결정 (모바일/터널 지원)
function getUrls(req) {
  const host = req.get('host') || `localhost:${process.env.PORT || 4000}`;
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  // Host 헤더 검증 (SSRF 방지) - 프로덕션에서 유효하지 않으면 기본 URL 사용
  if (IS_PROD) {
    try {
      const backendHost = new URL(process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 4000}`).host;
      // 여기도 `*.onrender.com` 을 통째로 믿고 있었다. 실제 배포 호스트만 본다
      const renderHost = RENDER_ORIGIN ? new URL(RENDER_ORIGIN).host : '';
      if (host !== backendHost && (!renderHost || host !== renderHost)) {
        return { backendUrl: process.env.BACKEND_URL || FRONTEND, frontendUrl: FRONTEND };
      }
    } catch { return { backendUrl: FRONTEND, frontendUrl: FRONTEND }; }
  }
  const backendUrl = `${protocol}://${host}`;
  const frontendHost = host.replace(/:\d+$/, ':5173');
  const frontendUrl = IS_PROD ? FRONTEND : `${protocol}://${frontendHost}`;
  return { backendUrl, frontendUrl };
}

// 소셜 로그인 공통: 유저 찾거나 생성
async function findOrCreateUser(email, rawNickname, provider, opts = {}) {
  // ── 확인 안 된 이메일로는 계정을 잇지 않는다 ── (2026-09-18)
  //
  // 이 앱은 **이메일 하나로 계정을 잇는다**(`findUserByEmail`). 그래서 제공자가
  // 「이 메일 주소가 이 사람 것인지 확인 안 됐다」고 말해주는데 그걸 안 보면,
  // 남의 메일 주소를 적어둔 계정으로 들어와 **그 사람의 기록을 그대로 받는** 길이 된다.
  // 구글은 `verified_email` 로 알려준다 — **모른다고 할 때가 아니라 아니라고 할 때만** 막는다
  // (필드를 안 주는 제공자도 있어서, 없는 것을 거절로 치면 그쪽이 통째로 막힌다).
  if (opts.emailVerified === false) throw new Error('OAUTH_EMAIL_UNVERIFIED');
  // **이메일이 없으면 계정을 만들지 않는다.**
  //
  // 계정을 찾는 열쇠는 이메일 하나다(`emailKey`). 빈 값이 들어오면 그 열쇠가 `''` 가
  // 되는데, 그러면 이메일 없이 들어온 **서로 다른 사람이 같은 계정 하나로 묶인다.**
  // 남의 운동 기록이 내 화면에 뜬다는 뜻이다. **계정을 만드는 이 한 곳에서** 막는다 —
  // 예전에는 콜백마다 따로 보고 있어서, 안 쓰던 `/google/code` 에만 이 검사가
  // 빠져 있었다(그 길은 10/2 에 걷어냈다). 검사는 길마다가 아니라 자리 하나에 둔다
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    throw new Error('OAUTH_NO_EMAIL');
  }
  // 외부 제공자가 준 닉네임 sanitize + 길이 제한 (XSS 방어)
  const safeNickname = (sanitize(String(rawNickname || '')).slice(0, 30) || (provider + '_user'));
  let user = db.findUserByEmail(email);
  const created = !user;
  if (!user) {
    const randomPw = await bcrypt.hash(require('crypto').randomBytes(32).toString('hex'), BCRYPT_ROUNDS);
    const username = provider + '_' + crypto.randomBytes(4).toString('hex');
    db.createUser(email, randomPw, safeNickname, username);
    user = db.findUserByEmail(email);
    // **소셜이라고 적어 둔다** (2026-10-02). 이 사람은 자기 비밀번호를 모른다
    // (위의 난수다). 여태는 아이디 모양으로 알아봤는데, 아이디를 바꿀 수 있게
    // 되면서 그 증거가 사라질 수 있게 됐다 — `isSocialAccount` 가 보는 값이다
    if (user) db.markSocialAccount(user.id);
  }
  // ADMIN_EMAIL이면 자동 관리자 승격
  if (process.env.ADMIN_EMAIL && db.emailKey(user.email) === db.emailKey(process.env.ADMIN_EMAIL) && user.role !== 'admin') {
    db.updateUserRole(user.id, 'admin');
    user.role = 'admin';
  }
  // 지우기로 해놓고 다시 들어온 사람은 되살린다. 이메일 로그인만 되살리면
  // **소셜로만 쓰던 사람은 되돌릴 길이 없다** — 그쪽은 비밀번호를 모른다
  //
  // 되살렸다는 것도 **화면까지 가져간다.** 이메일 로그인은 「계정이 되살아났어요」를
  // 띄우는데 소셜은 조용했다 — 지워졌는지 살아 있는지 모르는 채로 앱을 쓰게 된다
  const restored = !!db.cancelUserDeletion(user.id);
  return { user, nickname: user.nickname, email: user.email, created, restored };
}

// 로그인이 끝나고 화면으로 돌려보낼 주소.
//
// `created` 를 같이 보낸다. 화면의 「닉네임 정하기」 단계는 **계정이 방금 만들어졌을
// 때만** 나와야 하는데, 그동안은 소셜로 들어올 때마다 나왔다 — 백 번째 로그인에도
// 이름을 다시 확인시키는 것은 로그인에 한 단계를 더 놓는 것이다
function successUrl(frontendUrl, { nickname, email, created, restored }) {
  const q = new URLSearchParams({ oauth: 'success', nickname, email });
  if (created) q.set('created', '1');
  if (restored) q.set('restored', '1');
  return `${frontendUrl}/login?${q}`;
}

// ─── Google ───────────────────────────
// state 를 만들면서 곧바로 등록까지 한다.
//
// 예전에는 만들기만 하고 등록은 부르는 쪽이 따로 했다. 구글만 그 줄을 갖고 있었고
// 네이버 · 페이스북 · 인스타그램은 빠져 있어서, 콜백의 validateState 가 언제나
// 'has(state) === false' 로 떨어졌다 — 세 곳 모두 invalid_state 로 100% 실패했다.
// 등록을 발급 안으로 넣어 빠뜨릴 수 없게 한다.
function generateState(referer = '') {
  // Map 크기 제한
  if (oauthStates.size >= MAX_OAUTH_STATES) {
    const oldest = oauthStates.keys().next().value;
    oauthStates.delete(oldest);
  }
  const s = crypto.randomBytes(16).toString('hex');
  oauthStates.set(s, { time: Date.now(), referer });
  // 10분이 지나면 스스로 사라진다. 타이머가 프로세스를 붙잡지 않게 unref 한다
  setTimeout(() => oauthStates.delete(s), 10 * 60 * 1000).unref?.();
  return s;
}

// ── state 를 **브라우저에도 묶는다** ── (2026-09-18)
//
// 여태 state 는 서버 메모리에만 있었다. 무작위이므로 남이 맞힐 수는 없는데,
// **이미 제 손에 든 state 를 남의 브라우저에 쓰게 할 수는 있었다** —
// 공격자가 제 구글 계정으로 로그인을 시작해 콜백 주소를 만들어 두고 그 링크를 누르게
// 하면, 그 사람 브라우저에 **공격자 계정의 로그인 쿠키**가 심긴다. 그 뒤로 그 사람이
// 적는 운동이 공격자 계정에 쌓인다 (로그인 CSRF · 세션 고정).
//
// 그래서 발급할 때 **같은 값을 쿠키로도 준다.** 콜백에서 둘이 같아야 통과한다 —
// 남의 브라우저에는 그 쿠키가 없으니 그 길이 막힌다.
//
// `SameSite=Lax` 로 둔다: 구글에서 돌아오는 것은 **주소창을 타는 GET 이동**이라
// Lax 에서도 쿠키가 실려 온다. `Strict` 로 두면 그 순간 안 실려서 로그인이 아예 안 된다.
const STATE_COOKIE = 'sb_oauth';
const STATE_TTL_MS = 10 * 60 * 1000;

function setStateCookie(res, state) {
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    maxAge: STATE_TTL_MS,
    // 이 쿠키가 쓰이는 자리에만 실어 보낸다
    path: '/api/oauth',
  });
}

function clearStateCookie(res) {
  res.clearCookie(STATE_COOKIE, { httpOnly: true, sameSite: 'lax', secure: IS_PROD, path: '/api/oauth' });
}

/** 로그인을 시작한다 — state 를 만들고 브라우저에도 심는다 (둘을 따로 하면 빠뜨린다) */
function startOauth(req, res) {
  const state = generateState(req.get('referer') || '');
  setStateCookie(res, state);
  return state;
}

/**
 * 돌아온 것이 **그 브라우저에서 시작한 것인가.**
 *
 * 쿠키를 아예 안 보내는 자리(쿠키를 막아둔 브라우저 · 일부 인앱 브라우저)에서는
 * 로그인이 통째로 막힌다. 그런데 이 앱은 **로그인 쿠키로 도는 앱**이라 그 브라우저에서는
 * 어차피 못 쓴다 — 여기서 느슨하게 받아도 다음 걸음에서 막힌다. 그래서 여기서 막는다.
 */
function sameBrowser(req) {
  const cookie = req.cookies?.[STATE_COOKIE];
  const got = req.query.state;
  return !!cookie && !!got && cookie === got;
}

// ── 왜 안 됐는지는 **제공자마다 똑같이** 구분한다 ── (2026-10-07)
//
// 구글만 이 갈래를 갖고 있었고 네이버 · 페이스북 · 인스타그램은 `naver_failed` 하나로
// 뭉갰다. 「다시 시도해주세요」는 **다시 눌러도 영영 안 되는 일**(메일 미확인 ·
// 메일 미제공)에 하면 틀린 말이 된다 — 그 사람이 할 일은 다시 누르기가 아니라
// 제공자 쪽에서 동의를 켜는 것이다. 갈래를 **한 곳에 두어** 제공자를 더할 때
// 빠뜨릴 수 없게 한다.
function failCode(provider, err) {
  if (err?.message === 'OAUTH_EMAIL_UNVERIFIED') return provider + '_unverified';
  if (err?.message === 'OAUTH_NO_EMAIL') return provider + '_no_email';
  return provider + '_failed';
}

function validateState(state) {
  if (!state || !oauthStates.has(state)) return false;
  const data = oauthStates.get(state);
  // 시간 기반 만료 검증 (setTimeout 외에 이중 체크)
  if (data?.time && Date.now() - data.time > 10 * 60 * 1000) {
    oauthStates.delete(state);
    return false;
  }
  oauthStates.delete(state);
  return true;
}

// Google 리다이렉트 방식 (요청 호스트 기반 — 터널/localhost 모두 지원)
// 어느 소셜 로그인이 쓸 수 있는 상태인가.
//
// 제공자마다 열쇠가 따로 있고, 없으면 눌러봐야 `?error=..._not_configured` 로
// 되돌아온다. **못 하는 것을 누를 수 있게 두지 않으려고** 화면이 먼저 물어본다.
// 열쇠 값은 안 돌려준다 — 설정됐는지 여부만이다.
router.get('/providers', (req, res) => {
  res.json({
    google: !!process.env.GOOGLE_CLIENT_ID,
    kakao: !!process.env.KAKAO_CLIENT_ID,
    naver: !!process.env.NAVER_CLIENT_ID,
    facebook: !!process.env.FACEBOOK_APP_ID,
  });
});

router.get('/google', (req, res) => {
  // **구글만 이 가드가 없었다.** 네이버 · 페이스북 · 인스타그램은 열쇠가 없으면
  // `?error=..._not_configured` 로 되돌려 보내는데, 구글은 `client_id=undefined` 인
  // 채로 구글에 보내고 있었다 — 사람은 구글의 영어 오류 화면을 만나고,
  // 거기에는 앱으로 돌아오는 길이 없다
  if (!process.env.GOOGLE_CLIENT_ID) return res.redirect(`${FRONTEND}/login?error=google_not_configured`);
  const { backendUrl } = getUrls(req);
  // state 에 프론트엔드 referer 를 같이 담아둔다 (콜백에서 돌아갈 곳을 정하는 데 쓴다)
  const state = startOauth(req, res);
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${backendUrl}/api/oauth/google/callback`,
    response_type: 'code',
    scope: 'email profile',
    access_type: 'offline',
    state,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/google/callback', async (req, res) => {
  const { backendUrl } = getUrls(req);
  const stateData = oauthStates.get(req.query.state);
  const sameOne = sameBrowser(req);
  clearStateCookie(res);
  if (!sameOne || !validateState(req.query.state)) {
    // 다른 오류는 아래에서 정한 frontendUrl 로 돌아가는데 여기만 FRONTEND 였다.
    // 개발용 IP(192.168.x)나 터널로 들어온 사람은 **다른 주소로 튕겨** 로그인 화면이
    // 아니라 낯선 곳에 떨어진다
    return res.redirect(`${getUrls(req).frontendUrl}/login?error=invalid_state`);
  }
  // referer 기반 frontend origin — 화이트리스트 검증 (open redirect 방지)
  let frontendUrl = ALLOWED_FRONTENDS[0] || FRONTEND;
  if (stateData?.referer) {
    try {
      const candidate = new URL(stateData.referer).origin;
      if (isAllowedFrontendOrigin(candidate)) frontendUrl = candidate;
    } catch {}
  }
  try {
    const { data: tokens } = await axios.post('https://oauth2.googleapis.com/token', {
      code: req.query.code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${backendUrl}/api/oauth/google/callback`,
      grant_type: 'authorization_code',
    });
    const { data: profile } = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    // **이메일이 있는지는 한 곳에서만 본다** (`findOrCreateUser`).
    // 여기서 따로 던지면 이유가 뭉개져서(`google_failed`) 「다시 시도해주세요」가 되고,
    // 그건 다시 눌러도 영영 안 되는 일에 하는 말이다 (2026-09-18 에 검사가 잡았다)
    const info = await findOrCreateUser(profile?.email, profile?.name, 'google',
      { emailVerified: profile?.verified_email });
    setAuthCookies(res, info.user);
    res.redirect(successUrl(frontendUrl, info));
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('OAuth error:', err.message);
    // **왜 안 됐는지 구분해서 보낸다** — 갈래는 `failCode` 한 곳에 있다
    res.redirect(`${frontendUrl}/login?error=${failCode('google', err)}`);
  }
});

// 「앱에서 코드를 받아 교환하는 길」은 **없다** (2026-10-02 에 걷어냄).
//
// `POST /google/code` 가 있었다. 「모바일 지원」이라고 적혀 있었는데, **앱에서
// 부르는 데가 한 곳도 없었다** — `frontend/src` 어디에서도 안 부르고, 네이티브
// 구글 로그인 플러그인도 깔려 있지 않다. 폰에서도 웹과 같은 길(`GET /google`)로 돈다.
//
// 안 쓰는 길은 **고칠 때 잊히는 길**이다. 이 자리가 바로 그 증거였다 — 콜백에는
// 「확인 안 된 메일」 검사가 있는데 **이 길에만 없었던** 적이 있다(README 의 9/18 일지).
// 로그인 없이 부를 수 있고 계정을 만드는 길이면 더 그렇다.
//
// 10/1 에 걷어낸 `POST /auth/verify-code` 와 같은 까닭이다.
// 네이티브 로그인을 붙일 날이 오면 **그때 다시 만든다** — 그때는 부르는 데가 있다.

// ─── Naver ────────────────────────────
router.get('/naver', (req, res) => {
  if (!process.env.NAVER_CLIENT_ID) return res.redirect(`${FRONTEND}/login?error=naver_not_configured`);
  const { backendUrl } = getUrls(req);
  const params = new URLSearchParams({
    client_id: process.env.NAVER_CLIENT_ID,
    redirect_uri: `${backendUrl}/api/oauth/naver/callback`,
    response_type: 'code',
    state: startOauth(req, res),
  });
  res.redirect(`https://nid.naver.com/oauth2.0/authorize?${params}`);
});

router.get('/naver/callback', async (req, res) => {
  const { backendUrl, frontendUrl } = getUrls(req);
  const sameOne = sameBrowser(req);
  clearStateCookie(res);
  if (!sameOne || !validateState(req.query.state)) {
    return res.redirect(`${frontendUrl}/login?error=invalid_state`);
  }
  try {
    const { data: tokens } = await axios.post('https://nid.naver.com/oauth2.0/token', null, {
      params: {
        grant_type: 'authorization_code',
        client_id: process.env.NAVER_CLIENT_ID,
        client_secret: process.env.NAVER_CLIENT_SECRET,
        code: req.query.code,
        state: req.query.state,
      },
    });
    const { data: profileRes } = await axios.get('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = profileRes?.response;
    // **메일이 없는 것을 「실패」로 뭉개지 않는다** (2026-10-07). 네이버에서 메일은
    // 선택 동의라 안 하면 이 칸이 비어 온다. 여기서 던지면 `naver_failed` 가 되어
    // 「다시 시도해주세요」를 듣는데, 다시 눌러도 **동의를 켜지 않으면 영영 안 된다.**
    // 메일이 있는지는 `findOrCreateUser` 한 곳에서 보고 `naver_no_email` 로 나간다
    if (!profile) throw new Error('Naver profile missing');
    const info = await findOrCreateUser(profile.email, profile.nickname || profile.name, 'naver');
    setAuthCookies(res, info.user);
    res.redirect(successUrl(frontendUrl, info));
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('OAuth error:', err.message);
    res.redirect(`${frontendUrl}/login?error=${failCode('naver', err)}`);
  }
});

// ─── Kakao ────────────────────────────
//
// 국내에서 제일 많이 눌리는 길인데 **코드가 아예 없었다** (2026-10-07 에 붙였다).
// 카카오는 메일을 주고 **확인됐는지까지** 알려주므로, 9/18 의 「확인 안 된 메일로는
// 계정을 잇지 않는다」가 구글과 똑같이 걸린다.
router.get('/kakao', (req, res) => {
  if (!process.env.KAKAO_CLIENT_ID) return res.redirect(`${FRONTEND}/login?error=kakao_not_configured`);
  const { backendUrl } = getUrls(req);
  const params = new URLSearchParams({
    client_id: process.env.KAKAO_CLIENT_ID,
    redirect_uri: `${backendUrl}/api/oauth/kakao/callback`,
    response_type: 'code',
    // **메일을 동의 화면에 올린다.** 안 받으면 계정을 만들 수 없는 값이다
    // (카카오에서 메일은 선택 동의라, 안 적으면 묻지도 않고 안 준다)
    scope: 'account_email profile_nickname',
    state: startOauth(req, res),
  });
  res.redirect(`https://kauth.kakao.com/oauth/authorize?${params}`);
});

router.get('/kakao/callback', async (req, res) => {
  const { backendUrl, frontendUrl } = getUrls(req);
  const sameOne = sameBrowser(req);
  clearStateCookie(res);
  if (!sameOne || !validateState(req.query.state)) {
    return res.redirect(`${frontendUrl}/login?error=invalid_state`);
  }
  try {
    const { data: tokens } = await axios.post('https://kauth.kakao.com/oauth/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.KAKAO_CLIENT_ID,
        // 카카오 콘솔에서 「보안」을 켰을 때만 있다. 안 켰으면 **안 보내는 것이 맞다** —
        // 빈 값을 실어 보내면 거절한다
        ...(process.env.KAKAO_CLIENT_SECRET ? { client_secret: process.env.KAKAO_CLIENT_SECRET } : {}),
        redirect_uri: `${backendUrl}/api/oauth/kakao/callback`,
        code: req.query.code,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' } }
    );
    const { data: profile } = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profile || !profile.id) throw new Error('Kakao profile missing');
    const acc = profile.kakao_account || {};
    // 카카오는 둘을 따로 알려준다 — 주소가 **쓸 수 있는 것인가**(`is_email_valid`) ·
    // **그 사람 것으로 확인됐는가**(`is_email_verified`).
    // **모른다고 할 때가 아니라 아니라고 할 때만** 막는다 — `findOrCreateUser` 의
    // 규칙과 같다(필드를 안 주는 제공자도 있어서, 없는 것을 거절로 치면 통째로 막힌다)
    const emailVerified = (acc.is_email_valid === false || acc.is_email_verified === false)
      ? false
      : acc.is_email_verified;
    // 메일이 없으면(선택 동의를 안 켠 사람) 계정을 만들지 않고 `kakao_no_email` 로
    // 나간다 — **무엇을 켜야 하는지**를 듣는 쪽이 「다시 시도해주세요」보다 맞다
    const info = await findOrCreateUser(acc.email, acc.profile?.nickname, 'kakao', { emailVerified });
    setAuthCookies(res, info.user);
    res.redirect(successUrl(frontendUrl, info));
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('OAuth error:', err.message);
    res.redirect(`${frontendUrl}/login?error=${failCode('kakao', err)}`);
  }
});

// ─── Facebook ─────────────────────────
router.get('/facebook', (req, res) => {
  if (!process.env.FACEBOOK_APP_ID) return res.redirect(`${FRONTEND}/login?error=facebook_not_configured`);
  const { backendUrl } = getUrls(req);
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID,
    redirect_uri: `${backendUrl}/api/oauth/facebook/callback`,
    scope: 'email,public_profile',
    response_type: 'code',
    state: startOauth(req, res),
  });
  res.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params}`);
});

router.get('/facebook/callback', async (req, res) => {
  const { backendUrl, frontendUrl } = getUrls(req);
  const sameOne = sameBrowser(req);
  clearStateCookie(res);
  if (!sameOne || !validateState(req.query.state)) {
    return res.redirect(`${frontendUrl}/login?error=invalid_state`);
  }
  try {
    const { data: tokens } = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: {
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        redirect_uri: `${backendUrl}/api/oauth/facebook/callback`,
        code: req.query.code,
      },
    });
    const { data: profile } = await axios.get('https://graph.facebook.com/me', {
      params: { fields: 'id,name,email', access_token: tokens.access_token },
    });
    if (!profile || !profile.id) throw new Error('Facebook profile missing');
    // ── **메일을 지어내지 않는다** ── (2026-10-07)
    //
    // 여기는 메일이 없으면 `fb_<번호>@facebook.com` 을 만들어 넣고 있었다. 9/18 에
    // 「메일이 없으면 계정을 만들지 않는다」를 `findOrCreateUser` 한 곳에 넣었는데,
    // 이 줄은 **없는 주소를 지어내 그 검사를 비껴갔다.** 남은 것은 이렇다 —
    //
    //   · 그 계정은 **비밀번호 찾기가 영구히 막힌다** (보낼 주소가 세상에 없다)
    //   · 그 사람이 나중에 진짜 메일로 가입하면 **계정이 둘로 갈라진다** —
    //     이 앱이 계정을 잇는 열쇠는 이메일 하나다(`emailKey`)
    //
    // 페북은 `email` 에 동의하면 진짜 메일을 준다. 그러니 걷어내도 길이 막히지
    // 않는다 — 안 준 사람은 `facebook_no_email` 로 **무엇을 켜야 하는지** 듣는다.
    const info = await findOrCreateUser(profile.email, profile.name, 'facebook');
    setAuthCookies(res, info.user);
    res.redirect(successUrl(frontendUrl, info));
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('OAuth error:', err.message);
    res.redirect(`${frontendUrl}/login?error=${failCode('facebook', err)}`);
  }
});

// 「인스타그램」은 **없다** (2026-10-07 에 내렸다).
//
// 열쇠를 꽂아도 안 되는 길이었다. 둘 때문이다 —
//
// 1. **메일을 아예 안 준다.** 이 앱이 계정을 잇는 열쇠는 이메일 하나인데
//    (`emailKey`), 인스타는 그것을 주지 않는다. 그래서 전임 코드는
//    `ig_<번호>@instagram.com` 이라는 **없는 주소를 지어냈다** — 그 계정은
//    비밀번호 찾기가 영구히 막히고, 그 사람이 나중에 진짜 메일로 가입하면
//    기록이 두 계정으로 갈라진다.
// 2. **개인 계정은 들어올 수 없었다.** 스코프가 `instagram_business_basic` 이라
//    비즈니스 · 크리에이터 계정만 통과한다. 헬스 앱을 깔 사람 대부분은 개인 계정이다.
//
// **내리는 대신 카카오를 붙였다** — 국내에서 제일 많이 눌리는 길인데 코드가 아예
// 없었고, 메일을 주고 확인 여부까지 주므로 이 앱의 뼈대에 그대로 맞는다.
//
// 다시 올릴 날이 오면 「메일 주소를 한 번 받아 인증번호로 확인하는 걸음」을
// 먼저 만들어야 한다. 지어낸 주소로는 안 된다.

module.exports = router;

// 검사가 떼어 쓴다 (`npm run check`). 라우터를 띄우지 않고 이 둘만 돌려본다 —
// 구글 열쇠가 없는 자리에서도 볼 수 있는 것은 봐둔다
module.exports.successUrl = successUrl;
module.exports.findOrCreateUser = findOrCreateUser;
module.exports.failCode = failCode;
