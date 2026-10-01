import { create } from 'zustand';
import { readLS, saveLS, removeLS } from '../data/safeStorage';
import { SETTINGS_KEYS } from '../data/localKeys';

// 설정함이 들고 있는 것들 (2026-09-22).
//
// ── 여기 있는 것과 없는 것 ──
//
// **휴식 타이머 여섯(소리 · 음색 · 볼륨 · 진동 · 자동 · 길이)은 여기 없다.**
// `restTimerStore` 가 이미 들고 있고, 잘 돌고 있다. 옮기면 **같은 값이 두 벌**이 되어
// 한쪽만 고치는 날이 온다 — 설정 화면은 그쪽 스토어를 그대로 불러 쓴다.
//
// **성별도 여기 없다.** 서버가 들고 있다(`authStore.setSex`) — 기기를 바꿔도 남아야
// 하는 값이라 그쪽이 맞다.
//
// 여기 있는 것은 **여태 아무 데서도 못 끄던 것들**이다 —
// 화면 켜두기 · 목소리로 적기 · 최고 기록 알림 · 끝 결산, 그리고 숨 보고 쉬기.
//
// ── 기기의 것인가 사람의 것인가 ──
//
// 전부 **그 기기에서 어떻게 쓰는지**에 대한 취향이라 로그아웃해도 남긴다
// (`localKeys.js` 의 「기기의 것」 칸). 마이크 **권한**은 사람에 딸린 것이지만,
// 그건 브라우저가 들고 있는 것이지 우리가 저장하는 값이 아니다.

/**
 * 숨을 어디서 볼까.
 *
 * **이름이 사실과 달랐다** (2026-09-29 에 고쳤다). 「홈트에서만 / 운동할 때도」라고
 * 적어놨는데, 숨은 **홈트 화면에만 있다**(`HomeworkoutPage`) — 헬스장 운동 화면
 * (`TrainPage`)에는 숨을 보는 코드가 아예 없다. 「운동할 때도」를 고른 사람은
 * 헬스장에서도 쉬는 시간이 늘어난다고 읽는데 아무 일도 안 일어났다.
 *
 * 실제로 가르는 것은 **홈트 안에서 어느 프로그램인지**다 —
 * 기능성(특수부대식)만인가, 홈트 전체인가, **헬스장 세트 사이 휴식까지인가.**
 *
 * 9/29 까지는 앞의 둘뿐이었고 「헬스장은 따로 정할 일」이라고 적어뒀다 —
 * 10/1 에 정해서 붙였다(세트 사이 휴식, `components/RestBreath.jsx`).
 * **없는 것을 있다고 적지 않는 것**과 **있는 것을 없다고 적지 않는 것**은 같은 규칙이다.
 */
export const BREATH_WHERE = [
  { id: 'home', name: '기능성에서만' },
  { id: 'all', name: '홈트 전체에서' },
  { id: 'gym', name: '헬스장 휴식까지' },
];

/** 얼마나 더 줄까 (초). */
export const BREATH_MAX = [
  { id: 5, name: '5초까지' },
  { id: 15, name: '15초까지' },
  { id: 30, name: '30초까지' },
];

/**
 * 얼마나 예민하게.
 *
 * `breathRest.js` 의 기본값(1.5 · 2.2)이 「보통」이다. 예민할수록 낮은 문턱이라
 * 자주 늘려주고, 그만큼 **옷 스치는 소리에도 반응한다** — 화면에 그렇게 적는다.
 */
export const BREATH_SENSE = [
  { id: 'loose', name: '느슨하게', mid: 1.8, up: 2.6 },
  { id: 'mid', name: '보통', mid: 1.5, up: 2.2 },
  { id: 'tight', name: '예민하게', mid: 1.3, up: 1.9 },
];

const pickOf = (val, list, fallback) => (list.some((x) => String(x.id) === String(val)) ? val : fallback);

/** 저장한 적이 없으면 **켜진 것**으로 본다. '0' 이라고 적혀 있을 때만 꺼진 것이다. */
const readFlag = (key, fallback = true) => {
  const v = readLS(key);
  if (v === null || v === undefined || v === '') return fallback;
  return v !== '0';
};

const readPick = (key, list, fallback) => {
  const v = readLS(key);
  const hit = list.find((x) => String(x.id) === String(v));
  return hit ? hit.id : fallback;
};

// 처음 값.
//
// **한 곳에서 만든다.** 스토어가 처음 설 때와 「기본값으로 되돌리기」가 **같은 것**을
// 써야 한다 — 두 군데에 적으면 설정을 하나 늘릴 때 한쪽을 빠뜨리고, 그러면
// 되돌려도 그 하나만 안 돌아간다. 오늘만 그 모양의 버그를 세 번 봤다.
const initial = () => ({
  // ── 운동할 때 ──
  // 여태 코드에만 있었다. 40초 플랭크 중에 화면이 꺼지면 남은 시간을 못 보는데,
  // 배터리가 걱정되는 사람에게는 끌 길이 없었다
  keepAwake: readFlag(SETTINGS_KEYS.keepAwake),
  // 크롬 계열에서만 되는 것이라 **되는 곳에서만 보인다**(화면이 그렇게 그린다).
  // 마이크가 부담스러운 사람도 있는데 끌 길이 없었다
  voiceLog: readFlag(SETTINGS_KEYS.voiceLog),
  prBanner: readFlag(SETTINGS_KEYS.prBanner),
  finishCard: readFlag(SETTINGS_KEYS.finishCard),

  // ── 마이크 · 숨 ──
  // **기본은 꺼짐.** 마이크는 사람이 켜는 것이지 앱이 켜는 것이 아니다
  breath: readFlag(SETTINGS_KEYS.breath, false),
  breathWhere: readPick(SETTINGS_KEYS.breathWhere, BREATH_WHERE, 'home'),
  breathMax: readPick(SETTINGS_KEYS.breathMax, BREATH_MAX, 15),
  breathSense: readPick(SETTINGS_KEYS.breathSense, BREATH_SENSE, 'mid'),

  // ── 몸 ──
  inbodyScore: readFlag(SETTINGS_KEYS.inbodyScore, false),
});

export const useSettingsStore = create((set) => ({
  ...initial(),

  setKeepAwake: (on) => { saveLS(SETTINGS_KEYS.keepAwake, on ? '1' : '0'); set({ keepAwake: !!on }); },
  setVoiceLog: (on) => { saveLS(SETTINGS_KEYS.voiceLog, on ? '1' : '0'); set({ voiceLog: !!on }); },
  setPrBanner: (on) => { saveLS(SETTINGS_KEYS.prBanner, on ? '1' : '0'); set({ prBanner: !!on }); },
  setFinishCard: (on) => { saveLS(SETTINGS_KEYS.finishCard, on ? '1' : '0'); set({ finishCard: !!on }); },

  // ── 몸 ──
  // **기본은 꺼짐.** 8/25 에 「몸에 등급을 안 매긴다」고 정했고 9/2 에 비교 화면의
  // 「종합 평가」를 그래서 걷어냈다. 점수를 보고 싶은 사람도 있어서 자리를 두지만,
  // **켜는 사람에게만** 보인다 — 아무도 부탁하지 않은 점수를 앱이 먼저 들이대지 않는다
  setInbodyScore: (on) => { saveLS(SETTINGS_KEYS.inbodyScore, on ? '1' : '0'); set({ inbodyScore: !!on }); },

  setBreath: (on) => { saveLS(SETTINGS_KEYS.breath, on ? '1' : '0'); set({ breath: !!on }); },
  setBreathWhere: (id) => {
    const v = pickOf(id, BREATH_WHERE, 'home');
    saveLS(SETTINGS_KEYS.breathWhere, v); set({ breathWhere: v });
  },
  setBreathMax: (id) => {
    const v = pickOf(id, BREATH_MAX, 15);
    saveLS(SETTINGS_KEYS.breathMax, String(v)); set({ breathMax: Number(v) });
  },
  setBreathSense: (id) => {
    const v = pickOf(id, BREATH_SENSE, 'mid');
    saveLS(SETTINGS_KEYS.breathSense, v); set({ breathSense: v });
  },

  /**
   * 설정을 처음 상태로 (2026-10-01).
   *
   * **담아둔 것을 지우고 처음 값을 다시 읽는다.** 값을 손으로 적어 넣지 않는다 —
   * 적어 넣으면 설정이 하나 늘 때마다 여기도 고쳐야 하고, 그 한 번을 잊으면
   * 「되돌렸는데 그것만 안 돌아간다」가 된다.
   *
   * `SETTINGS_KEYS` 를 **통째로 돌면서** 지우므로, 새 설정을 거기 적기만 하면
   * 되돌리기가 저절로 따라온다.
   */
  resetAll: () => {
    Object.values(SETTINGS_KEYS).forEach((k) => removeLS(k));
    set(initial());
  },
}));

/** 고른 예민도의 문턱. `breathRest.breathState` 에 넘긴다. */
export function senseOf(id) {
  return BREATH_SENSE.find((s) => s.id === id) || BREATH_SENSE[1];
}
