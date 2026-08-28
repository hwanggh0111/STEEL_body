import { create } from 'zustand';
import client from '../api/client';

// 진행 중인 루틴.
//
// 두 화면이 같은 것을 본다 — 루틴 화면(시작하는 곳)과 기록 화면(진행하는 곳).
// 각자 들고 있으면 한쪽에서 끝내도 다른 쪽은 계속 하던 줄 안다.
//
// **불러오기는 한 번만 나간다.** 기록 화면이 열릴 때마다 부르는데, 진행 중인 것이
// 없으면 그것도 답이다 — 없다는 것을 알고 나면 다시 묻지 않는다 (시작하면 그때 채운다).

// 진행표 한 벌. 화면은 `session.items` 를 바로 map 으로 돈다 —
// 모양이 다른 것이 들어오면 화면이 통째로 죽으므로 여기서 한 번 거른다.
// 없는 것(null)은 정상이다. **모양이 아닌 것만 없는 것으로 친다.**
const asSession = (v) =>
  (v && typeof v === 'object' && !Array.isArray(v) && Array.isArray(v.items)) ? v : null;

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
      set({ session: asSession(data?.session), loaded: true, loading: false });
    } catch {
      // 못 불러와도 기록 화면은 그대로 써야 한다. 진행표만 안 보인다
      set({ loaded: true, loading: false });
    }
  },

  start: async (routineId) => {
    const { data } = await client.post('/routine-session', { routineId });
    const next = asSession(data?.session);
    set({ session: next, loaded: true });
    return next;
  },

  // 한 칸을 끝냈거나 건너뛴다. 마지막 칸이면 서버가 진행표를 지우고 finished 를 준다
  mark: async (index, state) => {
    try {
      const { data } = await client.patch('/routine-session', { index, state });
      set({ session: asSession(data?.session), loaded: true });
      return data;
    } catch (err) {
      // 다른 기기에서 다른 루틴을 시작하면 이쪽에 남은 자리 번호가 어긋난다.
      // 서버가 지금 진행표를 같이 준다 — 그걸로 갈아끼우지 않으면 화면은 죽은 진행표를
      // 계속 붙들고, 누를 때마다 조용히 실패한다
      const fresh = err?.response?.data;
      if (err?.response?.status === 409 && fresh && 'session' in fresh) {
        set({ session: asSession(fresh.session), loaded: true });
      }
      throw err;
    }
  },

  stop: async () => {
    await client.delete('/routine-session');
    set({ session: null, loaded: true });
  },

  // 로그아웃할 때 비운다 — 안 비우면 다음에 로그인한 사람이 남의 진행표를 본다
  reset: () => set({ session: null, loaded: false, loading: false }),
}));
