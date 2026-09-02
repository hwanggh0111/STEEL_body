import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { planState, dayLabel, untilLabel } from '../data/plans';

// 「이 날 무엇을 할까」 — 달력에서 날짜를 고르면 그 아래에 붙는다.
//
// 달력은 되짚는 자리이기만 한 게 아니다. **「이번 주에 언제 갈까」를 정하는 자리**이기도
// 하다. 그런데 여기서 할 수 있는 일은 지난 기록을 보는 것뿐이었다 —
// 앞날을 눌러도 「이 날은 쉬셨네요」만 나왔다. 아직 오지도 않은 날인데.
//
// **한 것과 할 것을 섞지 않는다.** 계획은 따로 저장하고(`/api/plans`), 화면에서도
// 따로 그린다. 그날 기록이 생기면 계획은 자동으로 「한 것」이 된다 —
// 「했음」을 계획에 따로 적어두면 기록을 지웠을 때 계획만 「했음」으로 남는다.
export default function DayPlan({ date, today, plans, dayWorkouts, myRoutines, onAdd, onDelete, adding }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const state = planState(date, today, dayWorkouts);
  const isPast = date < today;
  const until = untilLabel(date, today);

  const addExercise = () => {
    const v = name.trim();
    if (!v) return;
    onAdd({ date, kind: 'exercise', name: v });
    setName('');
  };

  return (
    <div className="card" style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>
          {dayLabel(date)}에 할 것
        </span>
        {until && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{until}</span>}
        {/* 계획한 날에 기록이 생기면 그것으로 끝이다. 따로 체크할 것이 없다 */}
        {plans.length > 0 && state === 'done' && (
          <span style={{ fontSize: 11.5, color: 'var(--accent)' }}>· 그날 기록이 있어요</span>
        )}
        {plans.length > 0 && state === 'missed' && (
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>· 지난 날이고 기록이 없어요</span>
        )}
      </div>

      {plans.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {plans.map((p) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 0', borderBottom: '1px solid var(--border)',
              // 못 한 것은 흐리게. **잘못했다고 칠하지는 않는다** —
              // 빨강으로 두면 달력을 열 때마다 혼나는 기분이 된다
              opacity: state === 'missed' ? 0.55 : 1,
            }}>
              <span style={{
                fontSize: 10.5, color: 'var(--text-muted)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1px 6px', flexShrink: 0,
              }}>{p.kind === 'routine' ? '루틴' : '운동'}</span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', flexGrow: 1, minWidth: 0 }}>{p.name}</span>
              <button
                onClick={() => onDelete(p.id)}
                aria-label={`${p.name} 계획 지우기`}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: 11.5, flexShrink: 0, padding: '2px 4px',
                }}
              >빼기</button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          {isPast
            ? '이 날 하기로 한 것은 없었어요.'
            : '아직 정한 것이 없어요. 무엇을 할지 미리 담아두면 그날 달력에 뜹니다.'}
        </div>
      )}

      {/* 담기 — 늘 펼쳐두면 지난 날을 볼 때도 폼이 따라다닌다 */}
      {!open ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-secondary" style={{ width: 'auto', padding: '8px 14px', fontSize: 12.5 }}
            onClick={() => setOpen(true)}>+ 할 것 담기</button>
          {/* **기록을 넣는 자리로 그 날짜를 들고 간다.** 예전에는 달력에서 날짜를
              고른 다음 기록 화면에 가서 날짜를 또 골라야 했다 */}
          <button
            className="btn-secondary"
            style={{ width: 'auto', padding: '8px 14px', fontSize: 12.5 }}
            onClick={() => navigate('/workout', { state: { date } })}
          >이 날 기록하기</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* **내 루틴을 통째로 거는 것이 제일 흔한 쓰임이다.** 「월요일 가슴+삼두」를
              그날에 걸어두면 그날 뭘 할지 다시 안 정해도 된다 */}
          {myRoutines.length > 0 && (
            <div>
              <div className="label">내 루틴에서</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {myRoutines.map((r) => (
                  <button
                    key={r.id ?? r._id}
                    className="btn-secondary"
                    disabled={adding}
                    style={{ width: 'auto', padding: '7px 12px', fontSize: 12.5 }}
                    onClick={() => onAdd({ date, kind: 'routine', name: r.name, routineId: r.id ?? r._id })}
                  >{r.name}</button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="label">운동 하나만</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 40))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExercise(); } }}
                placeholder="예: 벤치프레스"
              />
              <button className="btn-secondary" style={{ width: 'auto', flexShrink: 0 }}
                disabled={adding || !name.trim()} onClick={addExercise}>담기</button>
            </div>
          </div>

          <button
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontSize: 12, color: 'var(--text-muted)', alignSelf: 'flex-start',
            }}
            onClick={() => { setOpen(false); setName(''); }}
          >닫기</button>
        </div>
      )}
    </div>
  );
}
