import { create } from 'zustand';
import client from '../api/client';
import { sessionEpoch, isSameSession } from './session';
import { isOfflineError } from '../data/offline';

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

// 세트 체크를 누른 순번. 늦게 도착한 옛 답이 새 체크를 덮지 않게 한다
let checkSeq = 0;

export const useRoutineSessionStore = create((set, get) => ({
  session: null,
  loaded: false,
  loading: false,

  fetch: async (force = false) => {
    if (get().loading) return;
    if (get().loaded && !force) return;
    set({ loading: true });
    // 기다리기 전에 **지금 사람**을 받아 둔다 — 아래 `reset` 은 날아가 있는 요청을
    // 끊지 못한다 (까닭은 `store/session.js`)
    const mine = sessionEpoch();
    try {
      const { data } = await client.get('/routine-session');
      if (!isSameSession(mine)) return;
      set({ session: asSession(data?.session), loaded: true, loading: false });
    } catch {
      if (!isSameSession(mine)) return;
      // 못 불러와도 기록 화면은 그대로 써야 한다. 진행표만 안 보인다
      set({ loaded: true, loading: false });
    }
  },

  start: async (routineId) => {
    const mine = sessionEpoch();
    const { data } = await client.post('/routine-session', { routineId });
    const next = asSession(data?.session);
    if (!isSameSession(mine)) return null;
    set({ session: next, loaded: true });
    return next;
  },

  // 한 칸을 끝냈거나 건너뛴다. 마지막 칸이면 서버가 진행표를 지우고 finished 를 준다
  mark: async (index, state) => {
    const mine = sessionEpoch();
    try {
      const { data } = await client.patch('/routine-session', { index, state });
      if (!isSameSession(mine)) return data;
      set({ session: asSession(data?.session), loaded: true });
      return data;
    } catch (err) {
      // 다른 기기에서 다른 루틴을 시작하면 이쪽에 남은 자리 번호가 어긋난다.
      // 서버가 지금 진행표를 같이 준다 — 그걸로 갈아끼우지 않으면 화면은 죽은 진행표를
      // 계속 붙들고, 누를 때마다 조용히 실패한다
      const fresh = err?.response?.data;
      if (isSameSession(mine) && err?.response?.status === 409 && fresh && 'session' in fresh) {
        set({ session: asSession(fresh.session), loaded: true });
      }
      throw err;
    }
  },

  // 세트 하나를 체크한다(또는 푼다).
  //
  // **누르자마자 화면에 먼저 반영한다.** 세트 사이에 누르는 것이라 서버를 기다리면
  // 눌렀는지 안 눌렀는지 모르는 틈이 생기고, 그 틈에 한 번 더 누른다.
  // 빨리 연달아 누르면 답이 순서를 바꿔 올 수 있다 — **마지막으로 누른 것의 답만** 쓴다
  checkSet: async (index, setsDone) => {
    const prev = get().session;
    const mine = sessionEpoch();
    if (prev?.items?.[index]) {
      const items = prev.items.map((it, i) => (i === index ? { ...it, setsDone } : it));
      set({ session: { ...prev, items } });
    }
    const seq = ++checkSeq;
    try {
      const { data } = await client.patch('/routine-session', { index, setsDone });
      if (seq === checkSeq && isSameSession(mine)) set({ session: asSession(data?.session), loaded: true });
    } catch (err) {
      const fresh = err?.response?.data;
      // 나간 뒤에는 되돌리지도 않는다 — 되돌릴 자리가 다음 사람 화면이다
      if (!isSameSession(mine)) throw err;
      if (err?.response?.status === 409 && fresh && 'session' in fresh) {
        set({ session: asSession(fresh.session), loaded: true });
      } else if (isOfflineError(err)) {
        // ── **지하에서는 되돌리지 않는다** ── (2026-11-04)
        //
        // 헬스장은 지하가 많다(이 앱이 거듭 적어둔 말이다). 신호가 없을 때 눌린 것을
        // 되돌리면 **사람이 한 세트가 화면에서 사라진다** — 다시 눌러도 또 사라진다.
        // 서버가 「안 된다」고 말한 것(400·409)과 **답을 못 받은 것**은 다르다.
        //
        // 담아두지는 않는다 — 다음에 서버 답이 오면 **서버가 진실이다**(이 파일의
        // 다른 자리와 같은 선). 그 사이의 화면은 사람이 한 그대로를 보여준다.
        // **잃으면 안 되는 것은 기록**이고, 그쪽은 `workoutStore` 의 줄이 지킨다
      } else if (seq === checkSeq) {
        set({ session: prev });
      }
      throw err;
    }
  },

  stop: async () => {
    const mine = sessionEpoch();
    await client.delete('/routine-session');
    if (!isSameSession(mine)) return;
    set({ session: null, loaded: true });
  },

  // 로그아웃할 때 비운다 — 안 비우면 다음에 로그인한 사람이 남의 진행표를 본다
  reset: () => set({ session: null, loaded: false, loading: false }),
}));
