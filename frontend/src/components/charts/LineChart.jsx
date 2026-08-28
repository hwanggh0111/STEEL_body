import { useState } from 'react';
import { CHART } from '../../data/chartColors';
import { useWidth, niceScale, fmt } from './useWidth';

// 꺾은선. 인바디의 체중 추이 · 체지방/골격근 추이 · 히스토리의 체중이 같이 쓴다.
//
// 값이 없는 칸(null)은 이어 그리지 않고 **끊는다.** 이어버리면 안 잰 날을
// 잰 것처럼 보여준다.

const PAD = { top: 10, right: 10, bottom: 22, left: 34 };

export default function LineChart({ data, xKey, series, height = 180, unit = '' }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);

  const rows = Array.isArray(data) ? data : [];
  const shown = series.filter(s => rows.some(r => r[s.key] != null));
  if (rows.length === 0 || shown.length === 0) return <div ref={ref} style={{ height }} />;

  const values = rows.flatMap(r => shown.map(s => r[s.key])).filter(v => v != null);
  const scale = niceScale(Math.min(...values), Math.max(...values));

  const innerW = Math.max(1, w - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (rows.length === 1 ? innerW / 2 : (innerW * i) / (rows.length - 1));
  const y = (v) => PAD.top + innerH - ((v - scale.min) / (scale.max - scale.min)) * innerH;

  // 값이 없는 곳에서 선을 끊는다
  const pathOf = (key) => {
    let d = '';
    let pen = false;
    rows.forEach((r, i) => {
      const v = r[key];
      if (v == null) { pen = false; return; }
      d += (pen ? ' L' : ' M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1);
      pen = true;
    });
    return d.trim();
  };

  // 날짜를 다 적으면 겹친다. 폭에 맞춰 몇 칸씩 건너뛴다
  const every = Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor(innerW / 46))));

  // 마우스와 손가락이 같이 쓴다. **touches[0] 에는 currentTarget 이 없다** —
  // 그것만 넘기면 손가락으로 짚는 순간 터진다
  const pick = (e) => {
    const point = e.touches ? e.touches[0] : e;
    if (!point) return;
    const box = e.currentTarget.getBoundingClientRect();
    const rel = point.clientX - box.left - PAD.left;
    const i = Math.round((rel / innerW) * (rows.length - 1));
    setHover(Math.min(rows.length - 1, Math.max(0, i)));
  };

  const label = shown.map(s => s.label + ' ' + fmt(rows[hover]?.[s.key]) + unit).join(' · ');

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg width={w} height={height} role="img"
        aria-label={shown.map(s => s.label).join(' · ') + ' 추이 그래프'}
        onMouseMove={pick} onMouseLeave={() => setHover(null)}
        onTouchStart={pick} onTouchMove={pick} onTouchEnd={() => setHover(null)}>
        {scale.values.map(v => (
          <g key={v}>
            <line x1={PAD.left} x2={w - PAD.right} y1={y(v)} y2={y(v)} stroke={CHART.border} strokeWidth="1" />
            <text x={PAD.left - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill={CHART.muted}>{fmt(v)}</text>
          </g>
        ))}
        {rows.map((r, i) => (i % every === 0 || i === rows.length - 1) && (
          <text key={i} x={x(i)} y={height - 7} textAnchor="middle" fontSize="10" fill={CHART.muted}>{r[xKey]}</text>
        ))}
        {hover != null && (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke={CHART.muted} strokeWidth="1" strokeDasharray="3 3" />
        )}
        {shown.map(s => (
          <path key={s.key} d={pathOf(s.key)} fill="none" stroke={s.color} strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {shown.map(s => rows.map((r, i) => r[s.key] != null && (
          <circle key={s.key + i} cx={x(i)} cy={y(r[s.key])} r={hover === i ? 4 : 2.5} fill={s.color} />
        )))}
      </svg>

      {/* 말풍선 — 짚은 자리의 값. 그래프 밖에 두면 손가락에 안 가린다 */}
      <div style={{
        height: 18, fontSize: 11.5, textAlign: 'center', lineHeight: '18px',
        color: hover == null ? CHART.muted : CHART.text2,
      }}>
        {hover == null
          ? (shown.length > 1 ? shown.map(s => s.label).join(' · ') : '')
          : rows[hover][xKey] + ' — ' + label}
      </div>

      {shown.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 2 }}>
          {shown.map(s => (
            <span key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: CHART.text2 }}>
              <span style={{ width: 9, height: 2, background: s.color, display: 'inline-block' }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
