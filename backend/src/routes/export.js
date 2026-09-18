const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');
const { csvCell } = require('../utils/csv');
// 이름표는 **가져오기와 같은 표를 쓴다** (2026-09-18 에 `utils/measureLabels.js` 로 옮겼다) —
// 두 벌로 두면 항목 하나를 더할 때 한쪽만 고쳐지고, 그러면 내보낸 파일을 앱이 다시 못 읽는다
const { MEASURE_LABEL, FIELD_LABEL } = require('../utils/measureLabels');

// CSV export - workouts
router.get('/workouts', auth, (req, res) => {
  const workouts = db.getWorkouts(req.userId);

  // 숫자 칸(세트·횟수)은 감싸지 않는다 — 감싸면 엑셀이 글자로 읽어 합계가 안 된다.
  // 자유 입력 칸은 `csvCell` 이 맡는다 (따옴표 · 쉼표 · 수식으로 읽히는 앞글자)
  const header = '날짜,운동명,무게,세트,횟수';
  const rows = workouts.map(w =>
    `${w.date},${csvCell(w.exercise)},${csvCell(w.weight)},${w.sets || ''},${w.reps || ''}`
  );
  const csv = '\uFEFF' + header + '\n' + rows.join('\n'); // BOM for Korean Excel support

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="steelbody_workouts.csv"');
  res.send(csv);
});

// CSV export - inbody
router.get('/inbody', auth, (req, res) => {
  const records = db.getInbody(req.userId);

  const header = '날짜,키(cm),체중(kg),체지방률(%),골격근량(kg),체수분(L),BMI';
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

  const header = '날짜,종류,항목,값';
  const rows = [];
  for (const r of records) {
    const label = MEASURE_LABEL[r.type] || r.type;
    const data = r.data && typeof r.data === 'object' ? r.data : {};
    for (const [key, value] of Object.entries(data)) {
      // date 는 이미 첫 칸에 있다. 두 번 적지 않는다
      if (key === 'date' || value === null || value === undefined || value === '') continue;
      const v = typeof value === 'object' ? JSON.stringify(value) : value;
      rows.push(`${r.date},${csvCell(label)},${csvCell(FIELD_LABEL[key] || key)},${csvCell(v)}`);
    }
  }
  const csv = '\uFEFF' + header + '\n' + rows.join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="steelbody_measures.csv"');
  res.send(csv);
});

module.exports = router;
