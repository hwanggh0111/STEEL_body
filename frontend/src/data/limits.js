// 서버가 못 박은 한도 (2026-10-28).
//
// ── 왜 여기 있나 ──
//
// 서버는 넘치면 거절한다 — 루틴 한 벌에 운동 쉰 개, 하루에 담는 계획 열 개.
// 그런데 **화면이 그 수를 하나도 말하지 않았다.** 「+ 운동 추가」는 쉰한 번 눌리고,
// 저장을 누른 다음에야 「운동은 최대 50개까지 가능해요」가 떴다. 이 앱이 거듭
// 세워온 선이 그 반대다 — **누르기 전에 말한다**(아이디 30일 · 막힘 까닭 ·
// 「며칠 남았나는 서버가 센다」).
//
// ── 이름을 서버와 **똑같이** 둔다 ──
//
// 같은 숫자가 두 곳에 있으면 **반드시 어긋난다**(10/22 에 세운 자). 서버에서
// 값을 받아오는 길을 새로 내는 것이 더 맞지만, 이 둘은 **한 번도 바뀐 적이 없는
// 선**이고 길을 내면 화면이 그 응답을 기다려야 한다. 대신 **이름을 서버와 같게**
// 두어 `npm run twins` 가 양쪽 값을 견주게 한다 — 한쪽을 고치는 날 FAIL 한다.
//
//   MAX_EXERCISES → backend/src/routes/myRoutines.js
//   MAX_PER_DAY   → backend/src/routes/plans.js
//   MAX_NOTES     → backend/src/routes/notes.js
//   MAX_GYMS      → backend/src/routes/gymSettings.js

/** 루틴 한 벌에 담을 운동 수. */
export const MAX_EXERCISES = 50;

/** 하루에 담을 계획 수. */
export const MAX_PER_DAY = 10;

/** 루틴 메모(날짜 없는 것) 장수. */
export const MAX_NOTES = 30;

/** 적어둘 헬스장 수. */
export const MAX_GYMS = 12;
