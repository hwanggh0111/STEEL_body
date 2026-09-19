import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRestTimerStore, formatLeft } from '../store/restTimerStore';
import { beepDone } from '../data/alertSound';
import { useWakeLock } from '../data/useWakeLock';

// 휴식 중일 때 탭 바 바로 위에 뜨는 띠.
//
// 예전 타이머는 기록 화면 안에만 있어서, 쉬는 동안 인바디를 보러 가면 사라졌다.
// 이 띠는 Layout 에 있어서 **어느 화면에서나** 보인다.
//
// 끝났다고 알리는 것도 여기서 한다. 화면마다 따로 두면 어느 화면에 있느냐에 따라
// 소리가 나기도 하고 안 나기도 한다 — 언제나 떠 있는 이 자리에 한 번만 둔다.

export default function RestBar({ bottom = 58 }) {
  const { leftMs, deadline, pausedLeft, finished, label, runSec, duration, sound, vibrate, tone, volume, add, pause, resume, stop, ackFinished } = useRestTimerStore();
  const navigate = useNavigate();
  const location = useLocation();
  const alerted = useRef(false);

  // 끝나면 소리와 진동. **한 번만** 울린다
  useEffect(() => {
    if (!finished) { alerted.current = false; return; }
    if (alerted.current) return;
    alerted.current = true;
    beepDone({ sound, vibrate, tone, volume });
    // 다 됐다는 표시를 잠깐 두고 스스로 걷는다 — 누르지 않아도 사라진다
    const t = setTimeout(() => ackFinished(), 6000);
    return () => clearTimeout(t);
  }, [finished, sound, vibrate, tone, volume, ackFinished]);

  const running = deadline != null;
  const paused = pausedLeft != null;

  // 쉬는 동안 화면을 안 재운다 (2026-09-17).
  //
  // 90초 휴식에 화면이 꺼지면, 다음 세트를 하려고 **폰을 깨워 잠금까지 풀어야 한다** —
  // 세트마다 그런다. 땀 묻은 손으로.
  //
  // **이 자리에 두는 이유.** 이 띠는 껍데기(Layout)에 있어서 어느 화면에서나 떠 있다.
  // 화면마다 따로 두면 어디에 있느냐에 따라 화면이 꺼지기도 하고 안 꺼지기도 한다 —
  // 끝났다고 알리는 소리를 여기 한 번만 둔 것과 같은 이유다.
  //
  // **오래 잡고 있을 걱정은 없다.** 휴식은 길어야 10분이고(`MAX_SEC`), 다 되면
  // `deadline` 이 지워지면서 저절로 놓는다. **훅은 이른 반환보다 위에 있어야 한다**
  useWakeLock(running || paused);

  if (!running && !paused && !finished) return null;

  // **지금 도는 휴식이 몇 초짜리인가(`runSec`)로 잰다** (2026-09-19 에 고쳤다).
  //
  // 여태 `duration` — **다음 휴식에 쓸 기본값** — 으로 쟀다. 그래서 둘이 어긋나는
  // 순간마다 띠가 거짓말을 했다:
  //   · +30초를 누르면 120초를 쉬는데 잣대는 90초다 → 비율이 1을 넘어 **띠가 꽉 찬 채로
  //     30초를 멈춰 있다** (`Math.min(1, …)` 에 잘린다)
  //   · 쉬는 중에 프리셋을 180초로 바꾸면 **띠가 그 자리에서 반으로 줄어든다**
  // 같은 것을 2026-09-14 에 링(`RestTimer`)에서 고쳤는데, 이 띠는 그대로 남아 있었다.
  const span = runSec > 0 ? runSec : duration;
  const ratio = finished ? 1 : Math.max(0, Math.min(1, (leftMs ?? 0) / (span * 1000)));
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
        onClick={() => { if (location.pathname !== '/train') navigate('/train'); }}
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
            <div style={{ height: 4, width: `${ratio * 100}%`, background: color, borderRadius: 'var(--radius)', transition: 'width 1s linear'   /* 스토어가 초당 한 번만 알려준다 (restTimerStore 의 tick) */ }} />
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
