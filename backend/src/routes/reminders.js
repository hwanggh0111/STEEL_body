const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');
const push = require('../utils/push');
const { messageOf } = require('../utils/reminderSchedule');

// ─────────────────────────────────────────────────────────────
// 운동 알림.
//
// 설정은 **서버가 들고 있는다.** 기기를 바꾸면 사라지면 안 되고, 정한 시각에
// 보내는 것도 서버가 한다 (브라우저는 닫혀 있다).
//
// 구독(push subscription)은 기기마다 하나다. 폰과 PC 는 다른 구독이라 둘 다 온다.
// ─────────────────────────────────────────────────────────────

const DEFAULTS = {
  enabled: false,
  days: [1, 3, 5],        // 0=일 … 6=토
  time: '19:00',
  tzOffset: 0,
  streakGuard: true,
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function clean(body) {
  const out = {};

  if (typeof body?.enabled === 'boolean') out.enabled = body.enabled;
  if (typeof body?.streakGuard === 'boolean') out.streakGuard = body.streakGuard;

  if (Array.isArray(body?.days)) {
    // 중복과 범위 밖을 걸러 오름차순으로. 화면이 무엇을 보내든 서버가 모양을 정한다
    const days = [...new Set(body.days.map(Number))]
      .filter(d => Number.isInteger(d) && d >= 0 && d <= 6)
      .sort((a, b) => a - b);
    out.days = days;
  }

  if (typeof body?.time === 'string' && TIME_RE.test(body.time)) out.time = body.time;

  // 브라우저의 getTimezoneOffset() 값. 실재하는 시간대는 -720 ~ +840 안에 있다
  const tz = Number(body?.tzOffset);
  if (Number.isInteger(tz) && tz >= -840 && tz <= 840) out.tzOffset = tz;

  return out;
}

// 내 설정 + 이 서버가 알림을 보낼 수 있는 상태인지
router.get('/', auth, (req, res) => {
  const row = db.getReminder(req.userId);
  res.json({
    settings: { ...DEFAULTS, ...(row || {}), user_id: undefined },
    // 키가 없으면 화면이 알림 켜기 버튼을 아예 안 그린다.
    // 못 하는 것을 누를 수 있게 두면 눌러보고 안 된다고 제보가 온다
    vapidPublicKey: push.publicKey(),
    devices: db.getPushSubs(req.userId).length,
  });
});

router.put('/', auth, (req, res) => {
  const patch = clean(req.body);
  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: '바꿀 값이 없어요' });
  }
  // 요일을 하나도 안 고르고 켜면 정한 요일 알림은 영영 안 온다. 미리 막는다
  const merged = { ...DEFAULTS, ...(db.getReminder(req.userId) || {}), ...patch };
  if (merged.enabled && merged.days.length === 0 && !merged.streakGuard) {
    return res.status(400).json({ error: '요일을 하나는 고르거나, 오래 쉴 때 알림을 켜주세요' });
  }
  const row = db.saveReminder(req.userId, patch);
  res.json({ ...row, user_id: undefined });
});

// 기기 등록. 앱을 열 때마다 보내도 된다 — 같은 기기면 새 줄을 만들지 않는다
router.post('/subscribe', auth, (req, res) => {
  const sub = req.body?.subscription;
  const endpoint = sub?.endpoint;
  const keys = sub?.keys;
  if (typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint) || endpoint.length > 1000) {
    return res.status(400).json({ error: '구독 주소가 올바르지 않아요' });
  }
  if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') {
    return res.status(400).json({ error: '구독 키가 올바르지 않아요' });
  }
  db.savePushSub(req.userId, { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } });
  res.status(201).json({ devices: db.getPushSubs(req.userId).length });
});

router.delete('/subscribe', auth, (req, res) => {
  const endpoint = req.body?.endpoint;
  if (typeof endpoint !== 'string') return res.status(400).json({ error: '구독 주소가 없어요' });
  db.deletePushSubByEndpoint(endpoint);
  res.json({ devices: db.getPushSubs(req.userId).length });
});

// 지금 한 통 보내본다.
//
// 알림은 「켰는데 안 오는」 일이 제일 흔하다. 권한, 기기 등록, 서버 키 중
// 어디가 막혔는지 사람이 알 길이 없어서, 그 자리에서 눌러 확인할 수 있게 둔다.
router.post('/test', auth, async (req, res) => {
  if (!push.isReady()) {
    return res.status(503).json({ error: '이 서버는 아직 알림을 보낼 수 없어요 (키 설정 전)' });
  }
  const msg = messageOf('scheduled', null);
  const sent = await push.sendToUser(req.userId, {
    title: '알림 확인',
    body: `이렇게 옵니다. 정한 시각에는 「${msg.title}」로 옵니다.`,
    url: '/workout',
    tag: 'reminder-test',
  });
  if (sent === 0) {
    return res.status(409).json({ error: '보낼 기기가 없어요. 이 기기에서 알림을 먼저 켜주세요' });
  }
  res.json({ sent });
});

module.exports = router;
