import { useRestTimerStore, formatLeft, PRESETS, MIN_SEC, MAX_SEC } from '../store/restTimerStore';
import { primeAudio } from '../data/restAlert';
import { useState } from 'react';

// 휴식 타이머 — 기록 화면에 붙는 자리.
//
// 시간을 세는 일과 알리는 일은 스토어와 Layout 의 띠가 한다. 여기는 **고르고 누르는 자리**다.
// 그래서 다른 화면으로 옮겨도 타이머는 그대로 돈다.

const RING = 78;
const R = 34;
const CIRC = 2 * Math.PI * R;

function Ring({ ratio, children }) {
  return (
    <div style={{ position: 'relative', width: RING, height: RING, flexShrink: 0 }}>
      <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} aria-hidden="true">
        <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke="var(--bg-tertiary)" strokeWidth="6" />
        <circle
          cx={RING / 2} cy={RING / 2} r={R} fill="none"
          stroke="var(--accent)" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - Math.max(0, Math.min(1, ratio)))}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          style={{ transition: 'stroke-dashoffset 0.25s linear' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{children}</div>
    </div>
  );
}

function Toggle({ on, onClick, label, desc }) {
  return (
    <div
      role="switch"
      aria-checked={on}
      aria-label={label}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '4px 0' }}
    >
      <div style={{ flexGrow: 1 }}>
        <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>{label}</div>
        {desc && <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{desc}</div>}
      </div>
      <div style={{
        width: 40, height: 22, borderRadius: 11, padding: 3, flexShrink: 0,
        background: on ? 'var(--accent)' : 'var(--bg-tertiary)',
        border: on ? 'none' : '1px solid var(--border-hover)',
        display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start',
        transition: 'background 0.15s',
      }}>
        <div style={{
          width: on ? 16 : 14, height: on ? 16 : 14, borderRadius: 8,
          background: on ? '#000' : 'var(--text-muted)',
        }} />
      </div>
    </div>
  );
}

export default function RestTimer() {
  const {
    duration, leftMs, deadline, pausedLeft, label,
    autoStart, sound, setDuration, setAutoStart, setSound,
    start, add, pause, resume, stop,
  } = useRestTimerStore();

  const [custom, setCustom] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const running = deadline != null;
  const paused = pausedLeft != null;
  const active = running || paused;
  const ratio = active ? (leftMs ?? 0) / (duration * 1000) : 1;

  // 소리는 **사람이 누른 그 순간**에 준비해야 브라우저가 막지 않는다
  const begin = (sec) => { primeAudio(); start(sec ?? duration, label); };

  const applyCustom = () => {
    const n = parseInt(custom, 10);
    if (!Number.isFinite(n) || n < MIN_SEC || n > MAX_SEC) return;
    setDuration(n);
    setCustom('');
    setShowCustom(false);
  };

  return (
    <div className="card" style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="label" style={{ marginBottom: 0 }}>휴식 타이머</div>

      {active ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Ring ratio={ratio}>
              <span style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 1,
                color: paused ? 'var(--text-muted)' : 'var(--text-primary)', lineHeight: 1,
              }}>{formatLeft(leftMs)}</span>
            </Ring>
            <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span className={`badge ${paused ? 'badge-warning' : 'badge-accent'}`} style={{ alignSelf: 'flex-start' }}>
                {paused ? '멈춤' : '휴식 중'}
              </span>
              {label && (
                <div style={{ fontSize: 13.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {label}
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{duration}초 중</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" style={{ flexGrow: 1 }} onClick={() => add(30)}>+30초</button>
            <button className="btn-secondary" style={{ flexGrow: 1 }} onClick={paused ? resume : pause}>
              {paused ? '이어서' : '일시정지'}
            </button>
            <button className="btn-secondary" style={{ flexGrow: 1 }} onClick={stop}>그만</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6 }}>
            {PRESETS.map(sec => (
              <button
                key={sec}
                className={`btn-secondary${duration === sec && !showCustom ? ' active' : ''}`}
                style={{ flexGrow: 1, padding: '9px 0' }}
                onClick={() => { setDuration(sec); setShowCustom(false); }}
              >{sec}초</button>
            ))}
            <button
              className={`btn-secondary${showCustom ? ' active' : ''}`}
              style={{ flexGrow: 1, padding: '9px 0' }}
              onClick={() => setShowCustom(v => !v)}
            >직접</button>
          </div>

          {showCustom && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min={MIN_SEC}
                max={MAX_SEC}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCustom(); } }}
                placeholder={`${MIN_SEC}~${MAX_SEC}초`}
              />
              <button className="btn-secondary" onClick={applyCustom} style={{ flexShrink: 0 }}>맞춤</button>
            </div>
          )}

          <button className="btn-primary" onClick={() => begin()}>{duration}초 쉬기</button>
        </>
      )}

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
        <Toggle
          on={autoStart}
          onClick={() => { primeAudio(); setAutoStart(!autoStart); }}
          label="저장하면 저절로 시작"
          desc="끄면 예전처럼 직접 눌러서 시작합니다"
        />
        <Toggle
          on={sound}
          onClick={() => { primeAudio(); setSound(!sound); }}
          label="끝나면 소리로 알리기"
          desc="아이폰은 진동이 안 옵니다. 소리로 알립니다"
        />
      </div>
    </div>
  );
}
