import { create } from 'zustand';
import client from '../api/client';

// 진행 중인 루틴.
//
// 두 화면이 같은 것을 본다 — 루틴 화면(시작하는 곳)과 기록 화면(진행하는 곳).
// 각자 들고 있으면 한쪽에서 끝내도 다른 쪽은 계속 하던 줄 안다.
//
// **불러오기는 한 번만 나간다.** 기록 화면이 열릴 때마다 부르는데, 진행 중인 것이
// 없으면 그것도 답이다 — 없다는 것을 알고 나면 다시 묻지 않는다 (시작하면 그때 채운다).

export const useRoutineSessionStore = create((set, get) => ({
  session: null,
  loaded: false,
  loading: false,

  fetch: async (force = false) => {
    if (get().loading) return;
    if (get().loaded && !force) return;
    set({ loading: true });
    try {
      const { data } = await client.get('/routine-session');
      set({ session: data.session, loaded: true, loading: false });
    } catch {
      // 못 불러와도 기록 화면은 그대로 써야 한다. 진행표만 안 보인다
      set({ loaded: true, loading: false });
    }
  },

  start: async (routineId) => {
    const { data } = await client.post('/routine-session', { routineId });
    set({ session: data.session, loaded: true });
    return data.session;
  },

  // 한 칸을 끝냈거나 건너뛴다. 마지막 칸이면 서버가 진행표를 지우고 finished 를 준다
  mark: async (index, state) => {
    const { data } = await client.patch('/routine-session', { index, state });
    set({ session: data.session, loaded: true });
    return data;
  },

  stop: async () => {
    await client.delete('/routine-session');
    set({ session: null, loaded: true });
  },

  // 로그아웃할 때 비운다 — 안 비우면 다음에 로그인한 사람이 남의 진행표를 본다
  reset: () => set({ session: null, loaded: false, loading: false }),
}));
