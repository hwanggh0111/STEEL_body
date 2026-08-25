import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRestTimerStore, formatLeft } from '../store/restTimerStore';
import { alertRestDone } from '../data/restAlert';

// 휴식 중일 때 탭 바 바로 위에 뜨는 띠.
//
// 예전 타이머는 기록 화면 안에만 있어서, 쉬는 동안 인바디를 보러 가면 사라졌다.
// 이 띠는 Layout 에 있어서 **어느 화면에서나** 보인다.
//
// 끝났다고 알리는 것도 여기서 한다. 화면마다 따로 두면 어느 화면에 있느냐에 따라
// 소리가 나기도 하고 안 나기도 한다 — 언제나 떠 있는 이 자리에 한 번만 둔다.

export default function RestBar({ bottom = 58 }) {
  const { leftMs, deadline, pausedLeft, finished, label, duration, sound, vibrate, add, pause, resume, stop, ackFinished } = useRestTimerStore();
  const navigate = useNavigate();
  const location = useLocation();
  const alerted = useRef(false);

  // 끝나면 소리와 진동. **한 번만** 울린다
  useEffect(() => {
    if (!finished) { alerted.current = false; return; }
    if (alerted.current) return;
    alerted.current = true;
    alertRestDone(sound, vibrate);
    // 다 됐다는 표시를 잠깐 두고 스스로 걷는다 — 누르지 않아도 사라진다
    const t = setTimeout(() => ackFinished(), 6000);
    return () => clearTimeout(t);
  }, [finished, sound, vibrate, ackFinished]);

  const running = deadline != null;
  const paused = pausedLeft != null;
  if (!running && !paused && !finished) return null;

  const ratio = finished ? 1 : Math.max(0, Math.min(1, (leftMs ?? 0) / (duration * 1000)));
  const color = finished ? 'var(--success)' : 'var(--accent)';

  return (
    <div
      style={{
        position: 'fixed', left: 0, right: 0, bottom,
        zIndex: 9998,
        borderTop: `1px solid ${color}`,
        background: finished ? 'var(--success-dim)' : 'var(--accent-dim)',
        padding: '9px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}
      role="status"
      aria-live="polite"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }} aria-hidden="true">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2M9 2h6" />
      </svg>

      <div
        style={{ flexGrow: 1, minWidth: 0, cursor: 'pointer' }}
        onClick={() => { if (location.pathname !== '/workout') navigate('/workout'); }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 1.5,
            color, lineHeight: 1,
          }}>{finished ? '휴식 끝' : formatLeft(leftMs)}</span>
          <span style={{
            fontSize: 12, color: 'var(--text-secondary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{paused ? '멈춤' : label || (finished ? '다음 세트 하세요' : '휴식 중')}</span>
        </div>
        {!finished && (
          <div className="progress-bg" style={{ height: 4, marginTop: 5 }}>
            <div style={{ height: 4, width: `${ratio * 100}%`, background: color, borderRadius: 'var(--radius)', transition: 'width 0.25s linear' }} />
          </div>
        )}
      </div>

      {!finished && (
        <>
          <button className="btn-secondary" style={{ flexShrink: 0, padding: '6px 10px' }} onClick={() => add(30)}>+30</button>
          <button className="btn-secondary" style={{ flexShrink: 0, padding: '6px 10px' }} onClick={paused ? resume : pause}>
            {paused ? '이어서' : '멈춤'}
          </button>
        </>
      )}

      <button
        onClick={finished ? ackFinished : stop}
        aria-label="닫기"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 18, lineHeight: 1, padding: 4, flexShrink: 0,
        }}
      >×</button>
    </div>
  );
}
