const router = require('express').Router();
const auth = require('../middleware/auth');
const { spamCheck } = require('../middleware/aiGuard');
const db = require('../db');
const { sanitizeMultiline } = require('../utils/sanitize');

// 메모. 두 가지로 쓴다 — **날짜가 붙느냐**로 갈린다.
//
//   날짜 없음 : 루틴 메모장 (루틴 화면). 「월요일 가슴 · 벤치 5x5 …」 처럼 짜다 만 것
//   날짜 있음 : 운동 달력의 그날 메모. 「어깨가 안 좋았다」 · 「무게 5kg 올림」
//
// **한 곳에 담는 이유.** 둘은 같은 모양이다(사람이 적은 글 한 덩어리 + 시각).
// 길을 둘로 만들면 새니타이즈 · 길이 제한 · 남의 것 막기가 두 벌이 되고,
// 한쪽만 고치는 날이 온다. 대신 **목록은 확실히 갈라 준다** — 날짜 없는 것을 달라고
// 하면 날짜 있는 것은 안 섞인다. 안 그러면 루틴 메모장에 달력 메모가 쌓인다.
//
// **날짜 메모는 하루 한 장이다.** 그날 일은 한 덩어리로 적는 것이 자연스럽고,
// 여러 장이면 달력 칸에 몇 장인지를 또 그려야 한다. 같은 날에 또 보내면 고쳐준다.

const MAX_NOTES = 30;     // 루틴 메모(날짜 없는 것) 장수
const MAX_LEN = 2000;     // 한 장의 길이

const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
  && !Number.isNaN(new Date(v + 'T00:00:00Z').getTime());
const isMonth = (v) => typeof v === 'string' && /^\d{4}-\d{2}$/.test(v);

// 적은 것을 받는다. **글자만 본다** — 이 앱의 다른 자리와 같은 규칙으로 씻는다
function cleanBody(raw) {
  if (typeof raw !== 'string') return null;
  const clean = sanitizeMultiline(raw).slice(0, MAX_LEN);
  return clean.trim() ? clean : null;
}

// 목록.
//
//   GET /notes            → 루틴 메모 (날짜 없는 것만)
//   GET /notes?month=YYYY-MM → 그 달의 날짜 메모. **달력이 한 달치를 한 번에 받는다**
//                              (칸마다 물어보면 서른 번이다)
//   GET /notes?date=YYYY-MM-DD → 그 하루
router.get('/', auth, (req, res) => {
  const all = db.getNotes(req.userId);
  const { month, date } = req.query;

  if (date !== undefined) {
    if (!isDate(date)) return res.status(400).json({ error: '날짜를 YYYY-MM-DD 로 주세요' });
    return res.json(all.filter(n => n.date === date));
  }
  if (month !== undefined) {
    if (!isMonth(month)) return res.status(400).json({ error: '달을 YYYY-MM 으로 주세요' });
    return res.json(all.filter(n => typeof n.date === 'string' && n.date.startsWith(month)));
  }
  // 날짜가 붙은 것은 달력의 것이다. 루틴 메모장에 섞이면 안 된다
  res.json(all.filter(n => !n.date));
});

router.post('/', auth, spamCheck, (req, res) => {
  const { body: raw, date } = req.body || {};
  const body = cleanBody(raw);
  if (!body) return res.status(400).json({ error: '메모 내용을 적어주세요' });

  if (date !== undefined && date !== null && date !== '') {
    if (!isDate(date)) return res.status(400).json({ error: '날짜를 YYYY-MM-DD 로 주세요' });
    // **하루 한 장.** 이미 있으면 새로 만들지 않고 고친다 — 화면이 「적기」와 「고치기」를
    // 가리지 않아도 되고, 연타로 두 장이 생기지도 않는다
    const exist = db.getNotes(req.userId).find(n => n.date === date);
    if (exist) return res.json(db.updateNote(exist.id, req.userId, body).note);
    return res.status(201).json(db.createNote(req.userId, body, date));
  }

  // 루틴 메모는 여러 장이라 개수를 막는다. **오래된 것을 우리가 지우지 않는다** —
  // 사람이 적은 것이라 무엇을 버릴지는 사람이 정한다
  if (db.getNotes(req.userId).filter(n => !n.date).length >= MAX_NOTES) {
    return res.status(400).json({ error: `메모는 ${MAX_NOTES}장까지예요. 안 쓰는 것을 지워주세요` });
  }
  res.status(201).json(db.createNote(req.userId, body));
});

router.put('/:id', auth, spamCheck, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '잘못된 ID에요' });

  const body = cleanBody((req.body || {}).body);
  if (!body) return res.status(400).json({ error: '메모 내용을 적어주세요' });

  const result = db.updateNote(id, req.userId, body);
  if (!result.changes) return res.status(404).json({ error: '그 메모를 찾을 수 없어요' });
  res.json(result.note);
});

router.delete('/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '잘못된 ID에요' });

  if (!db.deleteNote(id, req.userId).changes) {
    return res.status(404).json({ error: '그 메모를 찾을 수 없어요' });
  }
  res.json({ message: '지웠어요' });
});

module.exports = router;
