// 무엇을 받아도 되는가 (CSP) — **한 곳에서 정한다** (2026-10-20).
//
// ── 두 벌이었다 ──
//
// `index.html` 같은 화면 문서에는 `spaCSP` 가 붙고, 나머지 응답에는 helmet 설정이
// 붙는데 **둘이 글자로 따로 적혀 있었다**(`index.js`). 한쪽만 고치는 날이 오면
// 「내 컴퓨터에서는 되는데 배포에서 막히는」 일이 생긴다 — 그게 지금 그 일이었다.
//
// ── 막혀 있던 것 ──
//
// **체형 읽기와 횟수 세기가 운영에서 막혀 있었다.** 그 둘은 미디어파이프를 쓰고,
// 미디어파이프는 wasm 과 모델을 **남의 집에서** 받는다 —
//
//     wasm   https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@…/wasm
//     모델   https://storage.googleapis.com/mediapipe-models/…/pose_landmarker_lite.task
//
// 그런데 `script-src 'self'` · `connect-src 'self' …` 라 **둘 다 못 받는다.**
// 홈페이지에 「체형 읽기」와 「횟수 세기」를 하는 것이라고 적어둔 자리가 있는데,
// 배포본에서는 그 둘이 안 되는 셈이었다.
//
// ── 왜 우리 집에 두지 않나 ──
//
// 받아서 같이 내주는 쪽이 깔끔하지만 **wasm 이 11.7MB 씩 둘(simd · nosimd)이고
// 모델이 5MB** 다. 무료 판 서버에 24MB 를 얹고 저장소에 넣는 것보다, 쓰는 사람만
// 받게 두는 쪽이 낫다(「체형」 갈래를 안 열면 한 조각도 안 받는다 — `poseModel.js`).
// 그래서 **그 두 집만 콕 집어 허락한다.**
//
// `'wasm-unsafe-eval'` 은 WebAssembly 를 세우는 데 필요하다 — 없으면 wasm 을 받아도
// 못 돌린다. `eval` 을 여는 것이 아니다(그건 `'unsafe-eval'` 이다).

/** 미디어파이프가 받는 두 집 — 체형 읽기 · 횟수 세기가 여기에 걸려 있다 */
const MEDIAPIPE = ['https://cdn.jsdelivr.net', 'https://storage.googleapis.com'];

// ── 밖으로 묻는 곳은 **지금 미디어파이프 둘뿐이다** ── (2026-10-21)
//
// 여기 `OUTSIDE = ['https://api.open-meteo.com', 'https://wger.de']` 가 있었다 —
// 「날씨(헬스장 추천)와 외부 운동 DB」라고 적혀 있었는데 **둘 다 앱이 묻지 않는 집**이다.
//
//   api.open-meteo.com  날씨로 운동을 고르던 화면은 **8/19 에 지웠다**
//                       (`WeatherWorkout.jsx`, 커밋 d2a6cbe). 두 달 동안 여기에만 남았다
//   wger.de             그쪽이 API 를 바꿔서 찾기 길이 **404** 다. 그 기능을 10/21 에
//                       걷었다 (`frontend/src/components/ExerciseFinder.jsx` 머리글)
//
// **CSP 는 좁을수록 지킨다.** 안 쓰는 집을 열어두면 지키는 힘만 줄어든다.
//
// 10/20 에 붙인 검사는 **코드 → CSP** 한 방향만 봤다(「앱이 적어둔 집이 CSP 에 있나」).
// 그래서 이 둘은 조용히 통과했다 — 같은 날 **CSP → 코드**도 보게 했다.

const DIRECTIVES = {
  'default-src': ["'self'"],
  // wasm 글루 스크립트는 jsdelivr 에서 온다
  'script-src': ["'self'", "'wasm-unsafe-eval'", ...MEDIAPIPE.slice(0, 1)],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  // 잘라둔 명조는 우리 집 것이다(`/assets/`). 나머지 라틴 글꼴은 구글에서 온다
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  'img-src': ["'self'", 'data:', 'blob:'],
  'connect-src': ["'self'", ...MEDIAPIPE],
  // 미디어파이프가 blob 으로 일꾼을 세운다
  'worker-src': ["'self'", 'blob:'],
  'frame-src': ["'none'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
};

/** helmet 이 받는 모양 — 열쇠가 카멜케이스다 */
function helmetDirectives() {
  const out = {};
  for (const [k, v] of Object.entries(DIRECTIVES)) {
    out[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  }
  return out;
}

/** 머리에 그대로 적는 한 줄 */
function headerValue() {
  return Object.entries(DIRECTIVES)
    .map(([k, v]) => `${k} ${v.join(' ')}`)
    .join('; ');
}

module.exports = { DIRECTIVES, MEDIAPIPE, helmetDirectives, headerValue };
