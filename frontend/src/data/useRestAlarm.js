import { useEffect, useRef } from 'react';
import { canRestAlarm, askRestAlarmOnce, scheduleRestAlarm, cancelRestAlarm } from './restAlarm';

// 쉬는 동안 **앱이 뒤로 가면** 끝 시각에 OS 알림을 걸어둔다 (2026-10-16).
//
// 까닭과 지키는 선은 `restAlarm.js` 머리글에 적었다. 여기는 **언제 걸고 언제 지우는가**만 본다.
//
//   앱이 뒤로 감 (주머니 · 화면 끔 · 다른 앱)  → 건다
//   앱으로 돌아옴                              → 지운다 (띠가 제때 울린다)
//   휴식이 끝나거나 · 멈추거나 · 꺼짐          → 지운다
//
// **이미 울린 뒤에 돌아왔는지 알려준다.** 주머니에서 알림을 받고 3분 뒤에 앱을 열면,
// 멈춰 있던 타이머가 그제서야 `finished` 를 세우고 띠가 삑 소리를 낸다 — 이미 들은
// 알림을 다시 울리는 것이다. 돌려주는 값(`fired`)이 그때 `true` 다.
//
// **둘 다 울리지 않게 하려는 것이다.** 돌아와 있는 동안에는 띠의 삑 소리 하나,
// 뒤로 가 있는 동안에는 OS 알림 하나.
//
// `deadline` 이 바뀌면(+30초) 다시 건다 — 예약 번호가 같아서 덮어쓴다.
//
// **훅은 이른 반환보다 위에 둔다** (`RestBar` 에서 `useWakeLock` 과 같은 자리).
export function useRestAlarm(deadline, body = '') {
  // 걸어둔 알림이 **이미 울렸나.** 띠가 삑 소리를 낼지 말지 이것으로 가린다
  const fired = useRef(false);
  // 알림에 적을 줄은 **다시 걸 거리가 아니다.** 이것까지 의존성에 넣으면
  // 「다음 · 3세트」가 바뀔 때마다 예약을 지웠다 다시 건다
  const bodyRef = useRef(body);
  bodyRef.current = body;

  useEffect(() => {
    if (!deadline || !canRestAlarm()) return undefined;

    let live = true;
    let off = null;
    let armed = false;           // 걸어둔 적이 있나
    fired.current = false;       // 새 휴식이다 — 처음부터 센다

    // 묻는 것은 **지금** — 화면이 떠 있는 이 순간뿐이다. 뒤로 간 뒤에는 창을 못 띄운다
    askRestAlarmOnce();

    const apply = (active) => {
      if (!live) return;
      if (active) {
        // 걸어둔 것이 **이미 울릴 시각을 지나서** 돌아왔다 — 사람은 벌써 들었다
        if (armed && Date.now() >= deadline) fired.current = true;
        cancelRestAlarm();
      } else {
        armed = true;
        scheduleRestAlarm(deadline, bodyRef.current);
      }
    };

    // 이 효과가 설 때 이미 뒤로 가 있을 수 있다 (화면이 꺼진 채 +30초가 눌린 적은 없지만,
    // 자동 시작은 저장과 함께 일어난다 — 그 사이에 화면이 꺼질 수 있다)
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') apply(false);

    import('@capacitor/app').then(({ App }) => {
      if (!live) return;
      App.addListener('appStateChange', ({ isActive }) => apply(isActive))
        .then((h) => { if (live) off = h; else h.remove(); });
    }).catch(() => {});

    return () => {
      live = false;
      off?.remove();
      cancelRestAlarm();
    };
  }, [deadline]);

  return fired;
}

export default useRestAlarm;
