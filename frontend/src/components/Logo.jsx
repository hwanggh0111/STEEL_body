// BLACK IRON 로고. **앱의 모든 자리가 이것 하나를 쓴다.**
//
// ── 2026-11-10 · 다섯째 판. 주인이 고른 안으로 갈아끼웠다 ──
//
// 주인이 엠블럼 그림을 주고 안 열다섯 중 **「세로 잠금」**을 골랐다.
// 적용 시안을 보고 「그대로 UI 옮겨」라 해서 그 비례대로 옮긴 것이 이 파일이다.
//
// **앞 판(9/01, 넷째)이 세운 규칙 둘을 일부러 뒤집는다** — 그 까닭을 적어둔다.
// 되돌릴 일이 생기면 이 두 줄을 먼저 읽어야 한다.
//
//   ⑴ **마크가 선그림에서 그림으로 바뀌었다.** 앞 판은 「가는 링 하나에 봉 하나」였고
//      「원은 어느 크기로 줄여도 뭉개지지 않는 유일한 모양」이라 적어뒀다. 그 말은
//      지금도 맞다 — 그래서 **작은 자리 규칙을 새로 뒀다**(아래 `MARK_MIN`).
//      바꾼 까닭은 받은 엠블럼의 **알파에 음영이 들어 있다**는 것이다. 모양 안쪽
//      57,447픽셀 중 6,797(11.8%)이 반투명이라, 단색으로 칠해도 근육의 입체가
//      농담으로 남는다. 선그림으로는 그 농담을 만들 수 없다 — 재서 확인했다.
//
//   ⑵ **글자가 소문자 세리프에서 대문자로 돌아갔다.** 앞 판은 「전부 대문자는 표지판의
//      글이다」라며 `Black Iron`(Playfair 이탤릭)으로 갔다. 그 말에도 일리가 있다.
//      그런데 **마크가 무거운 그림이 되자 가벼운 이탤릭이 받쳐주지 못했다** —
//      시안에서 둘을 나란히 두고 보면 글자가 마크에 끌려다닌다. 무거운 마크에는
//      무거운 글자가 맞다. 그래서 `Bebas Neue` 대문자다 — **앱이 이미 쓰는 글자체**라
//      새로 부르는 것도 없다(`display-*` 들이 그것이다).
//
// **Playfair 는 그대로 남는다** — 로고에서만 뺀 것이고 `globals.css` 의 명조 계열이
// 아직 그 글자체를 쓴다. 로고만 바꿨다고 글꼴 호출을 빼면 그 쪽이 깨진다.
//
// 색은 `--accent` 하나만 납작하게 쓴다. 그라데이션도 그림자도 없다.
// **마크는 `currentColor` 가 아니라 `background` 로 받는다** — CSS 마스크로 그리므로
// 색이 배경색이다. 그래서 반전(금 바탕에 먹 마크)도 `color` prop 하나로 끝난다.

/** 받은 엠블럼에서 잘라낸 알파. `404 × 373` — 빈 자리를 다 떼어낸 테두리 상자다 */
const MARK_SRC = '/images/mark.png';
/** 높이 ÷ 폭. 정사각이 아니다 — 이 값을 지켜야 눌리지 않는다 */
export const MARK_RATIO = 373 / 404;
/**
 * 마크를 글자 없이 혼자 세울 때의 **가장 작은 폭**(px).
 *
 * 16px 에서는 팔·다리가 뭉쳐 「사람」으로 안 읽힌다 — 실루엣 덩어리만 남는다.
 * 브라우저 탭처럼 **이름이 옆에 붙는 자리**는 그보다 작아도 버티지만, 아이콘만
 * 서는 자리는 24 아래로 내려가지 않는다.
 */
export const MARK_MIN = 24;
/**
 * 세로 잠금(마크 + 이름 + 설명 줄)의 **가장 작은 폭**(px).
 *
 * 그 아래로는 설명 줄이 먼저 죽고 이름이 다음이다. 좁은 자리에는 잠금을 쓰지 말고
 * **마크만** 떼어 쓴다(`variant="mark"`).
 */
export const LOCKUP_MIN = 96;

/**
 * 마크 — **받은 엠블럼의 실루엣.**
 *
 * CSS 마스크로 그린다. 알파를 **농도**로 쓰므로 단색으로 칠해도 안쪽 음영이 남는다.
 * `color` 를 주면 그 색으로 칠한다 — 금 바탕에 올릴 때 먹으로 뒤집는 자리에 쓴다.
 */
export function LogoMark({ size = 24, color = 'var(--accent)', style }) {
  return (
    <span
      role="img" aria-label="BLACK IRON"
      style={{
        display: 'block', flexShrink: 0,
        width: size, height: size * MARK_RATIO,
        background: color,
        // `contain` 이 아니라 `100% 100%` 다 — 칸을 비례에 맞춰 이미 잡았으니
        // 마스크를 칸에 꽉 채운다. `contain` 으로 두면 반올림 때 한 줄이 빈다
        WebkitMaskImage: `url(${MARK_SRC})`, maskImage: `url(${MARK_SRC})`,
        WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center', maskPosition: 'center',
        WebkitMaskSize: '100% 100%', maskSize: '100% 100%',
        ...style,
      }}
    />
  );
}

/**
 * 워드마크 — **「BLACK IRON」.** Bebas Neue · 대문자 · 자간 넓게.
 *
 * `cap` 은 대문자 높이(px). Bebas 는 대문자만 있는 글자체라 글자 크기가 곧 대문자
 * 높이에 가깝다 — 세리프였던 앞 판처럼 1.34배로 키울 일이 없다.
 */
export function LogoWord({ cap = 19, color = 'var(--accent)', style }) {
  return (
    <span style={{
      // 라틴 전용 — 적히는 글이 `BLACK IRON` 하나다. 한글이 올 자리가 없다
      fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif",
      fontWeight: 400,
      fontSize: cap * 1.18,
      // 대문자는 자간을 벌려야 숨이 트인다 — 소문자에서 하면 흩어져 보이지만
      // 대문자에서는 그 반대다(앞 판 주석의 그 말을 뒤집지 않고 그대로 쓴다)
      letterSpacing: cap * 0.085,
      // **마지막 글자 뒤에도 자간이 붙는다.** 그만큼 칸이 오른쪽으로 넓어져서
      // 가운데 맞춘 자리에서 글자가 왼쪽으로 밀린 듯 보인다 — 같은 값을 되돌린다
      marginRight: -(cap * 0.085),
      lineHeight: 1,
      color,
      whiteSpace: 'nowrap',
      ...style,
    }}>BLACK IRON</span>
  );
}

/**
 * 로고 한 벌.
 *
 * `cap` 은 대문자 높이(px). 마크가 그 비례로 따라온다.
 * `variant`
 *   'row'   머리 · 탭바 — 마크 + 글자를 나란히
 *   'stack' 스플래시 · 로그인 — **세로 잠금**(주인이 고른 그 안)
 *   'word'  글자만 (마크를 따로 놓는 자리)
 *   'mark'  마크만 (아이콘 · 파비콘 자리)
 *
 * 간격은 시안의 비례 그대로다 — **마크 높이 : 글자 높이 ≈ 3 : 1**,
 * 마크 아래 틈은 글자 높이만큼, 설명 줄은 그 절반.
 */
export default function Logo({
  cap = 19, variant = 'row', subtitle = '적은 것을 몸으로', color = 'var(--accent)', style, ...rest
}) {
  if (variant === 'mark') return <LogoMark size={cap * 1.15} color={color} style={style} {...rest} />;
  if (variant === 'word') return <LogoWord cap={cap} color={color} style={style} {...rest} />;

  if (variant === 'stack') {
    return (
      <span style={{
        display: 'inline-flex', flexDirection: 'column', alignItems: 'center', ...style,
      }} {...rest}>
        {/* 마크 폭 ≈ 글자 높이의 3.3배. 시안에서 잰 값이다 */}
        <LogoMark size={cap * 3.3} color={color} />
        {/* 마크 아래 틈 = 글자 높이만큼 */}
        <span style={{ height: cap * 0.95, flexShrink: 0 }} />
        <LogoWord cap={cap} color={color} />
        {subtitle ? (
          <>
            {/* 설명 줄 앞 틈은 그 절반 */}
            <span style={{ height: cap * 0.48, flexShrink: 0 }} />
            <span style={{
              // 설명 줄은 **한글이 온다** — Bebas 에는 한글이 없으니 본문 글자체로 받는다
              fontFamily: "'IBM Plex Sans KR', 'Barlow', sans-serif",
              fontWeight: 300,
              fontSize: cap * 0.42,
              letterSpacing: cap * 0.1,
              marginRight: -(cap * 0.1),
              color: 'var(--accent-low)',
              whiteSpace: 'nowrap',
            }}>{subtitle}</span>
          </>
        ) : null}
      </span>
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', ...style }} {...rest}>
      <LogoMark size={cap * 1.12} color={color} />
      <span style={{ width: cap * 0.44, flexShrink: 0 }} />
      <LogoWord cap={cap} color={color} />
    </span>
  );
}
