import { FRONT, BACK, HEAD, VIEWBOX, GOLD, GOLD_LOW, SKIN, SKIN_EDGE } from '../bodyShapes';

// 홈페이지의 몸 지도 미리보기 (2026-10-06).
//
// ── 왜 ──
//
// 이 앱이 내세우는 한 가지는 **「몸이 변하는 걸 눈으로 보여준다」**다.
// 그런데 홈페이지는 그것을 **글자로만** 말하고 있었다 — 「이 앱이 하는 것」 상자에
// 「몸 지도 · 최근에 자극한 부위가 금빛으로 달아 있고…」라고 적혀 있을 뿐,
// 앱 화면 그림이 **한 장도 없었다.**
//
// 모르는 사람이 `/site` 에 들어오면 한 줄 소개를 읽고 **바로 운동 찾기 칸**을
// 만났다. 운동 사전 찾기는 이 앱에서 **가장 차별점이 없는 것**이다. 「그래서 뭘
// 보여주는데」의 답은 한참 내려가야 나왔다.
//
// **주장 바로 다음에 증거를 놓는다.** 그 증거는 그림이어야 한다 — 눈으로 보여주는
// 앱이라고 말했으니까.
//
// ── 0 바이트다 ──
//
// 그림을 새로 그리지 않는다. 「몸」 탭의 지도와 운동 카드의 작은 몸이 쓰는
// **같은 조각**(`components/bodyShapes.jsx`)을 그대로 쓴다. 스크린샷을 올리면
// 화면을 고칠 때마다 그림이 옛말이 되는데, 이것은 **앱이 바뀌면 같이 바뀐다.**
//
// ── 지어내지 않는다 ──
//
// 이 화면의 원칙이다 — 쓰는 사람 수도 후기도 별점도 없다. 그래서 이 그림도
// **「예시」라고 적는다.** 누군가의 실제 기록이 아니다.

// 보여줄 한 주. **고르게 칠하지 않는다** — 다 뜨겁거나 다 식으면 지도가
// 「달아오름이 식는다」는 말을 못 한다. 오늘 한 곳 하나, 식는 중 둘, 식은 곳 하나.
const DEMO = [
  { part: '가슴', level: 3, ago: '오늘' },
  { part: '등', level: 2, ago: '2일 전' },
  { part: '하체', level: 1, ago: '닷새 전' },
  { part: '어깨', level: 0, ago: '엿새 전' },
];

/** 달아오른 정도 → 칠. 지도와 같은 값을 쓴다(`BodyMap.jsx`). */
function paintOf(level) {
  if (level >= 3) return { fill: GOLD, opacity: 0.82 };
  if (level === 2) return { fill: GOLD_LOW, opacity: 0.5 };
  if (level === 1) return { fill: GOLD_LOW, opacity: 0.22 };
  return null;
}

/**
 * 몸 하나. 한 부위만 칠한다.
 *
 * 선 굵기는 크기와 반대로 간다 — 240 짜리 좌표계를 44px 로 줄이면 원래 굵기로는
 * 테두리가 사라진다 (운동 카드의 작은 몸과 같은 계산이다).
 */
function One({ part, level, size = 44 }) {
  const shapes = part === '등' ? BACK : FRONT;
  const paint = paintOf(level);
  const stroke = (1.4 * 24 / size).toFixed(2);
  return (
    <svg
      width={size}
      height={Math.round(size * 2.38)}
      viewBox={VIEWBOX}
      fill="none"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <g fill={SKIN} stroke={SKIN_EDGE} strokeWidth={stroke}>
        {HEAD}
        {Object.entries(shapes).map(([name, shape]) => (
          <g key={name}>{shape}</g>
        ))}
      </g>
      {/* 식은 곳은 **칠하지 않는다.** 없는 것을 색으로 칠하면 있는 것과
          구별이 안 된다 — 지도가 지키는 규칙이다 */}
      {paint && <g fill={paint.fill} opacity={paint.opacity}>{shapes[part]}</g>}
    </svg>
  );
}

export default function MapPreview({ id, onGo, style }) {
  return (
    <section
      id={id}
      aria-label="몸 지도 미리보기"
      style={{
        background: 'var(--card-bg)', border: '1px solid var(--border)',
        boxShadow: 'var(--card-edge)', borderRadius: 'var(--radius)',
        padding: '15px 16px 14px', ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
        <h2 style={{
          fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif", fontSize: 17, letterSpacing: 2,
          color: 'var(--text-primary)', margin: 0, fontWeight: 400,
        }}>이렇게 보여줍니다</h2>
        {/* **지어내지 않는다** — 누군가의 실제 기록이 아니라고 그 자리에 적는다 */}
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>예시</span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 14px' }}>
        최근에 자극한 곳이 <span style={{ color: 'var(--accent)' }}>금빛으로 달아</span> 있고
        날이 갈수록 식습니다. 그래서 <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>오늘
        어디를 할지</strong>가 숫자가 아니라 그림으로 보입니다.
      </p>

      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around',
        gap: 10, marginBottom: 12,
      }}>
        {DEMO.map(({ part, level, ago }) => (
          <div key={part} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
            <One part={part} level={level} />
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif", fontSize: 12.5, letterSpacing: 1.2,
                color: level > 0 ? 'var(--text-primary)' : 'var(--accent-low)',
              }}>{part}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>{ago}</div>
            </div>
          </div>
        ))}
      </div>

      {/* **식은 곳이 답이다.** 그림만 두면 「금색이 많은 게 좋은 것」으로 읽힌다 —
          이 지도가 말하는 것은 그 반대다 */}
      <p style={{
        fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.7,
        margin: 0, paddingTop: 11, borderTop: '1px solid var(--border)',
      }}>
        위라면 오늘은 <strong style={{ color: 'var(--accent-low)', fontWeight: 600 }}>어깨</strong>입니다 —
        가장 오래 쉰 곳이니까요.
        {onGo && (
          <>
            {' '}
            <button
              onClick={onGo}
              style={{
                background: 'none', border: 'none', padding: 0, font: 'inherit',
                color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline',
              }}
            >내 몸 지도 보기</button>
          </>
        )}
      </p>
    </section>
  );
}
