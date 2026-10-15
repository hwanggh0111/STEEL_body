// 꾹 누르면 **계속 오른다** (2026-10-15)
//
// ── 왜 ──
//
// 세트를 적는 칸은 숫자 자판이 뜨게 해뒀다(`inputMode`). 거기까지는 맞다.
// 그런데 **± 단추가 없어서** 지난번 80kg 에서 82.5kg 로 올리려면
// `칸을 누르고 → 자판이 올라오고 → 지우고 → 치고 → 자판을 내린다`.
// 그게 **세트마다**고, 그 사이 자판이 저장 단추와 원판 안내를 덮는다.
//
// ± 를 붙이면 한 번에 2.5kg 이다. 그런데 60kg 에서 100kg 으로 가려면 열여섯 번이다 —
// 그래서 **꾹 누르면 이어지게** 한다.
//
// ── 지키는 것 ──
//
// 1. **짧게 탭하면 한 번만.** 꾹 누르기를 붙이면서 탭이 두 번 세어지는 일이 흔하다
// 2. **손을 떼는 것은 `window` 에서 받는다.** 반복 중에 그 단추가 `disabled` 되면
//    (상한에 닿았을 때) 그 요소로는 `pointerup` 이 **오지 않는다** — 단추에만 걸어두면
//    손을 떼도 계속 오른다
// 3. **앱을 나가거나 창이 포커스를 잃으면 멈춘다.** 헬스장에서 전화가 오면 그대로
//    돌고 있을 자리다
// 4. **동작이 `false` 를 주면 멈춘다.** 상한에 닿았으면 더 돌 이유가 없다

import { useCallback, useEffect, useRef } from 'react';

const 시작까지 = 380;      // 이만큼 누르고 있으면 「꾹」으로 본다
const 첫간격 = 170;
const 최소간격 = 40;
const 줄이는비 = 0.85;     // 간격이 점점 짧아진다 — 멀리 갈 때 빨리 간다

/**
 * @param {(isRepeat: boolean) => boolean|void} action
 *   누를 때마다 부른다. 첫 누름은 `false`, 꾹 눌러 이어지는 동안은 `true`.
 *   `false` 를 돌려주면 그 자리에서 멈춘다.
 * @returns {{onPointerDown: Function, onClick: Function}}
 *   단추에 그대로 펼쳐 넣는다 — `<button {...hold(() => …)} />`
 */
export function useHoldRepeat(action) {
  const timer = useRef(null);      // 「꾹」이 시작되기를 기다리는 타이머
  const tick = useRef(null);       // 이어서 도는 타이머
  const gap = useRef(첫간격);
  const repeated = useRef(false);  // 이번 누름이 꾹 눌림까지 갔나
  const act = useRef(action);
  act.current = action;

  const stop = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (tick.current) { clearTimeout(tick.current); tick.current = null; }
    gap.current = 첫간격;
  }, []);

  // 손을 떼는 것 · 앱을 나가는 것 · 창이 포커스를 잃는 것을 **window 에서** 받는다
  useEffect(() => {
    const off = () => stop();
    window.addEventListener('pointerup', off);
    window.addEventListener('pointercancel', off);
    window.addEventListener('blur', off);
    document.addEventListener('visibilitychange', off);
    return () => {
      stop();
      window.removeEventListener('pointerup', off);
      window.removeEventListener('pointercancel', off);
      window.removeEventListener('blur', off);
      document.removeEventListener('visibilitychange', off);
    };
  }, [stop]);

  const run = useCallback(() => {
    const ok = act.current(true);
    if (ok === false) { stop(); return; }
    gap.current = Math.max(최소간격, Math.round(gap.current * 줄이는비));
    tick.current = setTimeout(run, gap.current);
  }, [stop]);

  const onPointerDown = useCallback((e) => {
    // 오른쪽 단추 · 가운데 단추는 비킨다
    if (e.button !== undefined && e.button !== 0) return;
    repeated.current = false;
    // **첫 한 번은 여기서 한다.** `click` 을 기다리면 손가락을 뗄 때까지 아무 일도
    // 안 나서 「안 눌렸나」 하고 한 번 더 누르게 된다
    const ok = act.current(false);
    if (ok === false) return;
    stop();
    timer.current = setTimeout(() => {
      repeated.current = true;
      run();
    }, 시작까지);
  }, [run, stop]);

  // `pointerdown` 에서 이미 한 번 했으므로 **click 은 흘린다.**
  // 다만 키보드로 누른 것(Enter · Space)은 `pointerdown` 이 없다 —
  // 그때는 `detail === 0` 이라 그것만 받는다.
  //
  // **키보드 꾹 누르기를 따로 만들지 않는다.** 처음에 `keydown` 의 `e.repeat` 로
  // 이어가게 했는데, 브라우저는 단추에서 Enter 를 누르고 있으면 **click 을 스스로
  // 되풀이해 보낸다** — 그래서 한 번 누를 때 두 번 올라갔다. 되풀이는 브라우저에
  // 맡기고 여기서는 click 만 센다. (Space 는 떼는 순간 한 번만 온다 — 그게 맞다)
  const onClick = useCallback((e) => {
    if (e.detail === 0) act.current(false);
  }, []);

  return { onPointerDown, onClick };
}
