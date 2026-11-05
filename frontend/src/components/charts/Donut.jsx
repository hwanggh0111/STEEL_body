import { CHART } from '../../data/chartColors';
import { useWidth, fmt } from './useWidth';
import { donutSlices, arcPath, TOP } from '../../data/chartGeom';

// 도넛. 인바디의 체성분(골격근 · 체지방 · 기타)에 쓴다.
//
// 가운데에 합을 적는다 — 조각의 이름과 값은 아래 범례가 이미 말하고 있어서,
// 조각 옆에 또 적으면 글자만 겹친다.
//
// **각도 셈은 `data/chartGeom.js` 가 한다** (2026-11-05). 여기는 그리기만 한다 —
// 도넛은 무엇을 먹여도 꽉 찬 원이라 **눈으로는 틀린 것을 못 본다.**
// `npm run draw` 가 조각 각도를 값으로 본다 (그러다 **사이를 벌리는 폭보다 좁은
// 조각이 사라지던 것**을 잡았다).

export default function Donut({ data, total, height = 280, width = 320 }) {
  const [ref, w] = useWidth(width);
  const { slices, sum, center, full } = donutSlices(data, { total });
  if (!slices.length) return <div ref={ref} style={{ height }} />;

  const cx = w / 2;
  const cy = height / 2;
  const rOut = Math.max(12, Math.min(cx, cy) - 8);
  const rIn = rOut * 0.66;

  // 조각이 하나뿐이면 원 하나다. 시작점과 끝점이 같아서 호(arc)로는 못 그린다 —
  // 반원 둘로 나눠 그린다
  const paths = full
    ? [arcPath(cx, cy, rOut, rIn, TOP, TOP + Math.PI), arcPath(cx, cy, rOut, rIn, TOP + Math.PI, TOP + Math.PI * 2)]
      .map((d, i) => ({ key: `half${i}`, d, color: slices[0].color }))
    : slices.map((s, i) => ({ key: i, d: arcPath(cx, cy, rOut, rIn, s.from, s.to), color: s.color }));

  return (
    <div ref={ref}>
      <svg width={w} height={height} role="img"
        aria-label={'체성분 ' + slices.map((p) => p.name + ' ' + fmt(p.value) + 'kg').join(', ')}>
        {paths.map((p) => <path key={p.key} d={p.d} fill={p.color} />)}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="24" fill={CHART.text}
          fontFamily="'Bebas Neue', 'IBM Plex Sans KR', sans-serif" letterSpacing="1">{fmt(center || sum)}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10.5" fill={CHART.muted}>kg</text>
      </svg>
    </div>
  );
}
