import { useEffect } from 'react';

// 운동하는 동안 화면을 안 재운다.
//
// **기능성운동 화면에만 있었다.** 40초 플랭크를 하는데 30초에 화면이 꺼지면 남은
// 시간도 다음이 뭔지도 못 본다 — 그래서 거기에 먼저 넣었다. 그런데 정작 매일 겪는
// 자리는 **루틴 진행과 휴식 타이머**다. 90초 쉬는 동안 화면이 꺼지고, 다음 세트를
// 하려면 폰을 깨워서 잠금을 풀어야 한다. 세트마다 그런다.
//
// 코드가 이미 앱 안에 있었으므로 **옮겨서 셋이 같이 쓴다** (2026-09-17).
// 복붙하지 않는다 — 같은 것을 세 곳에 두면 반드시 한 곳만 고쳐진다.
//
// ── 알아둘 것 ──
//
// **브라우저가 알아서 놓는다.** 화면이 가려지거나(다른 앱 · 잠금) 탭을 벗어나면
// 잠금이 풀린다. 그래서 돌아왔을 때 다시 잡아야 한다 — `visibilitychange` 가 그 일이다.
//
// **없는 브라우저가 있다** (사파리 일부 · 안드로이드 웹뷰도 볼 것). 그때는 조용히
// 넘어간다 — 이것만 믿고 다른 것을 빼지 않는다. 화면이 꺼져도 타이머는 끝나는 시각을
// 보고 돌기 때문에 시간이 어긋나지는 않는다.
//
// **놓는 것을 잊으면 배터리가 탄다.** 그래서 `active` 가 꺼지는 순간과 이 부품이
// 화면에서 사라지는 순간 둘 다에서 놓는다.
export function useWakeLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    // navigator 자체가 없는 자리(서버 렌더 검사)에서도 안 터진다
    if (typeof navigator === 'undefined' || !navigator.wakeLock) return undefined;

    let lock = null;
    let dropped = false;

    const grab = () => navigator.wakeLock.request('screen')
      // 잡는 사이에 꺼졌으면 곧바로 놓는다 — 안 그러면 주인 없는 잠금이 남는다
      .then((l) => { if (dropped) l.release().catch(() => {}); else lock = l; })
      .catch(() => {});

    grab();

    // 다른 앱을 봤다 돌아오면 잠금이 풀려 있다 — 다시 잡는다
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') grab();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      dropped = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [active]);
}

export default useWakeLock;
