// 운동 한 줄의 **칸을 다듬는 자** (2026-10-22).
//
// ── 왜 생겼나 ──
//
// 같은 기록이 들어오는 길이 둘이다 — 손으로 적는 길(`POST /workouts`)과 파일로
// 넣는 길(`POST /import` → `utils/csvRows`). 그런데 **자가 두 벌이었다.**
//
//   손으로 적으면   `-50` → 400 「무게 값이 올바르지 않아요」
//   파일로 넣으면   `-50` → **그대로 저장된다**
//
// 음수를 막는 까닭은 `routes/workouts.js` 에 적혀 있다 — 기록에는 `-50` 이라 뜨는데
// 볼륨을 세는 쪽은 앞의 부호를 못 보고 50 으로 센다. **같은 줄의 두 숫자가 서로 다른
// 말을 한다.** 파일로 들어온 줄이라고 그 셈이 달라지지 않는다.
//
// 이름 쪽도 어긋났다. 파일 읽는 쪽은 「비었나」만 봤고(`!exercise`), 가져오는 라우트가
// 그 뒤에 `cleanName` 을 불러 **`null` 이 되면 그대로 넣었다** — `<<<>>>` 처럼
// 새니타이즈하면 아무것도 안 남는 이름이 그렇다. 손으로 적는 길은 같은 값을
// 400 으로 막는다(「운동명을 적어주세요」). **이름 없는 기록**이 파일 길로만 들어왔다.
//
// 자를 여기 한 곳에 둔다. 두 길이 이것을 부른다 — 두 곳에 적어두면 반드시 어긋난다.
const { sanitize, cleanName } = require('./sanitize');

/** 무게 칸 한도(글자 수). 자유 입력이라 '60' · '20kg' · '맨몸' · '밴드' 가 다 들어온다 */
const WEIGHT_MAX = 30;
/**
 * 무게로 **읽히는 숫자**의 한도 (2026-11-03).
 *
 * ── 서버에 이 선이 아예 없었다 ──
 *
 * 글자 수(30)와 음수만 보고 있었다. 그래서 `999999` 가 **그대로 들어갔다** —
 * 화면은 `max={999}` 로 막는데 서버는 안 막았다. 이 앱이 거듭 없애온 그 모양이다
 * (한도가 한쪽에만 있거나 양쪽에 다르게 적혀 있다 — `npm run twins` 가 그걸 잡는다).
 *
 * **한 줄이 들어가면 그 뒤가 전부 틀린다**: 결산이 「2999만 kg 들었다」로 뜨고,
 * 최고 기록이 999999kg 으로 박히고(그 뒤로 어떤 기록도 못 넘는다), 원판은
 * 「양쪽 25×10 (999479kg 모자람)」을 적는다. 사람이 손으로 지울 때까지 남는다.
 *
 * 숫자가 안 읽히는 값은 그대로 둔다 — '맨몸' · '밴드' · '케틀벨' 은 무게가 아니다.
 * 999 는 화면의 `max` 와 같은 수다(세계 기록이 500kg 대다 — 그 두 배로 넉넉히 둔다).
 *
 *   WEIGHT_KG_MAX → frontend/src/data/limits.js (`npm run twins` 가 견준다)
 */
const WEIGHT_KG_MAX = 999;
/** 운동명 한도 */
const NAME_MAX = 100;

/**
 * 무게 칸을 다듬는다.
 *
 * @returns {{ ok: true, value: string }}  쓸 수 있는 값 (빈 칸은 '맨몸')
 * @returns {{ ok: false, why: string }}   쓸 수 없는 값 — 왜인지 같이 준다
 */
function normalizeWeight(raw) {
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: '맨몸' };
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    return { ok: false, why: '무게 값이 올바르지 않아요' };
  }
  const value = sanitize(String(raw)).slice(0, WEIGHT_MAX).trim();
  // 음수는 막는다. 기록에는 '-50' 이라 뜨는데 볼륨을 세는 쪽은 앞의 부호를 못 보고
  // 50 으로 세서, 같은 줄의 두 숫자가 서로 다른 말을 하고 있었다
  if (/^-\s*\d/.test(value)) return { ok: false, why: '무게는 음수일 수 없어요' };
  // **읽히는 숫자가 있으면 그 크기를 본다** (위 `WEIGHT_KG_MAX` 머리글).
  // 화면이 읽는 자와 같은 자리를 읽는다 — 앞에서부터 처음 나오는 수다
  // (`frontend/src/data/personalRecord.js` 의 `parseWeight`)
  const num = /\d+(?:\.\d+)?/.exec(value.replace(/[,\s]/g, ''));
  if (num && Number(num[0]) > WEIGHT_KG_MAX) {
    return { ok: false, why: `무게는 ${WEIGHT_KG_MAX}kg 이하로 적어주세요` };
  }
  return { ok: true, value: value || '맨몸' };
}

/**
 * 운동명을 다듬는다. **새니타이즈까지 끝낸 뒤에 비었는지 본다** —
 * 검사와 저장이 같은 값을 봐야 한다(`sanitize.js` 의 `cleanName` 머리글).
 *
 * @returns 쓸 수 있으면 다듬은 이름, 아니면 `null`
 */
function cleanExerciseName(raw) {
  return cleanName(raw, NAME_MAX);
}

// ── 한 줄 메모 · 여유 횟수 ── (2026-11-18 · 시안 1118b ⑧ ①)
//
// 같은 60kg × 8 이라도 **끝까지 간 날과 두 개 남긴 날은 다른 날**이고, 「왼무릎이
// 안쪽으로 모임」은 **그 줄 옆에** 있어야 다음에 읽힌다. 메모장(`routes/notes.js`)은
// 장 단위라 줄에 안 붙는다.
//
// 둘 다 **고르지 않아도 된다** — 비우면 칸을 안 만든다(옛 줄과 모양이 같아야 섞어 읽을 때
// 안 갈린다, `link` 와 같은 결). 받는 값은 셋으로 나뉜다:
//   `undefined` — 안 보냈다. 고치는 길에서 **건드리지 않는다**
//   `null` · 빈 글 — 지운다
//   그 밖 — 다듬어 담거나, **거절하고 까닭을 말한다**(조용히 자르지 않는다)

/** 메모 한도(글자 수). 화면 `data/limits.js` 와 같은 이름 — `check-twins` 가 맞댄다 */
const WORKOUT_NOTE_MAX = 40;
/**
 * 여유 횟수 — **아는 말만 받는다**(`link` 와 같은 선). 사람이 고르는 세 칸과 같다.
 * `1-2` 로 적지 않는다: 엑셀이 「1월 2일」로 바꿔 읽는다(CSV 로 나간다)
 */
const RIR_VALUES = ['0', '1~2', '3+'];

// 닉네임과 같은 자로 **보이지 않는 글자**만 걷는다 — 메모도 화면이 글자로 그린다
const { NICK_INVISIBLE } = require('./nickname');
const { tagLike, ANGLE_WHY } = require('./sanitize');

function normalizeNote(raw) {
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null || raw === '') return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false, why: '메모는 글로 적어주세요' };
  // 꺾쇠 뒤에 글자가 붙으면 거절한다 — 닉네임 · 운동명과 같은 선 (11/17)
  if (tagLike(raw)) return { ok: false, why: ANGLE_WHY };
  const v = raw.replace(NICK_INVISIBLE, '').replace(/[\t\r\n]+/g, ' ').trim();
  if (!v) return { ok: true, value: null };
  if (v.length > WORKOUT_NOTE_MAX) return { ok: false, why: `메모는 ${WORKOUT_NOTE_MAX}자까지 적을 수 있어요` };
  return { ok: true, value: v };
}

function normalizeRir(raw) {
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null || raw === '') return { ok: true, value: null };
  const v = typeof raw === 'number' ? String(raw) : raw;
  if (typeof v !== 'string' || !RIR_VALUES.includes(v.trim())) {
    return { ok: false, why: '여유 횟수는 0 · 1~2 · 3+ 중에서 골라주세요' };
  }
  return { ok: true, value: v.trim() };
}

module.exports = {
  normalizeWeight, cleanExerciseName, WEIGHT_MAX, WEIGHT_KG_MAX, NAME_MAX,
  normalizeNote, normalizeRir, WORKOUT_NOTE_MAX, RIR_VALUES,
};
