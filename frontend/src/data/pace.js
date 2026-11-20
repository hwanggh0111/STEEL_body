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
export const BASELINE_DAYS = 28;
/** 평소라고 말하려면 잴 수 있는 날이 이만큼은 있어야 한다 */
const MIN_BASELINE_DAYS = 3;

// 두 날짜 사이의 날 수 (2026-11-19). **새로 세지 않는다** — `npm run daygap` 이
// 「날짜를 밀리초로 세는 자리」가 새로 생기는 것을 막는다(내가 거기 걸렸다).
// 그 손은 날짜 키를 **한낮으로** 읽는다 — 자정은 서머타임이 자정에 시작하는 곳에서
// 없는 시각이라 하루가 어긋난다
import { daysBetween } from './personalRecord';
// 운동 이름을 견주는 식 — 이 앱에 하나뿐이다
import { flatName } from './flatName';

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
  // **모양을 믿지 않는다** — 날짜 칸에 배열이 아닌 것이 들어오면 `.map` 에서 터진다.
  // 이 파일 101행이 이미 `Array.isArray` 로 막고 있었는데 여기만 약했다 (2026-11-19 · 정석 2차)
  const stamps = (Array.isArray(list) ? list : []).map(at).filter((t) => t !== null).sort((a, b) => a - b);
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
  // **날짜 키는 한낮으로 읽는다** (2026-11-17) — 자정은 서머타임이 자정에 시작하는
  // 곳에서 **없는 시각**이라 기기가 한 시간을 밀고, 그 바람에 날짜와 일수가 하루
  // 어긋난다. 날짜만 쓰는 자리는 다 한낮이다 (`dateKey.atDay` 와 같은 선)
  const end = new Date(`${today}T12:00:00`);
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

/**
 * **그 운동에서 평소 이만큼 쉬었다** (2026-11-19 · 시안 1119 ② · 맵시 요청).
 *
 * ── 왜 따로 재나 ──
 *
 * 위 `baselineOf` 가 주는 것은 **하루치 전체 간격**의 중앙값이다. 그 수로 「스쿼트에서
 * 평소 2분 50초」라고 적으면 **사실이 아닌 것을 사실처럼** 적는 것이다 — 그날에는 컬도
 * 있었고 유산소도 있었다. 맵시가 그것을 보고 **붙이지 않고 넘겼다.** 맞는 판단이다.
 *
 * 그래서 **그 운동 줄끼리의 간격만** 센다. 한 운동의 세트 사이가 곧 그 운동의 휴식이다.
 *
 * ── 모르면 모른다고 한다 ──
 *
 * 간격이 **셋 미만**이면 `null` 이다(`baselineOf` 가 날 셋을 요구하는 것과 같은 선).
 * 두 번 쉬어본 것으로 「평소」라고 말하지 않는다. **화면은 `null` 이면 그 줄을 안 그린다.**
 *
 * ── 권하지 않는다 ──
 *
 * 이 수는 **사실 한 줄**로만 쓴다. 「그러니 3분 쉬세요」로 바꾸면 코치 노릇이고,
 * 그것은 11/18 에 반려된 선이다 (`data/restPerExercise.js` 머리글).
 *
 * @param workouts 날짜 → 줄들
 * @param name     운동 이름 (자유 입력 — 눕혀서 견준다)
 * @param today    오늘 (앞날 기록은 뺀다)
 * @param days     거슬러 보는 날 수 (기본 `BASELINE_DAYS`)
 *
 * @returns {{ medianMs, samples, days }} 또는 **`null`**(잴 수 없다)
 */
export function 운동별평소(workouts, name, today, days = BASELINE_DAYS) {
  // 눕히는 식은 **한 자리에서 온다** (`data/flatName.js` · 2026-11-19 · 정석 2차)
  const 나 = flatName(name);
  if (!나 || !today) return null;

  const gaps = [];
  let 센날 = 0;
  for (const [date, list] of Object.entries(workouts || {})) {
    if (date > today) continue;                     // 앞날 기록은 셈에서 뺀다
    const 거리 = daysBetween(date, today);
    if (!Number.isFinite(거리) || 거리 < 0 || 거리 > days) continue;

    // 위와 같다 — **모양을 믿지 않는다**(2026-11-19 · 정석 2차). 새 함수가 이 파일의
    // 약한 쪽(61행)을 베꼈는데, 101행은 이미 `Array.isArray` 로 막고 있었다
    const stamps = (Array.isArray(list) ? list : [])
      .filter((r) => flatName(r?.exercise) === 나)
      .map(at)
      .filter((t) => t !== null)
      .sort((a, b) => a - b);
    if (stamps.length < 2) continue;                // 간격이 하나도 안 나온다

    let 이날 = 0;
    for (let i = 1; i < stamps.length; i += 1) {
      const g = stamps[i] - stamps[i - 1];
      // **한꺼번에 적은 날은 뺀다** — 집에 와서 다섯 세트를 몰아 적으면 간격이 몇 초다.
      // 위 `MIN_SPAN` 이 하루치에서 막는 것과 같은 까닭이고, 여기서는 **간격마다** 본다
      if (g < 20 * 1000) continue;
      // 그리고 **너무 긴 것도 뺀다** — 세트 사이가 아니라 「딴 일을 하다 왔다」다
      if (g > 20 * 60000) continue;
      gaps.push(g);
      이날 += 1;
    }
    if (이날 > 0) 센날 += 1;
  }

  if (gaps.length < 3) return null;                 // 모르면 모른다고 한다
  return { medianMs: median(gaps), samples: gaps.length, days: 센날 };
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
