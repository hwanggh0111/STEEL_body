import { CHART } from '../../data/chartColors';
import { useWidth } from './useWidth';
import { radarGeom, pointsAttr } from '../../data/chartGeom';

// 오각형(두 시점 비교).
//
// **점 자리 셈은 `data/chartGeom.js` 가 한다** (2026-11-05). 여기는 그리기만 한다.
// 그림은 무엇을 먹여도 그럴듯한 별 모양이라 눈으로는 틀린 것이 안 보인다 —
// `npm run draw` 가 좌표와 라벨을 값으로 본다. 그러다 셋을 잡았다:
// **단위가 안 적혀 있었고**(표는 「22%」, 그림은 「22」), **좁은 폰에서 양옆 값이
// 잘렸고**, **값 하나가 숫자가 아니면 다각형이 통째로 사라졌다**.

export default function Radar({ data, series, height = 260, width = 320 }) {
  const [ref, w] = useWidth(width);
  const g = radarGeom(data, series, { width: w, height });
  if (!g.ok) return <div ref={ref} style={{ height }} />;

  return (
    <div ref={ref}>
      <svg width={w} height={height} role="img"
        aria-label={'두 시점 비교 — ' + g.axes.map((a) => `${a.subject} ${a.valueText}`).join(', ')}>
        {/* 그물 — 25% 씩 */}
        {g.rings.map((ring) => (
          <polygon key={ring.k} fill="none" stroke={CHART.border} strokeWidth="1" points={pointsAttr(ring.points)} />
        ))}
        {g.axes.map((a, i) => (
          <line key={i} x1={g.cx} y1={g.cy} x2={a.x2} y2={a.y2} stroke={CHART.border} strokeWidth="1" />
        ))}
        {series.map((s) => {
          const pts = pointsAttr(g.points[s.key]);
          return pts && (
            <polygon key={s.key} points={pts} fill={s.color} fillOpacity="0.28" stroke={s.color} strokeWidth="2" />
          );
        })}
        {g.axes.map((a, i) => (
          <g key={i}>
            <text x={a.lx} y={a.ly + 3} textAnchor={a.anchor} fontSize="11" fill={CHART.text2}>{a.subject}</text>
            {/* 좁으면 값은 축 옆에 안 적는다 — 그림 밖으로 나간다. 아래에 모아 적는다 */}
            {!g.tight && (
              <text x={a.lx} y={a.ly + 15} textAnchor={a.anchor} fontSize={g.valueFont} fill={CHART.muted}>
                {a.valueText}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* 좁은 폰 — 값을 그물 밑에 모은다 */}
      {g.tight && (
        <div style={{ fontSize: 11, color: CHART.muted, lineHeight: 1.8, marginTop: 2 }}>
          {g.axes.map((a) => (
            <div key={a.subject} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ color: CHART.text2 }}>{a.subject}</span>
              <span>{a.valueText}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 2 }}>
        {series.map((s) => (
          <span key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: CHART.text2 }}>
            <span style={{ width: 9, height: 9, background: s.color, borderRadius: 2, display: 'inline-block' }} />
            {s.label}
          </span>
        ))}
      </div>
      {/* 숫자로 안 읽힌 축은 **뺐다고 말한다** — 조용히 빼면 「그 항목은 안 변했나」가 된다 */}
      {g.dropped.length > 0 && (
        <div style={{ fontSize: 10.5, color: CHART.muted, textAlign: 'center', marginTop: 6 }}>
          그림에서 뺀 축 — {g.dropped.join(' · ')} (숫자로 읽히지 않아요)
        </div>
      )}
      <div style={{ fontSize: 10.5, color: CHART.muted, textAlign: 'center', marginTop: 6, lineHeight: 1.6 }}>
        단위가 서로 달라 축마다 눈금이 따로입니다 — 모양이 아니라 <b>두 시점의 차이</b>를 봅니다
      </div>
    </div>
  );
}
