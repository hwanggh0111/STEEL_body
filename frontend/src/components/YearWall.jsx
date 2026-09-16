import { useMemo, useState } from 'react';
import { useWorkoutStore } from '../store/workoutStore';
import { useToday } from '../data/useToday';
import { buildYear, yearsWithRecords } from '../data/yearWall';

// 1년 기록 벽.
//
// 달력은 한 달씩만 보여준다. 이것은 **한 해를 한 화면에** 깐다. 계산은
// `data/yearWall.js` 가 한다 — 여기서는 그리기만 한다.
//
// **날짜 칸은 누르는 자리가 아니다.** 칸 하나가 11px 남짓이라 손가락으로 겨냥할 수
// 없다(앱의 누르는 것은 44px 아래로 안 내려간다). 이 벽은 **멀리서 한 번에 보는
// 것**이고, 그래서 칸을 작게 둘 수 있다.
//
// 대신 **판(달)이 누르는 자리다** (2026-09-16). 100px 짜리라 겨냥할 수 있고,
// 벽에서 「3월이 제일 뜨거웠네」를 본 사람이 다음에 하고 싶은 일이 그것이다 —
// 안 주면 달력 화살표를 아홉 번 누르게 된다.
//
// 각인 깊이는 그 해 가장 무거웠던 날을 기준으로 나눈다 — 사람마다 드는 무게가
// 열 배씩 차이 나서, 절대값으로 자르면 어떤 사람의 벽은 통째로 어둡다.
const TILE = {
  0: { background: '#17140f', boxShadow: 'inset 0 1px 1.5px rgba(0,0,0,0.8)' },
  1: { background: 'rgba(210,154,95,0.22)' },
  2: { background: 'rgba(210,154,95,0.55)' },
  3: { background: '#d29a5f', boxShadow: '0 0 5px rgba(210,154,95,0.35)' },
};

// `onPickMonth(year, month)` — 판을 누르면 위의 달력이 그 달로 간다.
// 벽에서 「3월이 제일 뜨거웠네」를 보고 나면 **그 달을 들여다보고 싶어진다.**
// 안 주면 벽은 보기만 하는 그림으로 남고, 사람은 달력 화살표를 아홉 번 누른다.
export default function YearWall({ onPickMonth }) {
  const today = useToday();
  const workouts = useWorkoutStore((s) => s.workouts);

  const years = useMemo(() => yearsWithRecords(workouts), [workouts]);
  const thisYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(null);
  // 고르기 전에는 올해. 올해 기록이 하나도 없으면 기록이 있는 가장 최근 해를 편다 —
  // 1월 2일에 열었는데 빈 벽만 나오면 이 화면은 아무 말도 안 하는 것이다
  const shown = year ?? (years.includes(thisYear) ? thisYear : years[0]);

  const wall = useMemo(() => (shown ? buildYear(workouts, shown) : null), [workouts, shown]);

  if (!wall || wall.total.days === 0) return null;

  const { total } = wall;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
        <div className="serif-display" style={{ fontSize: 22, lineHeight: 1.5 }}>
          {shown}년 <span style={{ color: 'var(--accent)' }}>{total.days}일</span>을<br />새겼습니다
        </div>

        {/* 해가 여럿일 때만 고를 것을 준다. 한 해뿐이면 고를 것이 없다 */}
        {years.length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {years.slice(0, 3).map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className="btn-secondary"
                style={{
                  padding: '5px 11px', fontSize: 13,
                  ...(y === shown ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--on-accent)' } : null),
                }}
              >{y}</button>
            ))}
          </div>
        )}
      </div>

      <hr className="rule-beam" style={{ margin: '16px 0 18px' }} />

      {/* 벽 — 판 열두 장 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 9 }}>
        {wall.months.map((m) => (
          <div
            key={m.index}
            role={onPickMonth ? 'button' : undefined}
            tabIndex={onPickMonth ? 0 : undefined}
            aria-label={onPickMonth ? `${shown}년 ${m.name} 달력으로` : undefined}
            onClick={onPickMonth ? () => onPickMonth(shown, m.index + 1) : undefined}
            onKeyDown={onPickMonth ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPickMonth(shown, m.index + 1); }
            } : undefined}
            style={{
            cursor: onPickMonth ? 'pointer' : 'default',
            background: 'linear-gradient(165deg, #221d16 0%, #16120e 100%)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'inset 0 1px 0 rgba(238,183,125,0.1)',
            padding: '9px 9px 10px',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 4, marginBottom: 8 }}>
              <span style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 1.6,
                color: m.count > 0 ? 'var(--text-secondary)' : 'var(--border-hover)',
              }}>{m.name}</span>
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{m.count > 0 ? m.count : ''}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 3 }}>
              {m.days.map((d) => (
                <span
                  key={d.date}
                  title={d.level > 0 ? `${d.date}${d.kg > 0 ? ` · ${d.kg.toLocaleString()}kg` : ''}` : d.date}
                  style={{
                    display: 'block', width: '100%', paddingBottom: '100%',
                    borderRadius: 1, ...TILE[d.level],
                    // **오늘이 어디인지.** 한 해를 깔아놓고 지금 자리를 안 알려주면
                    // 「어디까지 왔나」를 셈해야 한다. 칠하지 않고 테두리로만 짚는다 —
                    // 칠하면 오늘이 운동한 날처럼 보인다
                    ...(d.date === today ? {
                      boxShadow: ['0 0 0 1px var(--accent)', TILE[d.level].boxShadow].filter(Boolean).join(', '),
                    } : null),
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 범례 */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 18 }}>
        <span className="label" style={{ marginBottom: 0, letterSpacing: 1.4 }}>가볍게</span>
        {[0, 1, 2, 3].map((lv) => (
          <span key={lv} style={{ width: 7, height: 7, borderRadius: 1, ...TILE[lv] }} />
        ))}
        <span className="label" style={{ marginBottom: 0, letterSpacing: 1.4 }}>무겁게</span>
      </div>

      {/* 올해를 보고 있을 때만 「오늘」이 이 벽 안에 있다 */}
      {shown === thisYear && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: 1, ...TILE[0], boxShadow: '0 0 0 1px var(--accent)' }} />
          <span className="label" style={{ marginBottom: 0, letterSpacing: 1.4 }}>오늘</span>
          {onPickMonth && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· 판을 누르면 그 달 달력으로</span>}
        </div>
      )}

      <hr className="rule-beam" style={{ margin: '18px 0' }} />

      {/* 한 해의 숫자 — 상자로 키우지 않는다. 벽이 주인공이다 */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {total.tons > 0 && <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{total.tons.toLocaleString()}톤</span>}
        {total.tons > 0 && <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'var(--border-hover)' }} />}
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>최장 {total.longest}일 연속</span>
        {total.bestMonth && <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'var(--border-hover)' }} />}
        {total.bestMonth && (
          <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            가장 뜨거웠던 달 {total.bestMonth.name}
          </span>
        )}
      </div>
    </div>
  );
}
