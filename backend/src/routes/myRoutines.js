const router = require('express').Router();
const auth   = require('../middleware/auth');
const { spamCheck } = require('../middleware/aiGuard');
const db     = require('../db');
const { sanitize, cleanName } = require('../utils/sanitize');

// 세트 · 횟수의 테두리는 **한 자리에서** 온다 (`utils/setRange.js`, 2026-10-31).
// 여기는 여태 sets · reps 를 **아예 안 봤다** — `{ ...ex }` 로 받은 것을 그대로 담았다.
// 「999999세트」가 들어가면 그 루틴을 시작한 운동 화면이 세트 단추를 **구십구만 개**
// 그린다. 글로 적힌 것(`'10~12'`)이 섞여 있어 모양은 안 따지고 **숫자만** 본다
const { checkSetsReps } = require('../utils/setRange');

// 루틴 한 벌에 담을 운동 수.
//
// **이름을 준다** (2026-10-28). 여태 `50` 이 두 자리에 글자로 박혀 있었고(만들기 ·
// 고치기) **화면에는 아무 데도 없었다** — 「+ 운동 추가」를 쉰한 번 누를 수 있고
// 저장에서야 막혔다. 화면도 같은 이름으로 들게 하고(`data/limits.js`)
// `npm run twins` 가 양쪽 값을 견준다 — 같은 숫자가 두 곳에 있으면 반드시 어긋난다
const MAX_EXERCISES = 50;

// 루틴 이름의 글자 수.
//
// **이름을 준다** (2026-10-28). 다듬는 자리에 글자 수가 **생글자로** 박혀 있었고
// (두 자리), 화면에는 아무 제한이 없어서 101자를 치면 **말없이 잘렸다.**
// 화면도 같은 이름으로 막게 하고(`data/limits.js`) `npm run twins` 가 값을 견준다
const ROUTINE_NAME_MAX = 100;

// ── **운동 줄은 글자로도 담겨 있다** ── (2026-11-11, 정석)
//
// 이 앱의 루틴 줄은 꾸러미(`{ name, sets, reps }`)이지만, **글자 하나**(`'벤치프레스'`)
// 로 담긴 옛 줄이 데이터 모양에 들어 있다. 화면이 네 자리에서 그렇게 다룬다 —
// 읽는 자리 셋(`RoutinePage.jsx:167`·`:350`·`:850`)과 **고치는 폼에 얹을 때 꾸러미로
// 바꿔주는 자리** 하나(`:166` 의 `editRoutine`). 그 읽기는 **2026-04-15 최초 판본부터**
// 있다.
//
// 그런데 이 파일은 `typeof ex === 'object'` 만 통과시켜 **글자 줄을 조용히 버렸다.**
// 고치는 화면은 위의 `editRoutine` 이 먼저 꾸러미로 바꿔 보내므로 멀쩡했는데,
// **되돌리기는 그 자리를 지나지 않는다** — `data/undoRow.js` 의 `routinePayload` 는
// 「되살린 루틴이 원래와 다른 루틴이 되면 안 된다」며 **담긴 모양 그대로** 보낸다.
// 그래서 글자 줄이 있는 옛 루틴을 고치거나 지운 뒤 「되돌리기」를 누르면 **그 줄이
// 빠진 루틴**이 되살아나고, 전부 글자였으면 400 이 나서 「되살리지 못했어요」가 뜬다.
//
// 담긴 것을 **버리는 쪽이 아니라 받는 쪽**이 맞다 — 지우는 것은 사람이 적은 것이다.
// `npm run routinerow` 가 서버와 화면이 같은 모양을 받는지 본다.
const asRow = (ex) => (typeof ex === 'string' ? { name: ex } : ex);

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
  const safeName = cleanName(name, ROUTINE_NAME_MAX);
  if (!safeName) {
    return res.status(400).json({ error: `루틴명을 적어주세요 (${ROUTINE_NAME_MAX}자 이하)` });
  }

  if (!Array.isArray(exercises) || exercises.length === 0) {
    return res.status(400).json({ error: '운동 목록은 비어있을 수 없어요' });
  }

  if (exercises.length > MAX_EXERCISES) {
    return res.status(400).json({ error: `운동은 최대 ${MAX_EXERCISES}개까지 가능해요` });
  }

  // 개별 운동 항목 검증
  const validExercises = exercises.map(asRow)
    .filter(ex => ex && typeof ex === 'object' && typeof ex.name === 'string' && ex.name.trim());
  if (validExercises.length === 0) {
    return res.status(400).json({ error: '유효한 운동을 하나 이상 입력하세요' });
  }

  // 세트 · 횟수가 테두리 안인가. **첫 줄에서 걸린 것만 말한다** —
  // 어느 줄인지 알아야 고칠 수 있으니 운동 이름을 같이 적는다
  for (const ex of validExercises) {
    const r = checkSetsReps(ex);
    if (!r.ok) return res.status(400).json({ error: r.why });
  }

  const sanitizedExercises = validExercises.map(ex => ({ ...ex, name: sanitize(ex.name) }));

  const result = db.createMyRoutine(req.userId, safeName, sanitizedExercises);
  // **다듬은 글자를 같이 돌려준다** (2026-10-28). 여기서 이름의 앞뒤·가운데 공백을
  // 줄이고 `<>` 를 걷어내는데, 번호만 돌려주니 화면은 **사람이 친 날글**을 목록에
  // 얹었다 — 새로고침하면 글자가 달라진다. 고치기(`PUT`)는 이미 record 를 돌려준다
  res.status(201).json({
    id: result.lastInsertRowid,
    name: result.record.name,
    exercises: result.record.exercises,
    message: '루틴 저장 완료!',
  });
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
    const clean = cleanName(name, ROUTINE_NAME_MAX);
    if (!clean) {
      return res.status(400).json({ error: `루틴명을 적어주세요 (${ROUTINE_NAME_MAX}자 이하)` });
    }
    fields.name = clean;
  }

  if (exercises !== undefined) {
    if (!Array.isArray(exercises) || exercises.length === 0) {
      return res.status(400).json({ error: '운동 목록은 비어있을 수 없어요' });
    }
    if (exercises.length > MAX_EXERCISES) {
      return res.status(400).json({ error: `운동은 최대 ${MAX_EXERCISES}개까지 가능해요` });
    }
    const valid = exercises.map(asRow)
      .filter(ex => ex && typeof ex === 'object' && typeof ex.name === 'string' && ex.name.trim());
    if (valid.length === 0) {
      return res.status(400).json({ error: '유효한 운동을 하나 이상 입력하세요' });
    }
    for (const ex of valid) {
      const r = checkSetsReps(ex);
      if (!r.ok) return res.status(400).json({ error: r.why });
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
