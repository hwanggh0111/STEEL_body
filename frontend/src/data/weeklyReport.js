// 이번 주 요약.
//
// 히스토리는 달력이라 「했다 / 안 했다」만 보인다. 얼마나 했는지, 지난주보다 나은지는
// 아무도 말해주지 않았다. 서버에 이미 쌓인 기록을 세기만 하면 되는 일이다.
//
// 한 주는 **월요일에 시작한다** (앱의 다른 곳과 같다 — HomePage 의 주간 달력).

import { dateKey } from './dateKey';
// 유산소는 볼륨에 들 수 없다 — 시간 · 거리로 센다 (2026-11-05)
import { isCardioRow, cardioOf } from './cardio';
import { parseWeight } from './personalRecord';
import { partDistribution } from './bodyPart';
import { i } from './particle';

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

// ── **앞날은 안 센다** ── (2026-11-05)
//
// 서버는 기록 날짜를 **하루 넉넉하게** 받는다 — 시차와 자정 무렵을 위해 일부러
// 그렇게 뒀다(`utils/dayRange.js`). 그래서 **내일 날짜 줄이 실제로 들어온다.**
//
// 몸 지도(`bodyHeat`) · 체형(`shapeRead`) · 최고 기록(`personalRecord`) · 서버의
// 부위 계산은 전부 `date > today` 를 건너뛰는데 **이 파일과 달 요약 · 목표에만
// 그 줄이 없었다** — 9/30 에 최고 기록에서 똑같이 빠뜨렸던 자리다.
//
// 그러면 **아직 하지도 않은 운동이 이번 주에 들어간다**: 목요일에 「운동한 날 4일」
// 이라고 적히고(토요일 줄이 들어 있다) 볼륨도 미리 더해진다.
const upto = (keys, today) => (today ? keys.filter((k) => k <= today) : keys);

/** 한 주의 기록을 한 줄로 편다. **앞날은 뺀다.** */
function flatWeek(workouts, keys, today) {
  return upto(keys, today).flatMap(k => listOf(workouts, k));
}

/** 운동한 날 수. **앞날은 뺀다.** */
function doneDays(workouts, keys, today) {
  return upto(keys, today).filter(k => listOf(workouts, k).length > 0).length;
}

/**
 * 총 볼륨 (kg). 무게 × 세트 × 횟수를 더한다.
 *
 * **맨몸 운동은 못 센다.** 체중을 모르기 때문이다 — 인바디 체중을 끌어다 쓰면
 * 체중을 안 적은 사람은 0이 되고, 적은 사람은 어느 날 체중으로 셀지가 또 문제가 된다.
 * 그래서 무게를 적은 것만 세고, 맨몸이 섞여 있으면 화면에서 그렇다고 밝힌다.
 */
export function volumeOf(records) {
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

/**
 * 이번 주를 포함해 거슬러 올라가며 운동이 있는 주가 몇 주 이어졌나.
 *
 * 한 주씩 거슬러 가며 7일을 다시 만들어 보면, 기록이 없는 사람도 5년치(260주 × 7일)를
 * 헛돈다. 운동한 날을 **주 단위로 한 번 접어두고** 이어지는 만큼만 센다.
 */
function streakWeeks(workouts, monday, today) {
  const weeks = new Set();
  Object.entries(workouts || {}).forEach(([key, list]) => {
    if (!list || list.length === 0) return;
    // 앞날 줄로 주를 세우지 않는다 — 내일 것을 적어두면 **이어온 주가 하나 늘어난다**
    if (today && key > today) return;
    const d = new Date(`${key}T00:00:00`);
    if (Number.isNaN(d.getTime())) return;
    weeks.add(dateKey(mondayOf(d)));
  });

  // **이번 주는 아직 안 끝났다.** 지금 비어 있다고 해서 끊긴 것이 아니다.
  //
  // 이번 주부터 세면 월요일 0시에 「10주 연속」이 **0** 이 됐다가, 그 주 첫 기록에
  // 11 로 돌아왔다. 이어온 것을 지키라고 있는 숫자가 주가 바뀔 때마다 먼저 사라져서,
  // 화면은 한 주의 앞부분 내내 「이미 끊겼다」고 말하고 있었다.
  //
  // 이번 주에 기록이 있으면 이번 주부터, 없으면 지난주부터 센다.
  // 그 주가 기록 없이 끝나면 다음 월요일에 0 이 된다 — 그때는 정말 끊긴 것이다.
  const cur = new Date(monday);
  if (!weeks.has(dateKey(cur))) cur.setDate(cur.getDate() - 7);

  let n = 0;
  while (weeks.has(dateKey(cur))) {
    n += 1;
    cur.setDate(cur.getDate() - 7);
  }
  return n;
}

/**
 * 할 말을 고른다. 최대 두 줄.
 *
 * **없는 말을 지어내지 않는다.** 기록이 적으면 할 말이 없는 게 맞다 —
 * 빈 주에 「좋아요!」 같은 말을 붙이면 그건 응원이 아니라 소음이다.
 */
function notesOf({ prevDays, parts, prevParts, daysDone }) {
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
    // 「등가」가 아니라 「등이」. 두 개를 나열하면 뒤엣것에 맞춘다
    const parts2 = missing.slice(0, 2);
    notes.push(`${i(parts2.join(' · '))} 2주째 없어요.`);
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

  // **오늘**이 기준이다 — 이 뒤로는 아직 한 것이 아니다 (위 `upto` 머리글)
  const today = dateKey(ref);

  const records = flatWeek(workouts, keys, today);
  const prevRecords = flatWeek(workouts, prevKeys, today);

  const daysDone = doneDays(workouts, keys, today);
  const prevDays = doneDays(workouts, prevKeys, today);
  const parts = partDistribution(records);
  const prevParts = partDistribution(prevRecords);
  // 이번 주 유산소 (2026-11-05) — **볼륨에 들 수 없는 것**이다. 유산소만 한 주에
  // 「총 볼륨 0kg」을 큰 수로 띄우면 매일 뛴 사람에게 아무것도 안 했다고 말하는 셈이다
  // (운동 끝 결산 · 홈의 오늘 카드와 **같은 가족의 잘못**이다)
  const cardio = records.reduce((a2, r) => {
    if (!isCardioRow(r)) return a2;
    const c = cardioOf(r);
    return { count: a2.count + 1, minutes: a2.minutes + (c.minutes || 0), km: a2.km + (c.km || 0) };
  }, { count: 0, minutes: 0, km: 0 });

  const days = keys.map(key => {
    // 달력 줄은 **적힌 그대로** 보여준다(앞날에 적어둔 것도 그 자리에 있다) —
    // 세는 수만 오늘까지다
    const list = listOf(workouts, key);
    const top = partDistribution(list)[0];
    return { key, done: list.length > 0, part: top?.part || null };
  });

  // 지난 네 주 (이번 주가 맨 오른쪽)
  const last4 = [3, 2, 1, 0].map(i => {
    const m = weekAgo(monday, i);
    return { from: dateKey(m), days: doneDays(workouts, weekKeys(m), today), current: i === 0 };
  });

  return {
    cardio: { ...cardio, km: Number(cardio.km.toFixed(2)) },
    from: keys[0],
    to: keys[6],
    days,
    daysDone,
    prevDays,
    volume: volumeOf(records),
    streak: streakWeeks(workouts, monday, today),
    parts,
    last4,
    notes: notesOf({ prevDays, parts, prevParts, daysDone }),
    empty: records.length === 0 && prevRecords.length === 0,
  };
}
