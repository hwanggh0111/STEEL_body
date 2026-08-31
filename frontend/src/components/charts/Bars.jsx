import { useState } from 'react';
import { CHART } from '../../data/chartColors';
import { useWidth, niceScale, fmt } from './useWidth';

// 묶음 막대. 비교 화면의 「과거 vs 현재」에 쓴다.

const PAD = { top: 12, right: 10, bottom: 34, left: 34 };

export default function Bars({ data, series, height = 220, width = 320 }) {
  const [ref, w] = useWidth(width);
  const [hover, setHover] = useState(null);

  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) return <div ref={ref} style={{ height }} />;

  const values = rows.flatMap(r => series.map(s => r[s.key])).filter(v => v != null);
  // 막대는 0 에서 시작해야 길이가 값을 말한다. 아래를 잘라내면 두 배 차이처럼 보인다
  const scale = niceScale(Math.min(0, ...values), Math.max(...values));

  const innerW = Math.max(1, w - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const slot = innerW / rows.length;
  const barW = Math.min(18, (slot * 0.62) / series.length);
  const y = (v) => PAD.top + innerH - ((v - scale.min) / (scale.max - scale.min)) * innerH;

  return (
    <div ref={ref}>
      <svg width={w} height={height} role="img"
        aria-label={'과거와 현재 비교 — ' + rows.map(r => r.name).join(', ')}
        onMouseLeave={() => setHover(null)}>
        {scale.values.map(v => (
          <g key={v}>
            <line x1={PAD.left} x2={w - PAD.right} y1={y(v)} y2={y(v)} stroke={CHART.border} strokeWidth="1" />
            <text x={PAD.left - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill={CHART.muted}>{fmt(v)}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const mid = PAD.left + slot * (i + 0.5);
          const start = mid - (barW * series.length) / 2;
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              {/* 짚기 쉬우라고 칸 전체를 받는다 */}
              <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={innerH} fill="transparent" />
              {series.map((s, j) => r[s.key] != null && (
                <rect key={s.key} x={start + barW * j} y={Math.min(y(r[s.key]), y(scale.min > 0 ? scale.min : 0))}
                  width={barW - 2} rx="2"
                  height={Math.abs(y(r[s.key]) - y(scale.min > 0 ? scale.min : 0))}
                  fill={s.color} opacity={hover == null || hover === i ? 1 : 0.45} />
              ))}
              <text x={mid} y={height - 20} textAnchor="middle" fontSize="10" fill={CHART.muted}>{r.name}</text>
              {hover === i && (
                <text x={mid} y={height - 7} textAnchor="middle" fontSize="10.5" fill={CHART.text2}>
                  {series.map(s => fmt(r[s.key])).join(' → ')}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 2 }}>
        {series.map(s => (
          <span key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: CHART.text2 }}>
            <span style={{ width: 9, height: 9, background: s.color, borderRadius: 2, display: 'inline-block' }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
