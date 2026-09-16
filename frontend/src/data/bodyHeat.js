import { bodyPartOf } from './bodyPart';
import { daysBetween } from './personalRecord';

// 몸 지도 — **어느 부위가 아직 달아 있고 어디가 식었나.**
//
// 운동 기록에 이미 다 들어 있는 것을 여태 아무 데서도 안 보여줬다. 「이번 주 몇 일」은
// 몇 번 갔는지만 말하고, 부위 분포는 비율만 말한다. 정작 헬스장 앞에서 하는 질문은
// **「오늘 뭘 하지」** 하나인데, 그 답은 비율이 아니라 **마지막으로 언제 건드렸나**다.
//
// 그래서 부위마다 마지막 자극일 하나만 본다. 오늘이면 달아 있고, 날이 갈수록 식는다.
// 회복 시간을 지어내지 않는다 — 「48시간이면 회복」 같은 것은 사람마다 다르고,
// 우리는 그 사람의 수면도 나이도 모른다. **며칠 지났는지만 말하고 판단은 사람이 한다.**
//
// 기준을 이렇게 잡은 이유:
//   오늘(0일)   방금 한 것이니 제일 밝다
//   1~2일       아직 남아 있다
//   3~5일       식는 중
//   6일 이상    식었다 — 지도에서 색을 빼고 점선으로만 두른다
// 굳이 「회복됨/미회복」이라 부르지 않는다. 우리가 아는 것은 날 수뿐이다.

/**
 * 지도에 자리가 있는 부위.
 *
 * `bodyPart.js` 의 PARTS 에서 **'기타'를 뺀 것**이다. 못 맞힌 운동을 몸 어딘가에
 * 칠하면 거짓말이 된다 — 어디를 칠해야 할지 모르니까 '기타'인 것이다.
 */
export const MAP_PARTS = ['가슴', '등', '어깨', '하체', '팔', '코어'];

/** 'YYYY-MM-DD' 에서 며칠 뒤로. 최근 이레의 첫날을 찾는 데 쓴다. */
function shiftBack(key, days) {
  const d = new Date(`${key}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() - days);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 며칠 됐나 → 달아오른 정도 (3 뜨겁다 … 0 식었다). 기록이 없으면 0. */
export function heatLevel(days) {
  if (days === null || days === undefined) return 0;
  if (days <= 0) return 3;
  if (days <= 2) return 2;
  if (days <= 5) return 1;
  return 0;
}

/**
 * 부위별 마지막 자극일.
 *
 * workouts 는 { 'YYYY-MM-DD': [기록, ...] } 모양이다 (workoutStore 와 같다).
 * today 는 'YYYY-MM-DD'. **앞날 기록은 안 센다** — 달력에서 앞날에 적을 수 있는데,
 * 아직 하지도 않은 운동으로 부위가 달아오르면 지도가 거짓말을 한다.
 *
 * 돌려주는 것:
 *   byPart    부위 이름 → { part, date, days, level, count, sets7, last }
 *             sets7 은 최근 이레(오늘 포함) 세트 수, last 는 마지막 날 첫 기록
 *   list      식은 순서 (오래 안 건드린 것이 앞)
 *   coldest   그중 맨 앞 하나. 한 번도 안 한 부위가 있으면 그것이 맨 앞이다
 *   hot       오늘 건드린 부위 이름들
 *   other     어느 부위에도 못 들어간 것 { count, names } — 사전이 모자란 자리
 *   maxSets7  부위 중 최근 이레 세트가 가장 많은 값 (막대 기준)
 *   any       기록이 하나라도 있나 — 없으면 화면은 지도 대신 안내를 낸다
 */
export function buildHeat(workouts, today) {
  const byPart = {};
  MAP_PARTS.forEach((p) => {
    byPart[p] = { part: p, date: null, days: null, level: 0, count: 0, sets7: 0, last: null };
  });
  // 어느 부위에도 못 들어간 것. 사전이 모자란 자리라 화면에서 한 줄로 밝힌다 —
  // 조용히 빼면 「나는 이만큼 했는데 지도가 비어 있다」가 된다
  const other = { count: 0, names: [] };

  // 최근 이레. **오늘까지 7일**이다(오늘 포함) — 「이번 주」로 세면 월요일 아침마다
  // 모든 부위가 0 이 되어, 일요일에 조진 사람이 월요일에 아무것도 안 한 사람이 된다
  const weekAgo = today ? shiftBack(today, 6) : null;

  Object.entries(workouts || {}).forEach(([date, list]) => {
    if (!date || !Array.isArray(list) || list.length === 0) return;
    if (today && date > today) return;           // 앞날은 아직 한 것이 아니다
    list.forEach((record) => {
      const part = bodyPartOf(record?.exercise);
      if (part === '기타') {
        other.count += 1;
        const name = String(record?.exercise || '').trim();
        if (name && !other.names.includes(name)) other.names.push(name);
        return;
      }
      const slot = byPart[part];
      if (!slot) return;
      slot.count += 1;
      if (weekAgo && date >= weekAgo) slot.sets7 += Number(record?.sets) || 0;
      if (!slot.date || date > slot.date) { slot.date = date; slot.last = null; }
      // 마지막으로 한 날의 **첫 운동**을 대표로 둔다. 그날 것을 다 늘어놓으면
      // 목록이 되고, 목록은 이미 기록 화면이 하고 있다
      if (date === slot.date && !slot.last) {
        slot.last = {
          exercise: String(record?.exercise || '').trim(),
          weight: record?.weight ?? null,
          sets: Number(record?.sets) || 0,
          reps: Number(record?.reps) || 0,
        };
      }
    });
  });

  MAP_PARTS.forEach((p) => {
    const slot = byPart[p];
    slot.days = slot.date ? daysBetween(slot.date, today) : null;
    slot.level = heatLevel(slot.days);
  });

  // 식은 순. 한 번도 안 한 부위(days === null)가 제일 앞이다 —
  // 「6일 전」보다 「한 번도 안 함」이 더 비어 있는 자리다
  const list = MAP_PARTS.map((p) => byPart[p]).sort((a, b) => {
    if (a.days === null && b.days === null) return MAP_PARTS.indexOf(a.part) - MAP_PARTS.indexOf(b.part);
    if (a.days === null) return -1;
    if (b.days === null) return 1;
    if (b.days !== a.days) return b.days - a.days;
    return MAP_PARTS.indexOf(a.part) - MAP_PARTS.indexOf(b.part);
  });

  const any = MAP_PARTS.some((p) => byPart[p].count > 0);
  // 막대를 그릴 때 쓰는 기준. **부위끼리만 견준다** — 세트 수는 절대값으로 많고
  // 적음을 말할 수 없다(하체 5세트와 팔 5세트는 같은 양이 아니다)
  const maxSets7 = MAP_PARTS.reduce((n, p) => Math.max(n, byPart[p].sets7), 0);

  return {
    byPart,
    list,
    coldest: any ? list[0] : null,
    hot: MAP_PARTS.filter((p) => byPart[p].days === 0),
    other,
    maxSets7,
    any,
  };
}
