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
async function findOrCreateUser(email, rawNickname, provider) {
  // 외부 제공자가 준 닉네임 sanitize + 길이 제한 (XSS 방어)
  const safeNickname = (sanitize(String(rawNickname || '')).slice(0, 30) || (provider + '_user'));
  let user = db.findUserByEmail(email);
  if (!user) {
    const randomPw = await bcrypt.hash(require('crypto').randomBytes(32).toString('hex'), BCRYPT_ROUNDS);
    const username = provider + '_' + crypto.randomBytes(4).toString('hex');
    db.createUser(email, randomPw, safeNickname, username);
    user = db.findUserByEmail(email);
  }
  // ADMIN_EMAIL이면 자동 관리자 승격
  if (process.env.ADMIN_EMAIL && db.emailKey(user.email) === db.emailKey(process.env.ADMIN_EMAIL) && user.role !== 'admin') {
    db.updateUserRole(user.id, 'admin');
    user.role = 'admin';
  }
  return { user, nickname: user.nickname, email: user.email };
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
    naver: !!process.env.NAVER_CLIENT_ID,
    facebook: !!process.env.FACEBOOK_APP_ID,
    instagram: !!process.env.INSTAGRAM_APP_ID,
  });
});

router.get('/google', (req, res) => {
  const { backendUrl } = getUrls(req);
  // state 에 프론트엔드 referer 를 같이 담아둔다 (콜백에서 돌아갈 곳을 정하는 데 쓴다)
  const state = generateState(req.get('referer') || '');
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
  if (!validateState(req.query.state)) {
    return res.redirect(`${FRONTEND}/login?error=invalid_state`);
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
    if (!profile || !profile.email) throw new Error('Google profile missing email');
    const { user, nickname, email } = await findOrCreateUser(profile.email, profile.name, 'google');
    setAuthCookies(res, user);
    res.redirect(`${frontendUrl}/login?oauth=success&nickname=${encodeURIComponent(nickname)}&email=${encodeURIComponent(email)}`);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('OAuth error:', err.message);
    res.redirect(`${frontendUrl}/login?error=google_failed`);
  }
});

// Google 클라이언트 사이드 방식 (모바일 지원 — authorization code 교환)
router.post('/google/code', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: '인증 코드가 없어요' });
  try {
    const { data: tokens } = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: 'postmessage',
      grant_type: 'authorization_code',
    });
    const { data: profile } = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const { user, nickname, email } = await findOrCreateUser(profile.email, profile.name, 'google');
    setAuthCookies(res, user);
    res.json({ nickname, email });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('Google code error:', err.message);
    res.status(401).json({ error: '구글 로그인에 실패했어요. 잠시 뒤에 다시 해주세요' });
  }
});

// ─── Naver ────────────────────────────
router.get('/naver', (req, res) => {
  if (!process.env.NAVER_CLIENT_ID) return res.redirect(`${FRONTEND}/login?error=naver_not_configured`);
  const { backendUrl } = getUrls(req);
  const params = new URLSearchParams({
    client_id: process.env.NAVER_CLIENT_ID,
    redirect_uri: `${backendUrl}/api/oauth/naver/callback`,
    response_type: 'code',
    state: generateState(),
  });
  res.redirect(`https://nid.naver.com/oauth2.0/authorize?${params}`);
});

router.get('/naver/callback', async (req, res) => {
  const { backendUrl, frontendUrl } = getUrls(req);
  if (!validateState(req.query.state)) {
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
    if (!profile || !profile.email) throw new Error('Naver profile missing');
    const { user, nickname, email } = await findOrCreateUser(profile.email, profile.nickname || profile.name, 'naver');
    setAuthCookies(res, user);
    res.redirect(`${frontendUrl}/login?oauth=success&nickname=${encodeURIComponent(nickname)}&email=${encodeURIComponent(email)}`);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('OAuth error:', err.message);
    res.redirect(`${frontendUrl}/login?error=naver_failed`);
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
    state: generateState(),
  });
  res.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params}`);
});

router.get('/facebook/callback', async (req, res) => {
  const { backendUrl, frontendUrl } = getUrls(req);
  if (!validateState(req.query.state)) {
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
    const email = profile.email || `fb_${profile.id}@facebook.com`;
    const { user, nickname, email: userEmail } = await findOrCreateUser(email, profile.name, 'facebook');
    setAuthCookies(res, user);
    res.redirect(`${frontendUrl}/login?oauth=success&nickname=${encodeURIComponent(nickname)}&email=${encodeURIComponent(userEmail)}`);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('OAuth error:', err.message);
    res.redirect(`${frontendUrl}/login?error=facebook_failed`);
  }
});

// ─── Instagram (Facebook 기반) ────────
router.get('/instagram', (req, res) => {
  if (!process.env.INSTAGRAM_APP_ID) return res.redirect(`${FRONTEND}/login?error=instagram_not_configured`);
  const { backendUrl } = getUrls(req);
  const params = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID,
    redirect_uri: `${backendUrl}/api/oauth/instagram/callback`,
    scope: 'instagram_business_basic',
    response_type: 'code',
    state: generateState(),
  });
  res.redirect(`https://www.instagram.com/oauth/authorize?${params}`);
});

router.get('/instagram/callback', async (req, res) => {
  const { backendUrl, frontendUrl } = getUrls(req);
  if (!validateState(req.query.state)) {
    return res.redirect(`${frontendUrl}/login?error=invalid_state`);
  }
  try {
    const { data: tokens } = await axios.post('https://api.instagram.com/oauth/access_token',
      new URLSearchParams({
        client_id: process.env.INSTAGRAM_APP_ID,
        client_secret: process.env.INSTAGRAM_APP_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: `${backendUrl}/api/oauth/instagram/callback`,
        code: req.query.code,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const { data: profile } = await axios.get(`https://graph.instagram.com/v21.0/me`, {
      params: { fields: 'user_id,username', access_token: tokens.access_token },
    });
    if (!profile || !profile.user_id) throw new Error('Instagram profile missing');
    const email = `ig_${profile.user_id}@instagram.com`;
    const { user, nickname, email: userEmail } = await findOrCreateUser(email, profile.username, 'instagram');
    setAuthCookies(res, user);
    res.redirect(`${frontendUrl}/login?oauth=success&nickname=${encodeURIComponent(nickname)}&email=${encodeURIComponent(userEmail)}`);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('OAuth error:', err.message);
    res.redirect(`${frontendUrl}/login?error=instagram_failed`);
  }
});

module.exports = router;
