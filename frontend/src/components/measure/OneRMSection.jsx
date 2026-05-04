import { useState } from 'react';
import { toast } from '../Toast';

export default function OneRMSection({ records, onSave }) {
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [result, setResult] = useState(null);

  const calc1RM = () => {
    if (!weight || !reps) return;
    const w = Number(weight);
    const r = Number(reps);
    if (r < 1 || r > 36) { toast('횟수는 1~36 범위여야 해요', 'error'); return; }
    if (r > 10) { toast('10회 초과 시 정확도가 낮아요', 'warning'); }
    // Brzycki 공식
    const orm = r === 1 ? w : Math.round(w * (36 / (37 - r)));
    setResult(orm);
  };

  const handleSave = (exercise) => {
    if (!result) return;
    onSave({ exercise, weight: Number(weight), reps: Number(reps), orm: result });
    toast(`${exercise} 1RM ${result}kg 저장!`);
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="section-title"><div className="accent-bar" />1RM 계산기</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>무게와 횟수(1~10회)를 입력하면 예상 1RM을 계산합니다 (Brzycki 공식, 10회 이하에서 정확)</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <label className="label">무게 (kg)</label>
          <input className="input" type="number" placeholder="80" value={weight} onChange={e => { setWeight(e.target.value); setResult(null); }} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="label">횟수</label>
          <input className="input" type="number" placeholder="5" value={reps} onChange={e => { setReps(e.target.value); setResult(null); }} />
        </div>
      </div>
      <button className="btn-primary" onClick={calc1RM} style={{ marginBottom: 10 }}>계산</button>

      {result && (
        <div className="card" style={{ marginBottom: 12, textAlign: 'center', borderColor: 'var(--accent)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>예상 1RM</div>
          <div className="stat-number" style={{ fontSize: 40 }}>{result}<span style={{ fontSize: 16, color: 'var(--text-muted)' }}>kg</span></div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
            {['벤치프레스', '스쿼트', '데드리프트', '숄더프레스'].map(ex => (
              <button key={ex} className="btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={() => handleSave(ex)}>{ex}로 저장</button>
            ))}
          </div>
        </div>
      )}

      {records.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>기록</div>
          {records.slice(0, 5).map(r => (
            <div key={r.id} className="card" style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1 }}>{r.data?.exercise}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{r.data?.weight}kg × {r.data?.reps}회</span>
              </div>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: 'var(--accent)' }}>{r.data?.orm}kg</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
