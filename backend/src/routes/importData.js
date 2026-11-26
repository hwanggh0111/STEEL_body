const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');
const { sanitizeObj } = require('../utils/sanitize');
const {
  readWorkouts, readInbody, readMeasures,
  workoutKey, inbodyKey, measureKey,
} = require('../utils/csvRows');
// ── **상한 값은 한 자리에서 온다** ── (2026-11-26 · 정석)
//
// 아래 갈래마다 수가 생글자로 박혀 있었고, **손으로 적는 길**(`POST /workouts` 등)은
// 그 수를 아예 안 보고 있었다(11/26 전수검사 ①). 값을 `utils/rowCaps.js` 한 벌로
// 모았다 — 한쪽을 올리는 날 다른 쪽이 옛 수로 막으면 사람은 「파일로는 들어가는데
// 손으로는 안 된다」를 겪는다. 갈래 안에 두는 것(11/13)은 그대로다: `max` 는 여전히
// 갈래의 칸이고, 그 값을 여기서 받아 적는다
const { capOf } = require('../utils/rowCaps');


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
// ★ **줄 수 상한은 갈래 안에 둔다** (2026-11-13) — 여기 `MAX_TOTAL` 이라는 **딴 표**로
// 두고 `MAX_TOTAL[kind]` 로 찾아 썼다. 지금은 셋이 맞아 돌지만 **짝이라는 보장이
// 코드에 없었다** — `KINDS` 에 넷째를 더하면서 이 표를 깜빡하면
//
//     room = undefined - have.size  →  NaN
//     NaN <= 0                      →  **false**
//
// 가 되어 **줄 수 상한이 조용히 사라진다.** 가득 찼다는 409 도 안 나가고 무한히
// 들어간다. 그래서 상한을 `KINDS` 의 각 갈래 안(`max`)으로 옮겼다 — 갈래를 적는
// 바로 그 자리라 깜빡할 자리가 없다.
// 왜 걸렸는지는 스무 줄까지만 돌려준다 — 화면에 백 줄을 늘어놓으면 아무도 안 읽는다
const MAX_REASONS = 20;

const KINDS = {
  workouts: {
    label: '운동',
    max: capOf('workouts'),
    read: readWorkouts,
    key: workoutKey,
    existing: (userId) => db.getWorkouts(userId),
    // 7번째가 clientKey(오프라인 줄 표시), 8번째가 link(슈퍼 · 드롭)다.
    // **빠뜨리면 내려받아 다시 올린 기록에서 묶음이 사라진다** (2026-10-05)
    // 유산소 줄의 시간 · 거리도 같이 넘긴다 (2026-11-05)
    put: (userId, r) => db.createWorkout(userId, r.date, r.exercise, r.weight, r.sets, r.reps, null, r.link,
      { minutes: r.minutes ?? null, distanceKm: r.distanceKm ?? null },
      // 한 줄 메모 · 여유 횟수도 같이 (2026-11-18) — 빠뜨리면 되넣은 기록에서 사라진다
      // ── **한쪽씩 적은 것이 이 자리에서 사라지고 있었다** ── (2026-11-24 · 정석)
      //
      // 11/19 에 오른쪽 칸을 붙이며 **네 길이 같은 자를 부르게** 했는데(손으로 적기 ·
      // 고치기 · 파일로 넣기 · 파일로 받기) **담는 이 줄만 빠졌다.** 파서는 읽어서
      // `row.weight_r` 까지 만들어 둔다(`csvRows.js:283`) — 여기서 안 넘기니 버려진다.
      //
      // 재 봤다: 내보낸 CSV 를 **그대로** 다시 넣으면 세 줄에서 **다섯 칸**이 사라지고,
      // 가져오기는 **「3줄 넣었다 · 실패 0」** 이라고 답한다. 사람은 잃은 줄 모른다.
      // ⑥ 「내 기록 전부 받기」가 바로 이 길이라 **한 약속이 어긋나 있었다.**
      //
      // 이 자리 위에 같은 말이 **두 번** 적혀 있다 — 10/05 의 묶음, 11/18 의 메모.
      // 세 번째다. **칸을 늘리는 사람은 이 줄도 같이 본다.**
      //
      // 이름이 갈리는 자리이기도 하다 — 파일 쪽은 `weight_r`(열 이름 꼴), 담는 손은
      // `weightR`(화면이 보내는 꼴)이다. 그 환승이 여기서 일어난다
      { note: r.note ?? null, rir: r.rir ?? null,
        weightR: r.weight_r ?? null, repsR: r.reps_r ?? null }),
  },
  inbody: {
    label: '인바디',
    max: capOf('inbody'),
    read: readInbody,
    key: inbodyKey,
    existing: (userId) => db.getInbody(userId),
    put: (userId, r) => db.createInbody(userId, r.date, r.height, r.weight, r.fat_pct, r.muscle_kg, r.water_l, r.bmi),
  },
  measures: {
    label: '측정',
    max: capOf('measures'),
    read: readMeasures,
    key: measureKey,
    existing: (userId) => db.getMeasures(userId),
    put: (userId, r) => db.createMeasure(userId, r.type, r.date, r.data),
  },
};

// **빠진 갈래가 있으면 서버가 안 뜬다.** 위 까닭대로, 상한이 없는 갈래는 상한이
// 없는 것이 아니라 **상한 검사가 통째로 사라진 것**이다. 사람 기록이 무한히
// 들어가는 것보다 **배포가 그 자리에서 멎는 것**이 낫다 — 올리기 전에 드러난다
for (const [kind, spec] of Object.entries(KINDS)) {
  if (!Number.isInteger(spec.max) || spec.max <= 0) {
    throw new Error(`[import] 갈래 '${kind}' 에 줄 수 상한(max)이 없습니다`);
  }
}

// ── ★ **그날 적은 차례대로 넣는다** ── (2026-11-26 · 정석, TODO 11/26 중간 7)
//
// 내보낸 파일은 **최신이 앞**이다(`routes/export.js`). 파일 차례대로 넣으면 넣는
// 순간이 `created_at` 으로 찍혀 **그날 줄이 거꾸로** 들어갔다 — 화면은 그날의 앞뒤를
// `created_at` 오름으로 보므로(`TrainPage` 의 `linkBoundary`) **60kg → 40kg 드롭**이
// 뒤집혀 드롭이 엉뚱한 줄에 붙었다.
//
// 내보내기가 「순서」 칸을 적는다(그날 **가장 먼저 적은 줄이 1**). 그 칸이 있는 줄만
// 그 차례로 세운다. **없는 파일은 손대지 않는다** — 손으로 만든 파일은 오래된 것부터
// 적혀 있을 수도 있어서, 모르는 채로 뒤집으면 멀쩡한 파일을 망친다(모를 때는 그대로).
//
// 날짜끼리의 차례는 **파일 그대로** 둔다. 한 날짜 안에서만 세운다 —
// 차례를 모르는 줄(`_seq` 가 없는 줄)은 그 날짜의 **뒤에** 파일 차례로 붙는다.
//
// 같은 밀리초에 여러 줄이 들어가도 선다 — 그때는 `created_at` 이 같아서 번호(`id`)
// 오름이 앞뒤를 정하고(`db.js` ROW_CMP), 그 번호가 곧 **넣은 차례**다
function orderForInsert(rows) {
  if (!rows.some((r) => r._seq != null)) return rows;
  const byDay = new Map();                       // 날짜 → 그 줄들 (처음 만난 차례대로)
  for (const r of rows) {
    if (!byDay.has(r.date)) byDay.set(r.date, []);
    byDay.get(r.date).push(r);
  }
  const out = [];
  for (const list of byDay.values()) {
    const known = list.filter((r) => r._seq != null).sort((a, b) => a._seq - b._seq);
    const unknown = list.filter((r) => r._seq == null);
    out.push(...known, ...unknown);
  }
  return out;
}

// POST /api/import — { kind, csv }
router.post('/', auth, (req, res) => {
  const kind = typeof req.body?.kind === 'string' ? req.body.kind : '';
  // **제 칸만 본다** (2026-11-12) — `KINDS['constructor']` 는 함수라서 아래 `spec.read` 에서
  // 500 이 났다(`toString` · `hasOwnProperty` · `__proto__` 다 같다)
  const spec = Object.hasOwn(KINDS, kind) ? KINDS[kind] : null;
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
  //
  // ── **열쇠를 개수로 센다** ── (2026-11-26 · 벼림, 근호 점검 높음 2)
  //
  // 여태 `Set` 이었다. 그러면 같은 날 벤치 60kg 1×10 을 **세 줄로 적은 사람**이 내보낸
  // 파일을 빈 계정에 넣으면 첫 줄을 넣고 `have.add` 한 뒤 둘째 · 셋째가 「이미 있다」로
  // 빠졌다 — **복원하려고 만든 길에서 두 세트가 사라졌다.** 똑같은 세트를 여러 번 하는 것은
  // 운동에서 흔한 일이다. 그래서 열쇠마다 **몇 줄 있나**를 센다:
  //   이미 m 줄 · 파일에 n 줄 → 파일의 앞 m 줄은 「이미 있다」, 나머지 n − m 줄만 넣는다
  //   (다시 넣으면 0 · 빈 계정이면 n · 11/24 「두 번 넣어도 안 늘어난다」는 그대로 선다)
  const existing = spec.existing(req.userId);
  const have = new Map();
  for (const row of existing) {
    const k = spec.key(row);
    have.set(k, (have.get(k) || 0) + 1);
  }
  const seen = new Map(); // 이 파일에서 그 열쇠를 몇 번 만났나
  // 상한도 **줄 수**로 센다 — 열쇠 수로 세면 같은 줄이 여럿인 사람의 남은 자리가 부풀었다
  const room = spec.max - existing.length;
  if (room <= 0) {
    return res.status(409).json({ error: `${spec.label} 기록이 이미 가득해요 (${spec.max.toLocaleString()}줄)` });
  }

  let added = 0;
  let skipped = 0;
  const failed = [...bad];
  // 넣는 차례를 먼저 세운다 (위 `orderForInsert`). 겹침을 세는 데는 영향이 없다 —
  // 열쇠가 같은 줄끼리는 서로 똑같은 줄이라 어느 것을 먼저 넣어도 결과가 같다
  for (const r of orderForInsert(rows)) {
    const k = spec.key(r);
    const nth = (seen.get(k) || 0) + 1;
    seen.set(k, nth);
    if (nth <= (have.get(k) || 0)) { skipped += 1; continue; }
    if (added >= room) { failed.push({ line: 0, why: `${spec.label} 기록이 가득 차서 나머지는 못 넣었어요` }); break; }
    try {
      // 운동명 · 무게는 **읽는 쪽이 이미 다듬었다**(`utils/csvRows` → `workoutFields`).
      // 여기서 또 부르면 안 된다 — 2026-10-22 까지 그랬고, `cleanName` 이 `null` 을
      // 돌려주면 **그 null 을 그대로 넣어 이름 없는 기록**이 남았다. 걸러낼 자리는
      // 줄 수를 아는 읽는 쪽이다(사람에게 「몇째 줄이 왜」를 말할 수 있다)
      // 측정 값은 저장하는 쪽(`POST /measures`)과 **같은 손질**을 거친다 —
      // 여기만 날것으로 넣으면 화면이 그 줄에서 깨진다
      if (kind === 'measures') r.data = sanitizeObj(r.data);
      spec.put(req.userId, r);
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
