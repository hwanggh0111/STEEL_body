// 같은 무게로 전보다 많이 했을 때 저장 직후에 뜨는 띠 (2026-11-12, 시안 1112 B).
//
// **최고 기록 띠와 같은 자리 · 같은 모양**이다(조금 작다). 「나를 넘었다」를 알리는
// 자리는 하나여야 해서, 최고 기록 띠가 뜨는 날에는 이것이 안 뜬다
// (`data/sameWeight.js` 머리글).
//
// 무게는 「82.5」처럼 **적은 대로** 보인다 — 숫자로 견준 값을 다시 글자로 만든다
const kgText = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));
const mmdd = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

export default function SameWeightBanner({ best, today, onClose }) {
  if (!best) return null;
  const when = best.prevDate === today ? '오늘' : mmdd(best.prevDate);
  return (
    <div style={{
      background: 'var(--accent-dim)',
      border: '1px solid var(--accent)',
      borderRadius: 'var(--radius)',
      padding: '14px 16px',
      marginBottom: 16,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
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
      <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{best.exercise}</div>
      <div style={{
        fontFamily: "'Bebas Neue', 'BI Sans KR', sans-serif", fontSize: 26, letterSpacing: 1.5,
        color: 'var(--accent)', lineHeight: 1.1,
      }}>{best.reps}회</div>
      <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
        {kgText(best.kg)}kg 으로 가장 많이 했어요 · {best.reps}회
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
        전에는 {best.prevReps}회 · {when}
      </div>
    </div>
  );
}
