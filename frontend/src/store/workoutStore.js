import { create } from 'zustand';
import client from '../api/client';

// 화면마다 mount 될 때 목록을 받는다 — 홈 · 기록 · 히스토리 · 인바디 · 비교 · 검색.
// 그대로 두면 화면을 옮길 때마다 통째로 다시 받는다. 두 가지로 막는다.
//
//   inflight : 같은 요청이 날아가 있으면 그것을 같이 기다린다 (두 화면이 동시에 열려도 한 번)
//   FRESH_MS : 방금 받아온 것은 잠깐 다시 쓴다. **저장·수정 뒤에는 force 로 새로 받는다**
//
// 다른 기기에서 바뀐 것은 최대 이만큼 늦게 보인다. 기록 앱에서 30초는 짧다.
const FRESH_MS = 30000;
let inflight = null;
let fetchedAt = 0;

// 로그아웃할 때 authStore 가 부른다. 안 비우면 다음 사람이 앞 사람 것을 잠깐 본다
export function resetCache() {
  inflight = null;
  fetchedAt = 0;
}

export const useWorkoutStore = create((set, get) => ({
  workouts: {},
  loading: false,

  fetchAll: (force = false) => {
    if (inflight) return inflight;
    if (!force && fetchedAt && Date.now() - fetchedAt < FRESH_MS) return Promise.resolve();
    set({ loading: true });
    inflight = (async () => {
      try {
        const { data } = await client.get('/workouts');
        // 배열이 아니면 빈 것으로 친다. 아래 reduce 가 터지면 catch 로 빠지면서
        // 화면은 아무 말 없이 옛 목록을 그대로 들고 있는다
        const grouped = (Array.isArray(data) ? data : []).reduce((acc, w) => {
          if (!acc[w.date]) acc[w.date] = [];
          acc[w.date].push(w);
          return acc;
        }, {});
        set({ workouts: grouped, loading: false });
        fetchedAt = Date.now();
      } catch {
        set({ loading: false });
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },

  addWorkout: async (workout) => {
    const { data } = await client.post('/workouts', workout);
    // **다시 받아오는 것을 기다린다.** 안 기다리면 저장 직후의 workouts 가 방금 넣은
    // 것을 모르는 상태로 잠깐 남는다. 최고 기록은 「넣기 전」의 목록과 견주는데,
    // 그 사이에 한 번 더 저장하면 앞의 것을 못 보고 견줘서 최고 기록이 잘못 뜬다.
    // (벤치 85 를 넣고 곧바로 82 를 넣으면 82 가 최고 기록이라고 뜬다)
    await get().fetchAll(true).catch(() => {});
    return data;
  },

  updateWorkout: async (id, workout) => {
    const { data } = await client.put(`/workouts/${id}`, workout);
    get().fetchAll(true).catch(() => {});
    return data;
  },

  deleteWorkout: async (id) => {
    // 낙관적 업데이트: 먼저 UI에서 제거
    const prev = get().workouts;
    const updated = {};
    for (const [date, items] of Object.entries(prev)) {
      const filtered = items.filter(w => w.id !== id);
      if (filtered.length > 0) updated[date] = filtered;
    }
    set({ workouts: updated });
    try {
      await client.delete(`/workouts/${id}`);
      // 지운 것은 화면에서 이미 뺐다. 다시 받을 필요는 없지만, 다음 요청이
      // 옛 것을 그대로 쓰지 않도록 「새로 받아야 함」으로 표시해 둔다
      fetchedAt = 0;
    } catch {
      // 실패 시 롤백
      set({ workouts: prev });
      throw new Error('삭제 실패');
    }
  },
}));
