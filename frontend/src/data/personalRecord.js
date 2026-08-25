// 최고 기록(PR) 판정.
//
// 기록을 쌓기만 하고 「늘었다」고 말해주는 데가 없었다. 저장할 때 한 번 견줘서
// 자기 최고를 넘었으면 그 자리에서 짚어준다.
//
// 무게만 보면 틀린다 — 70kg 12회가 80kg 5회보다 셀 수 있다. 그래서 1RM 으로 환산해 견준다.
// 식은 측정 시스템의 1RM 계산기(components/measure/OneRMSection.jsx)와 같은 것을 쓴다.

// 무게는 자유 입력이다 ('60' · '60kg' · '20kg 양쪽' · '맨몸').
// 문자열에서 처음 나오는 수를 무게로 읽고, 수가 없으면 맨몸으로 친다.
export function parseWeight(raw) {
  if (raw === null || raw === undefined) return null;
  const m = String(raw).match(/\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Brzycki. 37 - reps 가 분모라 36회까지만 성립한다.
export const RM_MAX_REPS = 36;

export function estimate1RM(weight, reps) {
  const w = Number(weight);
  const r = Number(reps);
  if (!Number.isFinite(w) || !Number.isFinite(r)) return null;
  if (w <= 0 || r < 1 || r > RM_MAX_REPS) return null;
  return r === 1 ? w : Math.round(w * (36 / (37 - r)));
}

/**
 * 기록 하나의 '세기'.
 *
 * 무게가 있으면 1RM 환산값, 맨몸이면 횟수로 센다. 둘은 서로 견주지 않는다 —
 * 맨몸 푸시업 50회와 벤치 80kg 을 한 자에 올릴 방법이 없다.
 *
 * 무게가 있는데 횟수가 36을 넘으면 Brzycki 가 성립하지 않는다. 그때는 무게만 본다
 * (그 구간에서 1RM 환산은 어차피 의미가 없다).
 */
export function strengthOf(record) {
  const kg = parseWeight(record?.weight);
  const reps = Number(record?.reps) || 0;
  if (kg === null) return { kind: 'bodyweight', score: reps, kg: null, reps };
  const orm = estimate1RM(kg, reps);
  return { kind: 'weighted', score: orm ?? kg, kg, reps };
}

function toEntry(record, date, s) {
  return {
    exercise: (record.exercise || '').trim(),
    kind: s.kind,
    score: s.score,
    kg: s.kg,
    reps: s.reps,
    sets: Number(record.sets) || 0,
    weight: record.weight,
    date: date || record.date || '',
    id: record.id,
  };
}

/**
 * 종목별 최고 기록.
 *
 * workouts 는 { 'YYYY-MM-DD': [기록, ...] } 모양이다 (workoutStore 와 같다).
 * 같은 점수가 두 번 나오면 **먼저 세운 날**을 최고로 둔다 — 같은 무게를 또 든 것은
 * 경신이 아니라서, 나중 것을 최고로 잡으면 날짜만 계속 오늘로 밀린다.
 */
export function bestRecords(workouts) {
  const best = new Map();
  Object.entries(workouts || {}).forEach(([date, list]) => {
    (list || []).forEach(record => {
      const name = (record?.exercise || '').trim();
      if (!name) return;
      const s = strengthOf(record);
      if (!s.score) return;
      const key = `${name}::${s.kind}`;
      const cur = best.get(key);
      if (!cur || s.score > cur.score || (s.score === cur.score && date < cur.date)) {
        best.set(key, toEntry(record, date, s));
      }
    });
  });
  return best;
}

/**
 * 방금 넣은 기록이 최고를 넘었나.
 *
 * before 는 **저장하기 전** 의 bestRecords 여야 한다. 저장한 뒤에 부르면 방금 것이
 * 이미 들어 있어서 무엇을 넣어도 경신이 아니게 된다.
 *
 * 넘었으면 { entry, prev } 를, 아니면 null 을 돌려준다. prev 는 첫 기록일 때 null 이다.
 */
export function checkRecord(before, record) {
  const name = (record?.exercise || '').trim();
  if (!name) return null;
  const s = strengthOf(record);
  if (!s.score) return null;

  const prev = (before instanceof Map) ? before.get(`${name}::${s.kind}`) : null;
  if (prev && s.score <= prev.score) return null;

  return { entry: toEntry(record, record.date, s), prev: prev || null };
}

/** 종목별 최고 기록을 세운 날 최신순으로. */
export function bestList(workouts) {
  return [...bestRecords(workouts).values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** 'YYYY-MM-DD' 두 개 사이의 날 수. 어느 쪽이 앞이든 0 이상을 돌려준다. */
export function daysBetween(a, b) {
  if (!a || !b) return null;
  const ms = Math.abs(new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`));
  return Number.isFinite(ms) ? Math.round(ms / 86400000) : null;
}
