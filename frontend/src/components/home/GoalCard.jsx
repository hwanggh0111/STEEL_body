import { useMemo } from 'react';
import GoalRing from '../GoalRing';
import { hasGoal, weekProgress, weekLine, weekStreak, weightProgress } from '../../data/goal';

// 홈의 목표 카드.
//
// **맨 위다.** 「오늘 할 곳」보다 위다 — 「오늘 뭐 하지」의 답은 부위가 말해주지만,
// 「오늘 꼭 해야 하나」의 답은 여기에만 있다. 금요일에 3/4 을 보면 나간다.
//
// 목표가 없는 사람에게는 **한 줄만** 보인다. 큰 빈 카드를 띄워두면 안 쓰는 사람에게
// 매일 빈자리를 보여주는 셈이다 — 이 앱은 없는 것을 크게 안 띄운다.
//
// 세부는 여기서 안 한다. 고치기 · 이어온 주 · 지나간 목표는 목표 화면(`/goal`)이 맡는다.
export default function GoalCard({ goal, loaded, workouts, records, today, onGo }) {
  const week = useMemo(() => weekProgress(workouts, goal, today), [workouts, goal, today]);
  const streak = useMemo(() => weekStreak(workouts, goal, today), [workouts, goal, today]);
  const body = useMemo(() => weightProgress(records, goal), [records, goal]);

  // 아직 받아오는 중이면 아무것도 안 그린다 — 깜빡 띄웠다 지우지 않는다
  if (!loaded) return null;

  if (!hasGoal(goal)) {
    return (
      <button
        onClick={onGo}
        className="card clickable"
        style={{
          width: '100%', marginBottom: 20, textAlign: 'left', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        }}
      >
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13.5, color: 'var(--text-secondary)' }}>
            목표를 하나 정해두면 이번 주 수에 뜻이 생깁니다
          </span>
          <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>
            주 몇 번 · 몇 kg — 남과 겨루지 않습니다
          </span>
        </span>
        <span style={{ fontSize: 12, color: 'var(--accent)', flexShrink: 0 }}>세우기 ›</span>
      </button>
    );
  }

  return (
    <div
      className="card clickable"
      role="button"
      tabIndex={0}
      onClick={onGo}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onGo(); } }}
      style={{ marginBottom: 20 }}
    >
      {week && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <GoalRing
            size={74}
            ratio={week.ratio}
            done={week.met}
            main={`${week.done}/${week.target}`}
            sub="이번 주"
          />
          <div style={{ minWidth: 0, flexGrow: 1 }}>
            <div className="serif-display" style={{ fontSize: 16, lineHeight: 1.5 }}>
              {weekLine(week)}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
              주 {week.target}회
              {/* 이어온 주는 **둘 이상일 때만** 말한다. 「1주 연속」은 연속이 아니다 */}
              {streak?.current > 1 && (
                <> · <span style={{ color: 'var(--accent)' }}>{streak.current}주 연속</span></>
              )}
            </div>
          </div>
          <span style={{ fontSize: 12, color: 'var(--accent)', flexShrink: 0 }}>›</span>
        </div>
      )}

      {week && body && <div style={{ height: 1, background: 'var(--border)', margin: '13px 0 12px' }} />}

      {body && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 7 }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              체중 <span style={{ color: 'var(--accent)' }}>{body.target}kg</span>까지
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              {/* 체중 기록이 없으면 진행률을 지어내지 않는다 */}
              {body.now == null ? '체중 기록이 없어요'
                : body.reached ? '닿았습니다' : `${body.left}kg 남음`}
            </span>
          </div>
          {body.now != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div className="progress-bg" style={{ flexGrow: 1 }}>
                <div className="progress-fill" style={{
                  width: `${Math.round(body.ratio * 100)}%`,
                  background: body.reached ? 'var(--success)' : 'var(--accent)',
                }} />
              </div>
              <span style={{ width: 32, textAlign: 'right', fontSize: 11.5, color: 'var(--text-muted)' }}>
                {Math.round(body.ratio * 100)}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
