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
      return res.status(403).json({ error: '계정이 영구 정지되었습니다.', message: '보안 정책 위반으로 모든 데이터가 삭제되었습니다.' });
    }
    const suspension = db.getSuspension(decoded.userId);
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
