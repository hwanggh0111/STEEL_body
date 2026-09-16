// 목소리로 적기 — **들은 말을 무게 · 세트 · 횟수로 옮긴다.**
//
// 운동 중에 흐름이 제일 많이 끊기는 자리가 기록이다. 땀 묻은 손으로, 장갑을 낀 채로,
// 숨이 찬 상태로 숫자 칸 셋을 두드린다. 「팔십 여덟개」 한마디면 되는 일이다.
//
// **헬스장은 시끄럽다.** 그래서 이 파일이 하는 일은 **옮기는 것까지**이고, 옮긴 것을
// 곧바로 저장하지 않는다 — 화면이 「이렇게 들었어요」를 먼저 보여주고 사람이 누른다
// (`components/VoiceSet.jsx`). 잘못 들은 것을 조용히 저장하면, 기록을 믿을 수 없게 된다.
//
// 알아듣는 말은 브라우저가 주는 그대로다. 크롬은 대개 숫자를 아라비아 숫자로 돌려주지만
// (「80킬로 8개」), 한글로 돌려줄 때도 있다(「팔십 여덟개」). **둘 다 받는다.**

// ── 한자말 수 (일 이 삼 …) ──
const SINO = { 영: 0, 공: 0, 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 륙: 6, 칠: 7, 팔: 8, 구: 9 };
// ── 우리말 수 (하나 둘 셋 …) — 횟수·세트를 셀 때 이쪽을 쓴다 ──
const NATIVE = {
  하나: 1, 한: 1, 둘: 2, 두: 2, 셋: 3, 세: 3, 넷: 4, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7,
  여덟: 8, 아홉: 9, 열: 10, 열하나: 11, 열한: 11, 열둘: 12, 열두: 12, 열셋: 13, 열세: 13,
  열넷: 14, 열네: 14, 열다섯: 15, 열여섯: 16, 열일곱: 17, 열여덟: 18, 열아홉: 19,
  스물: 20, 스무: 20, 서른: 30, 마흔: 40, 쉰: 50,
};

/**
 * 한글로 적힌 수 하나를 숫자로. 못 읽으면 null.
 *
 * 한자말은 자리(십 · 백)를 쌓아 읽는다 — 「백이십」 = 120, 「팔십」 = 80.
 * 우리말은 사전에 있는 그대로 읽는다 — 「스물다섯」 = 25.
 */
export function koreanNumber(word) {
  const w = String(word || '').trim();
  if (!w) return null;
  if (/^\d+(\.\d+)?$/.test(w)) return Number(w);

  // 우리말 — 「스물다섯」처럼 앞뒤가 붙는 것까지
  if (NATIVE[w] !== undefined) return NATIVE[w];
  for (const tens of ['스물', '서른', '마흔', '쉰']) {
    if (w.startsWith(tens)) {
      const rest = w.slice(tens.length);
      if (!rest) return NATIVE[tens];
      if (NATIVE[rest] !== undefined && NATIVE[rest] < 10) return NATIVE[tens] + NATIVE[rest];
    }
  }

  // 한자말 — 백 · 십 자리를 쌓는다
  if (!/^[영공일이삼사오육륙칠팔구십백]+$/.test(w)) return null;
  let total = 0;
  let cur = 0;
  let seen = false;
  for (const ch of w) {
    if (ch === '백') { total += (cur || 1) * 100; cur = 0; seen = true; continue; }
    if (ch === '십') { total += (cur || 1) * 10; cur = 0; seen = true; continue; }
    const n = SINO[ch];
    if (n === undefined) return null;
    cur = cur * 10 + n;
    seen = true;
  }
  return seen ? total + cur : null;
}

// 단위로 쓰이는 말. 앞의 수가 무엇인지 이 말이 정한다
const UNIT = [
  ['weight', ['킬로그램', '킬로', '키로', 'kg', 'KG', '킬', '무게']],
  ['reps', ['회', '개', '번', '렙', 'reps', 'rep', '개씩', '회씩']],
  ['sets', ['세트', '셋트', 'set', 'sets', '세트씩']],
];

const unitOf = (tail) => {
  for (const [key, words] of UNIT) {
    if (words.some((u) => tail.startsWith(u))) return key;
  }
  return null;
};

/** 맨몸이라고 말한 것 */
const BODYWEIGHT = ['맨몸', '자체', '몸무게', '무게없이', '맨손'];

/**
 * 들은 말 한 줄 → { weight, sets, reps }.
 *
 * 규칙은 셋이고, **순서가 곧 우선순위다.**
 *
 *   1. 수 뒤에 단위가 붙어 있으면 그 단위가 이긴다 — 「팔십킬로 여덟개 세세트」
 *   2. 단위 없이 수만 둘이면 **앞이 무게, 뒤가 횟수**다 — 「팔십 여덟」
 *      (운동 중에 제일 많이 하는 말이고, 세트는 대개 안 바뀐다)
 *   3. 수가 하나뿐이면 **횟수**다 — 「열두개」. 무게만 말하는 일은 드물고,
 *      무게를 말할 때는 거의 「킬로」를 붙인다
 *
 * 못 알아들으면 `ok: false` 와 들은 말을 그대로 돌려준다. **지어내지 않는다.**
 */
export function parseSpoken(text) {
  const raw = String(text || '').trim();
  const out = { weight: null, sets: null, reps: null, raw, ok: false };
  if (!raw) return out;

  const flat = raw.replace(/\s+/g, ' ');
  if (BODYWEIGHT.some((w) => flat.includes(w))) out.weight = '맨몸';

  // 수 + 뒤따르는 말을 훑는다. 한글 수도 아라비아 숫자도 같은 자리에서 잡는다
  const token = /(\d+(?:\.\d+)?|[영공일이삼사오육륙칠팔구십백]+|하나|한|둘|두|셋|세|넷|네|다섯|여섯|일곱|여덟|아홉|열[하한둘두셋세넷네다여일아]*[섯덟곱홉]?|스물[하한둘두셋세넷네다여일아]*[섯덟곱홉]?|스무|서른|마흔|쉰)/g;

  const bare = [];
  let m = token.exec(flat);
  while (m) {
    const n = koreanNumber(m[1]);
    if (n !== null) {
      const tail = flat.slice(m.index + m[1].length).replace(/^\s+/, '');
      const unit = unitOf(tail);
      if (unit === 'weight') out.weight = String(n);
      else if (unit === 'reps') out.reps = n;
      else if (unit === 'sets') out.sets = n;
      else bare.push(n);
    }
    m = token.exec(flat);
  }

  // 단위가 안 붙은 수들
  if (bare.length >= 2) {
    if (out.weight === null) out.weight = String(bare[0]);
    if (out.reps === null) out.reps = bare[1];
    if (out.sets === null && bare.length >= 3) out.sets = bare[2];
  } else if (bare.length === 1) {
    if (out.reps === null) out.reps = bare[0];
    else if (out.weight === null) out.weight = String(bare[0]);
  }

  // 하나라도 건졌으면 보여줄 값이 있다. 세트는 비어도 된다(화면이 1 로 채우지 않는다 —
  // 안 들은 것을 채우면 그것도 지어내는 것이다)
  out.ok = out.weight !== null || out.reps !== null || out.sets !== null;
  return out;
}

/** 이 브라우저가 알아듣기를 할 수 있나. 없으면 단추를 아예 안 그린다 */
export function speechSupported() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/** 들은 것을 사람 말로 되읽어준다 — 「80kg · 8회 · 3세트」 */
export function spokenLabel(parsed) {
  if (!parsed?.ok) return '';
  const bits = [];
  if (parsed.weight !== null) bits.push(parsed.weight === '맨몸' ? '맨몸' : `${parsed.weight}kg`);
  if (parsed.reps !== null) bits.push(`${parsed.reps}회`);
  if (parsed.sets !== null) bits.push(`${parsed.sets}세트`);
  return bits.join(' · ');
}
