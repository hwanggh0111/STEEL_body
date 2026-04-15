const router = require('express').Router();
const auth   = require('../middleware/auth');
const { spamCheck } = require('../middleware/aiGuard');
const db     = require('../db');

const VALID_TYPES = ['bodySize', 'oneRM', 'fitness', 'flexibility', 'shoulder', 'stopwatch'];

function sanitizeObj(obj) {
  if (typeof obj === 'string') return obj.replace(/[<>"'&]/g, '');
  if (Array.isArray(obj)) return obj.map(sanitizeObj);
  if (typeof obj === 'object' && obj !== null) {
    const clean = {};
    for (const [k, v] of Object.entries(obj)) clean[k] = sanitizeObj(v);
    return clean;
  }
  return obj;
}

// 전체 목록 조회
router.get('/', auth, (req, res) => {
  const measures = db.getMeasures(req.userId);
  res.json(measures);
});

// 추가
router.post('/', auth, spamCheck, (req, res) => {
  const { type, date, data } = req.body;

  if (!type || !date || !data) {
    return res.status(400).json({ error: '타입, 날짜, 데이터는 필수에요' });
  }

  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: '올바른 측정 타입이 아니에요' });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) {
    return res.status(400).json({ error: '올바른 날짜 형식이 아니에요 (YYYY-MM-DD)' });
  }

  // data 크기 제한 (JSON 직렬화 기준 10KB)
  if (typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: '데이터는 객체 형식이어야 해요' });
  }
  if (JSON.stringify(data).length > 10240) {
    return res.status(400).json({ error: '데이터가 너무 커요 (최대 10KB)' });
  }

  const result = db.createMeasure(req.userId, type, date, sanitizeObj(data));
  res.status(201).json({ id: result.lastInsertRowid, message: '측정 기록 저장 완료!' });
});

// 삭제
router.delete('/:id', auth, (req, res) => {
  const result = db.deleteMeasure(Number(req.params.id), req.userId);

  if (result.changes === 0) {
    return res.status(404).json({ error: '기록을 찾을 수 없어요' });
  }
  res.json({ message: '삭제 완료!' });
});

module.exports = router;
