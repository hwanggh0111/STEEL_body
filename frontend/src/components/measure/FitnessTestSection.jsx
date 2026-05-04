import { useState } from 'react';
import { toast } from '../Toast';

const FITNESS_TESTS = [
  { key: 'pushup', label: '푸시업 최대', unit: '개', placeholder: '30' },
  { key: 'pullup', label: '풀업 최대', unit: '개', placeholder: '10' },
  { key: 'plank', label: '플랭크 최대', unit: '초', placeholder: '120' },
  { key: 'run_1km', label: '1km 달리기', unit: '초', placeholder: '300' },
  { key: 'situp', label: '윗몸일으키기 1분', unit: '개', placeholder: '40' },
  { key: 'squat_max', label: '스쿼트 최대', unit: '개', placeholder: '50' },
];

export default function FitnessTestSection({ records, onSave }) {
  const [values, setValues] = useState({});

  const handleSave = () => {
    const filled = Object.entries(values).filter(([, v]) => v);
    if (filled.length === 0) { toast('최소 1개 항목을 입력해주세요'); return; }
    onSave({ ...values });
    setValues({});
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="section-title"><div className="accent-bar" />체력 테스트</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
        {FITNESS_TESTS.map(f => (
          <div key={f.key}>
            <label className="label">{f.label} ({f.unit})</label>
            <input className="input" type="number" placeholder={f.placeholder}
              value={values[f.key] || ''} onChange={e => setValues({ ...values, [f.key]: e.target.value })}
              style={{ fontSize: 13 }} />
          </div>
        ))}
      </div>
      <button className="btn-primary" onClick={handleSave} style={{ marginBottom: 12 }}>기록 저장</button>

      {records.slice(0, 3).map(r => (
        <div key={r.id} className="card" style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{r.date}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {FITNESS_TESTS.map(f => r.data?.[f.key] && (
              <span key={f.key} style={{ fontSize: 12 }}>{f.label} <strong style={{ color: 'var(--accent)' }}>{r.data[f.key]}{f.unit}</strong></span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
