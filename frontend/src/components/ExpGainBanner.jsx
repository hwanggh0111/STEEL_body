import { useLangStore } from '../store/langStore';
import { getLevelInfo, getTranscendInfo, getGenesisInfo, UL_EXP } from './LevelSystem';
import { compactExp } from '../data/pachinkoData';

// 한 판에서 얻은 EXP와 그로 인한 레벨 변화를 보여준다.
// baseExp = 이번 판까지 반영된 총 EXP (기록 EXP + 파칭코 누적)
// gainedExp = 이번 판에서 받은 EXP
//
// 만렙을 넘어서면 일반 레벨은 더 이상 움직이지 않으므로 초월 레벨을 대신 보여준다.
// (안 그러면 만렙 이후로는 영원히 "LV 149 → LV 149"만 뜬다)
//
// 초월까지 만렙이면 같은 이유로 개벽 레벨을 보여준다. 이때는 일반 EXP 가 상한에 걸려
// 증가분이 항상 0 이므로, 획득량도 울트라 레전드 EXP(ulGain)로 바꿔서 띄운다.
// ulExp = 이번 판까지 반영된 UL EXP 총량, ulGain = 이번 판에 넘어온 몫.

const T = {
  ko: { gain: '획득', levelUp: '레벨 업', max: '만렙', nextTo: '다음까지', tr: '초월', gn: '개벽' },
  en: { gain: 'GAIN', levelUp: 'LEVEL UP', max: 'MAX', nextTo: 'next', tr: 'TR', gn: 'GN' },
};

export default function ExpGainBanner({ baseExp, gainedExp, color = 'var(--success)', ulExp = 0, ulGain = 0 }) {
  const { lang } = useLangStore();
  const t = T[lang] || T.ko;

  const beforeExp = Math.max(0, baseExp - gainedExp);
  const before = getLevelInfo(beforeExp);
  const after = getLevelInfo(baseExp);
  const trBefore = getTranscendInfo(beforeExp);
  const trAfter = getTranscendInfo(baseExp);
  const gnAfter = getGenesisInfo(baseExp, ulExp);
  const gnBefore = getGenesisInfo(beforeExp, Math.max(0, ulExp - ulGain));

  // 표시 기준: 개벽 > 초월 > 일반 순으로 "아직 움직이는 레벨"을 고른다
  const inGn = !!gnAfter;
  const inTr = !inGn && !!trAfter;

  // 개벽 구간에서는 획득량도 UL EXP 로 바꾼다 (일반 EXP 는 상한에 걸려 늘 0 이다)
  const shownGain = inGn ? ulGain : gainedExp;
  const gainUnit = inGn ? (UL_EXP.short[lang] || UL_EXP.short.ko) : 'EXP';

  const labelBefore = inGn
    ? `${t.gn} ${gnBefore ? gnBefore.level : 0}`
    : inTr && trBefore ? `${t.tr} ${trBefore.level}` : `LV ${before.level}`;
  const labelAfter = inGn
    ? `${t.gn} ${gnAfter.level}`
    : inTr ? `${t.tr} ${trAfter.level}` : `LV ${after.level}`;
  const leveledUp = inGn
    ? (!gnBefore || gnAfter.level > gnBefore.level)
    : inTr
      ? (!trBefore || trAfter.level > trBefore.level)
      : after.level > before.level;
  const isMax = inGn ? gnAfter.maxed : inTr ? trAfter.maxed : !after.next;

  const upColor = inGn ? gnAfter.tier.color : inTr ? trAfter.tier.color : after.color;
  const upIcon = inGn ? gnAfter.tier.icon : inTr ? trAfter.tier.icon : after.icon;
  const remaining = inGn
    ? gnAfter.need - gnAfter.into
    : inTr
      ? trAfter.need - trAfter.into
      : Math.max(0, after.needExp - after.exp);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 10, flexWrap: 'wrap',
      padding: '8px 10px', marginBottom: 10,
      borderRadius: 'var(--radius)',
      background: shownGain > 0 ? `${color}12` : 'var(--bg-tertiary)',
      border: `1px solid ${shownGain > 0 ? `${color}44` : 'var(--border)'}`,
    }}>
      {/* 획득 EXP */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1 }}>
          {t.gain}
        </span>
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, lineHeight: 1,
          color: shownGain > 0 ? (inGn ? UL_EXP.color : color) : 'var(--text-muted)',
        }}>
          {shownGain > 0 ? `+${compactExp(shownGain)}` : '+0'}
        </span>
        <span style={{
          fontSize: 10,
          color: inGn ? UL_EXP.color : 'var(--text-muted)',
        }}>{gainUnit}</span>
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
