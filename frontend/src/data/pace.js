// 운동이 늘어지는가 — **기록을 남긴 시각으로 잰다.**
//
// 결산이 「오늘 12,480kg」이라고 말해주지만, 그 무게를 **한 시간에 들었는지 두 시간에
// 들었는지**는 아무 데도 없다. 헬스장에서 보낸 시간의 절반이 폰을 보는 시간이라는 것은
// 스스로 못 본다 — 세트를 하는 동안은 늘 바쁘게 느껴지기 때문이다.
//
// **재는 것은 세트 사이가 아니라 기록 사이다.** 기록은 운동 하나를 마칠 때 남기므로
// (`created_at`), 우리가 아는 것은 「벤치를 끝낸 시각」과 「그다음 운동을 끝낸 시각」
// 사이다. 세트 하나하나의 휴식이 아니다. **화면에서도 그렇게 적는다** — 「세트 사이
// 휴식 4분」이라고 하면 재지 않은 것을 잰 척하는 것이다.
//
// **못 재는 날이 많다. 그때는 아무 말도 안 한다.**
//   · 기록이 둘 이하 — 사이가 하나뿐이라 그날의 속도라 할 수 없다
//   · 다 끝내고 한꺼번에 적은 날 — 시각이 몇 분 안에 몰려 있다. 그날은 시간이 0에
//     가깝게 나오는데, 「10분 만에 운동을 끝냈다」는 명백한 거짓말이다
//
// **중앙값으로 본다.** 평균은 한 번 자리를 비운 30분에 통째로 끌려간다. 중앙값은
// 「보통 이만큼 쉰다」에 가깝고, 오래 비운 것은 따로 「제일 길게 쉰 것」으로 적는다.

/** 이 아래로 몰려 있으면 한꺼번에 적은 날로 본다 (분) */
const MIN_SPAN = 10;
/** 그날의 속도라 말하려면 이만큼은 있어야 한다 */
const MIN_RECORDS = 3;
/** 평소를 셀 때 거슬러 보는 날 수 */
const BASELINE_DAYS = 28;
/** 평소라고 말하려면 잴 수 있는 날이 이만큼은 있어야 한다 */
const MIN_BASELINE_DAYS = 3;

const at = (r) => {
  const t = new Date(r?.created_at || 0).getTime();
  return Number.isFinite(t) && t > 0 ? t : null;
};

/** 가운데 값. 짝수면 가운데 둘의 평균 */
export function median(nums) {
  const xs = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const m = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[m] : Math.round((xs[m - 1] + xs[m]) / 2);
}

/**
 * 하루치 속도.
 *
 * 돌려주는 것 (못 재는 날이면 `usable: false` 와 `why`):
 *   spanMs    첫 기록 ~ 마지막 기록
 *   gaps      기록 사이 간격들 (ms)
 *   medianMs  그 간격의 중앙값 — 「보통 이만큼」
 *   longestMs 제일 길게 비운 것
 *   count     기록 수
 */
export function paceOf(list) {
  const stamps = (list || []).map(at).filter((t) => t !== null).sort((a, b) => a - b);
  if (stamps.length < MIN_RECORDS) return { usable: false, why: 'few', count: stamps.length };

  const spanMs = stamps[stamps.length - 1] - stamps[0];
  if (spanMs < MIN_SPAN * 60000) return { usable: false, why: 'batched', count: stamps.length, spanMs };

  const gaps = [];
  for (let i = 1; i < stamps.length; i += 1) gaps.push(stamps[i] - stamps[i - 1]);

  return {
    usable: true,
    count: stamps.length,
    spanMs,
    gaps,
    medianMs: median(gaps),
    longestMs: Math.max(...gaps),
  };
}

/**
 * 평소. **오늘은 빼고** 지난 4주 중 잴 수 있었던 날들의 중앙값을 다시 중앙값 낸다.
 *
 * 오늘을 넣으면 오늘이 평소를 끌어당겨, 늘어진 날일수록 「평소와 비슷하다」가 된다.
 * 잴 수 있는 날이 셋 미만이면 **평소가 없다고 답한다** — 이틀치로 「평소」를 말하면
 * 그날 하루가 곧 기준이 된다.
 */
export function baselineOf(workouts, today) {
  const end = new Date(`${today}T00:00:00`);
  if (Number.isNaN(end.getTime())) return null;

  const mids = [];
  for (let i = 1; i <= BASELINE_DAYS; i += 1) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const p = (n) => String(n).padStart(2, '0');
    const key = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    const list = (workouts || {})[key];
    if (!Array.isArray(list) || list.length === 0) continue;
    const pace = paceOf(list);
    if (pace.usable) mids.push(pace.medianMs);
  }

  if (mids.length < MIN_BASELINE_DAYS) return null;
  return { medianMs: median(mids), days: mids.length };
}

/**
 * 오늘과 평소를 견준다.
 *
 * **좋다 나쁘다를 매기지 않는다.** 길게 쉬는 날이 있다 — 고중량을 하는 날이 그렇고,
 * 아픈 날도 그렇다. 우리가 아는 것은 「평소보다 길다」까지다.
 */
export function buildPace(workouts, today) {
  const pace = paceOf((workouts || {})[today] || []);
  if (!pace.usable) return pace;

  const base = baselineOf(workouts, today);
  return {
    ...pace,
    baselineMs: base ? base.medianMs : null,
    baselineDays: base ? base.days : 0,
    // 평소보다 얼마나 더(또는 덜) 쉬었나. 평소가 없으면 null
    deltaMs: base ? pace.medianMs - base.medianMs : null,
  };
}

/** 분·초로 적는다. 1분 미만은 초로만 */
export function shortTime(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `${m}분 ${rest}초` : `${m}분`;
}

/** 오래 걸린 것은 시간으로. 「1시간 12분」 */
export function longTime(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '';
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}시간 ${rest}분` : `${h}시간`;
}
