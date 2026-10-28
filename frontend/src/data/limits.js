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

/**
 * 루틴 이름의 글자 수 · 운동 이름의 글자 수.
 *
 * **이름을 또렷하게 둔다** (2026-10-28). 처음에 `NAME_MAX`·`EXERCISE_MAX` 로
 * 적었더니 **둘 다 이미 쓰이는 이름**이었다 — 앱의 `NAME_MAX` 는 **만든 소리 이름
 * 6자**고, 서버의 `EXERCISE_MAX` 는 **헬스장 세팅의 운동 이름 40자**다.
 * `npm run twins` 가 그 자리에서 「다르다 EXERCISE_MAX = 40 / 100」으로 잡아줬다 —
 * **같은 이름이 다른 칸을 가리키면 그 검사가 거짓 FAIL 을 낸다.**
 *
 * 둘 다 서버가 **말없이 자르던** 자리다 — 다듬는 자리에 생글자로 박혀 있고
 * 화면에는 아무 제한이 없어서, 101자를 치면 저장한 뒤 **잘린 이름**이 된다.
 * 운동 이름은 더 나쁘다: 잘린 이름은 **사전에 없는 이름**이 되고, 그러면 그 운동은
 * 몸 지도에 영영 안 들어간다(`RoutinePage` 머리글에 적어둔 그 위험이다).
 *
 *   ROUTINE_NAME_MAX  → backend/src/routes/myRoutines.js
 *   EXERCISE_NAME_MAX → backend/src/routes/workouts.js
 */
export const ROUTINE_NAME_MAX = 100;
export const EXERCISE_NAME_MAX = 100;

/**
 * 점검 사유의 글자 수 · 제보 답장의 글자 수 (관리자 화면).
 *
 * 둘 다 서버가 **말없이 자르던** 자리다. 관리자 화면이라도 그 글은 **쓰는 사람이
 * 읽는다** — 점검 사유는 점검 안내 화면에 그대로 뜨고, 답장은 제보한 사람이 읽는다.
 *
 *   REASON_MAX → backend/src/routes/maintenance.js
 *   BODY_MAX   → backend/src/routes/reports.js
 */
export const REASON_MAX = 60;
export const BODY_MAX = 2000;
