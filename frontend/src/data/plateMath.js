// 원판 계산 — **바에 뭘 꽂아야 하나** (2026-10-05).
//
// ── 왜 ──
//
// 100kg 을 치려면 양쪽에 25+20+5. 헬스장에서 **매 세트 머리로 하는 계산**이고,
// 워밍업이면 다섯 번을 연달아 한다. 경쟁 앱은 거의 다 갖고 있고 우리만 없었다.
//
// 방금 붙인 워밍업 줄(`setPlan.js`)과 한 쌍이다 — 「60×4」 옆에 「20 하나씩」이
// 같이 적히면 바 앞에서 더 셀 것이 없다.
//
// ── 한쪽만 센다 ──
//
// 바벨은 **양쪽에 같은 원판**을 끼운다. 그래서 (목표 − 바) ÷ 2 를 한쪽에 올린다.
// 화면에도 **한쪽 것만** 적는다 — 「양쪽에 25+20+5」라고 말해야지 총 개수를 적으면
// 바 앞에서 다시 나눠야 한다.
//
// ── 못 맞추는 무게가 있다 ──
//
// 가진 원판으로 딱 안 떨어지면 **가장 가까운 아래**까지만 쌓고 얼마가 모자라는지
// 말한다. 몰래 반올림해서 「100kg」이라고 적어주면 실제로는 97.5kg 을 들고
// 기록에는 100 이 남는다 — 그게 다음 주 무게를 정한다.

// 한국 헬스장에 보통 있는 원판 (kg). 큰 것부터.
//
// 1.25 까지 둔다 — 2.5 단위로 떨어지는 무게만 쓰면 양쪽 합 2.5kg 을 못 올린다.
// 작은 증량(한 번에 2.5kg)을 하는 사람에게는 그 한 장이 전부다.
export const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

// 바 무게. 올림픽 바가 20kg, 여성용·짧은 바가 15kg 이다.
// 0 은 **바가 없는 것** — 덤벨 · 머신 · 스미스머신의 표시 무게다
export const BARS = [
  { kg: 20, label: '바벨 20kg' },
  { kg: 15, label: '짧은 바 15kg' },
  { kg: 0, label: '덤벨 · 머신' },
];

/**
 * 목표 무게를 만들려면 **한쪽에** 무엇을 꽂나.
 *
 * @returns null  — 바보다 가벼워 만들 수 없다 (화면은 아무것도 안 그린다)
 * @returns {{ perSide: number[], total: number, short: number, barOnly: boolean }}
 *   perSide  한쪽에 꽂을 원판들 (큰 것부터)
 *   total    실제로 만들어지는 무게
 *   short    목표에서 모자라는 무게 (0 이면 딱 맞다)
 *   barOnly  빈 바 그대로 (원판 없음)
 */
export function platesFor(targetKg, barKg = 20, plates = PLATES) {
  const target = Number(targetKg);
  const bar = Number(barKg);
  if (!Number.isFinite(target) || target <= 0) return null;
  if (!Number.isFinite(bar) || bar < 0) return null;
  if (target < bar) return null;                 // 빈 바보다 가벼울 수는 없다

  // 바가 없으면(덤벨 · 머신) 나눌 것도 없다 — 표시 무게가 곧 그 무게다
  if (bar === 0) {
    return { perSide: [], total: target, short: 0, barOnly: false, noBar: true };
  }

  let side = (target - bar) / 2;
  if (side === 0) return { perSide: [], total: bar, short: 0, barOnly: true };
  // **아무것도 안 올라가는데 모자란 경우**가 있다 (2026-10-05 리뷰).
  // 22kg 을 20kg 바로 치려면 한쪽에 1kg 인데 그런 원판이 없다. 여기서 `barOnly` 로
  // 빠져나가면 화면이 「빈 바 그대로」라고만 말하고 **2kg 이 사라진다** —
  // 이 파일이 안 하겠다고 적어둔 「몰래 반올림」이다. 모자란 만큼을 들고 나간다
  if (side < Math.min(...plates)) {
    return { perSide: [], total: bar, short: +(side * 2).toFixed(2), barOnly: true };
  }

  // 큰 것부터 쌓는다. 같은 원판을 여러 장 꽂을 수 있다
  const perSide = [];
  for (const p of plates) {
    // **한 종류를 무한정 쌓지 않는다.** 바 한쪽에 들어가는 장수에는 끝이 있고,
    // 열 장이 넘는 답은 읽어도 못 쓴다. 헬스장에 그만큼 있지도 않다
    let n = 0;
    while (side >= p - 1e-9 && n < 10) { perSide.push(p); side -= p; n += 1; }
  }

  const made = bar + (target - bar - side * 2);
  return {
    perSide,
    total: +made.toFixed(2),
    short: +(side * 2).toFixed(2),
    barOnly: perSide.length === 0,
  };
}

/**
 * 사람이 읽는 한 줄. 「25+20+5 양쪽」 · 「빈 바 그대로」
 * 못 만들면 모자란 만큼을 덧붙인다 — 몰래 반올림하지 않는다.
 */
export function plateText(targetKg, barKg = 20, plates = PLATES) {
  const r = platesFor(targetKg, barKg, plates);
  if (!r) return '';
  if (r.noBar) return '';                        // 덤벨 · 머신은 나눌 것이 없다
  // 빈 바라도 **모자라면 말한다** — 「빈 바 그대로」로 끝내면 그 차이가 사라진다
  if (r.barOnly) return r.short > 0 ? `빈 바 그대로 (${r.short}kg 모자람)` : '빈 바 그대로';

  // 같은 원판은 묶어 센다 — 「20+20+10」보다 「20 둘 · 10 하나」가 읽기 쉽다
  const count = new Map();
  for (const p of r.perSide) count.set(p, (count.get(p) || 0) + 1);
  const parts = [...count.entries()].map(([kg, n]) => (n === 1 ? `${kg}` : `${kg}×${n}`));

  const body = `양쪽 ${parts.join(' + ')}`;
  return r.short > 0 ? `${body} (${r.short}kg 모자람)` : body;
}
