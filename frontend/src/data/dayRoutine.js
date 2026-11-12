// ── 이 날을 루틴으로 ── (2026-11-12, 시안 1112 A)
//
// 잘 된 날을 다시 하고 싶으면 루틴 폼에 운동을 하나씩 다시 쳐야 했다. 그날 적은 것이
// 이미 기록에 있다 — 그것으로 폼을 **채워만** 준다. **저장은 사람이 누른다.**
//
// ── 채우는 규칙 ──
//
//   · 같은 운동이 여러 줄이면 **한 줄로** — 세트는 더하고, 횟수는 **드롭이 아닌 첫 줄**
//     (평균을 내면 아무도 안 한 횟수가 생긴다)
//   · **드롭 줄은 뺀다** — 무게만 내려 이어 한 것이라 루틴의 한 세트가 아니다
//   · **유산소 줄은 뺀다** — 루틴 줄은 「세트 × 횟수」뿐이라 담을 칸이 없다
//   · 뺀 것은 **뺐다고 말한다**(부르는 쪽이 `dropped` 를 읽어 그린다)
//   · 무게는 루틴에 담지 않는다(루틴 줄에 무게 칸이 없다) — 그것도 말한다
//   · 차례는 **적은 차례** — 기록 목록은 최신이 위라 그대로 담으면 거꾸로 된다
//   · 앞날은 부르는 쪽이 막는다(단추를 안 그린다)

// 「유산소인가」는 **한 손만** 쓴다 (`data/cardio.js` · `npm run cardiohands` 가 손의 수를 센다).
// 세트가 비어 있는 다른 줄은 아래에서 세트를 못 읽어 저절로 빠진다
import { isCardioRow } from './cardio';

const at = (w) => {
  const t = Date.parse(w?.created_at || '');
  return Number.isFinite(t) ? t : null;
};

/**
 * @param {Array<object>} rows  그 날의 기록 줄
 * @returns {{ exercises: Array<{ name: string, sets: number, reps: number }>,
 *   dropped: { drop: number, cardio: string[] } }}
 */
export function routineFromDay(rows) {
  // 적은 차례로 — 시각을 못 읽는 줄(지하에서 적어 세운 줄)은 뒤에, 그 안에서는 번호 차례
  const list = [...(rows || [])].sort((a, b) => {
    const ta = at(a);
    const tb = at(b);
    if (ta !== null && tb !== null && ta !== tb) return ta - tb;
    if (ta === null && tb !== null) return 1;
    if (tb === null && ta !== null) return -1;
    return (Number(a?.id) || 0) - (Number(b?.id) || 0);
  });

  const byName = new Map();
  let drop = 0;
  const cardio = [];
  for (const w of list) {
    const name = String(w?.exercise ?? '').trim();
    if (!name) continue;
    if (isCardioRow(w)) { if (!cardio.includes(name)) cardio.push(name); continue; }
    if (w.link === 'drop') { drop += 1; continue; }
    const sets = Number(w.sets);
    const reps = Number(w.reps);
    if (!Number.isInteger(sets) || sets <= 0) continue;
    const cur = byName.get(name);
    if (cur) cur.sets += sets;
    else byName.set(name, { name, sets, reps: Number.isInteger(reps) && reps > 0 ? reps : '' });
  }
  return { exercises: [...byName.values()], dropped: { drop, cardio } };
}

/** 폼 위에 띄울 두 줄. 「11월 8일에 한 대로 채웠어요 · 운동 5개」 / 「무게는 … 뺐어요.」 */
export function fillNote(date, fill) {
  const md = `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;
  const head = `${md}에 한 대로 채웠어요 · 운동 ${fill.exercises.length}개`;
  const out = [];
  if (fill.dropped.drop) out.push(`드롭세트 ${fill.dropped.drop}줄`);
  if (fill.dropped.cardio.length) {
    out.push(`유산소 ${fill.dropped.cardio.length}개(${fill.dropped.cardio.join(' · ')})`);
  }
  // 조사는 **마지막 말**에 맞춘다 — 「…1줄은」 · 「…1개(러닝머신)는」(괄호 앞 「개」를 읽는다)
  const josa = fill.dropped.cardio.length ? '는' : '은';
  const tail = `무게는 루틴에 안 들어가요.${out.length ? ` ${out.join('과 ')}${josa} 뺐어요.` : ''}`;
  return { head, name: `${md} 루틴`, tail };
}
