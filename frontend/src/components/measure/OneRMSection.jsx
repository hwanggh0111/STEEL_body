import { useState } from 'react';
import { toast } from '../Toast';
import { estimate1RM, RM_MAX_REPS } from '../../data/personalRecord';

// 계산 기록도 지울 수 없었다 — 측정 화면에 삭제가 있는데 안 넘겨줬다.
// 날짜는 안 받는다. 지금 계산해서 그 자리에 저장하는 것이라 오늘이 맞다
export default function OneRMSection({ records, onSave, onDelete }) {
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [result, setResult] = useState(null);

  const calc1RM = () => {
    if (!weight || !reps) return;
    const w = Number(weight);
    const r = Number(reps);
    if (r < 1 || r > RM_MAX_REPS) { toast(`횟수는 1~${RM_MAX_REPS} 범위여야 해요`, 'error'); return; }
    if (r > 10) { toast('10회 초과 시 정확도가 낮아요', 'warning'); }
    // 식은 data/personalRecord.js 한 곳에 있다. 최고 기록 판정도 같은 것을 쓴다
    const orm = estimate1RM(w, r);
    if (orm === null) { toast('계산할 수 없는 값이에요', 'error'); return; }
    setResult(orm);
  };

  // 알리는 것은 측정 화면(onSave)이 한다.
  //
  // 여기서 또 띄우면 토스트가 두 번 뜨고, **서버 저장이 실패해도 「저장!」이 먼저**
  // 번쩍인다 — onSave 는 async 인데 await 없이 부르고 있었다.
  const handleSave = (exercise) => {
    if (!result) return;
    onSave({ exercise, weight: Number(weight), reps: Number(reps), orm: result });
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: 'var(--accent)' }}>{r.data?.orm}kg</span>
                {onDelete && <button className="delete-btn" onClick={() => onDelete(r.id)}>✕</button>}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
