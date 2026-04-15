import { useState, useEffect } from 'react';

export default function ImmortalCeremony({ onDone }) {
  const [phase, setPhase] = useState(0);
  // 0: 암전
  // 1: 번개 연타
  // 2: 삼지창 낙하 시작
  // 3: 삼지창 착지 + 충격파
  // 4: 대사 1
  // 5: 대사 2
  // 6: 대사 3
  // 7: 칭호 + 날개 펼침
  // 8: 파티클 폭발
  // 9: 페이드아웃

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 600),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 3200),
      setTimeout(() => setPhase(4), 4500),
      setTimeout(() => setPhase(5), 7000),
      setTimeout(() => setPhase(6), 9500),
      setTimeout(() => setPhase(7), 12500),
      setTimeout(() => setPhase(8), 15500),
      setTimeout(() => setPhase(9), 19000),
      setTimeout(() => onDone(), 21000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: '#000', zIndex: 999999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column',
      opacity: phase === 9 ? 0 : 1,
      transition: 'opacity 2s ease',
    }}>
      {/* 닫기 */}
      <button
        onClick={onDone}
        style={{
          position: 'absolute', top: 20, right: 20, zIndex: 10,
          background: 'none', border: 'none', color: '#444',
          fontSize: 22, cursor: 'pointer',
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = '#e0e0ff'}
        onMouseLeave={(e) => e.currentTarget.style.color = '#444'}
      >✕</button>

      {/* 번개 연타 */}
      {phase >= 1 && phase < 4 && (
        <>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'white', opacity: 0,
            animation: 'immortalFlash 0.15s ease 0s 6',
            pointerEvents: 'none',
          }} />
          {/* 번개 SVG */}
          <svg width="100" height="300" viewBox="0 0 100 300" style={{
            position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
            opacity: phase >= 1 ? 1 : 0,
            animation: 'immortalFlash 0.3s ease 0s 4',
          }}>
            <path d="M55 0 L40 110 L60 110 L30 200 L55 200 L20 300 L70 180 L45 180 L75 80 L50 80 Z"
              fill="none" stroke="#c0a0ff" strokeWidth="3" opacity="0.8"/>
            <path d="M55 0 L40 110 L60 110 L30 200 L55 200 L20 300 L70 180 L45 180 L75 80 L50 80 Z"
              fill="#8060ff" opacity="0.3"/>
          </svg>
        </>
      )}

      {/* 삼지창 낙하 */}
      {phase >= 2 && phase < 7 && (
        <div style={{
          position: 'absolute',
          top: phase >= 3 ? '40%' : '-10%',
          left: '50%',
          transform: `translateX(-50%) ${phase >= 3 ? 'scale(1)' : 'scale(1.5)'}`,
          transition: phase === 2 ? 'all 1s cubic-bezier(0.9, 0, 1, 1)' : 'all 0.5s ease',
          fontSize: phase >= 3 ? 60 : 80,
          filter: `drop-shadow(0 0 ${phase >= 3 ? '30' : '10'}px rgba(100,50,255,0.8))`,
          zIndex: 5,
        }}>
          🔱
        </div>
      )}

      {/* 착지 충격파 */}
      {phase === 3 && (
        <>
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 0, height: 0,
            borderRadius: '50%',
            border: '3px solid rgba(100,50,255,0.6)',
            animation: 'shockwave 1s ease-out forwards',
          }} />
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 0, height: 0,
            borderRadius: '50%',
            border: '2px solid rgba(192,160,255,0.4)',
            animation: 'shockwave 1s ease-out 0.2s forwards',
          }} />
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'white', opacity: 0,
            animation: 'impactFlash 0.4s ease forwards',
            pointerEvents: 'none',
          }} />
        </>
      )}

      {/* 배경 광선 (착지 후) */}
      {phase >= 3 && (
        <div style={{
          position: 'absolute', width: '100%', height: '100%',
          background: 'radial-gradient(circle at 50% 45%, rgba(100,50,255,0.2) 0%, rgba(0,100,255,0.05) 40%, transparent 70%)',
          animation: 'immortalPulse 3s ease infinite',
        }} />
      )}

      {/* 대사 */}
      {phase >= 4 && phase < 7 && (
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 18, fontWeight: 700, fontStyle: 'italic',
          color: '#c0a0ff',
          textAlign: 'center', padding: '0 20px',
          lineHeight: 2, maxWidth: 400,
          textShadow: '0 0 20px rgba(100,50,255,0.4)',
          opacity: 1, transition: 'all 0.8s ease',
          marginTop: 80,
        }}>
          {phase === 4 && '"전설을 넘어선 자여.\n신들의 삼지창이 하늘을 가르며 내려왔다."'}
          {phase === 5 && '"2000일의 세월,\n1000번의 땀,\n365일의 맹세를 지킨 자.\n너는 이미 인간이 아니다."'}
          {phase === 6 && '"시간을 초월한 의지에\n신들은 경의를 표한다.\n이 칭호를 받아라."'}
        </div>
      )}

      {/* 칭호 + 날개 */}
      {phase >= 7 && (
        <div style={{
          textAlign: 'center',
          opacity: 1,
          transform: 'translateY(0) scale(1)',
          transition: 'all 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          <div style={{
            fontSize: 10, color: '#6a6aaa', letterSpacing: 5,
            fontFamily: "'Barlow', sans-serif", textTransform: 'uppercase',
            marginBottom: 16,
          }}>the gods bestow upon you</div>

          {/* 날개 + 아이콘 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <svg width={phase >= 8 ? 130 : 0} height="90" viewBox="0 0 130 90" fill="none" style={{
              transform: 'scaleX(-1)',
              transition: 'width 2s cubic-bezier(0.4, 0, 0.2, 1)',
              filter: 'drop-shadow(0 0 12px rgba(100,50,255,0.5))',
              overflow: 'visible',
            }}>
              <path d="M120 45 Q108 8 75 3 Q45 0 20 18 Q5 30 0 45 Q12 30 28 20 Q50 8 75 12 Q100 18 115 35 Z" fill="#8060ff" opacity="0.85">
                <animate attributeName="opacity" values="0.6;0.95;0.6" dur="2.5s" repeatCount="indefinite"/>
              </path>
              <path d="M120 45 Q105 20 65 16 Q35 14 12 30 Q25 23 42 18 Q65 13 88 22 Q108 32 120 45 Z" fill="#c0a0ff" opacity="0.5"/>
              <path d="M120 45 Q110 32 80 28 Q58 26 35 36 Q58 30 78 30 Q105 34 120 45 Z" fill="#e0d0ff" opacity="0.3"/>
              <path d="M120 45 Q115 38 90 35 Q70 33 50 40 Q70 36 88 36 Q110 38 120 45 Z" fill="#fff" opacity="0.15"/>
            </svg>
            <div style={{
              fontSize: 64, zIndex: 1,
              filter: 'drop-shadow(0 0 20px rgba(100,50,255,0.8))',
              animation: phase >= 8 ? 'immortalFloat 3s ease infinite' : 'none',
            }}>🔱</div>
            <svg width={phase >= 8 ? 130 : 0} height="90" viewBox="0 0 130 90" fill="none" style={{
              transition: 'width 2s cubic-bezier(0.4, 0, 0.2, 1)',
              filter: 'drop-shadow(0 0 12px rgba(100,50,255,0.5))',
              overflow: 'visible',
            }}>
              <path d="M10 45 Q22 8 55 3 Q85 0 110 18 Q125 30 130 45 Q118 30 102 20 Q80 8 55 12 Q30 18 15 35 Z" fill="#8060ff" opacity="0.85">
                <animate attributeName="opacity" values="0.6;0.95;0.6" dur="2.5s" repeatCount="indefinite"/>
              </path>
              <path d="M10 45 Q25 20 65 16 Q95 14 118 30 Q105 23 88 18 Q65 13 42 22 Q22 32 10 45 Z" fill="#c0a0ff" opacity="0.5"/>
              <path d="M10 45 Q20 32 50 28 Q72 26 95 36 Q72 30 52 30 Q25 34 10 45 Z" fill="#e0d0ff" opacity="0.3"/>
              <path d="M10 45 Q15 38 40 35 Q60 33 80 40 Q60 36 42 36 Q20 38 10 45 Z" fill="#fff" opacity="0.15"/>
            </svg>
          </div>

          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 36, fontWeight: 700,
            letterSpacing: 8,
            background: 'linear-gradient(135deg, #8060ff, #c0a0ff, #ffffff, #c0a0ff, #6040cc)',
            backgroundSize: '300% 300%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 20px rgba(100,50,255,0.6))',
            animation: phase >= 8 ? 'immortalShimmer 3s ease infinite' : 'none',
            marginBottom: 6,
          }}>
            𓆩 불멸의 리프터 𓆪
          </div>

          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 14, fontStyle: 'italic',
            color: '#8080cc',
            textShadow: '0 0 10px rgba(100,50,255,0.3)',
            marginBottom: 24,
            letterSpacing: 3,
          }}>
            IMMORTAL LIFTER
          </div>

          {phase >= 8 && (
            <>
              <div style={{
                fontSize: 13, color: '#9090bb', lineHeight: 1.8,
                maxWidth: 320, margin: '0 auto 20px',
              }}>
                전설을 넘어, 시간을 초월하고,<br/>
                모든 한계를 부순 자.<br/>
                당신은 이제 <span style={{
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #8060ff, #c0a0ff)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>불멸</span>입니다.
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{
                  background: 'rgba(100,50,255,0.1)', border: '1px solid rgba(100,50,255,0.5)',
                  borderRadius: 'var(--radius)', padding: '8px 14px',
                  fontSize: 11, color: '#c0a0ff',
                }}>👑 전설 칭호 진화</div>
                <div style={{
                  background: 'rgba(100,50,255,0.1)', border: '1px solid rgba(100,50,255,0.5)',
                  borderRadius: 'var(--radius)', padding: '8px 14px',
                  fontSize: 11, color: '#c0a0ff',
                }}>🔱 불멸 프로필</div>
                <div style={{
                  background: 'rgba(100,50,255,0.1)', border: '1px solid rgba(100,50,255,0.5)',
                  borderRadius: 'var(--radius)', padding: '8px 14px',
                  fontSize: 11, color: '#c0a0ff',
                }}>⚡ 전용 테마 해금</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 파티클 */}
      {phase >= 8 && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          {Array.from({ length: 40 }, (_, i) => (
            <div key={i} style={{
              position: 'absolute',
              width: 3 + Math.random() * 5,
              height: 3 + Math.random() * 5,
              background: i % 4 === 0 ? '#8060ff' : i % 4 === 1 ? '#c0a0ff' : i % 4 === 2 ? '#ffffff' : '#4040cc',
              borderRadius: '50%',
              left: `${Math.random() * 100}%`,
              top: '-5%',
              opacity: 0.7,
              animation: `immortalFall ${2 + Math.random() * 4}s ease-in ${Math.random() * 2}s infinite`,
            }} />
          ))}
        </div>
      )}

      <style>{`
        @keyframes immortalFlash {
          0%, 100% { opacity: 0; }
          50% { opacity: 0.4; }
        }
        @keyframes shockwave {
          0% { width: 0; height: 0; opacity: 1; }
          100% { width: 600px; height: 600px; opacity: 0; }
        }
        @keyframes impactFlash {
          0% { opacity: 0; }
          20% { opacity: 0.6; }
          100% { opacity: 0; }
        }
        @keyframes immortalPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes immortalShimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes immortalFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes immortalFall {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 0; }
          10% { opacity: 0.7; }
          100% { transform: translateY(110vh) rotate(540deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
