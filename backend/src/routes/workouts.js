const router = require('express').Router();
const auth   = require('../middleware/auth');
const { spamCheck } = require('../middleware/aiGuard');
const db     = require('../db');
const { sanitize, cleanName } = require('../utils/sanitize');

// 운동 이름의 글자 수. **이름을 준다** (2026-10-28) — 다듬는 자리 둘에 생글자로
// 박혀 있었고 화면에는 제한이 없어서 **말없이 잘렸다.** 화면도 같은 이름으로
// 막는다 (`data/limits.js` · `npm run twins` 가 값을 견준다)
const EXERCISE_NAME_MAX = 100;
const { normalizeWeight } = require('../utils/workoutFields');
// 세트 · 횟수의 테두리는 **한 자리에서** 온다 (`utils/setRange.js`, 2026-10-31).
// 여태 아래 두 자리에 `100` · `1000` 이 생글자로 박혀 있었고, `routineSession.js` 는
// 옆에 `MAX_SETS = 100` 을 따로 적고 **주석으로** 「기록 화면이 100 까지 받는다」고
// 맞춰 뒀다 — 그리고 **루틴은 아무 테두리도 없었다**
const { SETS_MAX, REPS_MAX } = require('../utils/setRange');
const { isRecordDay } = require('../utils/dayRange');
const { sendFresh } = require('../utils/fresh');

// 무게 칸과 운동명을 다듬는 자는 **`utils/workoutFields.js` 한 곳에** 있다
// (2026-10-22 에 옮겼다). 파일로 넣는 길(`POST /import`)이 같은 자를 써야 한다 —
// 여기만 음수를 막고 있어서 **CSV 로는 `-50` 이 그대로 들어왔다.**
// 전체 목록 조회.
//
// **바뀐 것이 없으면 다시 안 보낸다** (2026-10-24, `utils/fresh.js`). 앱은 화면을
// 옮길 때마다 이 길을 다시 부르는데(30초 지나면) 5년치면 몸통이 4MB 다 —
// 그 네 번 중 세 번은 바뀐 것이 없다. 그때는 304 한 줄이고, **줄을 모으지도
// 글자로 만들지도 않는다**(`build` 를 안 부른다)
// ── **읽지도 않는 칸을 보내지 않는다** ── (2026-10-31)
//
// 줄마다 `user_id` 와 `client_key` 가 같이 나갔다. 둘 다 **앱이 한 군데서도 안 읽는다** —
//
//   user_id     물어본 그 사람이다 (늘 같은 수다)
//   client_key  지하에서 적어 세운 줄을 두 번 안 넣으려고 두는 표 — 서버만 본다
//
// ── **`created_at` 은 보낸다** (깎으려다 되돌렸다) ──
//
// 처음에 이것까지 뺐다 — 「차례를 매기는 데만 쓴다」고 봤기 때문이다. **아니었다.**
// `data/pace.js` 가 **기록을 남긴 시각으로 운동 속도를 잰다**(오늘 결산의 「보통
// 이만큼 쉰다」 · 「제일 길게 쉰 것」). 뺐으면 그 기능이 **조용히 없는 것**이 됐다 —
// 오늘 하루 그 모양을 다섯 번 고쳤는데 그걸 내 손으로 또 만들 뻔했다.
// 그래서 **깎기 전에 「누가 읽는가」를 값으로 본다** (`npm run thin`).
//
// 5년치에서 재보면 원본 **3.95MB → 3.47MB**, 보낸 바이트도 조금 줄어든다.
// 바이트보다 **폰에서 그것을 푸는 값**이 크다 — 그 `JSON.parse` 가 화면이 뜨는
// 길 위에 있다.
//
// **고르는 자리는 한 곳이다** — 적는 길(`POST`·`PUT`)이 돌려주는 줄도 이것을 지난다.
// 모양이 갈라지면 화면이 섞어 쓰다 어긋난다(저장한 줄만 칸이 더 있게 된다).
const slim = (w) => {
  const o = {
    id: w.id, date: w.date, exercise: w.exercise, weight: w.weight, sets: w.sets, reps: w.reps,
    // **속도를 재는 자가 읽는다** (`data/pace.js`) — 빼면 「보통 이만큼 쉰다」가 사라진다
    created_at: w.created_at,
  };
  // 있을 때만 — 없으면 칸을 안 만든다 (옛 줄과 모양이 같아야 섞어 읽을 때 갈라지지 않는다)
  if (w.link) o.link = w.link;
  if (w.updated_at) o.updated_at = w.updated_at;
  return o;
};

router.get('/', auth, (req, res) => {
  sendFresh(req, res, db.dataTag('workouts', req.userId), () => db.getWorkouts(req.userId).map(slim));
});

// 날짜별 조회는 **없다** (2026-09-19 에 걷었다).
//
// `GET /api/workouts/:date` 가 있었는데 **앱이 한 번도 안 불렀다.** 앱은 목록을 통째로
// 받아 들고 있고(`workoutStore`), 달력도 거기서 걸러 쓴다 — 하루치를 따로 받으면
// 오히려 왕복이 한 번 더 붙는다. 9/18 에 이 길의 DB 쪽을 3.28ms → 0.48ms 로 줄였는데,
// **부르는 사람이 없는 길을 빠르게 만든 것이었다** (`docs/PERF-2026-09-18.md` 참고).
//
// 앱이 부르는 길과 서버가 가진 길이 어긋나는 것은 `npm run api` 가 본다.

// 추가
router.post('/', auth, spamCheck, (req, res) => {
  const { date, exercise, weight, sets, reps, clientKey, link } = req.body;
  // 오프라인 줄에서 올라온 것만 이 키를 달고 온다 (`local-...`). 재전송돼도 서버가
  // 한 번만 만들게 하는 데만 쓴다. 모양이 아니면 그냥 무시(없는 것으로).
  const key = typeof clientKey === 'string' && clientKey.startsWith('local-') && clientKey.length <= 64
    ? clientKey : null;

  // 0 은 빠뜨린 것이 아니라 잘못 적은 것이다. `!sets` 로 묶으면 「필수에요」라고 답하게 되는데,
  // 친 사람은 칸을 채웠으니 왜 안 되는지 모른다. 아래 「1 이상」 검사로 내려보낸다
  if (!date || exercise === undefined || exercise === null || exercise === '' ||
      sets === undefined || sets === null || sets === '' ||
      reps === undefined || reps === null || reps === '') {
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
  // **말이 되는 범위인가** (2026-09-18). 여태 모양만 봐서 `1900-01-01` 도 들어왔다 —
  // 날짜 칸은 `max` 를 걸어도 연도를 직접 칠 수 있고(2026 대신 1026),
  // 한 번 들어간 줄은 1년 벽 · 달력 · 이어온 주에 계속 남는다
  if (!isRecordDay(date)) {
    return res.status(400).json({ error: '그 날짜에는 적을 수 없어요 (2000년 이후, 오늘까지)' });
  }

  // 운동명. 고치는 쪽(PUT)에는 있던 검사가 여기에는 없어서 공백만 친 것도,
  // 문자열이 아닌 것도 그대로 통과해 **이름 없는 기록**이 남았다
  const safeExercise = cleanName(exercise, EXERCISE_NAME_MAX);
  if (!safeExercise) {
    return res.status(400).json({ error: `운동명을 적어주세요 (${EXERCISE_NAME_MAX}자 이하)` });
  }

  // 2.5세트는 없다. 화면도 정수로 그린다
  const numSets = Number(sets);
  const numReps = Number(reps);
  if (!Number.isInteger(numSets) || !Number.isInteger(numReps) || numSets <= 0 || numReps <= 0) {
    return res.status(400).json({ error: '세트와 횟수는 1 이상의 정수여야 해요' });
  }
  if (numSets > SETS_MAX || numReps > REPS_MAX) {
    return res.status(400).json({ error: `세트는 ${SETS_MAX} 이하, 횟수는 ${REPS_MAX} 이하여야 해요` });
  }

  const w = normalizeWeight(weight);
  if (!w.ok) return res.status(400).json({ error: w.why });

  // ── 앞 줄과 묶이는가 ── (2026-10-05)
  //
  // 슈퍼세트(쉬지 않고 다른 운동)와 드롭세트(무게만 내려 이어서)는 **줄을 따로 적는다** —
  // 한 줄 안에 세트별 무게를 담는 모양으로 바꾸면 5년치 기록을 전부 옮겨야 한다.
  // 대신 「이 줄은 앞 줄과 이어진 것」이라는 표시 하나만 둔다. 목록이 그걸 보고 묶어 그린다.
  //
  // **아는 말만 받는다.** 아무 문자열이나 받으면 화면이 모르는 표시를 만나 빈 칸을 그린다
  const safeLink = link === 'super' || link === 'drop' ? link : null;

  const result = db.createWorkout(req.userId, date, safeExercise, w.value, numSets, numReps, key, safeLink);
  // **담은 줄을 같이 보낸다** (2026-10-31) — 화면이 그것을 제자리에 꽂고 목록
  // 전체를 다시 받지 않는다. `GET /workouts` 가 주는 줄과 **같은 모양**이어야 한다
  // (화면이 둘을 섞어 쓴다) — 그래서 다듬거나 고르지 않고 그대로 보낸다
  res.status(201).json({
    id: result.lastInsertRowid,
    workout: result.record ? slim(result.record) : null,
    message: '운동 기록 저장 완료!',
  });
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
  // **말이 되는 범위인가** (2026-09-18). 여태 모양만 봐서 `1900-01-01` 도 들어왔다 —
  // 날짜 칸은 `max` 를 걸어도 연도를 직접 칠 수 있고(2026 대신 1026),
  // 한 번 들어간 줄은 1년 벽 · 달력 · 이어온 주에 계속 남는다
  if (!isRecordDay(date)) {
    return res.status(400).json({ error: '그 날짜에는 적을 수 없어요 (2000년 이후, 오늘까지)' });
  }

  const safeExercisePut = cleanName(exercise, EXERCISE_NAME_MAX);
  if (!safeExercisePut) {
    return res.status(400).json({ error: `운동명을 적어주세요 (${EXERCISE_NAME_MAX}자 이하)` });
  }

  const numSets = Number(sets);
  const numReps = Number(reps);
  if (!Number.isInteger(numSets) || !Number.isInteger(numReps) || numSets <= 0 || numReps <= 0) {
    return res.status(400).json({ error: '세트와 횟수는 1 이상의 정수여야 해요' });
  }
  if (numSets > SETS_MAX || numReps > REPS_MAX) {
    return res.status(400).json({ error: `세트는 ${SETS_MAX} 이하, 횟수는 ${REPS_MAX} 이하여야 해요` });
  }

  const w = normalizeWeight(weight);
  if (!w.ok) return res.status(400).json({ error: w.why });

  const result = db.updateWorkout(id, req.userId, {
    date,
    exercise: safeExercisePut,
    weight: w.value,
    sets: numSets,
    reps: numReps,
  });

  if (result.changes === 0) {
    return res.status(404).json({ error: '기록을 찾을 수 없어요' });
  }
  res.json({ id, workout: result.workout ? slim(result.workout) : null, message: '운동 기록 수정 완료!' });
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
