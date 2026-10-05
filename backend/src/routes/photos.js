const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');

// ── 필요한 것만 준다 ── (2026-10-05)
//
// 여기는 사진을 **base64 로 통째로** 돌려준다. 칸이 셋(profile · before · after)이고
// 장당 2MB 까지 받으니 **한 번에 6MB** 다.
//
// 그런데 껍데기(`components/Layout.jsx`)가 앱을 열 때마다 이것을 부른다 —
// 머리에 그릴 **32px 아바타 하나** 때문이다. 폰에서 LTE 로 열면 그 한 번에
// 수 MB 를 받고, 쓰는 것은 그중 한 장이다. 나머지 둘은 비교 화면에서나 쓴다.
//
// `?type=profile` 로 **그 한 장만** 달라고 할 수 있게 한다. 아무것도 안 주면
// 예전처럼 전부 준다 — 비교 화면은 셋이 다 필요하고, 옛 화면이 깨지면 안 된다.
const PHOTO_TYPES = ['profile', 'before', 'after'];

router.get('/', auth, (req, res) => {
  const photos = db.getPhotos(req.userId);
  const want = req.query.type;
  // **아는 칸 이름일 때만 거른다.** 오타(`?type=profil`)에 빈 배열을 주면
  // 화면은 「사진이 없다」로 읽고 있던 사진을 지운다 — 조용히 틀리는 자리다
  if (typeof want === 'string' && PHOTO_TYPES.includes(want)) {
    return res.json(photos.filter((p) => p.type === want));
  }
  res.json(photos);
});

// Save/update photo
router.post('/', auth, (req, res) => {
  const { type, data } = req.body;
  if (!type || !data) return res.status(400).json({ error: '타입과 데이터는 필수에요' });
  if (!['profile', 'before', 'after'].includes(type)) return res.status(400).json({ error: '올바른 사진 타입이 아니에요' });
  // 사진인지 확인한다. 예전에는 아무 문자열이나 2MB 까지 받아 그대로 돌려줬다 —
  // 사진 자리에 사진이 아닌 것을 넣어둘 수 있으면 안 된다
  if (typeof data !== 'string' || !/^data:image\/(png|jpe?g|gif|webp|avif);base64,/i.test(data)) {
    return res.status(400).json({ error: '사진 파일만 올릴 수 있어요' });
  }
  // Limit size: base64 image max ~2MB
  if (data.length > 2 * 1024 * 1024) return res.status(400).json({ error: '사진이 너무 커요 (최대 2MB)' });

  db.savePhoto(req.userId, type, data);
  res.json({ message: '사진 저장 완료!' });
});

// Delete photo
router.delete('/:type', auth, (req, res) => {
  const { type } = req.params;
  if (!['profile', 'before', 'after'].includes(type)) return res.status(400).json({ error: '올바른 사진 타입이 아니에요' });
  const result = db.deletePhoto(req.userId, type);
  if (result.changes === 0) return res.status(404).json({ error: '사진을 찾을 수 없어요' });
  res.json({ message: '사진 삭제 완료!' });
});

module.exports = router;
