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
    get().fetchAll().catch(() => {});
    return data;
  },

  deleteRecord: async (id) => {
    await client.delete(`/inbody/${id}`);
    get().fetchAll().catch(() => {});
  },
}));
