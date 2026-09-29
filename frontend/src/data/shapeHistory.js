// 체형 읽기 04 — **지난 번과 견준다** (2026-09-29).
//
// 계획은 `docs/SHAPE-READ-2026-09-19.md`. 03 까지는 잰 값을 **한 칸**에만 두고
// 바로 앞의 것과 견줬다. 그러면 두 가지를 못 한다.
//
//   · **처음과 견주기** — 8주 전과 지금이 궁금한 사람에게 「지난 번」은 3일 전이다
//   · **각도가 달라진 것을 알아채기** — 견줄 것이 하나면 무엇이 흔들렸는지 모른다
//
// 그래서 여기서 **잰 값만 이력으로 쌓는다.** 사진은 안 쌓는다 — 체형 화면은 예전부터
// 사진을 들고 있지 않고(`ShapePage.jsx` 머리글), 04 도 그것을 안 바꾼다.
//
// ── 뼈는 안 변한다. 그래서 각도를 잡는 자가 된다 ──
//
// **상체:다리는 운동으로 안 달라진다** — 뼈 길이다. 그런데 사진에서는 달라진다.
// 카메라가 가까우면 가까운 쪽이 커지고(원근), 고개를 들거나 반걸음 물러서면 몸통과
// 다리가 다른 비율로 줄어든다. 그러니 **상체:다리가 달라졌다면 몸이 아니라 사진이
// 달라진 것이다.** 그때는 어깨:골반이 움직인 것도 믿을 수 없다 — 같은 사진이 만든
// 숫자이기 때문이다. 이것이 04 에서 새로 얻은 하나다.
//
// ── 겹쳐 찍은 것끼리가 아니면 단정을 안 올린다 ──
//
// 9/19 에 「같은 자리 · 같은 옷으로 찍은 것끼리 견준다 — 겹쳐 찍기가 이미 그 일을
// 한다」고 적었다. 04 가 그 두 기능을 잇는다. 골라 올린 사진은 그 보장이 없으므로
// **말은 하되 단정하지 않는다.**

/** 몇 개까지 들고 있나. 열둘이면 두 주에 한 번 찍어 반년이다. */
export const SHAPE_MAX = 12;

/** 상체:다리(뼈)가 이만큼 달라졌으면 **사진이 달라진 것**으로 본다. */
export const BONE_SURE = 0.08;

/**
 * 이력에 남길 것만 남긴다.
 *
 * `raw`(픽셀 길이)는 **안 남긴다.** 사진 크기에 딸린 값이라 다른 사진의 것과
 * 견줄 수가 없다 — 남겨두면 언젠가 그걸로 견주는 코드가 붙는다.
 */
export function slimShape(entry) {
  if (!entry) return null;
  const { date, shot, ok, facing, shoulderHip, torsoLeg, armLeg, shoulderTilt, hipTilt, sideGap } = entry;
  return {
    date, ok: !!ok, facing: facing ?? null,
    // 겹쳐 찍은 것인지. 예전에 쌓인 것은 모르므로 'pick' 으로 본다(단정에 안 쓴다)
    shot: shot === 'overlay' ? 'overlay' : 'pick',
    shoulderHip: shoulderHip ?? null,
    torsoLeg: torsoLeg ?? null,
    armLeg: armLeg ?? null,
    shoulderTilt: shoulderTilt ?? null,
    hipTilt: hipTilt ?? null,
    sideGap: sideGap ?? null,
  };
}

/**
 * 이력에 한 칸 더한다. 오래된 것이 앞, 새것이 뒤.
 *
 * **같은 날 다시 찍으면 덮는다.** 하루에 다섯 번 찍은 것이 다 쌓이면 「지난 번」이
 * 30분 전이 되어, 견줄 상대가 사실상 자기 자신이 된다.
 */
export function pushShape(list, entry) {
  const prevList = Array.isArray(list) ? list.filter((e) => e && e.date) : [];
  if (!entry || !entry.date) return prevList;
  const rest = prevList.filter((e) => e.date !== entry.date);
  const next = [...rest, slimShape(entry)].sort((a, b) => (a.date < b.date ? -1 : 1));
  // 넘치면 **오래된 것을 버린다**. 「처음」이 밀려나가지만, 반년 전 사진은 옷도
  // 자리도 달라서 견줄 상대로서 이미 못 믿는다
  return next.slice(-SHAPE_MAX);
}

/** 오늘 것은 빼고 본다 — 방금 올린 것과 자기 자신을 견주면 늘 「거의 같아요」다. */
const before = (list, today) =>
  (Array.isArray(list) ? list : []).filter((e) => e && e.date && (!today || e.date < today) && e.ok);

/** 바로 앞의 나. */
export function pickPrev(list, today) {
  const rows = before(list, today);
  return rows.length ? rows[rows.length - 1] : null;
}

/** 이력에 남은 가장 오래된 나. 하나뿐이면 「지난 번」과 같은 것이라 **안 준다.** */
export function pickFirst(list, today) {
  const rows = before(list, today);
  return rows.length >= 2 ? rows[0] : null;
}

/** 몇 번 찍었고 며칠에 걸쳤나. 화면이 「N번 · 처음은 …」 한 줄로 쓴다. */
export function shapeSpan(list, today) {
  const rows = (Array.isArray(list) ? list : []).filter((e) => e && e.date && e.ok);
  if (rows.length === 0) return { count: 0, first: null, last: null, days: null };
  const first = rows[0].date;
  const last = rows[rows.length - 1].date;
  return { count: rows.length, first, last, days: daysApart(first, today || last) };
}

export function daysApart(a, b) {
  if (!a || !b) return null;
  const ms = new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`);
  return Number.isFinite(ms) ? Math.round(ms / 86400000) : null;
}

/**
 * 사진이 달라진 것인가 — **뼈로 잰다.**
 *
 * 돌려주는 것: `{ delta, doubt }` · 둘 중 하나라도 상체:다리를 못 쟀으면 `null`.
 * `doubt` 가 참이면 **다른 비율의 변화도 단정에 쓰지 않는다.**
 */
export function angleMoved(now, prev) {
  const a = now?.torsoLeg;
  const b = prev?.torsoLeg;
  if (a === null || a === undefined || b === null || b === undefined) return null;
  const delta = Math.round((a - b) * 100) / 100;
  return { delta, doubt: Math.abs(delta) >= BONE_SURE };
}

/** 둘 다 겹쳐 찍은 것인가. 이것이 참일 때만 단정을 올린다. */
export function sameSetup(now, prev) {
  return now?.shot === 'overlay' && prev?.shot === 'overlay';
}
