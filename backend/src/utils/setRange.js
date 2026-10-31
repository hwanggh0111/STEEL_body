// 세트 · 횟수의 **테두리 한 자리** (2026-10-31).
//
// ── 왜 생겼나 ──
//
// 기록 화면은 「세트는 100 이하, 횟수는 1000 이하여야 해요」로 막는다. 그 수가
// `routes/workouts.js` 에 **생글자로** 박혀 있었고, `routes/routineSession.js` 는
// 옆에 `MAX_SETS = 100` 을 따로 적어두고 **「기록 화면의 세트 칸이 100 까지 받는다」**
// 라고 주석으로 맞춰 뒀다 — 주석으로 맞춘 것은 맞춰진 것이 아니다.
//
// 그런데 **루틴**(`routes/myRoutines.js`)은 sets · reps 를 **아예 안 봤다.**
// `{ ...ex }` 로 받은 것을 그대로 담는다. 그래서 「999999세트」가 들어가고,
// 그 루틴을 시작하면 진행표가 `sets: 999999` 를 담고, 운동 화면의 세트 단추가
// **999,999개 그려진다**(`SetChecks` 의 `Array.from({ length: count })`) — 폰이 멈춘다.
//
// ── 글로 적힌 것이 섞여 있다 ──
//
// 루틴의 sets · reps 는 **글자**다. 추천 프로그램이 `'10~12'` · `'4세트'` 처럼 적어
// 넣는다(`routineSession.js` 가 첫 숫자를 뽑아 쓰는 그 까닭이다). 그래서 여기서는
// 「숫자여야 한다」고 말하지 않는다 — **적힌 숫자가 테두리 안인지**만 본다.
//
// 이름을 화면과 똑같이 둔다(`frontend/src/data/limits.js`) —
// `npm run twins` 가 양쪽 값을 견준다.

/** 한 운동의 세트 수. */
const SETS_MAX = 100;

/** 한 세트의 횟수. */
const REPS_MAX = 1000;

/**
 * 글로 적힌 세트 · 횟수에서 **첫 숫자**를 뽑는다.
 * `'10~12'` → 10 · `'4세트'` → 4 · `''` → null.
 *
 * `routineSession.js` 의 `firstNum` 과 **같은 자**여야 한다 — 거기서 뽑은 수가
 * 화면이 단추를 그리는 수다. 그래서 그 파일도 이것을 쓴다.
 */
function firstNum(v) {
  const m = String(v ?? '').match(/\d+/);
  return m ? Number(m[0]) : null;
}

/**
 * 루틴 한 줄의 sets · reps 가 테두리 안인가.
 * @returns {{ ok: true } | { ok: false, why: string }}
 */
function checkSetsReps(ex) {
  const s = firstNum(ex?.sets);
  if (s !== null && (s < 1 || s > SETS_MAX)) {
    return { ok: false, why: `세트는 1~${SETS_MAX} 범위여야 해요 (${ex.name || '운동'}: ${ex.sets})` };
  }
  const r = firstNum(ex?.reps);
  if (r !== null && (r < 1 || r > REPS_MAX)) {
    return { ok: false, why: `횟수는 1~${REPS_MAX} 범위여야 해요 (${ex.name || '운동'}: ${ex.reps})` };
  }
  return { ok: true };
}

/**
 * **이미 담긴** 루틴에서 온 세트 · 횟수.
 *
 * 위 `checkSetsReps` 는 **새로 들어오는 것**만 막는다. 그 전에 담긴 루틴에는
 * 「999999세트」가 그대로 남아 있고, 진행표를 만들 때 그 수가 화면으로 간다 —
 * 테두리 밖이면 **모르는 것으로 둔다**(`null`). 화면은 몇 세트인지 모를 때
 * 「여기까지 기록」으로 끝내는 길을 이미 들고 있다. 지어내지 않는다
 */
function saneSets(v) {
  const n = firstNum(v);
  return n !== null && n >= 1 && n <= SETS_MAX ? n : null;
}

function saneReps(v) {
  const n = firstNum(v);
  return n !== null && n >= 1 && n <= REPS_MAX ? n : null;
}

module.exports = { SETS_MAX, REPS_MAX, firstNum, checkSetsReps, saneSets, saneReps };
