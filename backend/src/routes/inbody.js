const router = require('express').Router();
const auth   = require('../middleware/auth');
const { spamCheck } = require('../middleware/aiGuard');
const db     = require('../db');
const { isRecordDay } = require('../utils/dayRange');
const { seoulDay } = require('../utils/seoulDay');
const { sendFresh } = require('../utils/fresh');

// 칸의 테두리는 **한 자리에서** 온다 (`utils/inbodyRange.js`) — 파일로 넣는 길도
// 같은 것을 쓴다. 여태 세 자리에 글자로 박혀 있었고 체지방률만 서로 달랐다
const {
  INBODY_WEIGHT_MAX, INBODY_HEIGHT_MAX, FAT_PCT_MAX, MUSCLE_KG_MAX, WATER_L_MAX,
} = require('../utils/inbodyRange');

// 전체 목록. **바뀐 것이 없으면 다시 안 보낸다** (`utils/fresh.js`, 2026-10-24)
router.get('/', auth, (req, res) => {
  sendFresh(req, res, db.dataTag('inbody', req.userId), () => db.getInbody(req.userId));
});

// 추가
router.post('/', auth, spamCheck, (req, res) => {
  let { date, height, weight, fat_pct, muscle_kg, water_l } = req.body;

  if (weight === undefined || weight === null || weight === '') {
    return res.status(400).json({ error: '체중은 필수에요' });
  }

  weight = Number(weight);
  height = (height !== undefined && height !== null && height !== '') ? Number(height) : null;
  fat_pct = (fat_pct !== undefined && fat_pct !== null && fat_pct !== '') ? Number(fat_pct) : null;
  muscle_kg = (muscle_kg !== undefined && muscle_kg !== null && muscle_kg !== '') ? Number(muscle_kg) : null;
  water_l = (water_l !== undefined && water_l !== null && water_l !== '') ? Number(water_l) : null;

  if (isNaN(weight) || weight <= 0 || weight > INBODY_WEIGHT_MAX) {
    return res.status(400).json({ error: `체중은 0~${INBODY_WEIGHT_MAX}kg 사이로 적어주세요` });
  }
  if (height !== null && (isNaN(height) || height <= 0 || height > INBODY_HEIGHT_MAX)) {
    return res.status(400).json({ error: `키는 0~${INBODY_HEIGHT_MAX}cm 사이로 적어주세요` });
  }
  if (fat_pct !== null && (isNaN(fat_pct) || fat_pct < 0 || fat_pct > FAT_PCT_MAX)) {
    return res.status(400).json({ error: `체지방률은 0~${FAT_PCT_MAX}% 사이로 적어주세요` });
  }
  if (muscle_kg !== null && (isNaN(muscle_kg) || muscle_kg < 0 || muscle_kg > MUSCLE_KG_MAX)) {
    return res.status(400).json({ error: `골격근량은 0~${MUSCLE_KG_MAX}kg 사이로 적어주세요` });
  }
  if (water_l !== null && (isNaN(water_l) || water_l < 0 || water_l > WATER_L_MAX)) {
    return res.status(400).json({ error: `체수분은 0~${WATER_L_MAX}L 사이로 적어주세요` });
  }

  // BMI 자동 계산
  const bmi = height && height > 0 ? +(weight / ((height / 100) ** 2)).toFixed(1) : null;

  // 말이 되는 범위가 아니면 **오늘로 적는다** — 여기는 날짜가 곁다리라
  // (체중이 본체다) 거절하는 대신 오늘로 둔다. 모양만 보던 것을 범위까지 본다 (2026-09-18)
  // 대체값도 **서울 기준 오늘**이다 (2026-09-19). UTC 로 만들면 한국 새벽 0~9시에
  // 적은 것이 어제 날짜로 들어간다 — 체중 그래프의 점 하나가 하루 왼쪽에 찍힌다
  //
  // ── **바꿔 적었으면 말해준다** ── (2026-11-03)
  //
  // 거절하지 않는 것은 그대로 둔다(위 까닭). 그런데 **아무 말도 안 하고 있었다** —
  // 날짜 칸은 `max` 를 걸어도 연도를 직접 칠 수 있고(2026 대신 1026), 그러면
  // 화면은 「인바디 기록 저장!」을 띄우고 그 줄은 **오늘 날짜**로 들어간다.
  // 사람은 1026년을 적은 줄 알고, 체중 그래프에서 그 점을 못 찾는다.
  // 운동 기록은 같은 값을 「그 날짜에는 적을 수 없어요」로 **말해준다** —
  // 이 앱이 거듭 세워온 선이 그쪽이다(말없이 바꾸지 않는다).
  const used = isRecordDay(date) ? date : seoulDay(Date.now());
  const dateFixed = date !== undefined && date !== null && date !== '' && used !== date;

  const result = db.createInbody(
    req.userId,
    used,
    height || null,
    weight,
    fat_pct || null,
    muscle_kg || null,
    water_l || null,
    bmi
  );

  // **적힌 날짜를 같이 돌려준다** — 화면이 「무슨 날로 적혔나」를 말할 수 있어야 한다
  res.status(201).json({
    id: result.lastInsertRowid, bmi, date: used,
    ...(dateFixed ? { dateFixed: true } : {}),
    message: '인바디 기록 저장!',
  });
});

// 수정
router.put('/:id', auth, spamCheck, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: '잘못된 ID에요' });
  }

  let { date, height, weight, fat_pct, muscle_kg, water_l } = req.body;

  if (weight === undefined || weight === null || weight === '') {
    return res.status(400).json({ error: '체중은 필수에요' });
  }

  weight = Number(weight);
  height = (height !== undefined && height !== null && height !== '') ? Number(height) : null;
  fat_pct = (fat_pct !== undefined && fat_pct !== null && fat_pct !== '') ? Number(fat_pct) : null;
  muscle_kg = (muscle_kg !== undefined && muscle_kg !== null && muscle_kg !== '') ? Number(muscle_kg) : null;
  water_l = (water_l !== undefined && water_l !== null && water_l !== '') ? Number(water_l) : null;

  if (isNaN(weight) || weight <= 0 || weight > INBODY_WEIGHT_MAX) {
    return res.status(400).json({ error: `체중은 0~${INBODY_WEIGHT_MAX}kg 사이로 적어주세요` });
  }
  if (height !== null && (isNaN(height) || height <= 0 || height > INBODY_HEIGHT_MAX)) {
    return res.status(400).json({ error: `키는 0~${INBODY_HEIGHT_MAX}cm 사이로 적어주세요` });
  }
  if (fat_pct !== null && (isNaN(fat_pct) || fat_pct < 0 || fat_pct > FAT_PCT_MAX)) {
    return res.status(400).json({ error: `체지방률은 0~${FAT_PCT_MAX}% 사이로 적어주세요` });
  }
  if (muscle_kg !== null && (isNaN(muscle_kg) || muscle_kg < 0 || muscle_kg > MUSCLE_KG_MAX)) {
    return res.status(400).json({ error: `골격근량은 0~${MUSCLE_KG_MAX}kg 사이로 적어주세요` });
  }
  if (water_l !== null && (isNaN(water_l) || water_l < 0 || water_l > WATER_L_MAX)) {
    return res.status(400).json({ error: `체수분은 0~${WATER_L_MAX}L 사이로 적어주세요` });
  }

  const bmi = height && height > 0 ? +(weight / ((height / 100) ** 2)).toFixed(1) : null;
  // 고치는 쪽은 안 주면 그대로 둔다. 말이 안 되는 날짜면 **안 바꾼다** (2026-09-18)
  const safeDate = isRecordDay(date) ? date : null;
  // 날짜를 보냈는데 안 바꿨으면 **그것도 말해준다** (2026-11-03, 위 머리글과 같은 결).
  // 고치는 쪽은 더 조용했다 — 날짜만 고치려고 눌렀는데 「수정 완료!」가 뜨고
  // 날짜는 그대로다
  const dateKept = date !== undefined && date !== null && date !== '' && safeDate === null;

  const result = db.updateInbody(id, req.userId, {
    ...(safeDate ? { date: safeDate } : {}),
    height,
    weight,
    fat_pct,
    muscle_kg,
    water_l,
    bmi,
  });

  if (result.changes === 0) {
    return res.status(404).json({ error: '기록을 찾을 수 없어요' });
  }
  res.json({
    id, bmi,
    ...(dateKept ? { dateKept: true } : {}),
    message: '인바디 기록 수정 완료!',
  });
});

// 삭제
router.delete('/:id', auth, (req, res) => {
  const result = db.deleteInbody(Number(req.params.id), req.userId);

  if (result.changes === 0) {
    return res.status(404).json({ error: '기록을 찾을 수 없어요' });
  }
  res.json({ message: '삭제 완료!' });
});

module.exports = router;
