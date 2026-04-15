const router = require('express').Router();
const auth   = require('../middleware/auth');
const { spamCheck } = require('../middleware/aiGuard');
const db     = require('../db');

// 전체 목록
router.get('/', auth, (req, res) => {
  const records = db.getInbody(req.userId);
  res.json(records);
});

// 추가
router.post('/', auth, spamCheck, (req, res) => {
  let { date, height, weight, fat_pct, muscle_kg, water_l } = req.body;

  if (!weight) {
    return res.status(400).json({ error: '체중은 필수에요' });
  }

  weight = Number(weight);
  height = height ? Number(height) : null;
  fat_pct = fat_pct ? Number(fat_pct) : null;
  muscle_kg = muscle_kg ? Number(muscle_kg) : null;
  water_l = water_l ? Number(water_l) : null;

  if (isNaN(weight) || weight <= 0 || weight > 500) return res.status(400).json({ error: '체중 값이 올바르지 않아요' });
  if (height !== null && (isNaN(height) || height <= 0 || height > 300)) return res.status(400).json({ error: '키 값이 올바르지 않아요' });
  if (fat_pct !== null && (isNaN(fat_pct) || fat_pct < 0 || fat_pct > 100)) return res.status(400).json({ error: '체지방률 값이 올바르지 않아요' });
  if (muscle_kg !== null && (isNaN(muscle_kg) || muscle_kg < 0 || muscle_kg > 200)) return res.status(400).json({ error: '골격근량 값이 올바르지 않아요' });
  if (water_l !== null && (isNaN(water_l) || water_l < 0 || water_l > 200)) return res.status(400).json({ error: '체수분 값이 올바르지 않아요' });

  // BMI 자동 계산
  const bmi = height && height > 0 ? +(weight / ((height / 100) ** 2)).toFixed(1) : null;

  const result = db.createInbody(
    req.userId,
    (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date : new Date().toISOString().split('T')[0],
    height || null,
    weight,
    fat_pct || null,
    muscle_kg || null,
    water_l || null,
    bmi
  );

  res.status(201).json({ id: result.lastInsertRowid, bmi, message: '인바디 기록 저장!' });
});

// 삭제
router.delete('/:id', auth, (req, res) => {
  const result = db.deleteInbody(Number(req.params.id), req.userId);

  if (result.changes === 0) {
    return res.status(404).json({ error: '기록을 찾을 수 없어요' });
  }
  res.json({ message: '삭제 완료!' });
});

module.exports = router;
