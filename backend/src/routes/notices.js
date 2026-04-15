const router    = require('express').Router();
const adminAuth = require('../middleware/adminAuth');
const db        = require('../db');

// 전체 목록 조회 (인증 불필요)
router.get('/', (req, res) => {
  const notices = db.getNotices();
  res.json(notices);
});

// 추가 (관리자 전용)
router.post('/', adminAuth, (req, res) => {
  const { date, title, type, content } = req.body;

  if (!date || !title || !type || !content) {
    return res.status(400).json({ error: '날짜, 제목, 유형, 내용은 필수에요' });
  }

  const sanitize = str => typeof str === 'string' ? str.replace(/[<>"'&]/g, '') : str;
  const result = db.createNotice(date, sanitize(title), type, sanitize(content));
  res.status(201).json({ id: result.lastInsertRowid, message: '공지사항 등록 완료!' });
});

// AI 공지 생성 (관리자 전용)
router.post('/ai-generate', adminAuth, (req, res) => {
  const { topic, type } = req.body;

  if (!topic || !type) {
    return res.status(400).json({ error: '주제와 유형은 필수에요' });
  }

  const templates = {
    update: {
      titles: [
        `[업데이트] ${topic} 기능이 추가되었습니다`,
        `[개선] ${topic} 관련 업데이트 안내`,
        `새로운 기능: ${topic}`,
      ],
      contents: [
        `안녕하세요, STEEL BODY 사용자 여러분!\n\n${topic} 기능이 새롭게 업데이트되었습니다.\n\n주요 변경사항:\n- ${topic} 기능 추가\n- 사용자 편의성 개선\n- 성능 최적화\n\n더 나은 서비스를 위해 계속 노력하겠습니다. 감사합니다!`,
      ],
    },
    event: {
      titles: [
        `[이벤트] ${topic} 이벤트 안내`,
        `${topic} 챌린지에 참여하세요!`,
        `[특별] ${topic} 이벤트 시작!`,
      ],
      contents: [
        `안녕하세요, STEEL BODY 사용자 여러분!\n\n${topic} 이벤트가 시작됩니다!\n\n참여 방법:\n1. 매일 운동 기록을 남겨주세요\n2. ${topic} 관련 목표를 설정하세요\n3. 꾸준히 달성해 나가세요\n\n함께 더 강해지는 STEEL BODY가 되겠습니다!`,
      ],
    },
    notice: {
      titles: [
        `[공지] ${topic} 안내`,
        `[안내] ${topic} 관련 공지사항`,
        `${topic}에 대해 알려드립니다`,
      ],
      contents: [
        `안녕하세요, STEEL BODY 사용자 여러분!\n\n${topic}에 대해 안내드립니다.\n\n자세한 내용은 아래를 확인해주세요.\n\n문의사항이 있으시면 관리자에게 연락해주세요.\n감사합니다!`,
      ],
    },
    maintenance: {
      titles: [
        `[점검] ${topic} 점검 안내`,
        `[서버점검] ${topic} 관련 점검 예정`,
        `시스템 점검: ${topic}`,
      ],
      contents: [
        `안녕하세요, STEEL BODY 사용자 여러분!\n\n${topic} 관련 시스템 점검이 예정되어 있습니다.\n\n점검 기간 동안 서비스 이용이 일시적으로 제한될 수 있습니다.\n\n빠르게 완료하여 더 안정적인 서비스를 제공하겠습니다.\n불편을 드려 죄송합니다. 감사합니다!`,
      ],
    },
  };

  const template = templates[type] || templates.notice;
  const titleIdx = Math.floor(Math.random() * template.titles.length);
  const contentIdx = Math.floor(Math.random() * template.contents.length);

  res.json({
    title: template.titles[titleIdx],
    content: template.contents[contentIdx],
  });
});

// 수정 (관리자 전용)
router.put('/:id', adminAuth, (req, res) => {
  const { title, type, content } = req.body;

  const sanitize = str => typeof str === 'string' ? str.replace(/[<>"'&]/g, '') : str;
  const result = db.updateNotice(Number(req.params.id), sanitize(title), type, sanitize(content));

  if (result.changes === 0) {
    return res.status(404).json({ error: '공지사항을 찾을 수 없어요' });
  }
  res.json({ message: '공지사항 수정 완료!' });
});

// 삭제 (관리자 전용)
router.delete('/:id', adminAuth, (req, res) => {
  const result = db.deleteNotice(Number(req.params.id));

  if (result.changes === 0) {
    return res.status(404).json({ error: '공지사항을 찾을 수 없어요' });
  }
  res.json({ message: '삭제 완료!' });
});

module.exports = router;
