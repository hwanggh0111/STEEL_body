import { create } from 'zustand';
import client from '../api/client';

// 목표.
//
// 한 사람당 **하나**다 — 목록이 아니라 값 하나라, 다른 스토어들과 달리 배열이 아니다.
// 그래도 받아오는 방식은 같게 둔다: 홈 · 목표 화면 둘이 각자 mount 될 때 부르는데,
// 그대로 두면 화면을 옮길 때마다 다시 받는다.
//
//   inflight : 같은 요청이 날아가 있으면 그것을 같이 기다린다
//   FRESH_MS : 방금 받아온 것은 잠깐 다시 쓴다 (세우거나 고친 뒤에는 곧바로 갈아끼운다)
const FRESH_MS = 30000;
let inflight = null;
let fetchedAt = 0;

// 로그아웃할 때 authStore 가 부른다. **안 비우면 다음에 로그인한 사람이
// 앞 사람의 목표를 잠깐 본다** — 체중 목표는 남에게 보일 것이 아니다
export function resetGoalCache() {
  inflight = null;
  fetchedAt = 0;
}

export const useGoalStore = create((set, get) => ({
  // null 은 「세운 목표가 없다」다. 아직 안 받아온 것과 구별하려고 `loaded` 를 따로 둔다 —
  // 구별 못 하면 홈이 받아오는 동안 「목표를 세워보세요」를 깜빡 띄웠다 지운다
  goal: null,
  loaded: false,
  loading: false,

  fetch: (force = false) => {
    // ── 날아가 있는 요청과 `force` ── (2026-09-18)
    //
    // 여태 **`force` 를 보기 전에** 날아가 있는 요청을 돌려줬다. 그런데 `force` 를
    // 쓰는 자리는 「방금 저장했으니 다시 받아라」다 — 그 요청은 **저장 전에 떠난
    // 것일 수 있고**, 그것을 기다려서 받으면 방금 넣은 것이 없는 목록이 온다.
    // 화면은 「저장했어요」를 띄우고도 새 줄을 안 보여준다 (다음 받기까지 30초).
    //
    // 그래서 `force` 면 **그것을 기다린 뒤 한 번 더 받는다.** 실패했어도 받는다 —
    // 남의 실패 때문에 내 새로고침이 사라지면 안 된다.
    if (inflight) {
      if (!force) return inflight;
      const waiting = inflight;
      return waiting.then(() => get().fetch(true), () => get().fetch(true));
    }
    if (!force && fetchedAt && Date.now() - fetchedAt < FRESH_MS) return Promise.resolve();
    set({ loading: true });
    inflight = (async () => {
      try {
        const { data } = await client.get('/goals');
        // 서버는 목표 하나 또는 null 을 준다. 배열이나 딴 것이 오면 없는 것으로 친다 —
        // 화면이 `goal.weeklyTarget` 을 바로 읽는다
        const row = data && typeof data === 'object' && !Array.isArray(data) ? data : null;
        set({ goal: row, loaded: true, loading: false });
        fetchedAt = Date.now();
      } catch {
        // 못 받아와도 화면은 그대로 돈다 — 목표는 홈의 곁다리다.
        // **loaded 는 안 켠다** — 못 받아온 것을 「목표가 없다」로 읽으면
        // 목표를 세워둔 사람에게 「목표를 세워보세요」가 뜬다
        set({ loading: false });
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },

  /** 세우거나 고친다. 서버가 돌려준 것을 그대로 들고 있는다 (다듬은 뒤의 값이다) */
  save: async (patch) => {
    const { data } = await client.put('/goals', patch);
    const row = data && typeof data === 'object' && !Array.isArray(data) ? data : null;
    set({ goal: row, loaded: true });
    fetchedAt = Date.now();
    return row;
  },

  /** 접는다. */
  clear: async () => {
    await client.delete('/goals');
    set({ goal: null, loaded: true });
    fetchedAt = Date.now();
  },

  reset: () => {
    resetGoalCache();
    set({ goal: null, loaded: false, loading: false });
  },
}));
