const router = require('express').Router();
const auth   = require('../middleware/auth');
const { spamCheck } = require('../middleware/aiGuard');
const db     = require('../db');

// ── 받는 종류는 **이름표 표에서 온다** ── (2026-10-21)
//
// 여태 여섯 개를 손으로 또 적어뒀다. `utils/measureLabels.js` 가 바로
// 「두 벌로 두면 한쪽만 고쳐진다」고 적어놓고 옮겨간 표인데, 이 줄이 그 두 번째 벌이었다.
// 어긋나면 **받아 저장은 되는데 내보낸 파일을 앱이 다시 못 읽는** 쪽으로 어긋난다
// (내보내기는 모르는 종류를 열쇠 그대로 적고, 가져오기는 그 줄을 「모르는 종류」로 버린다).
const { MEASURE_LABEL } = require('../utils/measureLabels');
const VALID_TYPES = Object.keys(MEASURE_LABEL);

const { sanitizeObj } = require('../utils/sanitize');

// 칸의 테두리는 **한 자리에서** 온다 (`utils/measureRange.js`, 2026-10-31).
// 여기는 여태 **값의 범위를 아예 안 봤다** — 종류 · 날짜 · 10KB 만 보고 담았다.
// 그래서 허리둘레 0 에서 나온 `Infinity`(JSON 으로는 `null`)와 푸시업 999999 가
// 그대로 들어왔고, 그 값으로 화면이 그래프를 그리고 **말을 짓는다**
const { checkMeasure } = require('../utils/measureRange');
const { isRecordDay } = require('../utils/dayRange');
const { sendFresh } = require('../utils/fresh');

// 전체 목록 조회. **바뀐 것이 없으면 다시 안 보낸다** (`utils/fresh.js`, 2026-10-24)
router.get('/', auth, (req, res) => {
  sendFresh(req, res, db.dataTag('measures', req.userId), () => db.getMeasures(req.userId));
});

// 추가
router.post('/', auth, spamCheck, (req, res) => {
  const { type, date, data } = req.body;

  if (!type || !date || !data) {
    return res.status(400).json({ error: '타입, 날짜, 데이터는 필수에요' });
  }

  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: '올바른 측정 타입이 아니에요' });
  }

  // 모양 · 실제로 있는 날 · **말이 되는 범위**까지 본다 (2026-09-18)
  if (!isRecordDay(date)) {
    return res.status(400).json({ error: '올바른 날짜 형식이 아니에요 (YYYY-MM-DD)' });
  }

  // data 크기 제한 (JSON 직렬화 기준 10KB)
  if (typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: '데이터는 객체 형식이어야 해요' });
  }
  if (JSON.stringify(data).length > 10240) {
    return res.status(400).json({ error: '데이터가 너무 커요 (최대 10KB)' });
  }

  // **말이 되는 범위인가** — 사람의 몸에서 나올 수 있는 값까지다.
  // 그 위는 몸이 아니라 적은 값이 틀린 것이다 (1RM 600kg 에서 그은 그 선)
  const range = checkMeasure(type, data);
  if (!range.ok) return res.status(400).json({ error: range.why });

  const result = db.createMeasure(req.userId, type, date, sanitizeObj(data));
  res.status(201).json({ id: result.lastInsertRowid, message: '측정 기록 저장 완료!' });
});

// 삭제
router.delete('/:id', auth, (req, res) => {
  const result = db.deleteMeasure(Number(req.params.id), req.userId);

  if (result.changes === 0) {
    return res.status(404).json({ error: '기록을 찾을 수 없어요' });
  }
  res.json({ message: '삭제 완료!' });
});

module.exports = router;
