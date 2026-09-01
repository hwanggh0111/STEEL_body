import { useState, useEffect } from 'react';
import Logo from './Logo';

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState(0);
  // phase 0: 어두운 배경
  // phase 1: 로고 크게 등장
  // phase 2: 로고 줄어들며 위로
  // phase 3: 슬라이드 업 + 홈 진입

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 200);
    const t2 = setTimeout(() => setPhase(2), 1600);
    const t3 = setTimeout(() => setPhase(3), 2400);
    const t4 = setTimeout(() => onDone(), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onDone]);

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'var(--bg-primary)',
      backgroundImage: 'var(--bg-glow)',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.8s ease',
      transform: phase >= 3 ? 'translateY(-100vh)' : 'translateY(0)',
      opacity: phase >= 3 ? 0 : 1,
    }}>
      {/* 양쪽 팔 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: phase >= 2 ? 10 : 20,
        transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: phase === 0 ? 'scale(0.3)' : phase === 1 ? 'scale(1.2)' : 'scale(0.7)',
        opacity: phase === 0 ? 0 : 1,
      }}>
        {/* 덤벨 로고 */}
        <svg
          width={phase >= 2 ? 50 : 80}
          height={phase >= 2 ? 50 : 80}
          viewBox="0 0 60 60"
          fill="none"
          style={{
            transform: phase === 0 ? 'scale(0.3) rotate(-20deg)' : phase === 1 ? 'scale(1) rotate(0deg)' : 'scale(0.8) rotate(0deg)',
            transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            opacity: phase === 0 ? 0 : 1,
          }}
        >
          <defs><linearGradient id="splDb" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f7c499"/><stop offset="100%" stopColor="#d29a5f"/></linearGradient></defs>
          <rect x="12" y="27" width="36" height="6" rx="3" fill="url(#splDb)"/>
          <rect x="6" y="18" width="8" height="24" rx="3" fill="url(#splDb)"/>
          <rect x="1" y="22" width="7" height="16" rx="2.5" fill="url(#splDb)" opacity="0.7"/>
          <rect x="46" y="18" width="8" height="24" rx="3" fill="url(#splDb)"/>
          <rect x="52" y="22" width="7" height="16" rx="2.5" fill="url(#splDb)" opacity="0.7"/>
          <rect x="14" y="28" width="32" height="2" rx="1" fill="#fff" opacity="0.15"/>
        </svg>

        {/* 로고 — 스플래시에서만 다 편다 (마크 · 금선 · 글자 · 금선 · 부제) */}
        <div style={{ textAlign: 'center' }}>
          {/* 메인으로 넘어가기 전 화면이다. 이 앱을 켤 때마다 보는 **유일하게 큰 로고**라
              조금 크게 둔다 — 40 은 폰에서 생각보다 작게 앉는다 (9/1 에 48 로 키웠다).
              넘어가는 동안(phase 2)에는 줄여서 화면이 비는 느낌을 없앤다 */}
          <Logo
            cap={phase >= 2 ? 32 : 48}
            variant="stack"
            subtitle=""
            style={{
              filter: `drop-shadow(0 0 ${phase === 1 ? '20' : '8'}px rgba(238,183,125,${phase === 1 ? '0.6' : '0.3'}))`,
              transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
          {/* 표어. **전부 대문자에 자간 3** 이었다 — 로고를 소문자 세리프로 바꾼 뒤에는
              여기만 표지판처럼 남는다. 로고와 같은 결(세리프 이탤릭 · 소문자)로 맞춘다 */}
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontStyle: 'italic',
            fontSize: phase >= 2 ? 11 : 15,
            letterSpacing: 0.2,
            color: 'var(--text-muted)',
            marginTop: 10,
            opacity: phase >= 1 ? 1 : 0,
            transition: 'all 0.6s ease 0.3s',
          }}>
            Forge your body · Break your limits
          </div>
        </div>
      </div>

      {/* 금빛 글로우 — 8/28 에 오렌지에서 바꿨는데 이 주석만 옛말로 남아 있었다 */}
      <div style={{
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(238,183,125,0.15) 0%, transparent 70%)',
        opacity: phase === 1 ? 1 : 0,
        transition: 'opacity 1s ease',
        pointerEvents: 'none',
      }} />
    </div>
  );
}
