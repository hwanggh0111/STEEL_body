import { create } from 'zustand';
import {
  isLockSet, matches, setPin as savePin, clearPin,
  shouldLock, cooldownLeft, MAX_TRIES,
} from '../data/appLock';

// 앱 잠금이 지금 어떤 상태인가.
//
// **화면 하나가 아니라 앱 전체의 상태**라 스토어에 둔다 — 잠금 화면은 껍데기 밖에서
// 덮어야 하고(탭바도 머리도 가려야 한다), 잠그라는 신호는 여러 곳에서 온다:
// 앱을 다시 띄웠을 때 · 다른 앱 보다 돌아왔을 때 · 「지금 잠그기」를 눌렀을 때.
//
// 판단(얼마나 비워뒀으면 잠그나 · 몇 번 틀리면 쉬나)은 `data/appLock.js` 에 있다 —
// 화면으로는 확인하기 어려운 계산이라 값으로 보는 검사가 거기를 본다.
export const useLockStore = create((set, get) => ({
  // 걸어뒀는가 (기기에 담긴 값). 켜고 끄는 것은 설정 화면이 한다
  enabled: isLockSet(),
  // 지금 잠겨 있는가. **앱이 뜰 때 걸려 있으면 잠근 채로 시작한다** —
  // 폰을 껐다 켠 뒤가 바로 남의 손에 있었을 수 있는 때다
  locked: isLockSet(),
  tries: 0,
  lastTryAt: 0,
  // 화면을 벗어난 시각. 돌아왔을 때 이것으로 「얼마나 비워뒀나」를 잰다
  hiddenAt: null,

  /** 지금 잠근다 (폰을 건네기 전에 누르는 단추 · 설정에서 막 걸었을 때) */
  lock: () => { if (get().enabled) set({ locked: true, tries: 0 }); },

  /** 화면을 벗어났다 / 돌아왔다 */
  markHidden: () => set({ hiddenAt: Date.now() }),
  maybeLock: () => {
    const { enabled, locked, hiddenAt } = get();
    if (!enabled || locked) { set({ hiddenAt: null }); return; }
    if (shouldLock(hiddenAt)) set({ locked: true, tries: 0 });
    set({ hiddenAt: null });
  },

  /** 맞으면 연다. 틀리면 몇 번째인지 센다 — 다섯 번이면 잠깐 쉰다 */
  tryUnlock: async (pin) => {
    if (cooldownLeft(get().tries, get().lastTryAt) > 0) return false;
    const ok = await matches(pin);
    if (ok) { set({ locked: false, tries: 0, lastTryAt: 0 }); return true; }
    const tries = get().tries + 1;
    set({ tries, lastTryAt: Date.now() });
    return false;
  },

  /** 쉬는 시간이 얼마나 남았나 (밀리초). 화면이 초로 그린다 */
  cooldown: () => cooldownLeft(get().tries, get().lastTryAt),
  triesLeft: () => Math.max(0, MAX_TRIES - get().tries),

  /**
   * 잠긴 것만 놓는다 (건 것은 그대로).
   *
   * 네 자리를 잊어 로그아웃으로 풀 때 쓴다 — 안 놓으면 다시 로그인한 뒤에도 잠긴 채로
   * 열려서 같은 자리에 또 선다. 잠금 자체는 기기의 것이라 남긴다
   */
  release: () => set({ locked: false, tries: 0, lastTryAt: 0 }),

  /** 설정에서 걸거나 바꾼다. **건 뒤에는 잠그지 않는다** — 방금 친 사람이 주인이다 */
  set: async (pin) => {
    await savePin(pin);
    set({ enabled: true, locked: false, tries: 0, lastTryAt: 0 });
  },

  /** 푼다(잠금을 없앤다). 화면이 지금 것을 먼저 맞춰본 뒤에만 부른다 */
  remove: () => {
    clearPin();
    set({ enabled: false, locked: false, tries: 0, lastTryAt: 0 });
  },
}));
