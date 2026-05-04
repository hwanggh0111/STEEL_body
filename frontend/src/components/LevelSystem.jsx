import { useState } from 'react';
import { useLangStore } from '../store/langStore';
import { isAdmin } from '../data/admin';

// 10티어 × 5레벨 = 50레벨
const LEVEL_TABLE = [
  // 1~5: T1 입문 (gray)
  { level: 1,  exp: 0,     tier: 1, title: { ko: '입문자',     en: 'Beginner' },        icon: '🌱', color: '#888' },
  { level: 2,  exp: 30,    tier: 1, title: { ko: '첫걸음',     en: 'First Step' },      icon: '🐣', color: '#888' },
  { level: 3,  exp: 80,    tier: 1, title: { ko: '운동 시작',   en: 'Started' },         icon: '🔥', color: '#999' },
  { level: 4,  exp: 150,   tier: 1, title: { ko: '적응 단계',   en: 'Adapting' },        icon: '💪', color: '#a0a0a0' },
  { level: 5,  exp: 240,   tier: 1, title: { ko: '입문 졸업',   en: 'Graduated' },       icon: '🎓', color: '#aaa' },
  // 6~10: T2 초보 (bronze)
  { level: 6,  exp: 350,   tier: 2, title: { ko: '초보 헬린이', en: 'Newbie Lifter' },   icon: '🏋️', color: '#b8860b' },
  { level: 7,  exp: 480,   tier: 2, title: { ko: '운동 습관',   en: 'Habit Builder' },   icon: '📅', color: '#b8860b' },
  { level: 8,  exp: 630,   tier: 2, title: { ko: '꾸준함',     en: 'Steady' },          icon: '🏃', color: '#cd853f' },
  { level: 9,  exp: 800,   tier: 2, title: { ko: '초보 강자',   en: 'Strong Newbie' },   icon: '💥', color: '#cd853f' },
  { level: 10, exp: 1000,  tier: 2, title: { ko: '초보 마스터', en: 'Newbie Master' },   icon: '🎯', color: '#daa520' },
  // 11~15: T3 중급 (orange)
  { level: 11, exp: 1230,  tier: 3, title: { ko: '중급 진입',   en: 'Mid Lifter' },      icon: '🔥', color: '#ff6b1a' },
  { level: 12, exp: 1490,  tier: 3, title: { ko: '헬스 매니아', en: 'Gym Maniac' },      icon: '⚡', color: '#ff6b1a' },
  { level: 13, exp: 1780,  tier: 3, title: { ko: '근육 사냥꾼', en: 'Muscle Hunter' },   icon: '🏹', color: '#ff6b1a' },
  { level: 14, exp: 2100,  tier: 3, title: { ko: '철의 의지',   en: 'Iron Will' },       icon: '🔩', color: '#ff6b1a' },
  { level: 15, exp: 2450,  tier: 3, title: { ko: '중급 마스터', en: 'Mid Master' },      icon: '🎯', color: '#ff6b1a' },
  // 16~20: T4 상급 (blue)
  { level: 16, exp: 2840,  tier: 4, title: { ko: '상급 리프터', en: 'Advanced Lifter' }, icon: '💎', color: '#4a9aff' },
  { level: 17, exp: 3270,  tier: 4, title: { ko: '근육 조각가', en: 'Body Sculptor' },   icon: '🗿', color: '#4a9aff' },
  { level: 18, exp: 3740,  tier: 4, title: { ko: '철인',       en: 'Iron Man' },        icon: '🦾', color: '#4a9aff' },
  { level: 19, exp: 4250,  tier: 4, title: { ko: '짐 마스터',   en: 'Gym Master' },      icon: '🏅', color: '#4a9aff' },
  { level: 20, exp: 4800,  tier: 4, title: { ko: '상급 정점',   en: 'Advanced Peak' },   icon: '🎯', color: '#4a9aff' },
  // 21~25: T5 엘리트 (purple)
  { level: 21, exp: 5400,  tier: 5, title: { ko: '엘리트',     en: 'Elite' },           icon: '⭐', color: '#c0a0ff' },
  { level: 22, exp: 6050,  tier: 5, title: { ko: '전설 입문',   en: 'Legend Initiate' }, icon: '✨', color: '#c0a0ff' },
  { level: 23, exp: 6750,  tier: 5, title: { ko: '타이탄',     en: 'Titan' },           icon: '🗼', color: '#c0a0ff' },
  { level: 24, exp: 7500,  tier: 5, title: { ko: '헤라클레스', en: 'Hercules' },        icon: '⚡', color: '#c0a0ff' },
  { level: 25, exp: 8300,  tier: 5, title: { ko: '엘리트 마스터', en: 'Elite Master' }, icon: '🎯', color: '#c0a0ff' },
  // 26~30: T6 전설 (gold)
  { level: 26, exp: 9150,  tier: 6, title: { ko: '전설의 시작', en: 'Legend Begins' },   icon: '👑', color: '#ffd700' },
  { level: 27, exp: 10050, tier: 6, title: { ko: '전설의 리프터', en: 'Legendary' },     icon: '🏆', color: '#ffd700' },
  { level: 28, exp: 11000, tier: 6, title: { ko: '황금 보디',   en: 'Golden Body' },     icon: '💛', color: '#ffd700' },
  { level: 29, exp: 12000, tier: 6, title: { ko: '챔피언',     en: 'Champion' },        icon: '🥇', color: '#ffd700' },
  { level: 30, exp: 13050, tier: 6, title: { ko: '전설 마스터', en: 'Legend Master' },   icon: '🎯', color: '#ffd700' },
  // 31~35: T7 불멸 (magenta)
  { level: 31, exp: 14150, tier: 7, title: { ko: '불멸의 시작', en: 'Immortal Begins' }, icon: '🔱', color: '#ff44ff' },
  { level: 32, exp: 15300, tier: 7, title: { ko: '시간의 정복자', en: 'Time Conqueror' },icon: '⏳', color: '#ff44ff' },
  { level: 33, exp: 16500, tier: 7, title: { ko: '영원의 전사', en: 'Eternal Warrior' }, icon: '♾️', color: '#ff44ff' },
  { level: 34, exp: 17750, tier: 7, title: { ko: '불사신',     en: 'Immortal' },        icon: '🌟', color: '#ff44ff' },
  { level: 35, exp: 19050, tier: 7, title: { ko: '불멸 마스터', en: 'Immortal Master' }, icon: '🎯', color: '#ff44ff' },
  // 36~40: T8 신화 (red)
  { level: 36, exp: 20400, tier: 8, title: { ko: '신화의 시작', en: 'Myth Begins' },     icon: '🌟', color: '#ff2222' },
  { level: 37, exp: 21800, tier: 8, title: { ko: '천둥의 신',   en: 'Thunder God' },     icon: '⛈️', color: '#ff2222' },
  { level: 38, exp: 23250, tier: 8, title: { ko: '전쟁의 신',   en: 'War God' },         icon: '⚔️', color: '#ff2222' },
  { level: 39, exp: 24750, tier: 8, title: { ko: '우주의 리프터', en: 'Cosmic Lifter' }, icon: '🌌', color: '#ff2222' },
  { level: 40, exp: 26300, tier: 8, title: { ko: '신화 마스터', en: 'Myth Master' },     icon: '🎯', color: '#ff2222' },
  // 41~45: T9 초월 (cyan)
  { level: 41, exp: 27900, tier: 9, title: { ko: '초월의 시작', en: 'Transcend' },       icon: '🔮', color: '#00ffcc' },
  { level: 42, exp: 29550, tier: 9, title: { ko: '차원 파괴자', en: 'Dimension Breaker' },icon: '🌀', color: '#00ffcc' },
  { level: 43, exp: 31250, tier: 9, title: { ko: '만물의 리프터', en: 'Universal' },     icon: '🌐', color: '#00ffcc' },
  { level: 44, exp: 33000, tier: 9, title: { ko: '우주의 끝',   en: 'Edge of Universe' },icon: '🚀', color: '#00ffcc' },
  { level: 45, exp: 34800, tier: 9, title: { ko: '초월 마스터', en: 'Transcend Master' },icon: '🎯', color: '#00ffcc' },
  // 46~50: T10 만렙 (hot pink)
  { level: 46, exp: 36650, tier: 10, title: { ko: '절대자',     en: 'Absolute' },        icon: '🌠', color: '#ff0066' },
  { level: 47, exp: 38550, tier: 10, title: { ko: '무적의 보디', en: 'Invincible Body' },icon: '💠', color: '#ff0066' },
  { level: 48, exp: 40500, tier: 10, title: { ko: '극한의 리프터', en: 'Ultimate' },     icon: '🔥', color: '#ff0066' },
  { level: 49, exp: 42500, tier: 10, title: { ko: '신을 넘은 자', en: 'Beyond Gods' },   icon: '⚡', color: '#ff0066' },
  { level: 50, exp: 44550, tier: 10, title: { ko: '신화를 넘은 자', en: 'Beyond Myth' }, icon: '🌟', color: '#ff0066' },
];

const TIER_INFO = {
  1:  { name: { ko: '입문',   en: 'Beginner' },     color: '#888' },
  2:  { name: { ko: '초보',   en: 'Novice' },       color: '#daa520' },
  3:  { name: { ko: '중급',   en: 'Intermediate' }, color: '#ff6b1a' },
  4:  { name: { ko: '상급',   en: 'Advanced' },     color: '#4a9aff' },
  5:  { name: { ko: '엘리트', en: 'Elite' },        color: '#c0a0ff' },
  6:  { name: { ko: '전설',   en: 'Legend' },       color: '#ffd700' },
  7:  { name: { ko: '불멸',   en: 'Immortal' },     color: '#ff44ff' },
  8:  { name: { ko: '신화',   en: 'Myth' },         color: '#ff2222' },
  9:  { name: { ko: '초월',   en: 'Transcend' },    color: '#00ffcc' },
  10: { name: { ko: '만렙',   en: 'Max' },          color: '#ff0066' },
};

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
    tier: '티어',
    nextTier: '다음 티어까지',
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
    tier: 'TIER',
    nextTier: 'Next tier in',
  },
};

// EXP 공식 1.5배 상향: 운동 ×10 → ×15, 인바디 ×20 → ×30
export function calcExp(totalWorkouts, totalInbody) {
  return (totalWorkouts * 15) + (totalInbody * 30);
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

  // 티어 정보 + 다음 티어 진입 레벨 찾기
  const tierInfo = TIER_INFO[current.tier];
  const nextTierEntry = LEVEL_TABLE.find(l => l.tier === current.tier + 1);
  const nextTierInfo = nextTierEntry ? TIER_INFO[nextTierEntry.tier] : null;
  const expToNextTier = nextTierEntry ? nextTierEntry.exp - exp : 0;

  return {
    ...current,
    exp: currentExp,
    needExp,
    progress,
    totalExp: exp,
    next,
    tierInfo,
    nextTierInfo,
    nextTierEntry,
    expToNextTier,
  };
}

export default function LevelSystem({ totalWorkouts, totalInbody }) {
  const { lang } = useLangStore();
  const t = T[lang] || T.ko;
  const [showAll, setShowAll] = useState(false);

  const exp = isAdmin() ? 999999 : calcExp(totalWorkouts, totalInbody);
  const info = getLevelInfo(exp);

  // 현재 티어 안에서의 레벨 진행도 (5레벨 중 몇 번째)
  const tierStartLevel = (info.tier - 1) * 5 + 1;
  const tierLevelIdx = info.level - tierStartLevel + 1;

  return (
    <div className="card" style={{ marginBottom: 16, padding: 16 }}>
      {/* 상단: 티어 칩 + 레벨 표시 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px',
          borderRadius: 'var(--radius)',
          background: `${info.tierInfo.color}18`,
          border: `1px solid ${info.tierInfo.color}66`,
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 11, letterSpacing: 1.5,
          color: info.tierInfo.color,
        }}>
          <span>{t.tier}</span>
          <span style={{ fontWeight: 700 }}>
            {info.tierInfo.name[lang] || info.tierInfo.name.ko}
          </span>
          <span style={{ fontSize: 9, opacity: 0.6 }}>
            {tierLevelIdx}/5
          </span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 6,
          fontFamily: "'Bebas Neue', sans-serif",
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1 }}>LV</span>
          <span style={{
            fontSize: 26, fontWeight: 700, color: info.color, letterSpacing: 1,
            textShadow: `0 0 12px ${info.color}40`,
          }}>
            {info.level}
          </span>
        </div>
      </div>

      {/* 메인: 아이콘 + 칭호 + EXP 바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `radial-gradient(circle, ${info.color}25 0%, ${info.color}08 70%)`,
          border: `2px solid ${info.color}`,
          fontSize: 26,
          boxShadow: `0 0 16px ${info.color}40, inset 0 0 8px ${info.color}20`,
        }}>
          {info.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: info.color, marginBottom: 6,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {info.title[lang] || info.title.ko}
          </div>

          {/* EXP 바 */}
          <div style={{ marginBottom: 4 }}>
            <div style={{
              height: 10, borderRadius: 5,
              background: 'var(--bg-tertiary)',
              overflow: 'hidden',
              border: '1px solid var(--border)',
            }}>
              <div style={{
                height: '100%', borderRadius: 5,
                width: `${info.progress}%`,
                background: `linear-gradient(90deg, ${info.color}, ${info.color}cc)`,
                transition: 'width 0.6s ease',
                boxShadow: `0 0 8px ${info.color}80`,
              }} />
            </div>
          </div>

          <div style={{
            display: 'flex', justifyContent: 'space-between', fontSize: 10,
            color: 'var(--text-muted)',
          }}>
            <span>{t.exp} {info.totalExp.toLocaleString()}</span>
            {info.next ? (
              <span>{t.nextLevel} {(info.needExp - info.exp).toLocaleString()} {t.exp}</span>
            ) : (
              <span style={{ color: info.color, fontWeight: 700 }}>{t.maxLevel}</span>
            )}
          </div>
        </div>
      </div>

      {/* 하단: 다음 레벨 + 다음 티어 미리보기 */}
      {info.next && (
        <div style={{
          marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
            color: 'var(--text-muted)',
          }}>
            <span>{t.next}:</span>
            <span style={{ fontSize: 14 }}>{info.next.icon}</span>
            <span style={{ color: info.next.color, fontWeight: 600 }}>
              LV.{info.next.level} {info.next.title[lang] || info.next.title.ko}
            </span>
          </div>
          {info.nextTierInfo && info.nextTierEntry && (
            <div style={{
              fontSize: 10, color: 'var(--text-muted)',
              padding: '2px 8px', borderRadius: 'var(--radius)',
              background: `${info.nextTierInfo.color}10`,
              border: `1px solid ${info.nextTierInfo.color}40`,
            }}>
              <span style={{ color: info.nextTierInfo.color, fontWeight: 700 }}>
                {info.nextTierInfo.name[lang] || info.nextTierInfo.name.ko}
              </span>
              <span> · {t.nextTier} {info.expToNextTier.toLocaleString()} {t.exp}</span>
            </div>
          )}
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
          {Object.values(TIER_INFO).map((tier, tIdx) => {
            const tierNum = tIdx + 1;
            const tierLevels = LEVEL_TABLE.filter(l => l.tier === tierNum);
            return (
              <div key={tierNum} style={{ marginBottom: 12 }}>
                {/* 티어 헤더 */}
                <div style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 12, letterSpacing: 2,
                  color: tier.color, marginBottom: 6,
                  paddingBottom: 4, borderBottom: `1px solid ${tier.color}30`,
                }}>
                  T{tierNum} · {tier.name[lang] || tier.name.ko}
                </div>
                {tierLevels.map(lv => {
                  const isCurrent = lv.level === info.level;
                  return (
                    <div key={lv.level} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '6px 6px',
                      borderRadius: 'var(--radius)',
                      background: isCurrent ? `${lv.color}14` : 'none',
                      borderLeft: isCurrent ? `3px solid ${lv.color}` : '3px solid transparent',
                      marginBottom: 1,
                    }}>
                      <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{lv.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            fontFamily: "'Bebas Neue', sans-serif", fontSize: 11, letterSpacing: 1,
                            color: lv.color,
                          }}>
                            LV.{lv.level}
                          </span>
                          <span style={{
                            fontSize: 12, fontWeight: isCurrent ? 700 : 400,
                            color: isCurrent ? lv.color : 'var(--text-secondary)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
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
                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                          {t.required}: {lv.exp.toLocaleString()} {t.exp}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
