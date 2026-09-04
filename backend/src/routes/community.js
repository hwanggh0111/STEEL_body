const router = require('express').Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { spamCheck } = require('../middleware/aiGuard');
const db = require('../db');
const { sanitize, sanitizeMultiline } = require('../utils/sanitize');
const { inspect } = require('../utils/profanity');
const { punish } = require('../utils/abusePolicy');

// ─────────────────────────────────────────────────────────────
// 커뮤니티 — 같이 하는 사람들이 쓰는 자리.
//
// 이 앱에 남에게 보이는 글이 처음 생긴다. 그동안 사람이 쓴 글은 전부 **자기만
// 보는 것**이었다 — 운동 기록 · 그날 메모 · 루틴 메모 · 제보(본인과 관리자만).
// 그래서 규칙 하나가 새로 필요하다: **남이 읽는다.**
//
// 제보함과 다른 점이 거기서 갈린다.
//
//   제보 — 안 되는 것을 말하는 자리다. 화가 난 사람을 문법으로 걸러내면 제보가
//          아예 안 들어온다. 그래서 짜증(mild)은 통과시키고 기록만 남긴다.
//   여기 — **남이 읽는 자리다.** 짜증도 통과시키되(운동 얘기에 「죽겠다」는
//          흔한 말이다) 표시를 남긴다. 욕설·비하는 제보와 똑같이 막는다 —
//          막는 규칙을 여기만 따로 두면 한쪽만 고치는 날이 온다.
//
// **지우는 힘은 둘이다.** 쓴 사람과 관리자. 관리자가 지운 것은 목록에서 빠지되
// 그 자리에 「관리자가 내렸어요」를 남긴다 — 소리 없이 사라지면 쓴 사람은 자기
// 글이 안 올라간 줄 알고 또 쓴다.
// ─────────────────────────────────────────────────────────────

const MAX_TITLE = 80;
const MAX_BODY = 4000;
const MAX_COMMENT = 500;
const PAGE = 20;

// 갈래. **적게 둔다** — 갈래가 많으면 어디에 쓸지 고르다 안 쓴다
const KINDS = ['자유', '루틴', '식단', '질문'];

const cleanTitle = (v) => sanitize(String(v ?? '')).slice(0, MAX_TITLE).trim();
const cleanBody = (v) => sanitizeMultiline(String(v ?? '')).slice(0, MAX_BODY).trim();

// 목록에 실어 보내는 모양. **본문은 안 보낸다** — 스무 개의 본문을 다 실으면
// 목록 한 번에 80KB 가 오간다. 첫 줄만 잘라 붙인다
function forList(p, userId) {
  const first = String(p.body || '').split('\n').find(l => l.trim()) || '';
  return {
    id: p.id,
    kind: p.kind,
    title: p.title,
    excerpt: first.slice(0, 60),
    nickname: db.findUserById(p.user_id)?.nickname || '알 수 없음',
    mine: p.user_id === userId,
    comments: db.countPostComments(p.id),
    created_at: p.created_at,
    updated_at: p.updated_at,
    flagged: p.flagged || null,
  };
}

// 욕설 판정을 한 곳에서. 글도 댓글도 같은 규칙이다
function judge(userId, text, where) {
  const verdict = inspect(text);
  const result = punish(userId, verdict, where, text.slice(0, 200));
  return { verdict, result };
}

// ── 목록 ──
//
// 최근 것이 위다. `?kind=` 로 갈래를 거르고, `?before=` 로 더 받는다.
// **쪽 번호를 안 쓴다** — 글이 하나 올라오면 번호가 밀려서 같은 글을 두 번 본다
router.get('/', auth, (req, res) => {
  const { kind, before } = req.query;
  if (kind !== undefined && !KINDS.includes(kind)) {
    return res.status(400).json({ error: '없는 갈래에요' });
  }
  let list = db.getPosts();
  if (kind) list = list.filter(p => p.kind === kind);
  if (before !== undefined) {
    const id = Number(before);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '잘못된 자리에요' });
    list = list.filter(p => p.id < id);
  }
  const page = list.slice(0, PAGE);
  res.json({
    posts: page.map(p => forList(p, req.userId)),
    // 더 있는지 화면이 알아야 「더 보기」를 그릴지 정한다
    more: list.length > PAGE,
    kinds: KINDS,
  });
});

// ── 글 하나 + 댓글 ──
router.get('/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '잘못된 번호에요' });
  const post = db.getPost(id);
  if (!post) return res.status(404).json({ error: '없는 글이에요' });

  res.json({
    post: {
      ...post,
      user_id: undefined,
      nickname: db.findUserById(post.user_id)?.nickname || '알 수 없음',
      mine: post.user_id === req.userId,
    },
    comments: db.getPostComments(id).map(c => ({
      ...c,
      user_id: undefined,
      nickname: db.findUserById(c.user_id)?.nickname || '알 수 없음',
      mine: c.user_id === req.userId,
    })),
  });
});

// ── 쓴다 ──
router.post('/', auth, spamCheck, (req, res) => {
  const { kind, title, body } = req.body || {};
  if (!KINDS.includes(kind)) return res.status(400).json({ error: '갈래를 골라주세요' });

  const t = cleanTitle(title);
  const b = cleanBody(body);
  if (!t) return res.status(400).json({ error: '제목을 적어주세요' });
  if (!b) return res.status(400).json({ error: '내용을 적어주세요' });

  const { verdict, result } = judge(req.userId, `${t}\n${b}`, 'community');
  if (result.blocked) {
    return res.status(400).json({
      error: result.message,
      abuse: { level: verdict.level, days: result.days, count: result.count },
    });
  }

  const post = db.createPost(req.userId, {
    kind, title: t, body: b,
    flagged: verdict.level === 'mild' ? 'mild' : null,
  });
  res.status(201).json({ post: { ...post, user_id: undefined, mine: true } });
});

// ── 고친다 ── 쓴 사람만
router.put('/:id', auth, spamCheck, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '잘못된 번호에요' });
  const post = db.getPost(id);
  if (!post) return res.status(404).json({ error: '없는 글이에요' });
  // **남의 글은 못 고친다.** 있고 없고를 알려주지 않는다
  if (post.user_id !== req.userId) return res.status(404).json({ error: '없는 글이에요' });

  const { kind, title, body } = req.body || {};
  const t = cleanTitle(title);
  const b = cleanBody(body);
  if (!t) return res.status(400).json({ error: '제목을 적어주세요' });
  if (!b) return res.status(400).json({ error: '내용을 적어주세요' });
  if (kind !== undefined && !KINDS.includes(kind)) return res.status(400).json({ error: '없는 갈래에요' });

  const { verdict, result } = judge(req.userId, `${t}\n${b}`, 'community');
  if (result.blocked) return res.status(400).json({ error: result.message });

  const next = db.updatePost(id, req.userId, {
    kind: kind || post.kind, title: t, body: b,
    flagged: verdict.level === 'mild' ? 'mild' : null,
  });
  res.json({ post: { ...next, user_id: undefined, mine: true } });
});

// ── 지운다 ── 쓴 사람 또는 관리자
router.delete('/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '잘못된 번호에요' });
  const post = db.getPost(id);
  if (!post) return res.status(404).json({ error: '없는 글이에요' });

  const me = db.findUserById(req.userId);
  const isAdmin = !!me && me.role === 'admin';
  if (post.user_id !== req.userId && !isAdmin) return res.status(404).json({ error: '없는 글이에요' });

  // **관리자가 내린 것은 그렇게 남긴다.** 소리 없이 사라지면 쓴 사람은
  // 자기 글이 안 올라간 줄 알고 또 쓴다
  if (isAdmin && post.user_id !== req.userId) {
    db.takeDownPost(id);
    return res.json({ message: '내렸어요', takenDown: true });
  }
  db.deletePost(id);
  res.json({ message: '지웠어요' });
});

// ── 댓글 ──
router.post('/:id/comments', auth, spamCheck, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '잘못된 번호에요' });
  const post = db.getPost(id);
  if (!post) return res.status(404).json({ error: '없는 글이에요' });
  if (post.taken_down) return res.status(400).json({ error: '내려간 글에는 못 답니다' });

  const body = sanitizeMultiline(String((req.body || {}).body ?? '')).slice(0, MAX_COMMENT).trim();
  if (!body) return res.status(400).json({ error: '댓글을 적어주세요' });

  const { verdict, result } = judge(req.userId, body, 'community-comment');
  if (result.blocked) return res.status(400).json({ error: result.message });

  const c = db.createPostComment(id, req.userId, body,
    verdict.level === 'mild' ? 'mild' : null);
  res.status(201).json({
    comment: {
      ...c, user_id: undefined, mine: true,
      nickname: db.findUserById(req.userId)?.nickname || '알 수 없음',
    },
  });
});

router.delete('/comments/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '잘못된 번호에요' });
  const c = db.getPostComment(id);
  if (!c) return res.status(404).json({ error: '없는 댓글이에요' });

  const me = db.findUserById(req.userId);
  const isAdmin = !!me && me.role === 'admin';
  if (c.user_id !== req.userId && !isAdmin) return res.status(404).json({ error: '없는 댓글이에요' });

  db.deletePostComment(id);
  res.json({ message: '지웠어요' });
});

// ── 관리자: 짜증 섞인 말로 통과한 것 ──
//
// 막지는 않았지만 남이 읽는 자리다. 흐름은 보이게 둔다
router.get('/admin/flagged', adminAuth, (req, res) => {
  res.json(db.getPosts(true)
    .filter(p => p.flagged)
    .map(p => ({
      id: p.id, kind: p.kind, title: p.title, flagged: p.flagged,
      nickname: db.findUserById(p.user_id)?.nickname || '알 수 없음',
      created_at: p.created_at, taken_down: !!p.taken_down,
    })));
});

module.exports = router;
