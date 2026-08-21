const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');

// CSV export - workouts
router.get('/workouts', auth, (req, res) => {
  const workouts = db.getWorkouts(req.userId);

  // 운동명만 따옴표로 감싸고 무게는 맨몸으로 뒀었다. 무게도 자유 입력이라
  // 드롭세트를 '20, 30, 40' 으로 적으면 그 줄부터 열이 통째로 밀린다.
  // 숫자 칸(세트·횟수)은 감싸지 않는다 — 감싸면 엑셀이 글자로 읽어 합계가 안 된다.
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;

  const header = '날짜,운동명,무게,세트,횟수';
  const rows = workouts.map(w =>
    `${w.date},${cell(w.exercise)},${cell(w.weight)},${w.sets || ''},${w.reps || ''}`
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

module.exports = router;
