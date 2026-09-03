import { create } from 'zustand';
import client from '../api/client';
import {
  isOfflineError, isOnline, makeQueued, isLocalId, mergeQueue,
  dropFromQueue, markFailed, clearFailedMark, editInQueue,
  readQueue, saveQueue, readCache, saveCache,
} from '../data/offline';

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

// 서버가 준 목록을 날짜별로 묶는다
function groupByDate(list) {
  return (Array.isArray(list) ? list : []).reduce((acc, w) => {
    if (!w || !w.date) return acc;
    if (!acc[w.date]) acc[w.date] = [];
    acc[w.date].push(w);
    return acc;
  }, {});
}

export const useWorkoutStore = create((set, get) => ({
  // 서버에서 받은 것만 여기 담는다. 화면이 보는 `workouts` 는 여기에
  // **기다리는 줄을 섞은 것**이다 (아래 apply 참고)
  server: {},
  workouts: {},
  queue: [],
  online: isOnline(),
  loading: false,
  flushing: false,

  // 서버 것 + 기다리는 줄을 한 번에 화면에 올린다. 둘을 따로 set 하면
  // 그 사이에 화면이 한 번 그려지면서 방금 적은 것이 깜빡 사라진다
  apply: (server, queue) => {
    const nextServer = server ?? get().server;
    const nextQueue = queue ?? get().queue;
    set({ server: nextServer, queue: nextQueue, workouts: mergeQueue(nextServer, nextQueue) });
  },

  // 앱이 뜰 때 한 번. **네트워크보다 먼저 그린다** — 지하에서 앱을 열면
  // 여기 담아둔 것이 곧 화면이다
  hydrate: () => {
    const queue = readQueue();
    const cached = readCache();
    if (!cached && queue.length === 0) return;
    // 이미 서버 것을 받아왔으면 그것을 밀어내지 않는다
    const server = Object.keys(get().server).length > 0 ? get().server : (cached || {});
    get().apply(server, queue);
  },

  setOnline: (online) => set({ online }),

  fetchAll: (force = false) => {
    if (inflight) return inflight;
    if (!force && fetchedAt && Date.now() - fetchedAt < FRESH_MS) return Promise.resolve();
    set({ loading: true });
    inflight = (async () => {
      try {
        const { data } = await client.get('/workouts');
        // 배열이 아니면 빈 것으로 친다. 아래 reduce 가 터지면 catch 로 빠지면서
        // 화면은 아무 말 없이 옛 목록을 그대로 들고 있는다
        const grouped = groupByDate(data);
        get().apply(grouped, null);
        saveCache(grouped);
        set({ loading: false, online: true });
        fetchedAt = Date.now();
      } catch (err) {
        // **못 받아온 것과 없는 것은 다르다.** 신호가 없어 못 받았으면
        // 마지막으로 담아둔 것으로 그린다 — 지하에서도 지난 기록은 보여야 한다
        if (isOfflineError(err)) {
          set({ online: false });
          if (Object.keys(get().server).length === 0) {
            const cached = readCache();
            if (cached) get().apply(cached, null);
          }
        }
        set({ loading: false });
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },

  // ── 적는다 ──
  //
  // 신호가 없으면 **기기에 담아두고 줄에 세운다.** 예전에는 여기서 그냥 터졌고,
  // 화면은 「저장 실패」 토스트 하나를 띄웠다 — 방금 한 세트가 그대로 날아갔다.
  // 헬스장은 지하가 많다.
  addWorkout: async (workout) => {
    try {
      const { data } = await client.post('/workouts', workout);
      // **다시 받아오는 것을 기다린다.** 안 기다리면 저장 직후의 workouts 가 방금 넣은
      // 것을 모르는 상태로 잠깐 남는다. 최고 기록은 「넣기 전」의 목록과 견주는데,
      // 그 사이에 한 번 더 저장하면 앞의 것을 못 보고 견줘서 최고 기록이 잘못 뜬다.
      // (벤치 85 를 넣고 곧바로 82 를 넣으면 82 가 최고 기록이라고 뜬다)
      await get().fetchAll(true).catch(() => {});
      return data;
    } catch (err) {
      // 서버가 「그렇게는 안 받는다」고 답한 것은 다시 보내도 마찬가지다. 그대로 알린다
      if (!isOfflineError(err)) throw err;
      const item = makeQueued(workout);
      const queue = [...get().queue, item];
      saveQueue(queue);
      get().apply(null, queue);
      set({ online: false });
      return { ...workout, id: item.id, queued: true };
    }
  },

  updateWorkout: async (id, workout) => {
    // 아직 안 올라간 것은 줄에서 고친다
    if (isLocalId(id)) {
      const queue = editInQueue(get().queue, id, workout);
      saveQueue(queue);
      get().apply(null, queue);
      return { ...workout, id, queued: true };
    }
    const { data } = await client.put(`/workouts/${id}`, workout);
    get().fetchAll(true).catch(() => {});
    return data;
  },

  deleteWorkout: async (id) => {
    // 아직 안 올라간 것은 줄에서 뺀다. 서버에는 없는 것이라 DELETE 를 보내면 404 다
    if (isLocalId(id)) {
      const queue = dropFromQueue(get().queue, id);
      saveQueue(queue);
      get().apply(null, queue);
      return;
    }
    // 낙관적 업데이트: 먼저 UI에서 제거
    const prevServer = get().server;
    const updated = {};
    for (const [date, items] of Object.entries(prevServer)) {
      const filtered = items.filter(w => w.id !== id);
      if (filtered.length > 0) updated[date] = filtered;
    }
    get().apply(updated, null);
    try {
      await client.delete(`/workouts/${id}`);
      saveCache(updated);
      // 지운 것은 화면에서 이미 뺐다. 다시 받을 필요는 없지만, 다음 요청이
      // 옛 것을 그대로 쓰지 않도록 「새로 받아야 함」으로 표시해 둔다
      fetchedAt = 0;
    } catch (err) {
      // 실패 시 롤백
      get().apply(prevServer, null);
      throw new Error('삭제 실패');
    }
  },

  // ── 줄에 선 것을 올린다 ──
  //
  // 신호가 돌아왔을 때(`online` 이벤트) · 앱이 뜰 때 · 사람이 「다시 시도」를 눌렀을 때.
  //
  // **하나가 신호 때문에 실패하면 거기서 멈춘다.** 나머지를 계속 보내봐야 다 실패하고,
  // 순서도 뒤집힌다. 서버가 거절한 것은 표시만 해두고 다음 것으로 넘어간다 —
  // 그 하나 때문에 뒤의 것이 영영 못 올라가면 안 된다.
  flushQueue: async () => {
    if (get().flushing) return { sent: 0, failed: 0, stopped: false };
    const queue = get().queue.filter(q => !q.failed);
    if (queue.length === 0) return { sent: 0, failed: 0, stopped: false };
    set({ flushing: true });
    let sent = 0;
    let failed = 0;
    let stopped = false;
    try {
      for (const item of queue) {
        try {
          await client.post('/workouts', item.payload);
          const next = dropFromQueue(get().queue, item.id);
          saveQueue(next);
          get().apply(null, next);
          sent += 1;
        } catch (err) {
          if (isOfflineError(err)) { stopped = true; set({ online: false }); break; }
          const reason = err?.response?.data?.error || '서버가 받지 않았어요';
          const next = markFailed(get().queue, item.id, reason);
          saveQueue(next);
          get().apply(null, next);
          failed += 1;
        }
      }
    } finally {
      set({ flushing: false });
    }
    if (sent > 0) {
      fetchedAt = 0;
      await get().fetchAll(true).catch(() => {});
    }
    return { sent, failed, stopped };
  },

  // 못 올린 것을 다시 시도한다 (표시를 지우고 한 번 더)
  retryFailed: async () => {
    const next = clearFailedMark(get().queue);
    saveQueue(next);
    get().apply(null, next);
    return get().flushQueue();
  },

  // 못 올린 것을 버린다. **사람이 눌러야만 지운다** — 우리가 알아서 지우면
  // 적은 것이 소리 없이 사라진다
  dropFailed: () => {
    const next = get().queue.filter(q => !q.failed);
    saveQueue(next);
    get().apply(null, next);
  },
}));
