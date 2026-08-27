import { useState } from 'react';
import { toast } from '../Toast';
import { dateKey } from '../../data/dateKey';

// 어깨 측정.
//
// 8/25 에 인바디 「신체 분석」을 다시 만들면서 **몸에 등급을 매기지 않기로** 했다.
// 그런데 여기는 그대로였다 —
//
//   · 어깨 너비에 이름표를 붙였다: 「좁은 어깨」 · 「보통 어깨」 · 「문짝 어깨」.
//     게다가 넓은 쪽에 **danger 색(빨강)**을 칠했다. 넓으면 위험하다는 뜻으로 읽힌다
//   · 어깨:허리 비율에 **「역삼각형 (이상적)」 · 「좋은 비율」 · 「개선 필요」** 를 붙였다.
//     함수 이름부터 `getRatioGrade` 였다. 인바디에서 걷어낸 「개선이 많이 필요해요」와
//     같은 말이다
//   · **키도 성별도 안 받는다.** 어깨 42cm 는 키 160 과 185 에서 전혀 다른 값이다.
//     인바디에서 「성별을 안 받으면서 판정했다」고 지적한 것과 같은 구조다
//
// 재는 도구는 재기만 한다. **숫자와 변화만 보여주고 좋고 나쁨은 매기지 않는다.**
// 비율이 무엇을 뜻하는지는 한 줄로 적어두되, 어느 값이 좋다고는 말하지 않는다.

export default function ShoulderSection({ records, onSave, onDelete }) {
  const today = dateKey();
  const [date, setDate] = useState(today);
  const [shoulderWidth, setShoulderWidth] = useState('');
  const [waist, setWaist] = useState('');

  const ratio = shoulderWidth && waist ? (Number(shoulderWidth) / Number(waist)).toFixed(2) : null;

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

        {/* 비율만 적는다. 「이상적」 · 「개선 필요」는 붙이지 않는다 —
            키도 성별도 모르면서 어느 값이 좋다고 말할 수 없다 */}
        {ratio && (
          <div className="card" style={{ marginBottom: 12, background: 'var(--bg-tertiary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13 }}>어깨 : 허리</span>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1.5, color: 'var(--accent)' }}>
                {ratio}
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.6 }}>
              어깨 너비를 허리둘레로 나눈 값입니다. 좋고 나쁨은 매기지 않습니다 —
              같은 값이라도 키에 따라 다르게 보입니다. <b style={{ color: 'var(--text-secondary)' }}>내 지난 값과 견주세요.</b>
            </div>
          </div>
        )}
        <button className="btn-primary" type="submit">측정 저장</button>
      </form>

      {diff && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 24 }}>
          <div className="stat-box"><div className="stat-number">{latestShoulder}</div><div className="stat-label">최근 (cm)</div></div>
          <div className="stat-box"><div className="stat-number">{oldestShoulder}</div><div className="stat-label">처음 (cm)</div></div>
          <div className="stat-box">
            {/* 늘고 줆에 좋고 나쁨을 안 매긴다. 방향만 색으로 나눈다
                (인바디 「얼마나 달라졌나」와 같은 규칙) */}
            <div className="stat-number" style={{ color: Number(diff) > 0 ? 'var(--accent)' : Number(diff) < 0 ? 'var(--info)' : 'var(--text-muted)' }}>{Number(diff) > 0 ? '+' : ''}{diff}</div>
            <div className="stat-label">변화량</div>
          </div>
        </div>
      )}

      <div className="section-title"><div className="accent-bar" />측정 기록</div>
      {records.length === 0 ? (
        <div className="empty-state"><div className="empty-state-title">데이터 없음</div><div className="empty-state-desc">어깨 측정 기록이 없어요</div></div>
      ) : records.map((r) => {
        return (
          <div key={r.id} className="card" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{r.date}</div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 13 }}>어깨 <strong style={{ color: 'var(--text-primary)' }}>{r.data?.shoulder}cm</strong></span>
                  {r.data?.waist && <span style={{ fontSize: 13 }}>허리 <strong>{r.data.waist}cm</strong></span>}
                  {r.data?.ratio && <span style={{ fontSize: 13 }}>비율 <strong style={{ color: 'var(--accent)' }}>{r.data.ratio}</strong></span>}
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
