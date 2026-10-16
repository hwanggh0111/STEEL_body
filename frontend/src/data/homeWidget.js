// 홈 화면 위젯에 적을 것 (2026-10-16)
//
// ── 왜 ──
//
// 「오늘」 탭의 질문은 **「오늘 뭐 하지」**이고, 그 답은 첫 카드(`TodayFocus`)에
// 한 줄로 적혀 있다 — 「가슴이 3일째 식어 있습니다」. 그런데 그 한 줄을 보려면
// **앱을 열어야** 한다. 잠든 서버를 만나면 그 한 줄까지 22초다(10/16 에 깨워두기로
// 고쳤지만, 앱을 켜고 로그인을 지나 홈이 그려지는 시간은 그대로다).
//
// 폰 홈 화면에 **그 한 줄만** 얹는다. 앱을 안 열어도 보이고, 누르면 앱이 열린다.
//
// ── 어떻게 ──
//
// **계산을 새로 쓰지 않는다.** 홈 카드와 몸 지도가 보는 `data/bodyHeat.js` 하나를
// 같이 본다 — 두 벌로 두면 위젯과 홈이 서로 다른 부위를 말하는 날이 온다.
// 여기서 하는 일은 **그 값을 글 세 줄로 접는 것**뿐이다(위젯은 좁다).
//
// 넘기는 길은 앱 껍데기에 이미 있는 다리(`window.BlackIronApp`)다 —
// `MainActivity` 의 `AppBridge` 에 `saveWidget` 을 더했다. 플러그인을 새로 안 받는다:
// 저장소 플러그인을 쓰면 **열쇠 이름이 두 군데**(JS 와 자바)에 생기고, 그 둘이
// 어긋나면 위젯이 영원히 「아직 기록이 없어요」만 보여준다.
//
// **브라우저에서는 아무 일도 안 한다** — 다리가 없다. 던지지도 않는다.

import { buildHeat } from './bodyHeat';

/** 위젯이 읽는 자리. **자바 쪽과 같은 글자여야 한다** (`TodayWidget.PREFS` · `KEY`) */
export const WIDGET_PREFS = 'blackiron_widget';
export const WIDGET_KEY = 'today';

/**
 * 위젯에 적을 것. 화면이 쓰는 값을 **글자로 접어** 돌려준다.
 *
 * 세 줄이다 —
 *   head  큰 글씨 한 낱말 (식은 부위 이름). 기록이 없으면 비운다
 *   line  그 아래 한 줄 (「3일째 식어 있습니다」)
 *   sub   맨 아래 작은 줄 (최근에 달군 자리 둘)
 *
 * **지어내지 않는다** — 적혀 있는 것만 말한다(`data/nextSet.js` 머리글의 규칙).
 * 그래서 「다음엔 가슴 하세요」가 아니라 「가슴이 3일째 식어 있습니다」다.
 */
export function widgetText(workouts, today) {
  const heat = buildHeat(workouts, today);
  const todaySets = (workouts?.[today] || []).reduce((n, r) => n + (Number(r?.sets) || 0), 0);
  const base = { v: 1, head: '', line: '', sub: '', sets: todaySets, at: new Date().toISOString() };

  // 기록이 하나도 없으면 **빈 몸을 보여줄 자리가 아니다** (홈 카드도 안 그린다)
  if (!heat.any || !heat.coldest) {
    return { ...base, line: '첫 기록을 적어보세요' };
  }

  const cold = heat.coldest;
  const hot = heat.list.filter((p) => p.level > 0).slice(0, 2);
  const sub = hot.map((p) => `${p.part} ${p.days === 0 ? '오늘' : `${p.days}일 전`}`).join(' · ');

  if (cold.days === null) return { ...base, head: cold.part, line: '아직 한 번도 안 했습니다', sub };
  if (cold.level === 0) return { ...base, head: cold.part, line: `${cold.days}일째 식어 있습니다`, sub };
  return { ...base, line: '몸 전체가 고루 달아 있습니다', sub };
}

/** 이 기기에 위젯을 둘 수 있나 (= 앱으로 열었고 다리가 붙었나). */
export function canWidget() {
  return typeof window !== 'undefined'
    && typeof window.BlackIronApp?.saveWidget === 'function';
}

/**
 * 위젯에 넘긴다. **터지지 않는다** — 위젯 하나 때문에 화면이 멈추면 안 된다.
 *
 * 같은 글이면 안 넘긴다. 홈은 기록이 바뀔 때마다 이 값을 다시 세는데, 글자가
 * 그대로인 때가 대부분이다 — 그때마다 넘기면 **폰이 위젯을 다시 그린다**.
 */
let lastSent = '';
export function pushWidget(workouts, today) {
  if (!canWidget()) return false;
  try {
    const payload = widgetText(workouts, today);
    // 적은 시각(`at`)은 늘 다르다 — 글자만 견준다
    const seen = JSON.stringify({ ...payload, at: '' });
    if (seen === lastSent) return false;
    lastSent = seen;
    window.BlackIronApp.saveWidget(JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}
