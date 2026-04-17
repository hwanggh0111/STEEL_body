function getBmiInfo(bmi) {
  if (!bmi) return { label: '-', color: 'var(--text-muted)' };
  if (bmi < 18.5) return { label: '저체중', color: 'var(--info)' };
  if (bmi < 23) return { label: '정상', color: 'var(--success)' };
  if (bmi < 25) return { label: '과체중', color: 'var(--warning)' };
  return { label: '비만', color: 'var(--danger)' };
}

export default function InbodyCard({ record, onDelete }) {
  const bmiInfo = getBmiInfo(record.bmi);

  return (
    <div className="card" style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{record.date}</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13 }}>체중 <strong style={{ color: 'var(--accent)' }}>{record.weight}kg</strong></span>
            {record.fat_pct && <span style={{ fontSize: 13 }}>체지방 <strong>{record.fat_pct}%</strong></span>}
            {record.muscle_kg && <span style={{ fontSize: 13 }}>골격근 <strong>{record.muscle_kg}kg</strong></span>}
            {record.bmi && (
              <span style={{ fontSize: 13 }}>
                BMI <strong style={{ color: bmiInfo.color }}>{record.bmi} ({bmiInfo.label})</strong>
              </span>
            )}
          </div>
        </div>
        <button className="delete-btn" onClick={() => onDelete(record.id)}>✕</button>
      </div>
    </div>
  );
}
