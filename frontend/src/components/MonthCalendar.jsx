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

const SHORT = { 가슴: '가', 등: '등', 어깨: '어', 하체: '하', 팔: '팔', 코어: '코', 기타: '·' };

export default function MonthCalendar({ year, month, workouts, selected, onSelect }) {
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
              const isToday = cell.key === today;
              const isSelected = cell.key === selected;
              const part = done ? partOfDay(list) : null;

              return (
                <button
                  key={cell.key}
                  onClick={() => onSelect(isSelected ? null : cell.key)}
                  aria-label={`${month}월 ${cell.day}일${done ? ` · ${list.length}건` : ' · 기록 없음'}`}
                  aria-pressed={isSelected}
                  style={{
                    aspectRatio: '1 / 1',
                    minHeight: 44,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 1,
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    background: done ? 'var(--accent-dim)' : 'var(--bg-primary)',
                    border: isSelected
                      ? '2px solid var(--accent)'
                      : isToday
                        ? '1px solid var(--text-muted)'
                        : `1px solid ${done ? 'var(--accent)' : 'var(--border)'}`,
                    color: done ? 'var(--accent)' : 'var(--text-muted)',
                    fontFamily: "'Barlow', sans-serif",
                    padding: 0,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, lineHeight: 1 }}>{cell.day}</span>
                  {part && (
                    <span style={{ fontSize: 9, lineHeight: 1, opacity: 0.85 }}>{SHORT[part] || '·'}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
