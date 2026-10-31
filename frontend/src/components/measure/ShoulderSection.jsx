import { useState } from 'react';
import { toast } from '../Toast';
import { useRecordDate } from '../../data/useRecordDate';
import { BODY_CM_MAX } from '../../data/measureRange';

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
//
// ── 칸에 테두리가 없었다 ── (2026-10-31에 고쳤다)
//
//   · **허리둘레에 0 을 넣으면 「어깨 : 허리 Infinity」**를 적었고 **저장까지** 됐다.
//     JSON 에 담을 때 `Infinity` 는 `null` 이 되니, 담긴 뒤에는 **왜 빈 칸인지도
//     알 수 없다** — 되돌릴 길이 없는 값이다
//   · **음수 둘이면 비율이 양수로 나온다** — 「−45 / −30 = 1.50」. 말이 되는 값처럼
//     보이는 것이 더 나쁘다. 눈으로는 영영 안 잡힌다
//
// 서버도 값의 범위를 안 봤다(10/31 에 `utils/measureRange.js` 로 넣었다).

export default function ShoulderSection({ records, onSave, onDelete }) {
  // 날짜 칸은 **한 곳에서 온다** (`data/useRecordDate.js`). 여기가 2026-09-30에
  // 아래 테두리를 처음 건 자리인데, 그 교훈이 옆 칸 셋에는 안 가 있었다 —
  // 이제 넷이 같은 자리를 지난다
  const { date, pick: pickDate, today, min: minDay } = useRecordDate();
  const [shoulderWidth, setShoulderWidth] = useState('');
  const [waist, setWaist] = useState('');

  // **둘 다 테두리 안일 때만 나눈다.** 0 으로 나누면 `Infinity` 고, 음수 둘이면
  // 양수가 나와 **말이 되는 값처럼 보인다**
  const sane = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 && n <= BODY_CM_MAX ? n : null;
  };
  const sw = sane(shoulderWidth);
  const wa = sane(waist);
  const ratio = sw && wa ? (sw / wa).toFixed(2) : null;

  const handleSave = (e) => {
    e.preventDefault();
    if (!shoulderWidth) { toast('어깨 너비를 입력해주세요'); return; }
    // **테두리를 벗어난 값은 담지 않는다** — 서버가 거절하는 그 수를 여기서 말한다
    if (sw === null) { toast(`어깨 너비는 1~${BODY_CM_MAX}cm 로 적어주세요`, 'error'); return; }
    if (String(waist).trim() && wa === null) { toast(`허리둘레는 1~${BODY_CM_MAX}cm 로 적어주세요`, 'error'); return; }
    onSave({ date, shoulder: sw, waist: wa, ratio: ratio ? Number(ratio) : null });
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
        <div style={{ fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif", fontSize: 14, letterSpacing: 1.5, color: 'var(--accent)', marginBottom: 6 }}>측정 방법</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          1. 줄자를 준비하세요<br />
          2. 왼쪽 어깨 끝(견봉) → 오른쪽 어깨 끝(견봉)까지 측정<br />
          3. 등 뒤로 줄자를 돌리지 말고 일직선으로 측정<br />
          4. 허리둘레는 배꼽 높이에서 측정 (선택)
        </div>
      </div>

      <form onSubmit={handleSave} style={{ marginBottom: 24 }}>
        <label className="label">날짜</label>
        {/* **테두리를 건다** (2026-09-30). 이 칸만 위아래가 열려 있었다 — 사이즈 ·
            체력 · 유연성 칸은 다 `max` 가 걸려 있는데 여기만 빠져 있었다.
            앞날을 고르거나 연도를 잘못 치면(2026 대신 1026) 서버가 막지만, 사람에게는
            **까닭 없는 실패**로 보인다. 아래 테두리도 같이 건다 —
            `max` 만 걸면 연도는 직접 칠 수 있다(`TrainPage` 에서 겪은 것) */}
        <input
          className="input"
          type="date"
          value={date}
          max={today}
          min={minDay}
          onChange={(e) => pickDate(e.target.value)}
          style={{ marginBottom: 10 }}
        />
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="label">어깨 너비 (cm)</label>
            <input className="input" type="number" step="0.1" min="1" max={BODY_CM_MAX}
              placeholder="45" value={shoulderWidth} onChange={(e) => setShoulderWidth(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">허리둘레 (cm) - 선택</label>
            <input className="input" type="number" step="0.1" min="1" max={BODY_CM_MAX}
              placeholder="30" value={waist} onChange={(e) => setWaist(e.target.value)} />
          </div>
        </div>

        {/* 비율만 적는다. 「이상적」 · 「개선 필요」는 붙이지 않는다 —
            키도 성별도 모르면서 어느 값이 좋다고 말할 수 없다 */}
        {ratio && (
          <div className="card" style={{ marginBottom: 12, background: 'var(--bg-tertiary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13 }}>어깨 : 허리</span>
              <span style={{ fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif", fontSize: 18, letterSpacing: 1.5, color: 'var(--accent)' }}>
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
