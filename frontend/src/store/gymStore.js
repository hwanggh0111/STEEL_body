import { create } from 'zustand';
import client from '../api/client';
import { readLS, saveLS } from '../data/safeStorage';

// 기구 세팅.
//
// ── 「지금 어느 헬스장인가」는 **기기에 담는다** ──
//
// 서버에 두지 않는다. 폰은 헬스장에 들고 가고 PC 는 집에 있다 — **같은 사람이라도
// 기기마다 있는 곳이 다르다.** 서버에 하나만 두면 폰에서 헬스장을 고른 순간
// 집 PC 도 그 헬스장이 된다.
//
// 세팅 자체는 서버에 있다. 기기를 바꿔도 남아야 하는 것은 그쪽이다.
const LS_GYM = 'steelbody_gym';
// 열쇠의 `steelbody_` 는 옛 앱 이름이다. **앱 이름이 바뀌어도 안 바꾼다** —
// 바꾸면 쓰던 사람의 설정이 통째로 사라진다 (8/28 · 9/1 에 정한 규칙이다)

const FRESH_MS = 30000;
let inflight = null;
let fetchedAt = 0;

export function resetGymCache() {
  inflight = null;
  fetchedAt = 0;
}

export const useGymStore = create((set, get) => ({
  // 내가 다니는 곳 [{ name, settings }]
  gyms: [],
  // **내 세팅 전부** (헬스장을 안 가려서 받는다). 다른 헬스장 것을 베껴올 때 쓴다
  settings: [],
  gym: readLS(LS_GYM) || '',
  loaded: false,
  loading: false,
  // **못 불러온 것과 없는 것은 다르다.** 이것을 안 두면 화면이 「불러오는 중…」에
  // 영원히 멈춰 선다 — 신호가 끊겼든 서버가 거절했든 사람은 기다리기만 한다.
  // 캡처를 뽑다가 레이트 리밋(429)에 걸려 실제로 그 화면을 봤다 (2026-09-17)
  failed: false,

  /** 지금 있는 곳을 고른다. 기기에만 남는다 */
  setGym: (name) => {
    const v = String(name || '').trim();
    saveLS(LS_GYM, v);
    set({ gym: v });
  },

  fetch: (force = false) => {
    // ── 날아가 있는 요청과 `force` ── (2026-09-18)
    //
    // 여태 **`force` 를 보기 전에** 날아가 있는 요청을 돌려줬다. 그런데 `force` 를
    // 쓰는 자리는 「방금 저장했으니 다시 받아라」다 — 그 요청은 **저장 전에 떠난
    // 것일 수 있고**, 그것을 기다려서 받으면 방금 넣은 것이 없는 목록이 온다.
    // 화면은 「저장했어요」를 띄우고도 새 줄을 안 보여준다 (다음 받기까지 30초).
    //
    // 그래서 `force` 면 **그것을 기다린 뒤 한 번 더 받는다.** 실패했어도 받는다 —
    // 남의 실패 때문에 내 새로고침이 사라지면 안 된다.
    if (inflight) {
      if (!force) return inflight;
      const waiting = inflight;
      return waiting.then(() => get().fetch(true), () => get().fetch(true));
    }
    if (!force && fetchedAt && Date.now() - fetchedAt < FRESH_MS) return Promise.resolve();
    set({ loading: true, failed: false });
    inflight = (async () => {
      try {
        const { data } = await client.get('/gym-settings');
        set({
          gyms: Array.isArray(data?.gyms) ? data.gyms : [],
          settings: Array.isArray(data?.settings) ? data.settings : [],
          loaded: true,
          loading: false,
          failed: false,
        });
        fetchedAt = Date.now();
      } catch {
        // 못 받아와도 화면은 그대로 돈다 — 세팅은 운동 화면의 곁다리다.
        // **loaded 는 안 켠다** — 못 받아온 것을 「세팅이 없다」로 읽으면
        // 적어둔 사람에게 「적어둘까요?」가 뜬다.
        // 대신 **못 받았다고 말한다** — 안 그러면 화면이 「불러오는 중…」에 영영 멈춘다
        set({ loading: false, failed: true });
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },

  /** 지금 헬스장의 그 운동 세팅. 없으면 null */
  settingOf: (exercise) => {
    const name = String(exercise || '').trim();
    const gym = get().gym;
    if (!name || !gym) return null;
    return get().settings.find((s) => s.gym === gym && s.exercise === name) || null;
  },

  save: async (payload) => {
    const { data } = await client.put('/gym-settings', payload);
    await get().fetch(true);
    return data;
  },

  remove: async (gym, exercise) => {
    await client.delete('/gym-settings', { params: { gym, exercise } });
    await get().fetch(true);
  },

  reset: () => {
    resetGymCache();
    // **헬스장 이름은 안 지운다.** 그건 이 기기가 어디에 있는지이지 그 사람의 것이 아니다 —
    // 로그아웃했다고 헬스장이 바뀌지 않는다
    set({ gyms: [], settings: [], loaded: false, loading: false, failed: false });
  },
}));
