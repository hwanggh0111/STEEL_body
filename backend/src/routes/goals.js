const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');
const { seoulDay } = require('../utils/seoulDay');

// ─────────────────────────────────────────────────────────────
// 목표.
//
// 앱이 여태 보여준 것은 전부 **지나간 것**이었다 — 1년 벽 · 주간 요약 · 몸 지도.
// 「이번 주 3일」이 잘한 것인지 모자란 것인지는 끝내 아무도 말해주지 않았다.
// 목표가 있어야 그 수에 뜻이 생긴다.
//
// **남과 겨루지 않는다**는 앱의 약속과 부딪히지 않는다 — 겨루는 상대가 자기 자신이다.
//
// 한 사람당 한 줄이고, 담는 것은 넷이다.
//   weeklyTarget  주 몇 번 (1~7)
//   weightTarget  몇 kg 까지
//   fatTarget     체지방률 몇 % 까지   (2026-10-06)
//   muscleTarget  골격근량 몇 kg 까지  (2026-10-06)
//
// ── 뒤의 둘을 더한 까닭 ── (2026-10-06)
//
// 여태 목표는 **주 몇 번**과 **체중** 둘이었다. 그런데 이 앱 홈페이지의 첫 줄이
// **「무게는 늘었는데 무엇이 늘었는지는 아무도 안 알려준다」**다 —
// 체중은 「몸이 변했다」를 가장 못 말하는 수다. 근육이 늘고 지방이 줄면
// **체중은 안 움직인다.** 목표가 체중뿐이면 그 사람은 제일 잘한 달에
// 「아무 일도 없었다」를 본다.
//
// 즉 **홈페이지가 꼬집은 문제를 목표가 그대로 하고 있었다.** 인바디에 체지방률과
// 골격근량이 이미 담기는데(`routes/inbody.js` 의 `fat_pct` · `muscle_kg`)
// 목표로는 세울 수가 없었다.
//
// **새 칸이라 옛 목표와 안 부딪친다** — 없으면 `null` 이고, 화면은 null 인 줄을
// 안 그린다. 체중 목표를 쫓던 사람은 바뀐 것이 없다.
//
// **계산은 전부 화면이 한다**(`frontend/src/data/goal.js`). 서버는 「무엇을 목표로
// 했는가」만 들고 있는다 — 진행률·연속 주는 이미 서버에 있는 기록에서 나오는 값이라,
// 여기서 또 세어 두면 기록을 고칠 때마다 두 수가 어긋난다.
// ─────────────────────────────────────────────────────────────

// 주 8회는 없다. 몸이 쉬는 날을 스스로 지우는 목표를 앱이 거들지 않는다
const MAX_WEEKLY = 7;
// 사람 체중의 바깥 테두리. 인바디 화면이 쓰는 것과 같은 범위다
const WEIGHT_MIN = 20;
const WEIGHT_MAX = 300;
// 체지방률·골격근량의 바깥 테두리. 인바디 화면이 받는 범위와 같게 둔다 —
// 거기서 담을 수 없는 수를 목표로는 세울 수 있으면 영영 못 닿는 목표가 된다
const FAT_MIN = 3;
const FAT_MAX = 60;
const MUSCLE_MIN = 5;
const MUSCLE_MAX = 100;

const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

// 받은 값을 다듬는다. **버린 것이 있으면 무엇을 버렸는지 같이 돌려준다** —
// 알림 설정에서 배운 것이다. 조용히 버리면 사람은 저장된 줄 알고 화면을 나간다.
//
// `null` 은 **지우라는 뜻**이라 그대로 받는다. 목표 둘 중 하나만 쫓는 사람이 있다
// (주 횟수만, 또는 체중만). 안 받으면 한번 세운 목표를 접을 길이 없다.
function clean(body) {
  const out = {};
  const bad = [];

  if (body?.weeklyTarget === null) out.weekly_target = null;
  else if (body?.weeklyTarget !== undefined) {
    const n = Number(body.weeklyTarget);
    if (Number.isInteger(n) && n >= 1 && n <= MAX_WEEKLY) out.weekly_target = n;
    else bad.push(`주 횟수는 1~${MAX_WEEKLY} 사이로 정해주세요`);
  }

  if (body?.weightTarget === null) out.weight_target = null;
  else if (body?.weightTarget !== undefined) {
    const n = Number(body.weightTarget);
    // 소수 한 자리까지. 체중계가 그만큼만 알려준다
    if (Number.isFinite(n) && n >= WEIGHT_MIN && n <= WEIGHT_MAX) out.weight_target = Math.round(n * 10) / 10;
    else bad.push(`체중 목표는 ${WEIGHT_MIN}~${WEIGHT_MAX}kg 사이로 적어주세요`);
  }

  // 목표를 세운 날의 체중. **화면이 보내준다** — 그 사람의 최근 인바디 값이다.
  // 서버에서 다시 찾지 않는 이유는, 「어느 기록을 시작점으로 볼 것인가」를
  // 두 곳에서 각자 정하면 화면과 서버가 다른 진행률을 말하는 날이 오기 때문이다
  if (body?.weightStart === null) out.weight_start = null;
  else if (body?.weightStart !== undefined) {
    const n = Number(body.weightStart);
    if (Number.isFinite(n) && n >= WEIGHT_MIN && n <= WEIGHT_MAX) out.weight_start = Math.round(n * 10) / 10;
    else bad.push('시작 체중을 확인해 주세요');
  }

  // ── 체지방률 · 골격근량 ── (2026-10-06)
  //
  // 체중과 **똑같은 모양**으로 받는다 — 목표와 시작값 한 쌍이다. 모양을 맞추는
  // 까닭은 화면이 셋을 한 함수로 그리기 때문이다(`data/goal.js` 의 `measureProgress`).
  // 여기서 이름을 다르게 지으면 거기서 셋을 따로 적어야 한다.
  const pair = (key, dbKey, min, max, unit, what) => {
    if (body?.[key] === null) out[dbKey] = null;
    else if (body?.[key] !== undefined) {
      const n = Number(body[key]);
      if (Number.isFinite(n) && n >= min && n <= max) out[dbKey] = Math.round(n * 10) / 10;
      else bad.push(`${what}는 ${min}~${max}${unit} 사이로 적어주세요`);
    }
  };
  pair('fatTarget', 'fat_target', FAT_MIN, FAT_MAX, '%', '체지방률 목표');
  pair('fatStart', 'fat_start', FAT_MIN, FAT_MAX, '%', '시작 체지방률');
  pair('muscleTarget', 'muscle_target', MUSCLE_MIN, MUSCLE_MAX, 'kg', '골격근량 목표');
  pair('muscleStart', 'muscle_start', MUSCLE_MIN, MUSCLE_MAX, 'kg', '시작 골격근량');

  // 언제부터 쫓기 시작했나. 안 주면 서버가 오늘로 적는다 —
  // 사람의 오늘과 서버의 오늘이 다를 수 있어서 화면이 주는 쪽을 먼저 본다
  if (isDate(body?.startedAt)) out.started_at = body.startedAt;
  else if (body?.startedAt !== undefined) bad.push('날짜를 YYYY-MM-DD 로 주세요');

  return { out, bad };
}

// 화면이 읽는 이름으로 돌려준다. DB 는 snake_case, 화면은 camelCase 다
const toClient = (row) => (row ? {
  weeklyTarget: row.weekly_target ?? null,
  weightTarget: row.weight_target ?? null,
  weightStart: row.weight_start ?? null,
  fatTarget: row.fat_target ?? null,
  fatStart: row.fat_start ?? null,
  muscleTarget: row.muscle_target ?? null,
  muscleStart: row.muscle_start ?? null,
  startedAt: row.started_at ?? null,
  updatedAt: row.updated_at ?? null,
} : null);

// GET /api/goals — 내 목표 (없으면 null)
//
// **404 를 주지 않는다.** 목표가 없는 것은 잘못이 아니라 흔한 상태다 —
// 홈은 이 값이 null 이면 카드를 아예 안 그린다
router.get('/', auth, (req, res) => {
  res.json(toClient(db.getGoal(req.userId)));
});

// PUT /api/goals — 세우거나 고친다
router.put('/', auth, (req, res) => {
  const { out, bad } = clean(req.body);

  if (Object.keys(out).length === 0) {
    return res.status(400).json({ error: bad[0] || '바꿀 값이 없어요' });
  }
  if (bad.length) return res.status(400).json({ error: bad[0] });

  // 처음 세우는 것이면 시작 날짜를 적는다. 이미 있으면 **안 건드린다** —
  // 주 횟수를 4에서 3으로 낮췄다고 그동안 이어온 주가 없던 일이 되면 안 된다
  const before = db.getGoal(req.userId);
  if (!before?.started_at && !out.started_at) {
    // **서울 기준 오늘이다** (2026-09-19 에 고쳤다). 서버는 UTC 로 돈다(Render 도 그렇다)
    // — `new Date().toISOString()` 으로 오늘을 만들면 **한국 새벽 0~9시에 목표를 세운
    // 사람의 시작일이 어제로 찍힌다.** 그 어제가 지난 주면 「이어온 주」를 지난 주부터
    // 세기 시작하고, 그 주에 운동이 없으므로 **세우는 순간 끊긴 것으로 보인다.**
    out.started_at = seoulDay(Date.now());
  }

  res.json(toClient(db.saveGoal(req.userId, out)));
});

// DELETE /api/goals — 목표를 접는다
router.delete('/', auth, (req, res) => {
  const result = db.clearGoal(req.userId);
  if (!result.changes) return res.status(404).json({ error: '세워둔 목표가 없어요' });
  res.json({ message: '목표를 접었어요' });
});

module.exports = router;
