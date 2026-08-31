import { CHART } from '../../data/chartColors';
import { useWidth, fmt } from './useWidth';

// 도넛. 인바디의 체성분(골격근 · 체지방 · 체수분 · 기타)에 쓴다.
//
// 가운데에 합을 적는다 — 조각 넷의 이름과 값은 아래 범례가 이미 말하고 있어서,
// 조각 옆에 또 적으면 글자만 겹친다.

const TAU = Math.PI * 2;

// 조각 하나를 도넛 모양 path 로. 사이는 살짝 벌린다
function arc(cx, cy, rOut, rIn, from, to) {
  const big = to - from > Math.PI ? 1 : 0;
  const p = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x1, y1] = p(rOut, from);
  const [x2, y2] = p(rOut, to);
  const [x3, y3] = p(rIn, to);
  const [x4, y4] = p(rIn, from);
  return `M${x1} ${y1} A${rOut} ${rOut} 0 ${big} 1 ${x2} ${y2} L${x3} ${y3} A${rIn} ${rIn} 0 ${big} 0 ${x4} ${y4} Z`;
}

export default function Donut({ data, total, height = 280, width = 320 }) {
  const [ref, w] = useWidth(width);
  const parts = (Array.isArray(data) ? data : []).filter(d => d && d.value > 0);
  const sum = parts.reduce((s, d) => s + d.value, 0);
  if (!parts.length || sum <= 0) return <div ref={ref} style={{ height }} />;

  const cx = w / 2;
  const cy = height / 2;
  const rOut = Math.min(cx, cy) - 8;
  const rIn = rOut * 0.66;
  const gap = parts.length > 1 ? 0.03 : 0;   // 조각 사이

  // 조각이 하나뿐이면 원 하나다. 시작점과 끝점이 같아서 호(arc)로는 못 그린다 —
  // 반원 둘로 나눠 그린다
  if (parts.length === 1) {
    const one = parts[0];
    return (
      <div ref={ref}>
        <svg width={w} height={height} role="img" aria-label={one.name + ' ' + fmt(one.value) + 'kg'}>
          <path d={arc(cx, cy, rOut, rIn, -Math.PI / 2, Math.PI / 2)} fill={one.color} />
          <path d={arc(cx, cy, rOut, rIn, Math.PI / 2, Math.PI * 1.5)} fill={one.color} />
          <text x={cx} y={cy - 4} textAnchor="middle" fontSize="24" fill={CHART.text}
            fontFamily="'Bebas Neue', sans-serif" letterSpacing="1">{fmt(total || sum)}</text>
          <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10.5" fill={CHART.muted}>kg</text>
        </svg>
      </div>
    );
  }

  let a = -Math.PI / 2;   // 12시부터
  const slices = parts.map(d => {
    const from = a + gap / 2;
    const to = a + (d.value / sum) * TAU - gap / 2;
    a += (d.value / sum) * TAU;
    return { ...d, d: arc(cx, cy, rOut, rIn, from, Math.max(from + 0.001, to)) };
  });

  return (
    <div ref={ref}>
      <svg width={w} height={height} role="img"
        aria-label={'체성분 ' + parts.map(p => p.name + ' ' + fmt(p.value) + 'kg').join(', ')}>
        {slices.map((s, i) => <path key={i} d={s.d} fill={s.color} />)}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="24" fill={CHART.text}
          fontFamily="'Bebas Neue', sans-serif" letterSpacing="1">{fmt(total || sum)}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10.5" fill={CHART.muted}>kg</text>
      </svg>
    </div>
  );
}
