// **되돌리기 — 지운 줄을 그대로 다시 올리고, 고친 값을 옛 값으로 되돌린다** (2026-11-11).
//
// ── 왜 ──
//
// 지우는 쪽은 사람에게 **「되돌릴 수 없습니다」**라고 정직하게 말해왔다. 정직한데
// 아프다 — `db.js:945` 의 `deleteWorkout` 은 `splice` 로 줄을 **바로 지운다**
// (`deleted_at` 이 없다). 고치는 쪽은 그 말조차 없었다: 90 을 910 으로 잘못 치고
// 저장하면 **옛 값이 사라지고** 원래 뭐였는지 아무도 모른다.
//
// 그래서 **서버 칸을 하나도 늘리지 않고** 되돌린다 — 출시가 43일 앞이라 스키마를
// 건드리지 않는 것이 선이다(11/11 판정).
//
//   고친 것 → 고치기 **전의 줄**을 들고 있다가 그 몸통으로 다시 `PUT`
//   지운 것 → 지운 **줄 전체**를 들고 있다가 그 몸통으로 다시 `POST`
//
// ── 정직하게 적어둘 것 둘 ──
//
// ⑴ 되살린 줄은 **`id` 와 적은 시각이 새것**이다. 서버가 새로 매긴다. 기록의 값
//    (날짜 · 운동 · 무게 · 세트 · 횟수)은 같지만, **적은 시각으로 재는 것**
//    (판에 걸린 시간 · 세트 사이 쉼)은 되살린 뒤 달라진다. 그것까지 되돌리려면
//    `created_at` 을 받는 칸이 필요하고, 그건 스키마 일이다.
// ⑵ **몇 초 안에 눌러야 한다.** 토스트가 사라지면 그 줄은 다시 없어진 것이다 —
//    「영구 보관함」이 아니다. 화면이 그렇게 말해야 한다.
//
// 이 파일은 **무엇을 다시 보낼 것인가**만 안다. 언제 보여줄지는 화면이 정한다.
// `npm run undo` 가 값으로 본다.

/** 유산소 줄인가 — 시간이나 거리가 적힌 줄이다 (`data/cardio.js` 와 같은 선) */
function isCardio(row) {
  return row?.minutes != null || row?.distance_km != null || row?.distanceKm != null;
}

/** 양의 정수만. 0 · 빈 값 · 소수는 세트·횟수가 아니다 */
function posInt(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** 숫자이거나 null. `0분`·`0km` 은 적힌 값이라 그대로 지킨다 */
function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * 그 줄을 **서버가 받는 몸통**으로 바꾼다 (되돌릴 때 그대로 보낸다).
 *
 * 돌려주는 것 — 보낼 수 있으면 몸통, **못 보낼 줄이면 `null`**
 * (날짜나 운동 이름이 없는 줄. 그런 줄은 서버가 400 으로 막는다 —
 * 되돌리기 단추를 보여줬는데 눌러서 실패하는 것이 더 나쁘다).
 *
 * ★ **두 모양을 섞지 않는다.** 유산소 줄에 세트·횟수를 같이 담으면 읽는 쪽마다
 * 다른 것을 보고 다른 말을 한다(`TrainPage` 의 저장 자리에 적힌 그 규칙 · 서버도
 * 같은 자로 막는다). 그래서 유산소는 **시간·거리만**, 근력은 **무게·세트·횟수만**이다.
 *
 * `id` · `user_id` · `created_at` · 딱지는 **안 보낸다** — 서버가 매기는 것이다.
 */
export function rowPayload(row) {
  const date = String(row?.date ?? '').trim();
  const exercise = String(row?.exercise ?? '').trim();
  if (!date || !exercise) return null;

  const body = { date, exercise };
  if (isCardio(row)) {
    body.minutes = numOrNull(row.minutes);
    body.distance_km = numOrNull(row.distance_km ?? row.distanceKm);
  } else {
    // 무게는 **글자 그대로** 보낸다 — '맨몸' · '밴드' · '20kg' 이 다 들어오는 칸이다
    body.weight = row?.weight == null ? '' : String(row.weight);
    body.sets = posInt(row?.sets);
    body.reps = posInt(row?.reps);
  }
  // 이어가기 표시는 지킨다 — 없으면 그 줄이 「이어 한 세트」인 것을 잃는다
  if (row?.link) body.link = String(row.link);
  return body;
}

/**
 * 고치기 **전과 후**가 실제로 다른가.
 *
 * 같으면 되돌릴 것이 없다 — **단추를 보여주지 않는다**(눌러도 아무 일이 안 일어나는
 * 단추는 거짓이다). 적은 칸만 견준다(`rowPayload` 가 고른 칸).
 */
export function changed(before, after) {
  const a = rowPayload(before);
  const b = rowPayload(after);
  if (!a || !b) return false;
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  return keys.some((k) => String(a[k] ?? '') !== String(b[k] ?? ''));
}

/**
 * 날짜별 표(`workouts`)에서 **`id` 로 줄을 찾는다.**
 *
 * 고치기 전 값을 들고 있으려면 **고치기 전에** 이 줄을 떠야 한다 — 고친 뒤에 찾으면
 * 이미 새 값이다. 화면이 그 순서를 지킨다(`TrainPage` 의 저장 자리).
 */
export function rowById(workouts, id) {
  if (!workouts || id == null) return null;
  for (const list of Object.values(workouts)) {
    for (const w of list || []) if (String(w?.id) === String(id)) return w;
  }
  return null;
}

// ── 인바디 줄 ── (2026-11-11)
//
// ★ **여기가 더 아프다.** 체중 90 을 910 으로 치면 운동 한 줄과 달리 **그림 전체가
// 거짓말**을 한다 — 체중 추이 · 몸 변화 · 체성분 · 제자리가 다 그 값을 본다.
// 서버가 받는 칸은 여섯이다 (`routes/inbody.js:22`).
//
// ★ 그리고 **되살린 날짜가 바뀔 수 있다**: 서버는 적을 수 없는 날짜(앞날 · 1026년)를
// 거절하지 않고 **오늘로 적는다**(`dateFixed`). 화면이 그 말을 전하는 자리가 이미
// 있으니, 되살릴 때도 같은 말을 전해야 한다 — 「되살렸어요」만 띄우면 **날짜가 다른
// 줄**을 되살린 것이 된다.
const INBODY_NUM = ['height', 'weight', 'fat_pct', 'muscle_kg', 'water_l'];

/**
 * 인바디 한 줄을 **서버가 받는 몸통**으로.
 *
 * 돌려주는 것 — 보낼 수 있으면 몸통, **체중이 없으면 `null`**(서버가 400 으로 막는
 * 유일한 필수 칸이다 · 「체중은 필수에요」).
 */
export function inbodyPayload(row) {
  const date = String(row?.date ?? '').trim();
  const weight = numOrNull(row?.weight);
  if (!date || weight === null) return null;
  const body = { date };
  for (const k of INBODY_NUM) body[k] = numOrNull(row?.[k]);
  return body;
}

/** 인바디 줄이 실제로 달라졌는가 (적는 칸만 견준다) */
export function inbodyChanged(before, after) {
  const a = inbodyPayload(before);
  const b = inbodyPayload(after);
  if (!a || !b) return false;
  return ['date', ...INBODY_NUM].some((k) => String(a[k] ?? '') !== String(b[k] ?? ''));
}

/** 평평한 목록(`records`)에서 `id` 로 줄을 찾는다 */
export function recordById(records, id) {
  if (!Array.isArray(records) || id == null) return null;
  return records.find((r) => String(r?.id) === String(id)) || null;
}

// ── 측정 줄 ── (2026-11-11)
//
// 측정은 **고치는 길이 없다** — 지우고 다시 적는다. 그래서 되돌릴 것은 **지우기**
// 하나인데, 그 하나가 인바디와 같은 무게다: 둘레·어깨·유연성은 **선으로 그려지는
// 수**라 한 점이 사라지면 선이 휜다.
//
// 서버가 받는 칸은 셋이다 — `type` · `date` · `data`(갈래마다 다른 꾸러미 ·
// `routes/measures.js:32`). **`data` 는 통째로 그대로 돌려보낸다** — **담기는 갈래가
// 여섯**이고(서버 `VALID_TYPES`. 화면 칸은 일곱인데 「심박수 존」은 계산기라 안 담는다)
// (전신 사이즈 · 1RM · 체력 · 유연성 · 어깨 · 스톱워치) 그 안의 칸을 여기서 다시
// 세면 **갈래가 하나 늘 때마다 이 자리가 틀린다**.
const MEASURE_TYPES = ['bodySize', 'oneRM', 'fitness', 'flexibility', 'shoulder', 'stopwatch'];

/**
 * 측정 한 줄을 **서버가 받는 몸통**으로.
 *
 * 돌려주는 것 — 보낼 수 있으면 `{ type, date, data }`, **아니면 `null`**
 * (갈래가 서버 목록에 없거나 · 날짜가 없거나 · 꾸러미가 없는 줄. 서버가 400 으로
 * 막는 그 셋을 여기서 그대로 본다 — 눌러서 실패하는 단추를 보여주지 않는다).
 */
export function measurePayload(row) {
  const type = String(row?.type ?? '').trim();
  const date = String(row?.date ?? '').trim();
  const data = row?.data;
  if (!MEASURE_TYPES.includes(type)) return null;
  if (!date || !data || typeof data !== 'object' || Array.isArray(data)) return null;
  return { type, date, data };
}

// ── 내 루틴 ── (2026-11-11)
//
// 루틴은 **사람이 공들여 짠 것**이다. 지우면 다시 짜야 한다 — 수가 틀리는 것이
// 아니라 **시간이 사라진다.** 서버가 받는 칸은 둘이다 (`name` · `exercises` ·
// `routes/myRoutines.js:36`).
//
// ★ **운동 목록은 통째로 그대로 돌려보낸다.** 줄이 글자일 수도 있고 꾸러미일 수도
// 있다(`typeof e === 'string' ? e : e?.name` 을 화면이 그렇게 읽는다) — 여기서 모양을
// 바꾸면 되살린 루틴이 **원래와 다른 루틴**이 된다.

/**
 * 내 루틴 한 줄을 **서버가 받는 몸통**으로.
 *
 * 돌려주는 것 — 보낼 수 있으면 `{ name, exercises }`, **이름이 없거나 운동이 없으면
 * `null`**(서버가 막는 자리다 · 빈 루틴을 되살려 놓는 것도 뜻이 없다).
 */
export function routinePayload(row) {
  const name = String(row?.name ?? '').trim();
  const exercises = Array.isArray(row?.exercises) ? row.exercises : null;
  if (!name || !exercises || exercises.length === 0) return null;
  return { name, exercises };
}

/** 루틴이 실제로 달라졌는가 — 이름과 **운동 목록 전체**를 견준다 */
export function routineChanged(before, after) {
  const a = routinePayload(before);
  const b = routinePayload(after);
  if (!a || !b) return false;
  return a.name !== b.name || JSON.stringify(a.exercises) !== JSON.stringify(b.exercises);
}

/** 되돌리기 단추가 떠 있는 시간(ms). 보통 토스트(4초)보다 길게 둔다 */
export const UNDO_MS = 8000;
