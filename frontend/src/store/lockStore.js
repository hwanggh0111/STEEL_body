import { create } from 'zustand';
import {
  isLockSet, matches, setPin as savePin, clearPin,
  shouldLock, cooldownLeft, MAX_TRIES,
} from '../data/appLock';
import { readLS, saveLS, removeLS } from '../data/safeStorage';
import { LOCK_TRIES_KEY } from '../data/localKeys';

// ── **틀린 횟수는 새로고침을 넘어 남는다** ── (2026-11-25 · 근호)
//
// `tries` · `lastTryAt` 가 메모리에만 있어서, 다섯 번 틀리고 새로고침하면 0 부터 다시였다 —
// 쉬는 시간(`cooldownLeft`)이 한 번도 안 걸린 채 네 자리 만 개를 다 해볼 수 있었다.
// 기기에 같이 적고, 켤 때 읽는다. 맞히거나 · 풀거나 · 새로 걸면 지운다
const readTries = () => {
  try {
    const v = JSON.parse(readLS(LOCK_TRIES_KEY) || 'null');
    const tries = Number.isInteger(v?.tries) && v.tries > 0 ? v.tries : 0;
    const lastTryAt = Number.isFinite(v?.lastTryAt) && v.lastTryAt > 0 ? v.lastTryAt : 0;
    return { tries, lastTryAt };
  } catch { return { tries: 0, lastTryAt: 0 }; }
};
const keepTries = (tries, lastTryAt) => {
  if (tries > 0) saveLS(LOCK_TRIES_KEY, JSON.stringify({ tries, lastTryAt }));
  else removeLS(LOCK_TRIES_KEY);
};
const kept = readTries();

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
  tries: kept.tries,
  lastTryAt: kept.lastTryAt,
  // 화면을 벗어난 시각. 돌아왔을 때 이것으로 「얼마나 비워뒀나」를 잰다
  hiddenAt: null,

  /** 지금 잠근다 (폰을 건네기 전에 누르는 단추 · 설정에서 막 걸었을 때) */
  lock: () => { if (get().enabled) { keepTries(0, 0); set({ locked: true, tries: 0 }); } },

  /** 화면을 벗어났다 / 돌아왔다 */
  markHidden: () => set({ hiddenAt: Date.now() }),
  maybeLock: () => {
    const { enabled, locked, hiddenAt } = get();
    if (!enabled || locked) { set({ hiddenAt: null }); return; }
    if (shouldLock(hiddenAt)) { keepTries(0, 0); set({ locked: true, tries: 0 }); }
    set({ hiddenAt: null });
  },

  /** 맞으면 연다. 틀리면 몇 번째인지 센다 — 다섯 번이면 잠깐 쉰다 */
  tryUnlock: async (pin) => {
    if (cooldownLeft(get().tries, get().lastTryAt) > 0) return false;
    const ok = await matches(pin);
    if (ok) { keepTries(0, 0); set({ locked: false, tries: 0, lastTryAt: 0 }); return true; }
    const tries = get().tries + 1;
    const at = Date.now();
    keepTries(tries, at);
    set({ tries, lastTryAt: at });
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
  release: () => { keepTries(0, 0); set({ locked: false, tries: 0, lastTryAt: 0 }); },

  /** 설정에서 걸거나 바꾼다. **건 뒤에는 잠그지 않는다** — 방금 친 사람이 주인이다 */
  set: async (pin) => {
    await savePin(pin);
    keepTries(0, 0);
    set({ enabled: true, locked: false, tries: 0, lastTryAt: 0 });
  },

  /** 푼다(잠금을 없앤다). 화면이 지금 것을 먼저 맞춰본 뒤에만 부른다 */
  remove: () => {
    clearPin();
    keepTries(0, 0);
    set({ enabled: false, locked: false, tries: 0, lastTryAt: 0 });
  },

  /**
   * **로그아웃이 부른다 — 건 것까지 잊는다** (2026-10-24).
   *
   * 여태 로그아웃은 `release()`(잠긴 것만 놓기)만 했다. 그래서 네 자리를 잊은
   * 사람은 이 고리에 갇혔다 —
   *
   *     잠금 화면 → 로그아웃 → 로그인(열린다) → **앱을 다시 열면 또 잠김**
   *     (`locked: isLockSet()`) → 설정에서 풀려면 **지금 네 자리를 맞혀야 한다**
   *
   * 즉 **푸는 길이 아예 없었다.** 앱을 열 때마다 로그아웃하고 다시 로그인해야 하고,
   * 그 사람의 기록은 그 뒤에 있다. 고객센터 답변은 「잊으셨으면 로그아웃으로 풀 수
   * 있다」고 적혀 있는데, 잠금 화면은 「잠금은 그대로 걸려 있습니다」라고 적고 있었다 —
   * **두 화면이 서로 다른 말을 하고, 맞는 쪽은 없었다.**
   *
   * 지워도 괜찮은 까닭: 이 네 자리는 **잠깐 빌려준 폰에서 가리는 가림막**이고,
   * 돌아오려면 **계정 비밀번호**가 필요하다(그쪽이 더 센 자물쇠다). 폰을 든 사람이
   * 로그아웃을 눌러도 얻는 것이 없다 — 기록은 로그인 뒤에 있다.
   */
  forget: () => {
    clearPin();
    keepTries(0, 0);
    set({ enabled: false, locked: false, tries: 0, lastTryAt: 0, hiddenAt: null });
  },
}));
