// 오늘 들 무게를 **1RM 으로 읽는다** (2026-10-05).
//
// ── 왜 ──
//
// 1RM 을 계산만 하고 쓰는 데가 없었다. 측정 화면에 계산기가 있고(`OneRMSection`),
// 최고 기록 판정이 속으로 쓰지만(`personalRecord`), **기록하는 자리에서는 안 보인다.**
// 번핏은 「세트별 강도(%)」를 적어주고 라이즈는 「워밍업 · 피라미드 · 드롭세트를
// 1RM 으로 자동 구성」한다. 우리는 재료를 다 갖고 있으면서 안 쓰고 있었다.
//
// 여기서 두 가지를 낸다 —
//   · **오늘 무게가 내 1RM 의 몇 %인가** (너무 가벼운지 무거운지가 한눈에 보인다)
//   · **본세트까지 올라가는 워밍업 줄** (헬스장에서 매번 암산하는 그것)
//
// ── 원판에 맞춰 떨어뜨린다 ──
//
// 1RM 의 40%가 33.7kg 이라고 적어주면 쓸모가 없다 — 그런 무게를 만들 수 없다.
// 바벨은 **양쪽에 같은 원판**을 끼우니 2.5kg 단위로 움직인다. 그 아래로는 빈 바(20kg)다.
// 덤벨·머신은 보통 5kg 또는 한 칸 단위인데, 어느 쪽이든 2.5 배수면 읽을 수 있다.

/**
 * 2.5kg 단위로 **반올림**. 바벨이 만들 수 있는 무게로 떨어뜨린다.
 *
 * **0 으로 떨어지면 `null` 이다** (2026-10-24). 반올림이라 아주 가벼운 무게는
 * 한 칸 아래로 사라진다 — 3kg 덤벨의 40%는 1.2kg 이고 2.5 단위로는 **0** 이다.
 * 그 0 을 그대로 돌려줘서 워밍업 줄에 **「0kg 으로 5회」**가 떴다.
 * 만들 수 없는 무게는 「없다」로 말해야 부르는 쪽이 그 줄을 안 그린다
 */
export function toPlate(kg, step = 2.5) {
  const n = Number(kg);
  if (!Number.isFinite(n) || n <= 0) return null;
  const out = Math.round(n / step) * step;
  return out > 0 ? out : null;
}

/** 오늘 무게가 1RM 의 몇 %인가. 못 세면 null */
export function percentOf1RM(workKg, oneRM) {
  const w = Number(workKg);
  const r = Number(oneRM);
  if (!Number.isFinite(w) || !Number.isFinite(r) || w <= 0 || r <= 0) return null;
  return Math.round((w / r) * 100);
}

// 그 %가 **무엇을 하는 무게인가.** 숫자만 적어두면 76% 가 좋은 건지 모른다.
//
// 구간은 흔히 쓰는 결대로 나눴다 — 근지구력 · 근비대 · 근력 · 최대근력.
// **「너무 가볍다」고 말하지 않는다.** 가벼운 무게로 횟수를 채우는 날이 있고,
// 다치고 돌아온 사람도 있다. 무엇을 하는 무게인지만 말하고 판단은 안 한다.
const ZONES = [
  { max: 60, label: '가볍게 · 자세 다듬기', tone: 'low' },
  { max: 70, label: '근지구력', tone: 'low' },
  { max: 80, label: '근비대', tone: 'mid' },
  { max: 90, label: '근력', tone: 'high' },
  { max: Infinity, label: '최대근력', tone: 'high' },
];

/** 그 %가 어느 구간인가 */
export function zoneOf(pct) {
  const p = Number(pct);
  if (!Number.isFinite(p) || p <= 0) return null;
  return ZONES.find((z) => p < z.max) || ZONES[ZONES.length - 1];
}

// ── 워밍업 ──
//
// 본세트 무게에서 거꾸로 내려온다. 비율과 횟수는 흔히 쓰는 결이다 —
// **가벼울수록 많이, 무거울수록 적게.** 마지막 줄은 본세트 바로 아래라 2회만 한다
// (더 하면 본세트에서 쓸 힘을 여기서 쓴다).
const WARMUP = [
  { pct: 0.40, reps: 5 },
  { pct: 0.60, reps: 4 },
  { pct: 0.75, reps: 3 },
  { pct: 0.90, reps: 2 },
];

// 빈 바. 아래로 내려갈 수 없는 바닥이다
export const BAR_KG = 20;

/**
 * 본세트까지 올라가는 워밍업 줄.
 *
 * **가벼운 날에는 안 준다.** 본세트가 빈 바보다 가벼우면(또는 맨몸이면) 워밍업을
 * 따로 할 무게가 없다 — 빈 칸을 그려두면 할 일이 있는 것처럼 보인다.
 *
 * **같은 무게가 겹치면 접는다.** 60kg 본세트면 40% 와 60% 가 둘 다 25kg 쯤으로
 * 떨어져 같은 줄이 두 번 나온다.
 *
 * @param workKg 본세트 무게(kg)
 * @param opts.bar 빈 바 무게. 덤벨·머신이면 0 을 준다
 */
export function warmupSets(workKg, { bar = BAR_KG, step = 2.5 } = {}) {
  const w = Number(workKg);
  if (!Number.isFinite(w) || w <= 0) return [];
  // 빈 바로 할 수 있는 무게면 워밍업이 따로 없다
  if (bar > 0 && w <= bar * 1.5) return [];

  const out = [];
  const seen = new Set();
  // 바벨이면 빈 바부터 — 헬스장에서 실제로 그렇게 시작한다
  if (bar > 0) { out.push({ kg: bar, reps: 8, bar: true }); seen.add(bar); }

  for (const { pct, reps } of WARMUP) {
    let kg = toPlate(w * pct, step);
    if (kg === null) continue;
    if (bar > 0 && kg < bar) continue;          // 빈 바보다 가벼운 줄은 없다
    if (kg >= w) continue;                      // 본세트보다 무거우면 워밍업이 아니다
    if (seen.has(kg)) continue;                 // 같은 무게로 떨어진 줄은 접는다
    seen.add(kg);
    out.push({ kg, reps, bar: false });
  }
  return out;
}

// ── 드롭세트 ──
//
// 본세트를 끝내고 **쉬지 않고** 무게를 내려 한 번 더 간다. 보통 20%씩 둘.
// 횟수는 적지 않는다 — 드롭세트는 **못 들 때까지** 하는 것이고, 숫자를 적어두면
// 그 숫자에서 멈추게 된다.
export function dropSets(workKg, { drops = 2, cut = 0.20, step = 2.5 } = {}) {
  const w = Number(workKg);
  if (!Number.isFinite(w) || w <= 0) return [];
  const out = [];
  // **본세트 무게도 같이 센다** (2026-10-05, 리뷰에서 잡혔다).
  // `toPlate` 는 반올림이라 가벼운 무게에서는 내려가지 않는다 — 5kg 의 80%는 4kg 인데
  // 2.5 단위로 반올림하면 다시 5kg 이다. 앞 줄하고만 견주고 있어서 그 5kg 이 그대로
  // 나갔고, 화면이 「5kg 으로 내렸어요」라고 같은 무게를 말했다
  // **내려간 것만 내보낸다** (2026-10-24).
  //
  // 앞 줄과 같은 무게는 걸렀는데 **올라간 무게는 안 걸렀다.** `toPlate` 는
  // 반올림이라 가벼운 무게에서 **위로** 떨어진다 —
  //
  //     2kg 의 80% = 1.6kg  →  2.5 단위로 반올림  →  **2.5kg**
  //
  // 그래서 2kg 으로 적은 사람에게 단추가 「드롭세트 2.5kg」으로 떴고, 누르면
  // 「2.5kg 으로 내렸어요」라고 **올린 무게**를 말했다. 2·3·4kg 덤벨은
  // 어깨 재활에서 늘 쓰는 무게다. 5kg 단위 머신이면 4.5kg 까지 그랬다.
  //
  // 「같은 무게」가 아니라 **「더 못 내려간다」**로 본다 — 그러면 둘 다 걸린다
  let prev = w;
  for (let i = 0; i < drops; i += 1) {
    const kg = toPlate(prev * (1 - cut), step);
    if (kg === null) break;
    if (kg >= prev) break;                   // 더 못 내려간다 (같거나 되올라갔다)
    prev = kg;
    out.push({ kg });
  }
  return out;
}
