// 겹쳐 찍기 — **지난 사진을 반투명으로 겹쳐놓고 같은 자리에서 찍게 한다.**
//
// 전·후 사진이 비교가 안 되는 이유는 몸이 안 변해서가 아니라 **각도가 달라서**다.
// 반걸음 물러서고 고개를 조금 든 것만으로 어깨 폭이 달라 보인다. 그래서 반년 뒤에
// 찍은 사진을 나란히 놓고도 「잘 모르겠다」로 끝난다.
//
// 이 파일은 **화면 없이 확인할 수 있는 부분**만 맡는다 — 어느 사진을 겹칠지 고르는
// 것과, 보이는 것과 찍히는 것을 맞추는 자르기 계산이다. 카메라 자체(getUserMedia ·
// canvas)는 브라우저에만 있어서 눈으로 봐야 한다(`components/OverlayCamera.jsx`).

/** 사진 틀의 가로세로. 앱의 전·후 사진 칸이 3:4 다 — 여기서 다른 비율로 찍으면 잘린다 */
export const SHOT_RATIO = 3 / 4;

/** 겹치는 진하기 — 너무 옅으면 못 맞추고, 너무 진하면 지금 내 몸이 안 보인다 */
export const OPACITY_MIN = 0.15;
export const OPACITY_MAX = 0.75;
export const OPACITY_DEFAULT = 0.38;

export function clampOpacity(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return OPACITY_DEFAULT;
  return Math.min(OPACITY_MAX, Math.max(OPACITY_MIN, n));
}

/**
 * 무엇을 겹칠까.
 *
 * **지금 찍는 자리의 짝을 겹친다** — 「나중」을 찍을 때는 「과거」 사진 위에 맞춰야
 * 둘이 같은 각도가 된다. 짝이 없으면 자기 자리에 이미 있던 사진(다시 찍는 경우)을,
 * 그것도 없으면 아무것도 안 겹친다(겹칠 것이 없으면 그냥 카메라다).
 */
export function pickReference(photos, target) {
  const mate = target === 'after' ? 'before' : 'after';
  const p = photos || {};
  if (p[mate]) return { data: p[mate], from: mate };
  if (p[target]) return { data: p[target], from: target };
  return null;
}

/**
 * 보이는 것과 찍히는 것을 맞춘다.
 *
 * 카메라가 주는 그림은 대개 4:3 이나 16:9 인데 사진 칸은 3:4 다. 화면에서는
 * `object-fit: cover` 로 넘치는 쪽을 잘라 보여주면서 저장할 때 원본을 통째로 그리면,
 * **눈으로 맞춘 자리와 찍힌 자리가 달라진다** — 겹쳐 찍기의 뜻이 사라진다.
 * 그래서 화면이 자르는 것과 **같은 계산**으로 원본에서 오려낸다.
 *
 * 돌려주는 것은 원본에서 오려낼 네모 { sx, sy, sw, sh }.
 */
export function coverCrop(srcW, srcH, ratio = SHOT_RATIO) {
  const w = Number(srcW);
  const h = Number(srcH);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  const r = Number(ratio) > 0 ? Number(ratio) : SHOT_RATIO;

  if (w / h > r) {
    // 원본이 더 넓다 — 좌우를 자른다
    const sw = Math.round(h * r);
    return { sx: Math.round((w - sw) / 2), sy: 0, sw, sh: h };
  }
  // 원본이 더 좁다(또는 같다) — 위아래를 자른다
  const sh = Math.round(w / r);
  return { sx: 0, sy: Math.round((h - sh) / 2), sw: w, sh };
}

/**
 * 저장할 크기. 긴 변을 1280px 로 맞춘다 — `shrinkImage` 와 같은 자를 쓴다.
 * 몸 사진을 견주는 데 이만하면 넉넉하고, 대개 200~400KB 로 떨어진다.
 */
export const SHOT_MAX_EDGE = 1280;

export function shotSize(ratio = SHOT_RATIO) {
  const r = Number(ratio) > 0 ? Number(ratio) : SHOT_RATIO;
  // 3:4 면 세로가 길다. 긴 변을 1280 에 맞추고 짧은 변을 거기서 뽑는다
  if (r < 1) return { width: Math.round(SHOT_MAX_EDGE * r), height: SHOT_MAX_EDGE };
  return { width: SHOT_MAX_EDGE, height: Math.round(SHOT_MAX_EDGE / r) };
}
