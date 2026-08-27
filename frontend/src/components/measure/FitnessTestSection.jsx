import { useState } from 'react';
import { toast } from '../Toast';
import { dateKey } from '../../data/dateKey';

const FITNESS_TESTS = [
  { key: 'pushup', label: '푸시업 최대', unit: '개', placeholder: '30' },
  { key: 'pullup', label: '풀업 최대', unit: '개', placeholder: '10' },
  { key: 'plank', label: '플랭크 최대', unit: '초', placeholder: '120' },
  { key: 'run_1km', label: '1km 달리기', unit: '초', placeholder: '300' },
  { key: 'situp', label: '윗몸일으키기 1분', unit: '개', placeholder: '40' },
  { key: 'squat_max', label: '스쿼트 최대', unit: '개', placeholder: '50' },
];

// 날짜와 지우기.
//
// 이 도구는 **날짜 칸이 없었다.** 어제 잰 것을 오늘 적으면 오늘 날짜로 들어갔다
// (측정 화면이 date 가 없으면 오늘을 넣는다). 다른 도구들은 다 날짜를 받는다.
//
// **지우기도 없었다.** 측정 화면에 삭제 기능이 이미 있는데 이 도구에는 안 넘겨줘서,
// 한 번 잘못 적으면 영영 남았다. 일곱 도구 중 체력 테스트와 유연성만 그랬다.
export default function FitnessTestSection({ records, onSave, onDelete }) {
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
      <div className="section-title"><div className="accent-bar" />체력 테스트</div>
      <label className="label">날짜</label>
      <input className="input" type="date" value={date} max={dateKey()} onChange={(e) => setDate(e.target.value)} style={{ marginBottom: 12 }} />
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

      {(all ? records : records.slice(0, 3)).map(r => (
        <div key={r.id} className="card" style={{ marginBottom: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.date}</span>
            {onDelete && <button className="delete-btn" onClick={() => onDelete(r.id)}>✕</button>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {FITNESS_TESTS.map(f => r.data?.[f.key] && (
              <span key={f.key} style={{ fontSize: 12 }}>{f.label} <strong style={{ color: 'var(--accent)' }}>{r.data[f.key]}{f.unit}</strong></span>
            ))}
          </div>
        </div>
      ))}
      {/* 세 개만 보여주고 끝이었다 — 넷째부터는 볼 수도 지울 수도 없었다 */}
      {records.length > 3 && (
        <button className="btn-secondary" onClick={() => setAll(v => !v)} style={{ marginTop: 4 }}>
          {all ? '접기' : `지난 기록 ${records.length - 3}건 더 보기`}
        </button>
      )}
    </div>
  );
}
