import { useLangStore } from '../store/langStore';
import { getLevelInfo, getTranscendInfo } from './LevelSystem';
import { compactExp } from '../data/pachinkoData';

// 한 판에서 얻은 EXP와 그로 인한 레벨 변화를 보여준다.
// baseExp = 이번 판까지 반영된 총 EXP (기록 EXP + 파칭코 누적)
// gainedExp = 이번 판에서 받은 EXP
//
// 만렙을 넘어서면 일반 레벨은 더 이상 움직이지 않으므로 초월 레벨을 대신 보여준다.
// (안 그러면 만렙 이후로는 영원히 "LV 149 → LV 149"만 뜬다)

const T = {
  ko: { gain: '획득', levelUp: '레벨 업', max: '만렙', nextTo: '다음까지', tr: '초월' },
  en: { gain: 'GAIN', levelUp: 'LEVEL UP', max: 'MAX', nextTo: 'next', tr: 'TR' },
};

export default function ExpGainBanner({ baseExp, gainedExp, color = 'var(--success)' }) {
  const { lang } = useLangStore();
  const t = T[lang] || T.ko;

  const beforeExp = Math.max(0, baseExp - gainedExp);
  const before = getLevelInfo(beforeExp);
  const after = getLevelInfo(baseExp);
  const trBefore = getTranscendInfo(beforeExp);
  const trAfter = getTranscendInfo(baseExp);

  // 초월 구간에 들어섰으면 표시 기준을 초월 레벨로 바꾼다
  const inTr = !!trAfter;
  const labelBefore = inTr && trBefore ? `${t.tr} ${trBefore.level}` : `LV ${before.level}`;
  const labelAfter = inTr ? `${t.tr} ${trAfter.level}` : `LV ${after.level}`;
  const leveledUp = inTr
    ? (!trBefore || trAfter.level > trBefore.level)
    : after.level > before.level;
  const isMax = inTr ? trAfter.maxed : !after.next;

  const upColor = inTr ? trAfter.tier.color : after.color;
  const upIcon = inTr ? trAfter.tier.icon : after.icon;
  const remaining = inTr
    ? trAfter.need - trAfter.into
    : Math.max(0, after.needExp - after.exp);

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
          {labelBefore}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>→</span>
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 18,
          color: leveledUp ? upColor : 'var(--text-secondary)',
          textShadow: leveledUp ? `0 0 10px ${upColor}88` : 'none',
        }}>
          {labelAfter}
        </span>
        {leveledUp && (
          <span style={{
            padding: '1px 6px', borderRadius: 'var(--radius)',
            background: `${upColor}22`, border: `1px solid ${upColor}66`,
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 10, letterSpacing: 1,
            color: upColor,
          }}>
            {isMax ? t.max : t.levelUp} {upIcon}
          </span>
        )}
      </div>

      {/* 다음 레벨까지 남은 양 */}
      {!isMax && (
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {t.nextTo} {compactExp(remaining)}
        </span>
      )}
    </div>
  );
}
