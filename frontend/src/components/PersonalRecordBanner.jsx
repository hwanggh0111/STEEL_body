import { daysBetween } from '../data/personalRecord';

// 최고 기록을 넘겼을 때 저장 직후에 뜨는 띠.
//
// **자기 기록을 실제로 넘겼을 때만 뜬다.** 그 종목의 첫 기록에는 안 뜬다 —
// 처음 적는 운동마다 「최고 기록」이 뜨면 그 말이 아무 뜻이 없어진다.
//
// 무게는 1RM 으로 환산해서 견주지만, 크게 보여주는 것은 **실제로 든 무게**다.
// 환산값은 왜 이게 경신인지를 밝히는 자리에만 작게 적는다 —
// 75kg 8회에서 85kg 5회로 갔을 때, 큰 글씨가 97 이면 무슨 소린지 알 수 없다.

const fmt = (e) => (e.kind === 'bodyweight'
  ? `${e.reps}회`
  : `${e.kg}kg × ${e.reps}회`);

export default function PersonalRecordBanner({ record, onClose }) {
  if (!record?.prev) return null;
  const { entry, prev } = record;
  const gap = daysBetween(prev.date, entry.date);

  return (
    <div style={{
      background: 'var(--accent-dim)',
      border: '1px solid var(--accent)',
      borderRadius: 'var(--radius)',
      padding: '18px 16px',
      marginBottom: 16,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10,
      position: 'relative',
      animation: 'pageIn 0.22s ease-out',
    }}>
      <button
        onClick={onClose}
        aria-label="닫기"
        style={{
          position: 'absolute', top: 6, right: 8,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 16, lineHeight: 1, padding: 4,
        }}
      >×</button>

      <div className="badge badge-accent" style={{ background: 'var(--bg-primary)' }}>최고 기록</div>
      <div style={{ fontSize: 15, color: 'var(--text-primary)' }}>{entry.exercise}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 1.5,
          color: 'var(--text-muted)', textDecoration: 'line-through', lineHeight: 1,
        }}>{fmt(prev)}</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, letterSpacing: 2,
          color: 'var(--accent)', lineHeight: 1,
        }}>{fmt(entry)}</span>
      </div>

      {/* 무게가 있는 종목은 왜 이게 경신인지를 밝힌다 (횟수가 달라 무게만으로는 안 보인다) */}
      {entry.kind === 'weighted' && (
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
          1RM 환산 {prev.score} → {entry.score}
        </div>
      )}

      {gap !== null && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {gap === 0 ? '오늘 안에 다시 넘겼어요' : `${gap}일 만에 넘었어요`}
        </div>
      )}
    </div>
  );
}
