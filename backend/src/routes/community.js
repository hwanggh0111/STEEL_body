const router = require('express').Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { spamCheck } = require('../middleware/aiGuard');
const db = require('../db');
const { sanitize, sanitizeMultiline } = require('../utils/sanitize');
const { inspect } = require('../utils/profanity');
const { punish } = require('../utils/abusePolicy');
const push = require('../utils/push');

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

// 공지는 **관리자만 쓴다.** 갈래 목록에 안 넣는다 — 넣으면 고르는 자리에 뜨고,
// 못 쓰는 것을 누를 수 있게 두면 눌러보고 안 된다고 제보가 온다
const NOTICE = '공지';

// 신고 사유. **적게 둔다** — 고를 것이 많으면 고르다 안 한다.
// 욕설은 코드가 자동으로 막는데(abusePolicy) 사전이 못 잡는 것이 있다.
// 그걸 사람이 알려주는 길이라, 사전이 못 보는 것들로 골랐다
const REASONS = ['욕설 · 비하', '광고 · 홍보', '남의 이야기', '그 밖'];

// 신고가 이만큼 쌓이면 관리자 목록에서 위로 올린다. **자동으로 내리지는 않는다** —
// 여럿이 눌렀다고 글이 사라지면, 미움받는 글이 사라지는 자리가 된다
const REPORT_LOUD = 3;

const cleanTitle = (v) => sanitize(String(v ?? '')).slice(0, MAX_TITLE).trim();
const cleanBody = (v) => sanitizeMultiline(String(v ?? '')).slice(0, MAX_BODY).trim();

// 목록에 실어 보내는 모양. **본문은 안 보낸다** — 스무 개의 본문을 다 실으면
// 목록 한 번에 80KB 가 오간다. 첫 줄만 잘라 붙인다
function forList(p, userId) {
  const first = String(p.body || '').split('\n').find(l => l.trim()) || '';
  return {
    id: p.id,
    kind: p.kind,
    notice: p.kind === NOTICE,
    title: p.title,
    excerpt: first.slice(0, 60),
    nickname: db.findUserById(p.user_id)?.nickname || '알 수 없음',
    mine: p.user_id === userId,
    comments: db.countPostComments(p.id),
    likes: db.countPostLikes(p.id),
    liked: db.likedPost(p.id, userId),
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
  const { kind, before, mine, joined } = req.query;
  if (kind !== undefined && kind !== NOTICE && !KINDS.includes(kind)) {
    return res.status(400).json({ error: '없는 갈래에요' });
  }
  let list = db.getPosts();
  if (kind) list = list.filter(p => p.kind === kind);
  // **내 글**과 **내가 낀 이야기**. 둘을 같이 주면 「내 것」이 흐려진다 — 따로 둔다
  if (mine === '1') list = list.filter(p => p.user_id === req.userId);
  if (joined === '1') {
    const ids = new Set(db.postIdsCommentedBy(req.userId));
    list = list.filter(p => ids.has(p.id));
  }
  if (before !== undefined) {
    const id = Number(before);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '잘못된 자리에요' });
    list = list.filter(p => p.id < id);
  }
  const page = list.slice(0, PAGE);

  // **공지는 첫 쪽 맨 위에만 붙인다.** 쪽마다 붙이면 내려갈수록 같은 공지를 또 본다.
  // 거르는 중이거나 내 것만 볼 때는 안 붙인다 — 그때는 공지가 낄 자리가 아니다
  const pinned = (!kind && !before && mine !== '1' && joined !== '1')
    ? db.getPosts().filter(p => p.kind === NOTICE).slice(0, 3)
    : [];

  res.json({
    notices: pinned.map(p => forList(p, req.userId)),
    posts: page.filter(p => p.kind !== NOTICE).map(p => forList(p, req.userId)),
    more: list.length > PAGE,
    kinds: KINDS,
    reasons: REASONS,
    // 공지를 쓸 수 있는 사람인가. **못 하는 것을 누를 수 있게 두지 않는다**
    canNotice: db.findUserById(req.userId)?.role === 'admin',
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
      notice: post.kind === NOTICE,
      nickname: db.findUserById(post.user_id)?.nickname || '알 수 없음',
      mine: post.user_id === req.userId,
      likes: db.countPostLikes(post.id),
      liked: db.likedPost(post.id, req.userId),
      reasons: REASONS,
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
  // 공지는 관리자만. **없는 것으로 답하지 않는다** — 이건 숨길 것이 아니라
  // 「여기는 관리자 자리다」라고 말하면 되는 것이다
  if (kind === NOTICE) {
    if (db.findUserById(req.userId)?.role !== 'admin') {
      return res.status(403).json({ error: '공지는 관리자만 올릴 수 있어요' });
    }
  } else if (!KINDS.includes(kind)) {
    return res.status(400).json({ error: '갈래를 골라주세요' });
  }

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
  // 공지는 공지로만 고친다. **공지를 공지 아닌 것으로, 글을 공지로 바꾸지 못한다** —
  // 공지는 쓸 때 관리자인지를 봤는데, 고치는 길로 들어오면 그 검사를 건너뛴다
  const wasNotice = post.kind === NOTICE;
  if (kind !== undefined && (wasNotice ? kind !== NOTICE : !KINDS.includes(kind))) {
    return res.status(400).json({ error: '없는 갈래에요' });
  }

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

  // **글 쓴 사람에게 알린다.** 댓글이 달렸는데 모르면 대화가 안 이어진다.
  //
  // 세 가지를 지킨다 —
  //   내가 내 글에 단 것은 안 보낸다 (내가 한 일을 나에게 알리지 않는다)
  //   기다리지 않는다 (알림이 늦거나 실패해도 댓글은 이미 달렸다)
  //   본문을 통째로 안 싣는다 (알림창이 댓글창이 된다)
  if (post.user_id !== req.userId) {
    const who = db.findUserById(req.userId)?.nickname || '누군가';
    push.sendToUser(post.user_id, {
      title: '댓글이 달렸어요',
      body: `${who} · ${body.slice(0, 40)}`,
      url: '/site',
      tag: 'community-comment-' + id,
    }).catch(() => {});
  }

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

// ── 공감 ──
//
// **댓글은 부담스럽다.** 글을 썼는데 아무 반응이 없으면 다음 글을 안 쓴다.
// 누르고 다시 누르면 풀린다. 한 사람 한 번이다.
router.post('/:id/like', auth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '잘못된 번호에요' });
  const post = db.getPost(id);
  if (!post || post.taken_down) return res.status(404).json({ error: '없는 글이에요' });
  // **자기 글에는 못 누른다.** 자기가 눌러 올린 숫자는 뜻이 없다
  if (post.user_id === req.userId) {
    return res.status(400).json({ error: '내 글에는 공감할 수 없어요' });
  }
  db.likePost(id, req.userId);
  res.json({ likes: db.countPostLikes(id), liked: true });
});

router.delete('/:id/like', auth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '잘못된 번호에요' });
  db.unlikePost(id, req.userId);
  res.json({ likes: db.countPostLikes(id), liked: false });
});

// ── 신고 ──
//
// 욕설은 코드가 자동으로 막는데(abusePolicy) **사전이 못 잡는 것**이 있다 —
// 광고 · 남의 이야기 · 사전에 없는 말. 그걸 사람이 알려주는 길이다.
//
// **여럿이 눌렀다고 글이 사라지지 않는다.** 그러면 미움받는 글이 사라지는 자리가
// 된다. 관리자 목록에서 위로 올라갈 뿐이고, 내리는 것은 사람이 정한다.
router.post('/:id/report', auth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '잘못된 번호에요' });
  const post = db.getPost(id);
  if (!post) return res.status(404).json({ error: '없는 글이에요' });
  if (post.user_id === req.userId) return res.status(400).json({ error: '내 글은 신고할 수 없어요' });

  const reason = String((req.body || {}).reason ?? '');
  if (!REASONS.includes(reason)) return res.status(400).json({ error: '까닭을 골라주세요' });

  const r = db.reportPost(id, req.userId, reason);
  // 이미 신고한 것도 **성공으로 답한다.** 「이미 하셨어요」는 알려줄 필요가 없고,
  // 알려주면 누가 신고했는지를 되짚을 수 있게 된다
  res.json({ message: '알려주셔서 고맙습니다. 확인하겠습니다', already: !r.changed });
});

// ── 관리자: 신고함 ──
router.get('/admin/reports', adminAuth, (req, res) => {
  const byPost = new Map();
  for (const r of db.getPostReports()) {
    if (!byPost.has(r.post_id)) byPost.set(r.post_id, []);
    byPost.get(r.post_id).push(r);
  }
  const rows = [...byPost.entries()].map(([postId, list]) => {
    const post = db.getPost(postId);
    return {
      postId,
      // 글이 이미 지워졌을 수 있다. **없다고 줄을 빼지 않는다** —
      // 신고가 있었다는 사실은 남아야 한다
      title: post ? post.title : '(지워진 글)',
      takenDown: post ? !!post.taken_down : null,
      gone: !post,
      nickname: post ? (db.findUserById(post.user_id)?.nickname || '알 수 없음') : null,
      count: list.length,
      loud: list.length >= REPORT_LOUD,
      open: list.filter(r => !r.reviewed).length,
      reasons: [...new Set(list.map(r => r.reason))],
      last: list[0]?.created_at || null,
      ids: list.map(r => r.id),
    };
  });
  // 아직 안 본 것이 위, 그다음 많이 신고된 것
  rows.sort((a, b) => (b.open - a.open) || (b.count - a.count));
  res.json(rows);
});

router.patch('/admin/reports/:id', adminAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '잘못된 번호에요' });
  if (!db.reviewPostReport(id).changes) return res.status(404).json({ error: '없는 신고에요' });
  res.json({ message: '확인했어요' });
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
