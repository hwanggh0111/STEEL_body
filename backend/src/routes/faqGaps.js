const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { sanitize } = require('../utils/sanitize');
const db = require('../db');

// ─────────────────────────────────────────────────────────────
// 답이 안 나온 말.
//
// 고객센터의 「무엇이 궁금하세요?」에서 쳤는데 자주 묻는 것이 **하나도 안 걸린** 말을
// 모은다. FAQ 를 무엇으로 늘릴지 지금까지는 감으로 정했다.
//
// 남기는 것은 **친 말과 횟수, 날짜뿐**이다. 누가 쳤는지는 남기지 않는다 —
// 무엇을 모르는지는 알아야 하지만, 누가 모르는지까지 알 이유가 없다.
//
// 화면이 알아서 보내는 값이라 사람이 누른 것이 아니다. 그래서 두 가지를 건다.
//   1. 앞뒤 2글자 미만은 안 받는다 (치는 중에 스쳐 지나가는 글자)
//   2. 분당 20개까지. 한 글자씩 칠 때마다 날아오면 목록이 쓰레기가 된다.
//      **IP 기준이다** — 같은 공유기를 쓰는 사람이 여럿이면 같이 센다. 이 값은
//      한 사람이 정상적으로 칠 수 있는 양보다 훨씬 커서 실제로 걸릴 일은 드물다
// ─────────────────────────────────────────────────────────────

const MAX_LEN = 40;
const MIN_LEN = 2;

// 공백·기호를 지운 소문자로 같은 말을 모은다 ('비 번' 과 '비번' 은 같은 말이다).
// 고객센터의 matchFaq 가 쓰는 것과 같은 규칙이다
function normalize(s) {
  return String(s || '').toLowerCase().replace(/[\s.,!?~·・\-_'"()]/g, '');
}

const writeLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '잠시 후에 다시 시도해 주세요' },
});

// 화면이 보낸다. 답을 못 찾았을 때만.
router.post('/', auth, writeLimit, (req, res) => {
  const raw = typeof req.body?.term === 'string' ? req.body.term : '';
  const term = sanitize(raw).slice(0, MAX_LEN).trim();
  const key = normalize(term);
  if (key.length < MIN_LEN) {
    return res.status(400).json({ error: '너무 짧아요' });
  }
  db.recordFaqGap(term, key);
  // 화면은 이 응답으로 아무것도 하지 않는다. 몸통을 만들 이유가 없다
  res.status(204).end();
});

// 관리자 — 목록. ?days=30 으로 기간을 좁힌다 (없으면 전체)
router.get('/', adminAuth, (req, res) => {
  const days = Number(req.query.days);
  let sinceIso = null;
  if (Number.isFinite(days) && days > 0) {
    sinceIso = new Date(Date.now() - days * 86400000).toISOString();
  }
  res.json(db.getFaqGaps(sinceIso));
});

// 관리자 — 처리한 것을 지운다 (FAQ 에 답을 넣었거나, 볼 것이 아니거나)
router.delete('/:id', adminAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: '잘못된 id 예요' });
  const { changes } = db.deleteFaqGap(id);
  if (!changes) return res.status(404).json({ error: '없는 항목이에요' });
  res.json({ message: '지웠어요' });
});

module.exports = router;
