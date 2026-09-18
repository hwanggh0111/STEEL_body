const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');
const { cleanName, sanitizeObj } = require('../utils/sanitize');
const {
  readWorkouts, readInbody, readMeasures,
  workoutKey, inbodyKey, measureKey,
} = require('../utils/csvRows');

// ─────────────────────────────────────────────────────────────
// 가져오기 (복원) — 2026-09-18.
//
// 내보내기는 있는데 **되돌릴 길이 없었다.** 기기를 바꾸거나 계정을 새로 만들면
// 내려받아 둔 파일이 있어도 못 넣는다. 게다가 이 DB 는 파일 하나라 날아갈 위험이
// 남아 있다 — 「챙겨 나갈 수는 있는데 들고 들어올 수는 없다」는 반쪽이다.
//
// ── 지키는 것 넷 ──
//
// 1. **다시 넣어도 안 늘어난다.** 같은 파일을 두 번 넣는 일은 반드시 일어난다
//    (넣었는지 기억이 안 나서, 또는 신호가 끊겨서). 이미 있는 것과 똑같은 줄은
//    건너뛰고 「건너뛴 수」로 알린다 — 조용히 두 벌로 만들면 그게 더 나쁘다
// 2. **한 줄이 안 되는 것 때문에 나머지를 버리지 않는다.** 되돌리려고 넣는 파일이다.
//    걸린 줄은 몇째 줄이 왜 걸렸는지 되돌려준다 (스무 줄까지)
// 3. **테두리는 손으로 적는 것과 같다.** 날짜 범위 · 숫자 범위 · 이름 길이 —
//    여기서만 느슨하게 받으면 화면과 그래프가 못 읽는 줄이 DB 에 남는다
// 4. **한 번에 받는 양을 정한다.** 파일 한 장이 요청 하나다. 줄이 아주 많으면
//    파일을 나눠 넣으라고 답한다 — 한 사람이 넣은 줄이 모두의 저장 시간이 된다
//    (파일 하나를 통째로 쓰는 DB 다)
// ─────────────────────────────────────────────────────────────

// 한 번에 받는 글자 수 · 줄 수. 5년치 운동이 3만 줄 · 1.2MB 쯤이다
const MAX_CHARS = 2 * 1024 * 1024;
const MAX_ROWS = 20000;
// 사람 하나가 들고 있을 수 있는 줄 수. 넘어가면 그건 기록이 아니라 딴 것이다
const MAX_TOTAL = { workouts: 60000, inbody: 6000, measures: 20000 };
// 왜 걸렸는지는 스무 줄까지만 돌려준다 — 화면에 백 줄을 늘어놓으면 아무도 안 읽는다
const MAX_REASONS = 20;

const KINDS = {
  workouts: {
    label: '운동',
    read: readWorkouts,
    key: workoutKey,
    existing: (userId) => db.getWorkouts(userId),
    put: (userId, r) => db.createWorkout(userId, r.date, r.exercise, r.weight, r.sets, r.reps),
  },
  inbody: {
    label: '인바디',
    read: readInbody,
    key: inbodyKey,
    existing: (userId) => db.getInbody(userId),
    put: (userId, r) => db.createInbody(userId, r.date, r.height, r.weight, r.fat_pct, r.muscle_kg, r.water_l, r.bmi),
  },
  measures: {
    label: '측정',
    read: readMeasures,
    key: measureKey,
    existing: (userId) => db.getMeasures(userId),
    put: (userId, r) => db.createMeasure(userId, r.type, r.date, r.data),
  },
};

// POST /api/import — { kind, csv }
router.post('/', auth, (req, res) => {
  const kind = typeof req.body?.kind === 'string' ? req.body.kind : '';
  const spec = KINDS[kind];
  if (!spec) return res.status(400).json({ error: '무엇을 넣는 것인지 알려주세요 (운동 · 인바디 · 측정)' });

  const csv = typeof req.body?.csv === 'string' ? req.body.csv : '';
  if (!csv.trim()) return res.status(400).json({ error: '파일이 비어 있어요' });
  if (csv.length > MAX_CHARS) {
    return res.status(413).json({ error: '파일이 너무 커요. 기간을 나눠 넣어주세요' });
  }

  const { rows, bad } = spec.read(csv);
  if (rows.length === 0) {
    // **왜 하나도 못 읽었는지 말한다.** 「0건」만 돌려주면 파일이 잘못된 것인지
    // 앱이 못 읽는 것인지 알 수가 없다
    return res.status(400).json({
      error: bad[0]?.why || '읽을 줄이 없어요',
      added: 0, skipped: 0, failed: bad.length,
      reasons: bad.slice(0, MAX_REASONS),
    });
  }
  if (rows.length > MAX_ROWS) {
    return res.status(413).json({ error: `한 번에 ${MAX_ROWS.toLocaleString()}줄까지 넣을 수 있어요. 기간을 나눠 넣어주세요` });
  }

  // 이미 있는 것. **한 번만 읽어 열쇠로 만든다** — 줄마다 다시 훑으면 3만 줄에서 멎는다
  const have = new Set(spec.existing(req.userId).map(spec.key));
  const room = MAX_TOTAL[kind] - have.size;
  if (room <= 0) {
    return res.status(409).json({ error: `${spec.label} 기록이 이미 가득해요 (${MAX_TOTAL[kind].toLocaleString()}줄)` });
  }

  let added = 0;
  let skipped = 0;
  const failed = [...bad];
  for (const r of rows) {
    const k = spec.key(r);
    if (have.has(k)) { skipped += 1; continue; }
    if (added >= room) { failed.push({ line: 0, why: `${spec.label} 기록이 가득 차서 나머지는 못 넣었어요` }); break; }
    try {
      // 운동명은 저장하는 쪽과 같은 손질을 거친다 (보이지 않는 글자 · 앞뒤 공백)
      if (kind === 'workouts') r.exercise = cleanName(r.exercise, 100);
      // 측정 값은 저장하는 쪽(`POST /measures`)과 **같은 손질**을 거친다 —
      // 여기만 날것으로 넣으면 화면이 그 줄에서 깨진다
      if (kind === 'measures') r.data = sanitizeObj(r.data);
      spec.put(req.userId, r);
      have.add(k);
      added += 1;
    } catch (err) {
      failed.push({ line: 0, why: err.message || '못 넣은 줄이 있어요' });
    }
  }

  res.json({
    kind,
    label: spec.label,
    added,
    skipped,
    failed: failed.length,
    reasons: failed.slice(0, MAX_REASONS),
  });
});

module.exports = router;
