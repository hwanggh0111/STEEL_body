import { create } from 'zustand';
import { readLS, saveLS } from '../data/safeStorage';
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

/** 숨을 어디서 볼까. 기본은 홈트에서만 — 헬스장은 시끄러워서 숨이 묻힌다. */
export const BREATH_WHERE = [
  { id: 'home', name: '홈트에서만' },
  { id: 'all', name: '운동할 때도' },
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

export const useSettingsStore = create((set) => ({
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

  setKeepAwake: (on) => { saveLS(SETTINGS_KEYS.keepAwake, on ? '1' : '0'); set({ keepAwake: !!on }); },
  setVoiceLog: (on) => { saveLS(SETTINGS_KEYS.voiceLog, on ? '1' : '0'); set({ voiceLog: !!on }); },
  setPrBanner: (on) => { saveLS(SETTINGS_KEYS.prBanner, on ? '1' : '0'); set({ prBanner: !!on }); },
  setFinishCard: (on) => { saveLS(SETTINGS_KEYS.finishCard, on ? '1' : '0'); set({ finishCard: !!on }); },

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
}));

/** 고른 예민도의 문턱. `breathRest.breathState` 에 넘긴다. */
export function senseOf(id) {
  return BREATH_SENSE.find((s) => s.id === id) || BREATH_SENSE[1];
}
