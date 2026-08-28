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

export const useInbodyStore = create((set, get) => ({
  records: [],
  loading: false,

  fetchAll: (force = false) => {
    if (inflight) return inflight;
    if (!force && fetchedAt && Date.now() - fetchedAt < FRESH_MS) return Promise.resolve();
    set({ loading: true });
    inflight = (async () => {
      try {
        const { data } = await client.get('/inbody');
        // 서버는 배열을 준다. 다른 모양이 오면 빈 것으로 친다 —
        // records 는 세 화면이 그대로 map 으로 돌린다
        set({ records: Array.isArray(data) ? data : [], loading: false });
        fetchedAt = Date.now();
      } catch {
        set({ loading: false });
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },

  addRecord: async (record) => {
    const { data } = await client.post('/inbody', record);
    get().fetchAll(true).catch(() => {});
    return data;
  },

  updateRecord: async (id, record) => {
    const { data } = await client.put(`/inbody/${id}`, record);
    get().fetchAll(true).catch(() => {});
    return data;
  },

  deleteRecord: async (id) => {
    const prev = get().records;
    set({ records: prev.filter(r => r.id !== id) });
    try {
      await client.delete(`/inbody/${id}`);
      fetchedAt = 0;   // 다음 요청은 새로 받는다
    } catch {
      set({ records: prev });
      throw new Error('삭제 실패');
    }
  },
}));
