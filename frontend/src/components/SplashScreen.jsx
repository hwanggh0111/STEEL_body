import { useState, useEffect } from 'react';
import Logo from './Logo';

// 로그인하고 **들어올 때** 보는 화면. 이 앱에서 로고가 가장 크게 서는 자리다.
//
// ── 2026-10-20 에 가운데로 맞췄다 ──
//
// 로고가 **둘**이었다 — 그라데이션 덤벨(60×60, 흰 하이라이트까지)과 로고 마크가
// **가로로 나란히** 서 있었다. 그래서 두 가지가 생겼다 —
//
//   · **글자와 표어가 화면 가운데가 아니었다.** 가운데에 선 것은 「덤벨 + 로고」
//     한 덩이이고, 글자와 표어는 그 덩이의 **오른쪽 절반 안에서** 가운데였다.
//     그래서 들어올 때마다 로고가 오른쪽으로 **조금 쏠려** 보였다
//   · **로고가 스스로 세운 규칙을 깨고 있었다.** `Logo.jsx` 머리글에 적어둔 말 —
//     「그라데이션도 그림자도 없다 · 화면에서 금속을 흉내 내면 대개 싸 보인다」.
//     덤벨은 금빛 그라데이션에 흰 줄 하이라이트까지 얹은 그림이었다.
//     게다가 **마크 자체가 이미 봉이 지나는 그림**이라 같은 말을 두 번 했다
//
// 그래서 덤벨을 걷고 **로고 한 벌을 세로로 한 번만** 세운다
// (마크 · 글자 · 싸인 획 · 표어). 가운데에 서는 것이 로고 자신이 된다.
//
// 연출(0.2s → 1.6s → 2.4s → 3.2s)과 커지고 줄어드는 결은 그대로 뒀다.
export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState(0);
  // phase 0: 어두운 배경
  // phase 1: 로고 크게 등장
  // phase 2: 로고 줄어들며 자리를 잡는다
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
      {/* 로고 한 벌 — **가운데에 서는 것이 이것 하나다.**
          커지고 줄어드는 것은 이 덩이째로 한다 (글자와 획이 같은 비율로 움직인다) */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        transform: phase === 0 ? 'scale(0.3)' : phase === 1 ? 'scale(1.2)' : 'scale(0.7)',
        opacity: phase === 0 ? 0 : 1,
        transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {/* ── 세로 잠금 그대로 ── (2026-11-10)
            주인이 고른 안이 **마크 · 이름 · 설명 줄 셋**이다. 그래서 `subtitle` 을
            로고에 맡기고 **영문 표어 줄을 뺐다** — 앞 판은 로고 밑에 따로 한 줄
            (`Forge your body · Break your limits`)을 두어 **설명 줄이 둘**이었다.
            시안에는 하나뿐이고, 둘을 두면 세로 잠금의 비례(3 : 1 : 0.5)가 무너진다.
            줄어들 때 설명 줄만 더 줄어야 하는 문제도 같이 사라졌다 — 로고가
            `cap` 하나로 셋을 같이 줄인다 */}
        <Logo
          cap={phase >= 2 ? 26 : 38}
          variant="stack"
          style={{
            filter: `drop-shadow(0 0 ${phase === 1 ? '20' : '8'}px rgba(238,183,125,${phase === 1 ? '0.6' : '0.3'}))`,
            transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>

      {/* 금빛 글로우 — 8/28 에 오렌지에서 바꿨는데 이 주석만 옛말로 남아 있었다.
          로고 한가운데에 둔다 — 가로로 둘이 섰을 때는 가운데가 로고가 아니었다 */}
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
