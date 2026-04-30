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
    get().fetchAll().catch(() => {});
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
