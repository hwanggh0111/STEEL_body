// STEEL BODY 로고. **앱의 모든 자리가 이것 하나를 쓴다.**
//
// 2026-08-28 전까지는 로고가 세 벌이었다 — 머리는 Playfair 이탤릭, 미니 스플래시는
// Great Vibes 필기체, 로그인은 Bebas. 같은 앱에서 셋이면 어느 것도 로고가 아니다.
//
// 규칙은 넷이다.
//   · 마크는 격자 24칸에 획 2칸 — 글자의 세로획과 같은 굵기다
//   · 마크 높이 = 대문자 높이(cap). 밑선이 맞는다
//   · 마크와 글자 사이 여백 = 획 × 4
//   · S 한 글자만 세리프. 나머지는 앱이 쓰는 Bebas 다
//
// 색은 `--accent` 계열을 쓴다. **마크는 `currentColor` 로 받는다** — SVG 속성
// 안에서는 `var(--accent)` 가 치환되지 않아 값이 통째로 무시된다 (오늘 그래프에서
// 같은 것에 걸렸다). 그래서 감싼 요소의 `color` 로 흘려보낸다.

const STROKE = 2;          // 격자 24칸 기준
const RING = 1;            // 링은 획의 절반 — 가둔다기보다 감싼다

// 배지 마크 — 얇은 링 안에 바벨
export function LogoMark({ size = 24, style }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"
      style={{ color: 'var(--accent)', flexShrink: 0, display: 'block', ...style }}
    >
      <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth={RING} opacity="0.7" />
      <g stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round">
        <path d="M10.3 12 H13.7" />
        <path d="M9.2 6.4 V17.6" />
        <path d="M14.8 6.4 V17.6" />
      </g>
      <g stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" opacity="0.55">
        <path d="M6.7 8.8 V15.2" />
        <path d="M17.3 8.8 V15.2" />
      </g>
    </svg>
  );
}

// 금속 결 — 얕게. 위가 밝고 아래가 가라앉는다. 번쩍이면 싸 보인다
const metal = (deep) => ({
  backgroundImage: deep
    ? 'linear-gradient(172deg, var(--accent-hover) 0%, var(--accent) 38%, var(--accent-low) 74%, var(--accent-hover) 100%)'
    : 'linear-gradient(175deg, var(--accent-hover) 0%, var(--accent) 42%, var(--accent-low) 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  color: 'var(--accent)',
  ...(deep ? { textShadow: '0 1px 0 rgba(0,0,0,0.5)' } : null),
});

// 워드마크 — S 한 글자만 세리프
export function LogoWord({ cap = 19, style }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', whiteSpace: 'nowrap', ...style }}>
      <span style={{
        fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 700,
        fontSize: cap * 1.28, lineHeight: 1, marginRight: cap * 0.02, ...metal(true),
      }}>S</span>
      <span style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: cap, letterSpacing: cap * 0.22, lineHeight: 1, ...metal(false),
      }}>TEEL BODY</span>
    </span>
  );
}

// 금선 두 겹 — 가는 선 위에 더 가는 선. 얇은데도 또렷하다. 큰 자리에만 쓴다
function Rule({ width = '100%', gap = 2 }) {
  return (
    <span style={{ width, display: 'flex', flexDirection: 'column', gap }}>
      <span style={{ height: 1, background: 'linear-gradient(90deg, transparent, var(--accent) 18%, var(--accent) 82%, transparent)' }} />
      <span style={{ height: 1, background: 'linear-gradient(90deg, transparent, var(--accent-low) 30%, var(--accent-low) 70%, transparent)', opacity: 0.55 }} />
    </span>
  );
}

/**
 * 로고 한 벌.
 *
 * `cap` 은 대문자 높이(px). 마크가 같은 높이로 따라온다.
 * `variant`
 *   'row'   머리 · 탭바 — 마크 + 글자. 금선과 부제는 안 넣는다 (작은 자리에서는 과하다)
 *   'stack' 스플래시 · 로그인 — 마크 · 금선 · 글자 · 금선 · 부제까지 다 넣는다
 *   'word'  글자만 (마크를 따로 놓는 자리)
 *   'mark'  마크만 (아이콘 자리)
 */
export default function Logo({ cap = 19, variant = 'row', subtitle = 'RECORD YOUR TRAINING', style, ...rest }) {
  if (variant === 'mark') return <LogoMark size={cap * 1.15} style={style} {...rest} />;
  if (variant === 'word') return <LogoWord cap={cap} style={style} {...rest} />;

  if (variant === 'stack') {
    return (
      <span style={{
        display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
        gap: cap * 0.30, ...style,
      }} {...rest}>
        <LogoMark size={cap * 2.1} />
        <Rule gap={Math.max(1, cap * 0.05)} />
        <LogoWord cap={cap} />
        <Rule width="72%" gap={Math.max(1, cap * 0.05)} />
        {subtitle ? (
          <span style={{
            fontFamily: "'Barlow', sans-serif", fontWeight: 500,
            fontSize: cap * 0.30, letterSpacing: cap * 0.24,
            color: 'var(--accent-low)', whiteSpace: 'nowrap',
          }}>{subtitle}</span>
        ) : null}
      </span>
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', ...style }} {...rest}>
      <LogoMark size={cap * 1.15} />
      <span style={{ width: cap * 0.42, flexShrink: 0 }} />
      <LogoWord cap={cap} />
    </span>
  );
}
