import { memo } from 'react';

// 목표 고리.
//
// 홈의 목표 카드와 목표 화면이 **같은 것을 크기만 달리** 쓴다 — 두 벌로 그리면
// 한쪽만 고쳐지는 날이 온다 (같은 자리를 두 번 그리지 않는다는 이 앱의 규칙).
//
// **막대가 아니라 고리인 이유.** 주간 요약에 이미 부위별 막대가 있다. 같은 화면에
// 같은 모양이 또 나오면 둘이 같은 이야기로 보인다 — 하나는 「무엇을 했나」고
// 하나는 「어디까지 왔나」다.
//
// 넘긴 것은 한 바퀴에서 멈춘다 (`goal.js` 의 ratio 가 이미 1을 안 넘긴다) —
// 두 바퀴를 돌면 몇 바퀴인지 읽을 수가 없다.
function GoalRing({ size = 74, stroke = 7, ratio = 0, main, sub, done = false }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(1, ratio)));

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r}
          stroke="var(--bg-tertiary)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r}
          stroke={done ? 'var(--success)' : 'var(--accent)'} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          // 채워질 때 한 번 돈다. 기록을 적고 홈에 오면 고리가 차오르는 것이 보인다
          style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 1,
      }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1,
          fontSize: Math.round(size * 0.31), lineHeight: 1,
          color: done ? 'var(--success)' : 'var(--accent)',
        }}>
          {main}
        </div>
        {sub && (
          <div style={{ fontSize: Math.max(9, Math.round(size * 0.13)), color: 'var(--text-muted)' }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(GoalRing);
