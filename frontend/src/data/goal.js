// 목표.
//
// 이 앱이 보여주던 것은 전부 **지나간 것**이었다 — 1년 벽 · 주간 요약 · 몸 지도 ·
// 달력. 「이번 주 3일」이 잘한 것인지 모자란 것인지는 끝내 아무도 말해주지 않았다.
// 수는 있는데 **뜻이 없었다.** 목표는 그 수에 뜻을 붙이는 일이다.
//
// **남과 안 겨룬다는 약속과 부딪히지 않는다** — 겨루는 상대가 자기 자신이다.
// 그래서 여기에는 등수도 평균도 없다. 내가 정한 수와 내가 한 수만 있다.
//
// 계산은 전부 여기 한 곳에 둔다. 홈의 한 줄 · 홈의 목표 카드 · 목표 화면 셋이
// **같은 함수**를 본다 — 세 벌로 두면 홈과 목표 화면이 서로 다른 연속 주를
// 말하는 날이 온다 (몸 지도와 「오늘 할 곳」을 `bodyHeat.js` 하나로 묶은 것과 같은 이유다).
//
// 화면에서는 확인하기 어려운 계산이다 — 연속 주를 눈으로 보려면 몇 달치 기록이
// 있어야 한다. 그래서 `npm run goal` 이 값으로 본다.

import { dateKey } from './dateKey';
import { mondayOf, weekKeys } from './weeklyReport';

/** 주 8회는 없다. 몸이 쉬는 날을 스스로 지우는 목표를 앱이 거들지 않는다. */
export const MAX_WEEKLY = 7;

/** 몇 주까지 되짚어 볼 것인가. 10년치 — 이보다 오래 쓴 기록은 아직 없다. */
const MAX_WEEKS = 520;

/** 'YYYY-MM-DD' → Date. **한낮으로 만든다** — 자정으로 두면 서머타임이 있는
 *  곳에서 하루가 밀린다 (이 앱은 한국만 쓰지만 여행 중에도 돈다). */
function at(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

const listOf = (workouts, key) => (workouts?.[key] || []);

/** 그 주에 운동한 날 수. */
function doneIn(workouts, keys) {
  return keys.filter(k => listOf(workouts, k).length > 0).length;
}

function weekBack(monday, n) {
  const d = new Date(monday);
  d.setDate(monday.getDate() - 7 * n);
  return d;
}

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * 쫓고 있는 목표가 있는가.
 *
 * 값이 둘 다 비어 있으면 **카드를 아예 안 그린다.** 빈 자리에 0을 띄워두면
 * 아무 말도 안 하면서 자리만 먹는다 (주간 요약에서 배운 것).
 */
export function hasGoal(goal) {
  return !!goal && (goal.weeklyTarget != null || goal.weightTarget != null);
}

/**
 * 이번 주 진행.
 *
 * 주는 **월요일에 시작한다** — 홈의 주간 달력 · 주간 요약과 같다.
 * 주 횟수 목표가 없으면 null (그리지 않는다).
 */
export function weekProgress(workouts, goal, today = dateKey()) {
  const target = goal?.weeklyTarget;
  if (!target) return null;

  const keys = weekKeys(mondayOf(at(today)));
  const done = doneIn(workouts, keys);
  const idx = keys.indexOf(today);

  // 오늘을 **넣어서** 센다 — 오늘 아직 안 했어도 오늘 하면 되기 때문이다.
  // 일요일이면 1, 월요일이면 7. 날짜가 목록 밖이면(있을 수 없지만) 0으로 둔다
  const remainDays = idx < 0 ? 0 : keys.length - idx;

  const left = Math.max(0, target - done);
  return {
    target,
    done,
    left,
    remainDays,
    met: done >= target,
    // 넘겨도 1을 넘기지 않는다 — 고리가 두 바퀴 돌면 몇 바퀴인지 못 읽는다
    ratio: clamp01(done / target),
    // 목표보다 더 한 날. 넘긴 것은 넘겼다고 말해준다
    over: Math.max(0, done - target),
  };
}

/**
 * 이번 주를 한 줄로.
 *
 * **모자란다고 나무라지 않는다.** 이 앱은 안 한 날을 지우지도 숨기지도 않지만,
 * 그렇다고 못 채울 것 같다고 미리 말하지도 않는다 — 금요일에 「이번 주는
 * 틀렸습니다」를 읽으면 토요일에 안 나간다.
 */
export function weekLine(p) {
  if (!p) return '';
  if (p.over > 0) return `이번 주 목표를 ${p.over}번 넘겼습니다`;
  if (p.met) return '이번 주 목표를 채웠습니다';
  if (p.left === 1) return '한 번만 더 하면 이번 주를 채웁니다';
  if (p.left <= p.remainDays) return `${p.left}번 남았습니다`;
  return p.done === 0 ? '이번 주는 아직입니다' : `이번 주 ${p.done}번 했습니다`;
}

/**
 * 최근 몇 주를 뒤에서부터. 막대로 그린다.
 *
 * 맨 끝이 이번 주고, 이번 주는 **아직 진행 중**이라 그렇다고 표시해 둔다 —
 * 화면이 다 지난 주와 같은 색으로 그리면 아직 남은 날이 있는데 못 채운 것처럼 보인다.
 */
export function weekHistory(workouts, goal, today = dateKey(), n = 5) {
  const target = goal?.weeklyTarget;
  if (!target) return [];
  const thisMonday = mondayOf(at(today));
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const monday = weekBack(thisMonday, i);
    const done = doneIn(workouts, weekKeys(monday));
    out.push({
      monday: dateKey(monday),
      done,
      met: done >= target,
      current: i === 0,
      ratio: clamp01(done / target),
    });
  }
  return out;
}

/**
 * 이어온 주.
 *
 * **이번 주가 아직 모자란 것으로는 안 끊는다.** 수요일에 「연속 0주」를 띄우면
 * 그때까지 이어온 열 주가 수요일마다 사라지는 셈이다. 이번 주는 채웠으면 더하고,
 * 아직이면 건너뛴 채로 지난주부터 센다.
 *
 * `best` 에는 **진행 중인 주를 안 넣는다** — 아직 안 끝난 것을 최고 기록으로
 * 적어두면, 일요일에 못 채웠을 때 없던 기록이 하나 남는다.
 */
export function weekStreak(workouts, goal, today = dateKey()) {
  const target = goal?.weeklyTarget;
  if (!target) return null;

  const dates = Object.keys(workouts || {}).filter(k => listOf(workouts, k).length > 0).sort();
  if (dates.length === 0) return { current: 0, best: 0, weeks: 0 };

  const thisMonday = mondayOf(at(today));
  const firstMonday = mondayOf(at(dates[0]));

  // 첫 기록의 주부터 이번 주까지, 주마다 「채웠나」 하나씩
  const span = Math.min(MAX_WEEKS,
    Math.round((thisMonday - firstMonday) / (7 * 24 * 3600 * 1000)) + 1);
  const met = [];
  for (let i = span - 1; i >= 0; i--) {
    met.push(doneIn(workouts, weekKeys(weekBack(thisMonday, i))) >= target);
  }

  // 지금 이어오는 것 — 뒤에서부터. 이번 주가 아직이면 한 칸 건너뛴다
  let current = 0;
  let i = met.length - 1;
  if (i >= 0 && !met[i]) i -= 1;
  for (; i >= 0 && met[i]; i--) current += 1;

  // 가장 길었던 것 — 진행 중인 이번 주는 채운 경우에만 센다
  const past = met[met.length - 1] ? met : met.slice(0, -1);
  let best = 0;
  let run = 0;
  for (const m of past) {
    run = m ? run + 1 : 0;
    if (run > best) best = run;
  }

  return { current, best, weeks: met.length };
}

/**
 * 체중 목표까지 얼마나 왔나.
 *
 * 시작점은 **목표를 세운 날에 박아둔 값**(`weightStart`)이다. 매번 기록에서 다시
 * 찾으면 옛 기록 하나를 고칠 때마다 진행률이 흔들린다. 없으면(옛 목표) 지금 값을
 * 시작으로 친다 — 그러면 진행률이 0에서 시작하지만, **틀린 수를 보여주지는 않는다.**
 */
export function weightProgress(records, goal) {
  const target = goal?.weightTarget;
  if (target == null) return null;

  const rows = (records || [])
    .filter(r => Number(r?.weight) > 0 && r?.date)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  if (rows.length === 0) return { target, now: null, start: null, ratio: 0, left: null, dir: null, reached: false };

  const now = round1(Number(rows[rows.length - 1].weight));
  const start = goal.weightStart != null ? round1(Number(goal.weightStart)) : now;
  const dir = target < start ? 'down' : target > start ? 'up' : 'same';

  const span = Math.abs(target - start);
  const moved = dir === 'down' ? start - now : dir === 'up' ? now - start : 0;
  const reached = dir === 'down' ? now <= target : dir === 'up' ? now >= target : now === target;

  return {
    target,
    now,
    start,
    dir,
    reached,
    // 남은 거리. **지나쳤으면 0** — 음수를 「-0.4kg 남음」으로 적으면 읽을 수가 없다
    left: reached ? 0 : round1(Math.abs(target - now)),
    ratio: reached ? 1 : span === 0 ? 0 : clamp01(moved / span),
    // 되레 멀어졌나. 화면이 색을 고르는 데 쓴다 (나무라는 말은 안 쓴다)
    away: moved < 0,
    lastDate: rows[rows.length - 1].date,
  };
}

/** 몇 월 어느 무렵인가 — 「11월 초」. 날짜를 콕 집으면 안 맞았을 때 거짓말이 된다. */
function roughLabel(d) {
  const day = d.getDate();
  const part = day <= 10 ? '초' : day <= 20 ? '중순' : '말';
  return `${d.getMonth() + 1}월 ${part}`;
}

/** 요즘 흐름을 볼 창. 이보다 짧으면 물 마신 것에도 흔들린다. */
const TREND_DAYS = 28;
/** 이보다 멀면 말하지 않는다. 「2028년 3월」은 격려가 아니다. */
const MAX_ETA_DAYS = 400;

/**
 * 이대로면 언제 닿나.
 *
 * **모르면 말하지 않는다.** 기록이 둘 미만이거나, 흐름이 목표와 반대거나,
 * 너무 멀면 null 이다 — 기록 앱이 지어낸 수를 한 번 보여주면 그 뒤의 모든 수를
 * 못 믿게 된다.
 */
export function weightEta(records, goal, today = dateKey()) {
  const p = weightProgress(records, goal);
  if (!p || p.now == null || p.reached || !p.dir || p.dir === 'same') return null;

  const from = at(today);
  from.setDate(from.getDate() - TREND_DAYS);
  const fromKey = dateKey(from);

  const rows = (records || [])
    .filter(r => Number(r?.weight) > 0 && r?.date && r.date >= fromKey && r.date <= today)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (rows.length < 2) return null;

  const first = rows[0];
  const last = rows[rows.length - 1];
  const days = Math.round((at(last.date) - at(first.date)) / (24 * 3600 * 1000));
  if (days <= 0) return null;

  const perDay = (Number(last.weight) - Number(first.weight)) / days;
  // 흐름이 목표와 반대면 안 말한다 — 「이대로면」이 성립하지 않는다
  if (p.dir === 'down' && perDay >= 0) return null;
  if (p.dir === 'up' && perDay <= 0) return null;

  const daysLeft = Math.ceil(Math.abs(p.target - p.now) / Math.abs(perDay));
  if (!Number.isFinite(daysLeft) || daysLeft <= 0 || daysLeft > MAX_ETA_DAYS) return null;

  const when = at(today);
  when.setDate(when.getDate() + daysLeft);
  return { days: daysLeft, label: roughLabel(when), perWeek: round1(perDay * 7) };
}

/**
 * 홈에 거는 한 줄.
 *
 * 홈은 **한 가지만 말한다.** 주 횟수와 체중을 둘 다 쫓고 있어도 한 줄에는
 * 하나만 나온다 — 지금 더 급한 쪽이다.
 */
export function goalLine(workouts, records, goal, today = dateKey()) {
  const w = weekProgress(workouts, goal, today);
  if (w) return weekLine(w);
  const b = weightProgress(records, goal);
  if (b && b.now != null) {
    if (b.reached) return '체중 목표에 닿았습니다';
    return `목표까지 ${b.left}kg 남았습니다`;
  }
  return '';
}
