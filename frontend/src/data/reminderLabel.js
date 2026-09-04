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
