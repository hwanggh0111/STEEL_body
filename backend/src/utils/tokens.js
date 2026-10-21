// ── 열쇠 꾸러미는 **쓸 때 든다** ── (2026-10-09)
//
// `jsonwebtoken` 은 드는 데 66ms 다 — 이 서버가 뜨는 시간(403ms)의 6분의 1 이다.
// Render 무료 판은 15분 놀면 잠들고, **깰 때마다** 그 값을 치른다.
// 뜰 때 안 들고, 뜬 **뒤에** 미리 데워둔다 (`index.js` 의 `warmUp`).
let _jwt;
const jwt = () => (_jwt || (_jwt = require('jsonwebtoken')));
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
  const accessToken = jwt().sign(
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

// ── 지우는 것도 여기서 한다 ── (2026-10-21)
//
// 이 파일 머리글이 적어둔 것: 「쿠키 설정이 양쪽에 복붙돼 있었다 … 한 곳에 둔다.
// 고치면 두 길이 같이 바뀐다」. 그런데 **심는 것만 한 곳이었다** —
// **지우는 자리는 다섯 곳에 복붙돼 있었고**(`routes/auth.js` 의 갱신 · 재사용 ·
// 만료 · 로그아웃 · 계정 삭제), 거기에 `path` 를 **손으로 또 적어뒀다.**
// 위의 `ACCESS_COOKIE_OPTS` 셋은 내보내 두기만 하고 **아무도 안 쓰고 있었다.**
//
// 어긋나는 방향이 나쁘다. refresh 쿠키의 길(`/api/auth`)을 고치는 날, 심는 쪽은
// 바뀌고 지우는 쪽은 안 바뀐다 — **브라우저는 그 쿠키를 그대로 들고 있다.**
// 증상은 「로그아웃을 눌렀는데 새로 열면 다시 들어가 있다」다. 쿠키를 지우는 것은
// **이름과 길이 맞아야만** 되는 일이라, 조용히 안 지워진다.
//
// 쿠키를 지울 때 브라우저가 보는 것은 이름 · 도메인 · 길이다 (`secure` · `sameSite` 는
// 안 본다). 그래서 길만 그 쿠키의 것과 같게 넘긴다.

/**
 * 로그인 쿠키 셋을 지운다.
 *
 * `accessOnly` 는 **갱신이 겹쳤을 때**만 쓴다(탭 두 개) — 그때는 세션을 끊는 것이
 * 아니라 access 만 버리고 다시 갱신하게 둔다.
 */
function clearAuthCookies(res, { accessOnly = false } = {}) {
  res.clearCookie('sb_access', { path: ACCESS_COOKIE_OPTS.path });
  if (accessOnly) return;
  res.clearCookie('sb_refresh', { path: REFRESH_COOKIE_OPTS.path });
  res.clearCookie('sb_csrf', { path: CSRF_COOKIE_OPTS.path });
}

module.exports = {
  issueTokens,
  clearAuthCookies,
  ACCESS_COOKIE_OPTS,
  REFRESH_COOKIE_OPTS,
  CSRF_COOKIE_OPTS,
};
