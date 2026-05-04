import { useState, useEffect, useRef } from 'react';
import { toast } from '../Toast';

export default function StopwatchSection({ onSave }) {
  const [mode, setMode] = useState('stopwatch');
  const [running, setRunning] = useState(false);
  const [time, setTime] = useState(0);
  const [laps, setLaps] = useState([]);
  const [timerInput, setTimerInput] = useState('60');
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTime(prev => {
          if (mode === 'timer') {
            if (prev <= 0) {
              setRunning(false);
              toast('타이머 종료!');
              return 0;
            }
            return prev - 100;
          }
          return prev + 100;
        });
      }, 100);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, mode]);

  const formatTime = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    const dec = Math.floor((ms % 1000) / 100);
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${dec}`;
  };

  const handleStart = () => {
    if (mode === 'timer' && !running && time === 0) {
      setTime(Number(timerInput) * 1000);
    }
    setRunning(true);
  };

  const handleStop = () => setRunning(false);

  const handleReset = () => {
    setRunning(false);
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
