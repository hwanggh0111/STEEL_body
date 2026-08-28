import { create } from 'zustand';
import client from '../api/client';

export const useInbodyStore = create((set, get) => ({
  records: [],
  loading: false,

  fetchAll: async () => {
    set({ loading: true });
    try {
      const { data } = await client.get('/inbody');
      // 서버는 배열을 준다. 다른 모양이 오면 빈 것으로 친다 —
      // records 는 세 화면이 그대로 map 으로 돌린다
      set({ records: Array.isArray(data) ? data : [], loading: false });
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
