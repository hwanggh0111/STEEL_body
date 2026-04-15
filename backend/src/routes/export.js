const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');

// CSV export - workouts
router.get('/workouts', auth, (req, res) => {
  const workouts = db.getWorkouts(req.userId);

  const header = '날짜,운동명,무게,세트,횟수';
  const rows = workouts.map(w =>
    `${w.date},"${(w.exercise || '').replace(/"/g, '""')}",${w.weight || ''},${w.sets || ''},${w.reps || ''}`
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
