// 체성분 비율 — **체중을 쪼개는 그림** (2026-11-04).
//
// ── 무엇이 틀렸나 ──
//
// 도넛에 조각 넷을 넣고 있었다: 골격근 · 체지방 · **체수분** · 기타(뼈·장기).
// 그런데 **체수분은 골격근과 체지방 안에 이미 들어 있는 물**이다 — 근육의 70%쯤이
// 물이다. 체중을 쪼개는 그림에 그것을 조각으로 또 넣으면 **이중 계산**이다.
//
// 앱이 스스로 적어둔 예시 숫자로 재봤다 (`ComparePage` 의 `SAMPLE_AFTER` —
// 체중 73 · 체지방률 16% · 골격근 33 · 체수분 41L) —
//
//   조각 합      33 + 11.7 + 41 = **85.7kg**   ← 도넛 가운데에는 **73kg** 이 적힌다
//   기타(뼈·장기) 73 − 85.7 = **−12.7kg** → `etc > 0` 이 거짓이라 **영영 안 나온다**
//   범례의 체지방 11.7 / 85.7 = **13.7%**      ← 사람이 적어 넣은 체지방률은 **16%**
//
// 셋 다 사람이 읽는 수다. 특히 마지막이 나쁘다 — **체지방률은 인바디에서 가장 많이
// 보는 수**인데, 자기가 적은 16% 가 그림에서는 13.7% 로 보인다.
//
// ── 그래서 ──
//
//   · 도넛은 **체중을 쪼갠다** — 골격근 · 체지방 · 기타(뼈·장기) 셋이다
//   · 퍼센트는 **체중 기준**으로 센다 (체지방 11.7kg → 16.0% — 적어 넣은 값과 같다)
//   · **체수분은 조각에서 빼고 한 줄로 말한다** — 숨기는 것이 아니라, 겹치는 것을
//     겹친다고 적는다. 숫자 자체는 `BodyReading` 표가 이미 보여준다
//   · 골격근 + 체지방이 **체중을 넘으면**(잘못 적었을 때) 그 사실을 알린다 —
//     조용히 기타만 빼면 「내 뼈는 0kg 인가」가 된다
//
// 이 셈은 `pages/InbodyPage.jsx` 안에 있었다(화면 파일 안의 계산). 떼어내서
// `npm run composition` 이 값으로 본다 — 그 자리에는 자가 없었다.
import { CHART } from './chartColors';

/** 숫자로 읽히는 값만. 0 과 빈 값은 없는 것으로 친다 (인바디는 0kg 을 안 적는다) */
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const round1 = (n) => Number(n.toFixed(1));

/**
 * 한 기록을 도넛이 쓸 모양으로.
 *
 * 돌려주는 것 —
 *   parts  `[{ name, value, color, pct }]` — 체중을 쪼갠 조각들 (pct 는 체중 기준)
 *   total  체중 (도넛 가운데에 적는다)
 *   water  체수분 L — **조각이 아니다.** 화면이 한 줄로 말한다 (없으면 null)
 *   over   골격근 + 체지방이 체중을 넘었다 (잘못 적은 값) — kg 으로 얼마나 넘었나
 *
 * 그릴 것이 없으면 `null` 이다 (화면은 그 칸을 아예 안 그린다).
 */
export function compositionOf(record) {
  const weight = num(record?.weight);
  if (!weight) return null;

  const fatPct = num(record?.fat_pct);
  const fatKg = fatPct ? round1((weight * fatPct) / 100) : null;
  const muscleKg = num(record?.muscle_kg) ? round1(num(record.muscle_kg)) : null;
  // **체수분은 조각이 아니다** (머리글). 숫자는 그대로 들고 있다가 화면이 말한다
  const water = num(record?.water_l) ? round1(num(record.water_l)) : null;

  // 둘 중 하나는 있어야 쪼갤 수 있다 — 체중만 있으면 그림이 아니라 수 하나다
  if (!fatKg && !muscleKg) return null;

  const parts = [];
  if (muscleKg) parts.push({ name: '골격근', value: muscleKg, color: CHART.muscle });
  if (fatKg) parts.push({ name: '체지방', value: fatKg, color: CHART.fat });

  const known = parts.reduce((s, p) => s + p.value, 0);
  const rest = round1(weight - known);
  // 뼈·장기는 **남은 것**이다. 0.1kg 아래로 남으면 조각으로 그리지 않는다(선만 생긴다)
  if (rest >= 0.1) parts.push({ name: '기타(뼈·장기)', value: rest, color: CHART.muted });

  return {
    parts: parts.map((p) => ({ ...p, pct: round1((p.value / weight) * 100) })),
    total: weight,
    water,
    // 넘었으면 **얼마나** 넘었는지 준다 — 화면이 그 수로 말한다
    over: rest < 0 ? round1(-rest) : 0,
  };
}
