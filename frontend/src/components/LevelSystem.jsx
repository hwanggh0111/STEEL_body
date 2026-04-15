import { useState } from 'react';
import { useLangStore } from '../store/langStore';
import { isAdmin } from '../data/admin';

const LEVEL_TABLE = [
  // 1~10: 입문기
  { level: 1,  exp: 0,      title: { ko: '입문자', en: 'Beginner' },             icon: '🌱', color: '#888' },
  { level: 2,  exp: 50,     title: { ko: '초보 헬린이', en: 'Newbie' },           icon: '🐣', color: '#888' },
  { level: 3,  exp: 120,    title: { ko: '운동 습관 형성', en: 'Habit Builder' },  icon: '🔥', color: '#aaa' },
  { level: 4,  exp: 200,    title: { ko: '꾸준한 트레이니', en: 'Steady Trainee' },icon: '💪', color: '#aaa' },
  { level: 5,  exp: 300,    title: { ko: '워밍업 완료', en: 'Warmed Up' },        icon: '🏃', color: '#aaa' },
  { level: 6,  exp: 420,    title: { ko: '루틴 정착', en: 'Routine Set' },        icon: '📋', color: '#e8a020' },
  { level: 7,  exp: 560,    title: { ko: '초급 리프터', en: 'Novice Lifter' },    icon: '🏋️', color: '#e8a020' },
  { level: 8,  exp: 720,    title: { ko: '근성 트레이니', en: 'Gritty Trainee' }, icon: '🔥', color: '#e8a020' },
  { level: 9,  exp: 900,    title: { ko: '체력 기반 완성', en: 'Base Built' },    icon: '🧱', color: '#e8a020' },
  { level: 10, exp: 1100,   title: { ko: '10레벨 돌파', en: 'Lv.10 Breaker' },   icon: '🎯', color: '#e8a020' },
  // 11~20: 중급기
  { level: 11, exp: 1320,   title: { ko: '중급 리프터', en: 'Mid Lifter' },       icon: '💪', color: '#ff6b1a' },
  { level: 12, exp: 1560,   title: { ko: '헬스 매니아', en: 'Gym Maniac' },       icon: '⚡', color: '#ff6b1a' },
  { level: 13, exp: 1820,   title: { ko: '근육 사냥꾼', en: 'Muscle Hunter' },    icon: '🏹', color: '#ff6b1a' },
  { level: 14, exp: 2100,   title: { ko: '철의 의지', en: 'Iron Will' },          icon: '🔩', color: '#ff6b1a' },
  { level: 15, exp: 2400,   title: { ko: '중량 정복자', en: 'Weight Conqueror' }, icon: '⚔️', color: '#ff6b1a' },
  { level: 16, exp: 2720,   title: { ko: '짐 전사', en: 'Gym Warrior' },         icon: '🛡️', color: '#ff6b1a' },
  { level: 17, exp: 3060,   title: { ko: '파워 리프터', en: 'Power Lifter' },     icon: '🏋️', color: '#ff6b1a' },
  { level: 18, exp: 3420,   title: { ko: '근육 장인', en: 'Muscle Artisan' },     icon: '🔨', color: '#ff6b1a' },
  { level: 19, exp: 3800,   title: { ko: '강철 의지', en: 'Steel Will' },         icon: '⚙️', color: '#ff6b1a' },
  { level: 20, exp: 4200,   title: { ko: '20레벨 돌파', en: 'Lv.20 Breaker' },   icon: '🎯', color: '#ff6b1a' },
  // 21~30: 상급기
  { level: 21, exp: 4650,   title: { ko: '상급 리프터', en: 'Advanced Lifter' },  icon: '💎', color: '#4a9aff' },
  { level: 22, exp: 5120,   title: { ko: '근육 조각가', en: 'Body Sculptor' },    icon: '🗿', color: '#4a9aff' },
  { level: 23, exp: 5610,   title: { ko: '철인 트레이니', en: 'Iron Trainee' },   icon: '🦾', color: '#4a9aff' },
  { level: 24, exp: 6120,   title: { ko: '데드리프트 킹', en: 'Deadlift King' },  icon: '👊', color: '#4a9aff' },
  { level: 25, exp: 6650,   title: { ko: '짐 마스터', en: 'Gym Master' },         icon: '🏅', color: '#4a9aff' },
  { level: 26, exp: 7200,   title: { ko: '프로 리프터', en: 'Pro Lifter' },       icon: '🎖️', color: '#4a9aff' },
  { level: 27, exp: 7770,   title: { ko: '괴물 체력', en: 'Monster Stamina' },    icon: '🐉', color: '#4a9aff' },
  { level: 28, exp: 8360,   title: { ko: '강철 보디', en: 'Steel Body' },         icon: '🛡️', color: '#4a9aff' },
  { level: 29, exp: 8970,   title: { ko: '전투 머신', en: 'Battle Machine' },     icon: '🤖', color: '#4a9aff' },
  { level: 30, exp: 9600,   title: { ko: '30레벨 돌파', en: 'Lv.30 Breaker' },   icon: '🎯', color: '#4a9aff' },
  // 31~40: 엘리트
  { level: 31, exp: 10300,  title: { ko: '엘리트 리프터', en: 'Elite Lifter' },   icon: '⭐', color: '#c0a0ff' },
  { level: 32, exp: 11020,  title: { ko: '전설 입문', en: 'Legend Initiate' },     icon: '✨', color: '#c0a0ff' },
  { level: 33, exp: 11760,  title: { ko: '근육의 신전', en: 'Muscle Temple' },     icon: '🏛️', color: '#c0a0ff' },
  { level: 34, exp: 12520,  title: { ko: '타이탄', en: 'Titan' },                 icon: '🗼', color: '#c0a0ff' },
  { level: 35, exp: 13300,  title: { ko: '헤라클레스', en: 'Hercules' },           icon: '⚡', color: '#c0a0ff' },
  { level: 36, exp: 14100,  title: { ko: '올림포스 전사', en: 'Olympus Warrior' }, icon: '🏔️', color: '#c0a0ff' },
  { level: 37, exp: 14920,  title: { ko: '신의 근육', en: 'Divine Muscle' },       icon: '🔱', color: '#c0a0ff' },
  { level: 38, exp: 15760,  title: { ko: '천상의 리프터', en: 'Celestial Lifter' },icon: '🌙', color: '#c0a0ff' },
  { level: 39, exp: 16620,  title: { ko: '불사의 전사', en: 'Undying Warrior' },   icon: '♾️', color: '#c0a0ff' },
  { level: 40, exp: 17500,  title: { ko: '40레벨 돌파', en: 'Lv.40 Breaker' },   icon: '🎯', color: '#c0a0ff' },
  // 41~50: 전설
  { level: 41, exp: 18500,  title: { ko: '전설의 시작', en: 'Legend Begins' },     icon: '👑', color: '#ffd700' },
  { level: 42, exp: 19520,  title: { ko: '전설의 리프터', en: 'Legendary Lifter' },icon: '👑', color: '#ffd700' },
  { level: 43, exp: 20560,  title: { ko: '황금 보디', en: 'Golden Body' },         icon: '🏆', color: '#ffd700' },
  { level: 44, exp: 21620,  title: { ko: '왕좌의 주인', en: 'Throne Owner' },      icon: '🪑', color: '#ffd700' },
  { level: 45, exp: 22700,  title: { ko: '챔피언', en: 'Champion' },               icon: '🏆', color: '#ffd700' },
  { level: 46, exp: 23800,  title: { ko: '전설의 검', en: 'Legendary Blade' },     icon: '⚔️', color: '#ffd700' },
  { level: 47, exp: 24920,  title: { ko: '제왕', en: 'Emperor' },                 icon: '🦁', color: '#ffd700' },
  { level: 48, exp: 26060,  title: { ko: '전설의 왕관', en: 'Legendary Crown' },   icon: '👑', color: '#ffd700' },
  { level: 49, exp: 27220,  title: { ko: '절대자', en: 'The Absolute' },           icon: '💫', color: '#ffd700' },
  { level: 50, exp: 28400,  title: { ko: '50레벨 돌파', en: 'Lv.50 Breaker' },   icon: '🎯', color: '#ffd700' },
  // 51~60: 불멸
  { level: 51, exp: 29700,  title: { ko: '불멸의 시작', en: 'Immortal Begins' },   icon: '🔱', color: '#ff44ff' },
  { level: 52, exp: 31020,  title: { ko: '불멸의 리프터', en: 'Immortal Lifter' }, icon: '🔱', color: '#ff44ff' },
  { level: 53, exp: 32360,  title: { ko: '시간의 정복자', en: 'Time Conqueror' },  icon: '⏳', color: '#ff44ff' },
  { level: 54, exp: 33720,  title: { ko: '영원의 전사', en: 'Eternal Warrior' },   icon: '♾️', color: '#ff44ff' },
  { level: 55, exp: 35100,  title: { ko: '불사신', en: 'Immortal' },               icon: '🌟', color: '#ff44ff' },
  { level: 56, exp: 36500,  title: { ko: '차원의 리프터', en: 'Dimensional Lifter' },icon: '🌀', color: '#ff44ff' },
  { level: 57, exp: 37920,  title: { ko: '무한의 힘', en: 'Infinite Power' },      icon: '💥', color: '#ff44ff' },
  { level: 58, exp: 39360,  title: { ko: '운명의 파괴자', en: 'Fate Breaker' },    icon: '💀', color: '#ff44ff' },
  { level: 59, exp: 40820,  title: { ko: '불멸의 왕', en: 'Immortal King' },       icon: '🔱', color: '#ff44ff' },
  { level: 60, exp: 42300,  title: { ko: '60레벨 돌파', en: 'Lv.60 Breaker' },   icon: '🎯', color: '#ff44ff' },
  // 61~70: 신화
  { level: 61, exp: 43900,  title: { ko: '신화의 시작', en: 'Myth Begins' },       icon: '🌟', color: '#ff2222' },
  { level: 62, exp: 45520,  title: { ko: '신화급 리프터', en: 'Mythic Lifter' },   icon: '🌟', color: '#ff2222' },
  { level: 63, exp: 47160,  title: { ko: '천둥의 신', en: 'Thunder God' },         icon: '⛈️', color: '#ff2222' },
  { level: 64, exp: 48820,  title: { ko: '대지의 신', en: 'Earth God' },           icon: '🌍', color: '#ff2222' },
  { level: 65, exp: 50500,  title: { ko: '전쟁의 신', en: 'War God' },             icon: '⚔️', color: '#ff2222' },
  { level: 66, exp: 52200,  title: { ko: '태양의 신', en: 'Sun God' },             icon: '☀️', color: '#ff2222' },
  { level: 67, exp: 53920,  title: { ko: '우주의 리프터', en: 'Cosmic Lifter' },   icon: '🌌', color: '#ff2222' },
  { level: 68, exp: 55660,  title: { ko: '창조의 신', en: 'Creator God' },         icon: '✡️', color: '#ff2222' },
  { level: 69, exp: 57420,  title: { ko: '파괴와 창조', en: 'Destroy & Create' },  icon: '💥', color: '#ff2222' },
  { level: 70, exp: 59200,  title: { ko: '70레벨 돌파', en: 'Lv.70 Breaker' },   icon: '🎯', color: '#ff2222' },
  // 71~80: 초월
  { level: 71, exp: 61100,  title: { ko: '초월의 시작', en: 'Transcend Begins' },  icon: '🔮', color: '#00ffcc' },
  { level: 72, exp: 63020,  title: { ko: '초월자', en: 'Transcendent' },           icon: '🔮', color: '#00ffcc' },
  { level: 73, exp: 64960,  title: { ko: '차원 파괴자', en: 'Dimension Breaker' }, icon: '🌀', color: '#00ffcc' },
  { level: 74, exp: 66920,  title: { ko: '시공간의 왕', en: 'Spacetime King' },    icon: '⏰', color: '#00ffcc' },
  { level: 75, exp: 68900,  title: { ko: '만물의 리프터', en: 'Universal Lifter' },icon: '🌐', color: '#00ffcc' },
  { level: 76, exp: 70900,  title: { ko: '빅뱅 피지크', en: 'Big Bang Physique' }, icon: '💫', color: '#00ffcc' },
  { level: 77, exp: 72920,  title: { ko: '은하의 전사', en: 'Galaxy Warrior' },    icon: '🌌', color: '#00ffcc' },
  { level: 78, exp: 74960,  title: { ko: '블랙홀 파워', en: 'Blackhole Power' },   icon: '🕳️', color: '#00ffcc' },
  { level: 79, exp: 77020,  title: { ko: '우주의 끝', en: 'Edge of Universe' },    icon: '🚀', color: '#00ffcc' },
  { level: 80, exp: 79100,  title: { ko: '80레벨 돌파', en: 'Lv.80 Breaker' },   icon: '🎯', color: '#00ffcc' },
  // 81~90: 절대자
  { level: 81, exp: 81300,  title: { ko: '절대자의 길', en: 'Path of Absolute' },  icon: '🌠', color: '#ff8800' },
  { level: 82, exp: 83520,  title: { ko: '만물의 지배자', en: 'World Dominator' }, icon: '🌠', color: '#ff8800' },
  { level: 83, exp: 85760,  title: { ko: '무적의 보디', en: 'Invincible Body' },   icon: '💠', color: '#ff8800' },
  { level: 84, exp: 88020,  title: { ko: '근육의 법칙', en: 'Law of Muscle' },     icon: '📜', color: '#ff8800' },
  { level: 85, exp: 90300,  title: { ko: '극한의 리프터', en: 'Ultimate Lifter' }, icon: '🔥', color: '#ff8800' },
  { level: 86, exp: 92600,  title: { ko: '세계의 끝', en: 'World\'s End' },        icon: '🌅', color: '#ff8800' },
  { level: 87, exp: 94920,  title: { ko: '최강의 인간', en: 'Strongest Human' },   icon: '🦸', color: '#ff8800' },
  { level: 88, exp: 97260,  title: { ko: '영겁의 전사', en: 'Aeon Warrior' },      icon: '♾️', color: '#ff8800' },
  { level: 89, exp: 99620,  title: { ko: '신을 넘은 자', en: 'Beyond Gods' },      icon: '⚡', color: '#ff8800' },
  { level: 90, exp: 102000, title: { ko: '90레벨 돌파', en: 'Lv.90 Breaker' },   icon: '🎯', color: '#ff8800' },
  // 91~100: 만렙
  { level: 91, exp: 104500, title: { ko: '최종 진화', en: 'Final Evolution' },     icon: '🧬', color: '#ff0066' },
  { level: 92, exp: 107020, title: { ko: '완전체', en: 'Perfect Form' },           icon: '💎', color: '#ff0066' },
  { level: 93, exp: 109560, title: { ko: '리미트 브레이커', en: 'Limit Breaker' }, icon: '💢', color: '#ff0066' },
  { level: 94, exp: 112120, title: { ko: '무한의 경지', en: 'Infinite Realm' },    icon: '🌟', color: '#ff0066' },
  { level: 95, exp: 114700, title: { ko: '종말의 리프터', en: 'Omega Lifter' },    icon: '🔴', color: '#ff0066' },
  { level: 96, exp: 117300, title: { ko: '세계 최강', en: 'World\'s Strongest' },  icon: '🏆', color: '#ff0066' },
  { level: 97, exp: 119920, title: { ko: '전설을 넘어', en: 'Beyond Legend' },      icon: '🌈', color: '#ff0066' },
  { level: 98, exp: 122560, title: { ko: '영원불멸', en: 'Eternal Immortal' },     icon: '♾️', color: '#ff0066' },
  { level: 99, exp: 125220, title: { ko: '만렙 직전', en: 'Almost Max' },          icon: '❗', color: '#ff0066' },
  { level: 100,exp: 127900, title: { ko: '만렙 - 신화를 넘은 자', en: 'MAX - Beyond Myth' }, icon: '🌟', color: '#ff0066' },
];

const T = {
  ko: {
    nextLevel: '다음 레벨까지',
    maxLevel: 'MAX LEVEL',
    next: '다음',
    exp: 'EXP',
    allLevels: '전체 레벨 보기',
    closeLevels: '접기',
    current: '현재',
    required: '필요 EXP',
  },
  en: {
    nextLevel: 'Next level in',
    maxLevel: 'MAX LEVEL',
    next: 'Next',
    exp: 'EXP',
    allLevels: 'View All Levels',
    closeLevels: 'Close',
    current: 'Current',
    required: 'Required EXP',
  },
};

export function calcExp(totalWorkouts, totalInbody) {
  return (totalWorkouts * 10) + (totalInbody * 20);
}

export function getLevelInfo(exp) {
  let current = LEVEL_TABLE[0];
  for (let i = LEVEL_TABLE.length - 1; i >= 0; i--) {
    if (exp >= LEVEL_TABLE[i].exp) {
      current = LEVEL_TABLE[i];
      break;
    }
  }
  const nextIdx = LEVEL_TABLE.findIndex(l => l.level === current.level) + 1;
  const next = nextIdx < LEVEL_TABLE.length ? LEVEL_TABLE[nextIdx] : null;
  const currentExp = exp - current.exp;
  const needExp = next ? next.exp - current.exp : 0;
  const progress = next ? Math.min((currentExp / needExp) * 100, 100) : 100;
  return { ...current, exp: currentExp, needExp, progress, totalExp: exp, next };
}

export default function LevelSystem({ totalWorkouts, totalInbody }) {
  const { lang } = useLangStore();
  const t = T[lang] || T.ko;
  const [showAll, setShowAll] = useState(false);

  const exp = isAdmin() ? 999999 : calcExp(totalWorkouts, totalInbody);
  const info = getLevelInfo(exp);

  return (
    <div className="card" style={{ marginBottom: 16, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* 레벨 아이콘 */}
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${info.color}15`,
          border: `2px solid ${info.color}`,
          fontSize: 24,
          boxShadow: `0 0 12px ${info.color}30`,
        }}>
          {info.icon}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1.5,
              color: info.color,
            }}>
              LV.{info.level}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: info.color }}>
              {info.title[lang] || info.title.ko}
            </span>
          </div>

          {/* EXP 바 */}
          <div style={{ marginBottom: 4 }}>
            <div style={{
              height: 8, borderRadius: 4, background: 'var(--bg-tertiary)', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 4,
                width: `${info.progress}%`,
                background: `linear-gradient(90deg, ${info.color}, ${info.color}cc)`,
                transition: 'width 0.6s ease',
                boxShadow: `0 0 6px ${info.color}50`,
              }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
            <span>{t.exp} {info.totalExp}</span>
            {info.next ? (
              <span>{t.nextLevel} {info.needExp - info.exp} {t.exp}</span>
            ) : (
              <span style={{ color: info.color }}>{t.maxLevel}</span>
            )}
          </div>
        </div>
      </div>

      {/* 다음 레벨 미리보기 */}
      {info.next && (
        <div style={{
          marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)',
        }}>
          <span>{t.next}:</span>
          <span style={{ fontSize: 14 }}>{info.next.icon}</span>
          <span style={{ color: info.next.color, fontWeight: 600 }}>
            LV.{info.next.level} {info.next.title[lang] || info.next.title.ko}
          </span>
        </div>
      )}

      {/* 전체 레벨 보기 */}
      <div style={{ marginTop: 10, textAlign: 'center' }}>
        <button
          onClick={() => setShowAll(!showAll)}
          style={{
            background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
            padding: '4px 14px', fontSize: 11, borderRadius: 'var(--radius)',
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          {showAll ? t.closeLevels : t.allLevels}
        </button>
      </div>

      {showAll && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {LEVEL_TABLE.map((lv, i) => {
            const isCurrent = lv.level === info.level;
            return (
              <div key={lv.level} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 6px',
                borderRadius: 'var(--radius)',
                background: isCurrent ? `${lv.color}12` : 'none',
                borderLeft: isCurrent ? `3px solid ${lv.color}` : '3px solid transparent',
                marginBottom: 2,
              }}>
                <span style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{lv.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontFamily: "'Bebas Neue', sans-serif", fontSize: 12, letterSpacing: 1,
                      color: lv.color,
                    }}>
                      LV.{lv.level}
                    </span>
                    <span style={{
                      fontSize: 12, fontWeight: isCurrent ? 700 : 400,
                      color: isCurrent ? lv.color : 'var(--text-secondary)',
                    }}>
                      {lv.title[lang] || lv.title.ko}
                    </span>
                    {isCurrent && (
                      <span style={{
                        fontSize: 9, padding: '1px 6px', borderRadius: 'var(--radius)',
                        background: lv.color, color: '#000', fontWeight: 700,
                      }}>
                        {t.current}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {t.required}: {lv.exp} {t.exp}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
