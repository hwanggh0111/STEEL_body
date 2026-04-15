import { useState, useRef, useEffect, useCallback } from 'react';
import { useLangStore } from '../store/langStore';

const TEXT = {
  ko: {
    title: 'TAP GAME',
    start: '시작',
    tap: 'TAP!',
    taps: '탭',
    timeLeft: '남은 시간',
    result: '결과',
    totalTaps: '총 탭 횟수',
    tps: '초당 탭 수',
    grade: '등급',
    bestRecord: '최고 기록',
    retry: '다시하기',
    ready: '준비되셨나요?',
    grades: {
      warmup: '워밍업',
      notBad: '괜찮은데?',
      fast: '빠른 손',
      crazy: '미친 속도',
      beyond: '인간 초월',
    },
  },
  en: {
    title: 'TAP GAME',
    start: 'START',
    tap: 'TAP!',
    taps: 'taps',
    timeLeft: 'Time Left',
    result: 'Result',
    totalTaps: 'Total Taps',
    tps: 'Taps/sec',
    grade: 'Grade',
    bestRecord: 'Best Record',
    retry: 'Retry',
    ready: 'Ready?',
    grades: {
      warmup: 'Warm-up',
      notBad: 'Not Bad',
      fast: 'Fast Hands',
      crazy: 'Crazy Speed',
      beyond: 'Beyond Human',
    },
  },
};

const DURATION = 10;

function getGrade(taps, t) {
  if (taps >= 91) return { label: t.grades.beyond, color: '#ff2d55' };
  if (taps >= 71) return { label: t.grades.crazy, color: '#af52de' };
  if (taps >= 51) return { label: t.grades.fast, color: '#ff6b1a' };
  if (taps >= 31) return { label: t.grades.notBad, color: '#34c759' };
  return { label: t.grades.warmup, color: 'var(--text-muted)' };
}

export default function MiniTapGame() {
  const { lang } = useLangStore();
  const t = TEXT[lang] || TEXT.ko;

  const [phase, setPhase] = useState('idle'); // idle | playing | done
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [taps, setTaps] = useState(0);
  const [scaled, setScaled] = useState(false);
  const [best, setBest] = useState(() => {
    try {
      return Number(localStorage.getItem('steelbody_tap_record')) || 0;
    } catch {
      return 0;
    }
  });

  const intervalRef = useRef(null);
  const tapsRef = useRef(0);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const handleStart = useCallback(() => {
    setPhase('playing');
    setTaps(0);
    tapsRef.current = 0;
    setTimeLeft(DURATION);

    cleanup();
    const start = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const remaining = Math.max(0, DURATION - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        cleanup();
        setPhase('done');
        const finalTaps = tapsRef.current;
        setBest((prev) => {
          const newBest = Math.max(prev, finalTaps);
          try {
            localStorage.setItem('steelbody_tap_record', String(newBest));
          } catch { /* ignore */ }
          return newBest;
        });
      }
    }, 50);
  }, [cleanup]);

  const handleTap = useCallback(() => {
    if (phase !== 'playing') return;
    tapsRef.current += 1;
    setTaps(tapsRef.current);
    setScaled(true);
    setTimeout(() => setScaled(false), 80);
  }, [phase]);

  const handleRetry = useCallback(() => {
    cleanup();
    setPhase('idle');
    setTaps(0);
    tapsRef.current = 0;
    setTimeLeft(DURATION);
  }, [cleanup]);

  const tps = phase === 'done' ? (taps / DURATION).toFixed(1) : '—';
  const grade = phase === 'done' ? getGrade(taps, t) : null;
  const progress = timeLeft / DURATION;

  return (
    <div className="card" style={{ padding: '16px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 20,
          color: '#ff6b1a', letterSpacing: 1,
        }}>
          🎯 {t.title}
        </span>
        {best > 0 && (
          <span style={{
            fontFamily: "'Barlow', sans-serif", fontSize: 12,
            color: 'var(--text-muted)',
          }}>
            {t.bestRecord}: <strong style={{ color: '#ff6b1a' }}>{best}</strong>
          </span>
        )}
      </div>

      {/* Idle */}
      {phase === 'idle' && (
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <p style={{
            fontFamily: "'Barlow', sans-serif", fontSize: 14,
            color: 'var(--text-secondary)', marginBottom: 16,
          }}>
            {t.ready}
          </p>
          <button
            onClick={handleStart}
            style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 24,
              background: '#ff6b1a', color: '#fff', border: 'none',
              borderRadius: 12, padding: '12px 48px', cursor: 'pointer',
              letterSpacing: 2,
            }}
          >
            {t.start}
          </button>
        </div>
      )}

      {/* Playing */}
      {phase === 'playing' && (
        <div style={{ textAlign: 'center' }}>
          {/* Timer bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 8,
          }}>
            <span style={{
              fontFamily: "'Barlow', sans-serif", fontSize: 12,
              color: 'var(--text-muted)',
            }}>
              {t.timeLeft}
            </span>
            <span style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 20,
              color: timeLeft <= 3 ? 'var(--danger)' : '#ff6b1a',
            }}>
              {timeLeft.toFixed(1)}s
            </span>
          </div>
          <div style={{
            width: '100%', height: 6, borderRadius: 3,
            background: 'var(--bg-tertiary)', marginBottom: 16, overflow: 'hidden',
          }}>
            <div style={{
              width: `${progress * 100}%`, height: '100%', borderRadius: 3,
              background: timeLeft <= 3 ? 'var(--danger)' : '#ff6b1a',
              transition: 'width 0.05s linear',
            }} />
          </div>

          {/* Tap count */}
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 36,
            color: 'var(--text-secondary)', marginBottom: 8,
          }}>
            {taps}
          </div>

          {/* Tap button */}
          <button
            onClick={handleTap}
            onTouchStart={(e) => { e.preventDefault(); handleTap(); }}
            style={{
              width: 120, height: 120, borderRadius: '50%',
              background: '#ff6b1a', border: 'none', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 28,
              color: '#fff', letterSpacing: 2, userSelect: 'none',
              transform: scaled ? 'scale(0.88)' : 'scale(1)',
              transition: 'transform 0.08s ease',
              boxShadow: '0 4px 20px rgba(255,107,26,0.4)',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {t.tap}
          </button>
        </div>
      )}

      {/* Done */}
      {phase === 'done' && (
        <div style={{ textAlign: 'center' }}>
          {/* Grade */}
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 28,
            color: grade.color, marginBottom: 4, letterSpacing: 1,
          }}>
            {grade.label}
          </div>

          {/* Stats */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 24,
            marginBottom: 16, marginTop: 12,
          }}>
            <div>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: '#ff6b1a',
              }}>
                {taps}
              </div>
              <div style={{
                fontFamily: "'Barlow', sans-serif", fontSize: 11,
                color: 'var(--text-muted)', textTransform: 'uppercase',
              }}>
                {t.totalTaps}
              </div>
            </div>
            <div>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: '#ff6b1a',
              }}>
                {tps}
              </div>
              <div style={{
                fontFamily: "'Barlow', sans-serif", fontSize: 11,
                color: 'var(--text-muted)', textTransform: 'uppercase',
              }}>
                {t.tps}
              </div>
            </div>
          </div>

          {taps >= best && taps > 0 && (
            <div style={{
              fontFamily: "'Barlow', sans-serif", fontSize: 13,
              color: 'var(--success)', marginBottom: 12, fontWeight: 600,
            }}>
              🏆 {lang === 'ko' ? '새로운 최고 기록!' : 'New Best Record!'}
            </div>
          )}

          <button
            onClick={handleRetry}
            style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 20,
              background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
              border: '1px solid var(--border)', borderRadius: 12,
              padding: '10px 40px', cursor: 'pointer', letterSpacing: 1,
            }}
          >
            {t.retry}
          </button>
        </div>
      )}
    </div>
  );
}
