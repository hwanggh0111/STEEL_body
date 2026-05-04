import { useMemo } from 'react';

const LEGEND_QUOTES = [
  '"오늘도 전설은 운동한다."',
  '"왕좌는 비워두지 않는다."',
  '"무게가 무거운 게 아니라, 의지가 가벼운 거다."',
  '"쉬는 날도 전설은 전설이다."',
  '"1000일의 땀이 전설을 만든다."',
  '"포기란 전설의 사전에 없다."',
];

const IMMORTAL_QUOTES = [
  '"신들조차 경외하는 의지."',
  '"시간을 초월한 자, 멈추지 않는다."',
  '"불멸은 재능이 아니라 집념이다."',
  '"우주가 끝나도 운동은 끝나지 않는다."',
  '"인간의 한계? 그건 네가 정한 거다."',
  '"2000일의 맹세, 영원히 계속된다."',
  '"이 세계의 끝에서, 나는 여전히 들어올린다."',
];

export function LegendHome({ nickname, totalWorkouts }) {
  const quote = useMemo(() => LEGEND_QUOTES[Math.floor(Math.random() * LEGEND_QUOTES.length)], []);
  return (
    <div style={{
      marginBottom: 20, borderRadius: 'var(--radius)', overflow: 'hidden',
      border: '1px solid #ffd700',
      background: 'linear-gradient(135deg, #1a1000, #2a1800, #1a1000)',
      position: 'relative',
    }}>
      {/* 불꽃 배경 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(circle at 50% 80%, rgba(255,107,26,0.15) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      {/* 왕좌 + 칭호 */}
      <div style={{ padding: '20px 16px', textAlign: 'center', position: 'relative' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🏛️</div>
        <div style={{
          fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700,
          letterSpacing: 3,
          background: 'linear-gradient(135deg, #ffd700, #ff6b1a, #ffd700)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          marginBottom: 4,
        }}>𓆩 전설의 리프터 𓆪</div>
        <div style={{ fontSize: 13, color: '#ffd700', marginBottom: 12 }}>{nickname}</div>

        {/* 통계 - 황금 트로피 스타일 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#ffd700', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2,
              textShadow: '0 0 10px rgba(255,215,0,0.4)',
            }}>🏆 {totalWorkouts}</div>
            <div style={{ fontSize: 10, color: '#a08030' }}>총 운동</div>
          </div>
        </div>

        {/* 명언 */}
        <div style={{
          fontFamily: "'Playfair Display', serif", fontSize: 12, fontStyle: 'italic',
          color: '#c4a060', lineHeight: 1.6,
          borderTop: '1px solid rgba(255,215,0,0.2)', paddingTop: 12,
        }}>{quote}</div>
      </div>
    </div>
  );
}

export function ImmortalHome({ nickname, totalWorkouts }) {
  const quote = useMemo(() => IMMORTAL_QUOTES[Math.floor(Math.random() * IMMORTAL_QUOTES.length)], []);
  return (
    <div style={{
      marginBottom: 20, borderRadius: 'var(--radius)',
      border: '1px solid #8060ff',
      background: 'linear-gradient(135deg, #0a0020, #150030, #0a0020)',
      padding: '20px 16px', textAlign: 'center',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 8 }}>
        <span style={{ fontSize: 20, opacity: 0.6 }}>🏛️</span>
        <span style={{ fontSize: 44, filter: 'drop-shadow(0 0 12px rgba(100,50,255,0.6))' }}>🔱</span>
        <span style={{ fontSize: 20, opacity: 0.6 }}>🏛️</span>
      </div>
      <div style={{
        fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700,
        letterSpacing: 4, color: '#c0a0ff', marginBottom: 4,
      }}>𓆩 불멸의 리프터 𓆪</div>
      <div style={{ fontSize: 13, color: '#c0a0ff', marginBottom: 12 }}>{nickname}</div>
      <div style={{
        fontSize: 26, fontWeight: 700, fontFamily: "'Bebas Neue', sans-serif",
        color: '#c0a0ff', marginBottom: 12,
      }}>⚡ {totalWorkouts} <span style={{ fontSize: 10, color: '#6a5aaa' }}>총 운동</span></div>
      <div style={{
        fontFamily: "'Playfair Display', serif", fontSize: 12, fontStyle: 'italic',
        color: '#9080cc', borderTop: '1px solid rgba(100,50,255,0.2)', paddingTop: 12,
      }}>{quote}</div>
    </div>
  );
}
