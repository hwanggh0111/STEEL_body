import { memo, Fragment } from 'react';
import { bodyPartOf } from '../data/bodyPart';
import { FRONT, BACK, HEAD, VIEWBOX, GOLD, SKIN, SKIN_EDGE } from './bodyShapes';

// 운동 카드의 작은 몸 (2026-10-06).
//
// 기록 목록은 여태 **운동명 · 무게 · 세트 · 회**만 말했다. 그런데 부위는 이미
// 다 알고 있었다 — 사전 437개에 적혀 있고 `bodyPartOf` 가 자유 입력 이름까지
// 맞힌다. **데이터를 더 받지 않고** 그 운동이 어디를 쓰는지 그린다.
//
// 「몸」 탭의 지도와 **같은 조각**을 쓴다(`bodyShapes.jsx`) — 처음 보는 사람도
// 안 배우고 읽는다.
//
// ── 36px 인데 운동명이 먼저 읽혀야 한다 (고른 크기) ──
//
// 36px 은 여섯 부위가 다 구별되는 크기다. 그런데 그대로 키우면 **그림이 카드의
// 주인공**이 된다 — 목록을 내리는데 운동명보다 몸이 먼저 읽히면 그건 목록이
// 아니고 지도다. 그래서 **크기는 키우고 무게는 낮춘다.**
//
//   1. **바탕 몸을 더 죽인다.** 지도에서는 몸이 화면의 주인공이라 또렷해야 하지만,
//      카드에서 또렷한 바탕 몸은 운동명과 싸운다. 통째로 흐리게 한다.
//   2. **칠만 제 밝기로 남긴다.** 읽을 것은 「어디」 하나다 — 금색 한 조각.
//      바탕이 가라앉은 만큼 그 한 조각이 오히려 더 또렷해진다.
//   3. **선은 크기와 반대로 간다.** 240 짜리 좌표계를 36px 로 줄이면 0.7 짜리
//      선은 사라진다. 줄어드는 비율만큼 굵혀서 어느 크기에서도 테두리가 남는다.
const SIZE = 36;
const RATIO = 2.38;          // 지도의 비율과 같다
const BASE_STROKE = 1.4;     // 24px 에서의 굵기. 아래에서 크기에 맞춰 되돌린다

/** 몸통 전체를 가라앉히는 정도. 1 이면 지도와 같은 또렷함이다. */
const BODY_DIM = 0.55;

/**
 * 한 운동이 쓰는 곳.
 *
 * `part` 를 받으면 그것을 쓰고, 없으면 운동명으로 알아낸다. 부위를 못 맞혔으면
 * (`'기타'`, 유산소 · 전신) **아무 데도 안 칠한다** — 어디를 칠해야 할지 모르니까
 * 기타인 것이다. 몸은 그려서 줄의 높이를 맞추고, 칠만 뺀다.
 */
function MiniBody({ exercise, part, size = SIZE }) {
  const p = part || bodyPartOf(exercise);
  const shapes = p === '등' ? BACK : FRONT;
  const paint = shapes[p] || null;
  const stroke = (BASE_STROKE * 24 / size).toFixed(2);

  return (
    <svg
      width={size}
      height={Math.round(size * RATIO)}
      viewBox={VIEWBOX}
      fill="none"
      role="img"
      aria-label={paint ? `${p} 운동` : '부위를 몰라요'}
      style={{ flexShrink: 0, display: 'block' }}
    >
      {/* 바탕 몸 — 가라앉힌다. 금색 한 조각이 주인공이다 */}
      <g fill={SKIN} stroke={SKIN_EDGE} strokeWidth={stroke} opacity={BODY_DIM}>
        {HEAD}
        {/* 조각을 배열로 펴면 React 가 열쇠를 찾는다 — 부위 이름을 쓴다 */}
        {Object.entries(shapes).map(([name, shape]) => (
          <Fragment key={name}>{shape}</Fragment>
        ))}
      </g>

      {/* 쓰는 곳 하나 */}
      {paint && <g fill={GOLD} opacity="0.82">{paint}</g>}
    </svg>
  );
}

// 목록에 몇 백 개가 늘어선다. 운동명이 그대로면 그림도 그대로다
export default memo(MiniBody);
