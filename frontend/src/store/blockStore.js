import { create } from 'zustand';

// 계정이 막혔다는 것을 **한 자리에 받아 둔다** (2026-10-24).
//
// `api/client.js` 가 403 에서 이것을 세우고, `components/AccountBlocked.jsx` 가 그린다.
// 들여오는 것이 `zustand` 하나뿐이어야 한다 — `client.js` 가 이것을 들여오므로,
// 여기서 스토어나 화면을 들여오면 고리가 생겨 앱이 뜨다 멎는다.
export const useBlockStore = create((set) => ({
  block: null,
  setBlock: (block) => set((s) => {
    if (!block) return { block: null };
    // 같은 것이 또 와도 다시 그리지 않는다 — 요청 열 개가 한꺼번에 403 이 된다
    const same = s.block
      && s.block.kind === block.kind
      && s.block.until === block.until
      && s.block.reason === block.reason;
    return same ? s : { block };
  }),
  clear: () => set({ block: null }),
}));
