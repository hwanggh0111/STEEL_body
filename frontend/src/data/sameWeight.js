// ── 같은 무게 최다 횟수 ── (2026-11-12, 시안 1112 B)
//
// 최고 기록 띠(`personalRecord.checkRecord`)는 1RM 으로 견준다. 그래서 **무거운 날에
// 세운 1RM 을 못 넘으면** 그 무게로 전보다 많이 한 날에도 아무 말이 없다 —
// 80kg 9회에서 10회로 간 날이 그렇다. 사람은 그것을 「늘었다」로 안다.
//
// **최고 기록 띠가 안 뜰 때만** 부른다(부르는 쪽이 지킨다). 「나를 넘었다」를 알리는
// 자리는 하나여야 한다 — 둘이 한꺼번에 뜨면 어느 것이 큰일인지 모른다.
//
// ── 안 띄우는 것 ──
//
//   · **그 무게로 적은 적이 없다** — 첫 기록을 「가장 많이」라 부르지 않는다
//   · 맨몸 · 무게를 못 읽는 줄 — 맨몸은 최고 기록 띠가 이미 횟수로 센다
//   · 드롭 줄 — 무게를 내려 이어 한 것이라 그 무게의 힘을 말하지 않는다(견줄 때도 뺀다)
//   · 앞날 줄 — 아직 한 것이 아니다
//   · 같거나 적다 — 「가장 많이」는 넘었을 때만
//
// kg 은 **숫자로** 견준다 — 「82.5」와 「82.50」은 같은 무게다
import { parseWeight } from './personalRecord';

const sameKg = (a, b) => Math.abs(a - b) < 1e-9;

/**
 * @param {Record<string, Array<object>>} workouts  날짜 → 그날 줄 (**넣기 전** 것)
 * @param {{ exercise: string, weight: unknown, reps: unknown, link?: string|null }} row  방금 적은 줄
 * @param {string|null} today  `YYYY-MM-DD` — 이보다 뒤의 줄은 안 센다
 * @returns {{ exercise: string, kg: number, reps: number, prevReps: number, prevDate: string } | null}
 */
export function sameWeightBest(workouts, row, today = null) {
  const name = String(row?.exercise ?? '').trim();
  if (!name || row?.link === 'drop') return null;
  const kg = parseWeight(row.weight);
  const reps = Number(row.reps);
  if (kg === null || !(kg > 0) || !Number.isInteger(reps) || reps <= 0) return null;

  let prevReps = 0;
  let prevDate = null;
  for (const [date, list] of Object.entries(workouts || {})) {
    if (today && date > today) continue;
    for (const w of list || []) {
      if (String(w?.exercise ?? '').trim() !== name || w?.link === 'drop') continue;
      const wkg = parseWeight(w.weight);
      if (wkg === null || !sameKg(wkg, kg)) continue;
      const r = Number(w.reps);
      if (!Number.isFinite(r)) continue;
      // 같은 횟수면 **더 최근 날**을 든다 — 「전에는 9회 · 10/21」은 가까운 날이 맞다
      if (r > prevReps || (r === prevReps && prevDate && date > prevDate)) { prevReps = r; prevDate = date; }
    }
  }
  if (!prevDate || reps <= prevReps) return null;
  return { exercise: name, kg, reps, prevReps, prevDate };
}
