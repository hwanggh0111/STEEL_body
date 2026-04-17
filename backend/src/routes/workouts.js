const router = require('express').Router();
const auth   = require('../middleware/auth');
const { spamCheck } = require('../middleware/aiGuard');
const db     = require('../db');

// 전체 목록 조회
router.get('/', auth, (req, res) => {
  const workouts = db.getWorkouts(req.userId);
  res.json(workouts);
});

// 날짜별 조회
router.get('/:date', auth, (req, res) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(req.params.date)) {
    return res.status(400).json({ error: '올바른 날짜 형식이 아니에요' });
  }
  const workouts = db.getWorkoutsByDate(req.userId, req.params.date);
  res.json(workouts);
});

// 추가
router.post('/', auth, spamCheck, (req, res) => {
  const { date, exercise, weight, sets, reps } = req.body;

  if (!date || !exercise || !sets || !reps) {
    return res.status(400).json({ error: '날짜, 운동명, 세트, 횟수는 필수에요' });
  }

  // 날짜 형식 검증 (YYYY-MM-DD, 실제 존재하는 날짜만)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: '올바른 날짜 형식이 아니에요 (YYYY-MM-DD)' });
  }
  const [y, m, d] = date.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  if (dateObj.getFullYear() !== y || dateObj.getMonth() !== m - 1 || dateObj.getDate() !== d) {
    return res.status(400).json({ error: '존재하지 않는 날짜에요' });
  }

  // 운동명 길이 제한
  if (exercise.length > 100) {
    return res.status(400).json({ error: '운동명이 너무 길어요' });
  }

  const numSets = Number(sets);
  const numReps = Number(reps);
  if (isNaN(numSets) || isNaN(numReps) || numSets <= 0 || numReps <= 0) {
    return res.status(400).json({ error: '세트와 횟수는 1 이상의 숫자여야 해요' });
  }
  if (numSets > 100 || numReps > 1000) {
    return res.status(400).json({ error: '세트는 100 이하, 횟수는 1000 이하여야 해요' });
  }

  const { sanitize } = require('../utils/sanitize');
  const sanitizedExercise = sanitize(exercise);
  const result = db.createWorkout(req.userId, date, sanitizedExercise, weight || '맨몸', numSets, numReps);
  res.status(201).json({ id: result.lastInsertRowid, message: '운동 기록 저장 완료!' });
});

// 삭제
router.delete('/:id', auth, (req, res) => {
  const result = db.deleteWorkout(Number(req.params.id), req.userId);

  if (result.changes === 0) {
    return res.status(404).json({ error: '기록을 찾을 수 없어요' });
  }
  res.json({ message: '삭제 완료!' });
});

module.exports = router;
