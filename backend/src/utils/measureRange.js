// 측정 도구 칸의 **테두리 한 자리** (2026-10-31).
//
// ── 왜 생겼나 ──
//
// 10/28 에 인바디 · 원판 · 1RM 의 테두리를 한 바퀴 돌고 적어둔 자가 있다 —
// **「자유 입력 칸은 반드시 테두리를 물어본다. 그 값으로 화면이 말을 짓는다」.**
// 재는 도구 여섯은 그 바퀴에서 빠져 있었다. 그래서 —
//
//   · **나이 999 를 넣으면 「최대 심박수 어림값 −779bpm」**을 36px 로 크게 적고,
//     존 다섯을 전부 음수로 그렸다(「존1 −389~−467」 — 작은 쪽이 더 크다).
//     나이 220 은 `220 − 220 = 0` 이라 **조용히 아무것도 안 나왔다**
//   · **허리둘레에 0 을 넣으면 「어깨 : 허리 Infinity」**를 적고 저장까지 됐다
//     (JSON 으로는 `null` 로 들어간다 — 되돌릴 수 없는 값이다)
//   · 사이즈 아홉 · 유연성 넷 · 체력 다섯 · 타이머 한 칸에 `min`·`max` 가 없었다
//
// 그리고 **서버는 값의 범위를 아예 안 봤다** — `routes/measures.js` 는 종류 ·
// 날짜 · 10KB 만 보고 `sanitizeObj(data)` 를 그대로 담는다. 파일로 넣는 길
// (`utils/csvRows.js`)도 같았다 — 10/28 에 인바디에서 겪은 **「파일로 넣는 길만
// 다른 테두리를 쓰던」** 그 자리다.
//
// ── 어디까지로 하나 ──
//
// **사람의 몸에서 나올 수 있는 값**까지다. 그 위는 몸이 아니라 **적은 값이 틀린
// 것**이다 (1RM 600kg · FFMI 30 에서 그은 그 선이다).
//
//   · 둘레는 cm 다. 300cm 는 인바디 키 상한과 같은 수다
//   · **유연성은 음수가 뜻이 있다** — 손끝이 발끝에 못 닿으면 −10cm 고,
//     스쿼트 깊이는 0 이 평행이다. 그래서 아래로도 열어 둔다
//   · 체력의 개수는 **세계 기록 위**로 둔다. 재는 사람을 막는 선이 아니다
//   · 초 · 밀리초는 **하루**까지다. 플랭크 세계 기록이 아홉 시간 남짓이다
//
// 이름을 화면과 똑같이 둔다(`frontend/src/data/measureRange.js`) —
// `npm run twins` 가 숫자를, `npm run bounds` 가 표 전체를 견준다.

/** 몸 둘레 · 너비 (cm). */
const BODY_CM_MAX = 300;

/** 유연성 (cm). 아래로도 같은 만큼 열어 둔다 — 음수가 뜻이 있다. */
const FLEX_CM_MAX = 100;

/** 체력 테스트의 개수. 세계 기록 위에 둔다. */
const FITNESS_COUNT_MAX = 10000;

/** 초로 재는 것 (플랭크 · 1km). 하루. */
const MEASURE_SEC_MAX = 86400;

/** 스톱워치가 남기는 밀리초. 하루. */
const MEASURE_MS_MAX = 86400000;

/** 심박수 · 나이 (심박 존 화면. 저장은 안 한다 — 칸의 테두리다). */
const AGE_MIN = 10;
const AGE_MAX = 120;
const HR_MIN = 30;
const HR_MAX = 250;

/** 1RM — 화면이 쓰는 그 수와 같은 이름이다 (`frontend/src/data/personalRecord.js`). */
const RM_SANE_MAX = 600;
const RM_MAX_REPS = 36;

/**
 * 종류별 `열쇠 → [최소, 최대]`.
 *
 * **여기 없는 열쇠는 안 본다** — 스톱워치의 `formatted`(글자) · `laps`(목록) ·
 * 1RM 의 `exercise`(이름)처럼 수가 아닌 것이 있다. 모르는 열쇠를 막으면
 * 다음에 항목 하나를 더하는 날 **저장이 조용히 거절된다**
 */
const MEASURE_RANGE = {
  bodySize: {
    chest: [1, BODY_CM_MAX], waist: [1, BODY_CM_MAX], hip: [1, BODY_CM_MAX],
    arm_l: [1, BODY_CM_MAX], arm_r: [1, BODY_CM_MAX],
    thigh_l: [1, BODY_CM_MAX], thigh_r: [1, BODY_CM_MAX],
    calf: [1, BODY_CM_MAX], neck: [1, BODY_CM_MAX],
  },
  shoulder: {
    shoulder: [1, BODY_CM_MAX], waist: [1, BODY_CM_MAX],
    // 어깨를 허리로 나눈 값. 둘이 테두리 안이면 이 안에 든다 —
    // **0 으로 나눈 것(Infinity)을 여기서 막는다**
    ratio: [0.01, BODY_CM_MAX],
  },
  flexibility: {
    sitreach: [-FLEX_CM_MAX, FLEX_CM_MAX],
    shoulder_l: [-FLEX_CM_MAX, FLEX_CM_MAX],
    shoulder_r: [-FLEX_CM_MAX, FLEX_CM_MAX],
    squat_depth: [-FLEX_CM_MAX, FLEX_CM_MAX],
  },
  fitness: {
    pushup: [1, FITNESS_COUNT_MAX], pullup: [1, FITNESS_COUNT_MAX],
    situp: [1, FITNESS_COUNT_MAX], squat_max: [1, FITNESS_COUNT_MAX],
    plank: [1, MEASURE_SEC_MAX], run_1km: [1, MEASURE_SEC_MAX],
  },
  stopwatch: {
    time: [0, MEASURE_MS_MAX],
  },
  oneRM: {
    weight: [0, RM_SANE_MAX], reps: [1, RM_MAX_REPS], orm: [0, RM_SANE_MAX],
  },
};

const { FIELD_LABEL } = require('./measureLabels');
// 조사는 **붙여서** 적는다 (`utils/particle.js`) — 「가슴둘레는」 · 「허리둘레는」
const { eun } = require('./particle');

/**
 * 한 측정 기록의 값들이 테두리 안인가.
 *
 * **빈 칸은 안 본다** — 재는 도구는 적은 것만 보낸다(아홉 칸 중 둘만 적는다).
 * 수가 아닌 글자가 오면 그것도 거절한다 — 그 값으로 화면이 그래프를 그린다.
 *
 * @returns {{ ok: true } | { ok: false, why: string }}
 */
function checkMeasure(type, data) {
  const table = MEASURE_RANGE[type];
  if (!table) return { ok: true };            // 테두리를 정한 적 없는 종류는 안 본다
  for (const [key, raw] of Object.entries(data || {})) {
    const bound = table[key];
    if (!bound) continue;                     // 수가 아닌 칸(이름 · 랩 목록)
    if (raw === '' || raw === null || raw === undefined) continue;
    const n = Number(raw);
    const name = FIELD_LABEL[key] || key;
    if (!Number.isFinite(n)) {
      return { ok: false, why: `${eun(name)} 숫자로 적어주세요` };
    }
    const [lo, hi] = bound;
    if (n < lo || n > hi) {
      return { ok: false, why: `${eun(name)} ${lo}~${hi} 범위여야 해요 (적은 값: ${raw})` };
    }
  }
  return { ok: true };
}

module.exports = {
  BODY_CM_MAX, FLEX_CM_MAX, FITNESS_COUNT_MAX, MEASURE_SEC_MAX, MEASURE_MS_MAX,
  AGE_MIN, AGE_MAX, HR_MIN, HR_MAX, RM_SANE_MAX, RM_MAX_REPS,
  MEASURE_RANGE, checkMeasure,
};
