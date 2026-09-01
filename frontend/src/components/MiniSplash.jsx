import { useState, useEffect } from 'react';
import Logo from './Logo';

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
      background: 'var(--bg-primary)',
      backgroundImage: 'var(--bg-glow)',
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
        {/* 여기만 필기체(Great Vibes)에 날개 그림이었다. 앱의 로고로 맞춘다 */}
        {/* 홈으로 돌아올 때 잠깐 뜨는 것. 큰 스플래시(48)보다는 작게, 머리(18)보다는 크게 */}
        <Logo cap={28} style={{ filter: 'drop-shadow(0 0 10px rgba(238,183,125,0.35))' }} />
      </div>
    </div>
  );
}
