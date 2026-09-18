const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');
const { cleanName } = require('../utils/sanitize');

// ─────────────────────────────────────────────────────────────
// 기구 세팅.
//
// 기구 앞에서 **매번 다시 맞춘다.** 시트 몇 번, 발판 몇 칸, 그립 어디.
// 한두 번 틀리게 맞춘 뒤에야 몸이 기억해내고, 그 사이에 세트 한두 개를 버린다.
//
// 이건 「기능」이라기보다 **현장의 마찰**이고, 이 앱은 이미 어느 운동을 하는지
// 알고 있으니 붙일 자리가 이미 있었다.
//
// ── 헬스장마다 따로 둔다 ──
//
// 기구가 다르면 시트 번호도 다르다. 강남점 세팅을 집 앞 헬스장에서 그대로 쓰면
// **틀린 값을 믿고 맞추는 셈**이라 아예 없느니만 못하다. 열쇠는 (사람 · 헬스장 · 운동)이다.
//
// **위치는 안 본다.** GPS 를 쓰면 권한을 물어야 하고, 지하 헬스장에서는 잡히지도 않는다.
// 이름만 고르면 된다 — 사람은 자기가 어느 헬스장에 있는지 안다.
// ─────────────────────────────────────────────────────────────

// 칸에 들어갈 수 있는 것. 기구마다 조절하는 것이 달라서 **다 비워둘 수 있다**
const SLOTS = ['seat', 'foot', 'grip'];
// 「4」 · 「2칸」 · 「넓게」 처럼 짧은 말이다. 길어지면 그건 메모지 세팅이 아니다
const SLOT_MAX = 12;
const NOTE_MAX = 120;
const GYM_MAX = 20;
const EXERCISE_MAX = 40;
// 한 헬스장에 이만큼이면 충분하다. 넘어가면 그건 세팅이 아니라 목록이다
const MAX_PER_GYM = 60;
// **다니는 곳 수에도 테두리를 둔다** (2026-09-18).
//
// 여태 한 곳당 60개만 막고 **곳 수는 안 막았다.** 그러면 헬스장 이름을 바꿔가며
// 끝없이 쌓을 수 있다 — 이 DB 는 파일 하나를 통째로 읽고 쓰는 구조라(`db.js`),
// 한 사람이 늘린 줄이 **모두의 저장 시간**이 된다.
//
// 사람이 실제로 다니는 곳은 집 앞 · 회사 앞 · 본점 · 여행지쯤이다. 열두 곳이면 넉넉하다
const MAX_GYMS = 12;

const nameOf = (v, max) => cleanName(v, max);

// 받은 값을 다듬는다. **`null` 은 지우라는 뜻**이라 그대로 받는다 —
// 시트만 있는 기구에서 발판 칸을 비울 길이 있어야 한다.
function clean(body) {
  const out = {};
  const bad = [];

  for (const slot of SLOTS) {
    if (body?.[slot] === null || body?.[slot] === '') { out[slot] = null; continue; }
    if (body?.[slot] === undefined) continue;
    const v = nameOf(body[slot], SLOT_MAX);
    if (!v) { bad.push('세팅은 「4」 · 「넓게」 처럼 짧게 적어주세요'); continue; }
    out[slot] = v;
  }

  if (body?.note === null || body?.note === '') out.note = null;
  else if (body?.note !== undefined) {
    const v = nameOf(body.note, NOTE_MAX);
    if (!v) bad.push('한마디를 확인해 주세요');
    else out.note = v;
  }

  return { out, bad };
}

const toClient = (row) => (row ? {
  gym: row.gym,
  exercise: row.exercise,
  seat: row.seat ?? null,
  foot: row.foot ?? null,
  grip: row.grip ?? null,
  note: row.note ?? null,
  updatedAt: row.updated_at ?? null,
} : null);

// GET /api/gym-settings?gym=강남점 — 그 헬스장 세팅 전부 + 내가 다니는 곳 목록
//
// **목록을 같이 준다.** 화면이 헬스장을 고르려면 어디를 다니는지 알아야 하는데,
// 그걸 따로 물으면 화면 하나에 요청이 둘이 된다
router.get('/', auth, (req, res) => {
  const gym = typeof req.query.gym === 'string' ? nameOf(req.query.gym, GYM_MAX) : null;
  res.json({
    gyms: db.getGyms(req.userId),
    settings: db.getGymSettings(req.userId, gym || undefined).map(toClient),
  });
});

// PUT /api/gym-settings — 세우거나 고친다
router.put('/', auth, (req, res) => {
  const gym = nameOf(req.body?.gym, GYM_MAX);
  const exercise = nameOf(req.body?.exercise, EXERCISE_MAX);
  if (!gym) return res.status(400).json({ error: '어느 헬스장인지 적어주세요' });
  if (!exercise) return res.status(400).json({ error: '어떤 운동인지 적어주세요' });

  const { out, bad } = clean(req.body);
  if (bad.length) return res.status(400).json({ error: bad[0] });

  // **빈 세팅을 만들지 않는다.** 네 칸이 전부 비었으면 적을 것이 없다는 뜻이다 —
  // 그런 줄을 만들어두면 다음에 그 운동을 열 때 빈 카드가 뜬다
  const already = db.getGymSetting(req.userId, gym, exercise);
  const merged = { ...(already || {}), ...out };
  if (!merged.seat && !merged.foot && !merged.grip && !merged.note) {
    // 이미 있던 것을 다 비운 것은 **지우겠다는 뜻**이다
    if (already) {
      db.deleteGymSetting(req.userId, gym, exercise);
      return res.json({ removed: true });
    }
    return res.status(400).json({ error: '한 칸은 적어주세요' });
  }

  if (!already && db.getGymSettings(req.userId, gym).length >= MAX_PER_GYM) {
    return res.status(400).json({ error: `한 헬스장에 ${MAX_PER_GYM}개까지만 적을 수 있어요` });
  }

  // **새 헬스장을 만드는 것이면** 곳 수도 본다. 이미 다니는 곳이면 안 센다 —
  // 다니던 곳에 세팅을 더하는 일은 막을 이유가 없다
  if (!already) {
    const gyms = db.getGyms(req.userId);
    if (!gyms.some((g) => g.name === gym) && gyms.length >= MAX_GYMS) {
      return res.status(400).json({
        error: `헬스장은 ${MAX_GYMS}곳까지만 둘 수 있어요. 안 다니는 곳의 세팅을 지워주세요`,
      });
    }
  }

  res.json(toClient(db.saveGymSetting(req.userId, gym, exercise, out)));
});

// DELETE /api/gym-settings?gym=강남점&exercise=랫풀다운
router.delete('/', auth, (req, res) => {
  const gym = nameOf(req.query.gym, GYM_MAX);
  const exercise = nameOf(req.query.exercise, EXERCISE_MAX);
  if (!gym || !exercise) return res.status(400).json({ error: '어느 헬스장의 어떤 운동인지 알려주세요' });
  const { changes } = db.deleteGymSetting(req.userId, gym, exercise);
  if (!changes) return res.status(404).json({ error: '적어둔 세팅이 없어요' });
  res.json({ message: '지웠어요' });
});

module.exports = router;
