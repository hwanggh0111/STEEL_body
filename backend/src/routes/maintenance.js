const router = require('express').Router();
const adminAuth = require('../middleware/adminAuth');
const db = require('../db');
const { sanitize } = require('../utils/sanitize');

// ─────────────────────────────────────────────────────────────
// 점검 스케줄.
//
// 읽기는 누구나 할 수 있다 — 로그인하지 않은 사람에게도 점검 중이라고 알려야 한다.
// 쓰기는 관리자만.
//
// 예전에는 이 목록이 관리자 브라우저의 localStorage 에만 있었다. 관리자 화면에서
// 점검을 잡아도 그 브라우저에만 저장돼서, 다른 사람에게는 점검 화면이 안 떴고
// 고객센터의 '점검 예정' 도 영영 비어 있었다. 관리자가 브라우저를 바꾸면 설정 자체가
// 사라졌다. 기능이 있는 것처럼 보였을 뿐 실제로는 아무 일도 하지 않았다.
// ─────────────────────────────────────────────────────────────

// 점검 스케줄 개수.
//
// **이름을 또렷하게 둔다** (2026-10-28). 서버 안에 `MAINT_MAX` 가 **둘**이었다 —
// 여기(점검 20)와 루틴 진행(50). 같은 이름이 다른 칸을 가리키면
// `npm run twins` 가 거짓 FAIL 을 낸다. 화면도 같은 이름으로 든다
const MAINT_MAX = 20;

// 점검 사유의 글자 수.
//
// **이름을 준다** (2026-10-28). 생글자로 박혀 있었고 관리자 화면에는 아무 제한이
// 없어서 **말없이 잘렸다.** 이 글은 **쓰는 사람 모두가 보는 안내문**이라, 잘리면
// 잘린 문장이 그대로 사람들에게 간다
const REASON_MAX = 60;

// 화면이 보내는 모양 그대로만 받는다. 모르는 키는 버린다
function clean(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const int = (v, lo, hi, fallback) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= lo && n <= hi ? n : fallback;
  };

  const out = {
    startHour: int(raw.startHour, 0, 23, 0),
    startMin: int(raw.startMin, 0, 59, 0),
    // 하루를 넘기는 점검은 없다. 넘기면 화면이 영원히 잠긴다
    durationMin: int(raw.durationMin, 1, 24 * 60, 60),
    reason: sanitize(String(raw.reason || '')).slice(0, REASON_MAX).trim() || '정기 시스템 점검',
  };

  // 하루짜리 예약이면 날짜, 아니면 요일 반복
  if (typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
    out.date = raw.date;
  } else if (Array.isArray(raw.days)) {
    out.days = [...new Set(raw.days.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))];
  } else {
    out.days = [];
  }

  if (typeof raw.type === 'string') out.type = sanitize(raw.type).slice(0, 20);
  return out;
}

// 누구나 읽는다
router.get('/', (req, res) => {
  res.json(db.getMaintenance());
});

// 관리자만 쓴다. 목록 전체를 받아 통째로 바꾼다 —
// 화면이 목록을 들고 편집하는 구조라 부분 수정보다 이쪽이 어긋날 여지가 적다
router.put('/', adminAuth, (req, res) => {
  const raw = req.body?.schedules;
  if (!Array.isArray(raw)) {
    return res.status(400).json({ error: '점검 목록이 올바르지 않아요' });
  }
  if (raw.length > MAINT_MAX) {
    return res.status(400).json({ error: `점검은 최대 ${MAINT_MAX}개까지예요` });
  }
  const list = raw.map(clean).filter(Boolean);
  res.json(db.saveMaintenance(list));
});

module.exports = router;
