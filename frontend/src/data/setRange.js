// 루틴의 세트 · 횟수가 테두리 안인가 — **서버와 같은 자** (2026-10-31).
//
// 루틴의 sets · reps 는 **글자**다. 추천 프로그램이 `'10~12'` 처럼 적어 넣고,
// 그 루틴을 고치려고 폼을 열면 그 글자가 칸에 들어온다. 그래서 「숫자여야 한다」로
// 막으면 **멀쩡한 루틴을 고칠 수 없게 된다** — 적힌 **첫 숫자**만 본다.
//
// ── 두 벌인 것을 알고 둔다 ──
//
// 같은 자가 서버(`backend/src/utils/setRange.js`)에도 있다. 화면과 서버는 따로
// 지어지니 한쪽을 불러 쓸 수 없다. 대신 **`npm run bounds` 가 양쪽의 수와 뽑는
// 규칙을 글자로 견준다** — 한쪽을 고치는 날 FAIL 한다.
// (`npm run twins` 는 숫자만 보니 뽑는 규칙은 못 본다)
import { REPS_MAX, SETS_MAX } from './limits';

/** `'10~12'` → 10 · `'4세트'` → 4 · `''` → null */
export function firstNum(v) {
  const m = String(v ?? '').match(/\d+/);
  return m ? Number(m[0]) : null;
}

/**
 * 테두리를 넘은 줄을 찾아 **그 줄을 가리키는 말**을 돌려준다. 없으면 null.
 * 서버 말은 어느 줄인지 모른다 — 그래서 여기서 운동 이름을 들고 말한다
 */
export function setsRepsError(exercises) {
  for (const ex of exercises || []) {
    if (!String(ex?.name ?? '').trim()) continue;
    const s = firstNum(ex.sets);
    const r = firstNum(ex.reps);
    if ((s !== null && (s < 1 || s > SETS_MAX)) || (r !== null && (r < 1 || r > REPS_MAX))) {
      return `「${String(ex.name).trim()}」의 세트는 1~${SETS_MAX}, 횟수는 1~${REPS_MAX} 까지예요`;
    }
  }
  return null;
}
