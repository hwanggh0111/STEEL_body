// 시간이 다 됐을 때 알리는 소리와 진동.
//
// 휴식 타이머 · 홈트 · 측정 스톱워치, 세 곳이 쓴다.
//
// 예전에는 **진동뿐이었다.** 그런데 `navigator.vibrate` 는 아이폰 사파리가 아예 지원하지
// 않는다 — 아이폰에서는 휴식이 끝나도 화면 깜빡임 말고는 아무 일도 없었다.
// 화면이 꺼져 있으면 그것도 못 본다.
//
// 그래서 소리를 넣는다. **소리 파일을 두지 않고 그 자리에서 만든다** —
// 파일 하나 때문에 첫 화면이 무거워질 이유가 없다. 소리를 넷으로 늘리고 크기를
// 셋으로 나눈 지금도 받는 것은 여전히 0바이트다 (2026-09-02).

let ctx = null;

/**
 * 소리를 낼 준비를 한다. **사람이 누른 그 순간에 불러야 한다.**
 * 브라우저는 사용자가 누르지 않은 소리를 막는다 — 타이머가 끝나는 시점은
 * 아무도 누르지 않은 시점이라, 그때 처음 만들면 소리가 안 난다.
 */
export function primeAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/**
 * 소리 크기 — 세 칸.
 *
 * 이어폰을 끼고 하는 사람과 헬스장에서 쓰는 사람의 자리가 다르다. 미끄럼틀(슬라이더)로
 * 두지 않은 이유는 **폰을 내려놓고 쓰는 물건**이라서다 — 벤치에 누워 손가락으로
 * 정확히 끄는 것보다 세 칸 중 하나를 누르는 편이 낫다.
 */
export const VOLUMES = [
  { id: 'low', name: '작게', gain: 0.35 },
  { id: 'mid', name: '보통', gain: 0.7 },
  { id: 'high', name: '크게', gain: 1 },
];
export const DEFAULT_VOLUME = 'mid';

const volumeGain = (id) => (VOLUMES.find((v) => v.id === id) || VOLUMES[1]).gain;

/**
 * 소리 한 알.
 *
 * `decay` 가 있으면 **때린 뒤 잦아드는 결**(종 · 나무)이고, 없으면 **눌러 두는 결**
 * (띵 · 삑)이다. 갑자기 켜고 끄면 '틱' 하는 잡음이 나므로 어느 쪽이든 0.02초에 걸쳐
 * 올린다.
 */
function note(at, { freq, dur, type = 'sine', peak = 1, decay = false }, vol) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const top = 0.22 * peak * vol;
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(top, at + 0.02);
  if (decay) {
    // 잦아드는 소리는 직선으로 내리면 뚝 끊긴 것처럼 들린다. 지수로 내린다
    gain.gain.exponentialRampToValueAtTime(Math.max(top * 0.001, 0.00001), at + dur);
  } else {
    gain.gain.linearRampToValueAtTime(0, at + dur);
  }
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/**
 * 고를 수 있는 소리 넷.
 *
 * 넷을 **성격이 다르게** 갈랐다. 비슷한 것을 넷 두면 고르는 일이 짐이 된다.
 *   띵 — 지금까지 쓰던 것. 짧게 둘, 높게 하나
 *   종 — 낮게 울리고 길게 잦아든다. 이어폰으로 들을 때 덜 놀란다
 *   삑 — 네모파(square)라 배음이 많다. **시끄러운 헬스장에서 유일하게 들리는 소리다**
 *   나무 — 아주 짧게 딱딱딱. 조용한 곳에서 남에게 안 들리게
 *
 * `desc` 는 화면에 그대로 적는다 — 이름만 보고는 어떤 소리인지 아무도 모른다.
 */
export const TONES = [
  {
    id: 'ding', name: '띵', desc: '짧게 둘, 높게 하나 (지금까지 쓰던 소리)',
    notes: [
      { start: 0, freq: 880, dur: 0.12 },
      { start: 0.18, freq: 880, dur: 0.12 },
      { start: 0.36, freq: 1174, dur: 0.2 },
    ],
  },
  {
    id: 'bell', name: '종', desc: '낮게 울리고 길게 잦아듭니다 — 이어폰에 좋습니다',
    notes: [
      { start: 0, freq: 660, dur: 1.5, decay: true },
      { start: 0, freq: 1320, dur: 1.1, peak: 0.35, decay: true },
      { start: 0.5, freq: 990, dur: 1.2, peak: 0.5, decay: true },
    ],
  },
  {
    id: 'beep', name: '삑', desc: '날카롭고 짧게 셋 — 시끄러운 곳에서 제일 잘 들립니다',
    notes: [
      { start: 0, freq: 1000, dur: 0.09, type: 'square', peak: 0.5 },
      { start: 0.15, freq: 1000, dur: 0.09, type: 'square', peak: 0.5 },
      { start: 0.3, freq: 1000, dur: 0.16, type: 'square', peak: 0.5 },
    ],
  },
  {
    id: 'wood', name: '나무', desc: '딱딱딱 — 조용한 곳에서 남에게 안 들리게',
    notes: [
      { start: 0, freq: 320, dur: 0.07, type: 'triangle', decay: true },
      { start: 0.13, freq: 320, dur: 0.07, type: 'triangle', decay: true },
      { start: 0.26, freq: 420, dur: 0.09, type: 'triangle', decay: true },
    ],
  },
];
export const DEFAULT_TONE = 'ding';

const toneOf = (id) => TONES.find((t) => t.id === id) || TONES[0];

/** 소리 하나를 지금 낸다. 준비가 안 됐으면 조용히 넘어간다. */
export function playTone(toneId = DEFAULT_TONE, volumeId = DEFAULT_VOLUME) {
  if (!ctx || ctx.state !== 'running') return false;
  try {
    const now = ctx.currentTime;
    const vol = volumeGain(volumeId);
    for (const n of toneOf(toneId).notes) note(now + n.start, n, vol);
    return true;
  } catch {
    return false; // 소리가 안 나도 넘어간다
  }
}

/**
 * 고르는 자리에서 **눌러 보는 소리.**
 *
 * 이름과 설명만 보고는 어떤 소리인지 아무도 모른다. 고르는 순간이 사람이 누른
 * 순간이라 여기서 준비해도 브라우저가 막지 않는다.
 */
export function previewTone(toneId, volumeId) {
  primeAudio();
  return playTone(toneId, volumeId);
}

/**
 * 시간이 다 됐다고 알린다.
 *
 * 소리와 진동 둘 다 **안 될 수 있다** — 소리는 브라우저가 막을 수 있고,
 * 진동은 아이폰이 지원하지 않는다. 그래서 화면 쪽 표시(띠가 초록으로 바뀌고
 * 「휴식 끝」이 뜨는 것)를 언제나 같이 둔다. 이것만 믿지 않는다.
 */
export function beepDone({ sound = true, vibrate = true, tone = DEFAULT_TONE, volume = DEFAULT_VOLUME } = {}) {
  if (sound) playTone(tone, volume);
  if (vibrate) {
    try {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 300]);
    } catch { /* 지원 안 하는 브라우저 */ }
  }
}
