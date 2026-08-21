const router = require('express').Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { spamCheck } = require('../middleware/aiGuard');
const db = require('../db');
const { sanitize, sanitizeMultiline } = require('../utils/sanitize');

// ─────────────────────────────────────────────────────────────
// 제보함 — 버그 · 문의 · 건의
//
// 공지사항 기능을 없애면서 그 자리를 이쪽으로 돌렸다. 쓰기는 본인 것만,
// 읽기는 본인 것만. 관리자만 전체를 보고 답을 단다.
//
// 유형마다 묻는 게 다르므로 meta 에 담아 온다.
//   버그 — screen(어느 화면) · freq(매번/가끔/한 번만)
//   건의 — workaround(지금은 어떻게 하고 있는지)
//   문의 — 없음
// 막는 것은 유형과 제목뿐이다. 나머지가 부실해도 받아서 되묻는 편이 낫다.
// ─────────────────────────────────────────────────────────────

const KINDS = ['bug', 'ask', 'idea'];
const STATUSES = ['received', 'checking', 'done', 'held'];

// meta 로 받을 키와 각각의 최대 길이. 목록에 없는 키는 버린다 —
// 화면이 보내는 것만 저장한다
const META_FIELDS = { screen: 20, freq: 20, workaround: 20 };

// 기기 정보. 사용자가 체크했을 때만 온다. 재현에 쓰는 값이라 짧게만 받는다
const DEVICE_FIELDS = { appVersion: 20, browser: 200, level: 20, tickets: 20 };

function pick(raw, spec) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, max] of Object.entries(spec)) {
    const v = raw[key];
    if (v === undefined || v === null || v === '') continue;
    if (typeof v !== 'string' && typeof v !== 'number') continue;
    const clean = sanitize(String(v)).slice(0, max).trim();
    if (clean) out[key] = clean;
  }
  return out;
}

function badId(req) {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? null : id;
}

// 내 제보 목록
router.get('/', auth, (req, res) => {
  res.json(db.getReports(req.userId));
});

// 관리자 — 전체 목록.
// '/:id' 보다 위에 둔다. 아래에 두면 'all' 이 id 로 잡힌다
router.get('/all', adminAuth, (req, res) => {
  res.json(db.getAllReports());
});

// 제보 등록
router.post('/', auth, spamCheck, (req, res) => {
  const { kind, title, body, meta, device } = req.body;

  if (!KINDS.includes(kind)) {
    return res.status(400).json({ error: '무엇에 대한 제보인지 골라주세요' });
  }

  const cleanTitle = typeof title === 'string' ? sanitize(title).slice(0, 100).trim() : '';
  if (!cleanTitle) {
    return res.status(400).json({ error: '제목을 한 줄만 적어주세요' });
  }

  // 내용은 없어도 받는다. 화면에서도 막지 않는다.
  // 줄바꿈은 살린다 — 재현 절차를 줄로 나눠 적는 게 제일 읽기 쉽다
  const cleanBody = typeof body === 'string' ? sanitizeMultiline(body).slice(0, 2000).trim() : '';

  const record = db.createReport(req.userId, {
    kind,
    title: cleanTitle,
    body: cleanBody,
    meta: pick(meta, META_FIELDS),
    device: Object.keys(pick(device, DEVICE_FIELDS)).length ? pick(device, DEVICE_FIELDS) : null,
  });

  res.status(201).json(record);
});

// 내 제보 지우기
router.delete('/:id', auth, (req, res) => {
  if (badId(req) !== null) return res.status(400).json({ error: '잘못된 ID에요' });
  const result = db.deleteReport(Number(req.params.id), req.userId);
  if (result.changes === 0) return res.status(404).json({ error: '제보를 찾을 수 없어요' });
  res.json({ message: '제보를 지웠어요' });
});

// 관리자 — 상태 변경 · 답변 달기
router.patch('/:id', adminAuth, (req, res) => {
  if (badId(req) !== null) return res.status(400).json({ error: '잘못된 ID에요' });
  const { status, reply } = req.body;

  const fields = {};
  if (status !== undefined) {
    if (!STATUSES.includes(status)) return res.status(400).json({ error: '올바른 상태가 아니에요' });
    fields.status = status;
  }
  if (reply !== undefined) {
    if (reply === null || reply === '') {
      fields.reply = null;
    } else if (typeof reply === 'string') {
      const clean = sanitizeMultiline(reply).slice(0, 2000).trim();
      if (!clean) return res.status(400).json({ error: '답변 내용이 비어 있어요' });
      fields.reply = clean;
    } else {
      return res.status(400).json({ error: '답변 내용이 올바르지 않아요' });
    }
  }
  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ error: '바꿀 내용이 없어요' });
  }

  const result = db.updateReport(Number(req.params.id), fields);
  if (result.changes === 0) return res.status(404).json({ error: '제보를 찾을 수 없어요' });
  res.json(result.report);
});

module.exports = router;
