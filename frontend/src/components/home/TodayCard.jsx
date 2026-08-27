import { useNavigate } from 'react-router-dom';
import { volumeOf } from '../../data/weeklyReport';
import { bodyPartOf } from '../../data/bodyPart';

// 오늘 한 장.
//
// 홈이 매일 여는 화면인데 **하던 것을 몰랐다.** 루틴을 시작해두고 홈에 오면
// 진행표는 기록 화면에만 있어서, 홈은 「아직 오늘 운동 기록이 없어요」라고 했다.
// 시작해둔 사람에게 시작하라고 말하고 있었던 것이다.
//
// 그래서 이 카드는 **지금 무엇을 할 차례인지 하나만** 말한다. 순서가 곧 우선순위다.
//
//   1. 하던 루틴이 있다        → 이어서 하기
//   2. 오늘 기록이 있다        → 오늘 한 것 + 더 기록하기
//   3. 만들어둔 루틴이 있다    → 그 루틴으로 바로 시작
//   4. 아무것도 없다          → 기록하기 · 루틴 만들기
//
// 3번에서 루틴을 곧바로 시작해도 「하던 걸 바꿀까요」를 묻지 않는다. 하던 것이 있으면
// 1번에서 갈라져 여기까지 오지 않기 때문이다.

const ROUTINE_PICKS = 3;

function Line({ children }) {
  return <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{children}</div>;
}

export default function TodayCard({ session, todayWorkouts, myRoutines, onStartRoutine, starting }) {
  const navigate = useNavigate();

  // ─── 1. 하던 루틴 ───
  if (session) {
    const pct = session.total ? Math.round((session.done / session.total) * 100) : 0;
    const current = session.current >= 0 ? session.items?.[session.current] : null;
    return (
      <div className="card" style={{
        marginBottom: 20, borderColor: 'var(--accent)',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{session.name}</div>
          <span className="badge badge-accent" style={{ flexShrink: 0 }}>진행 중</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <div className="label" style={{ marginBottom: 0 }}>{session.done} / {session.total} 완료</div>
          {current && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              다음 · {current.name}
            </div>
          )}
        </div>

        <div className="progress-bg">
          <div className="progress-fill" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
        </div>

        <button className="btn-primary" onClick={() => navigate('/workout')}>이어서 하기</button>
      </div>
    );
  }

  // ─── 2. 오늘 기록 ───
  if (todayWorkouts.length > 0) {
    const sets = todayWorkouts.reduce((n, w) => n + (Number(w.sets) || 0), 0);
    const { kg } = volumeOf(todayWorkouts);
    const parts = [...new Set(todayWorkouts.map(w => bodyPartOf(w.exercise)))];
    return (
      <div className="card" style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 2, color: 'var(--accent)' }}>
            오늘 {todayWorkouts.length}개
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {sets}세트{kg > 0 ? ` · ${kg.toLocaleString()}kg` : ''}
          </span>
        </div>

        {parts.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {parts.map(p => (
              <span key={p} style={{
                fontSize: 11.5, padding: '2px 8px', borderRadius: 'var(--radius)',
                border: '1px solid var(--border)', background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
              }}>{p}</span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {todayWorkouts.map(w => (
            <div key={w.id} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {w.exercise} — {w.weight} · {w.sets}세트 · {w.reps}회
            </div>
          ))}
        </div>

        <button className="btn-secondary" onClick={() => navigate('/workout')}>기록 더하기</button>
      </div>
    );
  }

  // ─── 3. 만들어둔 루틴 ───
  if (myRoutines.length > 0) {
    return (
      <div className="card" style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Line>오늘은 아직 기록이 없어요. 만들어둔 루틴으로 바로 시작할 수 있어요.</Line>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {myRoutines.slice(0, ROUTINE_PICKS).map(r => {
            const id = r.id ?? r._id;
            const count = Array.isArray(r.exercises) ? r.exercises.length : 0;
            return (
              <button
                key={id}
                onClick={() => onStartRoutine(r)}
                disabled={starting}
                className="card clickable"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  padding: '12px 14px', background: 'var(--bg-primary)', textAlign: 'left',
                  fontFamily: "'Barlow', sans-serif", cursor: starting ? 'wait' : 'pointer',
                }}
              >
                <span style={{
                  fontSize: 14, color: 'var(--text-primary)', minWidth: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{r.name}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {count > 0 ? `${count}개 · 시작 ›` : '시작 ›'}
                </span>
              </button>
            );
          })}
        </div>
        <button className="btn-secondary" onClick={() => navigate('/workout')}>루틴 없이 기록하기</button>
      </div>
    );
  }

  // ─── 4. 아무것도 없음 ───
  return (
    <div className="card" style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Line>
        오늘은 아직 기록이 없어요.<br />
        루틴을 만들어두면 다음부터는 순서를 따라가며 기록할 수 있어요.
      </Line>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-primary" style={{ flexGrow: 1 }} onClick={() => navigate('/workout')}>운동 기록하기</button>
        <button className="btn-secondary" style={{ flexGrow: 1 }} onClick={() => navigate('/routine')}>루틴 만들기</button>
      </div>
    </div>
  );
}
