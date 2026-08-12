import { useLangStore } from '../store/langStore';
import { getLevelInfo } from './LevelSystem';
import { compactExp } from '../data/pachinkoData';

// 한 판에서 얻은 EXP와 그로 인한 레벨 변화를 보여준다.
// baseExp = 파칭코를 뺀 순수 기록 EXP + 이번 판 이전까지의 누적
// gainedExp = 이번 판에서 받은 EXP

const T = {
  ko: { gain: '획득', levelUp: '레벨 업', noGain: '획득 없음', max: '만렙' },
  en: { gain: 'GAIN', levelUp: 'LEVEL UP', noGain: 'No gain', max: 'MAX' },
};

export default function ExpGainBanner({ baseExp, gainedExp, color = 'var(--success)' }) {
  const { lang } = useLangStore();
  const t = T[lang] || T.ko;

  const before = getLevelInfo(Math.max(0, baseExp - gainedExp));
  const after = getLevelInfo(baseExp);
  const leveledUp = after.level > before.level;
  const isMax = !after.next;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 10, flexWrap: 'wrap',
      padding: '8px 10px', marginBottom: 10,
      borderRadius: 'var(--radius)',
      background: gainedExp > 0 ? `${color}12` : 'var(--bg-tertiary)',
      border: `1px solid ${gainedExp > 0 ? `${color}44` : 'var(--border)'}`,
    }}>
      {/* 획득 EXP */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1 }}>
          {t.gain}
        </span>
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, lineHeight: 1,
          color: gainedExp > 0 ? color : 'var(--text-muted)',
        }}>
          {gainedExp > 0 ? `+${compactExp(gainedExp)}` : '+0'}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>EXP</span>
      </div>

      {/* 레벨 변화 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 14,
          color: 'var(--text-muted)',
        }}>
          LV {before.level}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>→</span>
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 18,
          color: leveledUp ? after.color : 'var(--text-secondary)',
          textShadow: leveledUp ? `0 0 10px ${after.color}88` : 'none',
        }}>
          LV {after.level}
        </span>
        {leveledUp && (
          <span style={{
            padding: '1px 6px', borderRadius: 'var(--radius)',
            background: `${after.color}22`, border: `1px solid ${after.color}66`,
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 10, letterSpacing: 1,
            color: after.color,
          }}>
            {isMax ? t.max : t.levelUp} {after.icon}
          </span>
        )}
      </div>

      {/* 다음 레벨까지 남은 양 */}
      {!isMax && (
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {t.gain === 'GAIN' ? 'next' : '다음까지'} {compactExp(Math.max(0, after.needExp - after.exp))}
        </span>
      )}
    </div>
  );
}
