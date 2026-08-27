const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');
const { sanitize } = require('../utils/sanitize');

// ─────────────────────────────────────────────────────────────
// 진행 중인 루틴.
//
// 루틴을 짜놔도 기록 화면과 이어져 있지 않았다. 기록 화면에 루틴을 읽는 코드가
// 한 줄도 없어서, 루틴을 만들어두고도 매번 운동 이름을 처음부터 쳤다.
//
// 한 사람당 한 줄이다 — 한 번에 한 운동을 한다. 서버에 두는 이유는 폰으로 시작해서
// 다른 기기로 이어갈 수 있어야 해서다.
//
// **시작할 때 루틴의 운동 목록을 베껴 담는다.** 하는 도중에 루틴을 고쳐도
// 하던 것이 흔들리면 안 된다.
// ─────────────────────────────────────────────────────────────

const STATES = ['todo', 'done', 'skip'];
const MAX_ITEMS = 50;

// 루틴의 운동 한 줄을 진행표의 한 칸으로.
// sets · reps 는 '4세트' · '10~12회' 처럼 글로 적힌 것이 섞여 있다.
// 화면이 미리 채워 넣을 때 쓰려고 **숫자를 뽑아 같이 담는다** — 못 뽑으면 null 이다
function toItem(ex) {
  const firstNum = (v) => {
    const m = String(v ?? '').match(/\d+/);
    return m ? Number(m[0]) : null;
  };
  return {
    name: sanitize(String(ex?.name ?? '')).slice(0, 100).trim(),
    sets: firstNum(ex?.sets),
    reps: firstNum(ex?.reps),
    state: 'todo',
  };
}

function shape(row) {
  if (!row) return null;
  const done = row.items.filter(i => i.state !== 'todo').length;
  const current = row.items.findIndex(i => i.state === 'todo');
  return {
    routineId: row.routine_id,
    name: row.name,
    items: row.items,
    done,
    total: row.items.length,
    // 다 했으면 -1. 화면은 이걸로 「끝났다」를 안다
    current,
    startedAt: row.started_at,
  };
}

router.get('/', auth, (req, res) => {
  res.json({ session: shape(db.getRoutineSession(req.userId)) });
});

// 시작. 이미 하던 것이 있으면 **덮어쓴다** —
// 화면이 먼저 물어본다. 서버가 여기서 막으면 하던 걸 못 끝낸 사람이 갇힌다
router.post('/', auth, (req, res) => {
  const routineId = Number(req.body?.routineId);
  if (!Number.isInteger(routineId)) {
    return res.status(400).json({ error: '루틴을 고르지 않으셨어요' });
  }

  const routine = db.getMyRoutines(req.userId).find(r => r.id === routineId);
  if (!routine) return res.status(404).json({ error: '없는 루틴이에요' });

  const items = (routine.exercises || [])
    .map(toItem)
    .filter(i => i.name)
    .slice(0, MAX_ITEMS);

  if (items.length === 0) {
    return res.status(400).json({ error: '이 루틴에는 운동이 없어요' });
  }

  const row = db.startRoutineSession(req.userId, routineId, sanitize(routine.name).slice(0, 100), items);
  res.status(201).json({ session: shape(row) });
});

// 한 칸을 끝냈거나 건너뛴다.
//
// 마지막 칸을 끝내면 그 자리에서 줄을 지운다 — 다 한 진행표를 남겨두면
// 다음에 기록 화면을 열 때 끝난 루틴이 계속 위에 붙어 있다
router.patch('/', auth, (req, res) => {
  const index = Number(req.body?.index);
  const state = req.body?.state;
  if (!Number.isInteger(index) || index < 0) {
    return res.status(400).json({ error: '잘못된 자리예요' });
  }
  if (!STATES.includes(state)) {
    return res.status(400).json({ error: '잘못된 상태예요' });
  }

  const row = db.setRoutineItemState(req.userId, index, state);
  if (!row) {
    // 진행표가 아예 없는 것과, 있는데 자리가 어긋난 것은 다른 일이다.
    //
    // 이 진행표는 서버에 둔다 — 폰으로 시작해서 다른 기기로 이어가라고. 그러면 한쪽에서
    // 다른 루틴을 시작했을 때 다른 쪽 화면에는 **옛 진행표의 자리 번호**가 남는다.
    // 둘을 묶어 「진행 중인 루틴이 없어요」라고 답하면, 화면에 버젓이 떠 있는 것을 두고
    // 거짓말을 하는 것이고, 화면은 고칠 방법도 못 받는다.
    //
    // 있으면 지금 것을 같이 준다. 화면이 그걸로 갈아끼우면 그 자리에서 이어갈 수 있다
    const current = db.getRoutineSession(req.userId);
    if (!current) return res.status(404).json({ error: '진행 중인 루틴이 없어요' });
    return res.status(409).json({ error: '진행표가 바뀌었어요. 새로 불러왔습니다', session: shape(current) });
  }

  const finished = row.items.every(i => i.state !== 'todo');
  if (finished) {
    db.endRoutineSession(req.userId);
    return res.json({ session: null, finished: true, name: row.name, total: row.items.length });
  }
  res.json({ session: shape(row), finished: false });
});

// 그만두기
router.delete('/', auth, (req, res) => {
  db.endRoutineSession(req.userId);
  res.json({ session: null });
});

module.exports = router;
