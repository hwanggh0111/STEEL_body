// **막힌 화면이 언제 깨어날까** (2026-11-26 · 정석, 근호 11/25 의심 목록)
//
// 정지는 기한이 있다(`block.until`). 그 때가 되면 화면이 저절로 열려야 한다 —
// 안 그러면 7일이 지난 사람이 「풀리는 때」가 지난 화면을 보면서 새로고침을 모른 채
// 기다린다(`components/AccountBlocked.jsx`).
//
// ── ★ 왜 자를 그냥 걸면 안 되나 ──
//
// `setTimeout` 의 기다림은 **32비트로 접힌다.** `2^31 - 1`ms(약 24.8일)를 넘기면 그
// 값이 음수로 돌아 **바로 깨어난다.** 그러면 화면은 깨어나 `reload()` 하고, 다시 떠서
// 또 같은 자를 걸고 — **새로고침 고리**가 된다. 막힌 사람이 화면을 읽지 못한다.
// (지금 정지는 7일까지라 아직 안 났다. 더 긴 정지가 생기는 날 난다. 영구 정지는
//  `until` 이 없어 이 자리에 아예 안 온다)
//
// 그래서 **한 번에 하루까지만** 건다. 깨어나서 남은 때를 다시 재고 또 하루를 건다 —
// 긴 기다림을 짧은 자 여럿으로 나누는 흔한 꼴이다.
//
// **판단만 여기 둔다** — 화면도 타이머도 안 만진다. 그래야 `npm run check` 가
// 브라우저 없이 돌려볼 수 있다.

/** 한 번에 걸 수 있는 가장 긴 기다림 (하루). `2^31`ms 보다 한참 아래다 */
export const WAKE_STEP_MAX = 24 * 60 * 60 * 1000;

/** `setTimeout` 이 접히기 시작하는 값 — 이 자가 넘지 않아야 하는 선 */
export const TIMER_MAX = 2 ** 31 - 1;

/**
 * 지금 무엇을 할까.
 *
 * @returns {{ kind: 'none' | 'open' | 'wait', wait?: number }}
 *   none — 기한이 없거나 못 읽는 값이다 (영구 정지 · 차단). 자를 걸지 않는다
 *   open — 이미 지났다. 그 자리에서 풀어준다
 *   wait — `wait`ms 뒤에 다시 와라. **하루를 넘지 않는다**
 */
export function nextWake(until, now = Date.now()) {
  if (!until) return { kind: 'none' };
  const end = until instanceof Date ? until.getTime() : new Date(until).getTime();
  if (Number.isNaN(end)) return { kind: 'none' };
  const left = end - now;
  if (left <= 0) return { kind: 'open' };
  // 1초를 더해 건다 — 자가 1ms 일찍 깨면 그 자리에서 또 `wait` 가 된다
  return { kind: 'wait', wait: Math.min(left + 1000, WAKE_STEP_MAX) };
}
