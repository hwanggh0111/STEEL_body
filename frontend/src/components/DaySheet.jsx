import { useState, useEffect } from 'react';
import { planState, dayLabel, untilLabel } from '../data/plans';
import ExerciseFinder from './ExerciseFinder';

// 달력에서 날짜를 누르면 나오는 **그날 한 장.**
//
// 9/3 까지 이 자리는 카드 두 장이었다 — 「할 것」(DayPlan)과 「메모」(DayNote).
// 하나는 8/31 에, 하나는 오늘 붙였고, 둘은 서로를 모른 채 위아래로 쌓여 있었다.
// **하루를 보러 왔는데 화면은 기능 단위로 나뉘어 있었다.**
//
// 하루에 붙는 것은 **한 것 · 할 것** 둘이다. 같은 결로 한 장에 둔다 —
// 각 칸은 「작은 이름 + 오른쪽 단추 + 내용」 한 모양이다.
//
//   3월 5일 (수)                     오늘
//   ─────────────────────────────────────
//   한 것          벤치프레스 …       아래에서 보기
//   할 것          + 담기
//
// **메모는 여기 없다.** 달력 칸에 적고 칸에서 읽는다(`MonthCalendar`) —
// 「달력에 메모하게 해달라」는 말은 달력에 적는다는 뜻이었다. 같은 것을 두 자리에
// 두면 어느 쪽이 진짜인지 알 수 없게 된다.
//
// **없는 칸은 안 그린다.** 지난 날에 「아직 정한 것이 없어요」를 띄우면 잔소리가 되고,
// 기록이 없는 날에 빈 「한 것」 칸을 두면 매번 없다는 말을 읽어야 한다.
export default function DaySheet({
  date, today, plans, dayWorkouts, myRoutines,
  onAddPlan, onDeletePlan, addingPlan,
  onSeeRecords,
  onAddWorkout, addingWorkout,
}) {
  const [adding, setAdding] = useState(false);      // 할 것 담는 칸을 폈나
  const [name, setName] = useState('');

  // **이 날에 바로 적는 칸** (5차 리모델링, 2026-09-04)
  const [writing, setWriting] = useState(false);
  const [finding, setFinding] = useState(false);
  const [ex, setEx] = useState('');
  const [weight, setWeight] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [error, setError] = useState('');

  // 다른 날로 옮기면 쓰던 것을 닫는다 — **다른 날 메모가 이 날에 붙으면 안 된다**
  useEffect(() => {
    setAdding(false); setName('');
    setWriting(false); setFinding(false);
    setEx(''); setWeight(''); setSets(''); setReps(''); setError('');
  }, [date]);

  const list = Array.isArray(dayWorkouts) ? dayWorkouts : [];
  const state = planState(date, today, list);
  const isPast = date < today;
  const until = untilLabel(date, today);

  // 이 날에 한 줄 적는다. **화면을 옮기지 않는다** —
  // 예전에는 여기서 기록 화면으로 날짜를 들고 갔다
  const writeHere = async () => {
    const nm = ex.trim();
    if (!nm) { setError('무슨 운동인지 적어주세요'); return; }
    if (!sets || !reps) { setError('세트와 횟수를 적어주세요'); return; }
    if (Number(sets) > 100 || Number(reps) > 1000) { setError('숫자가 너무 큽니다'); return; }
    setError('');
    try {
      await onAddWorkout?.({
        date,
        exercise: nm,
        weight: String(weight).trim() || '맨몸',
        sets: Number(sets),
        reps: Number(reps),
      });
      // **칸은 열어둔 채 비운다.** 한 날에 여러 개를 몰아 적는 자리라
      // 적을 때마다 다시 펴게 하면 손이 두 배로 간다
      setEx(''); setWeight(''); setSets(''); setReps('');
    } catch (err) {
      setError(err?.response?.data?.error || '적지 못했어요');
    }
  };

  const addExercise = () => {
    const v = name.trim();
    if (!v) return;
    onAddPlan({ date, kind: 'exercise', name: v });
    setName('');
  };

  return (
    <div className="card" style={{ marginTop: 8, padding: 0, overflow: 'hidden' }}>
      {/* ── 어느 날인가 ── */}
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 8,
        padding: '13px 15px 11px', flexWrap: 'wrap',
      }}>
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1.5,
          color: 'var(--text-primary)',
        }}>{dayLabel(date)}</span>
        {until && <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{until}</span>}
        {/* 계획한 날에 기록이 생기면 그것으로 끝이다. 따로 체크할 것이 없다.
            못 한 날은 흐리게만 적는다 — **잘못했다고 칠하지 않는다** */}
        {plans.length > 0 && state === 'done' && (
          <span style={{ fontSize: 11.5, color: 'var(--accent)', marginLeft: 'auto' }}>하기로 한 것을 했어요</span>
        )}
        {plans.length > 0 && state === 'missed' && (
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginLeft: 'auto' }}>기록이 없는 날이에요</span>
        )}
      </div>

      {/* ── 한 것 ── */}
      {list.length > 0 && (
        <Section
          label="한 것"
          action={onSeeRecords ? { text: '아래에서 보기', onClick: onSeeRecords } : null}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {list.slice(0, 3).map((w) => (
              <div key={w.id} style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                {w.exercise}
                <span style={{ color: 'var(--text-muted)' }}>
                  {' · '}{w.weight} · {w.sets}세트 {w.reps}회
                </span>
              </div>
            ))}
            {list.length > 3 && (
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>외 {list.length - 3}건</div>
            )}
          </div>
        </Section>
      )}

      {/* ── 할 것 ── */}
      <Section
        label="할 것"
        action={adding ? { text: '닫기', onClick: () => { setAdding(false); setName(''); } }
                       : { text: '+ 담기', onClick: () => setAdding(true) }}
      >
        {plans.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: adding ? 10 : 0 }}>
            {plans.map((p) => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                opacity: state === 'missed' ? 0.55 : 1,
              }}>
                <span style={{
                  fontSize: 10.5, color: 'var(--text-muted)', flexShrink: 0,
                  border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1px 6px',
                }}>{p.kind === 'routine' ? '루틴' : '운동'}</span>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', flexGrow: 1, minWidth: 0 }}>{p.name}</span>
                <button
                  onClick={() => onDeletePlan(p.id)}
                  aria-label={`${p.name} 빼기`}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', fontSize: 11.5, padding: '2px 3px', flexShrink: 0,
                  }}
                >빼기</button>
              </div>
            ))}
          </div>
        )}

        {plans.length === 0 && !adding && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {isPast ? '이 날 하기로 한 것은 없었어요.' : '미리 담아두면 그날 달력에 뜹니다.'}
          </div>
        )}

        {adding && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {/* **내 루틴을 통째로 거는 것이 제일 흔한 쓰임이다** —
                「월요일 가슴+삼두」를 걸어두면 그날 뭘 할지 다시 안 정해도 된다 */}
            {myRoutines.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {myRoutines.map((r) => (
                  <button
                    key={r.id ?? r._id}
                    disabled={addingPlan}
                    onClick={() => onAddPlan({ date, kind: 'routine', name: r.name, routineId: r.id ?? r._id })}
                    style={chip}
                  >{r.name}</button>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 7 }}>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 40))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExercise(); } }}
                placeholder="운동 하나만 적어도 돼요"
                style={{ fontSize: 13, padding: '8px 11px' }}
              />
              <button
                disabled={addingPlan || !name.trim()}
                onClick={addExercise}
                style={{ ...chip, flexShrink: 0, opacity: name.trim() ? 1 : 0.5 }}
              >담기</button>
            </div>
          </div>
        )}
      </Section>

      {/* ── 이 날에 적기 ── (5차 리모델링, 2026-09-04)
          예전에는 여기서 **기록 화면으로 날짜를 들고 갔다.** 그 길을 내려고
          기록 화면이 달력에서 온 날짜를 받아 자정 넘김까지 따로 다루고 있었다.
          그 자리에서 적으면 넘겨줄 것이 없다 */}
      {writing ? (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 15px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)', letterSpacing: 1 }}>이 날에 적기</span>
            <button onClick={() => setWriting(false)} style={{ ...chip, marginLeft: 'auto' }}>닫기</button>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="input"
              value={ex}
              onChange={(e) => setEx(e.target.value.slice(0, 60))}
              placeholder="운동 이름"
              style={{ fontSize: 13, padding: '8px 11px' }}
            />
            <button onClick={() => setFinding((v) => !v)} style={{ ...chip, flexShrink: 0 }}>
              {finding ? '닫기' : '찾기'}
            </button>
          </div>

          {finding && (
            <ExerciseFinder
              onPick={(n) => { setEx(String(n || '').trim()); setFinding(false); }}
              pickLabel="이걸로"
              autoFocus
              compact
            />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
            <input className="input" inputMode="decimal" value={weight}
              onChange={(e) => setWeight(e.target.value)} placeholder="무게"
              aria-label="무게 kg" style={{ fontSize: 13, padding: '8px 11px' }} />
            <input className="input" inputMode="numeric" value={sets}
              onChange={(e) => setSets(e.target.value)} placeholder="세트"
              aria-label="세트" style={{ fontSize: 13, padding: '8px 11px' }} />
            <input className="input" inputMode="numeric" value={reps}
              onChange={(e) => setReps(e.target.value)} placeholder="횟수"
              aria-label="횟수" style={{ fontSize: 13, padding: '8px 11px' }} />
          </div>

          {error && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</div>}

          <button
            className="btn-primary"
            disabled={addingWorkout}
            onClick={writeHere}
            style={{ padding: '10px 0', fontSize: 14 }}
          >{addingWorkout ? '적는 중…' : '적기'}</button>
        </div>
      ) : (
        <button
          onClick={() => setWriting(true)}
          style={{
            width: '100%', padding: '12px 15px', cursor: 'pointer',
            background: 'none', border: 'none', borderTop: '1px solid var(--border)',
            color: 'var(--accent)', fontSize: 13, fontFamily: 'inherit', textAlign: 'center',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
        >이 날에 적기</button>
      )}
    </div>
  );
}

// 칸 하나. **셋이 같은 모양이다** — 작은 이름 · 오른쪽 단추 · 내용.
// 모양이 하나라야 「한 것 · 할 것 · 메모」가 한 하루로 읽힌다
function Section({ label, action, children }) {
  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '11px 15px 13px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
        <span style={{ fontSize: 11, letterSpacing: 1, color: 'var(--text-muted)' }}>{label}</span>
        {action && (
          <button
            onClick={action.onClick}
            style={{
              marginLeft: 'auto', background: 'none', cursor: 'pointer',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              color: 'var(--text-muted)', fontSize: 11.5, padding: '3px 10px',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          >{action.text}</button>
        )}
      </div>
      {children}
    </div>
  );
}

const chip = {
  background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)',
  padding: '7px 12px', fontSize: 12.5, borderRadius: 'var(--radius)',
  cursor: 'pointer', fontFamily: 'inherit',
};
