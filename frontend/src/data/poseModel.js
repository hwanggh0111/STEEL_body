// 자세 인식 모델 — **폰 안에서 돌린다** (2026-09-22).
//
// 9/19 에 A안으로 정한 것이다: 사진을 바깥 회사에 안 보내고 **분석이 폰을 안 떠난다.**
// (사진 저장은 예전부터 서버로 간다 — 그건 이것과 별개고, 계획 문서에 적어뒀다.)
//
// ── 앱 첫 로딩에 안 얹는다 ──
//
// 모델과 wasm 은 합쳐서 10MB 쯤 된다. 이것을 앱과 같이 받으면 **체형을 안 볼 사람도**
// 그만큼 기다린다. 그래서 셋을 지킨다.
//
//   1. `import()` 로 **쓸 때 부른다** — 「체형」 갈래를 안 열면 한 조각도 안 받는다
//   2. 한 번 만든 것은 들고 있는다(`ready`) — 사진 두 장째는 기다림이 없다
//   3. 받는 중에 또 부르면 **같은 것을 기다린다**(`inflight`) — 두 벌 받지 않는다
//
// 이 세 줄은 `inbodyStore` 가 이미 쓰는 결이다. 새로 지어낸 방식이 아니다.

// 모델 파일은 CDN 에서 받는다. **버전을 박아둔다** — `@latest` 로 두면 어느 날 갑자기
// 다른 모델이 내려와서, 어제와 오늘의 비율이 달라진다(견주기가 본체인데 그러면 안 된다)
const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

let ready = null;
let inflight = null;

/** 받아둔 것을 버린다 (로그아웃 · 화면을 떠날 때는 안 부른다 — 다시 받게 되니까). */
export function resetPose() {
  ready?.close?.();
  ready = null;
  inflight = null;
}

/**
 * 모델 하나를 만들어 돌려준다. 이미 있으면 그것을 준다.
 *
 * `onStage` 로 지금 무엇을 하는 중인지 알린다 — 10MB 를 받는 동안 화면이 조용하면
 * 멈춘 것으로 보인다. 「받는 중 → 준비 중」까지만 말한다(몇 퍼센트인지는 모른다).
 */
export async function loadPose(onStage) {
  if (ready) return ready;
  if (inflight) return inflight;

  inflight = (async () => {
    onStage?.('download');
    // **여기서 처음 받는다.** 위쪽에서 import 하면 앱 첫 화면에 얹힌다
    const vision = await import('@mediapipe/tasks-vision');
    const files = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
    onStage?.('prepare');
    const landmarker = await vision.PoseLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      // 한 장짜리 사진이다. 'VIDEO' 로 두면 앞 장면을 기억하려 들어서
      // 사진마다 결과가 미묘하게 달라진다
      runningMode: 'IMAGE',
      // **한 사람만 본다.** 뒤에 지나가는 사람까지 잡으면 누구의 비율인지 모른다
      numPoses: 1,
    });
    ready = landmarker;
    inflight = null;
    onStage?.('done');
    return landmarker;
  })().catch((e) => {
    // 실패한 것을 들고 있으면 **다시 시도해도 계속 실패한다.** 비워서 다음 번에
    // 새로 받게 한다 (모델을 못 받는 흔한 까닭은 잠깐 끊긴 인터넷이다)
    inflight = null;
    throw e;
  });

  return inflight;
}

// ── 영상 모드 (2026-09-30, 횟수 세기) ──
//
// 횟수를 세려면 **흐르는 화면**을 봐야 한다. 그런데 모델 하나에 두 모드를 겹쳐 쓸 수
// 없다 — `IMAGE` 로 만든 것에 영상을 넣으면 거절하고, 모드를 바꿔 끼우면 **체형이
// 쓰던 것과 서로 모드를 빼앗는다**(같은 화면에서 둘이 열릴 일은 없지만, 그런 자리는
// 언젠가 생긴다).
//
// 그래서 **따로 하나 더 만든다.** wasm 과 모델 파일은 브라우저가 이미 받아 캐시에
// 들고 있으므로, 두 번째 것을 만드는 값은 내려받기가 아니라 **만드는 값**뿐이다.
let readyVideo = null;
let inflightVideo = null;

/** 영상용 모델. 쓸 때 만들고 들고 있는다 (`loadPose` 와 같은 결). */
export async function loadPoseVideo(onStage) {
  if (readyVideo) return readyVideo;
  if (inflightVideo) return inflightVideo;

  inflightVideo = (async () => {
    onStage?.('download');
    const vision = await import('@mediapipe/tasks-vision');
    const files = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
    onStage?.('prepare');
    const landmarker = await vision.PoseLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      // 흐르는 화면이다. 앞 장면을 기억하는 것이 여기서는 **도움이 된다** —
      // 한 프레임 놓쳐도 관절 자리가 튀지 않는다
      runningMode: 'VIDEO',
      numPoses: 1,
    });
    readyVideo = landmarker;
    inflightVideo = null;
    onStage?.('done');
    return landmarker;
  })().catch((e) => { inflightVideo = null; throw e; });

  return inflightVideo;
}

/**
 * 흐르는 화면의 한 프레임 → 관절 33점.
 *
 * `at` 은 그 프레임의 시각(ms). **뒤로 가는 값을 주면 모델이 거절한다** — 부르는 쪽이
 * 늘 늘어나는 값을 준다(`performance.now()`).
 */
export async function readPoseFrame(video, at, onStage) {
  const landmarker = await loadPoseVideo(onStage);
  const out = landmarker.detectForVideo(video, at);
  return out?.landmarks?.[0] || null;
}

/** 영상용도 같이 버린다 (`resetPose` 와 짝). */
export function resetPoseVideo() {
  readyVideo?.close?.();
  readyVideo = null;
  inflightVideo = null;
}

/**
 * 사진 한 장 → 관절 33점(정규화 좌표).
 *
 * img 는 이미 다 그려진 `HTMLImageElement`. 아직 안 그려진 것을 넣으면 모델이
 * 빈 그림을 읽고 **아무도 못 찾았다**고 한다 — 부르는 쪽에서 `decode()` 를 기다린다.
 */
export async function readPose(img, onStage) {
  const landmarker = await loadPose(onStage);
  onStage?.('read');
  const out = landmarker.detect(img);
  const marks = out?.landmarks?.[0] || null;
  onStage?.('done');
  return marks;
}
