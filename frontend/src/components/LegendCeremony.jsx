import { useState, useEffect } from 'react';

export default function LegendCeremony({ onDone }) {
  const [phase, setPhase] = useState(0);
  // 0: 암전
  // 1: 근육의 신 등장
  // 2: 대사 1
  // 3: 대사 2
  // 4: 칭호 수여
  // 5: 골드 폭발 + 뱃지
  // 6: 페이드아웃

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 800),
      setTimeout(() => setPhase(2), 2500),
      setTimeout(() => setPhase(3), 5000),
      setTimeout(() => setPhase(4), 7500),
      setTimeout(() => setPhase(5), 10000),
      setTimeout(() => setPhase(6), 13000),
      setTimeout(() => onDone(), 14500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: '#000', zIndex: 999999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column',
      opacity: phase === 6 ? 0 : 1,
      transition: 'opacity 1.5s ease',
    }}>
      {/* 닫기 버튼 */}
      <button
        onClick={onDone}
        style={{
          position: 'absolute', top: 20, right: 20, zIndex: 10,
          background: 'none', border: 'none', color: '#555',
          fontSize: 22, cursor: 'pointer', padding: 8,
          transition: 'color 0.2s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = '#ffd700'}
        onMouseLeave={(e) => e.currentTarget.style.color = '#555'}
      >✕</button>

      {/* 배경 광선 */}
      {phase >= 4 && (
        <div style={{
          position: 'absolute', width: '100%', height: '100%',
          background: 'radial-gradient(circle at 50% 40%, rgba(255,215,0,0.15) 0%, transparent 60%)',
          animation: 'legendPulse 2s ease infinite',
        }} />
      )}

      {/* 근육의 신 */}
      {phase >= 1 && (
        <div style={{
          fontSize: phase >= 4 ? 80 : 120,
          opacity: phase >= 1 ? 1 : 0,
          transform: phase === 1 ? 'scale(0.3)' : phase >= 4 ? 'scale(0.8) translateY(-20px)' : 'scale(1)',
          transition: 'all 1s cubic-bezier(0.4, 0, 0.2, 1)',
          filter: phase >= 4 ? 'drop-shadow(0 0 30px rgba(255,215,0,0.6))' : 'drop-shadow(0 0 15px rgba(255,215,0,0.3))',
          marginBottom: 16,
        }}>
          🏛️
        </div>
      )}

      {/* 대사 1 */}
      {phase >= 2 && phase < 4 && (
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 18, fontWeight: 700, fontStyle: 'italic',
          color: '#ffd700',
          textAlign: 'center',
          opacity: phase >= 2 ? 1 : 0,
          transform: phase >= 2 ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.8s ease',
          padding: '0 20px',
          lineHeight: 1.8,
          textShadow: '0 0 20px rgba(255,215,0,0.3)',
        }}>
          {phase === 2 && '"나는 근육의 신이다.\n모든 고통을 이겨낸 자여..."'}
          {phase === 3 && '"1000일의 땀과 노력,\n그 끝에 서 있는 너에게\n이 칭호를 내린다."'}
        </div>
      )}

      {/* 칭호 수여 */}
      {phase >= 4 && (
        <div style={{
          textAlign: 'center',
          opacity: phase >= 4 ? 1 : 0,
          transform: phase >= 4 ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.5)',
          transition: 'all 1s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          <div style={{
            fontSize: 12, color: '#888', letterSpacing: 4,
            fontFamily: "'Barlow', sans-serif", textTransform: 'uppercase',
            marginBottom: 12,
          }}>근육의 신이 칭호를 내립니다</div>

          {/* 날개 + 아이콘 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <svg width={phase >= 5 ? 120 : 0} height="80" viewBox="0 0 120 80" fill="none" style={{
              transform: 'scaleX(-1)',
              transition: 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
              filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.4))',
              overflow: 'visible',
            }}>
              <path d="M110 40 Q100 10 70 5 Q45 2 25 15 Q10 25 2 40 Q15 28 30 20 Q50 10 70 12 Q90 16 105 30 Z" fill="#ffd700" opacity="0.8">
                <animate attributeName="opacity" values="0.6;0.9;0.6" dur="2s" repeatCount="indefinite"/>
              </path>
              <path d="M110 40 Q95 18 60 15 Q35 14 15 28 Q25 22 40 18 Q60 14 80 20 Q100 28 110 40 Z" fill="#ffe44d" opacity="0.5"/>
              <path d="M110 40 Q100 28 75 25 Q55 24 35 32 Q55 28 72 28 Q95 30 110 40 Z" fill="#fff5cc" opacity="0.3"/>
            </svg>
            <div style={{ fontSize: 52, zIndex: 1, filter: 'drop-shadow(0 0 15px rgba(255,215,0,0.6))' }}>⚜️</div>
            <svg width={phase >= 5 ? 120 : 0} height="80" viewBox="0 0 120 80" fill="none" style={{
              transition: 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
              filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.4))',
              overflow: 'visible',
            }}>
              <path d="M10 40 Q20 10 50 5 Q75 2 95 15 Q110 25 118 40 Q105 28 90 20 Q70 10 50 12 Q30 16 15 30 Z" fill="#ffd700" opacity="0.8">
                <animate attributeName="opacity" values="0.6;0.9;0.6" dur="2s" repeatCount="indefinite"/>
              </path>
              <path d="M10 40 Q25 18 60 15 Q85 14 105 28 Q95 22 80 18 Q60 14 40 20 Q20 28 10 40 Z" fill="#ffe44d" opacity="0.5"/>
              <path d="M10 40 Q20 28 45 25 Q65 24 85 32 Q65 28 48 28 Q25 30 10 40 Z" fill="#fff5cc" opacity="0.3"/>
            </svg>
          </div>

          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 32, fontWeight: 700,
            letterSpacing: 6,
            background: 'linear-gradient(135deg, #ffd700, #ff6b1a, #ffd700, #fff5cc)',
            backgroundSize: '200% 200%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 15px rgba(255,215,0,0.5))',
            animation: phase >= 5 ? 'legendShimmer 2s ease infinite' : 'none',
            marginBottom: 8,
          }}>
            𓆩 전설의 리프터 𓆪
          </div>

          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 14, fontStyle: 'italic',
            color: '#ffd700', marginBottom: 20,
            textShadow: '0 0 10px rgba(255,215,0,0.3)',
          }}>
            LEGENDARY LIFTER
          </div>

          {phase >= 5 && (
            <>
              <div style={{
                fontSize: 13, color: '#aaa', lineHeight: 1.8,
                maxWidth: 300, margin: '0 auto 20px',
              }}>
                모든 뱃지를 달성하고,<br/>
                1000일의 여정을 걸어왔으며,<br/>
                한 해의 마지막 날까지 운동한<br/>
                <span style={{ color: '#ffd700', fontWeight: 700 }}>진정한 전설</span>이 되셨습니다.
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                <div style={{
                  background: 'rgba(255,215,0,0.1)', border: '1px solid #ffd700',
                  borderRadius: 'var(--radius)', padding: '8px 14px',
                  fontSize: 11, color: '#ffd700',
                }}>👑 골드 프로필 해금</div>
                <div style={{
                  background: 'rgba(255,215,0,0.1)', border: '1px solid #ffd700',
                  borderRadius: 'var(--radius)', padding: '8px 14px',
                  fontSize: 11, color: '#ffd700',
                }}>✨ 골드 테마 해금</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 금색 파티클 효과 */}
      {phase >= 5 && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          {Array.from({ length: 30 }, (_, i) => (
            <div key={i} style={{
              position: 'absolute',
              width: 4 + Math.random() * 6,
              height: 4 + Math.random() * 6,
              background: i % 3 === 0 ? '#ffd700' : i % 3 === 1 ? '#ff6b1a' : '#fff5cc',
              borderRadius: '50%',
              left: `${Math.random() * 100}%`,
              top: '-5%',
              opacity: 0.8,
              animation: `legendFall ${2 + Math.random() * 3}s ease-in ${Math.random() * 2}s infinite`,
            }} />
          ))}
        </div>
      )}

      <style>{`
        @keyframes legendPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes legendShimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes legendFall {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 0; }
          10% { opacity: 0.8; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
