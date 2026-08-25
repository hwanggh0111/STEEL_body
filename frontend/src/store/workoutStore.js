import { create } from 'zustand';
import client from '../api/client';

export const useWorkoutStore = create((set, get) => ({
  workouts: {},
  loading: false,

  fetchAll: async () => {
    set({ loading: true });
    try {
      const { data } = await client.get('/workouts');
      const grouped = data.reduce((acc, w) => {
        if (!acc[w.date]) acc[w.date] = [];
        acc[w.date].push(w);
        return acc;
      }, {});
      set({ workouts: grouped, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addWorkout: async (workout) => {
    const { data } = await client.post('/workouts', workout);
    // **다시 받아오는 것을 기다린다.** 안 기다리면 저장 직후의 workouts 가 방금 넣은
    // 것을 모르는 상태로 잠깐 남는다. 최고 기록은 「넣기 전」의 목록과 견주는데,
    // 그 사이에 한 번 더 저장하면 앞의 것을 못 보고 견줘서 최고 기록이 잘못 뜬다.
    // (벤치 85 를 넣고 곧바로 82 를 넣으면 82 가 최고 기록이라고 뜬다)
    await get().fetchAll().catch(() => {});
    return data;
  },

  updateWorkout: async (id, workout) => {
    const { data } = await client.put(`/workouts/${id}`, workout);
    get().fetchAll().catch(() => {});
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
    } catch {
      // 실패 시 롤백
      set({ workouts: prev });
      throw new Error('삭제 실패');
    }
  },
}));
