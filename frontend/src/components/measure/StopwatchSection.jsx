import { useState, useEffect, useRef } from 'react';
import { toast } from '../Toast';
import { primeAudio, beepDone } from '../../data/alertSound';

// 스톱워치 · 타이머.
//
// **100ms 마다 100 을 더하고 빼던 것을 고쳤다.** 휴식 타이머와 홈트 타이머에서 고친
// 것과 같은 버그다 — 화면을 내리거나 다른 앱을 보면 브라우저가 타이머를 늦춘다.
// 플랭크를 재려고 폰을 내려놓으면 정확히 그때 어긋난다.
//
// 이제 시작한 시각을 붙들어 두고, 지금 시각과의 차이로 센다.
// 멈췄다 이어서 하면 그때까지 쌓인 것에 이어붙인다.
export default function StopwatchSection({ onSave }) {
  const [mode, setMode] = useState('stopwatch');
  const [running, setRunning] = useState(false);
  const [time, setTime] = useState(0);
  const [laps, setLaps] = useState([]);
  const [timerInput, setTimerInput] = useState('60');
  // 돌기 시작한 시각. 여기서부터 지금까지가 이번에 흐른 시간이다
  const anchorRef = useRef(0);
  // 멈추기 전까지 쌓인 값 (스톱워치는 흐른 시간, 타이머는 남은 시간)
  const baseRef = useRef(0);

  useEffect(() => {
    if (!running) return;

    anchorRef.current = Date.now();
    const base = baseRef.current;

    const id = setInterval(() => {
      const gone = Date.now() - anchorRef.current;
      if (mode === 'timer') {
        const left = base - gone;
        if (left <= 0) {
          baseRef.current = 0;
          setTime(0);
          setRunning(false);
          beepDone();
          toast('타이머 종료!');
          return;
        }
        setTime(left);
      } else {
        setTime(base + gone);
      }
    }, 100);

    return () => {
      clearInterval(id);
      // 멈출 때 지금까지 것을 쌓아둔다. 안 그러면 이어서 하기가 처음부터 다시 된다
      const gone = Date.now() - anchorRef.current;
      baseRef.current = mode === 'timer' ? Math.max(0, base - gone) : base + gone;
    };
  }, [running, mode]);

  const formatTime = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    const dec = Math.floor((ms % 1000) / 100);
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${dec}`;
  };

  const handleStart = () => {
    // 소리는 **사람이 누른 이 순간**에 준비해야 브라우저가 막지 않는다
    primeAudio();
    if (mode === 'timer' && !running && time === 0) {
      const ms = Math.max(0, Number(timerInput) || 0) * 1000;
      baseRef.current = ms;
      setTime(ms);
    }
    setRunning(true);
  };

  const handleStop = () => setRunning(false);

  const handleReset = () => {
    setRunning(false);
    baseRef.current = 0;
    setTime(0);
    setLaps([]);
  };

  const handleLap = () => {
    setLaps(prev => [time, ...prev]);
  };

  const handleSaveRecord = () => {
    if (time === 0) return;
    onSave({ time, formatted: formatTime(time), laps: laps.map(l => formatTime(l)) });
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="section-title"><div className="accent-bar" />스톱워치 / 타이머</div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button className={`btn-secondary${mode === 'stopwatch' ? ' active' : ''}`}
          onClick={() => { handleReset(); setMode('stopwatch'); }} style={{ fontSize: 12, padding: '6px 14px' }}>스톱워치</button>
        <button className={`btn-secondary${mode === 'timer' ? ' active' : ''}`}
          onClick={() => { handleReset(); setMode('timer'); }} style={{ fontSize: 12, padding: '6px 14px' }}>타이머</button>
      </div>

      {mode === 'timer' && !running && time === 0 && (
        <div style={{ marginBottom: 10 }}>
          <label className="label">시간 (초)</label>
          <input className="input" type="number" value={timerInput} onChange={e => setTimerInput(e.target.value)} placeholder="60" />
        </div>
      )}

      <div style={{ textAlign: 'center', padding: 20 }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 56,
          color: running ? 'var(--accent)' : 'var(--text-primary)',
          letterSpacing: 4,
          lineHeight: 1,
          transition: 'color 0.2s',
        }}>
          {formatTime(time)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {!running ? (
          <button className="btn-primary" onClick={handleStart} style={{ flex: 1 }}>
            {time > 0 && mode === 'stopwatch' ? '이어하기' : '시작'}
          </button>
        ) : (
          <button className="btn-primary" onClick={handleStop} style={{ flex: 1, background: 'var(--danger)' }}>정지</button>
        )}
        {mode === 'stopwatch' && running && (
          <button className="btn-secondary active" onClick={handleLap} style={{ padding: '10px 16px' }}>랩</button>
        )}
        <button className="btn-secondary" onClick={handleReset} style={{ padding: '10px 16px' }}>초기화</button>
        {time > 0 && !running && (
          <button className="btn-secondary" onClick={handleSaveRecord} style={{ padding: '10px 16px' }}>저장</button>
        )}
      </div>

      {laps.length > 0 && (
        <div className="card">
          {laps.map((l, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < laps.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>랩 {laps.length - i}</span>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, color: 'var(--accent)', letterSpacing: 1 }}>{formatTime(l)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
