const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');

// Get all photos for user
router.get('/', auth, (req, res) => {
  const photos = db.getPhotos(req.userId);
  res.json(photos);
});

// Save/update photo
router.post('/', auth, (req, res) => {
  const { type, data } = req.body;
  if (!type || !data) return res.status(400).json({ error: '타입과 데이터는 필수에요' });
  if (!['profile', 'before', 'after'].includes(type)) return res.status(400).json({ error: '올바른 사진 타입이 아니에요' });
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
