// 알림 설정을 한 줄로 요약한다.
//
// 스위치 아래 설명이 「꺼져 있습니다」 · 「정한 요일과 시각에 옵니다」였다.
// **둘 다 아무것도 안 알려준다** — 켜졌는지는 스위치를 보면 알고, 「정한 요일」이
// 무슨 요일인지는 화면을 더 내려가야 안다. 게다가 요일을 하나도 안 골랐을 때도
// 그대로 「정한 요일과 시각에 옵니다」라고 했다. 거짓말이었다.
//
// 그 자리에 **언제 오는지**를 적는다 — 「월·수·금 · 오후 7:00」.
//
// 이 파일에는 화면이 없다. 값만 받아 값을 돌려준다 — `npm run check` 가 돌려본다.

import { label24 } from './timeOfDay';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

// 흔한 조합은 이름으로 부른다. 「월·화·수·목·금」보다 「평일」이 짧고 잘 읽힌다.
// 고르는 자리(`DAY_PRESETS`)와 같은 셋이다
const NAMED = [
  { days: [0, 1, 2, 3, 4, 5, 6], name: '매일' },
  { days: [1, 2, 3, 4, 5], name: '평일' },
  { days: [0, 6], name: '주말' },
];

// **`Number(null)` 은 0 이다.** 그리고 0 은 일요일이라 그대로 통과한다 —
// `[null]` 을 주면 「일」이라고 적힌다. 숫자로 바꾸기 전에 **숫자인지부터** 본다
// (화면도 서버도 요일은 늘 숫자로 주고받는다).
const clean = (days) => [...new Set((Array.isArray(days) ? days : [])
  .filter(d => typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6))]
  .sort((a, b) => a - b);

/** `[1,3,5]` → `'월·수·금'`, `[1,2,3,4,5]` → `'평일'`. 없으면 빈 문자열 */
export function daysLabel(days) {
  const list = clean(days);
  if (list.length === 0) return '';
  const named = NAMED.find(n => n.days.length === list.length && n.days.every(d => list.includes(d)));
  if (named) return named.name;
  return list.map(d => DAY_NAMES[d]).join('·');
}

/**
 * 스위치 아래에 적을 한 줄.
 *
 * `{ text, warn }` 를 돌려준다. `text` 가 null 이면 아무것도 안 적는다 —
 * **꺼져 있다는 말은 스위치가 이미 하고 있다.**
 * `warn` 이 true 면 「켜 놓았는데 아무것도 안 온다」는 뜻이라 화면이 붉게 적는다.
 */
export function reminderSummary(settings) {
  if (!settings || !settings.enabled) return { text: null, warn: false };

  const label = daysLabel(settings.days);
  if (label) return { text: `${label} · ${label24(settings.time)}`, warn: false };

  // 요일을 하나도 안 골랐다. 서버는 이것을 막지 않는다 —
  // **오래 쉴 때 알림만으로도 쓸 수 있어서** 막지 않는 것이 맞다.
  // 대신 화면이 사실대로 말해야 한다
  if (settings.streakGuard) return { text: '고른 요일 없음 · 오래 쉴 때만 옵니다', warn: false };
  return { text: '고른 요일이 없어 아무 알림도 안 옵니다', warn: true };
}

/**
 * 설정함의 「운동 알림」 줄에 적을 것 (2026-09-30).
 *
 * 그 줄은 `sub` 가 **「시간 정하기」로 박혀 있었다.** 켜져 있는지 · 막혀 있는지 ·
 * 서버가 보낼 수 있는지를 하나도 안 알려줬다 — 그 칸 머리에는 「**알림은 왜 안 되는지
 * 적는다**」고 적어놓고 안 적고 있었다. 앱 잠금은 바로 옆에서 켜짐/꺼짐을 말한다.
 *
 * ── 차례 ──
 *
 * **못 오게 막는 것을 먼저** 말한다. 정해둔 시각을 보여주면 사람은 그 시각에 온다고
 * 읽는데, 셋 중 하나라도 걸려 있으면 **안 온다.**
 *
 *   1. 이 브라우저가 아예 못 받는다 (기기의 한계)
 *   2. 서버가 보낼 준비가 안 됐다 (열쇠가 없다 — 사람이 할 수 있는 일이 없다)
 *   3. 이 브라우저에서 막았다 (자물쇠에서 풀 수 있다)
 *
 * 그다음이 설정이다. **켜뒀는데 이 기기에서 허락을 안 했으면** 그것도 말한다 —
 * 시각만 보여주면 폰에서 켜둔 사람이 PC 에서도 온다고 믿는다.
 *
 * `{ text, warn }` 을 돌려준다. `warn` 이면 화면이 붉게 적는다(`GoRow` 가 이미 받는다).
 */
export function reminderRow({ canNotify, permission, serverReady, settings, loaded }) {
  if (canNotify === false) return { text: '이 브라우저는 못 받아요', warn: true };
  if (serverReady === false) return { text: '서버가 아직 못 보내요', warn: true };
  if (permission === 'denied') return { text: '알림이 막혀 있어요', warn: true };
  // 아직 안 불러왔으면 **모르는 것이다.** 「꺼짐」이라고 적으면 켜둔 사람에게 거짓말이 된다
  if (!loaded) return { text: '시간 정하기', warn: false };
  if (!settings || !settings.enabled) return { text: '꺼짐', warn: false };
  if (permission !== 'granted') return { text: '이 기기는 아직 안 켰어요', warn: true };
  const sum = reminderSummary(settings);
  return sum.text ? sum : { text: '켜짐', warn: false };
}
