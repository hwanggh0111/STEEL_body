import { create } from 'zustand';
import { readLS, saveLS } from '../data/safeStorage';

// 휴식 타이머.
//
// 예전에는 기록 화면 안에만 있는 컴포넌트였다. 그래서 두 가지가 안 됐다 —
// 인바디를 보러 가면 사라졌고, 세트를 저장해도 직접 눌러야 시작했다.
// 스토어로 올려서 앱 어디서나 같은 하나를 본다.
//
// **남은 초를 1씩 빼지 않는다.** 그 방식은 화면을 내리거나 다른 앱을 보는 동안
// 브라우저가 타이머를 늦춘다 — 90초 휴식이 3분이 되고 그동안 숫자는 멈춰 있다.
// 끝나는 시각(deadline)을 정해두고 250ms 마다 시계를 다시 본다.
// (8/24 에 홈트 타이머에서 같은 것을 고쳤는데, 이쪽은 그대로 남아 있었다)

const LS_DURATION = 'steelbody_rest_duration';
const LS_AUTO = 'steelbody_rest_auto';
const LS_SOUND = 'steelbody_rest_sound';
const LS_VIBRATE = 'steelbody_rest_vibrate';

export const PRESETS = [30, 60, 90, 120, 180];
export const MIN_SEC = 5;
export const MAX_SEC = 600;
const TICK_MS = 250;

const readInt = (key, fallback) => {
  const n = parseInt(readLS(key), 10);
  return Number.isFinite(n) && n >= MIN_SEC && n <= MAX_SEC ? n : fallback;
};
// 저장한 적이 없으면 켜진 것으로 본다. '0' 이라고 적혀 있을 때만 꺼진 것이다
const readFlag = (key) => readLS(key) !== '0';

let ticker = null;

function stopTicker() {
  if (ticker) clearInterval(ticker);
  ticker = null;
}

export const useRestTimerStore = create((set, get) => ({
  duration: readInt(LS_DURATION, 90),
  // 끝나는 시각(ms). null 이면 안 돌고 있다
  deadline: null,
  // 일시정지했을 때 남은 밀리초
  pausedLeft: null,
  // 남은 밀리초 — 화면은 이것만 본다
  leftMs: null,
  finished: false,
  // 무엇 때문에 시작했나 ('벤치프레스 4세트'). 띠에 적는다
  label: '',
  autoStart: readFlag(LS_AUTO),
  sound: readFlag(LS_SOUND),
  vibrate: readFlag(LS_VIBRATE),

  setDuration: (sec) => {
    const n = Math.min(MAX_SEC, Math.max(MIN_SEC, Math.round(Number(sec) || 0)));
    saveLS(LS_DURATION, String(n));
    set({ duration: n });
  },

  setAutoStart: (on) => { saveLS(LS_AUTO, on ? '1' : '0'); set({ autoStart: !!on }); },
  setSound: (on) => { saveLS(LS_SOUND, on ? '1' : '0'); set({ sound: !!on }); },
  setVibrate: (on) => { saveLS(LS_VIBRATE, on ? '1' : '0'); set({ vibrate: !!on }); },

  start: (sec, label = '') => {
    const seconds = Math.min(MAX_SEC, Math.max(MIN_SEC, Math.round(Number(sec) || get().duration)));
    stopTicker();
    set({
      deadline: Date.now() + seconds * 1000,
      pausedLeft: null,
      leftMs: seconds * 1000,
      finished: false,
      label,
    });
    ticker = setInterval(() => get().tick(), TICK_MS);
  },

  // 저장했을 때 부른다. 꺼져 있으면 아무 일도 하지 않는다
  autoStartAfterSet: (label) => {
    if (!get().autoStart) return false;
    get().start(get().duration, label);
    return true;
  },

  add: (sec) => {
    const { deadline, pausedLeft } = get();
    const ms = sec * 1000;
    if (pausedLeft != null) { set({ pausedLeft: pausedLeft + ms, leftMs: pausedLeft + ms }); return; }
    if (deadline == null) return;
    const next = deadline + ms;
    set({ deadline: next, leftMs: Math.max(0, next - Date.now()), finished: false });
  },

  pause: () => {
    const { deadline } = get();
    if (deadline == null) return;
    stopTicker();
    const left = Math.max(0, deadline - Date.now());
    set({ deadline: null, pausedLeft: left, leftMs: left });
  },

  resume: () => {
    const { pausedLeft } = get();
    if (pausedLeft == null) return;
    stopTicker();
    set({ deadline: Date.now() + pausedLeft, pausedLeft: null, leftMs: pausedLeft, finished: false });
    ticker = setInterval(() => get().tick(), TICK_MS);
  },

  stop: () => {
    stopTicker();
    set({ deadline: null, pausedLeft: null, leftMs: null, finished: false, label: '' });
  },

  tick: () => {
    const { deadline } = get();
    if (deadline == null) { stopTicker(); return; }
    const left = deadline - Date.now();
    if (left > 0) { set({ leftMs: left }); return; }
    stopTicker();
    set({ deadline: null, pausedLeft: null, leftMs: 0, finished: true });
  },

  // 끝난 것을 보고 나면 부른다 (알림을 두 번 울리지 않게)
  ackFinished: () => set({ finished: false, leftMs: null, label: '' }),
}));

/** 남은 밀리초 → 'M:SS'. */
export function formatLeft(ms) {
  const total = Math.max(0, Math.ceil((ms ?? 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
