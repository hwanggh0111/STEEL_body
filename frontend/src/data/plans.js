// 앞으로 할 것 — 달력이 쓰는 계산.
//
// **한 것과 할 것은 다른 이야기다.** 기록(`workouts`)과 섞으면 「이번 달에 몇 번
// 나왔나」에 아직 하지도 않은 날이 같이 세어진다. 그래서 따로 받아 따로 그린다.
//
// 계획은 **그날이 지나도 안 지운다.** 안 한 날을 조용히 지우면 왜 못 했는지가
// 아무 데도 안 남는다 — 지난 계획은 「못 한 것」으로 흐리게 그린다.

/** 날짜별로 묶는다. 달력은 칸마다 이 안에서 꺼내 쓴다 */
export function plansByDate(plans) {
  const map = {};
  for (const p of plans || []) {
    if (!p?.date) continue;
    (map[p.date] = map[p.date] || []).push(p);
  }
  return map;
}

/**
 * 그 날 계획이 어떤 상태인가.
 *
 *   'done'   — 계획도 있고 그날 기록도 있다 (한 것으로 본다)
 *   'todo'   — 오늘이거나 앞날이다
 *   'missed' — 지난 날인데 그날 기록이 없다
 *
 * **「했는지」를 계획에 적어두지 않는다.** 기록이 곧 답이다 — 따로 적어두면
 * 기록을 지웠을 때 계획만 「했음」으로 남는다.
 */
export function planState(date, today, dayWorkouts) {
  const did = Array.isArray(dayWorkouts) ? dayWorkouts.length > 0 : !!dayWorkouts;
  if (did) return 'done';
  return date >= today ? 'todo' : 'missed';
}

/** 오늘부터 가까운 순으로 아직 안 한 계획 몇 개. 홈이나 목록 위에 한 줄 적을 때 쓴다 */
export function upcoming(plans, today, workoutsByDate = {}, limit = 3) {
  return (plans || [])
    .filter((p) => p.date >= today && !(workoutsByDate[p.date] || []).length)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
    .slice(0, limit);
}

/** 지난 날인데 못 한 것이 몇 건인가 */
export function missedCount(plans, today, workoutsByDate = {}) {
  return (plans || []).filter((p) => p.date < today && !(workoutsByDate[p.date] || []).length).length;
}

/** '2026-09-05' → '9월 5일' */
export function dayLabel(date) {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(String(date || ''));
  if (!m) return '';
  return `${Number(m[1])}월 ${Number(m[2])}일`;
}

/** 며칠 남았나. 오늘이면 '오늘', 어제면 '어제' */
export function untilLabel(date, today) {
  if (!date || !today) return '';
  const a = Date.parse(`${today}T00:00:00`);
  const b = Date.parse(`${date}T00:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return '';
  const days = Math.round((b - a) / 86400000);
  if (days === 0) return '오늘';
  if (days === 1) return '내일';
  if (days === -1) return '어제';
  return days > 0 ? `${days}일 뒤` : `${-days}일 전`;
}
