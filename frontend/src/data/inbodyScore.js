import { scaleFor, muscleRatio } from './bodyRanges';

// 인바디 점수 (2026-09-29).
//
// ── 먼저 밝혀둘 것 ──
//
// 이 앱은 **몸에 점수를 안 매긴다**고 8/25 에 정했고, 9/2 에는 비교 화면의 「종합
// 평가」를 그 때문에 걷어냈다(체중 증가를 주황, 체지방 증가를 빨강으로 칠하던 카드다).
// 체형 읽기도 같은 규칙 위에 서 있다.
//
// 그래서 이것은 **켠 사람에게만 보이는 것**이다. 기본은 꺼짐이고, 설정함에서 켠다.
// 그리고 켜도 다음 넷을 지킨다 — 이게 없으면 걷어낸 카드가 이름만 바꿔 돌아온다.
//
//   1. **등급을 안 붙인다.** 「72점 · 보통」 · A~D · 「위험」을 안 쓴다. 숫자와
//      무엇으로 냈는지만 적는다
//   2. **또래와 안 견준다.** 쓰는 것은 `bodyRanges.js` 의 「일반적으로 알려진 범위」
//      하나뿐이다. 그 범위는 이미 화면에 눈금으로 그려져 있는 것이고, 점수는 그것을
//      **한 숫자로 접은 것**이다 — 새로운 기준을 지어내지 않는다
//   3. **성별을 안 밝히면 점수를 안 낸다.** 범위가 성별마다 다르기 때문이다.
//      BMI 하나로 「내 몸 점수」를 내면 그건 점수가 아니라 키와 몸무게다
//   4. **근육이 많아서 범위를 넘는 것은 안 깎는다.** 골격근 비율이 위로 벗어난 것을
//      감점하면 이 앱은 운동한 사람을 벌주는 앱이 된다
//
// ── 무엇으로 내나 ──
//
// 눈금이 있는 셋이다 — 체지방률 · 골격근 비율 · BMI. 항목마다
// **「일반적인 범위」 안이면 100점**, 벗어났으면 **범위 폭을 자로 삼아** 깎는다
// (범위 폭만큼 벗어나면 0점). 점수는 그 항목들의 평균이다.
//
// 범위 폭을 자로 쓰는 까닭: 체지방률은 12%p 폭(남 8~20), BMI 는 4.5 폭이다.
// 절대값으로 깎으면 BMI 가 1 벗어난 것이 체지방률 1%p 벗어난 것과 같아진다 —
// 둘은 같은 크기가 아니다.

/** 점수에 쓰는 셋. 눈금(`bodyRanges`)이 있는 것만이다. */
export const SCORE_METRICS = [
  { metric: 'fat_pct', label: '체지방률' },
  { metric: 'muscle_ratio', label: '골격근 비율' },
  { metric: 'bmi', label: 'BMI' },
];

/** 항목이 이만큼은 있어야 점수를 낸다. 하나로 내는 점수는 점수가 아니다. */
export const MIN_PARTS = 2;

/** **위로 벗어나도 안 깎는 것.** 근육이 많은 것을 감점할 이유가 없다. */
const NO_PENALTY_ABOVE = ['muscle_ratio'];

/** 빈 칸은 **없는 것**으로 둔다 — `0` 으로 읽으면 안 적은 것이 0% 가 된다. */
const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** 눈금에서 「일반적인 범위」 칸의 아래·위 끝. */
export function normalBandOf(scale) {
  if (!scale || !Array.isArray(scale.bands)) return null;
  let lo = 0;
  for (const b of scale.bands) {
    const hi = b.to;
    if (b.normal) return { lo, hi };
    if (hi === null) return null;
    lo = hi;
  }
  return null;
}

/**
 * 한 항목 점수 (0~100).
 *
 * 범위 안이면 100. 벗어났으면 **범위 폭을 자로** 깎는다.
 * 돌려주는 것: `{ score, inNormal, off, where }` · 못 재면 `null`.
 * `where` 는 'in' · 'below' · 'above' — 화면이 「아래로 벗어났다」를 적는 데 쓴다.
 */
export function metricScore(metric, scale, value) {
  // **`Number(null)` 은 `0` 이다.** 9/22 에 체형 읽기에서 물렸던 그 함정이고
  // (`shapeRead.js` 의 `num`), 여기서는 검사가 먼저 잡았다 — 골격근량을 안 적은
  // 기록의 골격근 비율이 `null` 로 들어와 **0% 로 읽혀 「범위보다 40 아래」**가 됐다.
  // 빈 것은 **없는 것**으로 둔다. 없는 칸은 점수에 안 낀다.
  const v = num(value);
  const band = normalBandOf(scale);
  if (v === null || !band) return null;

  const width = band.hi - band.lo;
  if (!(width > 0)) return null;

  if (v >= band.lo && v <= band.hi) return { score: 100, inNormal: true, off: 0, where: 'in' };

  const above = v > band.hi;
  const off = Math.round((above ? v - band.hi : band.lo - v) * 10) / 10;

  // 근육이 많아서 넘은 것은 안 깎는다 — 벗어난 것은 벗어났다고 적고 점수는 그대로 둔다
  if (above && NO_PENALTY_ABOVE.includes(metric)) {
    return { score: 100, inNormal: false, off, where: 'above' };
  }

  const score = Math.max(0, Math.min(100, Math.round(100 - (off / width) * 100)));
  return { score, inNormal: false, off, where: above ? 'above' : 'below' };
}

/**
 * 인바디 한 칸 → 점수.
 *
 * 돌려주는 것:
 *   score   0~100 정수 · 못 내면 null
 *   parts   항목별 { metric, label, value, score, inNormal, off, where }
 *   why     점수를 못 낸 까닭 한 줄 (낼 수 있으면 null)
 *
 * **까닭을 같이 주는 것이 중요하다.** 「점수 없음」만 내놓으면 사람은 고장인 줄 안다.
 */
export function scoreOf(record, sex) {
  const parts = [];
  SCORE_METRICS.forEach(({ metric, label }) => {
    const scale = scaleFor(metric, sex);
    if (!scale) return;                   // 성별이 필요한데 안 밝혔다
    const value = num(metric === 'muscle_ratio' ? muscleRatio(record) : record?.[metric]);
    const got = metricScore(metric, scale, value);
    if (!got) return;                     // 그 칸을 안 적었다
    parts.push({ metric, label, value, ...got });
  });

  if (parts.length < MIN_PARTS) {
    const needSex = sex !== 'male' && sex !== 'female';
    return {
      score: null,
      parts,
      why: needSex
        ? '성별을 밝히면 점수를 낼 수 있어요 — 참고 범위가 성별마다 달라서요.'
        : '체지방률이나 골격근량을 적으면 점수를 낼 수 있어요.',
    };
  }

  const score = Math.round(parts.reduce((n, p) => n + p.score, 0) / parts.length);
  return { score, parts, why: null };
}

/** 점수가 이만큼 달라져야 「달라졌다」고 한다. 인바디는 그날 물만 마셔도 흔들린다. */
export const MOVE_SURE = 2;

/**
 * 지난 기록과 견준 점수.
 *
 * 견줄 상대는 **지난 번의 나**다(앱의 규칙). 지난 기록이 없거나 그때 점수를 못 내면
 * `prev` 를 null 로 준다 — 없는 것을 0 으로 두면 「+72점」이 된다.
 */
export function scoreChange(record, prev, sex) {
  const now = scoreOf(record, sex);
  const then = prev ? scoreOf(prev, sex) : null;
  if (now.score === null || !then || then.score === null) {
    return { ...now, prev: null, delta: null, dir: null };
  }
  const delta = now.score - then.score;
  return {
    ...now,
    prev: then.score,
    delta,
    dir: Math.abs(delta) < MOVE_SURE ? 'flat' : delta > 0 ? 'up' : 'down',
  };
}
