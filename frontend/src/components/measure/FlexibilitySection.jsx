import { useState } from 'react';
import { toast } from '../Toast';
import { dateKey } from '../../data/dateKey';
import { changeOf } from '../../data/measureChange';
import ChangeSummary from './ChangeSummary';

const FLEX_FIELDS = [
  { key: 'sitreach', label: '앉아 앞으로 굽히기', unit: 'cm', placeholder: '15', desc: '다리 펴고 앉아서 손끝이 발끝을 넘는 거리' },
  { key: 'shoulder_l', label: '왼쪽 어깨 유연성', unit: 'cm', placeholder: '5', desc: '등 뒤에서 양손 사이 거리 (0이면 닿음)' },
  { key: 'shoulder_r', label: '오른쪽 어깨 유연성', unit: 'cm', placeholder: '5', desc: '등 뒤에서 양손 사이 거리' },
  { key: 'squat_depth', label: '스쿼트 깊이', unit: 'cm', placeholder: '0', desc: '엉덩이가 무릎 아래로 내려간 거리 (0=평행)' },
];

// 유연성.
//
// 체력 테스트와 같은 이유로 **날짜 칸과 지우기**를 넣었다 (8/27). 일곱 도구 중 이 둘만
// 날짜를 안 받고 지울 수도 없었다.
//
// 그리고 **적기만 하고 달라진 것을 안 말했다** (2026-09-02 에 고쳤다).
// 유연성은 몇 주에 걸쳐 조금씩 달라지는 것이라, 지난 값 없이 오늘 숫자만 보면
// 늘었는지 줄었는지 알 길이 없다.
//
// **몸에는 좋고 나쁨을 매기지 않는다** — 방향만 말한다 (`ChangeSummary`).
export default function FlexibilitySection({ records, onSave, onDelete }) {
  const [values, setValues] = useState({});
  const [date, setDate] = useState(dateKey());
  const [all, setAll] = useState(false);

  const handleSave = () => {
    const filled = Object.entries(values).filter(([, v]) => v);
    if (filled.length === 0) { toast('최소 1개 항목을 입력해주세요'); return; }
    onSave({ ...values, date });
    setValues({});
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="section-title"><div className="accent-bar" />유연성 측정</div>
      <label className="label">날짜</label>
      <input className="input" type="date" value={date} max={dateKey()} onChange={(e) => setDate(e.target.value)} style={{ marginBottom: 12 }} />
      {FLEX_FIELDS.map(f => {
        const ch = changeOf(records, f.key);
        return (
          <div key={f.key} style={{ marginBottom: 8 }}>
            <label className="label">{f.label} ({f.unit})</label>
            <input className="input" type="number" step="0.1" placeholder={f.placeholder}
              value={values[f.key] || ''} onChange={e => setValues({ ...values, [f.key]: e.target.value })} />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.6 }}>
              {f.desc}
              {/* 적는 자리에서 지난 값을 보여준다 — 몇 주에 걸쳐 조금씩 달라지는 것이라
                  지난 값 없이 오늘 숫자만 보면 늘었는지 줄었는지 알 길이 없다 */}
              {ch && <span> · 지난번 {ch.last}{f.unit}</span>}
            </div>
          </div>
        );
      })}
      <button className="btn-primary" onClick={handleSave} style={{ marginBottom: 12 }}>기록 저장</button>

      <ChangeSummary records={records} fields={FLEX_FIELDS} />

      {(all ? records : records.slice(0, 3)).map(r => (
        <div key={r.id} className="card" style={{ marginBottom: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.date}</span>
            {onDelete && <button className="delete-btn" onClick={() => onDelete(r.id)}>✕</button>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {FLEX_FIELDS.map(f => r.data?.[f.key] && (
              <span key={f.key} style={{ fontSize: 12 }}>{f.label} <strong style={{ color: 'var(--accent)' }}>{r.data[f.key]}{f.unit}</strong></span>
            ))}
          </div>
        </div>
      ))}
      {records.length > 3 && (
        <button className="btn-secondary" onClick={() => setAll(v => !v)} style={{ marginTop: 4 }}>
          {all ? '접기' : `지난 기록 ${records.length - 3}건 더 보기`}
        </button>
      )}
    </div>
  );
}
