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

  updateRecord: async (id, record) => {
    const { data } = await client.put(`/inbody/${id}`, record);
    get().fetchAll().catch(() => {});
    return data;
  },

  deleteRecord: async (id) => {
    const prev = get().records;
    set({ records: prev.filter(r => r.id !== id) });
    try {
      await client.delete(`/inbody/${id}`);
    } catch {
      set({ records: prev });
      throw new Error('삭제 실패');
    }
  },
}));
