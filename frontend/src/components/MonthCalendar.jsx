import { useMemo } from 'react';
import { monthGrid, DAY_LABELS, partOfDay } from '../data/monthGrid';
import { dateKey } from '../data/dateKey';

// 한 달 달력.
//
// **빠진 날을 보여주는 것이 목적이다.** 그래서 옆 달 날짜를 흐리게 채우지 않고,
// 운동한 날과 안 한 날의 차이를 한눈에 두었다.
//
// 칸에 부위 이름을 적는다 — 「했다」보다 「무엇을 했다」가 되짚는 데 쓸모 있다.
// 칸이 좁아서 한 글자만 들어가는데, 부위 이름이 대부분 한 글자다 (가슴 → 가, 등 → 등).
//
// **앞으로 할 것도 같이 그린다** (2026-09-02). 달력은 되짚는 자리이면서 **정하는
// 자리**이기도 하다 — 「이번 주에 언제 갈까」를 보는 곳이 여기다.
// 한 날과 할 날은 **테두리로** 가른다: 한 날은 채운 금색, 할 날은 **점선**이다.
// 색으로만 가르면 둘 다 금색이라 구별이 안 된다.

const SHORT = { 가슴: '가', 등: '등', 어깨: '어', 하체: '하', 팔: '팔', 코어: '코', 기타: '·' };

export default function MonthCalendar({ year, month, workouts, plans = {}, selected, onSelect }) {
  const today = dateKey();
  const weeks = useMemo(() => monthGrid(year, month), [year, month]);

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
        {DAY_LABELS.map((d, i) => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 11, fontWeight: 600,
            color: i >= 5 ? 'var(--text-secondary)' : 'var(--text-muted)',
          }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {week.map((cell, ci) => {
              if (!cell) return <div key={ci} />;
              const list = workouts?.[cell.key] || [];
              const done = list.length > 0;
              const planned = (plans?.[cell.key] || []).length;
              // 계획해둔 날인데 그날 기록이 없다 — 오늘부터면 「할 것」, 지났으면 「못 한 것」
              const todo = !done && planned > 0 && cell.key >= today;
              const missed = !done && planned > 0 && cell.key < today;
              const isToday = cell.key === today;
              const isSelected = cell.key === selected;
              const part = done ? partOfDay(list) : null;

              return (
                <button
                  key={cell.key}
                  onClick={() => onSelect(isSelected ? null : cell.key)}
                  aria-label={`${month}월 ${cell.day}일`
                    + (done ? ` · 기록 ${list.length}건` : ' · 기록 없음')
                    + (planned ? ` · 할 것 ${planned}개${missed ? ' (못 함)' : ''}` : '')}
                  aria-pressed={isSelected}
                  style={{
                    aspectRatio: '1 / 1',
                    minHeight: 44,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 1,
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    background: done ? 'var(--accent-dim)' : 'var(--bg-primary)',
                    // **한 날은 실선, 할 날은 점선.** 색으로만 가르면 둘 다 금색이라
                    // 구별이 안 된다. 못 한 날은 점선이되 흐리다 — 잘못했다고 칠하지 않는다
                    border: isSelected
                      ? '2px solid var(--accent)'
                      : todo
                        ? '1px dashed var(--accent)'
                        : missed
                          ? '1px dashed var(--border-hover)'
                          : isToday
                            ? '1px solid var(--text-muted)'
                            : `1px solid ${done ? 'var(--accent)' : 'var(--border)'}`,
                    color: done || todo ? 'var(--accent)' : 'var(--text-muted)',
                    fontFamily: "'Barlow', sans-serif",
                    padding: 0,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, lineHeight: 1 }}>{cell.day}</span>
                  {part ? (
                    <span style={{ fontSize: 9, lineHeight: 1, opacity: 0.85 }}>{SHORT[part] || '·'}</span>
                  ) : planned ? (
                    // 할 것이 있는 날은 개수를 적는다. 이름은 칸에 안 들어간다 —
                    // 날짜를 누르면 아래에 그대로 나온다
                    <span style={{ fontSize: 9, lineHeight: 1, opacity: missed ? 0.5 : 0.85 }}>
                      {planned}개
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
