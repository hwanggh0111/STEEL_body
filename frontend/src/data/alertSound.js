// 시간이 다 됐을 때 알리는 소리와 진동.
//
// 휴식 타이머와 측정 시스템의 타이머, 두 곳이 쓴다.
//
// 예전에는 **진동뿐이었다.** 그런데 `navigator.vibrate` 는 아이폰 사파리가 아예 지원하지
// 않는다 — 아이폰에서는 휴식이 끝나도 화면 깜빡임 말고는 아무 일도 없었다.
// 화면이 꺼져 있으면 그것도 못 본다.
//
// 그래서 소리를 넣는다. 소리 파일을 두지 않고 그 자리에서 만든다 —
// 파일 하나 때문에 첫 화면이 무거워질 이유가 없다.

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

function beep(at, freq, seconds) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  // 갑자기 켜고 끄면 '틱' 하는 잡음이 난다. 짧게 올렸다 내린다
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(0.22, at + 0.02);
  gain.gain.linearRampToValueAtTime(0, at + seconds);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + seconds + 0.02);
}

/**
 * 시간이 다 됐다고 알린다.
 *
 * 소리와 진동 둘 다 **안 될 수 있다** — 소리는 브라우저가 막을 수 있고,
 * 진동은 아이폰이 지원하지 않는다. 그래서 화면 쪽 표시(띠가 초록으로 바뀌고
 * 「휴식 끝」이 뜨는 것)를 언제나 같이 둔다. 이것만 믿지 않는다.
 */
export function beepDone(withSound = true, withVibrate = true) {
  if (withSound && ctx && ctx.state === 'running') {
    try {
      const now = ctx.currentTime;
      beep(now, 880, 0.12);
      beep(now + 0.18, 880, 0.12);
      beep(now + 0.36, 1174, 0.2);
    } catch { /* 소리가 안 나도 넘어간다 */ }
  }
  if (withVibrate) {
    try {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 300]);
    } catch { /* 지원 안 하는 브라우저 */ }
  }
}
