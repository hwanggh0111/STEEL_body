import { useState } from 'react';
import { toast } from '../Toast';
import { dateKey } from '../../data/dateKey';
import { changeOf } from '../../data/measureChange';
import ChangeSummary from './ChangeSummary';

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

// 전신 사이즈.
//
// 날짜 칸이 없었다 — 어제 잰 것을 오늘 적으면 오늘 날짜로 들어갔다 (8/27 에 넣었다).
//
// **적기만 하고 달라진 것을 안 말했다** (2026-09-02 에 고쳤다). 줄자로 재는 이유는
// 달라졌는지 보려는 것인데, 목록에 숫자만 쌓여서 **위아래를 번갈아 보며 직접 빼야**
// 했다. 적는 칸 밑에 지난 값을 적고, 목록 위에 「지난번과 견주면」을 둔다.
//
// **몸에는 좋고 나쁨을 매기지 않는다** — 허리가 늘었다고 「나쁨」이라 하지 않는다.
// 늘어난 것과 줄어든 것만 색으로 나눈다 (8/25 에 정한 규칙이다).
export default function BodySizeSection({ records, onSave, onDelete }) {
  const [values, setValues] = useState({});
  const [openIdx, setOpenIdx] = useState(null);
  const [date, setDate] = useState(dateKey());

  const handleSave = () => {
    const filled = Object.entries(values).filter(([, v]) => v);
    if (filled.length === 0) { toast('최소 1개 항목을 입력해주세요'); return; }
    onSave({ ...values, date });
    setValues({});
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="section-title"><div className="accent-bar" />전신 사이즈 측정</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>줄자로 각 부위의 둘레를 측정하세요</div>
      <label className="label">날짜</label>
      <input className="input" type="date" value={date} max={dateKey()} onChange={(e) => setDate(e.target.value)} style={{ marginBottom: 12 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 6, marginBottom: 10 }}>
        {SIZE_FIELDS.map(f => {
          const ch = changeOf(records, f.key);
          return (
            <div key={f.key}>
              <label className="label">{f.label}</label>
              <input className="input" type="number" step="0.1" placeholder={f.placeholder}
                value={values[f.key] || ''} onChange={e => setValues({ ...values, [f.key]: e.target.value })}
                style={{ fontSize: 13 }} />
              {/* **적는 자리에서 지난 값을 보여준다.** 저장하고 나서야 견줄 수 있으면
                  줄자를 들고 있는 동안에는 이번이 늘었는지 줄었는지 모른다 */}
              {ch && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  지난번 {ch.last}{f.unit}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button className="btn-primary" onClick={handleSave} style={{ marginBottom: 12 }}>측정 저장</button>

      <ChangeSummary records={records} fields={SIZE_FIELDS} />

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
