// 체형 읽기 02 — **사진에서 비율을 잰다** (2026-09-22).
//
// 자세 인식이 잡아준 관절 자리(33점)를 받아 **비율만** 뽑는다. 모델을 부르는 일은
// `poseModel.js` 가, 그리는 일은 `ShapeSilhouette.jsx` 가 한다 — 여기는 순수 계산이라
// 검사가 값으로 본다(`npm run shape`).
//
// ── 잴 수 있는 것과 없는 것 ──
//
// **키를 몰라도 비율은 나온다.** 관절 사이 거리를 서로 나누기 때문이다. 그래서
// 여기서 나오는 것은 전부 **배수**지 센티미터가 아니다.
//
// **허리는 못 잰다.** 자세 인식은 관절만 잡는다 — 어깨 · 팔꿈치 · 손목 · 골반 · 무릎 ·
// 발목이 전부다. 허리 둘레를 아는 점이 없다. 9/19 계획에 「어깨:허리」라고 적었지만
// 그건 **잴 수 없는 것**이라, 여기서는 **어깨:골반**으로 재고 화면에도 그렇게 적는다.
// 못 재는 것을 잰 척하면 나머지 숫자까지 못 믿게 된다.
//
// **정규화 좌표를 그대로 견주면 안 된다.** 모델이 주는 x · y 는 0~1 인데 x 는 가로,
// y 는 세로 기준이다. 세로로 긴 사진에서 그대로 빼면 세로가 짧게 잡힌다 —
// 그래서 **픽셀로 되돌린 뒤** 잰다.

/** MediaPipe Pose 의 33점 중 우리가 쓰는 자리. */
export const LM = {
  nose: 0,
  shoulderL: 11, shoulderR: 12,
  elbowL: 13, elbowR: 14,
  wristL: 15, wristR: 16,
  hipL: 23, hipR: 24,
  kneeL: 25, kneeR: 26,
  ankleL: 27, ankleR: 28,
};

/**
 * 이 점을 믿을 수 있나.
 *
 * 모델은 **안 보이는 관절도 자리를 지어낸다**(가려졌을 때 어디쯤일지 추측한다).
 * 그 점으로 비율을 재면 옷이나 각도가 만든 숫자를 몸이라고 말하게 된다.
 * 0.5 아래는 안 쓴다 — 못 쟀다고 말하는 쪽이 낫다.
 */
const SURE = 0.5;

function pick(landmarks, i, size) {
  const p = landmarks?.[i];
  if (!p) return null;
  const vis = p.visibility ?? p.score ?? 1;
  if (vis < SURE) return null;
  // 정규화(0~1) → 픽셀. 가로와 세로를 같은 자로 재기 위한 것이다
  return { x: p.x * (size?.width || 1), y: p.y * (size?.height || 1), vis };
}

function dist(a, b) {
  if (!a || !b) return null;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function mid(a, b) {
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * 두 점을 잇는 선이 수평에서 몇 도 기울었나.
 *
 * **어느 쪽이 높은지는 안 준다.** 사진은 좌우가 뒤집혀 찍히기도 하고(앞카메라),
 * 모델이 말하는 left/right 는 **사진 속 방향이 아니라 그 사람의 몸 기준**이다.
 * 「왼쪽이 높아요」라고 적었다가 거울상이면 반대를 말하게 된다 — 몇 도인지까지만 말한다.
 */
function tiltDeg(a, b) {
  if (!a || !b) return null;
  const deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  return Math.round(Math.abs(deg) * 10) / 10;
}

const round2 = (n) => (n === null ? null : Math.round(n * 100) / 100);

/**
 * 사진 한 장에서 비율을 뽑는다.
 *
 * landmarks 는 정규화 좌표 배열(33개), size 는 { width, height } 픽셀.
 *
 * 돌려주는 것:
 *   ok            비율이 하나라도 나왔나
 *   missing       못 잡은 자리 이름들 (화면이 「이래서 못 쟀어요」를 적는다)
 *   shoulderHip   어깨 폭 ÷ 골반 폭 (허리가 아니다)
 *   torsoLeg      상체 길이 ÷ 다리 길이
 *   armLeg        팔 길이 ÷ 다리 길이 (실루엣을 그릴 때 쓴다)
 *   shoulderTilt  어깨선이 수평에서 몇 도
 *   hipTilt       골반선이 수평에서 몇 도
 *   sideGap       좌우 팔 길이 차이 (몸통 대비 %)
 *   facing        'front' 로만 본다 — 옆으로 서면 폭이 줄어 어깨가 좁게 나온다
 */
export function buildRatios(landmarks, size) {
  const P = (k) => pick(landmarks, LM[k], size);
  const sL = P('shoulderL'), sR = P('shoulderR');
  const hL = P('hipL'), hR = P('hipR');
  const kL = P('kneeL'), kR = P('kneeR');
  const aL = P('ankleL'), aR = P('ankleR');
  const eL = P('elbowL'), eR = P('elbowR');
  const wL = P('wristL'), wR = P('wristR');

  const missing = [];
  if (!sL || !sR) missing.push('어깨');
  if (!hL || !hR) missing.push('골반');
  if (!kL || !kR) missing.push('무릎');
  if (!aL || !aR) missing.push('발목');

  const shoulderW = dist(sL, sR);
  const hipW = dist(hL, hR);
  const shoulderMid = mid(sL, sR);
  const hipMid = mid(hL, hR);
  const ankleMid = mid(aL, aR);

  const torso = dist(shoulderMid, hipMid);
  // 다리는 골반→무릎→발목을 **이어서** 잰다. 골반에서 발목까지 직선으로 재면
  // 무릎을 굽히고 선 사진에서 다리가 짧게 나온다
  const legL = kL && aL && hL ? dist(hL, kL) + dist(kL, aL) : null;
  const legR = kR && aR && hR ? dist(hR, kR) + dist(kR, aR) : null;
  const leg = legL !== null && legR !== null ? (legL + legR) / 2
    : legL !== null ? legL : legR;

  const armL = sL && eL && wL ? dist(sL, eL) + dist(eL, wL) : null;
  const armR = sR && eR && wR ? dist(sR, eR) + dist(eR, wR) : null;
  const arm = armL !== null && armR !== null ? (armL + armR) / 2
    : armL !== null ? armL : armR;

  // ── 옆으로 선 사진을 걸러낸다 ──
  //
  // 몸을 틀면 어깨 폭이 실제보다 좁게 찍힌다. 그걸 그대로 「어깨가 좁다」로 말하면
  // 사진이 아니라 **서 있던 자세**를 읽은 것이다. 어깨 폭이 몸통 길이에 견줘
  // 너무 좁으면 정면이 아니라고 본다
  const facing = shoulderW !== null && torso ? (shoulderW / torso >= 0.5 ? 'front' : 'side') : null;

  const shoulderHip = shoulderW !== null && hipW ? round2(shoulderW / hipW) : null;
  const torsoLeg = torso !== null && leg ? round2(torso / leg) : null;
  const armLeg = arm !== null && leg ? round2(arm / leg) : null;

  // 좌우 차이는 **몸통 길이로 나눠서** 본다. 픽셀 차이는 사진이 크면 같이 커진다
  const sideGap = armL !== null && armR !== null && torso
    ? Math.round((Math.abs(armL - armR) / torso) * 1000) / 10
    : null;

  return {
    ok: shoulderHip !== null || torsoLeg !== null,
    missing,
    facing,
    shoulderHip,
    torsoLeg,
    armLeg,
    shoulderTilt: tiltDeg(sL, sR),
    hipTilt: tiltDeg(hL, hR),
    sideGap,
    // 그리는 쪽이 쓰는 날것. 화면은 이걸로 실루엣을 다시 그린다
    raw: { shoulderW, hipW, torso, leg, arm },
  };
}

// ── 잰 값을 말로 옮긴다 ──
//
// **또래 · 이상적인 비율과 견주지 않는다.** 「황금비 1.618」 같은 것은 이 앱이 거절한
// 종류의 말이다(9/19 말투 규칙: 점수 · 등급 · 정상/비정상 · 또래 비교 안 쓴다).
// 여기서 하는 것은 **잰 값을 읽어주는 것**뿐이고, 견줄 상대는 지난 번의 나다.
const TILT_SURE = 3;    // 3도 안쪽은 아무 말도 안 한다 — 서 있는 자세가 그만큼 흔들린다
const GAP_SURE = 4;     // 좌우 4% 안쪽도 마찬가지

/**
 * 비율 → 화면에 그대로 적을 줄들. 근거는 전부 '사진'이다.
 *
 * 각 줄에 `sure` 를 단다. false 면 화면이 **「각도일 수 있어요」**를 붙인다 —
 * 9/19 에 정한 것이다(사진만 그러고 기록은 아니면 단정하지 않는다).
 */
export function ratioLines(r) {
  if (!r || !r.ok) return [];
  const lines = [];
  const sure = r.facing === 'front';

  if (r.shoulderHip !== null) {
    lines.push({
      key: 'shoulderHip',
      basis: '사진',
      sure,
      text: `어깨 폭이 골반의 ${r.shoulderHip}배예요.`,
    });
  }
  if (r.torsoLeg !== null) {
    lines.push({
      key: 'torsoLeg',
      basis: '사진',
      sure,
      text: `상체가 다리의 ${r.torsoLeg}배 길이예요.`,
    });
  }
  // 기울기와 좌우는 **작으면 아예 말하지 않는다.** 0.4도를 적어주면 사람은 그것을
  // 고쳐야 할 것으로 읽는다. 우리가 잴 수 있는 정밀도가 아니다
  if (r.shoulderTilt !== null && r.shoulderTilt >= TILT_SURE) {
    lines.push({ key: 'shoulderTilt', basis: '사진', sure, text: `어깨선이 ${r.shoulderTilt}도 기울어 있어요.` });
  }
  if (r.hipTilt !== null && r.hipTilt >= TILT_SURE) {
    lines.push({ key: 'hipTilt', basis: '사진', sure, text: `골반선이 ${r.hipTilt}도 기울어 있어요.` });
  }
  if (r.sideGap !== null && r.sideGap >= GAP_SURE) {
    lines.push({ key: 'sideGap', basis: '사진', sure, text: `좌우 팔 길이가 ${r.sideGap}% 다르게 찍혔어요.` });
  }
  return lines;
}
