const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');
const { csvCell } = require('../utils/csv');
// 이름표는 **가져오기와 같은 표를 쓴다** (2026-09-18 에 `utils/measureLabels.js` 로 옮겼다) —
// 두 벌로 두면 항목 하나를 더할 때 한쪽만 고쳐지고, 그러면 내보낸 파일을 앱이 다시 못 읽는다
const { MEASURE_LABEL, FIELD_LABEL } = require('../utils/measureLabels');
// ── ★ **머리줄은 가져오기와 한 자리에서 온다** ── (2026-11-17)
//
// 여기 세 머리줄이 **생글자로** 박혀 있었고, 그것을 되읽는 쪽(`utils/csvRows.js`)에도
// **같은 이름이 또** 적혀 있었다 — 한 쌍인데 두 벌이다. 한쪽에서 「무게」를
// 「무게(kg)」로 다듬으면 되읽는 쪽이 그 칸을 **못 찾고 조용히 빈 값**으로 넣는다
// (날짜 · 운동명만 거절로 걸린다). 그 파일을 넣은 사람은 수가 비는 것을 나중에 안다.
// `measureLabels` 를 한 자리로 모은 것과 **같은 까닭**이다.
const { headerOf } = require('../utils/csvRows');

// CSV export - workouts
router.get('/workouts', auth, (req, res) => {
  const workouts = db.getWorkouts(req.userId);

  // 숫자 칸(세트·횟수)은 감싸지 않는다 — 감싸면 엑셀이 글자로 읽어 합계가 안 된다.
  // 자유 입력 칸은 `csvCell` 이 맡는다 (따옴표 · 쉼표 · 수식으로 읽히는 앞글자)
  // **「묶음」 칸을 같이 내보낸다** (2026-10-05).
  // 슈퍼세트 · 드롭세트는 「앞 줄과 이어진 것」이라는 표시로만 남는다(`link`).
  // 그 칸을 안 내보내면 내려받아 다시 올린 사람의 기록에서 **표시가 통째로 사라지고**,
  // 남은 가벼운 줄들이 까닭 없는 무게 하락으로 읽힌다 — 기기를 바꾸는 길이 그 길이다.
  //
  // 사람이 읽는 말로 적는다. 엑셀에서 열어보는 파일이라 'drop' 보다 「드롭」이 맞다
  const LINK_KO = { drop: '드롭', super: '슈퍼' };
  // 유산소 칸 둘을 더한다 (2026-11-05). **되읽는 쪽과 짝이다** —
  // 내보낸 것을 못 되읽으면 「챙겨 나갈 수는 있는데 들고 들어올 수는 없다」가 된다
  const header = headerOf('workouts');
  // ── ★ **그날 적은 차례를 같이 적는다** ── (2026-11-26 · 정석, TODO 11/26 중간 7)
  //
  // 이 파일은 **최신이 앞**이다(`db.js` 의 ROW_CMP — 날짜 내림 · 적은 때 내림).
  // 가져오기는 파일 차례대로 넣고, 넣는 그 순간이 `created_at` 으로 찍힌다 →
  // **그날 줄이 거꾸로** 들어갔다. 화면은 그날의 앞뒤를 `created_at` 오름으로
  // 정하므로(`TrainPage` 의 `linkBoundary` · `data/dayRoutine.js`),
  // **60kg → 40kg 드롭**을 내보내고 다시 넣으면 드롭이 먼저 와서 엉뚱한 줄에 붙었다.
  //
  // 차례만 뒤집어 넣게 할 수는 없다 — **손으로 만든 파일은 오래된 것부터** 적혀
  // 있을 수도 있어서, 가져오기는 「뒤집어야 하는 파일」인지 알 길이 없었다.
  // 그래서 **파일이 말하게** 한다: 그날 **가장 먼저 적은 줄이 1** 이다.
  // 이 칸이 있는 파일만 가져오기가 차례를 맞춰 넣고, 없는 파일은 여태처럼 파일 차례다.
  //
  // 측정이 「번호」로 같은 일을 하고 있다(아래 머리글) — 그 자리와 같은 결이다
  const perDay = new Map();
  for (const w of workouts) perDay.set(w.date, (perDay.get(w.date) || 0) + 1);
  const left = new Map(perDay);                 // 그 날짜의 남은 줄 수
  const rows = workouts.map((w) => {
    // 최신이 앞이므로, 그 날짜를 처음 만났을 때가 **그날 마지막으로 적은 줄**이다
    const no = left.get(w.date);
    left.set(w.date, no - 1);
    return `${w.date},${csvCell(w.exercise)},${csvCell(w.weight)},${w.sets || ''},${w.reps || ''},${LINK_KO[w.link] || ''},${w.minutes || ''},${w.distance_km || ''},${csvCell(w.note || '')},${w.rir || ''},${csvCell(w.weight_r || '')},${w.reps_r || ''},${no}`;
  });
  const csv = '\uFEFF' + header + '\n' + rows.join('\n'); // BOM for Korean Excel support

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="steelbody_workouts.csv"');
  res.send(csv);
});

// CSV export - inbody
router.get('/inbody', auth, (req, res) => {
  const records = db.getInbody(req.userId);

  const header = headerOf('inbody');
  const rows = records.map(r =>
    `${r.date},${r.height || ''},${r.weight || ''},${r.fat_pct || ''},${r.muscle_kg || ''},${r.water_l || ''},${r.bmi || ''}`
  );
  const csv = '\uFEFF' + header + '\n' + rows.join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="steelbody_inbody.csv"');
  res.send(csv);
});

// CSV export - 측정 기록.
//
// 운동과 인바디는 내보낼 수 있는데 **측정만 길이 없었다.** 전신 사이즈를 1년 재둔
// 사람이 그것만 못 뽑는다. 고객센터의 「기록이 사라지면」 답이 「서버에 있습니다」인데,
// 꺼낼 길은 두 가지뿐이었던 셈이다.
//
// 종류마다 칸이 다르다(둘레 아홉 개 · 1RM 세 개 · 체력 여섯 개 …). 넓은 표로 만들면
// 빈 칸이 대부분인 서른 열짜리가 된다. **한 줄에 한 항목**으로 길게 편다 —
// 엑셀에서 피벗으로 돌리기도 이쪽이 쉽다.

router.get('/measures', auth, (req, res) => {
  const records = db.getMeasures(req.userId);

  // ── 「번호」를 같이 내보낸다 ── (2026-09-18)
  //
  // **같은 날 같은 종류를 두 번 잰 사람이 있다** (아침·저녁 둘레, 스톱워치 두 판).
  // 여태 내보낸 파일에는 그 둘을 가를 것이 없었다 — 되읽을 때 (날짜 · 종류)로 묶으면
  // **있지도 않던 한 줄로 합쳐진다**(가슴은 아침 것, 허리는 저녁 것). 지우는 것보다 나쁘다.
  // 그래서 그 날 그 종류의 **몇 번째 줄인지**를 적는다.
  const header = headerOf('measures');
  const rows = [];
  // 그 날 그 종류의 몇 번째 줄인가. 받아온 차례를 그대로 쓴다
  const seen = new Map();
  for (const r of records) {
    const label = MEASURE_LABEL[r.type] || r.type;
    const data = r.data && typeof r.data === 'object' ? r.data : {};
    const slot = `${r.date}|${r.type}`;
    const no = (seen.get(slot) || 0) + 1;
    seen.set(slot, no);
    for (const [key, value] of Object.entries(data)) {
      // date 는 이미 첫 칸에 있다. 두 번 적지 않는다
      if (key === 'date' || value === null || value === undefined || value === '') continue;
      const v = typeof value === 'object' ? JSON.stringify(value) : value;
      rows.push(`${r.date},${csvCell(label)},${no},${csvCell(FIELD_LABEL[key] || key)},${csvCell(v)}`);
    }
  }
  const csv = '\uFEFF' + header + '\n' + rows.join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="steelbody_measures.csv"');
  res.send(csv);
});


// ── 통째로 떠받기 (관리자) ── (2026-10-01)
//
// 위의 셋은 **자기 기록**을 CSV 로 받는 길이다. 이건 다르다 — **전부**를 한 장으로
// 받는다. 되돌릴 수 있어야 하기 때문에 CSV 가 아니라 **DB 그대로의 모양**이다.
//
// 왜 있어야 하나: 이 앱의 기록 전부가 파일 두 장에 있다. 파일 하나가 잘못되면
// 아홉 사람의 기록이 한 번에 사라지는데, 떠둘 길이 **아무 데도 없었다.**
// **2026-10-22 에 이 말이 바뀌었다.** 여기 「서버가 Render 에 있으면 `npm run backup`
// 은 못 돌린다」고 적혀 있었는데, 그 스크립트가 오늘 `src/storage` 를 지나게 고쳐져서
// `DATABASE_URL=<운영> npm run backup` 으로 **내 컴퓨터에서 운영을 뜰 수 있다.**
// 그래도 이 길은 남긴다 — 열쇠를 꺼내지 않고 **관리자 화면에서 한 번에** 받는 길이고,
// 사진까지 뜨는 것은 여전히 그쪽뿐이다.
//
// **사진은 안 담는다.** 사람마다 세 장씩이면 수십 MB 라 브라우저가 받다 죽고,
// 서버는 `--max-old-space-size=256` 으로 돈다. 사진은 손으로 뜨는 쪽(`npm run backup`)이
// 가져간다 — **무엇이 빠졌는지 파일 안에 적어둔다.**
router.get('/backup', adminAuth, (req, res) => {
  const data = db.rawSnapshot();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="blackiron-${stamp}.json"`);
  res.send(JSON.stringify({
    뜬때: new Date().toISOString(),
    설명: '관리자가 받은 통째 백업입니다. 사진(photos.json)은 들어 있지 않습니다 — 그것은 npm run backup 으로 뜹니다.',
    data,
  }, null, 2));
});

module.exports = router;
