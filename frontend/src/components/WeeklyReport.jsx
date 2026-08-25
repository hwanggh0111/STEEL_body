import { useMemo } from 'react';
import { buildWeekly } from '../data/weeklyReport';

// 이번 주 요약.
//
// 홈의 「이번 주 운동」 달력 바로 아래에 붙는다. 달력이 **어느 날** 했는지를 보여주니,
// 여기서는 **얼마나** 했는지만 말한다 — 같은 주를 두 번 그리지 않는다.
//
// 기록이 없으면 아예 안 그린다. 빈 화면에 0을 세 개 띄워두면 아무 말도 안 하면서
// 자리만 먹는다.

const PART_MAX = 4;

function Bar({ label, ratio, warn }) {
  const color = warn ? 'var(--warning)' : 'var(--accent)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 44, fontSize: 13, color: warn ? color : 'var(--text-secondary)', flexShrink: 0 }}>{label}</div>
      <div className="progress-bg" style={{ flexGrow: 1 }}>
        <div className="progress-fill" style={{ width: `${Math.round(ratio * 100)}%`, background: color }} />
      </div>
      <div style={{ width: 36, textAlign: 'right', fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
        {Math.round(ratio * 100)}%
      </div>
    </div>
  );
}

export default function WeeklyReport({ workouts }) {
  const r = useMemo(() => buildWeekly(workouts), [workouts]);

  if (r.empty) return null;

  const tons = r.volume.kg >= 1000
    ? `${(r.volume.kg / 1000).toFixed(1)}`
    : null;

  const diff = r.daysDone - r.prevDays;
  const maxWeekDays = Math.max(1, ...r.last4.map(w => w.days));

  return (
    <>
      <div className="section-title">
        <div className="accent-bar" />
        이번 주 요약
      </div>

      <div className="card" style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {r.from.slice(5).replace('-', '월 ')}일 — {r.to.slice(5).replace('-', '월 ')}일
          </div>
          {diff !== 0 && (
            <span className={`badge ${diff > 0 ? 'badge-success' : 'badge-warning'}`}>
              지난주보다 {diff > 0 ? '+' : ''}{diff}일
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          <div className="stat-box">
            <div className="stat-number">{r.daysDone}</div>
            <div className="stat-label">운동한 날</div>
          </div>
          <div className="stat-box">
            <div className="stat-number">{tons ?? r.volume.kg}</div>
            <div className="stat-label">{tons ? '총 볼륨(톤)' : '총 볼륨(kg)'}</div>
          </div>
          <div className="stat-box">
            <div className="stat-number">{r.streak}</div>
            <div className="stat-label">주 연속</div>
          </div>
        </div>

        {/* 맨몸은 볼륨에 못 넣는다 — 체중을 모른다. 숨기지 말고 그렇다고 적어둔다 */}
        {r.volume.bodyweightSets > 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: -8 }}>
            볼륨은 무게를 적은 것만 셉니다. 맨몸 {r.volume.bodyweightSets}세트는 빠져 있어요.
          </div>
        )}

        {r.parts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="label" style={{ marginBottom: 0 }}>부위 분포</div>
            {r.parts.slice(0, PART_MAX).map(p => (
              <Bar key={p.part} label={p.part} ratio={p.ratio} warn={p.part === '기타'} />
            ))}
          </div>
        )}

        {r.notes.length > 0 && (
          <div style={{
            borderLeft: '3px solid var(--warning)',
            paddingLeft: 12,
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            {r.notes.map((n, i) => (
              <div key={i} style={{ fontSize: 13.5, color: i === 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{n}</div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="label" style={{ marginBottom: 0 }}>지난 4주</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 56 }}>
            {r.last4.map(w => (
              <div key={w.from} style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: '100%',
                  height: Math.max(4, Math.round((w.days / maxWeekDays) * 40)),
                  background: w.current ? 'var(--accent)' : 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius)',
                }} />
                <div style={{ fontSize: 10, color: w.current ? 'var(--accent)' : 'var(--text-muted)' }}>{w.days}일</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}
