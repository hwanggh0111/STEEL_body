import { create } from 'zustand';
import { useWorkoutStore } from './workoutStore';
import { useInbodyStore } from './inbodyStore';
import { useRoutineSessionStore } from './routineSessionStore';
import { useGoalStore } from './goalStore';
import { useReportStore } from './reportStore';
import { useGymStore } from './gymStore';

// 새로고침.
//
// **눌러서 다시 받을 길이 없었다.** 목록은 30초 동안은 받아둔 것을 다시 쓰고
// (`FRESH_MS`), 다른 기기에서 바뀐 것은 그만큼 늦게 보인다. 브라우저에서는 그래도
// 주소창 옆 단추가 있는데 —
//
//   · **안드로이드 앱(웹뷰)에는 주소창이 아예 없다**
//   · 홈 화면에 얹은 PWA 도 마찬가지다
//   · 폰에서 당겨서 새로고침도 안 된다 (직접 만든 적이 없다)
//
// 즉 **앱으로 쓰는 사람에게는 다시 받을 길이 하나도 없었다.** 폰과 PC 를 같이 쓰면
// 한쪽에서 적은 것이 다른 쪽에 안 보이는데, 할 수 있는 일은 앱을 껐다 켜는 것뿐이었다.
//
// ── 왜 화면을 다시 띄우지 않는가 ──
//
// 제일 쉬운 길은 `location.reload()` 다. 그런데 이 앱은 **운동하면서 쓴다** —
// 무게 칸에 80 을 쳐놓고 세트를 세는 중일 수 있다. 통째로 다시 띄우면 그게 날아가고,
// 조각을 다시 받느라 몇 초 멈춘다. **새로고침이 적던 것을 지우면 안 된다.**
//
// 그래서 **데이터만 다시 받는다.** 화면과 적던 값은 그대로 둔다.
//
// ── 화면마다 따로 안 만든다 ──
//
// 화면 여럿이 자기 것을 따로 받아온다(`/plans` · `/my-routines` · `/photos` …).
// 단추를 화면마다 두면 **어느 화면에서 눌렀느냐에 따라 새로고침의 뜻이 달라진다.**
// 여기서 `tick` 하나를 올리면, 그 값을 보고 있는 화면들이 자기 것을 다시 받는다 —
// 머리의 단추 하나가 어디서 눌러도 같은 일을 한다.

// 너무 자주 누르는 것을 막는다. 눌러도 아무 일도 안 일어난 것처럼 보이면 또 누른다
const MIN_GAP_MS = 1500;

export const useRefreshStore = create((set, get) => ({
  // 화면들이 보는 값. 올라가면 「자기 것을 다시 받으라」는 뜻이다
  tick: 0,
  busy: false,
  // 마지막으로 다시 받은 시각. 화면이 「방금」인지 「5분 전」인지 말해주는 데 쓴다
  at: null,

  refresh: async () => {
    const { busy, at } = get();
    if (busy) return false;
    // 연달아 누른 것은 한 번으로 친다
    if (at && Date.now() - at < MIN_GAP_MS) return false;

    set({ busy: true });
    try {
      // 여럿이 같이 쓰는 것은 여기서 직접 다시 받는다. **못 받아도 나머지는 받는다** —
      // 하나가 실패했다고 새로고침 전체가 실패로 끝나면, 쓸 수 있는 것까지 낡은 채로 남는다
      await Promise.allSettled([
        useWorkoutStore.getState().fetchAll(true),
        useInbodyStore.getState().fetchAll(true),
        useRoutineSessionStore.getState().fetch(true),
        useGoalStore.getState().fetch(true),
        // 제보함은 `force` 를 안 받는다 — 날아가 있는 요청이 있으면 그것을 같이 기다린다
        useReportStore.getState().fetchAll(),
        useGymStore.getState().fetch(true),
      ]);
      // 화면들이 자기 것을 다시 받게 한다. **공용 것을 받은 뒤에 올린다** —
      // 먼저 올리면 화면이 옛 공용 값으로 한 번 그려진다
      set({ tick: get().tick + 1, at: Date.now() });
      return true;
    } finally {
      set({ busy: false });
    }
  },
}));

/**
 * 화면이 자기 것을 다시 받을 때 보는 값.
 *
 * 쓰는 법은 **`useEffect` 의 마지막 deps 에 넣기만** 하면 된다 —
 *
 *   const tick = useRefreshTick();
 *   useEffect(() => { client.get('/plans')… }, [tick]);
 *
 * 화면마다 단추를 만들지 않으려고 이렇게 둔다.
 */
export function useRefreshTick() {
  return useRefreshStore((s) => s.tick);
}
