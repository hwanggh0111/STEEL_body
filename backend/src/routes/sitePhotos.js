const router = require('express').Router();
const adminAuth = require('../middleware/adminAuth');
const db = require('../db');

// 홈페이지 사진 — **관리자가 올리고, 누구나 본다.**
//
// 커뮤니티를 걷어낸 뒤(2026-09-16) 「남이 올린 것」은 앱에 없다. 이것도 그 규칙을
// 안 깬다 — **올리는 사람은 관리자 하나뿐**이다. 그래서 신고도 내리기도 욕설 검사도
// 필요 없다. 사람이 여럿 올리는 자리를 만들면 그 셋이 전부 따라온다.
//
// **보는 쪽은 로그인이 없다.** 홈페이지(`/site`)가 로그인 없이 열리는 자리라
// 사진도 같이 열려야 한다. 대신 **돌려주는 것은 사진과 한 줄 설명뿐**이다 —
// 누가 언제 올렸는지는 밖으로 안 나간다.
//
// 사진은 본체(blackiron.json)가 아니라 **사진 파일(photos.json)** 에 얹는다.
// 본체에 두면 세트 하나 저장할 때마다 사진 전부를 다시 쓴다(2026-08-27 에 겪었다).

// 한 장 한도. 사람 사진과 같은 자를 쓴다 — JSON 파일을 통째로 램에 올리는 구조라
// 여기만 헐겁게 할 수 없다
const MAX_BASE64 = 2 * 1024 * 1024;
// 몇 장까지. 홈페이지에 거는 사진이라 많을 이유가 없고, **전부 한 번에 내려간다** —
// 스무 장이면 응답이 40MB 가 된다
const MAX_COUNT = 12;
const MAX_CAPTION = 60;

const clean = (v) => String(v == null ? '' : v).trim().slice(0, MAX_CAPTION);

/** 보는 쪽 — 로그인 없이. 사진과 설명만 나간다 */
router.get('/', (req, res) => {
  res.json(db.getSitePhotos().map(p => ({ id: p.id, data: p.data, caption: p.caption })));
});

/** 올리기 — 관리자만 */
router.post('/', adminAuth, (req, res) => {
  const { data, caption } = req.body || {};
  // 사진인지 확인한다. 사진 자리에 사진이 아닌 것을 넣어둘 수 있으면 안 된다
  if (typeof data !== 'string' || !/^data:image\/(png|jpe?g|gif|webp|avif);base64,/i.test(data)) {
    return res.status(400).json({ error: '사진 파일만 올릴 수 있어요' });
  }
  if (data.length > MAX_BASE64) return res.status(400).json({ error: '사진이 너무 커요 (최대 2MB)' });

  const photos = db.getSitePhotos();
  if (photos.length >= MAX_COUNT) {
    return res.status(400).json({ error: `사진은 ${MAX_COUNT}장까지 걸 수 있어요. 지우고 올려주세요` });
  }

  const photo = db.addSitePhoto(data, clean(caption));
  res.status(201).json({ photo: { id: photo.id, data: photo.data, caption: photo.caption } });
});

/** 설명 고치기 · 순서 옮기기 — 관리자만 */
router.patch('/:id', adminAuth, (req, res) => {
  const id = Number(req.params.id);
  const { caption, move } = req.body || {};
  if (!Number.isFinite(id)) return res.status(400).json({ error: '없는 사진이에요' });

  // 순서는 **한 칸씩만** 옮긴다. 자리 번호를 통째로 받으면 화면과 서버가 어긋났을 때
  // 엉뚱한 자리로 튄다 — 「위로 · 아래로」면 어긋나도 한 칸이다
  if (move === 'up' || move === 'down') {
    const ok = db.moveSitePhoto(id, move);
    if (!ok) return res.status(404).json({ error: '없는 사진이에요' });
    return res.json({ photos: db.getSitePhotos().map(p => ({ id: p.id, data: p.data, caption: p.caption })) });
  }

  if (caption === undefined) return res.status(400).json({ error: '고칠 것이 없어요' });
  const photo = db.updateSitePhoto(id, clean(caption));
  if (!photo) return res.status(404).json({ error: '없는 사진이에요' });
  res.json({ photo: { id: photo.id, data: photo.data, caption: photo.caption } });
});

/** 지우기 — 관리자만 */
router.delete('/:id', adminAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || !db.deleteSitePhoto(id)) {
    return res.status(404).json({ error: '없는 사진이에요' });
  }
  res.json({ message: '지웠어요' });
});

module.exports = router;
