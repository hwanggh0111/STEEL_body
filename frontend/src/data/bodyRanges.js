// 인바디 값의 **참고 범위**.
//
// 예전 화면(BodyAnalysis.jsx)은 성별을 받지도 않으면서 남성 기준으로 판정했다.
// 체지방률 20% 이상을 「약간 높은 편」, 25% 이상을 「내장지방 위험」이라고 했는데,
// 여성은 20~25%가 건강한 범위다. **건강한 몸을 보고 위험하다고 말하고 있었다.**
//
// 그래서 세 가지를 바꾼다.
//   1. 성별을 받는다. **안 받아도 된다** — 안 고르면 범위를 아예 안 그린다
//   2. 「정상 · 위험」이 아니라 「일반적인 범위」라고 쓴다. 등급을 매기지 않는다
//   3. 부위별로 나누지 않는다. 인바디 값은 팔과 다리를 따로 모른다 —
//      예전 화면은 골격근 비율 하나로 팔과 다리를 서로 다른 색으로 칠했다
//
// 아래 숫자는 일반적으로 알려진 범위다. 나이 · 운동 이력 · 재는 기계에 따라 달라진다.
// 그래서 화면에 「참고용」이라고 적고, 벗어났다고 나쁘다고 말하지 않는다.

export const SEXES = [
  { key: 'male', label: '남성' },
  { key: 'female', label: '여성' },
];

/**
 * 한 항목의 눈금.
 *
 * bands 는 왼쪽부터 이어지는 구간이다. `to` 는 그 구간의 끝값,
 * 마지막 구간은 `to: null` (그 위 전부).
 * `normal: true` 인 구간이 「일반적인 범위」다.
 */
const METRICS = {
  fat_pct: {
    label: '체지방률',
    unit: '%',
    male: {
      bands: [
        { to: 8, label: '낮음', tone: 'low' },
        { to: 20, label: '일반적인 범위', tone: 'normal', normal: true },
        { to: 25, label: '다소 높음', tone: 'high' },
        { to: null, label: '높음', tone: 'high' },
      ],
      note: '성인 남성의 일반적인 범위는 8~20% 로 알려져 있습니다.',
    },
    female: {
      bands: [
        { to: 15, label: '낮음', tone: 'low' },
        { to: 28, label: '일반적인 범위', tone: 'normal', normal: true },
        { to: 33, label: '다소 높음', tone: 'high' },
        { to: null, label: '높음', tone: 'high' },
      ],
      note: '성인 여성의 일반적인 범위는 15~28% 로 알려져 있습니다. 여성은 남성보다 높은 것이 정상입니다.',
    },
  },
  muscle_ratio: {
    label: '골격근 비율',
    unit: '%',
    male: {
      bands: [
        { to: 40, label: '낮음', tone: 'low' },
        { to: 50, label: '일반적인 범위', tone: 'normal', normal: true },
        { to: null, label: '높음', tone: 'low' },
      ],
      note: '체중 대비 골격근량입니다. 성인 남성은 40~50% 가 일반적입니다.',
    },
    female: {
      bands: [
        { to: 32, label: '낮음', tone: 'low' },
        { to: 42, label: '일반적인 범위', tone: 'normal', normal: true },
        { to: null, label: '높음', tone: 'low' },
      ],
      note: '체중 대비 골격근량입니다. 성인 여성은 32~42% 가 일반적입니다.',
    },
  },
  bmi: {
    label: 'BMI',
    unit: '',
    // BMI 는 성별을 안 가린다 — 그래서 성별을 안 골라도 그릴 수 있는 유일한 항목이다
    both: {
      bands: [
        { to: 18.5, label: '낮음', tone: 'low' },
        { to: 23, label: '일반적인 범위', tone: 'normal', normal: true },
        { to: 25, label: '다소 높음', tone: 'high' },
        { to: null, label: '높음', tone: 'high' },
      ],
      note: '대한비만학회 기준입니다. 근육이 많으면 BMI 가 높게 나옵니다 — 체지방률과 같이 보세요.',
    },
  },
};

/** 눈금을 고른다. 성별이 필요한 항목인데 안 골랐으면 null. */
export function scaleFor(metric, sex) {
  const m = METRICS[metric];
  if (!m) return null;
  if (m.both) return { ...m.both, label: m.label, unit: m.unit };
  if (sex !== 'male' && sex !== 'female') return null;
  return { ...m[sex], label: m.label, unit: m.unit };
}

/**
 * 값이 눈금의 어디쯤인가.
 *
 * 구간마다 폭이 다른데 화면에서는 같은 너비로 그린다 — 그래야 「일반적인 범위」가
 * 좁아서 안 보이는 일이 없다. 그래서 위치도 구간 안에서의 비율로 센다.
 *
 * 마지막 구간은 끝이 없다. 그 구간의 폭만큼 더 간 것을 끝으로 친다 —
 * 안 그러면 아주 큰 값에서 표시가 화면 밖으로 나간다.
 */
export function positionOn(scale, value) {
  const v = Number(value);
  if (!scale || !Number.isFinite(v)) return null;

  const bands = scale.bands;
  const width = 1 / bands.length;
  let lo = 0;
  let prevSpan = 1;

  for (let i = 0; i < bands.length; i++) {
    const b = bands[i];
    const isLast = b.to === null;
    // 마지막 구간은 끝이 없다. 바로 앞 구간과 같은 폭만큼 더 간 곳을 끝으로 친다 —
    // 안 그러면 아주 큰 값에서 표시가 눈금 밖으로 나간다
    const hi = isLast ? lo + prevSpan : b.to;

    if (isLast || v < b.to) {
      const span = hi - lo;
      const within = span > 0 ? Math.min(1, Math.max(0, (v - lo) / span)) : 0.5;
      return {
        ratio: Math.min(1, Math.max(0, (i + within) * width)),
        band: b,
        inNormal: !!b.normal,
      };
    }
    prevSpan = b.to - lo;
    lo = b.to;
  }

  const last = bands[bands.length - 1];
  return { ratio: 1, band: last, inNormal: !!last.normal };
}

/** 골격근 비율(%). 둘 중 하나가 없으면 null. */
export function muscleRatio(record) {
  const m = Number(record?.muscle_kg);
  const w = Number(record?.weight);
  if (!Number.isFinite(m) || !Number.isFinite(w) || w <= 0) return null;
  return Math.round((m / w) * 1000) / 10;
}

/** 화면이 그릴 항목들. 값이 없거나 눈금이 없으면 빼고 준다. */
export function readingsOf(record, sex) {
  const rows = [];
  const push = (metric, value) => {
    if (value === null || value === undefined || value === '') return;
    const v = Number(value);
    if (!Number.isFinite(v)) return;
    const scale = scaleFor(metric, sex);
    rows.push({ metric, value: v, scale, position: scale ? positionOn(scale, v) : null });
  };
  push('fat_pct', record?.fat_pct);
  push('muscle_ratio', muscleRatio(record));
  push('bmi', record?.bmi);
  return rows;
}
