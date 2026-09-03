import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { planState, dayLabel, untilLabel } from '../data/plans';

// 달력에서 날짜를 누르면 나오는 **그날 한 장.**
//
// 9/3 까지 이 자리는 카드 두 장이었다 — 「할 것」(DayPlan)과 「메모」(DayNote).
// 하나는 8/31 에, 하나는 오늘 붙였고, 둘은 서로를 모른 채 위아래로 쌓여 있었다.
// **하루를 보러 왔는데 화면은 기능 단위로 나뉘어 있었다.**
//
// 하루에 붙는 것은 셋이다 — **한 것 · 할 것 · 그날 있었던 일.**
// 셋을 한 장에 같은 결로 둔다. 각 칸은 「작은 이름 + 오른쪽 단추 + 내용」 한 모양이다.
//
//   3월 5일 (수)                     오늘
//   ─────────────────────────────────────
//   한 것          3건 · 가슴          보기
//   할 것          + 담기
//   메모           적기
//
// **없는 칸은 안 그린다.** 지난 날에 「아직 정한 것이 없어요」를 띄우면 잔소리가 되고,
// 기록이 없는 날에 빈 「한 것」 칸을 두면 매번 없다는 말을 읽어야 한다.
export default function DaySheet({
  date, today, plans, dayWorkouts, myRoutines,
  onAddPlan, onDeletePlan, addingPlan,
  note, onSaveNote, onDeleteNote, savingNote,
  onSeeRecords,
}) {
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);      // 할 것 담는 칸을 폈나
  const [name, setName] = useState('');
  const [writing, setWriting] = useState(false);    // 메모를 적고 있나
  const [draft, setDraft] = useState('');
  const areaRef = useRef(null);

  // 다른 날로 옮기면 쓰던 것을 닫는다 — **다른 날 메모가 이 날에 붙으면 안 된다**
  useEffect(() => { setAdding(false); setName(''); setWriting(false); setDraft(''); }, [date]);

  const list = Array.isArray(dayWorkouts) ? dayWorkouts : [];
  const state = planState(date, today, list);
  const isPast = date < today;
  const until = untilLabel(date, today);

  const addExercise = () => {
    const v = name.trim();
    if (!v) return;
    onAddPlan({ date, kind: 'exercise', name: v });
    setName('');
  };

  const startNote = () => {
    setDraft(note?.body || '');
    setWriting(true);
    setTimeout(() => areaRef.current?.focus(), 0);
  };
  const saveNote = () => {
    const body = draft.trim();
    if (!body || savingNote) return;
    onSaveNote(body, () => setWriting(false));
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

      {/* ── 그날 있었던 일 ── */}
      <Section
        label="메모"
        action={writing ? { text: '취소', onClick: () => setWriting(false) }
                        : { text: note ? '고치기' : '적기', onClick: startNote }}
      >
        {writing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea
              ref={areaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={2000}
              placeholder={'어깨가 안 좋아 가볍게 · 벤치 5kg 올림 · 출장이라 쉼'}
              style={{
                width: '100%', minHeight: 84, padding: 10, fontSize: 13, lineHeight: 1.75,
                background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                fontFamily: 'inherit', resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{draft.length}/2000</span>
              <button
                onClick={saveNote}
                disabled={savingNote}
                className="btn-primary"
                style={{ width: 'auto', marginLeft: 'auto', padding: '6px 16px', fontSize: 12.5 }}
              >{savingNote ? '저장 중…' : '저장'}</button>
            </div>
          </div>
        ) : note ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            {/* 적은 그대로 보여준다 — 줄바꿈이 곧 그 사람의 메모다 */}
            <div style={{
              fontSize: 12.5, lineHeight: 1.8, color: 'var(--text-secondary)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', flexGrow: 1, minWidth: 0,
            }}>{note.body}</div>
            <button
              onClick={() => onDeleteNote(note)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
                color: 'var(--text-muted)', fontSize: 11.5, padding: '2px 3px',
              }}
            >지우기</button>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            그날 어땠는지 적어두면 다음에 볼 때 이유가 남아요.
          </div>
        )}
      </Section>

      {/* **기록하는 자리로 그 날짜를 들고 간다.** 예전에는 달력에서 날짜를 고른 다음
          기록 화면에서 날짜를 또 골라야 했다 */}
      <button
        onClick={() => navigate('/workout', { state: { date } })}
        style={{
          width: '100%', padding: '12px 15px', cursor: 'pointer',
          background: 'none', border: 'none', borderTop: '1px solid var(--border)',
          color: 'var(--accent)', fontSize: 13, fontFamily: 'inherit', textAlign: 'center',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
      >이 날 기록하기</button>
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
