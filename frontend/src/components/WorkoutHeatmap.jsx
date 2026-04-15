import { useState, useMemo } from 'react';
import { useLangStore } from '../store/langStore';

const TEXT = {
  ko: {
    title: '운동 히트맵',
    totalDays: '총 운동일',
    yearDays: '올해 운동일',
    streak: '연속 기록',
    days: '일',
    workouts: '회 운동',
    noWorkout: '운동 없음',
    months: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
    weekdays: { 1: '월', 3: '수', 5: '금' },
    less: '적음',
    more: '많음',
  },
  en: {
    title: 'Workout Heatmap',
    totalDays: 'Total Days',
    yearDays: 'This Year',
    streak: 'Current Streak',
    days: 'd',
    workouts: ' workouts',
    noWorkout: 'No workout',
    months: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    weekdays: { 1: 'Mon', 3: 'Wed', 5: 'Fri' },
    less: 'Less',
    more: 'More',
  },
};

function getLevel(count) {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  return 3;
}

const LEVEL_COLORS = [
  'var(--bg-tertiary)',
  'rgba(255, 107, 26, 0.3)',
  'rgba(255, 107, 26, 0.6)',
  'rgba(255, 107, 26, 1)',
];

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildGrid() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find the most recent Saturday (end of grid)
  const end = new Date(today);

  // Find start: go back ~52 weeks from end, align to Sunday
  const start = new Date(end);
  start.setDate(start.getDate() - 364);
  // Align to Sunday (start of week)
  const dayOfWeek = start.getDay();
  start.setDate(start.getDate() - dayOfWeek);

  const weeks = [];
  let current = new Date(start);

  while (current <= end) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(current);
      cellDate.setDate(cellDate.getDate() + d);
      if (cellDate > end) {
        week.push(null);
      } else {
        week.push(new Date(cellDate));
      }
    }
    weeks.push(week);
    current.setDate(current.getDate() + 7);
  }

  return { weeks, start, end };
}

function computeStats(workouts) {
  const now = new Date();
  const currentYear = now.getFullYear();

  let totalDays = 0;
  let yearDays = 0;

  const dates = Object.keys(workouts).filter(d => workouts[d] && workouts[d].length > 0);
  totalDays = dates.length;
  yearDays = dates.filter(d => d.startsWith(String(currentYear))).length;

  // Current streak
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const check = new Date(today);

  // Start from today; if no workout today, check yesterday first
  const todayKey = formatDate(check);
  if (!workouts[todayKey] || workouts[todayKey].length === 0) {
    check.setDate(check.getDate() - 1);
  }

  while (true) {
    const key = formatDate(check);
    if (workouts[key] && workouts[key].length > 0) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }

  return { totalDays, yearDays, streak };
}

export default function WorkoutHeatmap({ workouts = {} }) {
  const { lang } = useLangStore();
  const t = TEXT[lang] || TEXT.ko;
  const [tooltip, setTooltip] = useState(null);

  const { weeks } = useMemo(() => buildGrid(), []);
  const stats = useMemo(() => computeStats(workouts), [workouts]);

  // Determine month labels with column positions
  const monthLabels = useMemo(() => {
    const labels = [];
    let lastMonth = -1;
    weeks.forEach((week, wi) => {
      const firstDay = week.find(d => d !== null);
      if (firstDay) {
        const m = firstDay.getMonth();
        if (m !== lastMonth) {
          labels.push({ month: m, col: wi });
          lastMonth = m;
        }
      }
    });
    return labels;
  }, [weeks]);

  const cellSize = 11;
  const gap = 2;
  const step = cellSize + gap;
  const weekdayLabelWidth = 28;

  return (
    <div className="card" style={{ padding: 16 }}>
      {/* Title */}
      <h3 style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 20,
        color: 'var(--accent)',
        margin: '0 0 12px 0',
        letterSpacing: 1,
      }}>
        {t.title}
      </h3>

      {/* Scrollable container */}
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{ display: 'inline-block', minWidth: 'fit-content' }}>
          {/* Month labels */}
          <div style={{
            display: 'flex',
            marginLeft: weekdayLabelWidth,
            marginBottom: 4,
            position: 'relative',
            height: 14,
          }}>
            {monthLabels.map(({ month, col }, i) => (
              <span key={i} style={{
                position: 'absolute',
                left: col * step,
                fontSize: 10,
                fontFamily: "'Barlow', sans-serif",
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
              }}>
                {t.months[month]}
              </span>
            ))}
          </div>

          {/* Grid with weekday labels */}
          <div style={{ display: 'flex' }}>
            {/* Weekday labels */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              width: weekdayLabelWidth,
              flexShrink: 0,
            }}>
              {[0, 1, 2, 3, 4, 5, 6].map(d => (
                <div key={d} style={{
                  height: cellSize,
                  marginBottom: gap,
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 9,
                  fontFamily: "'Barlow', sans-serif",
                  color: 'var(--text-muted)',
                }}>
                  {t.weekdays[d] || ''}
                </div>
              ))}
            </div>

            {/* Heatmap grid */}
            <div style={{ display: 'flex', gap, position: 'relative' }}>
              {weeks.map((week, wi) => (
                <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap }}>
                  {week.map((date, di) => {
                    if (!date) {
                      return <div key={di} style={{ width: cellSize, height: cellSize }} />;
                    }
                    const key = formatDate(date);
                    const count = (workouts[key] && workouts[key].length) || 0;
                    const level = getLevel(count);

                    return (
                      <div
                        key={di}
                        style={{
                          width: cellSize,
                          height: cellSize,
                          borderRadius: 2,
                          backgroundColor: LEVEL_COLORS[level],
                          border: level === 0 ? '1px solid var(--border)' : 'none',
                          cursor: 'pointer',
                          boxSizing: 'border-box',
                        }}
                        onMouseEnter={(e) => {
                          const rect = e.target.getBoundingClientRect();
                          setTooltip({
                            text: count > 0
                              ? `${key}: ${count}${t.workouts}`
                              : `${key}: ${t.noWorkout}`,
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 4,
            marginTop: 8,
            marginRight: 4,
          }}>
            <span style={{
              fontSize: 10,
              fontFamily: "'Barlow', sans-serif",
              color: 'var(--text-muted)',
              marginRight: 2,
            }}>
              {t.less}
            </span>
            {LEVEL_COLORS.map((color, i) => (
              <div key={i} style={{
                width: cellSize,
                height: cellSize,
                borderRadius: 2,
                backgroundColor: color,
                border: i === 0 ? '1px solid var(--border)' : 'none',
                boxSizing: 'border-box',
              }} />
            ))}
            <span style={{
              fontSize: 10,
              fontFamily: "'Barlow', sans-serif",
              color: 'var(--text-muted)',
              marginLeft: 2,
            }}>
              {t.more}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        marginTop: 16,
        paddingTop: 12,
        borderTop: '1px solid var(--border)',
      }}>
        {[
          { label: t.totalDays, value: stats.totalDays },
          { label: t.yearDays, value: stats.yearDays },
          { label: t.streak, value: stats.streak },
        ].map(({ label, value }, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 24,
              color: 'var(--accent)',
              lineHeight: 1,
            }}>
              {value}{t.days}
            </div>
            <div style={{
              fontFamily: "'Barlow', sans-serif",
              fontSize: 11,
              color: 'var(--text-secondary)',
              marginTop: 2,
            }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Tooltip (fixed position) */}
      {tooltip && (
        <div style={{
          position: 'fixed',
          left: tooltip.x,
          top: tooltip.y - 32,
          transform: 'translateX(-50%)',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          padding: '4px 8px',
          fontSize: 11,
          fontFamily: "'Barlow', sans-serif",
          color: 'var(--text-secondary)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 9999,
        }}>
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
