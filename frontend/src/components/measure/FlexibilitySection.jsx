import { useState } from 'react';
import { toast } from '../Toast';

const FLEX_FIELDS = [
  { key: 'sitreach', label: '앉아 앞으로 굽히기', unit: 'cm', placeholder: '15', desc: '다리 펴고 앉아서 손끝이 발끝을 넘는 거리' },
  { key: 'shoulder_l', label: '왼쪽 어깨 유연성', unit: 'cm', placeholder: '5', desc: '등 뒤에서 양손 사이 거리 (0이면 닿음)' },
  { key: 'shoulder_r', label: '오른쪽 어깨 유연성', unit: 'cm', placeholder: '5', desc: '등 뒤에서 양손 사이 거리' },
  { key: 'squat_depth', label: '스쿼트 깊이', unit: 'cm', placeholder: '0', desc: '엉덩이가 무릎 아래로 내려간 거리 (0=평행)' },
];

export default function FlexibilitySection({ records, onSave }) {
  const [values, setValues] = useState({});

  const handleSave = () => {
    const filled = Object.entries(values).filter(([, v]) => v);
    if (filled.length === 0) { toast('최소 1개 항목을 입력해주세요'); return; }
    onSave({ ...values });
    setValues({});
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="section-title"><div className="accent-bar" />유연성 측정</div>
      {FLEX_FIELDS.map(f => (
        <div key={f.key} style={{ marginBottom: 8 }}>
          <label className="label">{f.label} ({f.unit})</label>
          <input className="input" type="number" step="0.1" placeholder={f.placeholder}
            value={values[f.key] || ''} onChange={e => setValues({ ...values, [f.key]: e.target.value })} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{f.desc}</div>
        </div>
      ))}
      <button className="btn-primary" onClick={handleSave} style={{ marginBottom: 12 }}>기록 저장</button>

      {records.slice(0, 3).map(r => (
        <div key={r.id} className="card" style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{r.date}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {FLEX_FIELDS.map(f => r.data?.[f.key] && (
              <span key={f.key} style={{ fontSize: 12 }}>{f.label} <strong style={{ color: 'var(--accent)' }}>{r.data[f.key]}{f.unit}</strong></span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
