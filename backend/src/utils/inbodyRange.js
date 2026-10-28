// 인바디 칸의 **테두리 한 자리** (2026-10-28).
//
// ── 왜 생겼나 ──
//
// 같은 테두리가 **세 자리**에 글자로 박혀 있었다 —
//
//   · `routes/inbody.js` 의 만들기 · 고치기 (두 번)
//   · `utils/csvRows.js` 의 파일로 넣는 길
//   · 화면(`InbodyPage`)의 저장 전 검사
//
// 그리고 **체지방률만 서로 달랐다.** 화면은 0~60 으로 막는데 서버와 파일 길은
// **100** 까지 받았다 — 앱으로 들어온 값은 전부 60 이하인데 **파일로 넣는 길만**
// 61~100 을 통과시키고 있었다. `csvRows.js` 는 그 줄 위에
// **「화면·서버가 쓰는 것과 같은 테두리」**라고 적어두고 있었다. 아니었다.
//
// 사람의 체지방률은 60%를 넘지 않는다. **셋을 같은 수로 맞춘다** —
// 파일로 넣던 61~100 은 잘못 적힌 값일 확률이 압도적이다.
//
// 이름을 화면과 똑같이 둔다(`frontend/src/data/limits.js`) —
// `npm run twins` 가 양쪽 값을 견준다. 거절하는 말도 이 수로 짓는다.

const INBODY_WEIGHT_MAX = 500;
const INBODY_HEIGHT_MAX = 300;
const FAT_PCT_MAX = 60;
const MUSCLE_KG_MAX = 200;
const WATER_L_MAX = 200;

/** 파일로 넣는 길이 쓰는 표 (`[최소, 최대]`) — 같은 수에서 나온다 */
const RANGE = {
  height: [1, INBODY_HEIGHT_MAX],
  weight: [1, INBODY_WEIGHT_MAX],
  fat_pct: [0, FAT_PCT_MAX],
  muscle_kg: [0, MUSCLE_KG_MAX],
  water_l: [0, WATER_L_MAX],
};

module.exports = {
  INBODY_WEIGHT_MAX, INBODY_HEIGHT_MAX, FAT_PCT_MAX, MUSCLE_KG_MAX, WATER_L_MAX, RANGE,
};
