// 여기서 돌려주는 error 문구는 **그대로 사용자 화면의 토스트에 뜬다**
// (프론트가 err.response.data.error 를 그대로 띄운다).
// 그런데 「Invalid token」 · 「User not found」 처럼 영문이 섞여 있었다 —
// 앱의 다른 모든 글자는 한국어다. 무엇을 해야 하는지도 안 적혀 있었다.
const jwt = require('jsonwebtoken');
const db = require('../db');

module.exports = (req, res, next) => {
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: '서버 설정에 문제가 있어요. 잠시 뒤에 다시 해주세요' });
  }

  // 토큰 읽기: httpOnly 쿠키 우선, Bearer 헤더 폴백
  const token = req.cookies?.sb_access || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '로그인이 필요해요' });
  }

  // 토큰 길이 제한 (DoS 방지)
  if (token.length > 2000) {
    return res.status(401).json({ error: '로그인 정보가 올바르지 않아요. 다시 로그인해주세요' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });
    if (!decoded.userId) {
      return res.status(401).json({ error: '로그인 정보가 올바르지 않아요. 다시 로그인해주세요' });
    }

    // 차단된 유저 체크
    const user = db.findUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: '계정을 찾을 수 없어요. 다시 로그인해주세요' });
    }
    if (user.role === 'blocked') {
      return res.status(403).json({ error: '차단된 계정이에요. 고객센터로 알려주세요' });
    }

    // AI Guard v2: 정지/차단 체크
    if (user.is_banned) {
      // 데이터는 지우지 않는다. 자동 판정이 틀렸을 때 되돌릴 것이 남아 있어야 한다
      return res.status(403).json({ error: '계정이 영구 정지되었습니다.', message: '보안 정책 위반으로 정지되었습니다. 기록은 그대로 있습니다 — 잘못 걸렸다면 관리자에게 알려주세요.' });
    }
    // 관리자는 정지에 걸리지 않는다.
    // 자동 판정이 관리자를 정지시키면 관리자 화면에 못 들어가고, 자기 정지를 자기가
    // 풀 수 없다. 관리자가 한 명뿐이면 서비스가 통째로 잠긴다.
    const suspension = user.role === 'admin' ? null : db.getSuspension(decoded.userId);
    if (suspension) {
      const resp = { error: '계정이 정지되었습니다.', level: suspension.level, reason: suspension.ai_reason };
      if (suspension.expires_at !== 'permanent') {
        resp.expiresAt = suspension.expires_at;
        resp.message = `정지 해제일: ${suspension.expires_at}`;
      } else {
        resp.message = '영구 정지되었습니다.';
      }
      return res.status(403).json(resp);
    }

    req.userId = decoded.userId;
    req.userRole = user.role || 'user';
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '로그인이 만료됐어요. 다시 로그인해주세요' });
    }
    return res.status(401).json({ error: '로그인 정보가 올바르지 않아요. 다시 로그인해주세요' });
  }
};
