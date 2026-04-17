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

  deleteWorkout: async (id) => {
    await client.delete(`/workouts/${id}`);
    get().fetchAll().catch(() => {});
  },
}));
