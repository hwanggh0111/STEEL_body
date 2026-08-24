const jwt = require('jsonwebtoken');
const db = require('../db');

module.exports = (req, res, next) => {
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // 토큰 읽기: httpOnly 쿠키 우선, Bearer 헤더 폴백
  const token = req.cookies?.sb_access || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // 토큰 길이 제한 (DoS 방지)
  if (token.length > 2000) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });
    if (!decoded.userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    // 차단된 유저 체크
    const user = db.findUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    if (user.role === 'blocked') {
      return res.status(403).json({ error: 'Account blocked' });
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
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};
