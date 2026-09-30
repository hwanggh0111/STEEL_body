// 이 브라우저가 알림을 받을 수 있나 (2026-09-30).
//
// **한 벌로 둔다.** 알림 화면(`RemindersPage`)에 있던 판단을 여기로 옮겼다 —
// 설정함의 「운동 알림」 줄도 같은 것을 알아야 하는데, 거기서 다시 적으면 **두 벌**이
// 된다. 그러면 한쪽만 고치는 날이 오고, 같은 브라우저를 한 화면은 「된다」 다른
// 화면은 「안 된다」고 말하게 된다.
//
// 셋이 다 있어야 한다 — 알림 창(`Notification`) · 서비스 워커(앱이 닫혀 있을 때
// 받는 자리) · 푸시(서버가 깨우는 자리). 하나만 없어도 정한 시각에 아무것도 안 온다.

/** 알림을 받을 수 있는 브라우저인가. */
export function canNotify() {
  return typeof Notification !== 'undefined'
    && typeof navigator !== 'undefined' && 'serviceWorker' in navigator
    && typeof window !== 'undefined' && 'PushManager' in window;
}

/**
 * 이 브라우저의 알림 권한. 'granted' · 'denied' · 'default' · 'unsupported'.
 *
 * **못 쓰는 브라우저와 아직 안 물어본 것을 가른다** — 사람이 할 수 있는 일이 다르다.
 */
export function notifyPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}
