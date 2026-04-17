const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const adminAuth = require('../middleware/adminAuth');
const db = require('../db');
const aiGuard = require('../middleware/aiGuard');

// 보안 로그 (메모리 + 파일 영속화)
const LOG_PATH = path.join(__dirname, '../../security.log');
const securityLogs = [];

function addLog(type, detail) {
  const entry = {
    type,
    detail,
    timestamp: new Date().toISOString(),
  };
  securityLogs.push(entry);
  if (securityLogs.length > 1000) securityLogs.shift();
  // 파일에도 기록 (비동기)
  const line = `[${entry.timestamp}] [${type}] ${detail}\n`;
  fs.appendFile(LOG_PATH, line, () => {});
}

// GET /api/security/dashboard - 보안 대시보드
router.get('/dashboard', adminAuth, (req, res) => {
  const users = db.getAllUsers();
  const today = new Date().toISOString().slice(0, 10);
  const todaySignups = users.filter(u => u.created_at && u.created_at.slice(0, 10) === today).length;

  res.json({
    totalUsers: users.length,
    todaySignups,
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 100,
    },
    jwtExpiresIn: '7d',
    bcryptRounds: 12,
    helmetEnabled: true,
    corsOrigin: process.env.FRONTEND_URL || '*',
    bodyLimit: '1mb',
    nodeVersion: process.version,
  });
});

// GET /api/security/users - 전체 유저 목록 (password 제외)
router.get('/users', adminAuth, (req, res) => {
  const users = db.getAllUsers().map(({ password, ...rest }) => rest);
  res.json(users);
});

// GET /api/security/logs - 보안 로그 (최근 100건)
router.get('/logs', adminAuth, (req, res) => {
  const recent = securityLogs.slice(-100).reverse();
  res.json(recent);
});

// POST /api/security/block-user/:id - 유저 차단
router.post('/block-user/:id', adminAuth, (req, res) => {
  const id = Number(req.params.id);
  const user = db.findUserById(id);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없어요' });
  if (user.role === 'admin') return res.status(400).json({ error: '관리자는 차단할 수 없어요' });

  db.updateUserRole(id, 'blocked');
  addLog('block', `유저 차단: id=${id}, email=${user.email}`);
  res.json({ message: '유저가 차단되었어요' });
});

// POST /api/security/unblock-user/:id - 유저 차단 해제
router.post('/unblock-user/:id', adminAuth, (req, res) => {
  const id = Number(req.params.id);
  const user = db.findUserById(id);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없어요' });

  db.updateUserRole(id, 'user');
  addLog('unblock', `유저 차단 해제: id=${id}, email=${user.email}`);
  res.json({ message: '유저 차단이 해제되었어요' });
});

// POST /api/security/make-admin/:id - 관리자 권한 부여
router.post('/make-admin/:id', adminAuth, (req, res) => {
  const id = Number(req.params.id);
  const user = db.findUserById(id);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없어요' });

  db.updateUserRole(id, 'admin');
  addLog('make-admin', `관리자 권한 부여: id=${id}, email=${user.email}`);
  res.json({ message: '관리자 권한이 부여되었어요' });
});

// POST /api/security/revoke-admin/:id - 관리자 권한 해제
router.post('/revoke-admin/:id', adminAuth, (req, res) => {
  const id = Number(req.params.id);
  const user = db.findUserById(id);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없어요' });
  if (user.id === req.userId) return res.status(400).json({ error: '자신의 관리자 권한은 해제할 수 없어요' });

  db.updateUserRole(id, 'user');
  addLog('revoke-admin', `관리자 권한 해제: id=${id}, email=${user.email}`);
  res.json({ message: '관리자 권한이 해제되었어요' });
});

// ── AI Guard 엔드포인트 ──

// GET /api/security/ai-dashboard - AI 관리 현황
router.get('/ai-dashboard', adminAuth, (req, res) => {
  res.json({
    stats: aiGuard.getStats(),
    aiLogs: aiGuard.getAiLogs(),
    blockedIPs: aiGuard.getBlockedIPs(),
  });
});

// IP 형식 검증
function isValidIP(ip) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) || /^[a-fA-F0-9:]+$/.test(ip) || ip === '::1';
}

// POST /api/security/ai-unblock/:ip - IP 차단 해제
router.post('/ai-unblock/:ip', adminAuth, (req, res) => {
  const ip = req.params.ip;
  if (!isValidIP(ip)) return res.status(400).json({ error: '올바른 IP 형식이 아니에요' });
  const result = aiGuard.unblockIP(ip);
  if (result) {
    addLog('ai-unblock', `AI Guard IP 차단 해제: ${ip}`);
    res.json({ message: `${ip} 차단이 해제되었어요` });
  } else {
    res.status(404).json({ error: '해당 IP는 차단 목록에 없어요' });
  }
});

// POST /api/security/ai-block - IP 수동 차단
router.post('/ai-block', adminAuth, (req, res) => {
  const { ip, minutes } = req.body;
  if (!ip || !minutes) {
    return res.status(400).json({ error: 'ip와 minutes를 입력해주세요' });
  }
  if (!isValidIP(ip)) return res.status(400).json({ error: '올바른 IP 형식이 아니에요' });
  if (isNaN(Number(minutes)) || Number(minutes) <= 0 || Number(minutes) > 525600) {
    return res.status(400).json({ error: '차단 시간은 1분~365일 범위여야 해요' });
  }
  const blockedUntil = aiGuard.manualBlock(ip, Number(minutes));
  addLog('ai-block', `AI Guard IP 수동 차단: ${ip} (${minutes}분)`);
  res.json({ message: `${ip}가 ${minutes}분간 차단되었어요`, blockedUntil });
});

module.exports = router;
module.exports.addLog = addLog;
