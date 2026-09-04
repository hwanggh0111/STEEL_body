import { create } from 'zustand';
import client from '../api/client';
import {
  isOfflineError, isOnline, localNoteId, isLocalNoteId, mergeNotes,
  queueSave, queueDelete, dropEntry, markNoteFailed, clearNoteFailed, dropFailedNotes,
  readNoteQueue, saveNoteQueue, saveNoteCache, cachedMonth,
} from '../data/offlineNotes';

// 달력의 **그날 메모**. 신호가 없어도 적힌다.
//
// 틀은 `store/workoutStore.js` 와 같다. 다른 것은 둘이다 —
//
//   1. **보고 있는 달만 받는다** (`?month=YYYY-MM`). 칸마다 물어보면 서른 번이고,
//      통째로 받으면 몇 년치를 들고 온다
//   2. **하루 한 장이다.** 그래서 줄이 날짜로 찾는 모양이고, 같은 날을 또 적으면
//      덮어쓴다 (`data/offlineNotes.js` 의 설명)
//
// 그리고 **덮어쓰기가 안전하다** — 서버의 `POST /notes` 는 그 날짜에 이미 있으면
// 새로 만들지 않고 고친다. 그래서 줄에 선 것을 다시 보내도 두 장이 되지 않는다.

// 마지막으로 열어본 달. **늦게 온 답이 새 달을 덮는 것**을 이것으로 막고,
// 줄에 선 것을 올린 뒤 다시 받아올 달도 이것이다
let loadedMonth = null;

export function resetNoteCache() {
  loadedMonth = null;
}

export const useNoteStore = create((set, get) => ({
  // 서버에서 받은 것만 여기 담는다. 화면이 보는 `notes` 는 여기에 줄을 섞은 것이다
  server: {},
  notes: {},
  queue: {},
  online: isOnline(),
  loading: false,
  flushing: false,
  // **못 받아온 것과 없는 것은 다르다.** 화면이 이것을 보고 말을 고른다
  loadFailed: false,

  apply: (server, queue) => {
    const nextServer = server ?? get().server;
    const nextQueue = queue ?? get().queue;
    set({ server: nextServer, queue: nextQueue, notes: mergeNotes(nextServer, nextQueue) });
  },

  // 앱이 뜰 때 한 번. 네트워크보다 먼저 그린다
  hydrate: () => {
    const queue = readNoteQueue();
    if (Object.keys(queue).length === 0) return;
    get().apply(null, queue);
  },

  setOnline: (online) => set({ online }),

  // 보고 있는 달을 받는다. 달을 빨리 넘기면 **늦게 온 답이 새 달을 덮는다** —
  // 어느 달의 답인지 보고 아니면 버린다
  fetchMonth: async (month) => {
    if (!month) return;
    loadedMonth = month;
    set({ loading: true });
    const mine = month;
    try {
      const { data } = await client.get('/notes', { params: { month } });
      if (loadedMonth !== mine) return;
      const map = {};
      for (const n of Array.isArray(data) ? data : []) if (n && n.date) map[n.date] = n;
      get().apply(map, null);
      saveNoteCache(map, month);
      set({ loading: false, online: true, loadFailed: false });
    } catch (err) {
      if (loadedMonth !== mine) return;
      if (isOfflineError(err)) {
        // 담아둔 것으로 그린다. 지하에서도 지난 달 메모는 보여야 한다
        set({ online: false });
        get().apply(cachedMonth(month) || {}, null);
        set({ loading: false, loadFailed: false });
        return;
      }
      // 서버가 답은 했는데 안 준 것이다 — 「없습니다」가 아니라 「못 불러왔다」다
      get().apply({}, null);
      set({ loading: false, loadFailed: true });
    }
  },

  // ── 적는다 ──
  saveNote: async (date, body) => {
    try {
      const { data } = await client.post('/notes', { body, date });
      const server = { ...get().server, [date]: data };
      // 올라갔으면 줄에 남아 있던 그 날짜 것은 뺀다 (실패 표시로 남아 있을 수 있다)
      const queue = dropEntry(get().queue, date);
      saveNoteQueue(queue);
      get().apply(server, queue);
      saveNoteCache(server, date.slice(0, 7));
      set({ online: true });
      return data;
    } catch (err) {
      // 서버가 「그렇게는 안 받는다」고 답한 것은 다시 보내도 마찬가지다. 그대로 알린다
      if (!isOfflineError(err)) throw err;
      const queue = queueSave(get().queue, date, body);
      saveNoteQueue(queue);
      get().apply(null, queue);
      set({ online: false });
      return { id: get().server[date]?.id ?? localNoteId(date), date, body, queued: true };
    }
  },

  // ── 지운다 ──
  //
  // 아직 안 올라간 것은 줄에서 뺀다. 서버에 없는 것을 지우러 가면 404 다
  removeNote: async (note) => {
    const date = note?.date;
    if (!date) return;
    const serverId = get().server[date]?.id ?? null;

    if (serverId === null || isLocalNoteId(note.id)) {
      const queue = dropEntry(get().queue, date);
      saveNoteQueue(queue);
      get().apply(null, queue);
      return;
    }

    try {
      await client.delete(`/notes/${serverId}`);
    } catch (err) {
      if (isOfflineError(err)) {
        // **신호가 없다고 안 지워주면 되살아난 것처럼 보인다.** 줄에 세운다
        const queue = queueDelete(get().queue, date, serverId);
        saveNoteQueue(queue);
        get().apply(null, queue);
        set({ online: false });
        return;
      }
      // 없어서 못 지운 것은 실패가 아니다 (두 번 눌렀거나 다른 기기에서 이미 지웠다)
      if (err.response?.status !== 404) throw err;
    }
    const server = { ...get().server };
    delete server[date];
    const queue = dropEntry(get().queue, date);
    saveNoteQueue(queue);
    get().apply(server, queue);
    saveNoteCache(server, date.slice(0, 7));
  },

  // ── 줄에 선 것을 올린다 ──
  //
  // **하나가 신호 때문에 실패하면 거기서 멈춘다.** 나머지를 보내봐야 다 실패한다.
  // 서버가 거절한 것은 표시만 하고 다음 것으로 넘어간다 — 그 하나 때문에 뒤의 것이
  // 영영 못 올라가면 안 된다.
  flushQueue: async () => {
    if (get().flushing) return { sent: 0, failed: 0, stopped: false };
    // 적은 순서대로 올린다
    const entries = Object.entries(get().queue)
      .filter(([, e]) => !e.failed)
      .sort((a, b) => String(a[1].at).localeCompare(String(b[1].at)));
    if (entries.length === 0) return { sent: 0, failed: 0, stopped: false };

    set({ flushing: true });
    let sent = 0;
    let failed = 0;
    let stopped = false;
    try {
      for (const [date, e] of entries) {
        try {
          if (e.op === 'delete') await client.delete(`/notes/${e.id}`);
          else await client.post('/notes', { body: e.body, date });
          const next = dropEntry(get().queue, date);
          saveNoteQueue(next);
          get().apply(null, next);
          sent += 1;
        } catch (err) {
          if (isOfflineError(err)) { stopped = true; set({ online: false }); break; }
          // 지우려던 것이 이미 없으면 그것도 뜻대로 된 것이다
          if (e.op === 'delete' && err.response?.status === 404) {
            const next = dropEntry(get().queue, date);
            saveNoteQueue(next);
            get().apply(null, next);
            sent += 1;
            continue;
          }
          const reason = err?.response?.data?.error || '서버가 받지 않았어요';
          const next = markNoteFailed(get().queue, date, reason);
          saveNoteQueue(next);
          get().apply(null, next);
          failed += 1;
        }
      }
    } finally {
      set({ flushing: false });
    }
    // 올린 것이 있으면 보고 있는 달을 다시 받아 서버 것으로 맞춘다
    if (sent > 0 && loadedMonth) await get().fetchMonth(loadedMonth).catch(() => {});
    return { sent, failed, stopped };
  },

  retryFailed: async () => {
    const next = clearNoteFailed(get().queue);
    saveNoteQueue(next);
    get().apply(null, next);
    return get().flushQueue();
  },

  // 못 올린 것을 버린다. **사람이 눌러야만 지운다**
  dropFailed: () => {
    const next = dropFailedNotes(get().queue);
    saveNoteQueue(next);
    get().apply(null, next);
  },
}));
