// BLACK IRON 로고. **앱의 모든 자리가 이것 하나를 쓴다.**
//
// 2026-09-01 저녁에 네 번째로 고쳤다. 앞 판은 「번쩍임」을 걷어내 촌스러움은 없앴지만
// **딱딱했다.** 원인은 넷이고 넷 다 각(角)이다 —
// **전부 대문자 · 넓은 자간 · 각진 마름모 · 가르는 직선.**
//
// 우아함은 규칙이 아니라 **곡선 · 굵기 대비 · 소문자**에서 나온다.
//
//   · **대문자를 버리고 「Black Iron」으로 적는다.** 전부 대문자는 표지판의 글이다 —
//     읽는 사람에게 지시하는 결이 된다. 첫 자만 대문자로 두면 사람이 쓴 이름이 된다
//   · **글자체는 Playfair Display**(세리프). 획이 굵어졌다 가늘어지는 대비가 있어서,
//     같은 금색이어도 훨씬 부드럽게 앉는다. 산세리프 대문자는 이 대비가 없어 판판하다
//   · **자간을 도로 좁힌다**(0.02em). 소문자에 자간을 벌리면 글자가 흩어져 보인다 —
//     자간을 넓히는 것은 대문자에서만 통하는 수법이다
//   · **가르는 직선을 뺐다.** 낱말 사이는 여백으로 나눈다. 선을 그으면 나눈 티가 난다
//   · **마크는 각을 버리고 원으로.** 마름모(각 넷)를 링 하나로 바꾸고, 봉이 그 안을
//     가로지른다. 원은 어느 크기로 줄여도 뭉개지지 않는 유일한 모양이다
//   · **글자는 흘림(이탤릭)으로 세우고, 밑에 펜으로 그은 획을 하나 둔다.**
//     곧게 선 글자에 자로 그은 선은 인쇄물이고, 기운 글자에 손으로 그은 획은 싸인이다.
//     획은 **가운데가 굵고 양끝이 가늘며 끝이 위로 튄다** — 선(stroke)으로는 굵기를
//     못 바꾸니 면(fill)으로 그린다
//
// 색은 `--accent` 하나만 납작하게 쓴다. 그라데이션도 그림자도 없다 —
// 화면에서 금속을 흉내 내면 대개 싸 보인다(그게 앞 판이 촌스러웠던 이유다).
// **마크는 `currentColor` 로 받는다** — SVG 속성 안에서는 `var(--accent)` 가
// 치환되지 않아 값이 통째로 무시된다 (8/28 에 그래프에서 겪었다).

const HAIR = 1.1;          // 격자 24칸 기준 — 머리카락 굵기

/**
 * 마크 — **가는 링 하나에 봉 하나.**
 *
 * 원판을 정면에서 본 모양(링)에 봉이 지난다. 각을 하나도 안 쓴다.
 * 봉의 양끝이 링 밖으로 조금 나가서, 갇힌 그림이 아니라 지나가는 그림이 된다.
 */
export function LogoMark({ size = 24, style }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"
      style={{ color: 'var(--accent)', flexShrink: 0, display: 'block', ...style }}
    >
      <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth={HAIR} />
      <path d="M1.6 12H22.4" stroke="currentColor" strokeWidth={HAIR} strokeLinecap="round" />
    </svg>
  );
}

/**
 * 워드마크 — **「Black Iron」.** 세리프 · 첫 자만 대문자 · 자간은 좁게.
 *
 * 앞 판은 「BLACK │ IRON」이었다. 대문자에 넓은 자간에 가르는 직선까지 있어서
 * 표지판처럼 읽혔다. 소문자를 살리고 선을 빼면 사람이 쓴 이름이 된다.
 */
export function LogoWord({ cap = 19, style }) {
  return (
    <span style={{
      fontFamily: "'Playfair Display', 'Times New Roman', serif",
      fontWeight: 400,
      // **흘림(이탤릭).** 곧게 선 글자는 인쇄물이고, 기울면 손으로 쓴 것이 된다 —
      // 싸인처럼 보이게 하는 것의 절반은 이 기울기다
      fontStyle: 'italic',
      // 세리프는 대문자 높이가 낮게 앉는다 — 같은 자리에 놓으려면 조금 키운다
      fontSize: cap * 1.34,
      // 흘림은 글자끼리 이어지는 결이라 자간을 더 좁힌다. 벌리면 이어진 느낌이 끊긴다
      letterSpacing: cap * 0.005,
      lineHeight: 1,
      color: 'var(--accent)',
      whiteSpace: 'nowrap',
      ...style,
    }}>Black Iron</span>
  );
}

/**
 * 싸인 획 — **펜으로 한 번 그은 것.**
 *
 * 앞 판은 곧은 금선이었다. 자로 그은 선은 표(表)의 줄이고, 손으로 그은 획은 싸인이다.
 * 차이는 셋이다 — **가운데가 굵고 양끝이 가늘다 · 살짝 휘었다 · 끝이 위로 튄다.**
 *
 * 선(stroke)으로는 굵기를 바꿀 수 없어서 **면(fill)으로 그린다** — 위아래 곡선 두 개를
 * 맞물려 가운데가 부푼 모양을 만든다. 끝의 짧은 획은 펜을 떼면서 튀는 자국이다.
 */
function Flourish({ width = '100%' }) {
  return (
    <svg viewBox="0 0 120 14" width={width} height="auto" fill="none" aria-hidden="true"
      style={{ display: 'block', color: 'var(--accent)', overflow: 'visible' }}>
      {/* 몸통 — 가운데가 굵고 양끝으로 갈수록 얇아진다 */}
      <path
        d="M2 9.4C22 3.6 44 2.2 74 3.4c14 .6 28 1.8 44 4.2-16-1.2-30-1.8-44-2.2C44 5 22 6.2 2 9.4Z"
        fill="currentColor" opacity="0.9"
      />
      {/* 끝의 튄 자국 — 펜을 떼면서 위로 올라간다 */}
      <path
        d="M108 6.6c4.4-1.6 8-3.4 10.6-5.6-1.6 2.8-4.6 5-8.6 6.6Z"
        fill="currentColor" opacity="0.65"
      />
    </svg>
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
export default function Logo({ cap = 19, variant = 'row', subtitle = 'Record your training', style, ...rest }) {
  if (variant === 'mark') return <LogoMark size={cap * 1.15} style={style} {...rest} />;
  if (variant === 'word') return <LogoWord cap={cap} style={style} {...rest} />;

  if (variant === 'stack') {
    return (
      <span style={{
        display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
        gap: cap * 0.42, ...style,
      }} {...rest}>
        <LogoMark size={cap * 2.0} />
        <LogoWord cap={cap} />
        <Flourish width="62%" />
        {subtitle ? (
          <span style={{
            // 부제도 같은 흘림으로 — 대문자로 적으면 다시 표지판이 된다
            fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 400,
            fontSize: cap * 0.46, letterSpacing: cap * 0.01,
            color: 'var(--accent-low)', whiteSpace: 'nowrap',
          }}>{subtitle}</span>
        ) : null}
      </span>
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', ...style }} {...rest}>
      <LogoMark size={cap * 1.12} />
      <span style={{ width: cap * 0.44, flexShrink: 0 }} />
      <LogoWord cap={cap} />
    </span>
  );
}
