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
const { tidy: tidyName } = require('./nickname');
const { tagLike, ANGLE_WHY } = require('./sanitize');

function normalizeNote(raw) {
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null || raw === '') return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false, why: '메모는 글로 적어주세요' };
  // 꺾쇠 뒤에 글자가 붙으면 거절한다 — 닉네임 · 운동명과 같은 선 (11/17)
  //
  // **지우기 전에 보면 안 된다** (2026-11-19 · 정석). 꺾쇠 뒤에 보이지 않는 글자 하나를
  // 끼우면 이 선을 넘어가고, 그 뒤 지우는 손이 `<img src=x>` 를 되살려 저장했다.
  // 닉네임(`utils/nickname.js` 머리글)과 같은 결함이고 같은 순서로 고친다 — **지운 뒤**에 본다.
  if (tagLike(raw)) return { ok: false, why: ANGLE_WHY };
  const v = tidyName(raw);
  if (!v) return { ok: true, value: null };
  if (tagLike(v)) return { ok: false, why: ANGLE_WHY };
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

// ── **한쪽씩 하는 운동** ── (2026-11-19 · 시안 1119 ①)
//
// 원팔 덤벨로우 · 불가리안 스플릿 스쿼트는 **왼쪽과 오른쪽이 같은 날이 드물다.**
// 그런데 적을 칸이 하나뿐이라, 사람은 그 말을 **운동 이름에** 적었다 —
// 「원팔 덤벨로우 L<R」. 11/17 에 그 꺾쇠를 **거절**하게 만들었는데(그 전에는 「원팔
// 덤벨로우 L」로 조용히 잘려 저장됐다), **받을 칸은 안 줬다.** 거절만 있고 길이 없는
// 자리라 그 사람은 그 말을 어디에도 못 적는다. 이것이 그때 못 낸 짝이다.
//
// 몸 치수는 이미 좌우를 따로 받는다 — 「왼팔둘레 · 오른팔둘레」
// (`frontend/src/components/measure/BodySizeSection.jsx`). **치수는 아는데 적는 자리만
// 한 칸**이었다.
//
// ── 담는 모양 ──
//
//   `weight` · `reps`      왼쪽 — **또는 양쪽이 같을 때의 그 값**(지금과 같다)
//   `weight_r` · `reps_r`  오른쪽 — **왼쪽과 다를 때만** 담는다
//
// **세트는 하나다.** 좌우를 세트로 쪼개지 않는다 — 한 세트에 양쪽을 다 하므로,
// 「3세트」를 좌 3 · 우 3 으로 적으면 **세트 수가 두 배로 세어진다.** 그래서 10/05 의
// 슈퍼세트 · 드롭세트처럼 줄을 따로 적는 길을 쓰지 않고, 오른쪽 값만 한 줄에 더한다
// (5년치 기록을 옮기지 않아도 되는 것도 같은 까닭이다).
//
// **좌우가 같으면 칸을 안 만든다.** `note` · `rir` · `link` 와 같은 결이다 — 옛 줄과
// 모양이 같아야 섞어 읽을 때 갈라지지 않는다. 그래서 **안 적는 사람에게는 지금과
// 한 글자도 다르지 않다.**
//
// 받는 값 셋도 `note` · `rir` 과 같다: `undefined` 는 **건드리지 않는다**(고치는 길) ·
// `null` · 빈 글은 **지운다** · 그 밖은 다듬어 담거나 **거절하고 까닭을 말한다.**
//
// **유산소 줄에는 담지 않는다** — 런닝머신에 왼쪽 오른쪽이 없다. 지어낸 「1세트 1회」를
// 안 넣는 것과 같은 선이다(`utils/cardioFields.js` 머리글).
//
// 세트 · 횟수의 테두리는 **여기서 정하지 않는다** — `utils/setRange.js` 한 자리에서
// 온다(10/31 에 세 자리에 생글자로 박혀 있던 것을 모았다).
const { REPS_MAX } = require('./setRange');

/**
 * 오른쪽 무게. 자는 왼쪽과 **같은 것**을 쓴다 (`normalizeWeight`) — 한쪽만 음수나
 * 999kg 을 받으면 같은 줄의 두 숫자가 서로 다른 말을 한다.
 *
 * @param raw   받은 값
 * @param left  왼쪽에 담길 값 — **같으면 칸을 안 만든다**
 * @param cardio 유산소 줄인가
 */
function normalizeSideWeight(raw, left, cardio) {
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null || raw === '') return { ok: true, value: null };
  if (cardio) return { ok: false, why: '유산소 줄에는 좌우를 따로 적지 않아요' };
  const w = normalizeWeight(raw);
  // 까닭은 왼쪽 자가 말한 그대로 쓰고 **어느 쪽인지만** 앞에 붙인다 —
  // 말을 새로 지으면 같은 한도가 두 가지 말로 나간다
  if (!w.ok) return { ok: false, why: `오른쪽 ${w.why}` };
  if (left !== undefined && left !== null && w.value === left) return { ok: true, value: null };
  return { ok: true, value: w.value };
}

/**
 * 오른쪽 횟수. 왼쪽과 **같은 테두리**(1 이상 정수 · `REPS_MAX` 이하)를 쓴다.
 *
 * @param raw   받은 값
 * @param left  왼쪽에 담길 횟수 — **같으면 칸을 안 만든다**
 * @param cardio 유산소 줄인가
 */
function normalizeSideReps(raw, left, cardio) {
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null || raw === '') return { ok: true, value: null };
  if (cardio) return { ok: false, why: '유산소 줄에는 좌우를 따로 적지 않아요' };
  // 글자로 온 숫자도 받는다 (CSV · 옛 앱) — 그러나 `'8회'` 처럼 섞인 것은 거절한다
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isInteger(n) || n <= 0) {
    return { ok: false, why: '오른쪽 횟수는 1 이상의 정수여야 해요' };
  }
  if (n > REPS_MAX) return { ok: false, why: `오른쪽 횟수는 ${REPS_MAX} 이하여야 해요` };
  if (left !== undefined && left !== null && n === Number(left)) return { ok: true, value: null };
  return { ok: true, value: n };
}

// ── **「적은 시각」을 받는 자** ── (2026-11-26 · 정석, TODO 11/26 ④ · ⑦)
//
// 서버는 여태 줄이 **들어온 순간**을 `created_at` 으로 찍었다. 두 자리가 그 때문에
// 어긋나 있었다 —
//
//   ④ **지하에서 적은 한 판이 「올린 순간」으로 찍힌다.** 신호가 돌아올 때 스무 줄이
//      몇 초 안에 올라가므로 `data/pace.js` 가 그 날을 「몰아 적은 날」로 보고
//      **운동 시간 · 쉰 시간이 사라진다.** 그날 줄 차례도 온라인 줄과 섞인다
//   ⑦ **내보낸 파일을 다시 넣으면 그날 줄 차례가 뒤집힌다.** 내보내기는 최신이 앞인데
//      넣는 쪽이 파일 차례대로 찍어서 — **드롭 · 슈퍼 묶음이 엉뚱한 줄에 붙는다**
//
// 둘을 한 칸이 푼다: **줄마다 「적은 시각」을 실어 보내고, 서버가 그것을 쓴다.**
// 적는 길 둘(올리기 · 파일로 넣기)이 **같은 이 자**를 든다 — 무게가 10/22 에 바로
// 이 꼴로 어긋났던 자리다(손으로는 막고 파일로는 그냥 들어왔다).
//
// ── 테두리 ──
//
//   · 안 보내면 `undefined` — 서버가 지금을 찍는다 (온라인에서 바로 적는 길)
//   · 꼴은 `Date` 가 읽을 수 있는 글자여야 한다. **아니면 거절**한다 —
//     조용히 지금으로 바꿔 찍으면 ④ 를 고치나 마나다
//   · **2000년 이후 · 지금보다 앞은 아니게.** 앞날 시각을 받으면 그 줄이 목록 맨
//     위에 영영 붙어 있는다(차례를 `created_at` 으로 정한다). 시계가 어긋난 폰을
//     위해 **5분**은 봐준다 — 날짜 칸의 「하루 넉넉하게」와 같은 결이다
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const CREATED_FLOOR = Date.UTC(2000, 0, 1);

function normalizeCreatedAt(raw) {
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null || raw === '') return { ok: true, value: null };
  if (typeof raw !== 'string' && !(raw instanceof Date)) {
    return { ok: false, why: '적은 시각이 글자가 아니에요' };
  }
  const t = raw instanceof Date ? raw.getTime() : Date.parse(raw);
  if (!Number.isFinite(t)) return { ok: false, why: '적은 시각을 읽을 수 없어요' };
  if (t < CREATED_FLOOR) return { ok: false, why: '적은 시각이 너무 옛날이에요' };
  if (t > Date.now() + CLOCK_SKEW_MS) return { ok: false, why: '적은 시각이 앞날이에요' };
  return { ok: true, value: new Date(t).toISOString() };
}

module.exports = {
  normalizeWeight, cleanExerciseName, WEIGHT_MAX, WEIGHT_KG_MAX, NAME_MAX,
  normalizeNote, normalizeRir, WORKOUT_NOTE_MAX, RIR_VALUES,
  normalizeSideWeight, normalizeSideReps,
  normalizeCreatedAt, CLOCK_SKEW_MS,
};
