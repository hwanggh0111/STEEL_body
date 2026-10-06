// 몸 그림 조각 — **몸 지도와 운동 카드가 같은 그림을 쓴다.**
//
// 2026-10-06 에 `BodyMap.jsx` 에서 꺼냈다. 운동 카드에도 작은 몸을 넣기로 했는데,
// 조각을 복사하면 **두 그림이 조용히 달라진다** — 지도에서 가슴을 넓히면 카드의
// 가슴은 그대로다. 그러면 「몸」 탭에서 본 모양과 목록에서 본 모양이 다른 사람이 된다.
// 그래서 한 자리에 둔다.
//
// 사람 몸을 정확히 그리는 것이 목적이 아니다. **어디를 말하는지 한눈에 알면 된다.**
// 그래서 타원과 둥근 네모로만 짠다 — 어느 폰에서 줄어들어도 뭉개지지 않는다.
//
// 색은 SVG 속성으로 나가므로 `var(--accent)` 를 못 쓴다 — 속성 안에서는 치환되지
// 않는다. 토큰 값을 직접 적는다.
export const GOLD = '#eeb77d';
export const GOLD_LOW = '#d29a5f';
export const SKIN = '#1c1813';
export const SKIN_EDGE = '#2b251c';

/** 그림의 좌표계. 두 쪽이 같은 틀을 쓴다. */
export const VIEWBOX = '0 0 120 240';

/** 머리와 목. 부위가 아니라 **사람 모양을 알아보게 하는 것**뿐이다 — 안 눌린다. */
export const HEAD = (
  <>
    <circle cx="60" cy="17" r="11" />
    <rect x="54" y="27" width="12" height="8" rx="3" />
  </>
);

export const FRONT = {
  어깨: <><ellipse cx="38" cy="45" rx="11.5" ry="9" /><ellipse cx="82" cy="45" rx="11.5" ry="9" /></>,
  가슴: <rect x="44" y="49" width="32" height="24" rx="6" />,
  코어: <rect x="49" y="73" width="22" height="36" rx="5" />,
  팔: <>
    <ellipse cx="30" cy="70" rx="7.5" ry="15" /><ellipse cx="90" cy="70" rx="7.5" ry="15" />
    <ellipse cx="26" cy="101" rx="6" ry="14" /><ellipse cx="94" cy="101" rx="6" ry="14" />
  </>,
  하체: <>
    <ellipse cx="48" cy="142" rx="12.5" ry="31" /><ellipse cx="72" cy="142" rx="12.5" ry="31" />
    <ellipse cx="46" cy="195" rx="8.5" ry="21" /><ellipse cx="74" cy="195" rx="8.5" ry="21" />
  </>,
};

export const BACK = {
  어깨: <><ellipse cx="38" cy="47" rx="11" ry="9" /><ellipse cx="82" cy="47" rx="11" ry="9" /></>,
  등: <path d="M45 50h30l-5 40H50z" />,
  코어: <rect x="49" y="90" width="22" height="20" rx="4" />,
  팔: <>
    <ellipse cx="30" cy="72" rx="7.5" ry="15" /><ellipse cx="90" cy="72" rx="7.5" ry="15" />
    <ellipse cx="26" cy="102" rx="6" ry="14" /><ellipse cx="94" cy="102" rx="6" ry="14" />
  </>,
  하체: <>
    <rect x="42" y="110" width="36" height="22" rx="9" />
    <ellipse cx="48" cy="152" rx="12" ry="26" /><ellipse cx="72" cy="152" rx="12" ry="26" />
    <ellipse cx="46" cy="195" rx="9" ry="21" /><ellipse cx="74" cy="195" rx="9" ry="21" />
  </>,
};

/**
 * 한 부위를 그릴 쪽을 고른다.
 *
 * **'등'은 뒷모습에만 있고 '가슴'은 앞모습에만 있다.** 둘 다 있는 부위
 * (어깨 · 팔 · 하체 · 코어)는 앞모습을 쓴다 — 사람이 거울에서 보는 쪽이다.
 */
export function viewFor(part) {
  return part === '등' ? BACK : FRONT;
}
