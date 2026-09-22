// 내 비율 실루엣 — **잰 값으로 몸을 다시 그린다** (2026-09-22).
//
// 사진을 그대로 보여주지 않는다. 사진에는 옷 · 배경 · 조명 · 얼굴이 다 들어 있어서,
// **정작 잰 것(비율)이 안 보인다.** 어깨가 골반의 1.4배라는 사실은 사진에서보다
// 이 그림에서 더 잘 읽힌다.
//
// **그리는 것은 잰 값뿐이다.** 근육 모양 · 배 · 몸매를 지어내지 않는다 — 우리가 아는
// 것은 관절 여섯 쌍 사이의 거리다. 그래서 몸은 **뼈대에 두께를 입힌 덩어리**로만
// 그린다. 있지도 않은 굴곡을 그리면 그림이 거짓말을 시작한다.
//
// 색은 SVG 속성으로 나가므로 `var(--accent)` 를 못 쓴다(속성 안에서는 치환되지 않는다).
// `BodyMap` 에서 겪은 것과 같은 자리라 같은 토큰 값을 직접 적는다.
const GOLD = '#eeb77d';
const SKIN = '#1c1813';
const GHOST = '#5a5348';

/** 총 길이를 고정해두고 비율로 나눈다 — **키를 모르기 때문이다.** */
const BODY = 148;
const HIP_W = 21;

/**
 * 비율 → 그릴 자리.
 *
 * 값이 없으면 **사람의 평균을 채워 넣지 않는다.** 대신 그 부분을 흐리게 그리고
 * (`ghost`) 화면이 「여기는 못 쟀어요」를 적는다. 없는 것을 그럴듯하게 채우면
 * 무엇을 실제로 쟀는지 구별할 수 없게 된다.
 */
function layout(r) {
  const tl = r?.torsoLeg;
  const sh = r?.shoulderHip;

  // 상체:다리. 못 쟀으면 반반으로 두고 흐리게 그린다
  const ratio = tl && tl > 0 ? tl : 0.75;
  const torso = Math.round((BODY * ratio) / (1 + ratio));
  const leg = BODY - torso;

  const hipW = HIP_W;
  const shoulderW = Math.round(hipW * (sh && sh > 0 ? sh : 1.3));

  // 팔 길이. 잰 것이 있으면 **그것을 쓴다** — 없으면 몸통에 붙여 그린다.
  // (여태 주석만 「쓴다」고 적어놓고 안 쓰고 있었다 — 9/22 에 맞췄다)
  const arm = r?.armLeg && r.armLeg > 0 ? Math.round(leg * r.armLeg) : Math.round(torso * 0.95);

  return {
    torso, leg, hipW, shoulderW, arm,
    ghostTorso: !tl,
    ghostShoulder: !sh,
    // 기울기는 **3도부터만** 그린다 (`shapeRatio.js` 와 같은 선). 0.4도를 기울여
    // 그리면 사람은 그것을 고쳐야 할 것으로 읽는데, 우리 정밀도가 그게 아니다
    shoulderTilt: (r?.shoulderTilt ?? 0) >= 3 ? Math.min(r.shoulderTilt, 12) : 0,
    hipTilt: (r?.hipTilt ?? 0) >= 3 ? Math.min(r.hipTilt, 12) : 0,
  };
}

/**
 * @param ratios  `buildRatios` 가 준 것
 * @param compare 지난 번 것 (있으면 뒤에 흐린 선으로 겹친다)
 */
export default function ShapeSilhouette({ ratios, compare = null, height = 260 }) {
  const L = layout(ratios);
  const C = compare ? layout(compare) : null;

  // 좌표계: 가운데가 0, 머리 꼭대기가 0 아래로 내려간다
  const headR = 13;
  const top = headR * 2 + 4;
  const hipY = top + L.torso;
  const footY = hipY + L.leg;

  const body = (S, opts) => {
    const t = (S.shoulderTilt * Math.PI) / 180;
    const ht = (S.hipTilt * Math.PI) / 180;
    const sy = Math.round(Math.tan(t) * S.shoulderW) / 2;
    const hy = Math.round(Math.tan(ht) * S.hipW) / 2;
    const sTop = top;
    const hY = top + S.torso;
    const fY = hY + S.leg;
    return (
      <g {...opts}>
        {/* 머리 — **크기는 안 잰다.** 몸이 어디서 시작하는지 알려주는 표시일 뿐이다 */}
        <circle cx="0" cy={headR} r={headR} />
        {/* 몸통 — 어깨 넷과 골반 넷을 잇는 사다리꼴. 기울기가 있으면 한쪽이 내려간다 */}
        <path d={[
          `M ${-S.shoulderW / 2} ${sTop - sy}`,
          `L ${S.shoulderW / 2} ${sTop + sy}`,
          `L ${S.hipW / 2} ${hY + hy}`,
          `L ${-S.hipW / 2} ${hY - hy}`,
          'Z',
        ].join(' ')} />
        {/* 다리 둘 — 골반 폭에서 내려온다. 무릎을 따로 안 그린다(굽힌 사진에서
            무릎 자리를 그리면 서 있는 자세를 체형으로 읽게 된다) */}
        <path d={`M ${-S.hipW / 2} ${hY - hy} L ${-S.hipW / 2 + 1} ${fY} L ${-2} ${fY} L ${-1.5} ${hY} Z`} />
        <path d={`M ${S.hipW / 2} ${hY + hy} L ${S.hipW / 2 - 1} ${fY} L ${2} ${fY} L ${1.5} ${hY} Z`} />
        {/* 팔 둘 — 어깨에서 내려온다. 길이는 **잰 것**(`armLeg`)이 있으면 그것을 쓴다 */}
        <path d={`M ${-S.shoulderW / 2} ${sTop - sy} L ${-S.shoulderW / 2 - 3} ${sTop + S.arm} L ${-S.shoulderW / 2 + 2} ${sTop + S.arm} L ${-S.shoulderW / 2 + 5} ${sTop - sy} Z`} />
        <path d={`M ${S.shoulderW / 2} ${sTop + sy} L ${S.shoulderW / 2 + 3} ${sTop + S.arm} L ${S.shoulderW / 2 - 2} ${sTop + S.arm} L ${S.shoulderW / 2 - 5} ${sTop + sy} Z`} />
      </g>
    );
  };

  const W = Math.max(L.shoulderW, C?.shoulderW || 0) + 26;
  // **둘 중 긴 쪽에 맞춘다.** 지금 것만 재면 지난 번이 더 길 때 발이 잘린다 —
  // 상체:다리가 달라지면 둘의 전체 길이도 달라진다(총 길이는 고정이지만
  // 머리와 기울기가 얹혀서 아래 끝이 어긋난다)
  const bottom = Math.max(footY, C ? top + C.torso + C.leg : 0);

  return (
    <svg
      viewBox={`${-W / 2} -4 ${W} ${bottom + 12}`}
      style={{ width: '100%', height, display: 'block' }}
      role="img"
      aria-label={`어깨가 골반의 ${ratios?.shoulderHip ?? '?'}배, 상체가 다리의 ${ratios?.torsoLeg ?? '?'}배인 실루엣`}
    >
      {/* 지난 번 — 뒤에 흐린 선으로만. **채우지 않는다**(둘 다 채우면 어느 것이
          지금인지 모른다). 겹쳐 보는 것이 「달라졌나」의 답이다 */}
      {C && body(C, { fill: 'none', stroke: GHOST, strokeWidth: 1.2, strokeDasharray: '3 3', opacity: 0.85 })}

      {/* 지금 */}
      {body(L, {
        fill: SKIN,
        stroke: L.ghostShoulder || L.ghostTorso ? GHOST : GOLD,
        strokeWidth: 1.4,
        strokeDasharray: L.ghostShoulder || L.ghostTorso ? '4 3' : undefined,
      })}

      {/* 잰 자리를 **눈에 보이게 표시한다.** 숫자만 적으면 어디를 잰 것인지 모른다 */}
      {!L.ghostShoulder && (
        <g stroke={GOLD} strokeWidth="0.8" opacity="0.55">
          <line x1={-L.shoulderW / 2} y1={top - 7} x2={L.shoulderW / 2} y2={top - 7} />
          <line x1={-L.hipW / 2} y1={hipY + 6} x2={L.hipW / 2} y2={hipY + 6} />
        </g>
      )}
    </svg>
  );
}
