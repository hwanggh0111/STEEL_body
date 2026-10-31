import { create } from 'zustand';
import client from '../api/client';
import { readLS, saveLS } from '../data/safeStorage';
import { GYM_KEY } from '../data/localKeys';

// 기구 세팅.
//
// ── 「지금 어느 헬스장인가」는 **기기에 담는다** ──
//
// 서버에 두지 않는다. 폰은 헬스장에 들고 가고 PC 는 집에 있다 — **같은 사람이라도
// 기기마다 있는 곳이 다르다.** 서버에 하나만 두면 폰에서 헬스장을 고른 순간
// 집 PC 도 그 헬스장이 된다.
//
// 세팅 자체는 서버에 있다. 기기를 바꿔도 남아야 하는 것은 그쪽이다.
// 이름은 `data/localKeys.js` 에 둔다 — 거기 있어야 로그아웃할 때 저절로 지워진다
const LS_GYM = GYM_KEY;
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

  /**
   * 세팅 한 줄을 담는다.
   *
   * ── **서버가 담은 이름을 쓴다** ── (2026-10-31)
   *
   * 헬스장 이름은 사람이 치는 글자고, 「지금 있는 곳」은 **이 기기에만** 있다
   * (위 머리글). 그런데 세팅을 담을 때는 그 이름이 서버로 가고, 서버는 **다듬어서**
   * 담는다 — `cleanName` 이 가운데 공백을 줄이고 `<>"'&` 를 걷는다:
   *
   *     화면이 든 이름   「강남   점」   (`trim()` 만 했다)
   *     서버가 담은 이름 「강남 점」
   *
   * 그러면 **칩 줄에 같은 곳이 둘로 보이고**(화면이 든 이름 + 서버가 돌려준 이름),
   * 「여기 세팅」은 `s.gym === gym` 으로 거르니 **방금 적은 세팅이 안 보인다.**
   * 10/28 에 루틴 이름에서 겪은 그 자리다 — 그때 세운 자가 **「서버가 담은 글자를
   * 그대로 쓴다」**였다.
   *
   * 다듬는 규칙을 화면에 또 적지 않는다 — `sanitize` 는 URL 디코딩까지 하는 긴
   * 자고, 두 벌로 두면 반드시 어긋난다. **담고 나서 서버가 준 이름으로 맞춘다.**
   */
  save: async (payload) => {
    const { data } = await client.put('/gym-settings', payload);
    // 지금 고른 곳으로 담은 것인데 이름이 달라져 왔으면, 그 이름이 맞는 이름이다
    if (data?.gym && payload?.gym === get().gym && data.gym !== get().gym) {
      get().setGym(data.gym);
    }
    await get().fetch(true);
    return data;
  },

  remove: async (gym, exercise) => {
    await client.delete('/gym-settings', { params: { gym, exercise } });
    await get().fetch(true);
  },

  /**
   * 한 곳을 **통째로** 지운다 (2026-10-06). 지운 개수를 돌려준다.
   *
   * 줄마다 `remove` 를 부르지 않는다. 열두 개면 왕복 열두 번이고, 가운데에서
   * 하나 터지면 **반쯤 지워진 헬스장**이 남는다 — 그러면 그 곳이 칩 줄에 계속
   * 뜨는데 세팅은 몇 개 없는 상태가 된다. 서버가 한 번에 지운다.
   *
   * **지금 있는 곳을 지웠으면 그 자리도 비운다** — 안 비우면 없는 곳을 기준으로
   * 「운동」 화면이 세팅을 찾는다(아무것도 안 뜬다).
   */
  removeGym: async (gym) => {
    const { data } = await client.delete('/gym-settings/gym', { params: { gym } });
    if (get().gym === gym) get().setGym('');
    await get().fetch(true);
    return data?.removed ?? 0;
  },

  reset: () => {
    resetGymCache();
    // **헬스장 이름은 안 지운다.** 그건 이 기기가 어디에 있는지이지 그 사람의 것이 아니다 —
    // 로그아웃했다고 헬스장이 바뀌지 않는다
    set({ gyms: [], settings: [], loaded: false, loading: false, failed: false });
  },
}));
