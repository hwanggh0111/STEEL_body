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

// ── ★ **집 전체를 믿고 있었다** ── (2026-11-26 · 근호 점검 안전 4)
//
// 여태 `https://cdn.jsdelivr.net` **통째로**였다. 그 집에는 **누구나 올린 꾸러미가
// 수십만 개** 있다 — 즉 「jsdelivr 에 있는 아무 스크립트나 받아도 된다」였다.
// 어디선가 주소 한 줄을 끼워 넣을 수 있으면(링크 · 설명글 · 남이 올린 꾸러미 이름)
// CSP 가 막아주지 않는다. `storage.googleapis.com` 도 같다 — 버킷 전체다.
//
// **CSP 는 좁을수록 지킨다**(이 파일이 11/13 에 구글 글꼴 집 둘을 걷으며 적어둔 그 말).
// 그래서 **우리가 실제로 받는 그 길까지** 적는다. CSP 는 `/` 로 끝나는 길을
// **앞자리 맞추기**로 본다 — 그 아래만 열린다.
//
// 길이 바뀌면(판 올림) 조용히 막히지 않게, `check-cspnarrow` 가 **앱이 적어둔 주소가
// 이 앞자리로 시작하는지** 본다. 두 벌이 어긋나는 그 꼴을 자가 잡는다.
const MEDIAPIPE = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/',          // wasm 글루 (tasks-vision)
  'https://storage.googleapis.com/mediapipe-models/',  // 자세 모델 파일
];

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
  // ★ **구글 글꼴 집 둘을 걷었다** (2026-11-13) — 11/13 에 본문 글꼴 넷까지 잘라
  // 우리 주소에서 내주면서(`npm run sans`) **앱이 구글에 한 번도 안 묻는다.**
  // 안 쓰는 집을 허락해 두면 그만큼이 **열린 문**으로 남는다 — 어디선가 주소를
  // 한 줄 끼워 넣으면 CSP 가 막아주지 않는다. `check-security` 가 「허락했는데
  // 앱이 안 묻는 집」으로 이 둘을 집어냈다
  'style-src': ["'self'", "'unsafe-inline'"],
  // 글꼴은 **전부 우리 집 것이다**(`/assets/` · 명조 10/20 · 본문 넷 11/13)
  'font-src': ["'self'"],
  'img-src': ["'self'", 'data:', 'blob:'],
  'connect-src': ["'self'", ...MEDIAPIPE],
  // 미디어파이프가 blob 으로 일꾼을 세운다
  'worker-src': ["'self'", 'blob:'],
  'frame-src': ["'none'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  // ── ★ **화면 문서에 가는 CSP 가 helmet 의 셋을 잃고 있었다** ── (2026-11-26 · 근호 안전 8)
  //
  // helmet 은 적어주지 않은 것에 **제 기본값**을 보탠다. 그래서 API 응답에는 아래 셋이
  // 붙었는데, 화면 문서(`index.html`)에는 `spaCSP` 가 **이 표만** 적어 보내서 셋이
  // 빠졌다 — **같은 앱의 두 응답이 다른 말을 하고 있었다.**
  //
  // 고치는 방향은 「`spaCSP` 에 또 적기」가 아니다(그러면 두 벌이 되고, 이 파일이
  // 만들어진 까닭이 바로 그 두 벌을 없애려는 것이다). **여기 한 곳에 적으면 양쪽이
  // 같이 받는다.**
  'script-src-attr': ["'none'"],        // `onclick="..."` 같은 속성 안의 코드를 막는다
  'frame-ancestors': ["'self'"],        // 남의 페이지에 끼워 넣지 못한다 (클릭재킹)
  'upgrade-insecure-requests': [],      // 값이 없는 지시 — 아래 `headerValue` 가 이름만 적는다
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
    // **값이 없는 지시는 이름만 적는다** (`upgrade-insecure-requests`) —
    // `이름 ` 처럼 빈칸을 붙여 보내면 읽는 쪽이 통째로 버릴 수 있다
    .map(([k, v]) => (v.length === 0 ? k : `${k} ${v.join(' ')}`))
    .join('; ');
}

module.exports = { DIRECTIVES, MEDIAPIPE, helmetDirectives, headerValue };
