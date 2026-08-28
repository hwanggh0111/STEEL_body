import { useRoutineSessionStore } from '../store/routineSessionStore';
import { confirmDialog } from './ConfirmModal';
import { toast } from './Toast';

// 진행 중인 루틴 — 기록 화면 맨 위에 붙는다.
//
// 「지금 할 운동」은 폼이 이미 보여준다. 여기서는 **어디까지 왔는지**와
// **남은 것**만 보여준다 — 같은 것을 두 번 그리지 않는다.

const stateMark = {
  done: { color: 'var(--success)', line: true },
  skip: { color: 'var(--text-muted)', line: true },
  todo: { color: null, line: false },
};

function Check({ state }) {
  if (state === 'done') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ stroke: 'var(--success)' }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 8.5l3.5 3.5L13 4.5" />
      </svg>
    );
  }
  if (state === 'skip') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ stroke: 'var(--text-muted)' }} strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
    );
  }
  return <div style={{ width: 16, height: 16, border: '1px solid var(--border-hover)', borderRadius: 'var(--radius)', flexShrink: 0 }} />;
}

export default function RoutineRun({ onSkip }) {
  const session = useRoutineSessionStore(s => s.session);
  const stop = useRoutineSessionStore(s => s.stop);

  if (!session) return null;

  const pct = session.total ? Math.round((session.done / session.total) * 100) : 0;
  const currentItem = session.current >= 0 ? session.items[session.current] : null;

  const quit = async () => {
    const ok = await confirmDialog(
      `「${session.name}」을 그만둡니다.\n\n지금까지 저장한 운동 기록은 그대로 남습니다. 진행표만 없어집니다.`,
      { title: '루틴을 그만둘까요', confirmText: '그만두기' },
    );
    if (!ok) return;
    try {
      await stop();
      toast('루틴을 그만뒀어요');
    } catch {
      toast('그만두지 못했어요', 'error');
    }
  };

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--accent)',
      borderRadius: 'var(--radius)',
      padding: 16,
      marginBottom: 16,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2,
          color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{session.name}</div>
        <span className="badge badge-accent" style={{ flexShrink: 0 }}>진행 중</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div className="label" style={{ marginBottom: 0 }}>{session.done} / {session.total} 완료</div>
        {currentItem && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            지금 · {currentItem.name}
          </div>
        )}
      </div>

      <div className="progress-bg">
        <div className="progress-fill progress-good" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
        {session.items.map((item, i) => {
          const mark = stateMark[item.state] || stateMark.todo;
          const isCurrent = i === session.current;
          return (
            <div key={`${item.name}-${i}`} style={{
              padding: '9px 12px',
              background: isCurrent ? 'var(--accent-dim)' : 'var(--bg-primary)',
              border: `1px solid ${isCurrent ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <Check state={item.state} />
              <div style={{
                flexGrow: 1, minWidth: 0, fontSize: 14,
                color: mark.line ? 'var(--text-muted)' : isCurrent ? 'var(--accent)' : 'var(--text-secondary)',
                textDecoration: mark.line ? 'line-through' : 'none',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{item.name}</div>
              {(item.sets || item.reps) && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {item.sets ? `${item.sets}세트` : ''}{item.sets && item.reps ? ' × ' : ''}{item.reps ? `${item.reps}회` : ''}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        {currentItem && (
          <button className="btn-secondary" style={{ flexGrow: 1 }} onClick={onSkip}>
            이 운동 건너뛰기
          </button>
        )}
        <button className="btn-secondary" style={{ flexGrow: 1 }} onClick={quit}>
          그만두기
        </button>
      </div>
    </div>
  );
}
