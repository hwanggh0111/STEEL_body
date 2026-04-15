const auth = require('./auth');
const db = require('../db');

// 관리자 전용 미들웨어 (auth + role 체크)
module.exports = (req, res, next) => {
  auth(req, res, () => {
    const user = db.findUserById(req.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.isAdmin = true;
    next();
  });
};
