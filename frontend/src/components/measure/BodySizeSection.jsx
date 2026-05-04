import { useState } from 'react';
import { toast } from '../Toast';

const SIZE_FIELDS = [
  { key: 'chest', label: '가슴둘레', unit: 'cm', placeholder: '95' },
  { key: 'waist', label: '허리둘레', unit: 'cm', placeholder: '78' },
  { key: 'hip', label: '엉덩이둘레', unit: 'cm', placeholder: '95' },
  { key: 'arm_l', label: '왼팔둘레', unit: 'cm', placeholder: '35' },
  { key: 'arm_r', label: '오른팔둘레', unit: 'cm', placeholder: '35' },
  { key: 'thigh_l', label: '왼허벅지', unit: 'cm', placeholder: '55' },
  { key: 'thigh_r', label: '오른허벅지', unit: 'cm', placeholder: '55' },
  { key: 'calf', label: '종아리둘레', unit: 'cm', placeholder: '38' },
  { key: 'neck', label: '목둘레', unit: 'cm', placeholder: '38' },
];

export default function BodySizeSection({ records, onSave, onDelete }) {
  const [values, setValues] = useState({});
  const [openIdx, setOpenIdx] = useState(null);

  const handleSave = () => {
    const filled = Object.entries(values).filter(([, v]) => v);
    if (filled.length === 0) { toast('최소 1개 항목을 입력해주세요'); return; }
    onSave({ ...values });
    setValues({});
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="section-title"><div className="accent-bar" />전신 사이즈 측정</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>줄자로 각 부위의 둘레를 측정하세요</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 6, marginBottom: 10 }}>
        {SIZE_FIELDS.map(f => (
          <div key={f.key}>
            <label className="label">{f.label}</label>
            <input className="input" type="number" step="0.1" placeholder={f.placeholder}
              value={values[f.key] || ''} onChange={e => setValues({ ...values, [f.key]: e.target.value })}
              style={{ fontSize: 13 }} />
          </div>
        ))}
      </div>
      <button className="btn-primary" onClick={handleSave} style={{ marginBottom: 12 }}>측정 저장</button>

      {records.map((r, i) => (
        <div key={r.id} className="card" style={{ marginBottom: 6, cursor: 'pointer', borderColor: openIdx === i ? 'var(--accent)' : 'var(--border)' }}
          onClick={() => setOpenIdx(openIdx === i ? null : i)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.date}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {r.data?.chest && <span style={{ fontSize: 12 }}>가슴 <strong style={{ color: 'var(--accent)' }}>{r.data.chest}</strong></span>}
              {r.data?.arm_r && <span style={{ fontSize: 12 }}>팔 <strong>{r.data.arm_r}</strong></span>}
              <button className="delete-btn" onClick={(e) => { e.stopPropagation(); onDelete(r.id); }}>✕</button>
            </div>
          </div>
          {openIdx === i && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {SIZE_FIELDS.map(f => r.data?.[f.key] && (
                <span key={f.key} style={{ fontSize: 12 }}>{f.label} <strong>{r.data[f.key]}{f.unit}</strong></span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
