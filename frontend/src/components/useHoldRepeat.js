import { useEffect, useMemo, useRef } from 'react';

// 버튼을 누르고 있는 동안 같은 동작을 반복한다 (수량 스테퍼용).
//
// 교환 수량을 100장 담으려면 +10 을 열 번 눌러야 했다. "최대"는 지갑을 통째로
// 담는 것뿐이라 그 사이 값을 고르려면 연타밖에 방법이 없었다.
//
// action(arg, isRepeat) — isRepeat 은 처음 누른 순간 false, 꾹 눌러 반복되는 동안 true.
// 첫 누름과 반복이 다른 일을 해야 할 때 쓴다 (교환소 "최대": 탭이면 담기, 꾹이면 교환).
// action 이 false 를 돌려주면 그 자리에서 멈춘다 — 상한에 닿았다는 뜻이다.
// 반복 중에 버튼이 disabled 되면 그 요소로는 pointerup 이 오지 않으므로,
// 떼는 것은 창 전체에서 받는다. 안 그러면 손을 떼도 계속 오른다.

const HOLD_DELAY = 380;    // 첫 반복까지. 한 번 누름과 구분되는 최소 시간
const FIRST_STEP = 170;    // 반복 시작 간격
const MIN_STEP = 40;       // 가속의 하한 (초당 25회)
const ACCEL = 0.85;        // 반복마다 간격에 곱하는 값

export function useHoldRepeat(action) {
  // 최신 action 을 참조한다 — 반복 중 상태가 바뀌면 다음 tick 은 새 값을 봐야 한다
  const actionRef = useRef(action);
  actionRef.current = action;
  const argRef = useRef(undefined);

  // 타이머와 리스너는 마운트 동안 하나만 있으면 된다
  const ctl = useMemo(() => {
    const s = { timer: 0, bound: false };

    const stop = () => {
      if (s.timer) { clearTimeout(s.timer); s.timer = 0; }
      if (!s.bound) return;
      s.bound = false;
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', onHide);
    };

    // 홈 버튼으로 나가면 pointerup 이 안 온다. 돌아왔을 때 계속 오르고 있으면 안 된다.
    const onHide = () => { if (document.hidden) stop(); };

    const tick = (interval) => {
      s.timer = setTimeout(() => {
        s.timer = 0;
        if (actionRef.current(argRef.current, true) === false) { stop(); return; }
        tick(Math.max(MIN_STEP, interval * ACCEL));
      }, interval);
    };

    const begin = () => {
      stop();
      if (actionRef.current(argRef.current, false) === false) return;
      s.bound = true;
      window.addEventListener('pointerup', stop);
      window.addEventListener('pointercancel', stop);
      window.addEventListener('blur', stop);
      document.addEventListener('visibilitychange', onHide);
      tick(HOLD_DELAY);
    };

    return { begin, stop };
  }, []);

  useEffect(() => ctl.stop, [ctl]);

  // 버튼에 그대로 펼쳐 넣는다. arg 는 그 버튼이 올릴 양(+1, +10 …).
  const bind = (arg) => ({
    onPointerDown: (e) => {
      if (e.button !== 0) return;    // 마우스 오른쪽·가운데 클릭은 무시
      argRef.current = arg;
      ctl.begin();
    },
    // 키보드(Enter·Space)로 눌렀을 때만 여기서 실행한다.
    // 포인터로 누른 클릭은 detail > 0 이고 pointerdown 에서 이미 한 번 돌았다 — 두 번 세면 안 된다.
    onClick: (e) => {
      if (e.detail !== 0) return;
      argRef.current = arg;
      actionRef.current(arg, false);
    },
    // 모바일에서 꾹 누르면 뜨는 길게 누르기 메뉴를 막는다
    onContextMenu: (e) => e.preventDefault(),
  });

  return bind;
}
