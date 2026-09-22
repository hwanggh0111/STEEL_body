import { MAP_PARTS } from '../data/bodyHeat';

// 이 판이 **몸의 어디를 채웠나** (2026-09-22).
//
// 홈트가 도는 동안 · 끝난 뒤에 쓴다. 계산은 `data/homeworkoutParts.js` 가 하고
// 여기는 그리기만 한다.
//
// **몸 지도(`BodyMap`)와 같은 그림을 쓴다.** 좌표를 그대로 옮겼다 — 같은 몸이
// 화면마다 다르게 생기면 같은 앱으로 안 보인다. 다만 지도는 **누를 수 있는** 그림이고
// 여기는 **보는** 그림이라, 단추로 만들지 않고 그리기만 한다(누를 것이 없는데 눌리는
// 모양이면 사람이 눌러보고 아무 일도 안 일어난다).
//
// **그리는 규칙 셋** — 지도에서 정한 것을 그대로 따른다.
//
// 1. **안 건드린 곳은 칠하지 않는다.** 없는 것을 옅게라도 칠하면 있는 것과 구별이
//    안 된다. 점선으로만 두른다.
// 2. **금색 하나로 진하기만 바꾼다.** 색을 여러 개 쓰면 뜻을 외워야 한다.
// 3. **주로 쓴 곳과 곁들인 곳을 가른다.** 맨몸은 한 부위가 아니라서, 안 가르면
//    온몸이 노래진다.
//
// 색은 SVG 속성으로 나가므로 `var(--accent)` 를 못 쓴다(속성 안에서는 치환되지 않는다).
// 지도와 같은 자리라 같은 값을 직접 적는다.
const GOLD = '#eeb77d';
const GOLD_LOW = '#d29a5f';
const SKIN = '#1c1813';
const SKIN_EDGE = '#2b251c';
const DASH = '#7a7160';

// 몸 조각 — `BodyMap` 의 앞면 좌표 그대로 (viewBox 0 0 120 240)
const SHAPES = {
  어깨: <><ellipse cx="38" cy="45" rx="11.5" ry="9" /><ellipse cx="82" cy="45" rx="11.5" ry="9" /></>,
  가슴: <rect x="44" y="49" width="32" height="24" rx="6" />,
  코어: <rect x="49" y="73" width="22" height="36" rx="5" />,
  등: <rect x="45" y="50" width="30" height="22" rx="5" />,
  팔: <>
    <ellipse cx="30" cy="70" rx="7.5" ry="15" /><ellipse cx="90" cy="70" rx="7.5" ry="15" />
    <ellipse cx="26" cy="101" rx="6" ry="14" /><ellipse cx="94" cy="101" rx="6" ry="14" />
  </>,
  하체: <>
    <ellipse cx="48" cy="142" rx="12.5" ry="31" /><ellipse cx="72" cy="142" rx="12.5" ry="31" />
    <ellipse cx="46" cy="195" rx="8.5" ry="21" /><ellipse cx="74" cy="195" rx="8.5" ry="21" />
  </>,
};

// **등은 앞에서 안 보인다.** 지도는 앞뒤 두 장을 그려서 그 문제가 없는데, 여기는
// 쉬는 15초에 곁눈으로 보는 자리라 두 장을 놓을 자리가 없다. 그래서 등을 가슴 자리에
// 겹쳐 두되 **진하기를 한 단 낮춘다** — 「여기쯤」이라는 표시지 정확한 자리가 아니다.
// 앞뒤를 제대로 가르는 것은 끝 화면(몸 지도)이 한다.
const BEHIND = new Set(['등']);

/** 점수 → 얼마나 진하게. 판 안에서 **가장 많이 쌓인 곳을 가득**으로 두고 서로 견준다. */
function paintOf(score, max) {
  if (!score || score <= 0) return null;
  const r = max > 0 ? score / max : 0;
  if (r >= 0.66) return { fill: GOLD, opacity: 0.76 };
  if (r >= 0.33) return { fill: GOLD, opacity: 0.5 };
  return { fill: GOLD_LOW, opacity: 0.3 };
}

/**
 * @param pump   `buildPump` 가 준 것
 * @param width  몸 그림 너비 (높이는 2.38배)
 * @param now    지금 하는 동작이 쓰는 곳 { main, sub } — 있으면 그 자리에 테두리를 두른다
 */
export default function PumpBody({ pump, width = 68, now = null }) {
  const max = pump?.max || 0;
  const nowMain = new Set(now?.main || []);

  return (
    <svg
      width={width}
      height={Math.round(width * 2.38)}
      viewBox="0 0 120 240"
      fill="none"
      role="img"
      aria-label={
        pump?.touched?.length
          ? `이번 판에서 ${pump.touched.join(' · ')}를 채웠어요` +
            (pump.untouched?.length ? `. ${pump.untouched.join(' · ')}는 아직이에요` : '')
          : '아직 아무 데도 안 채웠어요'
      }
    >
      <defs>
        <filter id="pumpSoft" x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* 바탕 — 머리와 목은 부위가 아니다. 사람 모양을 알아보게 하는 것뿐이다 */}
      <g fill={SKIN} stroke={SKIN_EDGE} strokeWidth="0.7">
        <circle cx="60" cy="17" r="11" />
        <rect x="54" y="27" width="12" height="8" rx="3" />
        {MAP_PARTS.map((part) => <g key={part}>{SHAPES[part]}</g>)}
      </g>

      {/* 채운 곳 */}
      {MAP_PARTS.map((part) => {
        const paint = paintOf(pump?.byPart?.[part]?.score, max);
        if (!paint) return null;
        const op = BEHIND.has(part) ? paint.opacity * 0.6 : paint.opacity;
        return (
          <g key={part} fill={paint.fill} fillOpacity={op} filter={paint.opacity >= 0.7 ? 'url(#pumpSoft)' : undefined}>
            {SHAPES[part]}
          </g>
        );
      })}

      {/* 안 건드린 곳 — **칠하지 않고 점선으로만.** 이 판이 비워둔 자리가
          그대로 「다음에 할 곳」이 된다 */}
      {(pump?.untouched || []).map((part) => (
        <g key={part} fill="none" stroke={DASH} strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.7">
          {SHAPES[part]}
        </g>
      ))}

      {/* 지금 하는 동작이 쓰는 곳 — 테두리로만. 칠을 더하면 「많이 쌓였다」와
          「지금 쓴다」가 같은 모양이 되어 둘 다 안 읽힌다 */}
      {MAP_PARTS.filter((p) => nowMain.has(p)).map((part) => (
        <g key={part} fill="none" stroke={GOLD} strokeWidth="1.2" strokeOpacity="0.95">
          {SHAPES[part]}
        </g>
      ))}
    </svg>
  );
}
