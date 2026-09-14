import { useRoutineSessionStore } from '../store/routineSessionStore';
import { confirmDialog } from './ConfirmModal';
import { toast } from './Toast';

// 진행 중인 루틴 — 기록 화면 맨 위에 붙는다.
//
// 「지금 할 운동」은 폼이 이미 보여준다. 여기서는 **어디까지 왔는지**와
// **남은 것**만 보여준다 — 같은 것을 두 번 그리지 않는다.
//
// **세트마다 체크한다** (2026-09-14). 예전에는 운동 하나를 다 하고 「4세트 10회」를
// 한 번에 저장해야 칸이 넘어갔다. 헬스장에서 세트 사이에 몇 세트째인지 세는 것은
// 머리로 했다. 이제 지금 운동 아래에 세트 칸이 있고, 한 세트를 끝낼 때마다 누른다 —
// 누르면 휴식 타이머가 돌고, **마지막 세트를 누르면 기록이 저장되고 다음 운동으로 간다.**

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

// 세트 칸.
//
// 몇 세트인지 알면(루틴에 적혀 있거나 지난 기록이 있으면) 그만큼 그린다. 모르면 한 세트를
// 할 때마다 칸이 하나씩 늘어난다 — 그때는 「여기까지 기록」으로 끝낸다.
//
// **누르는 규칙은 하나다** — 빈 칸을 누르면 거기까지 체크, 체크된 칸을 누르면 거기부터 푼다.
// 세트 사이에는 폰을 대충 누른다. 한 칸 건너 누르거나 잘못 누른 것을 바로 되돌릴 수 있어야 한다
function SetChecks({ done, planned, onTap, disabled }) {
  const count = planned ? Math.max(planned, done) : done + 1;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {Array.from({ length: count }, (_, i) => {
        const n = i + 1;
        const on = n <= done;
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onTap(on ? n - 1 : n)}
            aria-pressed={on}
            aria-label={on ? `${n}세트 체크 풀기` : `${n}세트 했음`}
            style={{
              width: 42, height: 42, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--radius)', cursor: disabled ? 'default' : 'pointer',
              border: `1px solid ${on ? 'var(--accent)' : 'var(--border-hover)'}`,
              background: on ? 'var(--accent)' : 'transparent',
              color: on ? 'var(--on-accent)' : 'var(--text-secondary)',
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1,
            }}
          >
            {on ? (
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 8.5l3.5 3.5L13 4.5" />
              </svg>
            ) : n}
          </button>
        );
      })}
    </div>
  );
}

export default function RoutineRun({ onSkip, plannedSets = null, onSetTap, onFinishSets, busy = false }) {
  const session = useRoutineSessionStore(s => s.session);
  const stop = useRoutineSessionStore(s => s.stop);

  if (!session) return null;

  const pct = session.total ? Math.round((session.done / session.total) * 100) : 0;
  const currentItem = session.current >= 0 ? session.items[session.current] : null;
  const setsDone = currentItem?.setsDone || 0;
  // 세트를 몇 개 했는데 다 안 했다 — 그때만 「여기까지 기록」을 준다.
  // 다 했으면 마지막 세트를 누르는 순간 저장되므로 필요 없다
  const canFinishEarly = setsDone > 0 && (!plannedSets || setsDone < plannedSets);

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

      {/* 지금 운동의 세트 칸 — 목록 위에 둔다. 세트 사이에 제일 자주 누르는 자리다 */}
      {currentItem && onSetTap && (
        <div style={{
          padding: '12px 12px 11px', background: 'var(--accent-dim)',
          border: '1px solid var(--accent)', borderRadius: 'var(--radius)',
          display: 'flex', flexDirection: 'column', gap: 9,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{
              fontSize: 14, color: 'var(--accent)', fontWeight: 600,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
            }}>{currentItem.name}</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>
              {setsDone}{plannedSets ? ` / ${plannedSets}` : ''}세트
            </span>
          </div>
          <SetChecks done={setsDone} planned={plannedSets} onTap={onSetTap} disabled={busy} />
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {plannedSets
              ? '한 세트 끝낼 때마다 누르세요. 마지막 세트를 누르면 기록하고 다음 운동으로 갑니다.'
              : '한 세트 끝낼 때마다 누르세요. 다 하면 「여기까지 기록」을 누릅니다.'}
          </div>
        </div>
      )}

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

      <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
        {canFinishEarly && onFinishSets && (
          <button className="btn-primary" style={{ flexBasis: '100%' }} disabled={busy} onClick={onFinishSets}>
            여기까지 기록 · {setsDone}세트
          </button>
        )}
        {currentItem && (
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onSkip}>
            이 운동 건너뛰기
          </button>
        )}
        <button className="btn-secondary" style={{ flex: 1 }} onClick={quit}>
          그만두기
        </button>
      </div>
    </div>
  );
}
