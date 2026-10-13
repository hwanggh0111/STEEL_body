// ── 알림 꾸러미도 **쓸 때 든다** ── (2026-10-09)
//
// `web-push` 는 31ms 다. 알림은 **보낼 때만** 필요한데 뜰 때마다 들고 있었다.
// 열쇠(VAPID)가 맞는지 보는 것(`setVapidDetails`)도 첫 발송으로 미룬다 —
// 열쇠가 틀렸으면 그때 `ready` 를 내리고 조용히 안 보낸다(전과 같다).
let _webpush;
const webpush = () => (_webpush || (_webpush = require('web-push')));
const db = require('../db');

// ─────────────────────────────────────────────────────────────
// 웹 푸시.
//
// VAPID 키가 없으면 **조용히 아무것도 하지 않는다.** 알림이 안 나가는 것과
// 앱이 죽는 것은 다른 이야기다 — 설정이 없다고 서버가 못 뜨면 안 된다.
//
// 키는 저장소에 두지 않는다. `node scripts/gen-vapid.js` 로 만들어
// VAPID_PUBLIC_KEY · VAPID_PRIVATE_KEY 로 넣는다.
// ─────────────────────────────────────────────────────────────

const PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
// 브라우저 푸시 서버가 문제가 생겼을 때 연락할 곳. mailto: 나 https: 여야 한다
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@blackiron.local';

// 열쇠가 있으면 **보낼 수 있다고 본다.** 진짜로 맞는지는 첫 발송 직전에 본다
let ready = !!(PUBLIC && PRIVATE);
let vapidSet = false;
if (!ready) {
  console.log('[push] VAPID 키가 없습니다. 운동 알림은 안 나갑니다 (앱은 그대로 돕니다)');
}

/** 첫 발송 직전에 한 번만. 열쇠가 틀렸으면 여기서 `ready` 가 내려간다 */
function ensureVapid() {
  if (vapidSet || !ready) return ready;
  try {
    webpush().setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
    vapidSet = true;
  } catch (err) {
    console.error('[push] VAPID 설정 실패 — 알림은 안 나갑니다:', err.message);
    ready = false;
  }
  return ready;
}

function isReady() {
  return ready;
}

function publicKey() {
  return ready ? PUBLIC : null;
}

/**
 * 한 사람의 모든 기기로 보낸다.
 *
 * 죽은 구독(404 · 410)은 그 자리에서 지운다. 그대로 두면 매번 실패하고,
 * 실패 목록이 쌓이면 뒤에 오는 사람의 알림까지 늦어진다.
 *
 * 보낸 기기 수를 돌려준다. 실패해도 던지지 않는다 —
 * 알림 때문에 부른 쪽이 무너지면 본말이 전도된다.
 */
async function sendToUser(userId, payload) {
  if (!ensureVapid()) return 0;
  const subs = db.getPushSubs(userId);
  if (subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  let sent = 0;

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush().sendNotification({ endpoint: s.endpoint, keys: s.keys }, body);
      sent += 1;
    } catch (err) {
      const code = err?.statusCode;
      if (code === 404 || code === 410) {
        db.deletePushSubByEndpoint(s.endpoint);
      } else {
        console.error('[push] 보내기 실패', code || err.message);
      }
    }
  }));

  return sent;
}

module.exports = { isReady, publicKey, sendToUser };
