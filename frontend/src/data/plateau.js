// **몇 주째 제자리인가** (2026-11-11).
//
// ── 왜 ──
//
// 「다음 한 걸음」(`lastSets.nextStep`)은 **잘 되고 있을 때** 말을 건다 — 같은 무게로
// 세 판을 채우면 한 칸 올려 권한다. 그런데 **올려 권했는데도 못 올린 사람**에게는
// 할 말이 없었다. 추이 그림(`liftTrend`)은 선을 그려주지만 선은 **읽는 사람이
// 읽어야** 한다. 넉 달째 평평한 선을 보고도 「그래서 어떻다」가 안 적혀 있었다.
//
// 이 자리는 **판정을 하지 않는다.** 등급도 꾸중도 아니다 — 「이 운동은 N주째
// 제자리입니다」라는 **사실 한 줄**과, 그것이 제자리인지 **쉰 것인지**를 가린다.
//
// ── ★ 상태는 셋이다 (분기를 둘로 만들면 거짓이 된다) ──
//
//   up     최근에 최고를 세웠다 → 말을 걸지 않는다 (칸을 안 그린다)
//   flat   최고를 세운 뒤 FLAT_DAYS 넘게 지났고 **그 사이 MIN_AFTER 판 이상 했다**
//   rest   마지막 기록이 REST_DAYS 넘게 전이다 → **제자리가 아니라 쉰 것이다**
//
// 「쉰 것」을 제자리로 읽으면 두 달 쉬고 돌아온 사람에게 「8주째 제자리」라고 말한다.
// 그 사람은 제자리가 아니라 **안 한 것**이다. 그리고 최고를 세운 뒤 **한 판도 안 한**
// 사람도 제자리가 아니다 — 그래서 `MIN_AFTER` 를 요구한다
// (11/09 의 「상태가 셋인데 분기가 둘」 류와 같은 자리다 · `npm run threestate`).
//
// ── ★ 맨몸을 그림 밖에 두지 않는다 ──
//
// 무게로만 보면 사전 221개 중 **76개(34%)가 영영 안 가려진다**(코어 26 · 유산소 19 ·
// 유산소머신 8 · 전신 11 · 레이즈 12). 11/09 에 그 수를 가볍게 적고 넘어간 일이 있다.
// 그래서 무게가 한 줄도 없는 운동은 **횟수**로 본다 — 「풀업 12회가 다섯 주째 그대로」.
// 읽는 손은 `liftTrend.trendOf` 하나이고 `metric` 만 바꾼다(손을 또 만들지 않는다).
//
// 유산소(시간·거리)는 **여기서 보지 않는다** — `cardioTrend` 가 주 단위로 따로 센다.
// 셋을 한 칸에 섞으면 단위가 다른 수가 나란히 서서 11/05 의 오각형이 된다.
//
// 계산은 여기 한 자리에 둔다. 화면은 읽기만 한다 — `npm run plateau` 가 값으로 본다.
import { MIN_POINTS, trendOf, liftNames } from './liftTrend';
import { daysBetween } from './personalRecord';

/**
 * **제자리라고 부르기까지의 날수.** 4주다.
 *
 * 까닭: 「다음 한 걸음」은 같은 무게 **세 판**이면 올려 권한다(`UP_AFTER`). 주 2회
 * 하는 사람에게 그 세 판이 약 10일이다. 그 권유를 받고도 **그 두 배가 넘게** 못 올린
 * 것이 「제자리」다. 2주로 내리면 **정상적인 한 주 쉼 + 한 번 실패**가 다 걸린다.
 */
export const FLAT_DAYS = 28;

/** 이 날수를 넘겨 안 했으면 **쉰 것**이다. 2주 — 주 1회 하는 사람을 쉰 것으로 읽지 않는다 */
export const REST_DAYS = 14;

/** 최고를 세운 뒤 그 운동을 한 **판 수**. 한 판도 안 했으면 제자리가 아니다 */
export const MIN_AFTER = 2;

/**
 * 한 운동이 제자리인가.
 *
 * 돌려주는 것 (말할 것이 없으면 `null` — 서로 다른 날이 둘 미만이면 아직 길이 아니다) —
 *
 *   kind     'up' · 'flat' · 'rest'
 *   metric   'kg' | 'reps'  ·  unit  'kg' | '회'
 *   best     최고를 **처음** 세운 날 `{ date, value }` (같은 값이 여럿이면 이른 날)
 *   last     마지막으로 한 날 `{ date, value }`
 *   days     최고날 → 마지막날 날수  ·  weeks  그것을 주로 (내림)
 *   after    최고날 **뒤에** 한 판 수  ·  idle  마지막날 → 오늘 날수 (today 없으면 null)
 *
 * 앞날 줄은 안 센다(`trendOf` 가 `today` 뒤를 버린다).
 */
export function plateauOf(workouts, exercise, today = null) {
  const byKg = trendOf(workouts, exercise, { today });
  const metric = byKg.length ? 'kg' : 'reps';
  const pts = byKg.length ? byKg : trendOf(workouts, exercise, { today, metric: 'reps' });
  if (pts.length < MIN_POINTS) return null;

  let best = pts[0];
  for (const p of pts) if (p.kg > best.kg) best = p;      // `>` 라 같은 값은 **이른 날**이 남는다
  const last = pts[pts.length - 1];
  const after = pts.filter((p) => p.date > best.date).length;
  const days = daysBetween(best.date, last.date);
  const idle = today ? daysBetween(last.date, today) : null;

  // 순서가 뜻이다 — **쉰 것을 먼저 가린다.** 안 그러면 쉰 사람이 제자리가 된다
  let kind = 'up';
  if (idle !== null && idle > REST_DAYS) kind = 'rest';
  else if (days >= FLAT_DAYS && after >= MIN_AFTER) kind = 'flat';

  return {
    kind, metric, unit: metric === 'kg' ? 'kg' : '회',
    best: { date: best.date, value: best.kg },
    last: { date: last.date, value: last.kg },
    days, weeks: Math.floor(days / 7), after, idle,
  };
}

/** 'YYYY-MM-DD' → '8/21'. `lastSets.shortDate` 와 같은 꼴 */
const 날 = (d) => String(d ?? '').slice(5).replace('-', '/');

/**
 * 그 상태를 한 줄로 읽어준다.
 *
 * **늘고 있는 사람에게는 아무 말도 하지 않는다**(`null`) — 화면은 그 칸을 안 그린다.
 * 「잘 하고 있어요」는 정보가 아니라 칸만 먹는다.
 *
 * 쉰 것은 **제자리라고 말하지 않는다.** 수를 세어 말하고 판정은 안 한다 —
 * 「게을렀다」는 이 앱이 할 말이 아니다.
 */
export function plateauLine(state) {
  if (!state || state.kind === 'up') return null;
  const { unit, best, last, weeks, after, idle } = state;
  if (state.kind === 'rest') {
    return `${idle}일째 안 했어요 — 마지막은 ${날(last.date)} ${last.value}${unit}. 제자리인지는 다시 해봐야 알아요`;
  }
  const 더 = unit === 'kg' ? '더 못 올렸어요' : '더 못 늘렸어요';
  return `${weeks}주째 제자리 — ${날(best.date)} 의 ${best.value}${unit} 가 가장 ${unit === 'kg' ? '무겁고' : '많고'}, 그 뒤 ${after}판은 ${더}`;
}

/**
 * **제자리인 운동들.** 홈·통계가 한 칸에 모아 보여줄 때 쓴다.
 *
 * `kind === 'flat'` 만 준다 — 오래된 것이 먼저다(주 수가 큰 것). 쉰 것은 안 섞는다
 * (한 칸에 「제자리」와 「안 했음」을 같이 넣으면 **그 칸이 무슨 칸인지** 사라진다).
 *
 * ★ 걸리는 것이 하나도 없는 사람이 많다 — 그러면 **빈 배열**이다. 화면은 그때
 * 칸을 안 그리는 쪽이 맞다(없는 것을 「없음」으로 그리면 매일 보는 자리에 빈 칸이 선다).
 */
export function plateauList(workouts, today = null, { limit = 3 } = {}) {
  const names = liftNames(workouts, today, 60, { metric: 'any' });
  const rows = [];
  for (const name of names) {
    const s = plateauOf(workouts, name, today);
    if (s && s.kind === 'flat') rows.push({ name, ...s });
  }
  return rows
    .sort((a, b) => b.days - a.days || a.name.localeCompare(b.name))
    .slice(0, limit);
}
