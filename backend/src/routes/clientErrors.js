const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const db = require('../db');

// 화면이 흰 화면이 됐을 때 **우리가 안다.**
//
// 에러 경계는 사람에게 「이 화면을 그리지 못했어요」를 보여준다. 그런데 **무엇이
// 터졌는지는 그 사람 브라우저에만 있다.** 제보로 적어 보내주지 않으면 우리는 영영
// 모르고, 대부분은 안 적고 그냥 나간다.
//
// 그래서 터진 자리를 **서버로 한 줄 보낸다.** 관리자 화면에서 본다.
//
// **로그인 없이도 받는다** — 로그인 화면에서 터지면 토큰이 없다. 대신 아래를 지킨다.
//   · 한 주소에서 1분에 다섯 건까지 (터졌다고 서버를 두들기면 안 된다)
//   · 글자 길이를 자른다 (스택을 통째로 받으면 DB 가 부푼다)
//   · **개인정보는 안 받는다** — 메시지 · 스택 앞부분 · 어느 화면인지 · 언제.
//     사람이 적은 글이나 기록은 절대 안 붙인다

const limit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: '너무 잦아요' },
  standardHeaders: true,
  legacyHeaders: false,
});

const cut = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

router.post('/', limit, (req, res) => {
  const message = cut(req.body?.message, 300);
  if (!message) return res.status(400).json({ error: '내용이 없어요' });

  db.addClientError({
    message,
    // 스택은 앞 다섯 줄이면 어디서 터졌는지 알기에 충분하다
    stack: cut(String(req.body?.stack || '').split('\n').slice(0, 5).join(' | '), 600),
    path: cut(req.body?.path, 120),
    agent: cut(req.headers['user-agent'], 160),
  });
  res.status(201).json({ ok: true });
});

// 관리자만 본다
const adminAuth = require('../middleware/adminAuth');
router.get('/', adminAuth, (req, res) => {
  res.json(db.getClientErrors());
});

router.delete('/', adminAuth, (req, res) => {
  db.clearClientErrors();
  res.json({ message: '지웠어요' });
});

module.exports = router;
