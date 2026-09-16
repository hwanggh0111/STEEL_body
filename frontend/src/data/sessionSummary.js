import { volumeOf, buildWeekly } from './weeklyReport';
import { bodyPartOf } from './bodyPart';
import { bestRecords, checkRecord } from './personalRecord';
import { dateKey } from './dateKey';
import { buildPace } from './pace';

// 운동 끝 결산.
//
// 루틴을 다 마치면 여태 토스트 한 줄이 지나갔다 — 「가슴 루틴 완료! 4개를 마쳤어요」.
// 4초 뒤에 사라지고, 방금 뭘 했는지는 아무 데도 안 남는다. **하루 중에 제일 뿌듯한
// 순간이 제일 조용했다.**
//
// 그 자리에 한 화면을 세운다. 숫자는 **하나만** 크게 — 오늘 들어올린 총 무게다.
// 세트 수도 시간도 그 숫자 밑에 작게 붙인다. 여러 개를 크게 적으면 무엇을 봐야 할지
// 모르게 되고, 그러면 아무것도 안 보게 된다.
//
// **지어내지 않는다.** 운동한 시간은 안 재고 있으므로 안 적는다(기록에 시작·끝 시각이
// 없다). 맨몸만 한 날은 총 무게가 0 이라 숫자를 안 띄우고 세트 수를 대신 세운다 —
// 0kg 을 크게 띄우면 열심히 한 사람에게 아무것도 아니라고 말하는 셈이다.

/** 'YYYY-MM-DD' 에서 며칠 뒤로. 지난주 같은 요일을 찾는 데 쓴다. */
function shiftDate(key, delta) {
  const d = new Date(`${key}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + delta);
  return dateKey(d);
}

/**
 * 오늘 한 것을 한 장으로.
 *
 * workouts 는 { 'YYYY-MM-DD': [기록, ...] }. today 는 'YYYY-MM-DD'.
 * routineName 은 방금 끝낸 루틴 이름(없어도 된다).
 *
 * 돌려주는 것:
 *   kg, sets, count, parts   오늘 것
 *   items                    오늘 한 것 목록 (운동 · 무게 · 세트 · 횟수)
 *   bodyweightSets           무게를 안 적은 세트 (맨몸)
 *   deltaKg                  지난주 같은 요일보다 얼마나 더 들었나 (그날 기록이 없으면 null)
 *   weeks                    몇 주 이어서 하고 있나
 *   record                   오늘 세운 최고기록 하나 (없으면 null)
 *   pace                     오늘이 늘어졌나 (`data/pace.js`). 못 재는 날은 usable:false
 */
export function buildSummary(workouts, today, routineName) {
  const list = (workouts || {})[today] || [];
  const { kg, bodyweightSets } = volumeOf(list);
  const sets = list.reduce((n, w) => n + (Number(w?.sets) || 0), 0);
  const parts = [...new Set(list.map((w) => bodyPartOf(w?.exercise)))];

  // 지난주 같은 요일. **같은 날짜(한 달 전)가 아니라 같은 요일**이다 —
  // 월요일에 하체를 하는 사람에게 지난주 월요일이 견줄 만한 날이다
  const lastWeekKey = shiftDate(today, -7);
  const lastWeek = lastWeekKey ? (workouts || {})[lastWeekKey] : null;
  const deltaKg = Array.isArray(lastWeek) && lastWeek.length > 0
    ? kg - volumeOf(lastWeek).kg
    : null;

  // 오늘 세운 최고기록. **오늘을 뺀 나머지**로 최고를 만들어 견준다 —
  // 오늘 것을 넣고 견주면 방금 세운 기록이 이미 최고로 들어 있어 아무것도 안 걸린다
  const before = {};
  Object.entries(workouts || {}).forEach(([date, day]) => {
    if (date !== today) before[date] = day;
  });
  const best = bestRecords(before);
  let record = null;
  list.forEach((r) => {
    const hit = checkRecord(best, { ...r, date: today });
    if (!hit) return;
    // 여럿이면 **가장 많이 넘어선 것** 하나만 띄운다. 셋을 늘어놓으면 셋 다 안 읽는다
    const gain = hit.prev ? hit.entry.score - hit.prev.score : hit.entry.score;
    if (!record || gain > record.gain) record = { ...hit, gain };
  });

  const weekly = buildWeekly(workouts, new Date(`${today}T00:00:00`));

  return {
    date: today,
    routineName: routineName || '',
    kg,
    sets,
    count: list.length,
    parts,
    // **뭘 했는지가 결산에 없었다.** 큰 숫자 하나만 두고 「오늘 12,480kg」이라고
    // 하면, 방금 한 사람도 무엇으로 그 숫자가 됐는지 모른다. 화면은 이 목록을
    // 작게 깐다 — 크게 적으면 기록 화면이 되고, 기록 화면은 이미 있다
    items: list.map((w) => ({
      exercise: String(w?.exercise || '').trim(),
      weight: w?.weight ?? null,
      sets: Number(w?.sets) || 0,
      reps: Number(w?.reps) || 0,
    })),
    bodyweightSets,
    deltaKg,
    weeks: weekly?.streak || 0,
    record,
    // **오늘 12,480kg 을 한 시간에 들었는지 두 시간에 들었는지**는 여태 아무 데도
    // 없었다. 기록을 남긴 시각으로 잰다 — 못 재는 날은 스스로 usable:false 로 답한다
    pace: buildPace(workouts, today),
  };
}
