import { useCallback, useEffect, useRef, useState } from 'react';
import { baselineOf, breathState, usable, CALIBRATE_MS, BEEP_BLIND_MS } from './breathRest';

// 마이크를 켜고 **소리 크기만** 재는 자리 (2026-09-22).
//
// 판단은 `breathRest.js` 가 한다(거기는 마이크를 모르고, 검사가 값으로 본다).
// 여기는 **마이크만** 다룬다 — 눈과 귀로만 확인되는 자리라, `VoiceSet` 이 마이크를
// 다루는 방식과 같은 결로 짠다.
//
// ── 지키는 것 ──
//
// 1. **사용자가 켤 때만 켠다.** 홈트를 연다고 마이크가 켜지지 않는다.
//    끄면 그 자리에서 트랙을 멈춘다 — 브라우저 탭의 녹음 표시가 바로 사라져야
//    사람이 꺼진 것을 안다.
// 2. **소리를 남기지 않는다.** `AnalyserNode` 로 크기만 읽고 버린다.
//    녹음하지 않고, 어디로도 보내지 않는다. `MediaRecorder` 를 안 쓴다.
// 3. **앱이 내는 소리는 흘려보낸다.** 단계가 바뀔 때 `beepDone()` 이 울리고
//    마이크가 그것을 같이 듣는다 — 안 버리면 앱이 제 소리를 듣고 「숨이 찼다」고 한다.

/** 몇 밀리초마다 한 번 읽나. 숨은 초 단위로 움직여서 이보다 자주 볼 이유가 없다. */
const TICK_MS = 120;

/** 판단에 쓰는 창. 한 번 튄 값으로 시간을 늘리지 않게 여러 번을 모아 본다. */
const WINDOW = 12;

/** 제곱평균(RMS) — 귀가 듣는 크기에 가깝다. 최대값만 보면 딸깍 소리 하나에 튄다. */
function rmsOf(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i += 1) {
    const v = (buf[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / buf.length);
}

/**
 * 숨 듣기.
 *
 * 돌려주는 것:
 *   on        켜져 있나
 *   phase     'off' · 'asking'(권한 묻는 중) · 'calibrating'(기준선 재는 중) · 'ready' · 'blocked'
 *   why       못 쓰는 까닭 한 줄 (phase 가 'blocked' 일 때)
 *   state     지금 숨 — 'calm' · 'mid' · 'high' · null
 *   level     지금 크기 (파형을 그리는 데만 쓴다)
 *   history   최근 크기들 (파형)
 *   base      기준선
 *   start()   켠다 (사용자가 누를 때만 부른다 — 권한 창이 뜬다)
 *   stop()    끈다. 트랙을 바로 멈춘다
 *   blind()   지금부터 잠깐 흘려보낸다 (알림 소리가 울릴 때 부른다)
 *   peakSince(ms) 그 시각 이후의 가장 큰 값 — 「숨이 제일 찼던 동작」에 쓴다
 */
export function useBreath(th) {
  const [on, setOn] = useState(false);
  const [phase, setPhase] = useState('off');
  const [why, setWhy] = useState(null);
  const [state, setState] = useState(null);
  const [level, setLevel] = useState(0);
  const [history, setHistory] = useState([]);
  const [base, setBase] = useState(null);

  const ctxRef = useRef(null);
  const streamRef = useRef(null);
  const analyserRef = useRef(null);
  const timerRef = useRef(null);
  const blindUntilRef = useRef(0);
  const calibRef = useRef(null);
  const windowRef = useRef([]);
  // 기준선을 **ref 로도** 들고 있는다. 1초에 여덟 번 도는 타이머는 자기가 만들어질 때의
  // state 를 붙잡고 있어서, `base` 를 state 로만 두면 **언제까지나 null 로 보인다**
  // (`HomeworkoutPage` 가 단계 전환에서 `phaseRef` 를 쓰는 것과 같은 자리다)
  const baseRef = useRef(null);
  // 예민도도 ref 로 든다 — 1초에 여덟 번 도는 타이머가 옛 값을 붙잡고 있으면
  // 설정을 바꿔도 안 바뀐다 (기준선과 같은 자리다)
  const thRef = useRef(th);
  thRef.current = th;
  // 동작마다 가장 컸던 값을 찾으려면 **언제 얼마였나**가 있어야 한다.
  // 판 하나(10분)면 5천 개쯤이라 메모리에 두어도 된다 — 끝나면 버린다
  const marksRef = useRef([]);

  const stop = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    // **트랙을 멈춘다.** `AudioContext` 만 닫으면 탭의 녹음 표시가 남는다 —
    // 껐는데 빨간 점이 그대로면 사람은 꺼진 것을 못 믿는다
    streamRef.current?.getTracks?.().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
    ctxRef.current?.close?.();
    ctxRef.current = null;
    calibRef.current = null;
    baseRef.current = null;
    windowRef.current = [];
    marksRef.current = [];
    setOn(false);
    setPhase('off');
    setState(null);
    setLevel(0);
    setHistory([]);
    setBase(null);
    setWhy(null);
  }, []);

  const start = useCallback(async () => {
    if (on) return;
    setPhase('asking');
    setWhy(null);
    try {
      // 브라우저가 스스로 소리를 다듬는 것들을 **끈다.** 자동 볼륨 조절이 켜져 있으면
      // 숨이 찰수록 브라우저가 볼륨을 낮춰서, 잰 값이 늘 비슷해진다
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;

      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      // **어디로도 안 내보낸다.** `ctx.destination` 에 붙이면 제 소리가 스피커로 나간다
      analyserRef.current = analyser;

      const buf = new Uint8Array(analyser.fftSize);
      calibRef.current = { until: Date.now() + CALIBRATE_MS, samples: [] };
      setOn(true);
      setPhase('calibrating');

      timerRef.current = setInterval(() => {
        const a = analyserRef.current;
        if (!a) return;
        a.getByteTimeDomainData(buf);
        const now = Date.now();
        const v = rmsOf(buf);

        // 알림 소리가 울린 직후는 **앱이 제 소리를 듣는 시간**이라 통째로 버린다
        if (now < blindUntilRef.current) return;

        setLevel(v);
        setHistory((h) => [...h.slice(-(WINDOW * 2 - 1)), v]);
        marksRef.current.push({ at: now, v });

        const cal = calibRef.current;
        if (cal) {
          if (now < cal.until) { cal.samples.push(v); return; }
          const b = baselineOf(cal.samples);
          const can = usable(b);
          calibRef.current = null;
          baseRef.current = can.ok ? b : null;
          setBase(b);
          if (!can.ok) { setPhase('blocked'); setWhy(can.why); return; }
          setPhase('ready');
          return;
        }

        // 기준선을 못 잡은 자리(시끄러운 방)에서는 **아무 판단도 안 한다**
        if (baseRef.current === null) return;

        // 한 번 튄 값으로 시간을 늘리지 않게 **여러 번의 가운데 값**으로 본다
        const w = windowRef.current;
        w.push(v);
        if (w.length > WINDOW) w.shift();
        setState(breathState(baselineOf(w), baseRef.current, thRef.current));
      }, TICK_MS);
    } catch (err) {
      // 막힌 것과 아예 없는 것을 가른다 — 사람이 할 수 있는 일이 다르다
      const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError';
      setPhase('blocked');
      setWhy(denied
        ? '마이크를 막아두셨어요. 주소창 자물쇠에서 허용하면 켜집니다'
        : '이 기기에서는 마이크를 못 써요');
      setOn(false);
      streamRef.current?.getTracks?.().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, [on]);

  /** 알림 소리가 울릴 때 부른다. 그 소리를 마이크가 같이 듣는 시간을 버린다. */
  const blind = useCallback(() => {
    blindUntilRef.current = Date.now() + BEEP_BLIND_MS;
  }, []);

  /** 그 시각 이후로 가장 컸던 값. 동작이 끝날 때 불러 「숨이 제일 찼던 동작」을 모은다. */
  const peakSince = useCallback((since) => {
    let max = 0;
    for (let i = marksRef.current.length - 1; i >= 0; i -= 1) {
      const m = marksRef.current[i];
      if (m.at < since) break;
      if (m.v > max) max = m.v;
    }
    return max;
  }, []);

  // 화면을 떠나면 **반드시 끈다.** 안 끄면 마이크가 켜진 채로 남는다
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks?.().forEach((t) => t.stop());
    ctxRef.current?.close?.();
  }, []);

  return { on, phase, why, state, level, history, base, start, stop, blind, peakSince };
}

/** 이 브라우저에서 마이크를 쓸 수 있나. 없으면 스위치를 아예 안 그린다. */
export function micSupported() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}
