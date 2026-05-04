import { useState } from 'react';
import { toast } from '../Toast';

function getShoulderType(width) {
  if (width < 38) return { label: '좁은 어깨', color: 'var(--info)', emoji: '📐' };
  if (width < 42) return { label: '보통 어깨', color: 'var(--text-secondary)', emoji: '📏' };
  if (width < 46) return { label: '넓은 어깨', color: 'var(--success)', emoji: '💪' };
  if (width < 50) return { label: '광배 어깨', color: 'var(--accent)', emoji: '🔥' };
  return { label: '문짝 어깨', color: 'var(--danger)', emoji: '🚪' };
}

function getRatioGrade(ratio) {
  if (!ratio) return null;
  const r = Number(ratio);
  if (r >= 1.6) return { label: '역삼각형 (이상적)', color: 'var(--success)' };
  if (r >= 1.45) return { label: '좋은 비율', color: 'var(--accent)' };
  if (r >= 1.3) return { label: '보통 비율', color: 'var(--text-secondary)' };
  return { label: '개선 필요', color: 'var(--warning)' };
}

export default function ShoulderSection({ records, onSave, onDelete }) {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [shoulderWidth, setShoulderWidth] = useState('');
  const [waist, setWaist] = useState('');

  const type = shoulderWidth ? getShoulderType(Number(shoulderWidth)) : null;
  const ratio = shoulderWidth && waist ? (Number(shoulderWidth) / Number(waist)).toFixed(2) : null;
  const ratioGrade = getRatioGrade(ratio);

  const handleSave = (e) => {
    e.preventDefault();
    if (!shoulderWidth) { toast('어깨 너비를 입력해주세요'); return; }
    onSave({ date, shoulder: Number(shoulderWidth), waist: waist ? Number(waist) : null, ratio: ratio ? Number(ratio) : null });
    setShoulderWidth(''); setWaist('');
  };

  const latest = records[0];
  const oldest = records.length >= 2 ? records[records.length - 1] : null;
  const latestShoulder = latest?.data?.shoulder;
  const oldestShoulder = oldest?.data?.shoulder;
  const diff = latestShoulder && oldestShoulder ? (latestShoulder - oldestShoulder).toFixed(1) : null;

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="section-title"><div className="accent-bar" />어깨 측정</div>
      <div className="card" style={{ marginBottom: 16, borderColor: 'var(--accent)' }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1.5, color: 'var(--accent)', marginBottom: 6 }}>측정 방법</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          1. 줄자를 준비하세요<br />
          2. 왼쪽 어깨 끝(견봉) → 오른쪽 어깨 끝(견봉)까지 측정<br />
          3. 등 뒤로 줄자를 돌리지 말고 일직선으로 측정<br />
          4. 허리둘레는 배꼽 높이에서 측정 (선택)
        </div>
      </div>

      <form onSubmit={handleSave} style={{ marginBottom: 24 }}>
        <label className="label">날짜</label>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ marginBottom: 10 }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="label">어깨 너비 (cm)</label>
            <input className="input" type="number" step="0.1" placeholder="45" value={shoulderWidth} onChange={(e) => setShoulderWidth(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">허리둘레 (cm) - 선택</label>
            <input className="input" type="number" step="0.1" placeholder="30" value={waist} onChange={(e) => setWaist(e.target.value)} />
          </div>
        </div>

        {shoulderWidth && (
          <div className="card" style={{ marginBottom: 12, background: 'var(--bg-tertiary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13 }}>어깨 분류</span>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: type.color, letterSpacing: 1.5 }}>{type.emoji} {type.label}</span>
            </div>
            {ratio && ratioGrade && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13 }}>어깨:허리 비율</span>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1.5 }}>
                  <span style={{ color: ratioGrade.color }}>{ratio}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 6 }}>{ratioGrade.label}</span>
                </span>
              </div>
            )}
          </div>
        )}
        <button className="btn-primary" type="submit">측정 저장</button>
      </form>

      {diff && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 24 }}>
          <div className="stat-box"><div className="stat-number">{latestShoulder}</div><div className="stat-label">최근 (cm)</div></div>
          <div className="stat-box"><div className="stat-number">{oldestShoulder}</div><div className="stat-label">처음 (cm)</div></div>
          <div className="stat-box">
            <div className="stat-number" style={{ color: Number(diff) > 0 ? 'var(--success)' : Number(diff) < 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{Number(diff) > 0 ? '+' : ''}{diff}</div>
            <div className="stat-label">변화량</div>
          </div>
        </div>
      )}

      <div className="section-title"><div className="accent-bar" />측정 기록</div>
      {records.length === 0 ? (
        <div className="empty-state"><div className="empty-state-title">데이터 없음</div><div className="empty-state-desc">어깨 측정 기록이 없어요</div></div>
      ) : records.map((r) => {
        const t = getShoulderType(r.data?.shoulder);
        const rg = r.data?.ratio ? getRatioGrade(r.data.ratio) : null;
        return (
          <div key={r.id} className="card" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{r.date}</div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 13 }}>어깨 <strong style={{ color: t.color }}>{r.data?.shoulder}cm</strong></span>
                  {r.data?.waist && <span style={{ fontSize: 13 }}>허리 <strong>{r.data.waist}cm</strong></span>}
                  {r.data?.ratio && rg && <span style={{ fontSize: 13 }}>비율 <strong style={{ color: rg.color }}>{r.data.ratio}</strong></span>}
                </div>
              </div>
              <button className="delete-btn" onClick={() => onDelete(r.id)}>✕</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
