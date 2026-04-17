import { useState, useRef, useEffect, useCallback } from 'react';
import { useLangStore } from '../store/langStore';

const TEXT = {
  ko: {
    title: '휴식 타이머',
    custom: '직접 입력',
    sec: '초',
    start: '시작',
    pause: '일시정지',
    resume: '재개',
    reset: '리셋',
    finished: '휴식 완료!',
    placeholder: '초 입력',
  },
  en: {
    title: 'Rest Timer',
    custom: 'Custom',
    sec: 's',
    start: 'Start',
    pause: 'Pause',
    resume: 'Resume',
    reset: 'Reset',
    finished: 'Rest Over!',
    placeholder: 'Enter seconds',
  },
};

const PRESETS = [30, 60, 90, 120, 180];

export default function RestTimer() {
  const { lang } = useLangStore();
  const t = TEXT[lang] || TEXT.ko;

  const [duration, setDuration] = useState(60);
  const [timeLeft, setTimeLeft] = useState(null);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [flash, setFlash] = useState(false);

  const intervalRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Countdown logic
  useEffect(() => {
    if (running && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearTimer();
            setRunning(false);
            setFinished(true);
            // Vibrate
            if (navigator.vibrate) {
              navigator.vibrate([200, 100, 200, 100, 200]);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return clearTimer;
  }, [running, clearTimer]);

  // Flash effect when finished
  useEffect(() => {
    if (!finished) return;
    let count = 0;
    const flashInterval = setInterval(() => {
      setFlash((prev) => !prev);
      count++;
      if (count >= 8) {
        clearInterval(flashInterval);
        setFlash(false);
      }
    }, 250);
    return () => clearInterval(flashInterval);
  }, [finished]);

  const handleStart = () => {
    setFinished(false);
    setTimeLeft(duration);
    setRunning(true);
  };

  const handlePause = () => {
    clearTimer();
    setRunning(false);
  };

  const handleResume = () => {
    setRunning(true);
  };

  const handleReset = () => {
    clearTimer();
    setRunning(false);
    setTimeLeft(null);
    setFinished(false);
  };

  const handlePreset = (sec) => {
    setDuration(sec);
    setShowCustom(false);
    if (!running) {
      setTimeLeft(null);
      setFinished(false);
    }
  };

  const handleCustomConfirm = () => {
    const val = parseInt(customInput, 10);
    if (!isNaN(val) && val > 0 && val <= 600) {
      setDuration(val);
      setCustomInput('');
      setShowCustom(false);
      if (!running) {
        setTimeLeft(null);
        setFinished(false);
      }
    }
  };

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isIdle = timeLeft === null;
  const isPaused = !running && timeLeft !== null && timeLeft > 0;
  const displayTime = timeLeft !== null ? timeLeft : duration;

  // Progress ratio (1 = full, 0 = done)
  const progress = timeLeft !== null ? timeLeft / duration : 1;

  return (
    <div
      className="card"
      style={{
        padding: '12px 14px',
        marginBottom: 10,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: flash ? 'rgba(255, 107, 26, 0.15)' : undefined,
        transition: 'background-color 0.2s',
      }}
    >
      {/* Title */}
      <div
        style={{
          fontFamily: "'Barlow', sans-serif",
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 1.2,
          color: 'var(--text-muted)',
          marginBottom: 8,
        }}
      >
        {t.title}
      </div>

      {/* Presets */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {PRESETS.map((sec) => (
          <button
            key={sec}
            className={duration === sec && !showCustom ? 'btn-primary' : 'btn-secondary'}
            style={{
              padding: '4px 10px',
              fontSize: 13,
              fontFamily: "'Bebas Neue', sans-serif",
              letterSpacing: 1,
              minWidth: 0,
              borderRadius: 6,
            }}
            onClick={() => handlePreset(sec)}
          >
            {sec}{t.sec}
          </button>
        ))}
        <button
          className={showCustom ? 'btn-primary' : 'btn-secondary'}
          style={{
            padding: '4px 10px',
            fontSize: 12,
            fontFamily: "'Barlow', sans-serif",
            minWidth: 0,
            borderRadius: 6,
          }}
          onClick={() => setShowCustom(true)}
        >
          {t.custom}
        </button>
      </div>

      {/* Custom input */}
      {showCustom && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
          <input
            type="number"
            min="1"
            max="600"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCustomConfirm()}
            placeholder={t.placeholder}
            style={{
              flex: 1,
              padding: '5px 8px',
              fontSize: 14,
              fontFamily: "'Bebas Neue', sans-serif",
              letterSpacing: 1,
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              outline: 'none',
              maxWidth: 120,
            }}
          />
          <button
            className="btn-primary"
            style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6 }}
            onClick={handleCustomConfirm}
          >
            OK
          </button>
        </div>
      )}

      {/* Progress bar */}
      {!isIdle && (
        <div
          style={{
            width: '100%',
            height: 3,
            borderRadius: 2,
            background: 'var(--border)',
            marginBottom: 8,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress * 100}%`,
              height: '100%',
              background: finished ? '#ff4444' : '#ff6b1a',
              borderRadius: 2,
              transition: 'width 1s linear',
            }}
          />
        </div>
      )}

      {/* Timer display */}
      <div
        style={{
          textAlign: 'center',
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: finished ? 28 : 42,
          letterSpacing: 2,
          color: finished ? '#ff6b1a' : 'var(--text-primary)',
          lineHeight: 1,
          margin: '4px 0 8px',
          transition: 'color 0.3s',
        }}
      >
        {finished ? t.finished : formatTime(displayTime)}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {isIdle && (
          <button
            className="btn-primary"
            style={{
              padding: '6px 24px',
              fontSize: 14,
              fontFamily: "'Barlow', sans-serif",
              fontWeight: 600,
              borderRadius: 8,
            }}
            onClick={handleStart}
          >
            {t.start}
          </button>
        )}
        {running && (
          <button
            className="btn-secondary"
            style={{
              padding: '6px 20px',
              fontSize: 14,
              fontFamily: "'Barlow', sans-serif",
              fontWeight: 600,
              borderRadius: 8,
            }}
            onClick={handlePause}
          >
            {t.pause}
          </button>
        )}
        {isPaused && (
          <>
            <button
              className="btn-primary"
              style={{
                padding: '6px 20px',
                fontSize: 14,
                fontFamily: "'Barlow', sans-serif",
                fontWeight: 600,
                borderRadius: 8,
              }}
              onClick={handleResume}
            >
              {t.resume}
            </button>
          </>
        )}
        {!isIdle && (
          <button
            className="btn-secondary"
            style={{
              padding: '6px 20px',
              fontSize: 14,
              fontFamily: "'Barlow', sans-serif",
              fontWeight: 600,
              borderRadius: 8,
            }}
            onClick={handleReset}
          >
            {t.reset}
          </button>
        )}
        {finished && (
          <button
            className="btn-primary"
            style={{
              padding: '6px 20px',
              fontSize: 14,
              fontFamily: "'Barlow', sans-serif",
              fontWeight: 600,
              borderRadius: 8,
            }}
            onClick={handleStart}
          >
            {t.start}
          </button>
        )}
      </div>
    </div>
  );
}
