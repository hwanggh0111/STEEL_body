const router = require('express').Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { spamCheck } = require('../middleware/aiGuard');
const db = require('../db');
const { sanitize, sanitizeMultiline } = require('../utils/sanitize');
const { inspect } = require('../utils/profanity');
const { punish } = require('../utils/abusePolicy');
const { notifyAdmin } = require('../utils/mailer');

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

// 관리자 — 손볼 게 몇 건인지만.
//
// 전체 목록(`/all`)은 무겁다. 화면 구석의 표시 하나 때문에 제보를 통째로 받아올 수는 없다.
// 관리자가 앱을 켜 두는 동안 주기적으로 부르는 자리라 가벼워야 한다.
router.get('/pending', adminAuth, (req, res) => {
  const reports = db.getAllReports();
  const open = reports.filter(r => r.status === 'received' || r.status === 'checking').length;
  const abuse = db.getAbuseLogs().filter(a => !a.reviewed && !a.dismissed).length;
  res.json({ open, abuse });
});

// 관리자 — 욕설·비하로 걸린 기록.
//
// 사전은 완전할 수 없다. 잘못 잡은 것을 되돌릴 길이 없으면 자동 처벌을 걸면 안 된다.
// 그래서 두 가지를 둔다 — 확인함(reviewed) 과 사전이 틀렸음(dismissed).
// dismissed 는 누적에서 빼고, 그 때문에 걸린 정지도 같이 푼다.
router.get('/abuse', adminAuth, (req, res) => {
  const logs = db.getAbuseLogs();
  res.json(logs.map(a => ({
    ...a,
    nickname: db.findUserById(a.user_id)?.nickname || null,
    suspended: !!db.getSuspension(a.user_id),
  })));
});

router.patch('/abuse/:id', adminAuth, (req, res) => {
  if (badId(req) !== null) return res.status(400).json({ error: '잘못된 ID에요' });
  const { reviewed, dismissed } = req.body;
  if (reviewed === undefined && dismissed === undefined) {
    return res.status(400).json({ error: '바꿀 내용이 없어요' });
  }

  const result = db.updateAbuseLog(Number(req.params.id), { reviewed, dismissed });
  if (result.changes === 0) return res.status(404).json({ error: '기록을 찾을 수 없어요' });

  // 사전이 틀렸다고 표시하면 그 사람의 정지도 푼다.
  // 표시만 해두고 정지가 남아 있으면 되돌린 게 아니다
  let unsuspended = 0;
  if (dismissed) unsuspended = db.clearSuspensions(result.log.user_id).changes;

  res.json({ ...result.log, unsuspended });
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

  // 욕설 · 비하 판정. 제목과 내용을 같이 본다 — 제목에만 쓰는 사람이 있다.
  //
  // 짜증 섞인 말(mild)은 통과시킨다. 안 되는 걸 겪고 화가 난 사람을 문법으로
  // 걸러내면 제보 자체가 안 들어온다. 대신 기록은 남겨서 흐름을 볼 수 있게 한다.
  const verdict = inspect(cleanTitle + '\n' + cleanBody);
  const result = punish(req.userId, verdict, 'report', cleanTitle + ' / ' + cleanBody);
  if (result.blocked) {
    return res.status(400).json({
      error: result.message,
      abuse: { level: verdict.level, days: result.days, count: result.count },
    });
  }

  const record = db.createReport(req.userId, {
    kind,
    title: cleanTitle,
    body: cleanBody,
    meta: pick(meta, META_FIELDS),
    device: Object.keys(pick(device, DEVICE_FIELDS)).length ? pick(device, DEVICE_FIELDS) : null,
    // 짜증 섞인 말로 통과한 제보. 관리자 목록에서 눈에 띄게 하려고 표시만 해둔다 —
    // 처벌 대상이 아니다
    flagged: verdict.level === 'mild' ? 'mild' : null,
  });

  // 관리자에게 알린다. 기다리지 않는다 — 알림이 늦거나 실패해도 제보는 이미 받았다.
  // 제목까지만 보낸다. 본문을 통째로 메일에 넣으면 메일함이 제보함이 된다
  const KIND_LABEL = { bug: '버그', ask: '문의', idea: '건의' };
  notifyAdmin(
    'report',
    `새 제보 — ${KIND_LABEL[kind] || kind}`,
    [
      `유형: ${KIND_LABEL[kind] || kind}`,
      `제목: ${cleanTitle}`,
      record.meta?.screen ? `화면: ${record.meta.screen}` : '',
      `회원 번호: ${req.userId}`,
      '',
      '관리자 화면 > 제보 관리 에서 확인하고 답을 달 수 있습니다.',
    ].filter(Boolean),
  );

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
