import { useMemo, useState } from 'react';
import { buildChange, SPANS, trainingIn } from '../data/bodyChange';

// 인바디 값이 **얼마나 달라졌나**.
//
// 절대값을 놓고 좋다 나쁘다 하지 않는다. 무엇이 어느 쪽으로 갔는지만 보여준다.
// 그래서 성별도 나이도 필요 없다.
//
// 기록이 하나뿐이면 아무것도 안 그린다 — 견줄 것이 없다.

const fmt = (n, digits = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(digits)}`;

// 늘고 줆에 좋고 나쁨을 매기지 않는다. 방향만 색으로 나눈다
const dirColor = (n) => (n > 0 ? 'var(--accent)' : n < 0 ? 'var(--info)' : 'var(--text-muted)');

function Row({ row, max }) {
  const width = max > 0 ? Math.min(48, (Math.abs(row.delta) / max) * 48) : 0;
  const color = dirColor(row.delta);
  return (
    <div className="card list-item" style={{ padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 68, fontSize: 13, color: 'var(--text-secondary)', flexShrink: 0 }}>{row.label}</div>

      {/* 가운데가 0. 왼쪽이 줄어든 것, 오른쪽이 늘어난 것 */}
      <div style={{ flexGrow: 1, position: 'relative', height: 18 }}>
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--border-hover)' }} />
        <div style={{
          position: 'absolute', top: 5, height: 8, borderRadius: 'var(--radius)',
          background: color,
          width: `${width}%`,
          ...(row.delta < 0 ? { right: '50%' } : { left: '50%' }),
        }} />
      </div>

      <div style={{ width: 66, textAlign: 'right', fontSize: 13.5, color, flexShrink: 0 }}>
        {fmt(row.delta, row.digits)}{row.unit}
      </div>
    </div>
  );
}

export default function BodyChange({ records, workouts }) {
  const [span, setSpan] = useState('last');
  const change = useMemo(() => buildChange(records, span), [records, span]);
  // 같은 기간에 운동을 얼마나 했나 — 시안 C 의 「그동안 운동은」이다
  const training = useMemo(
    () => (change ? trainingIn(workouts, change.from, change.to) : null),
    [workouts, change],
  );

  // 어느 기간으로도 견줄 것이 없으면 아예 안 그린다
  const any = useMemo(() => !!buildChange(records, 'last'), [records]);
  if (!any) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {SPANS.map(s => (
          <button
            key={s.key}
            className={`btn-secondary${span === s.key ? ' active' : ''}`}
            style={{ flexGrow: 1, padding: '8px 0' }}
            onClick={() => setSpan(s.key)}
          >{s.label}</button>
        ))}
      </div>

      {!change ? (
        <div className="card" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          이 기간에는 견줄 기록이 없어요.
        </div>
      ) : (
        <>
          <div className="card" style={{ borderColor: 'var(--accent)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {change.from.replace(/-/g, '. ')} → {change.to.replace(/-/g, '. ')}
              {change.days != null && <span style={{ color: 'var(--text-muted)' }}> · {change.days}일</span>}
            </div>
            {change.headline ? (
              <>
                <div style={{ fontSize: 16.5, color: 'var(--text-primary)', lineHeight: 1.6 }}>{change.headline.text}</div>
                {change.headline.sub && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{change.headline.sub}</div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                크게 달라진 것은 없어요.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {change.rows.map(r => <Row key={r.key} row={r} max={change.max} />)}
          </div>

          {/* 그동안 운동은 — 몸이 달라진 것 옆에 그동안 한 것을 같이 둔다.
              체중이 3kg 줄었다는 말 옆에 「38회」가 있는 것과 없는 것은 다르다.
              여기서도 좋고 나쁨은 안 매긴다 — 몇 번 했고 얼마를 들었는지만 센다 */}
          {training && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div className="label" style={{ marginBottom: 0 }}>그동안 운동은</div>
              <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                {training.spanDays}일간 <span style={{ color: 'var(--accent)' }}>{training.days}일</span> 나와서
                {' '}{training.count}번 적었어요
                {training.perWeek != null && <> · 주 {training.perWeek.toFixed(1)}일</>}
              </div>
              {training.volumeKg > 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  총 볼륨 {training.volumeKg >= 1000
                    ? `${(training.volumeKg / 1000).toFixed(1)}톤`
                    : `${training.volumeKg.toLocaleString()}kg`}
                  {' · 무게를 적은 것만 셉니다'}
                </div>
              )}
            </div>
          )}

          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.8 }}>
            좋고 나쁨을 매기지 않습니다. 무엇이 어느 쪽으로 갔는지만 보여드립니다.
          </div>
        </>
      )}
    </div>
  );
}
