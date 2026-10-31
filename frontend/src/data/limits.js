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

/**
 * 점검 스케줄 개수 (관리자 화면).
 *
 * 사이트 사진은 이미 「12 / 12장 · 지워야 더 걸 수 있어요」로 세어 보여주는데
 * 점검 쪽은 아무 말이 없었다 — 스물한 개째를 다 적고 저장에서야 막혔다.
 *
 *   MAINT_MAX → backend/src/routes/maintenance.js
 *   (서버 안에 `MAX_ITEMS` 가 둘이라 — 점검 20 · 루틴 진행 50 — 이름을 또렷하게 뒀다)
 */
export const MAINT_MAX = 20;

/**
 * 인바디 칸의 테두리.
 *
 * 서버가 거절하는 그 수다. 여태 **세 자리**(서버 두 번 · 파일로 넣는 길)에 글자로
 * 박혀 있었고 **화면에는 아무 데도 없었다** — 칸에 `max` 가 없어서 201kg 을 적고
 * 저장을 누른 다음에야 「골격근량 값이 올바르지 않아요」를 들었다.
 *
 * **체지방률만 서로 달랐다** — 화면은 저장 전에 0~60 으로 막는데 서버와 파일 길은
 * 100 까지 받았다. 사람의 체지방률은 60%를 넘지 않는다 → 셋을 60 으로 맞췄다.
 *
 *   다섯 다 → backend/src/utils/inbodyRange.js
 */
export const INBODY_WEIGHT_MAX = 500;
export const INBODY_HEIGHT_MAX = 300;
export const FAT_PCT_MAX = 60;
export const MUSCLE_KG_MAX = 200;
export const WATER_L_MAX = 200;

/**
 * 세트 수 · 횟수.
 *
 * 기록 화면은 서버가 「세트는 100 이하, 횟수는 1000 이하여야 해요」로 막는다.
 * 그런데 **루틴 폼의 세트 · 회 칸에는 테두리가 하나도 없었고 서버도 안 봤다** —
 * 「999999세트」를 담을 수 있었다. 그 루틴을 시작하면 운동 화면이 세트 단추를
 * **구십구만 개** 그린다(`SetChecks`) — 폰이 멈춘다.
 *
 * 루틴의 세트 · 횟수는 **글자**다(추천 프로그램이 `'10~12'` 로 적는다). 그래서
 * 서버는 모양을 안 따지고 **적힌 숫자**만 본다.
 *
 *   둘 다 → backend/src/utils/setRange.js
 */
export const SETS_MAX = 100;
export const REPS_MAX = 1000;

/**
 * 수동 차단의 길이 (분 · 관리자 화면).
 *
 * 365일이다. 칸에 `max` 가 없어서 큰 수를 적으면 **누른 다음에야** 거절당했다 —
 * 이 앱이 거듭 세워온 선이 그 반대다(**누르기 전에 말한다**).
 *
 *   BLOCK_MIN_MAX → backend/src/routes/security.js
 */
export const BLOCK_MIN_MAX = 525600;

/**
 * 파일로 넣을 때 **한 번에 받는 줄 수** (가져오기).
 *
 * 서버가 넘치면 413 으로 거절한다 — 그런데 화면은 **파일 크기만** 보고 올렸다.
 * 5년치가 3만 줄 · 1.2MB 쯤이라 **크기는 통과하고 줄 수에서 걸린다**:
 * 고르고 · 확인하고 · 올리기를 기다린 다음에야 「한 번에 20,000줄까지」를 듣는다.
 * **누르기 전에 말한다.**
 *
 * 서버는 **읽어낸 기록 수**를 세고 화면은 **파일의 줄 수**를 센다. 운동 · 인바디는
 * 한 줄이 한 기록이라 같은 수지만, **측정은 여러 줄이 한 기록으로 묶인다**
 * (날짜 · 종류 · 항목이 줄마다 하나씩) — 그래서 측정에서는 막지 않고 **적어만 둔다**.
 * 좁게 막으면 멀쩡한 파일을 되돌릴 수 없게 된다 (10/27 에 세운 자).
 *
 *   MAX_ROWS → backend/src/routes/importData.js
 */
export const MAX_ROWS = 20000;

/**
 * 이름(닉네임)의 글자 수 · 계획 한 줄의 글자 수.
 *
 * 닉네임은 **화면 둘이 서로 다른 선을 들고 있었다** — 가입은 30 인데 설정의
 * 「이름 바꾸기」는 20 이었다. **같은 서버 길로 가는 같은 칸**이다.
 * 가입 때 25자로 지은 사람이 설정에서는 그 이름을 고칠 수 없었다
 * (지우면 20자 아래로만 다시 쓸 수 있다). **넷 중 하나만 다른 자리는 잊은
 * 자리다**(10/28 에 세운 자).
 *
 * 계획 이름은 서버가 40 으로 다듬는데 화면이 `slice(0, 40)` 로 따로 적고 있었다.
 *
 *   NICKNAME_MAX  → backend/src/routes/auth.js
 *   PLAN_NAME_MAX → backend/src/routes/plans.js
 */
export const NICKNAME_MAX = 30;
export const PLAN_NAME_MAX = 40;

/**
 * 아이디의 글자 수.
 *
 * 글자 규칙까지 합쳐 **다섯 자리**에 적혀 있었다 — 서버 셋(중복 확인 · 가입 ·
 * 바꾸기)과 화면 둘. 서버는 `badUsername` 한 자리로, 화면은 `data/username.js`
 * 한 자리로 묶었다.
 *
 *   둘 다 → backend/src/routes/auth.js
 */
export const USERNAME_MIN = 4;
export const USERNAME_MAX = 20;
