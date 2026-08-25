// 이번 주 요약.
//
// 히스토리는 달력이라 「했다 / 안 했다」만 보인다. 얼마나 했는지, 지난주보다 나은지는
// 아무도 말해주지 않았다. 서버에 이미 쌓인 기록을 세기만 하면 되는 일이다.
//
// 한 주는 **월요일에 시작한다** (앱의 다른 곳과 같다 — HomePage 의 주간 달력, MissionSystem).

import { dateKey } from './dateKey';
import { parseWeight } from './personalRecord';
import { partDistribution } from './bodyPart';

/** 그 날이 속한 주의 월요일. Date 를 돌려준다. */
export function mondayOf(d = new Date()) {
  const base = new Date(d);
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() - ((base.getDay() + 6) % 7));
  return base;
}

/** 월요일부터 7일치 'YYYY-MM-DD'. */
export function weekKeys(monday) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return dateKey(d);
  });
}

function weekAgo(monday, n) {
  const d = new Date(monday);
  d.setDate(monday.getDate() - 7 * n);
  return d;
}

const listOf = (workouts, key) => (workouts?.[key] || []);

/** 한 주의 기록을 한 줄로 편다. */
function flatWeek(workouts, keys) {
  return keys.flatMap(k => listOf(workouts, k));
}

/** 운동한 날 수. */
function doneDays(workouts, keys) {
  return keys.filter(k => listOf(workouts, k).length > 0).length;
}

/**
 * 총 볼륨 (kg). 무게 × 세트 × 횟수를 더한다.
 *
 * **맨몸 운동은 못 센다.** 체중을 모르기 때문이다 — 인바디 체중을 끌어다 쓰면
 * 체중을 안 적은 사람은 0이 되고, 적은 사람은 어느 날 체중으로 셀지가 또 문제가 된다.
 * 그래서 무게를 적은 것만 세고, 맨몸이 섞여 있으면 화면에서 그렇다고 밝힌다.
 */
function volumeOf(records) {
  let kg = 0;
  let bodyweightSets = 0;
  records.forEach(r => {
    const sets = Number(r?.sets) || 0;
    const reps = Number(r?.reps) || 0;
    const w = parseWeight(r?.weight);
    if (w === null) { bodyweightSets += sets; return; }
    kg += w * sets * reps;
  });
  return { kg: Math.round(kg), bodyweightSets };
}

/** 이번 주를 포함해 거슬러 올라가며 운동이 있는 주가 몇 주 이어졌나. */
function streakWeeks(workouts, monday) {
  let n = 0;
  for (let i = 0; i < 260; i++) {          // 5년치에서 멈춘다. 무한히 거슬러 갈 이유가 없다
    const keys = weekKeys(weekAgo(monday, i));
    if (doneDays(workouts, keys) === 0) break;
    n++;
  }
  return n;
}

/**
 * 할 말을 고른다. 최대 두 줄.
 *
 * **없는 말을 지어내지 않는다.** 기록이 적으면 할 말이 없는 게 맞다 —
 * 빈 주에 「좋아요!」 같은 말을 붙이면 그건 응원이 아니라 소음이다.
 */
function notesOf({ days, prevDays, parts, prevParts, daysDone }) {
  const notes = [];

  if (daysDone === 0) {
    notes.push('이번 주는 아직 기록이 없어요.');
    return notes;
  }

  const diff = daysDone - prevDays;
  if (diff > 0) notes.push(`지난주보다 ${diff}일 더 나왔어요.`);
  else if (diff < 0) notes.push(`지난주보다 ${-diff}일 적어요.`);

  // 두 주 내리 한 번도 안 한 부위. 이번 주에 다른 부위를 했을 때만 말이 된다
  const didThis = new Set(parts.map(p => p.part));
  const didPrev = new Set(prevParts.map(p => p.part));
  const missing = ['하체', '등', '가슴', '어깨'].filter(p => !didThis.has(p) && !didPrev.has(p));
  if (missing.length && notes.length < 2) {
    notes.push(`${missing.slice(0, 2).join(' · ')}가 2주째 없어요.`);
  }

  return notes.slice(0, 2);
}

/**
 * 이번 주 요약을 만든다.
 *
 * workouts 는 { 'YYYY-MM-DD': [기록] } (workoutStore 와 같다).
 * ref 를 주면 그 날이 속한 주를 센다 (검사용).
 */
export function buildWeekly(workouts, ref = new Date()) {
  const monday = mondayOf(ref);
  const keys = weekKeys(monday);
  const prevKeys = weekKeys(weekAgo(monday, 1));

  const records = flatWeek(workouts, keys);
  const prevRecords = flatWeek(workouts, prevKeys);

  const daysDone = doneDays(workouts, keys);
  const prevDays = doneDays(workouts, prevKeys);
  const parts = partDistribution(records);
  const prevParts = partDistribution(prevRecords);

  const days = keys.map(key => {
    const list = listOf(workouts, key);
    const top = partDistribution(list)[0];
    return { key, done: list.length > 0, part: top?.part || null };
  });

  // 지난 네 주 (이번 주가 맨 오른쪽)
  const last4 = [3, 2, 1, 0].map(i => {
    const m = weekAgo(monday, i);
    return { from: dateKey(m), days: doneDays(workouts, weekKeys(m)), current: i === 0 };
  });

  return {
    from: keys[0],
    to: keys[6],
    days,
    daysDone,
    prevDays,
    volume: volumeOf(records),
    streak: streakWeeks(workouts, monday),
    parts,
    last4,
    notes: notesOf({ days, prevDays, parts, prevParts, daysDone }),
    empty: records.length === 0 && prevRecords.length === 0,
  };
}
