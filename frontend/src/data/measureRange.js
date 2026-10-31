// 측정 도구 칸의 **테두리** — 서버와 같은 표 (2026-10-31).
//
// 서버의 `backend/src/utils/measureRange.js` 와 **같은 수**다. 거기 머리글에 왜
// 생겼는지가 적혀 있다 — 한 줄로 줄이면 **나이 999 를 넣으면 「최대 심박수 어림값
// −779bpm」을 크게 적고 존 다섯을 음수로 그렸고, 허리둘레 0 에서는 「어깨 : 허리
// Infinity」를 적고 저장까지 됐다.**
//
// 화면과 서버는 따로 지어지니 한쪽을 불러 쓸 수 없다. 대신 `npm run bounds` 가
// **표 전체**를 글자로 견주고, `npm run twins` 가 이름이 같은 숫자를 견준다 —
// 한쪽을 고치는 날 FAIL 한다.

/** 몸 둘레 · 너비 (cm). */
export const BODY_CM_MAX = 300;

/** 유연성 (cm). **음수가 뜻이 있다** — 손끝이 발끝에 못 닿으면 −10cm 다. */
export const FLEX_CM_MAX = 100;

/** 체력 테스트의 개수. 세계 기록 위에 둔다 — 재는 사람을 막는 선이 아니다. */
export const FITNESS_COUNT_MAX = 10000;

/** 초로 재는 것 (플랭크 · 1km · 타이머). 하루. */
export const MEASURE_SEC_MAX = 86400;

/** 스톱워치가 남기는 밀리초. 하루. */
export const MEASURE_MS_MAX = 86400000;

/**
 * 나이 · 심박수 (심박 존).
 *
 * 저장하지 않는 칸이지만 **그 값으로 화면이 말을 짓는다** — 220 − 나이로 최대
 * 심박수를 적고 존 다섯의 구간을 그린다. 나이 220 은 0 이 되어 조용히 아무것도
 * 안 나왔고, 그 위는 음수가 됐다.
 */
export const AGE_MIN = 10;
export const AGE_MAX = 120;
export const HR_MIN = 30;
export const HR_MAX = 250;
