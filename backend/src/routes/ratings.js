const router = require('express').Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const db = require('../db');

// ─────────────────────────────────────────────────────────────
// 만족도 — 「이 앱 어떠세요」 별 하나 줄.
//
// 제보함과 일부러 따로 둔다. 제보는 할 말이 있는 사람만 쓰지만, 점수는 아무 말이
// 없는 사람도 한 번 누르고 지나갈 수 있다. 그 둘은 다른 이야기를 해준다.
//
// 받는 것은 점수뿐이다. 이유까지 여기서 물으면 누르는 게 일이 되고, 제보함과
// 같은 것을 두 곳에서 묻게 된다. 낮은 점수를 준 사람에게는 화면이 제보함을 열어준다.
//
// 한 사람당 한 줄만 남는다 — 여러 줄을 쌓으면 자주 누른 사람이 평균을 끌고 간다.
// ─────────────────────────────────────────────────────────────

// 내가 매긴 점수. 아직 안 매겼으면 null.
// 기기를 바꿔도 다시 묻지 않으려면 화면이 아니라 서버가 기억해야 한다
router.get('/me', auth, (req, res) => {
  const mine = db.getRating(req.userId);
  res.json({ score: mine ? mine.score : null, updatedAt: mine ? mine.updated_at : null });
});

router.post('/', auth, (req, res) => {
  const score = Number(req.body?.score);
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return res.status(400).json({ error: '별은 1개에서 5개까지예요' });
  }
  const saved = db.saveRating(req.userId, score);
  res.status(201).json({ score: saved.score, updatedAt: saved.updated_at });
});

// 관리자 — 분포만. 누가 몇 점을 줬는지는 돌려주지 않는다
router.get('/stats', adminAuth, (req, res) => {
  res.json(db.getRatingStats());
});

module.exports = router;
