const router = require('express').Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');

const crypto = require('crypto');
const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:5173';
const oauthStates = new Map();

const IS_PROD = process.env.NODE_ENV === 'production';

// OAuth용 쿠키 설정 헬퍼
function setAuthCookies(res, user) {
  const accessToken = jwt.sign(
    { userId: user.id, role: user.role || 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '15m', algorithm: 'HS256' }
  );
  const refreshToken = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.saveRefreshToken(user.id, refreshToken, expiresAt);
  const csrfToken = crypto.randomBytes(24).toString('hex');

  res.cookie('sb_access', accessToken, { httpOnly: true, secure: IS_PROD, sameSite: IS_PROD ? 'strict' : 'lax', path: '/', maxAge: 15 * 60 * 1000 });
  res.cookie('sb_refresh', refreshToken, { httpOnly: true, secure: IS_PROD, sameSite: IS_PROD ? 'strict' : 'lax', path: '/api/auth', maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.cookie('sb_csrf', csrfToken, { httpOnly: false, secure: IS_PROD, sameSite: IS_PROD ? 'strict' : 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 });
}

// 요청 기반으로 백엔드/프론트엔드 URL 결정 (모바일/터널 지원)
function getUrls(req) {
  const host = req.get('host') || `localhost:${process.env.PORT || 4000}`;
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const backendUrl = `${protocol}://${host}`;
  const frontendHost = host.replace(/:\d+$/, ':5173');
  const frontendUrl = `${protocol}://${frontendHost}`;
  return { backendUrl, frontendUrl };
}

// 소셜 로그인 공통: 유저 찾거나 생성
async function findOrCreateUser(email, nickname, provider) {
  let user = db.findUserByEmail(email);
  if (!user) {
    const randomPw = await bcrypt.hash(require('crypto').randomBytes(32).toString('hex'), 12);
    const username = provider + '_' + crypto.randomBytes(4).toString('hex');
    db.createUser(email, randomPw, nickname || provider + '_user', username);
    user = db.findUserByEmail(email);
  }
  return { user, nickname: user.nickname, email: user.email };
}

// ─── Google ───────────────────────────
function generateState() {
  const s = crypto.randomBytes(16).toString('hex');
  // 10분 후 자동 만료
  setTimeout(() => oauthStates.delete(s), 10 * 60 * 1000);
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
router.get('/google', (req, res) => {
  const { backendUrl } = getUrls(req);
  const state = generateState();
  // state에 프론트엔드 referer 저장 (콜백에서 사용)
  const referer = req.get('referer') || '';
  oauthStates.set(state, { time: Date.now(), referer });
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
  // referer에서 프론트엔드 origin 추출
  let frontendUrl = FRONTEND;
  if (stateData?.referer) {
    try {
      const url = new URL(stateData.referer);
      frontendUrl = url.origin;
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
  if (!code) return res.status(400).json({ error: 'code required' });
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
    res.status(401).json({ error: 'google_login_failed' });
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
