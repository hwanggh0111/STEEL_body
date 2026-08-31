import { CHART } from '../../data/chartColors';
import { useWidth, fmt } from './useWidth';

// 오각형(밸런스 비교).
//
// **축마다 눈금이 따로다.** 체중(kg) · 체지방(%) · BMI · 체수분(L) 을 한 눈금에
// 올려놓으면 kg 이 늘 바깥이고 %는 늘 안쪽이라 모양이 아무 말도 안 한다.
// 축마다 「그 축에서 큰 쪽」을 바깥으로 잡아 **두 시점의 차이**만 보이게 한다.

export default function Radar({ data, series, height = 260, width = 320 }) {
  const [ref, w] = useWidth(width);
  const rows = Array.isArray(data) ? data : [];
  if (rows.length < 3) return <div ref={ref} style={{ height }} />;

  const cx = w / 2;
  const cy = height / 2;
  // 축 이름과 「과거 → 현재」는 그물 **밖에** 적힌다. 옆으로 나갈 자리를 빼놓지 않으면
  // 좁은 폰에서 양옆 축의 값이 화면 밖으로 잘린다 (9.5px 글자 열한 자 ≈ 58px + 여백)
  const SIDE = 76;
  const r = Math.max(40, Math.min(cx - SIDE, cy - 34));
  const angle = (i) => -Math.PI / 2 + (Math.PI * 2 * i) / rows.length;

  // 축마다 0 ~ (그 축의 큰 값 × 1.15)
  const maxOf = (row) => Math.max(...series.map(s => row[s.key] ?? 0)) * 1.15 || 1;
  const point = (row, key, i, rr = r) => {
    const t = Math.max(0, Math.min(1, (row[key] ?? 0) / maxOf(row)));
    return [cx + rr * t * Math.cos(angle(i)), cy + rr * t * Math.sin(angle(i))];
  };
  const polygon = (key) => rows.map((row, i) => point(row, key, i).map(n => n.toFixed(1)).join(',')).join(' ');

  return (
    <div ref={ref}>
      <svg width={w} height={height} role="img"
        aria-label={'밸런스 비교 — ' + rows.map(x => x.subject).join(', ')}>
        {/* 그물 — 25% 씩 */}
        {[0.25, 0.5, 0.75, 1].map(k => (
          <polygon key={k} fill="none" stroke={CHART.border} strokeWidth="1"
            points={rows.map((_, i) => [cx + r * k * Math.cos(angle(i)), cy + r * k * Math.sin(angle(i))].map(n => n.toFixed(1)).join(',')).join(' ')} />
        ))}
        {rows.map((_, i) => (
          <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(angle(i))} y2={cy + r * Math.sin(angle(i))}
            stroke={CHART.border} strokeWidth="1" />
        ))}
        {series.map(s => (
          <polygon key={s.key} points={polygon(s.key)} fill={s.color} fillOpacity="0.28"
            stroke={s.color} strokeWidth="2" />
        ))}
        {rows.map((row, i) => {
          const a = angle(i);
          const lx = cx + (r + 18) * Math.cos(a);
          const ly = cy + (r + 18) * Math.sin(a);
          const anchor = Math.abs(Math.cos(a)) < 0.25 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
          return (
            <g key={i}>
              <text x={lx} y={ly + 3} textAnchor={anchor} fontSize="11" fill={CHART.text2}>{row.subject}</text>
              <text x={lx} y={ly + 15} textAnchor={anchor} fontSize="9.5" fill={CHART.muted}>
                {series.map(s => fmt(row[s.key])).join(' → ')}
              </text>
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
      <div style={{ fontSize: 10.5, color: CHART.muted, textAlign: 'center', marginTop: 6, lineHeight: 1.6 }}>
        단위가 서로 달라 축마다 눈금이 따로입니다 — 모양이 아니라 <b>두 시점의 차이</b>를 봅니다
      </div>
    </div>
  );
}
