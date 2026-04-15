import { create } from 'zustand';
import client from '../api/client';

export const useInbodyStore = create((set, get) => ({
  records: [],
  loading: false,

  fetchAll: async () => {
    set({ loading: true });
    try {
      const { data } = await client.get('/inbody');
      set({ records: data, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addRecord: async (record) => {
    const { data } = await client.post('/inbody', record);
    await get().fetchAll();
    return data;
  },

  deleteRecord: async (id) => {
    await client.delete(`/inbody/${id}`);
    await get().fetchAll();
  },
}));
