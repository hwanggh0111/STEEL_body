// 몸 지표 — BMI 가 말 못 하는 것 (2026-10-05).
//
// ── 왜 FFMI 인가 ──
//
// BMI 는 **근육과 지방을 구별하지 못한다.** 운동하는 사람의 BMI 는 늘 「과체중」으로
// 나오고, 그래서 이 앱을 쓰는 사람에게는 거의 쓸모가 없는 숫자다 — 몸이 좋아질수록
// 더 나쁜 쪽으로 간다.
//
// FFMI 는 **지방을 뺀 몸**만 키로 나눈다. 그래서 체지방이 빠지면서 근육이 그대로면
// FFMI 는 **그대로** 있고(BMI 는 내려간다), 근육이 붙으면 올라간다. 「얼마나 키웠나」를
// 한 숫자로 보는 자리다. 라이즈도 이것을 낸다.
//
//   제지방량 = 체중 × (1 − 체지방률/100)
//   FFMI     = 제지방량 ÷ 키(m)²
//
// ── 보정은 왜 ──
//
// FFMI 는 키가 작을수록 높게 나온다(같은 몸이어도). 그래서 1.8m 기준으로 맞춘
// 값을 같이 쓴다 — Kouri 의 보정식이다. 남과 견줄 때는 이쪽이 맞다.
//
//   보정 FFMI = FFMI + 6.1 × (1.8 − 키(m))
//
// ── 체지방률이 없으면 안 낸다 ──
//
// 인바디에서 체지방률은 **선택 항목**이다. 없으면 제지방량을 모르니 FFMI 도 없다.
// 체중만으로 지어내지 않는다 — 그러면 BMI 를 FFMI 라고 부르는 것이 된다.

/**
 * FFMI 를 낸다. 키(cm) · 체중(kg) · 체지방률(%) 이 다 있어야 한다.
 * 하나라도 없거나 말이 안 되면 `null` — 화면은 그 줄을 안 그린다.
 */
export function ffmiOf({ height, weight, fatPct }) {
  // **빈 칸을 0%로 읽지 않는다** (2026-10-05 리뷰에서 잡혔다).
  // 체지방률 칸은 비어 있는 채로 오고(`<input value={fatPct}>`), `Number('')` 는 **0** 이다.
  // 그러면 「지방이 0%인 몸」이 되어 제지방량 = 체중이 되고, 키 175·체중 80 을 적은
  // 사람에게 「FFMI 26.4 · 드문 자리」가 뜬다 — 이 파일 머리글이 안 하겠다고 적어둔
  // 바로 그것(BMI 를 FFMI 라고 부르기)이고, 평범한 사람에게 누명까지 씌운다.
  //
  // 키·체중은 범위 검사(`< 100`, `<= 0`)가 빈 칸을 걸러주지만 체지방률은 0 이 **말이
  // 되는 값**이라 안 걸린다. 그래서 여기서만 비었는지 따로 본다
  if (fatPct === '' || fatPct === null || fatPct === undefined) return null;
  if (height === '' || height === null || height === undefined) return null;
  if (weight === '' || weight === null || weight === undefined) return null;

  const h = Number(height);
  const w = Number(weight);
  const f = Number(fatPct);
  if (!Number.isFinite(h) || !Number.isFinite(w) || !Number.isFinite(f)) return null;
  if (h < 100 || h > 250 || w <= 0 || w > 500 || f < 0 || f >= 100) return null;

  const m = h / 100;
  const lean = w * (1 - f / 100);          // 제지방량 (kg)
  const ffmi = lean / (m * m);
  // 보정 — 1.8m 기준. 키가 작을수록 FFMI 가 높게 나오는 것을 메운다
  const adjusted = ffmi + 6.1 * (1.8 - m);
  return {
    lean: +lean.toFixed(1),
    ffmi: +ffmi.toFixed(1),
    adjusted: +adjusted.toFixed(1),
  };
}

// 어느 자리인가. **남자 기준이다** — 여자는 같은 몸이어도 체지방률이 높아 FFMI 가
// 3~4 낮게 나온다. 그래서 칸 이름에 성별을 안 적고 「대체로」라고 말한다.
//
// 25 위는 자연적으로 거의 안 나온다고 알려진 구간이다. 그런데 **그렇다고 약을 썼다는
// 뜻은 아니다** — 키가 아주 크거나 체지방률 측정이 틀렸으면 그쪽으로 넘어간다.
// 그래서 「의심」 같은 말을 쓰지 않는다. 숫자를 보는 사람에게 누명을 씌우는 자리다.
const BANDS = [
  { max: 17, label: '마른 편', tone: 'low' },
  { max: 19, label: '보통', tone: 'mid' },
  { max: 21, label: '운동하는 몸', tone: 'good' },
  { max: 23, label: '잘 키운 몸', tone: 'good' },
  { max: 25, label: '아주 잘 키운 몸', tone: 'high' },
  { max: Infinity, label: '드문 자리', tone: 'high' },
];

/** 보정 FFMI 가 어느 칸인가. 숫자가 없으면 null */
export function ffmiBand(adjusted) {
  const v = Number(adjusted);
  if (!Number.isFinite(v)) return null;
  return BANDS.find((b) => v < b.max) || BANDS[BANDS.length - 1];
}

/** 인바디 기록 한 줄에서 바로 — `{ height, weight, fat_pct }` 를 받는다 */
export function ffmiOfRecord(record) {
  if (!record) return null;
  return ffmiOf({ height: record.height, weight: record.weight, fatPct: record.fat_pct });
}
