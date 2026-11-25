const router = require('express').Router();
const auth = require('../middleware/auth');
const { spamCheck } = require('../middleware/aiGuard');
const db = require('../db');
const { sanitizeMultiline, tagLike, ANGLE_WHY } = require('../utils/sanitize');
// ── **메모만 날짜 테두리가 없었다** ── (2026-11-03)
//
// 모양만 보고 있었다(`/^\d{4}-\d{2}-\d{2}$/`) — 그래서 `2099-01-01` · `1026-05-05`
// 짜리 메모가 그대로 들어왔다. 운동 · 인바디 · 측정 · 계획은 이미 이 자를 본다
// (`utils/dayRange.js`, 2026-09-18). 메모는 **네 번째로 제 날짜 검사를 들고 있었다.**
//
// **계획과 같은 테두리를 쓴다**(`isPlanDay` — 2000년부터 앞으로 2년). 달력은 앞날
// 칸을 막지 않고, 「내일 스쿼트」 같은 메모는 제자리다 — 기록 쪽 자(`isRecordDay`,
// 앞으로 하루)를 씌우면 **있던 기능이 사라진다.**
//
// **읽는 쪽은 넓게 둔다** — 이 선이 생기기 전에 적힌 메모를 못 읽게 되면 안 된다
const { isRealDate, isPlanDay } = require('../utils/dayRange');

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
const MAX_DAY_NOTES = 4000; // 날짜 메모 장수 — 하루 한 장이라 10년 남짓 (2026-11-25)
// ── ★ **이름을 화면과 맞춘다 — 그래야 자가 두 쪽을 맞댄다** ── (2026-11-17 · 정석)
//
// 이 값은 `MAX_LEN` 이었다. 화면 쪽은 `data/limits.js` 의 `NOTE_BODY_MAX` 이고,
// 그 파일 머리글이 짝을 **주석으로** 적어뒀다 — `NOTE_BODY_MAX → routes/notes.js
// (MAX_LEN)`. 그런데 `check-twins` 는 **이름이 같은 상수**를 찾아 값을 맞댄다.
// 이름이 다르면 **짝이 아예 안 잡히고**, 그 파일 머리글이 적어둔 그대로
// 「한쪽에만 남은 이름은 **덫**이다」가 된다.
//
// 한쪽만 고치는 날 **고객센터 글이 거짓이 된다** — 「메모는 30장까지, 한 장에
// 2000자까지예요」는 사람이 그 수를 믿고 적는 자리다. 이름을 맞추면 자가 알아서
// 본다(값이 갈리면 `npm run twins` 가 그 자리에서 FAIL 한다).
const NOTE_BODY_MAX = 2000;     // 한 장의 길이 — 화면은 `data/limits.js` 의 같은 이름

const isMonth = (v) => typeof v === 'string' && /^\d{4}-\d{2}$/.test(v);

// 적은 것을 받는다. **글자만 본다** — 이 앱의 다른 자리와 같은 규칙으로 씻는다
//
// ── ★ **메모도 이름 칸과 같은 자로 막는다** ── (2026-11-17, 주인 결정)
//
// 11/17 에 이름 칸이 `L<R` 을 **거절하고 까닭을 말하게** 됐다(`tagLike`·`ANGLE_WHY`).
// 그런데 메모는 여태처럼 **조용히 잘라서** 담았다 — 「L<R 불균형」이 **「L」** 이 된다.
// 주인에게 갈래로 올려 **「이름 칸과 같게 거절한다」**를 받았다.
//
// **대가를 알고 고른 것이다** — 지금 걷어서 담던 것도 막힌다:
//
//     <b>어깨</b> 아픔   → 여태: 「어깨 아픔」으로 담김 / 이제: **거절**
//
// 그 대신 **조용히 잘리는 일이 없어진다.** 11/03 의 선은 그대로 산다 —
// `tagLike` 는 `<` **바로 뒤**에 글자가 올 때만 참이므로 「무게 60>65」 ·
// 「허리 각도 < 45도」 · 「<3」 · 「3 <- 4」 · 「L < R」 은 **통과한다.**
//
// **보내는 길에만 건다.** 받는 길(목록)에는 안 건다 — 이미 담긴 옛 글은 읽혀야 한다.
// **제보(`routes/reports.js`)에는 안 걸었다**(정석 판정, 11/17): 그것은 고객센터로
// 들어오는 글이고, 거기서 막히면 **사람이 도움을 청할 길이 막힌다.** 메모는 제 기록
// 이라 다시 적을 수 있지만 제보는 그렇지 않다 — 무게가 다르다.
function cleanBody(raw) {
  if (typeof raw !== 'string') return null;
  const clean = sanitizeMultiline(raw).slice(0, NOTE_BODY_MAX);
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
    if (!isRealDate(date)) return res.status(400).json({ error: '날짜를 YYYY-MM-DD 로 주세요' });
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
  // 태그 모양은 걷지 않고 거절한다 (위 `cleanBody` 머리글 · 주인 결정)
  if (tagLike(raw)) return res.status(400).json({ error: ANGLE_WHY });
  const body = cleanBody(raw);
  if (!body) return res.status(400).json({ error: '메모 내용을 적어주세요' });

  if (date !== undefined && date !== null && date !== '') {
    if (!isPlanDay(date)) return res.status(400).json({ error: '그 날짜에는 적을 수 없어요 (2000년 이후, 앞으로 2년까지)' });
    // **하루 한 장.** 이미 있으면 새로 만들지 않고 고친다 — 화면이 「적기」와 「고치기」를
    // 가리지 않아도 되고, 연타로 두 장이 생기지도 않는다
    const mine = db.getNotes(req.userId);
    const exist = mine.find(n => n.date === date);
    if (exist) return res.json(db.updateNote(exist.id, req.userId, body).note);
    // **그날 메모에도 상한** (2026-11-25 · 근호). 아래 `MAX_NOTES` 는 날짜 없는 것만 셌다 —
    // 2000-01-01 부터 2년 뒤까지 날마다 2000자씩 넣으면 한 계정이 수십 MB 를 쥐었다.
    // 하루 한 장이니 날짜 메모는 날 수만큼이고, 그 상한은 넉넉히 잡는다(10년 남짓)
    if (mine.filter(n => n.date).length >= MAX_DAY_NOTES) {
      return res.status(409).json({ error: `날짜 메모는 ${MAX_DAY_NOTES.toLocaleString()}장까지예요. 오래된 것을 지워주세요` });
    }
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

  // 태그 모양은 걷지 않고 거절한다 (위 `cleanBody` 머리글 · 주인 결정)
  if (tagLike((req.body || {}).body)) return res.status(400).json({ error: ANGLE_WHY });
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
