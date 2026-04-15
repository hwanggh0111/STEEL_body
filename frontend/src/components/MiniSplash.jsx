import { useState, useEffect } from 'react';

export default function MiniSplash({ onDone }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 50);
    const t2 = setTimeout(() => setPhase(2), 250);
    const t3 = setTimeout(() => onDone(), 450);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: '#0a0a0a',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'transform 0.2s ease-in, opacity 0.2s ease-in',
      transform: phase >= 2 ? 'translateY(-100vh)' : 'translateY(0)',
      opacity: phase >= 2 ? 0 : 1,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        transform: phase === 0 ? 'scale(1.5)' : 'scale(1)',
        opacity: phase === 0 ? 0 : 1,
        transition: 'all 0.2s ease-out',
      }}>
        <svg width="40" height="40" viewBox="0 0 60 60" fill="none" style={{ transform: 'scaleX(-1)' }}>
          <defs><linearGradient id="msL" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ffd700"/><stop offset="100%" stopColor="#ff6b1a"/></linearGradient></defs>
          <path d="M30 52 L28 40 Q24 32 26 26 Q28 20 32 16 L34 14 Q38 16 37 22 Q36 26 34 28 Q38 24 42 26 Q46 29 46 34 Q46 40 42 44 L38 48 Z" fill="url(#msL)"/>
          <rect x="29" y="10" width="8" height="6" rx="2" fill="url(#msL)"/>
        </svg>
        <div style={{
          fontFamily: "'Great Vibes', cursive",
          fontSize: 36,
          background: 'linear-gradient(135deg, #ffd700, #ff6b1a, #ffd700)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 0 10px rgba(255,107,26,0.4))',
        }}>
          Steel Body
        </div>
        <svg width="40" height="40" viewBox="0 0 60 60" fill="none">
          <defs><linearGradient id="msR" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ffd700"/><stop offset="100%" stopColor="#ff6b1a"/></linearGradient></defs>
          <path d="M30 52 L28 40 Q24 32 26 26 Q28 20 32 16 L34 14 Q38 16 37 22 Q36 26 34 28 Q38 24 42 26 Q46 29 46 34 Q46 40 42 44 L38 48 Z" fill="url(#msR)"/>
          <rect x="29" y="10" width="8" height="6" rx="2" fill="url(#msR)"/>
        </svg>
      </div>
    </div>
  );
}
