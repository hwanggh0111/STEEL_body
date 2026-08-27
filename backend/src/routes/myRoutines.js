const router = require('express').Router();
const auth   = require('../middleware/auth');
const { spamCheck } = require('../middleware/aiGuard');
const db     = require('../db');
const { sanitize, cleanName } = require('../utils/sanitize');

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

  // 배열도 `.length` 가 있어서 길이 검사를 통과했다. 공백만 친 것도 통과했다.
  // 둘 다 새니타이즈 뒤에는 빈 문자열이라 **이름 없는 루틴**으로 남았다
  const safeName = cleanName(name, 100);
  if (!safeName) {
    return res.status(400).json({ error: '루틴명을 적어주세요 (100자 이하)' });
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

  const sanitizedExercises = validExercises.map(ex => ({ ...ex, name: sanitize(ex.name) }));

  const result = db.createMyRoutine(req.userId, safeName, sanitizedExercises);
  res.status(201).json({ id: result.lastInsertRowid, message: '루틴 저장 완료!' });
});

// 고치기 — 루틴에 운동을 더 넣거나 이름을 바꾼다.
//
// 없을 때는 "이미 있는 루틴에 한 개를 더 넣는" 길이 없었다. 그래서 추천 화면의
// `내 루틴에 추가` 가 같은 이름을 만나면 "이미 포함된 운동"이라며 돌려보냈고,
// 두 번째 운동은 영영 못 넣었다.
router.put('/:id', auth, spamCheck, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: '잘못된 ID에요' });
  }

  const { name, exercises } = req.body;
  const fields = {};

  if (name !== undefined) {
    const clean = cleanName(name, 100);
    if (!clean) {
      return res.status(400).json({ error: '루틴명을 적어주세요 (100자 이하)' });
    }
    fields.name = clean;
  }

  if (exercises !== undefined) {
    if (!Array.isArray(exercises) || exercises.length === 0) {
      return res.status(400).json({ error: '운동 목록은 비어있을 수 없어요' });
    }
    if (exercises.length > 50) {
      return res.status(400).json({ error: '운동은 최대 50개까지 가능해요' });
    }
    const valid = exercises.filter(ex => ex && typeof ex === 'object' && typeof ex.name === 'string' && ex.name.trim());
    if (valid.length === 0) {
      return res.status(400).json({ error: '유효한 운동을 하나 이상 입력하세요' });
    }
    fields.exercises = valid.map(ex => ({ ...ex, name: sanitize(ex.name) }));
  }

  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ error: '바꿀 내용이 없어요' });
  }

  const result = db.updateMyRoutine(id, req.userId, fields);
  if (result.changes === 0) {
    return res.status(404).json({ error: '루틴을 찾을 수 없어요' });
  }
  res.json(result.record);
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
