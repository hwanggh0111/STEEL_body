// 달력 한 달치.
//
// 히스토리는 이름도 「히스토리」고 앱 소개에도 「달력으로 되짚는다 —
// 빠진 날이 눈에 보여야 안 빠진다」고 적어뒀는데, 정작 화면은 **날짜별 목록**이었다.
// 빠진 날은 아예 안 그려지니 눈에 보일 수가 없었다.
//
// 여기서는 격자를 만들고, 그 달에 무엇을 했는지 세기만 한다. 그리는 것은 화면이 한다.

import { dateKey } from './dateKey';
import { parseWeight } from './personalRecord';
import { bodyPartOf, partDistribution } from './bodyPart';

export const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

/**
 * 그 달의 격자. 월요일에 시작하는 주 단위로 자른다 (앱의 다른 곳과 같다).
 *
 * 앞뒤로 빈 칸이 생긴다 — 그 칸은 null 이다. 옆 달 날짜를 흐리게 채우지 않는다.
 * **빠진 날을 보여주는 게 목적인데 옆 달까지 그리면 무엇이 이번 달인지 흐려진다.**
 */
export function monthGrid(year, month) {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  // getDay() 는 일요일이 0 이다. 월요일 시작으로 옮긴다
  const lead = (first.getDay() + 6) % 7;

  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= last.getDate(); d++) {
    cells.push({ day: d, key: dateKey(new Date(year, month - 1, d)) });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** 한 달 뒤/앞. 12월에서 넘어가는 것을 손으로 세지 않는다. */
export function shiftMonth(year, month, by) {
  const d = new Date(year, month - 1 + by, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** 그 날 기록에서 대표 부위 하나. 없으면 null. */
export function partOfDay(list) {
  if (!list || list.length === 0) return null;
  return partDistribution(list)[0]?.part || null;
}

/**
 * 그 달 요약.
 *
 * 볼륨은 무게를 적은 것만 센다 — 맨몸은 체중을 모른다 (이번 주 요약과 같은 이유).
 */
export function monthSummary(workouts, year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  const entries = Object.entries(workouts || {})
    .filter(([key, list]) => key.startsWith(prefix) && list && list.length > 0);

  let sets = 0;
  let kg = 0;
  let bodyweightSets = 0;
  const records = [];

  entries.forEach(([, list]) => {
    list.forEach(r => {
      const s = Number(r?.sets) || 0;
      const reps = Number(r?.reps) || 0;
      const w = parseWeight(r?.weight);
      sets += s;
      if (w === null) bodyweightSets += s;
      else kg += w * s * reps;
      records.push(r);
    });
  });

  return {
    days: entries.length,
    count: records.length,
    sets,
    volumeKg: Math.round(kg),
    bodyweightSets,
    parts: partDistribution(records),
  };
}

/** 운동 기록이 있는 달들 (최신순). 화살표로 텅 빈 달을 계속 넘기지 않게 쓴다. */
export function monthsWithRecords(workouts) {
  const set = new Set();
  Object.entries(workouts || {}).forEach(([key, list]) => {
    if (list && list.length > 0 && /^\d{4}-\d{2}-/.test(key)) set.add(key.slice(0, 7));
  });
  return [...set].sort().reverse();
}

export { bodyPartOf };
