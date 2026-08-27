// 인바디 값이 **얼마나 달라졌나**.
//
// 절대값을 놓고 좋다 나쁘다 하지 않는다. 지난 기록과 견줘서 무엇이 어느 쪽으로
// 갔는지만 말한다. 성별도 나이도 필요 없다.
//
// 견줄 것이 없으면(기록이 하나면) 아무것도 돌려주지 않는다 — 화면이 안 나온다.

import { muscleRatio } from './bodyRanges';
import { volumeOf } from './weeklyReport';

export const SPANS = [
  { key: 'last', label: '지난번', days: null },
  { key: '3m', label: '3개월', days: 90 },
  { key: 'all', label: '처음부터', days: Infinity },
];

// 화면에 그릴 항목. dir 은 「늘어난 것이 어느 쪽인가」가 아니라 색을 고르는 데만 쓴다 —
// 좋고 나쁨을 매기지 않기로 했으므로, 늘면 주황 · 줄면 초록 같은 판정은 하지 않는다.
const FIELDS = [
  { key: 'weight', label: '체중', unit: 'kg', digits: 1 },
  { key: 'fat_pct', label: '체지방', unit: '%', digits: 1 },
  { key: 'muscle_kg', label: '골격근', unit: 'kg', digits: 1 },
  { key: 'water_l', label: '체수분', unit: 'L', digits: 1 },
];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** 'YYYY-MM-DD' 두 개 사이의 날 수. */
function daysBetween(a, b) {
  if (!a || !b) return null;
  const ms = Math.abs(new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`));
  return Number.isFinite(ms) ? Math.round(ms / 86400000) : null;
}

/**
 * 견줄 짝을 고른다.
 *
 * records 는 **최신이 앞**이다 (인바디 화면이 그렇게 들고 있다).
 * 'last' 는 바로 앞 기록, '3m' 은 90일보다 더 된 것 중 제일 최근,
 * 'all' 은 제일 오래된 것. 3개월치가 없으면 제일 오래된 것으로 떨어진다 —
 * 없다고 화면을 비우는 것보다 낫고, 날짜를 같이 보여주므로 속이는 것이 아니다.
 */
export function pickPair(records, spanKey = 'last') {
  const list = (records || []).filter(r => r && r.date);
  if (list.length < 2) return null;

  const now = list[0];
  if (spanKey === 'last') return { now, then: list[1] };
  if (spanKey === 'all') return { now, then: list[list.length - 1] };

  const span = SPANS.find(s => s.key === spanKey);
  const want = span?.days;
  if (!Number.isFinite(want)) return { now, then: list[list.length - 1] };

  const older = list.slice(1).find(r => (daysBetween(r.date, now.date) ?? 0) >= want);
  return { now, then: older || list[list.length - 1] };
}

/**
 * 한 마디로 요약. **말할 수 있을 때만 말한다.**
 *
 * 체중이 줄고 골격근이 늘어난 것은 견줄 값 둘로 확실히 말할 수 있다.
 * 「줄어든 무게는 대부분 지방」은 체지방률까지 내려갔을 때만 붙인다 —
 * 그 값이 없으면 안 붙인다.
 */
function headlineOf(rows) {
  const by = Object.fromEntries(rows.map(r => [r.key, r.delta]));
  const w = by.weight;
  const m = by.muscle_kg;
  const f = by.fat_pct;
  const abs = (n) => Math.abs(n).toFixed(1);

  if (w == null || m == null) return null;
  // 0.1 도 안 움직인 것은 안 움직인 것으로 본다. 재는 기계의 오차 안이다
  const moved = (n) => Math.abs(n) >= 0.2;
  if (!moved(w) && !moved(m)) return null;

  if (w < 0 && m > 0) {
    return {
      text: `체중은 ${abs(w)}kg 줄었는데 골격근은 ${abs(m)}kg 늘었어요.`,
      sub: f != null && f < 0 ? '줄어든 무게는 대부분 지방이었습니다.' : null,
    };
  }
  if (w > 0 && m > 0) {
    return {
      text: `체중과 골격근이 함께 늘었어요. 골격근 +${abs(m)}kg.`,
      sub: f != null && f > 0 ? '체지방률도 같이 올랐습니다.' : null,
    };
  }
  if (w < 0 && m < 0) {
    return {
      text: `체중이 ${abs(w)}kg 줄면서 골격근도 ${abs(m)}kg 줄었어요.`,
      sub: null,
    };
  }
  return null;
}

/**
 * 변화 요약. 견줄 것이 없으면 null.
 */
export function buildChange(records, spanKey = 'last') {
  const pair = pickPair(records, spanKey);
  if (!pair) return null;

  const { now, then } = pair;
  const rows = [];
  let max = 0;

  FIELDS.forEach(f => {
    const a = num(then[f.key]);
    const b = num(now[f.key]);
    if (a === null || b === null) return;
    const delta = Math.round((b - a) * 10) / 10;
    rows.push({ ...f, from: a, to: b, delta });
    max = Math.max(max, Math.abs(delta));
  });

  // 골격근 비율은 따로 센다 (두 값에서 나오는 값이라 위 목록에 없다)
  const rThen = muscleRatio(then);
  const rNow = muscleRatio(now);
  if (rThen !== null && rNow !== null) {
    const delta = Math.round((rNow - rThen) * 10) / 10;
    rows.push({ key: 'muscle_ratio', label: '골격근 비율', unit: '%', digits: 1, from: rThen, to: rNow, delta });
    max = Math.max(max, Math.abs(delta));
  }

  if (rows.length === 0) return null;

  return {
    from: then.date,
    to: now.date,
    days: daysBetween(then.date, now.date),
    rows,
    // 막대 길이를 맞추는 데 쓴다. 0 이면 아무것도 안 움직인 것이다
    max,
    headline: headlineOf(rows),
  };
}

/**
 * 그 기간에 운동을 얼마나 했나.
 *
 * 8/25 시안 C 에 「그동안 운동은 — 3개월간 38회 · 주 3.0회 · 총 볼륨 142톤」이라는
 * 줄이 있었는데 안 넣었었다. **몸이 달라진 것과 그동안 한 것을 같은 화면에서 봐야
 * 무슨 일이 있었는지가 이어진다** — 체중이 3kg 줄었다는 말 옆에 「3개월간 38회」가
 * 있는 것과 없는 것은 다르다.
 *
 * 좋고 나쁨은 여기서도 안 매긴다. 몇 번 했고 얼마를 들었는지만 센다.
 * 볼륨은 무게를 적은 것만 센다 (weeklyReport 와 같은 규칙).
 */
export function trainingIn(workouts, from, to) {
  if (!workouts || !from || !to) return null;
  const list = [];
  let days = 0;
  Object.entries(workouts).forEach(([key, recs]) => {
    if (!recs || recs.length === 0) return;
    if (key < from || key > to) return;
    days += 1;
    list.push(...recs);
  });
  if (list.length === 0) return null;

  const spanDays = daysBetween(from, to) || 0;
  const weeks = spanDays > 0 ? spanDays / 7 : 0;
  const { kg } = volumeOf(list);
  return {
    count: list.length,
    days,
    spanDays,
    perWeek: weeks >= 1 ? Math.round((days / weeks) * 10) / 10 : null,
    volumeKg: kg,
  };
}
