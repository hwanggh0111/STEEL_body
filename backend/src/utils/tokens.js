const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { JWT } = require('../config/security');

// 로그인이 끝났을 때 열쇠를 쥐여주는 곳.
//
// **들어오는 길이 둘이다** — 이메일(`routes/auth.js`)과 소셜(`routes/oauth.js`).
// 그런데 쿠키 설정이 양쪽에 **복붙돼 있었다.** 지금은 값이 같지만, 한쪽만 고치는 날
// 두 길이 갈린다. 그러면 「이메일로는 로그인이 유지되는데 구글로 들어오면 자꾸 풀린다」
// 같은, 원인이 안 보이는 버그가 된다.
//
// 한 곳에 둔다. 고치면 두 길이 같이 바뀐다.

const IS_PROD = process.env.NODE_ENV === 'production';

// `sameSite: 'strict'` 는 배포에서만. 개발은 5173 과 4000 이 다른 포트라 'lax' 여야 붙는다
const BASE = {
  secure: IS_PROD,
  sameSite: IS_PROD ? 'strict' : 'lax',
};

// access 쿠키는 토큰과 같이 죽어야 한다. 예전에는 `15 * 60 * 1000` 을 손으로 적어뒀는데,
// 설정의 `accessExpiry` 를 '30m' 으로 바꾸면 쿠키만 15분에 죽어 서로 어긋난다
const ACCESS_MS = (() => {
  const m = /^(\d+)([smhd])$/.exec(String(JWT.accessExpiry || '15m'));
  if (!m) return 15 * 60 * 1000;
  const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2]];
  return Number(m[1]) * unit;
})();

const ACCESS_COOKIE_OPTS = { ...BASE, httpOnly: true, path: '/', maxAge: ACCESS_MS };
// refresh 는 갱신할 때만 보내면 된다. 다른 요청에 실려 다니지 않게 경로를 좁힌다
const REFRESH_COOKIE_OPTS = { ...BASE, httpOnly: true, path: '/api/auth', maxAge: JWT.refreshMs };
// CSRF 는 화면이 읽어 헤더에 실어야 해서 httpOnly 가 아니다
const CSRF_COOKIE_OPTS = { ...BASE, httpOnly: false, path: '/', maxAge: JWT.refreshMs };

/**
 * access · refresh · csrf 를 만들어 쿠키로 심는다.
 *
 * refresh 는 **해시로만** 저장된다 (`db.saveRefreshToken`) — 파일이 새도 그 줄로
 * 남의 계정에 들어갈 수 없어야 한다.
 *
 * 돌려주는 `accessToken` 은 몸통에도 실어 보내는 데 쓴다. 쿠키가 막힌 브라우저는
 * 그걸 받아 헤더로 다닌다 — 안 주면 갱신이 끝없이 도는 고리에 갇힌다.
 */
function issueTokens(res, user) {
  const accessToken = jwt.sign(
    { userId: user.id, role: user.role || 'user' },
    process.env.JWT_SECRET,
    { expiresIn: JWT.accessExpiry, algorithm: JWT.algorithm }
  );
  const refreshToken = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + JWT.refreshMs).toISOString();
  db.saveRefreshToken(user.id, refreshToken, expiresAt);

  const csrfToken = crypto.randomBytes(24).toString('hex');

  res.cookie('sb_access', accessToken, ACCESS_COOKIE_OPTS);
  res.cookie('sb_refresh', refreshToken, REFRESH_COOKIE_OPTS);
  res.cookie('sb_csrf', csrfToken, CSRF_COOKIE_OPTS);

  return { accessToken, refreshToken, csrfToken };
}

module.exports = {
  issueTokens,
  ACCESS_COOKIE_OPTS,
  REFRESH_COOKIE_OPTS,
  CSRF_COOKIE_OPTS,
};
