import { useRestTimerStore, formatLeft, PRESETS, MIN_SEC, MAX_SEC } from '../store/restTimerStore';
import { primeAudio } from '../data/alertSound';
import { useRoutineSessionStore } from '../store/routineSessionStore';
import { useState } from 'react';

// 휴식 타이머 — 기록 화면에 붙는 자리.
//
// 시간을 세는 일과 알리는 일은 스토어와 Layout 의 띠가 한다. 여기는 **고르고 누르는 자리**다.
// 그래서 다른 화면으로 옮겨도 타이머는 그대로 돈다.

// 큰 링 — 시안 A 의 것이다.
//
// 8/25 에는 안 넣었다. C(세트에 붙는다) 로 가면서 링 옆에 「방금 저장한 세트」와
// 「다음 운동」을 적는 배치를 골랐고, 큰 링을 넣으면 그 자리와 부딪힌다고 봤다.
// 그래서 78px 짜리 작은 링을 옆에 붙였다.
//
// 다시 보니 부딪히는 게 아니라 **위아래로 놓으면 되는 것**이었다. 링을 위에 크게 두고
// 그 아래에 방금 저장한 세트와 다음 운동을 적는다. 둘 다 들어간다.
//
// 큰 링이 필요한 이유는 이것이다 — **폰을 내려놓고 쓰는 물건**이다. 벤치에 누워
// 팔 뻗은 거리에서 22px 숫자는 안 읽힌다. 시안 A 의 60px 이 그래서 나온 크기다.
const RING = 190;
const R = 86;
const CIRC = 2 * Math.PI * R;

function Ring({ ratio, children }) {
  return (
    <div style={{ position: 'relative', width: RING, height: RING, maxWidth: '100%', flexShrink: 0 }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${RING} ${RING}`} aria-hidden="true">
        <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke="var(--bg-tertiary)" strokeWidth="10" />
        <circle
          cx={RING / 2} cy={RING / 2} r={R} fill="none"
          stroke="var(--accent)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - Math.max(0, Math.min(1, ratio)))}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          style={{ transition: 'stroke-dashoffset 0.25s linear' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
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
    duration, runSec, leftMs, deadline, pausedLeft, label,
    autoStart, sound, vibrate, setDuration, setAutoStart, setSound, setVibrate,
    start, add, pause, resume, stop,
  } = useRestTimerStore();

  // 루틴을 따라가는 중이면 다음에 무엇을 하는지 쉬면서 알려준다
  const session = useRoutineSessionStore(s => s.session);
  const nextName = session && session.current >= 0
    ? session.items[session.current]?.name
    : null;

  const [custom, setCustom] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const running = deadline != null;
  const paused = pausedLeft != null;
  const active = running || paused;
  // 지금 도는 것이 몇 초짜리인지로 잰다 (설정값이 아니라). +30초를 눌러도 맞는다
  const span = runSec || duration;
  const ratio = active ? (leftMs ?? 0) / (span * 1000) : 1;

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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <Ring ratio={ratio}>
              <span style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: 56, letterSpacing: 3,
                color: paused ? 'var(--text-muted)' : 'var(--text-primary)', lineHeight: 1,
              }}>{formatLeft(leftMs)}</span>
              <span style={{ fontSize: 12, color: paused ? 'var(--warning)' : 'var(--text-muted)' }}>
                {paused ? '멈춤' : `${span}초 중`}
              </span>
            </Ring>

            {/* 방금 저장한 세트와 다음 운동 — C 안의 것이다. 링 아래에 놓으면
                큰 링과 부딪히지 않는다 */}
            {(label || nextName) && (
              <div style={{ width: '100%', minWidth: 0, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {label && (
                  <div style={{ fontSize: 13.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {label}
                  </div>
                )}
                {nextName && (
                  <div style={{
                    fontSize: 12.5, color: 'var(--text-secondary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>다음 · {nextName}</div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <button className="btn-secondary" style={{ flexGrow: 1 }} onClick={() => add(30)}>+30초</button>
            <button className="btn-secondary" style={{ flexGrow: 1 }} onClick={paused ? resume : pause}>
              {paused ? '이어서' : '일시정지'}
            </button>
            {/* 다 쉬었으면 기다리지 않는다. 휴식을 끝내고 다음 세트로 간다 */}
            <button
              className="btn-primary"
              style={{ flexGrow: 1, width: 'auto', fontSize: 14, padding: '9px 0' }}
              onClick={stop}
            >바로 시작</button>
          </div>
        </>
      ) : null}

      {/* 프리셋 — 시안 A 는 쉬는 중에도 이 줄을 보여준다.
          다만 여기서 고르는 것은 **다음 휴식**의 길이다. 도는 것을 중간에 늘리거나
          줄이는 자리가 아니다 (그건 +30초가 한다) — 그래서 쉬는 중에는 그렇게 적는다 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {active && (
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>다음 휴식</div>
        )}
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
      </div>

      {!active && (
        <button className="btn-primary" onClick={() => begin()}>{duration}초 쉬기</button>
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
        />
        <Toggle
          on={vibrate}
          onClick={() => setVibrate(!vibrate)}
          label="끝나면 진동으로 알리기"
          desc="아이폰은 진동을 지원하지 않습니다. 소리로 알립니다"
        />
      </div>
    </div>
  );
}
