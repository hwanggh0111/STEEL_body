import { useState } from 'react';
import { CHART } from '../../data/chartColors';
import { useWidth, niceScale, fmt, labelIndices, pickIndex } from './useWidth';

// 꺾은선. 인바디의 체중 추이 · 체지방/골격근 추이 · 히스토리의 체중이 같이 쓴다.
//
// 값이 없는 칸(null)은 이어 그리지 않고 **끊는다.** 이어버리면 안 잰 날을
// 잰 것처럼 보여준다.

const PAD = { top: 10, right: 10, bottom: 22, left: 34 };

// 단위를 맨 위 눈금에 붙이면 그만큼 **왼쪽으로 더 나간다** — 34px 안에 안 들어가면
// 「71.5kg」의 앞머리가 그림 밖으로 잘린다(자가 바로 잡았다: `폭 넷 — 글자가 그래프
// 밖으로 나가지 않는다`). 단위가 있을 때만 왼쪽을 넓힌다. 글자 한 자 ≈ 5.5px
const padLeft = (unit) => PAD.left + (unit ? Math.ceil(String(unit).length * 5.5) : 0);

// 그래프 아래 한 줄. 짚기 전에는 줄 이름, 짚으면 그 날짜의 값.
// 짚는 것은 화면이 있어야 하지만 **무슨 말이 나오는지**는 여기서 확인된다
export function hoverText(rows, hover, shown, xKey, unit = '') {
  const row = hover == null ? null : rows[hover];
  if (!row) return shown.length > 1 ? shown.map(s => s.label).join(' · ') : '';
  return row[xKey] + ' — ' + shown.map(s => s.label + ' ' + fmt(row[s.key]) + unit).join(' · ');
}

export default function LineChart({ data, xKey, series, height = 180, unit = '', width = 320 }) {
  const [ref, w] = useWidth(width);
  const L = padLeft(unit);
  const [hover, setHover] = useState(null);

  const rows = Array.isArray(data) ? data : [];
  const shown = series.filter(s => rows.some(r => r[s.key] != null));
  if (rows.length === 0 || shown.length === 0) return <div ref={ref} style={{ height }} />;

  const values = rows.flatMap(r => shown.map(s => r[s.key])).filter(v => v != null);
  const scale = niceScale(Math.min(...values), Math.max(...values));

  const innerW = Math.max(1, w - L - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const x = (i) => L + (rows.length === 1 ? innerW / 2 : (innerW * i) / (rows.length - 1));
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
  const marks = labelIndices(rows.length, innerW);

  // 마우스와 손가락이 같이 쓴다. **touches[0] 에는 currentTarget 이 없다** —
  // 그것만 넘기면 손가락으로 짚는 순간 터진다
  const pick = (e) => {
    const point = e.touches ? e.touches[0] : e;
    if (!point) return;
    const box = e.currentTarget.getBoundingClientRect();
    setHover(pickIndex(point.clientX - box.left - L, innerW, rows.length));
  };


  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg width={w} height={height} role="img"
        aria-label={shown.map(s => s.label).join(' · ') + ' 추이 그래프'}
        onMouseMove={pick} onMouseLeave={() => setHover(null)}
        onTouchStart={pick} onTouchMove={pick} onTouchEnd={() => setHover(null)}>
        {/* ── **눈금에 단위가 한 번도 안 적혔다** ── (2026-11-11)
            단위(`unit`)는 짚었을 때 뜨는 말풍선에만 쓰였다. 그래서 **가만히 놓인
            그림만 보면** 18 · 20 · 22 가 %인지 kg인지 L인지 알 길이 없었다 —
            체지방률과 체중을 둘 다 그리는 앱에서 그것은 뜻이 반쯤 빈 그림이다.
            **맨 위 눈금에만** 붙인다. 눈금마다 붙이면 넷이 되고, 축은 왼쪽 34px
            안에 들어가야 한다 (`PAD.left`). 위가 곧 「이 축이 무엇인가」다 */}
        {scale.values.map((v, i) => (
          <g key={v}>
            <line x1={L} x2={w - PAD.right} y1={y(v)} y2={y(v)} stroke={CHART.border} strokeWidth="1" />
            <text x={L - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill={CHART.muted}>
              {fmt(v)}{unit && i === scale.values.length - 1 ? unit : ''}
            </text>
          </g>
        ))}
        {/* 마지막 날짜는 오른쪽 끝에 있다. 가운데 맞춤으로 두면 절반이 그래프 밖으로
            잘려 나간다 — 끝에서 안쪽으로 적는다 */}
        {marks.map(i => (
          <text key={i} x={x(i)} y={height - 7} fontSize="10" fill={CHART.muted}
            textAnchor={i === rows.length - 1 && rows.length > 1 ? 'end' : 'middle'}>{rows[i][xKey]}</text>
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
        {hoverText(rows, hover, shown, xKey, unit)}
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
