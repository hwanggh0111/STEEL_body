const router = require('express').Router();
const auth = require('../middleware/auth');
const { spamCheck } = require('../middleware/aiGuard');
const db = require('../db');
const { cleanName } = require('../utils/sanitize');

// 앞으로 할 것 — 달력에서 날짜를 골라 미리 정해둔다.
//
// **기록(`/workouts`)과 섞지 않는다.** 한 것과 할 것은 다른 이야기다 —
// 섞어두면 「이번 달에 몇 번 나왔나」에 아직 하지도 않은 날이 같이 세어진다.
//
// 계획은 **그날이 지나도 지우지 않는다.** 안 한 날을 조용히 지워버리면
// 왜 못 했는지가 아무 데도 안 남는다. 화면이 「못 한 것」으로 흐리게 그린다.

// 한 날에 너무 많이 담지 않게 한다. 달력 칸에 그릴 수 있는 만큼이고,
// 그보다 많으면 계획이 아니라 목록이다
const MAX_PER_DAY = 10;
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

// GET /api/plans — 내 계획 전부 (날짜 오름차순)
router.get('/', auth, (req, res) => {
  res.json(db.getPlans(req.userId));
});

// POST /api/plans — 하나 담기
//
// kind 는 둘이다.
//   routine  — 내가 만든 루틴 하나를 그날에 건다 (제일 흔한 쓰임)
//   exercise — 운동 이름 하나
router.post('/', auth, spamCheck, (req, res) => {
  const { date, kind, name, routineId } = req.body || {};

  if (!isDate(date)) return res.status(400).json({ error: '날짜를 YYYY-MM-DD 로 주세요' });
  if (kind !== 'routine' && kind !== 'exercise') {
    return res.status(400).json({ error: '루틴이나 운동 중에 골라주세요' });
  }

  // 이름은 다른 자리와 같은 규칙으로 씻는다. `'   '` 도 `'<<<>>>'` 도 여기서는 빈 이름이
  // 되는데, 길이만 재고 넘기면 **이름 없는 계획**이 달력에 뜬다
  const safeName = cleanName(name, 40);
  if (!safeName) return res.status(400).json({ error: '무엇을 할지 적어주세요' });

  const mine = db.getPlans(req.userId);
  if (mine.filter(p => p.date === date).length >= MAX_PER_DAY) {
    return res.status(400).json({ error: `하루에 ${MAX_PER_DAY}개까지만 담을 수 있어요` });
  }
  // 같은 날 같은 것을 두 번 담지 않는다 — 눌린 줄 모르고 또 누르는 자리다
  if (mine.some(p => p.date === date && p.name === safeName)) {
    return res.status(400).json({ error: '그날에 이미 담겨 있어요' });
  }

  // 루틴이면 **내 루틴인지 본다.** 남의 루틴 번호를 적어 보내면 그 이름이 붙는다
  let rid = null;
  if (kind === 'routine') {
    const id = Number(routineId);
    const found = db.getMyRoutines(req.userId).find(r => (r.id ?? r._id) === id);
    if (!found) return res.status(400).json({ error: '그 루틴을 찾을 수 없어요' });
    rid = found.id ?? found._id;
  }

  const row = db.createPlan(req.userId, { date, kind, name: safeName, routine_id: rid });
  res.status(201).json(row);
});

// DELETE /api/plans/:id
router.delete('/:id', auth, (req, res) => {
  const result = db.deletePlan(Number(req.params.id), req.userId);
  if (!result.changes) return res.status(404).json({ error: '그 계획을 찾을 수 없어요' });
  res.json({ message: '지웠어요' });
});

module.exports = router;
