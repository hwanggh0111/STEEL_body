// BLACK IRON 로고. **앱의 모든 자리가 이것 하나를 쓴다.**
//
// 2026-09-01 에 이름을 STEEL BODY → IRONLOG → **BLACK IRON** 으로 정하면서 다시 그렸다.
// (2026-08-28 전까지는 로고가 세 벌이었다 — 머리는 Playfair 이탤릭, 미니 스플래시는
// Great Vibes 필기체, 로그인은 Bebas. 같은 앱에서 셋이면 어느 것도 로고가 아니다.)
//
// 앞의 로고는 「링 안의 바벨 + 금색 글자」였다. 나쁘지 않았지만 **평범했다** —
// 헬스 앱 아이콘의 절반이 원 안에 바벨을 넣는다. 그리고 글자가 한 덩어리라
// 이름이 두 낱말이라는 것이 안 보였다.
//
// 고급스러움은 번쩍임이 아니라 **여백 · 자간 · 굵기 차이**에서 나온다. 규칙 다섯:
//
//   · **두 낱말을 다르게 다룬다.** BLACK 은 가늘고 넓게(자간 큼 · 어두운 금),
//     IRON 은 굵고 또렷하게. 같은 크기로 나란히 두면 그냥 긴 글자다
//   · **마크는 원판을 옆에서 본 모양**(마름모)에 봉이 지난다. 원 안 바벨을 피하고,
//     45도로 꺾인 각이라 작은 자리에서도 안 뭉갠다
//   · 마크 높이 = 대문자 높이(cap). 밑선이 맞는다
//   · 금속 결은 **얕게 한 겹**. 위가 밝고 아래가 가라앉는다 — 번쩍이면 싸 보인다
//   · 큰 자리(스플래시 · 로그인)에서만 금선과 부제를 넣는다
//
// 색은 `--accent` 계열이다. **마크는 `currentColor` 로 받는다** — SVG 속성 안에서는
// `var(--accent)` 가 치환되지 않아 값이 통째로 무시된다 (8/28 에 그래프에서 겪었다).
// 그래서 감싼 요소의 `color` 로 흘려보낸다.

const STROKE = 1.9;        // 격자 24칸 기준 — 글자의 세로획과 같은 굵기
const HAIR = 0.9;          // 테두리는 획의 절반. 가둔다기보다 감싼다

/**
 * 마크 — **원판을 옆에서 본 마름모**에 봉이 지난다.
 *
 * 바깥은 각진 테두리(마름모), 안은 작은 마름모, 가운데를 봉이 가로지른다.
 * 원이 아니라 각이라 금색이 모서리에서 한 번 꺾이고, 그게 금속처럼 보인다.
 */
export function LogoMark({ size = 24, style }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"
      style={{ color: 'var(--accent)', flexShrink: 0, display: 'block', ...style }}
    >
      {/* 바깥 마름모 — 원판의 옆모습 */}
      <path d="M12 1.8 22.2 12 12 22.2 1.8 12Z"
        stroke="currentColor" strokeWidth={HAIR} opacity="0.75" strokeLinejoin="round" />
      {/* 안쪽 마름모 — 두 겹이 되면 깊이가 생긴다 */}
      <path d="M12 6.4 17.6 12 12 17.6 6.4 12Z"
        stroke="currentColor" strokeWidth={HAIR} opacity="0.45" strokeLinejoin="round" />
      {/* 봉 — 가운데를 가로지른다. 양끝이 테두리 밖으로 살짝 걸린다 */}
      <path d="M3.4 12H20.6" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" />
      {/* 원판 두 장 — 봉에 끼운 것 */}
      <path d="M8.9 8.7V15.3M15.1 8.7V15.3"
        stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" />
    </svg>
  );
}

// 금속 결 — 얕게. 위가 밝고 아래가 가라앉는다.
// `deep` 은 굵은 글자용(대비를 조금 더), 아닌 쪽은 가는 글자용이다
const metal = (deep) => ({
  backgroundImage: deep
    ? 'linear-gradient(172deg, var(--accent-hover) 0%, var(--accent) 40%, var(--accent-low) 78%, var(--accent-hover) 100%)'
    : 'linear-gradient(175deg, var(--accent) 0%, var(--accent-low) 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  color: 'var(--accent)',
  ...(deep ? { textShadow: '0 1px 0 rgba(0,0,0,0.45)' } : null),
});

/**
 * 워드마크 — **BLACK 은 가늘고 넓게, IRON 은 굵고 또렷하게.**
 *
 * 두 낱말을 같은 크기로 나란히 두면 그냥 긴 글자다. 굵기와 자간을 갈라놓으면
 * 이름이 두 낱말이라는 것이 한눈에 보이고, 그 차이가 고급스러움을 만든다.
 * (BLACK 은 가라앉고 IRON 이 올라온다 — 이름이 뜻하는 것과도 맞는다)
 */
export function LogoWord({ cap = 19, style }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', whiteSpace: 'nowrap', ...style }}>
      <span style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: cap * 0.82,
        letterSpacing: cap * 0.40,   // 넓게 — 여백이 고급을 만든다
        lineHeight: 1,
        opacity: 0.72,
        ...metal(false),
      }}>BLACK</span>
      {/* 자간이 마지막 글자 뒤에도 붙으므로 사이는 조금만 벌린다 */}
      <span style={{ width: cap * 0.10, flexShrink: 0 }} />
      <span style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: cap,
        letterSpacing: cap * 0.16,
        lineHeight: 1,
        ...metal(true),
      }}>IRON</span>
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
        gap: cap * 0.34, ...style,
      }} {...rest}>
        <LogoMark size={cap * 2.2} />
        <Rule gap={Math.max(1, cap * 0.05)} />
        <LogoWord cap={cap} />
        <Rule width="72%" gap={Math.max(1, cap * 0.05)} />
        {subtitle ? (
          <span style={{
            fontFamily: "'Barlow', sans-serif", fontWeight: 500,
            fontSize: cap * 0.30, letterSpacing: cap * 0.26,
            color: 'var(--accent-low)', whiteSpace: 'nowrap',
          }}>{subtitle}</span>
        ) : null}
      </span>
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', ...style }} {...rest}>
      <LogoMark size={cap * 1.15} />
      <span style={{ width: cap * 0.46, flexShrink: 0 }} />
      <LogoWord cap={cap} />
    </span>
  );
}
