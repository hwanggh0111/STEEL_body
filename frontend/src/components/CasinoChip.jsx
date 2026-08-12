// 카지노 칩 아이콘 — 이모지에 칩이 없어서 인라인 SVG로 그림
// size: 픽셀 지름, color: 칩 본체 색, spinning: 회전 애니메이션

const EDGE_SPOTS = 6;        // 테두리 흰 구획 개수
const SPOT_ARC = 26;         // 구획 하나가 차지하는 각도(도)

export default function CasinoChip({
  size = 22,
  color = 'var(--accent)',
  spotColor = '#f5f5f5',
  spinning = false,
  style,
}) {
  // 원 둘레를 dash로 잘라 테두리 구획을 만든다 (r=44 기준)
  const r = 44;
  const circumference = 2 * Math.PI * r;
  const dash = (circumference * SPOT_ARC) / 360;
  const gap = circumference / EDGE_SPOTS - dash;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label="casino chip"
      style={{
        display: 'block',
        flexShrink: 0,
        animation: spinning ? 'spin 1.1s linear infinite' : undefined,
        ...style,
      }}
    >
      {/* 본체 */}
      <circle cx="50" cy="50" r="48" fill={color} />

      {/* 테두리 흰 구획 */}
      <circle
        cx="50" cy="50" r={r}
        fill="none"
        stroke={spotColor}
        strokeWidth="12"
        strokeDasharray={`${dash} ${gap}`}
        transform="rotate(-90 50 50)"
      />

      {/* 안쪽 링 */}
      <circle cx="50" cy="50" r="33" fill={color} />
      <circle
        cx="50" cy="50" r="30"
        fill="none"
        stroke={spotColor}
        strokeWidth="3"
        opacity="0.85"
      />

      {/* 중앙 원 + 하이라이트 */}
      <circle cx="50" cy="50" r="21" fill={spotColor} opacity="0.16" />
      <circle
        cx="50" cy="50" r="21"
        fill="none"
        stroke={spotColor}
        strokeWidth="2"
        opacity="0.5"
      />

      {/* 위쪽 광택 */}
      <ellipse
        cx="50" cy="26" rx="26" ry="11"
        fill="#ffffff" opacity="0.12"
      />
    </svg>
  );
}
