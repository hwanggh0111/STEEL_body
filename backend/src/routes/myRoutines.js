const router = require('express').Router();
const auth   = require('../middleware/auth');
const { spamCheck } = require('../middleware/aiGuard');
const db     = require('../db');

// 전체 목록 조회
router.get('/', auth, (req, res) => {
  const routines = db.getMyRoutines(req.userId);
  res.json(routines);
});

// 추가
router.post('/', auth, spamCheck, (req, res) => {
  const { name, exercises } = req.body;

  if (!name || !exercises) {
    return res.status(400).json({ error: '루틴명과 운동 목록은 필수에요' });
  }

  if (name.length > 100) {
    return res.status(400).json({ error: '루틴명이 너무 길어요' });
  }

  if (!Array.isArray(exercises) || exercises.length === 0) {
    return res.status(400).json({ error: '운동 목록은 비어있을 수 없어요' });
  }

  if (exercises.length > 50) {
    return res.status(400).json({ error: '운동은 최대 50개까지 가능해요' });
  }

  // 개별 운동 항목 검증
  const validExercises = exercises.filter(ex => ex && typeof ex === 'object' && typeof ex.name === 'string' && ex.name.trim());
  if (validExercises.length === 0) {
    return res.status(400).json({ error: '유효한 운동을 하나 이상 입력하세요' });
  }

  const sanitize = str => typeof str === 'string' ? str.replace(/[<>"'&]/g, '') : str;
  const sanitizedName = sanitize(name);
  const sanitizedExercises = validExercises.map(ex => ({ ...ex, name: sanitize(ex.name) }));

  const result = db.createMyRoutine(req.userId, sanitizedName, sanitizedExercises);
  res.status(201).json({ id: result.lastInsertRowid, message: '루틴 저장 완료!' });
});

// 삭제
router.delete('/:id', auth, (req, res) => {
  const result = db.deleteMyRoutine(Number(req.params.id), req.userId);

  if (result.changes === 0) {
    return res.status(404).json({ error: '루틴을 찾을 수 없어요' });
  }
  res.json({ message: '삭제 완료!' });
});

module.exports = router;
