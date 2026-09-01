// BLACK IRON 로고. **앱의 모든 자리가 이것 하나를 쓴다.**
//
// 2026-09-01 저녁에 세 번째로 고쳤다. 앞의 두 판이 촌스러웠던 이유는 분명하다 —
// **금색 그라데이션 글자 · 글자 그림자 · 굵기 대비.** 셋 다 「번쩍이게」 만드는 장치다.
// 금속처럼 보이려고 넣은 것인데, 화면에서 금속을 흉내 내면 대개 싸 보인다.
//
// 고급은 그 반대다. **납작한 한 색 · 가는 선 · 넓은 여백.**
//
//   · 글자는 **한 색으로 납작하게.** 그라데이션도 그림자도 없다
//   · 두 낱말을 **같은 크기 · 같은 굵기**로 두고, 사이를 **머리카락 선** 하나로 가른다.
//     굵기로 차이를 주면 광고 문구처럼 보이고, 선 하나로 가르면 표지처럼 보인다
//   · 글자체는 **Barlow 300**(가는 것). 자간을 아주 넓게(0.42em) 벌린다 —
//     여백이 고급을 만든다. 앱의 제목(Bebas)과 굳이 같게 하지 않는다.
//     로고는 UI 글자와 다른 종족이어도 된다. 다만 **로고는 이 한 벌뿐**이다
//   · 마크도 선 하나 굵기로 줄였다. 마름모 하나 + 가로선 하나 — 그 이상은 뺐다.
//     원판 두 장까지 그리면 22px 에서 뭉치고, 뭉치면 촌스러워진다
//
// 색은 `--accent` 하나만 쓴다. **마크는 `currentColor` 로 받는다** — SVG 속성 안에서는
// `var(--accent)` 가 치환되지 않아 값이 통째로 무시된다 (8/28 에 그래프에서 겪었다).

const HAIR = 1.2;          // 격자 24칸 기준 — 머리카락 굵기. 이보다 굵으면 무거워진다

/**
 * 마크 — **마름모 하나에 가로선 하나.**
 *
 * 원판을 옆에서 본 모양(마름모)에 봉이 지난다. 그 이상은 그리지 않는다 —
 * 앞 판에서는 마름모 두 겹에 원판 두 장까지 그렸는데, 작은 자리에서 선이 뭉쳤다.
 * 뺄수록 또렷해지고, 또렷한 것이 고급이다.
 */
export function LogoMark({ size = 24, style }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"
      style={{ color: 'var(--accent)', flexShrink: 0, display: 'block', ...style }}
    >
      <path d="M12 2.4 21.6 12 12 21.6 2.4 12Z"
        stroke="currentColor" strokeWidth={HAIR} strokeLinejoin="round" />
      {/* 봉 — 마름모 안쪽만 지난다. 밖으로 삐져나오면 십자가처럼 보인다 */}
      <path d="M5.6 12H18.4" stroke="currentColor" strokeWidth={HAIR} strokeLinecap="round" />
    </svg>
  );
}

/**
 * 워드마크 — **같은 크기 · 같은 굵기 · 사이에 가는 선 하나.**
 *
 * 앞 판은 BLACK 을 흐리게 IRON 을 굵게 해서 차이를 줬다. 그게 광고 문구처럼 보였다.
 * 둘을 나란히 두고 선 하나로 가르면 표지처럼 보인다 — 그게 고급이다.
 */
export function LogoWord({ cap = 19, style }) {
  const type = {
    fontFamily: "'Barlow', system-ui, sans-serif",
    fontWeight: 300,
    fontSize: cap * 0.86,
    letterSpacing: cap * 0.42,     // 넓게. 여백이 고급을 만든다
    lineHeight: 1,
    color: 'var(--accent)',        // 한 색. 그라데이션도 그림자도 없다
    whiteSpace: 'nowrap',
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', ...style }}>
      <span style={type}>BLACK</span>
      {/* 가르는 선 — 대문자 높이의 절반쯤. 글자보다 흐리게 둔다 */}
      <span style={{
        width: 1, height: cap * 0.62, background: 'var(--accent)', opacity: 0.45,
        margin: `0 ${cap * 0.30}px 0 ${cap * 0.10}px`, flexShrink: 0,
      }} />
      <span style={type}>IRON</span>
    </span>
  );
}

// 금선 — 한 겹, 가운데만 진하다. 큰 자리에만 쓴다.
// 앞 판은 두 겹이었는데 겹칠수록 장식이 된다
function Rule({ width = '100%' }) {
  return (
    <span style={{
      width, height: 1,
      background: 'linear-gradient(90deg, transparent, var(--accent) 22%, var(--accent) 78%, transparent)',
      opacity: 0.55,
    }} />
  );
}

/**
 * 로고 한 벌.
 *
 * `cap` 은 대문자 높이(px). 마크가 같은 높이로 따라온다.
 * `variant`
 *   'row'   머리 · 탭바 — 마크 + 글자. 금선과 부제는 안 넣는다 (작은 자리에서는 과하다)
 *   'stack' 스플래시 · 로그인 — 마크 · 글자 · 금선 · 부제
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
        gap: cap * 0.46, ...style,
      }} {...rest}>
        <LogoMark size={cap * 2.0} />
        <LogoWord cap={cap} />
        <Rule width="64%" />
        {subtitle ? (
          <span style={{
            fontFamily: "'Barlow', system-ui, sans-serif", fontWeight: 300,
            fontSize: cap * 0.28, letterSpacing: cap * 0.30,
            color: 'var(--accent-low)', whiteSpace: 'nowrap',
          }}>{subtitle}</span>
        ) : null}
      </span>
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', ...style }} {...rest}>
      <LogoMark size={cap * 1.05} />
      <span style={{ width: cap * 0.52, flexShrink: 0 }} />
      <LogoWord cap={cap} />
    </span>
  );
}
