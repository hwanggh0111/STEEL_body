import { useEffect, useRef, useState } from 'react';
import { readPoseFrame } from '../data/poseModel';
import {
  jointFor, jointAngle, startReps, repTick, repsLine, cannotCount, JOINTS,
} from '../data/repCount';

// 횟수 세기 — **폰을 옆에 두면 대신 센다** (2026-09-30).
//
// 계산은 `data/repCount.js` 가 한다(카메라를 모르고, 검사가 값으로 본다).
// 여기는 **카메라를 켜고 프레임을 넘기고 숫자를 보여주는 일**만 한다.
//
// ── 지키는 것 ──
//
// 1. **사람이 누를 때만 켠다.** 화면을 열었다고 카메라가 켜지지 않는다.
//    닫으면 그 자리에서 트랙을 멈춘다 — 탭의 촬영 표시가 바로 사라져야 꺼진 것을 안다
//    (`useBreath` 가 마이크에 두는 규칙과 같다).
// 2. **영상을 남기지 않는다.** 프레임을 모델에 넘기고 버린다. 녹화하지 않고,
//    어디로도 보내지 않는다 — 나가는 것은 **숫자 하나**다.
// 3. **자세를 평하지 않는다.** 세는 것 말고는 말하지 않는다 — 한 대의 폰이 알 수 있는
//    것이 아니다 (`repCount.js` 머리글에 적어둔 선).
//
// ── 왜 뒤 카메라인가 ──
//
// 세려면 폰을 **옆에 세워두고** 스스로 찍혀야 한다. 앞 카메라는 손에 들고 보는 것이라
// 온몸이 안 들어온다. 뒤 카메라를 먼저 청하고, 없으면 있는 것을 쓴다.

const STAGE = {
  download: '자세 인식을 처음 받는 중이에요 (한 번만 받아요)',
  prepare: '준비하는 중…',
};

export default function RepCounter({ exercise, onDone, onClose }) {
  const joint = jointFor(exercise);
  const cannot = cannotCount(exercise);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const stRef = useRef(null);
  const stopRef = useRef(false);

  const [stage, setStage] = useState(null);
  const [error, setError] = useState(null);
  const [live, setLive] = useState(false);
  const [count, setCount] = useState(0);
  const [line, setLine] = useState(null);

  // 다 끄고 나간다. **여기 한 곳에서만 끈다** — 두 곳에서 끄면 한쪽만 고치는 날이 온다
  const shutdown = () => {
    stopRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    streamRef.current?.getTracks?.().forEach((t) => t.stop());
    streamRef.current = null;
    setLive(false);
  };

  useEffect(() => () => shutdown(), []);     // 화면을 떠나면 반드시 끈다

  const start = async () => {
    if (!joint || joint === 'hold') return;
    setError(null);
    setStage('prepare');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // 뒤 카메라를 **청한다**(강요하지 않는다) — 없는 기기에서 `exact` 로 두면 아예 안 열린다
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (!v) { stream.getTracks().forEach((t) => t.stop()); return; }
      v.srcObject = stream;
      await v.play();

      stRef.current = startReps(joint);
      stopRef.current = false;
      setCount(0);
      setLine(null);
      setLive(true);

      // 첫 프레임에서 모델을 받는다 (10MB — 한 번만)
      setStage('download');
      let last = -1;
      const loop = async () => {
        if (stopRef.current) return;
        const el = videoRef.current;
        if (!el || el.readyState < 2) { rafRef.current = requestAnimationFrame(loop); return; }
        // **늘 늘어나는 값을 준다.** 같은 값을 두 번 주면 모델이 거절한다
        const at = Math.max(last + 1, Math.round(performance.now()));
        last = at;
        try {
          const marks = await readPoseFrame(el, at, setStage);
          setStage(null);
          const aspect = el.videoWidth && el.videoHeight ? el.videoWidth / el.videoHeight : 1;
          const angle = marks ? jointAngle(marks, joint, aspect) : null;
          const next = repTick(stRef.current, angle, Date.now());
          stRef.current = next;
          setCount(next.count);
          setLine(repsLine(next));
        } catch {
          // 한 프레임 실패는 넘어간다. 계속 실패하면 아래 `error` 로 떨어질 일이 아니라
          // **숫자가 안 올라가는 것**으로 보이고, 그때 「몸을 못 찾았어요」가 뜬다
        }
        if (!stopRef.current) rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError';
      setStage(null);
      setError(denied
        ? '카메라를 막아두셨어요. 주소창 자물쇠에서 허용하면 켜집니다'
        : '이 기기에서는 카메라를 못 써요');
      shutdown();
    }
  };

  const finish = () => {
    const got = stRef.current?.count ?? 0;
    shutdown();
    onDone?.(got);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="횟수 세기"
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>횟수 세기</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
            {exercise}{joint && joint !== 'hold' ? ` · ${JOINTS[joint].label}을 봐요` : ''}
          </div>
        </div>
        <button
          className="btn-secondary"
          onClick={() => { shutdown(); onClose?.(); }}
          style={{ width: 'auto', padding: '7px 13px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}
        >닫기</button>
      </div>

      {/* ── 셀 수 없는 운동 ──
          **카메라를 아예 안 연다.** 열어놓고 0 을 보여주면 고장으로 읽는다 */}
      {cannot ? (
        <div style={{ padding: 18, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.75 }}>
          {cannot}
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            횟수는 손으로 적어주세요.
          </div>
        </div>
      ) : (
        <>
          <div style={{ position: 'relative', flex: 1, minHeight: 0, background: '#000' }}>
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: live ? 'block' : 'none' }}
            />
            {/* 큰 숫자. 폰이 멀리 있으니 **멀리서 읽히게** 크게 */}
            {live && (
              <div style={{
                position: 'absolute', top: 12, left: 0, right: 0, textAlign: 'center',
                fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif", fontSize: 88, lineHeight: 1,
                color: 'var(--accent)', textShadow: '0 2px 12px rgba(0,0,0,0.6)',
              }}>{count}</div>
            )}
            {!live && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20,
              }}>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.75, textAlign: 'center' }}>
                  폰을 <b style={{ color: 'var(--text-secondary)' }}>옆에 세워두고</b> 온몸이 보이게 놓아주세요.<br />
                  <b style={{ color: 'var(--text-secondary)' }}>영상은 아무 데도 안 남아요</b> — 세고 나서 숫자만 가져갑니다.
                </div>
                <button
                  className="btn-primary"
                  onClick={start}
                  disabled={stage !== null}
                  style={{ width: 'auto', padding: '11px 22px', fontFamily: 'inherit', cursor: 'pointer' }}
                >{stage ? (STAGE[stage] || '여는 중…') : '카메라 켜기'}</button>
                {error && (
                  <div style={{ fontSize: 12.5, color: 'var(--danger)', lineHeight: 1.65, textAlign: 'center' }}>
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            {/* 왜 숫자가 안 올라가는지 적는다 — 안 적으면 「내가 잘못하나」로 읽는다 */}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', minHeight: 18, lineHeight: 1.6 }}>
              {stage ? (STAGE[stage] || '읽는 중…') : (line || '')}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                className="btn-secondary"
                onClick={() => { stRef.current = startReps(joint); setCount(0); setLine(null); }}
                disabled={!live}
                style={{ flex: '0 0 34%', minHeight: 44, fontFamily: 'inherit', cursor: live ? 'pointer' : 'default' }}
              >0으로</button>
              <button
                className="btn-primary"
                onClick={finish}
                disabled={!live}
                style={{ flex: 1, minHeight: 44, fontFamily: 'inherit', cursor: live ? 'pointer' : 'default' }}
              >{count}회로 적기</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
