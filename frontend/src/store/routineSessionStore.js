import { create } from 'zustand';
import client from '../api/client';
import { sessionEpoch, isSameSession } from './session';
import { isOfflineError } from '../data/offline';
import {
  queueSets, queueState, dropIndex, markSessionFailed, pendingIndexes, pendingCount,
  applyQueue, trimQueue, readSessionQueue, saveSessionQueue, clearSessionQueue,
} from '../data/offlineSession';

// 진행 중인 루틴.
//
// 두 화면이 같은 것을 본다 — 루틴 화면(시작하는 곳)과 기록 화면(진행하는 곳).
// 각자 들고 있으면 한쪽에서 끝내도 다른 쪽은 계속 하던 줄 안다.
//
// **불러오기는 한 번만 나간다.** 기록 화면이 열릴 때마다 부르는데, 진행 중인 것이
// 없으면 그것도 답이다 — 없다는 것을 알고 나면 다시 묻지 않는다 (시작하면 그때 채운다).
//
// ── **지하에서도 이어진다** ── (2026-11-04)
//
// 11/04 에 「지하에서 루틴으로 운동하면 기록이 한 줄도 안 적혔다」를 고쳤다. 기록은
// 줄에 서게 됐지만 **진행표는 서버에만 있어서** 칸이 한 칸도 안 넘어갔다 — 여덟 칸
// 루틴이 끝까지 1/8 이고 화면은 그 운동을 계속 물었다.
//
// 그래서 `workoutStore` 와 **같은 둘**을 든다.
//
//   server  서버가 준 진행표
//   queue   못 올린 누름 (세트 체크 · 칸 넘김) — 기기에 담는다
//   session **화면이 보는 것** = server 위에 queue 를 얹은 것
//
// 셈은 `data/offlineSession.js` 한 자리에 있다 — `npm run basement` 가 값으로 본다.
// 화면은 여태처럼 `session` 만 본다(고칠 것이 없다).

// 진행표 한 벌. 화면은 `session.items` 를 바로 map 으로 돈다 —
// 모양이 다른 것이 들어오면 화면이 통째로 죽으므로 여기서 한 번 거른다.
// 없는 것(null)은 정상이다. **모양이 아닌 것만 없는 것으로 친다.**
const asSession = (v) =>
  (v && typeof v === 'object' && !Array.isArray(v) && Array.isArray(v.items)) ? v : null;

// 세트 체크를 누른 순번. 늦게 도착한 옛 답이 새 체크를 덮지 않게 한다
let checkSeq = 0;

export const useRoutineSessionStore = create((set, get) => ({
  server: null,
  session: null,
  queue: {},
  // 못 올린 누름을 **이 기기에도 담지 못했다** (자리가 없거나 막혀 있다).
  // 화면이 이것을 보고 말을 고른다 — 운동 줄(`workoutStore.unsaved`)과 같은 결
  unsaved: false,
  loaded: false,
  loading: false,

  /** 서버 것과 줄을 한 자리에서 맞춘다. **담는 일도 여기서 한 번만** 한다 */
  apply: (server, queue, { keep = false } = {}) => {
    const nextServer = server === undefined ? get().server : server;
    // **진행표에 없는 칸은 걷어낸다** — 없는 칸을 「올릴 것」으로 세면 사람이
    // 무엇을 올리려는지 알 수 없다 (까닭은 `offlineSession.trimQueue`)
    const nextQueue = nextServer
      ? trimQueue(queue === undefined ? get().queue : queue, nextServer.items?.length)
      : (queue === undefined ? get().queue : queue);
    let kept = true;
    if (!keep) kept = saveSessionQueue(nextQueue, nextServer?.startedAt);
    set({
      server: nextServer,
      queue: nextQueue,
      session: applyQueue(nextServer, nextQueue),
      unsaved: pendingCount(nextQueue) > 0 && !kept,
    });
    return kept;
  },

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
      const server = asSession(data?.session);
      // **담아둔 줄을 그 진행표에 맞춰 다시 얹는다.** 앱을 닫았다 열어도 지하에서
      // 누른 것이 그대로 보인다 — 루틴이 바뀌었으면 `readSessionQueue` 가 버린다
      get().apply(server, readSessionQueue(server?.startedAt), { keep: true });
      set({ loaded: true, loading: false });
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
    // 새로 시작하면 **앞 줄은 버린다** — 자리 번호의 뜻이 달라진다
    get().apply(next, {});
    set({ loaded: true });
    return next;
  },

  // 한 칸을 끝냈거나 건너뛴다. 마지막 칸이면 서버가 진행표를 지우고 finished 를 준다
  mark: async (index, state) => {
    const mine = sessionEpoch();
    try {
      const { data } = await client.patch('/routine-session', { index, state });
      if (!isSameSession(mine)) return data;
      // 올라갔으면 줄에 남아 있던 그 칸은 뺀다 (표시로 남아 있을 수 있다)
      get().apply(asSession(data?.session), dropIndex(get().queue, index));
      set({ loaded: true });
      return data;
    } catch (err) {
      // 다른 기기에서 다른 루틴을 시작하면 이쪽에 남은 자리 번호가 어긋난다.
      // 서버가 지금 진행표를 같이 준다 — 그걸로 갈아끼우지 않으면 화면은 죽은 진행표를
      // 계속 붙들고, 누를 때마다 조용히 실패한다
      const fresh = err?.response?.data;
      if (!isSameSession(mine)) throw err;
      if (err?.response?.status === 409 && fresh && 'session' in fresh) {
        get().apply(asSession(fresh.session), {});
        set({ loaded: true });
        throw err;
      }
      if (isOfflineError(err)) {
        // ── **줄에 세운다** ── (2026-11-04, D안)
        //
        // 여태 여기서 던지고 끝이었다 — 화면은 「신호가 없어 진행표는 안 넘어갔어요」를
        // 띄우고 **그 칸에 그대로 머물렀다.** 지하에서 여덟 칸을 다 해도 끝까지 1/8 이다.
        // 이제 담아두고 다음 칸으로 넘어간다. 신호가 오면 `flush` 가 올린다
        const kept = get().apply(undefined, queueState(get().queue, index, state));
        const shown = get().session;
        // 다 지나갔으면 **끝난 것으로 말해준다** — 결산은 기록(줄에 선 것)으로 짜므로
        // 지하에서도 그릴 수 있다. 서버는 나중에 줄이 올라갈 때 진행표를 지운다
        const finished = !!shown?.items?.length && shown.items.every((i) => i.state !== 'todo');
        return { queued: true, unsaved: !kept, finished, name: shown?.name, total: shown?.items?.length ?? 0 };
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
    const prevQueue = get().queue;
    const mine = sessionEpoch();
    // 먼저 화면에 얹는다 (담는 것은 아직 — 올라가면 담을 일이 없다)
    get().apply(undefined, queueSets(prevQueue, index, setsDone), { keep: true });
    const seq = ++checkSeq;
    try {
      const { data } = await client.patch('/routine-session', { index, setsDone });
      if (seq === checkSeq && isSameSession(mine)) {
        get().apply(asSession(data?.session), dropIndex(get().queue, index));
        set({ loaded: true });
      }
      return { queued: false };
    } catch (err) {
      const fresh = err?.response?.data;
      // 나간 뒤에는 되돌리지도 않는다 — 되돌릴 자리가 다음 사람 화면이다
      if (!isSameSession(mine)) throw err;
      if (err?.response?.status === 409 && fresh && 'session' in fresh) {
        get().apply(asSession(fresh.session), {});
        set({ loaded: true });
        throw err;
      }
      if (isOfflineError(err)) {
        // ── **지하에서는 되돌리지 않는다. 담아둔다** ── (2026-11-04)
        //
        // 헬스장은 지하가 많다(이 앱이 거듭 적어둔 말이다). 신호가 없을 때 눌린 것을
        // 되돌리면 **사람이 한 세트가 화면에서 사라진다** — 다시 눌러도 또 사라진다.
        // 서버가 「안 된다」고 말한 것(400·409)과 **답을 못 받은 것**은 다르다.
        //
        // 11/04 아침까지는 화면에만 남기고 담지는 않았다(앱을 닫으면 사라졌다).
        // 이제 담는다 — 누른 것은 사람이 한 일이고, 어디에도 없는 값이다
        const kept = get().apply(undefined, get().queue);
        return { queued: true, unsaved: !kept };
      }
      // 서버가 거절한 것은 되돌린다 — 다시 눌러야 하는 자리다
      if (seq === checkSeq) get().apply(undefined, prevQueue, { keep: true });
      throw err;
    }
  },

  /**
   * 담아둔 누름을 올린다. 신호가 돌아왔을 때 · 앱이 뜰 때 (`Layout` 이 부른다).
   *
   * **자리 번호 차례로, 한 칸씩 지금 있는 길로 보낸다.** 새 길(batch)을 내지 않는
   * 까닭은 서버 테두리와 자를 또 세워야 하는데 그만한 값이 없어서다.
   *
   * 한 칸에 둘이 쌓여 있으면 **세트 수를 먼저, 칸 넘김을 나중에** 보낸다 —
   * 서버의 `state` 는 칸을 넘기는 일이라, 넘긴 뒤에 세트 수를 보내면 튕긴다.
   */
  flush: async () => {
    if (get().flushing) return { sent: 0, failed: 0, stopped: false };
    const list = pendingIndexes(get().queue);
    if (list.length === 0) return { sent: 0, failed: 0, stopped: false };
    const mine = sessionEpoch();
    set({ flushing: true });
    let sent = 0;
    let failed = 0;
    let stopped = false;
    try {
      for (const index of list) {
        if (!isSameSession(mine)) { stopped = true; break; }
        const row = get().queue[index];
        if (!row) continue;
        try {
          let data = null;
          if (row.setsDone !== undefined) {
            ({ data } = await client.patch('/routine-session', { index, setsDone: row.setsDone }));
          }
          if (row.state !== undefined) {
            ({ data } = await client.patch('/routine-session', { index, state: row.state }));
          }
          if (!isSameSession(mine)) { stopped = true; break; }
          // 마지막 칸이었으면 서버가 진행표를 지우고 `session: null` 을 준다
          get().apply(asSession(data?.session), dropIndex(get().queue, index));
          sent += 1;
        } catch (err) {
          if (isOfflineError(err)) { stopped = true; break; }
          if (!isSameSession(mine)) { stopped = true; break; }
          const fresh = err?.response?.data;
          if (err?.response?.status === 409 && fresh && 'session' in fresh) {
            // 다른 기기가 다른 루틴을 시작했다 — **줄을 버리고 서버 것으로 간다.**
            // 자리 번호의 뜻이 달라졌으므로 남은 줄은 얹을 자리가 없다
            get().apply(asSession(fresh.session), {});
            stopped = true;
            break;
          }
          // 서버가 「그렇게는 안 받는다」고 답한 것은 다시 보내도 같다 — 표시만 해두고
          // 다음 칸으로 간다. 그 하나 때문에 뒤의 것이 영영 못 올라가면 안 된다
          const reason = err?.response?.data?.error || '서버가 받지 않았어요';
          get().apply(undefined, markSessionFailed(get().queue, index, reason));
          failed += 1;
        }
      }
    } finally {
      set({ flushing: false });
    }
    return { sent, failed, stopped };
  },

  flushing: false,

  stop: async () => {
    const mine = sessionEpoch();
    await client.delete('/routine-session');
    if (!isSameSession(mine)) return;
    clearSessionQueue();
    set({ server: null, session: null, queue: {}, unsaved: false, loaded: true });
  },

  // 로그아웃할 때 비운다 — 안 비우면 다음에 로그인한 사람이 남의 진행표를 본다.
  // **담아둔 줄도 같이 지운다** (`SESSION_QUEUE_KEY` 는 `PER_USER_KEYS` 에도 있다 —
  // 둘 다 하는 까닭은 로그아웃이 아닌 길로도 이것을 부를 수 있어서다)
  reset: () => {
    clearSessionQueue();
    set({ server: null, session: null, queue: {}, unsaved: false, loaded: false, loading: false, flushing: false });
  },
}));
