import { create } from 'zustand';
import client from '../api/client';

// 내 제보 목록.
//
// 고객센터 한 화면에서 두 곳이 이 목록을 본다 — 제보함(폼과 목록)과, 접혀 있을 때
// 제목줄에 붙는 「새 답변」 표시. 각자 부르면 화면을 열 때마다 같은 요청이 두 번 나간다.
// 그래서 목록을 여기로 올리고, 진행 중인 요청은 하나로 묶는다.
//
// 실패를 빈 목록과 구분해서 들고 있는다 — 보낸 게 있는데 아무것도 없는 화면이 뜨면
// 지워진 줄 안다.

let inflight = null;

export const useReportStore = create((set, get) => ({
  items: [],
  loading: true,
  failed: false,

  fetchAll: () => {
    if (inflight) return inflight;
    inflight = client.get('/reports')
      .then(({ data }) => set({ items: Array.isArray(data) ? data : [], failed: false }))
      .catch(() => set({ failed: true }))
      .finally(() => { inflight = null; set({ loading: false }); });
    return inflight;
  },

  // 보낸 직후 · 지운 직후처럼 서버 응답이 이미 손에 있을 때 쓴다
  setItems: (next) => set(s => ({ items: typeof next === 'function' ? next(s.items) : next })),
  setFailed: (failed) => set({ failed }),

  // 답변이 달린 제보 중 가장 최근 것. 없으면 빈 문자열.
  // ISO 문자열이라 사전순 비교가 곧 시간순 비교다
  latestReplyAt: () => get().items.reduce((max, i) => (i.reply_at && i.reply_at > max ? i.reply_at : max), ''),

  // 로그아웃할 때 비운다. **안 비우면 다음에 로그인한 사람이 앞 사람의 제보를 본다** —
  // 새로 받아오기 전까지 「내 제보 3건 · 새 답변」이 남의 것으로 뜨고, 받아오기에
  // 실패하면 그대로 남는다. 진행표(routineSessionStore)에서 막았던 것과 같은 종류다
  reset: () => { inflight = null; set({ items: [], loading: true, failed: false }); },
}));
