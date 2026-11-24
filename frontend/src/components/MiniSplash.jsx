import { useState, useEffect, useRef } from 'react';
import Logo from './Logo';
import { LAYER } from '../data/layers';

export default function MiniSplash({ onDone }) {
  const [phase, setPhase] = useState(0);

  // ── **시계를 거는 효과의 의존에 손을 두지 않는다** ── (2026-11-24 · 정석)
  //
  // 부르는 세 자리가 다 `onDone={() => { … }}` 로 **그릴 때마다 새 손**을 준다
  // (`Layout:766` · `TabBar:352,418`). 그것을 의존에 두면 주인이 한 번 다시 그릴
  // 때마다 정리가 시계 셋을 지우고 **처음부터 다시 건다** — 450ms 가 계속 밀리고,
  // 주인이 그보다 자주 다시 그려지면 `onDone` 이 **영영 안 돈다**(화면이 안 넘어간다).
  // 11/23 에 `useModalFocus` 가 같은 까닭으로 ref 로 바뀐 그 판단이다 — 그때는
  // 포커스가 튀는 꼴이었고 여기서는 **멈춘 화면**이 된다
  const 끝손 = useRef(onDone);
  끝손.current = onDone;

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 50);
    const t2 = setTimeout(() => setPhase(2), 250);
    const t3 = setTimeout(() => 끝손.current(), 450);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'var(--bg-primary)',
      backgroundImage: 'var(--bg-glow)',
      zIndex: LAYER.스플래시,
      display: 'flex',
      // 큰 스플래시와 **같은 손**이다 (2026-11-20 · `SplashScreen.jsx` 머리글).
      // 담을 것이 로고 한 줄이라 넘칠 일이 거의 없지만, **「거의 없다」를 까닭 목록에
      // 적어 빼주는 쪽은 안 한다** — 그렇게 빼준 큰 스플래시가 글자 200% 에서 넘쳤다.
      // 한 줄 붙이는 값이 적는 값보다 싸고, 자에 빼줄 자리가 **0** 으로 남는다
      overflow: 'auto',
      WebkitOverflowScrolling: 'touch',
      transition: 'transform 0.2s ease-in, opacity 0.2s ease-in',
      transform: phase >= 2 ? 'translateY(-100vh)' : 'translateY(0)',
      opacity: phase >= 2 ? 0 : 1,
    }}>
      <div style={{
        margin: 'auto',
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
