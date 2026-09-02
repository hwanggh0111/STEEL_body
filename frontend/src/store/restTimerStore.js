import { create } from 'zustand';
import { readLS, saveLS } from '../data/safeStorage';
import { TONES, VOLUMES, DEFAULT_TONE, DEFAULT_VOLUME } from '../data/alertSound';

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
// 열쇠 이름의 `steelbody_` 는 옛 앱 이름이다. **앱 이름이 바뀌어도 안 바꾼다** —
// 바꾸면 쓰던 사람의 설정이 통째로 사라진다 (8/28 · 9/1 에 정한 규칙이다)
const LS_TONE = 'steelbody_rest_tone';
const LS_VOLUME = 'steelbody_rest_volume';

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
// 목록에 없는 값이 적혀 있으면 기본으로 돌린다 — 소리 하나를 나중에 빼도 안 터진다
const readPickOf = (val, list, fallback) => (list.some((x) => x.id === val) ? val : fallback);
const readPick = (key, list, fallback) => readPickOf(readLS(key), list, fallback);

let ticker = null;

function stopTicker() {
  if (ticker) clearInterval(ticker);
  ticker = null;
}

export const useRestTimerStore = create((set, get) => ({
  // 다음 휴식에 쓸 기본값. 사람이 프리셋으로 고르는 것이 이것이다
  duration: readInt(LS_DURATION, 90),
  // **지금 도는 휴식이 몇 초짜리인가.** 위의 duration 과 다르다 —
  // 쉬는 중에 프리셋을 바꾸면 다음 것부터 그 값을 쓰고, 도는 것은 그대로 둔다.
  // 그리고 +30초를 누르면 여기가 늘어난다. 예전에는 링과 「90초 중」이 둘 다
  // duration 을 봐서, 120초를 쉬면서 「90초 중」이라고 적고 링은 100% 를 넘겼다
  runSec: 0,
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
  // 어떤 소리로 알릴지 · 얼마나 크게 (2026-09-02). 제보로 들어온 것이다
  tone: readPick(LS_TONE, TONES, DEFAULT_TONE),
  volume: readPick(LS_VOLUME, VOLUMES, DEFAULT_VOLUME),

  setDuration: (sec) => {
    const n = Math.min(MAX_SEC, Math.max(MIN_SEC, Math.round(Number(sec) || 0)));
    saveLS(LS_DURATION, String(n));
    set({ duration: n });
  },

  setAutoStart: (on) => { saveLS(LS_AUTO, on ? '1' : '0'); set({ autoStart: !!on }); },
  setSound: (on) => { saveLS(LS_SOUND, on ? '1' : '0'); set({ sound: !!on }); },
  setVibrate: (on) => { saveLS(LS_VIBRATE, on ? '1' : '0'); set({ vibrate: !!on }); },
  setTone: (id) => { const v = readPickOf(id, TONES, DEFAULT_TONE); saveLS(LS_TONE, v); set({ tone: v }); },
  setVolume: (id) => { const v = readPickOf(id, VOLUMES, DEFAULT_VOLUME); saveLS(LS_VOLUME, v); set({ volume: v }); },

  start: (sec, label = '') => {
    const seconds = Math.min(MAX_SEC, Math.max(MIN_SEC, Math.round(Number(sec) || get().duration)));
    stopTicker();
    set({
      deadline: Date.now() + seconds * 1000,
      runSec: seconds,
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
    const { deadline, pausedLeft, runSec } = get();
    // **여기도 최대치를 지킨다.** `start` 는 10분에서 잘랐는데 이쪽은 안 잘라서,
    // +30초를 스무 번 누르면 20분짜리 휴식이 됐다. 시작할 때는 못 하는 것을
    // 누르기만 하면 되게 두면 규칙이 아니다
    const grown = Math.min(MAX_SEC, runSec + sec);
    const added = grown - runSec;
    if (added <= 0) return;
    const ms = added * 1000;
    // 늘린 만큼 「몇 초짜리인가」도 같이 늘어난다.
    // 안 그러면 120초를 쉬면서 「90초 중」이라고 적고 링이 100% 를 넘는다
    if (pausedLeft != null) { set({ pausedLeft: pausedLeft + ms, leftMs: pausedLeft + ms, runSec: grown }); return; }
    if (deadline == null) return;
    const next = deadline + ms;
    set({ deadline: next, leftMs: Math.max(0, next - Date.now()), finished: false, runSec: grown });
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
    set({ deadline: null, pausedLeft: null, leftMs: null, finished: false, label: '', runSec: 0 });
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

/**
 * 지금 정해져 있는 알림 설정. **소리를 내는 자리가 셋이라**(휴식 띠 · 홈트 · 측정
 * 스톱워치) 각자 스토어를 뒤지면 한 곳만 빠뜨려도 그 화면만 옛 소리로 운다.
 */
export const alertPrefs = () => {
  const { sound, vibrate, tone, volume } = useRestTimerStore.getState();
  return { sound, vibrate, tone, volume };
};

/** 남은 밀리초 → 'M:SS'. */
export function formatLeft(ms) {
  const total = Math.max(0, Math.ceil((ms ?? 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
