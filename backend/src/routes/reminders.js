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

// 받은 값을 다듬는다. **버린 것이 있으면 무엇을 버렸는지 같이 돌려준다.**
//
// 예전에는 모르는 값을 조용히 버리고, 남은 게 없으면 「바꿀 값이 없어요」라고 했다.
// 그래서 **시간 칸을 비우면**(브라우저가 빈 문자열을 보낸다) 「바꿀 값이 없어요」가
// 떴다 — 사람은 시각을 바꾸려고 만진 것인데 엉뚱한 말을 듣는다.
function clean(body) {
  const out = {};
  const bad = [];

  if (typeof body?.enabled === 'boolean') out.enabled = body.enabled;
  if (typeof body?.streakGuard === 'boolean') out.streakGuard = body.streakGuard;

  if (Array.isArray(body?.days)) {
    // 중복과 범위 밖을 걸러 오름차순으로. 화면이 무엇을 보내든 서버가 모양을 정한다.
    //
    // **숫자인지부터 본다.** 예전에는 `map(Number)` 로 먼저 바꿨는데,
    // `Number(null)` 은 0 이고 0 은 일요일이다 — `days: [null]` 을 보내면
    // 일요일 알림이 켜졌다. `[]` · `false` 도 0 이 된다
    const days = [...new Set(body.days
      .filter(d => typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6))]
      .sort((a, b) => a - b);
    out.days = days;
  } else if (body?.days !== undefined) {
    bad.push('요일은 0~6 사이 숫자 목록으로 주세요');
  }

  if (typeof body?.time === 'string' && TIME_RE.test(body.time)) out.time = body.time;
  else if (body?.time !== undefined) bad.push('시각을 19:00 처럼 적어주세요');

  // 브라우저의 getTimezoneOffset() 값. 실재하는 시간대는 -720 ~ +840 안에 있다.
  // **이것만 와도 저장한다** — 보낼 시각을 그 사람 시간대로 재는 값이라,
  // 여행을 가서 시간대가 바뀌면 그것만 와도 갱신돼야 한다
  const tz = Number(body?.tzOffset);
  if (Number.isInteger(tz) && tz >= -840 && tz <= 840) out.tzOffset = tz;

  return { patch: out, bad };
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
  const { patch, bad } = clean(req.body);
  // 잘못 온 것이 있으면 **그것부터 말한다.** 「바꿀 값이 없어요」로 뭉뚱그리면
  // 사람은 무엇을 고쳐야 할지 모른다
  if (bad.length > 0) return res.status(400).json({ error: bad[0] });
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

// 이 기기를 뺀다. **자기 것만 뺄 수 있다.**
//
// 예전에는 주소만 맞으면 지웠다 — 주인을 안 봤다. 구독 주소를 아는 사람은
// **남의 기기 알림을 끌 수 있었다.** 알림은 조용히 안 오는 것이라 당한 사람은
// 한참 뒤에야 안다.
router.delete('/subscribe', auth, (req, res) => {
  const endpoint = req.body?.endpoint;
  if (typeof endpoint !== 'string') return res.status(400).json({ error: '구독 주소가 없어요' });
  const { changes } = db.deletePushSubOfUser(req.userId, endpoint);
  // 없어서 못 지운 것은 실패가 아니다 — 두 번 눌렀거나 이미 빠진 기기다.
  // 남의 것이어서 못 지운 것도 여기로 온다. **있고 없고를 알려주지 않는다**
  res.json({ devices: db.getPushSubs(req.userId).length, removed: changes });
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
