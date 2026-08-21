const router = require('express').Router();
const auth   = require('../middleware/auth');
const { spamCheck } = require('../middleware/aiGuard');
const db     = require('../db');
const { sanitize } = require('../utils/sanitize');

// 무게는 자유 입력 칸이다 — '60', '20kg', '맨몸', '밴드' 가 다 들어온다.
// 그래서 더더욱 형식을 정해둬야 하는데 지금까지 아무 검사 없이 body 값을 그대로 저장했다.
// 운동명은 100자 제한에 새니타이즈까지 하면서 바로 옆 칸만 무방비였다.
//   - 객체나 배열을 보내면 목록을 그리는 React 가 통째로 죽는다
//   - 길이 제한이 없어 아주 긴 문자열이 그대로 DB 에 눌러앉는다
function normalizeWeight(raw) {
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: '맨몸' };
  if (typeof raw !== 'string' && typeof raw !== 'number') return { ok: false };
  const value = sanitize(String(raw)).slice(0, 30).trim();
  return { ok: true, value: value || '맨몸' };
}

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

  const w = normalizeWeight(weight);
  if (!w.ok) return res.status(400).json({ error: '무게 값이 올바르지 않아요' });

  const sanitizedExercise = sanitize(exercise);
  const result = db.createWorkout(req.userId, date, sanitizedExercise, w.value, numSets, numReps);
  res.status(201).json({ id: result.lastInsertRowid, message: '운동 기록 저장 완료!' });
});

// 수정
router.put('/:id', auth, spamCheck, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: '잘못된 ID에요' });
  }

  const { date, exercise, weight, sets, reps } = req.body;

  if (!date || !exercise || sets === undefined || reps === undefined) {
    return res.status(400).json({ error: '날짜, 운동명, 세트, 횟수는 필수에요' });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: '올바른 날짜 형식이 아니에요 (YYYY-MM-DD)' });
  }
  const [y, m, d] = date.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  if (dateObj.getFullYear() !== y || dateObj.getMonth() !== m - 1 || dateObj.getDate() !== d) {
    return res.status(400).json({ error: '존재하지 않는 날짜에요' });
  }

  if (typeof exercise !== 'string' || exercise.length > 100 || exercise.trim() === '') {
    return res.status(400).json({ error: '운동명이 올바르지 않아요' });
  }

  const numSets = Number(sets);
  const numReps = Number(reps);
  if (isNaN(numSets) || isNaN(numReps) || numSets <= 0 || numReps <= 0) {
    return res.status(400).json({ error: '세트와 횟수는 1 이상의 숫자여야 해요' });
  }
  if (numSets > 100 || numReps > 1000) {
    return res.status(400).json({ error: '세트는 100 이하, 횟수는 1000 이하여야 해요' });
  }

  const w = normalizeWeight(weight);
  if (!w.ok) return res.status(400).json({ error: '무게 값이 올바르지 않아요' });

  const sanitizedExercise = sanitize(exercise);

  const result = db.updateWorkout(id, req.userId, {
    date,
    exercise: sanitizedExercise,
    weight: w.value,
    sets: numSets,
    reps: numReps,
  });

  if (result.changes === 0) {
    return res.status(404).json({ error: '기록을 찾을 수 없어요' });
  }
  res.json({ id, message: '운동 기록 수정 완료!' });
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
