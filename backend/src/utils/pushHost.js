/**
 * **알림 서비스의 주소만 받는다** — 한 자리에 둔다.
 *
 * ── 왜 한 자리인가 ── (2026-11-24 · 정석 2차)
 *
 * 11/23 에 「푸시 구독이 아무 https 주소를 받아 서버가 그곳을 두드렸다」를 고쳤다.
 * 고친 자리는 **받는 문**(`POST /reminders/subscribe`)이었다. 그런데 보내는 쪽
 * (`utils/push.js`)은 **담긴 주소를 그대로 믿고 나간다** — 그래서
 *
 *   · 11/23 **이전에** 담긴 줄은 검사를 한 번도 안 지났고, 지금도 매 알림마다 두드린다
 *   · DB 를 손으로 고치거나 다른 길로 줄이 들어오면 역시 그대로 나간다
 *
 * 40d7824(소셜 모양 아이디)가 배운 것과 같은 꼴이다 — **문을 닫는 것과 이미 안에
 * 있는 것을 보는 것은 다른 일이다.** 그래서 **나가는 자리에서도** 본다.
 *
 * 두 벌로 적지 않는다. 받는 문과 보내는 자리가 **같은 손**을 부른다 —
 * 두 벌이면 브라우저가 새 주소를 쓰기 시작하는 날 한쪽만 고쳐진다.
 */

// 브라우저가 주는 웹 푸시 서비스 — 크롬·삼성·엣지(FCM) · 파이어폭스 · 윈도 · 애플
const PUSH_HOST = /^(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com|web\.push\.apple\.com|[a-z0-9.-]+\.push\.apple\.com)$/;

/** 그 주소가 알림 서비스의 것인가. 주소가 아니면(풀 수 없으면) 아니다 */
function isPushEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint) || endpoint.length > 1000) return false;
  let host = '';
  try { host = new URL(endpoint).hostname.toLowerCase(); } catch { return false; }
  return PUSH_HOST.test(host);
}

module.exports = { isPushEndpoint, PUSH_HOST };
