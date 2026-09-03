const router = require('express').Router();
const auth = require('../middleware/auth');
const { spamCheck } = require('../middleware/aiGuard');
const db = require('../db');
const { sanitizeMultiline } = require('../utils/sanitize');

// 루틴 메모장.
//
// 루틴을 만들려면 이름 · 운동 · 세트 · 횟수를 **정해진 칸에** 넣어야 한다. 그런데
// 루틴은 대개 그렇게 완성된 채로 떠오르지 않는다 — 「월요일 가슴, 벤치 5x5, 인클라인
// 3x12쯤?」 하고 적어보다가 고친다. 그 단계를 담을 자리가 앱에 없었다.
//
// **루틴 목록에 섞지 않는다.** 반쯤 적다 만 것이 루틴 목록에 있으면 「시작하기」를
// 누를 수 있는 것이 돼버린다. 다 짜였을 때 사람이 「루틴으로 만들기」를 누른다.

const MAX_NOTES = 30;     // 한 사람이 가질 수 있는 메모 수
const MAX_LEN = 2000;     // 한 장의 길이

// 목록
router.get('/', auth, (req, res) => {
  res.json(db.getNotes(req.userId));
});

// 적은 것을 받는다. **글자만 본다** — 이 앱의 다른 자리와 같은 규칙으로 씻는다
function cleanBody(raw) {
  if (typeof raw !== 'string') return null;
  const clean = sanitizeMultiline(raw).slice(0, MAX_LEN);
  return clean.trim() ? clean : null;
}

router.post('/', auth, spamCheck, (req, res) => {
  const body = cleanBody((req.body || {}).body);
  if (!body) return res.status(400).json({ error: '메모 내용을 적어주세요' });

  // 개수를 막는다. **오래된 것을 우리가 지우지 않는다** — 사람이 적은 것이라
  // 무엇을 버릴지는 사람이 정한다
  if (db.getNotes(req.userId).length >= MAX_NOTES) {
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
