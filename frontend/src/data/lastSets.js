// 적는 자리가 **지난 판을 읽는 셈** (2026-11-05).
//
// ── 무엇이 없었나 ──
//
// 기록 화면은 지난번 무게를 칸에 채워주고 **거기서 멈춘다.** 화면에 적히는 것은
// 「지난번 80kg × 8회 (10/31)」 한 줄이다. 그래서 두 가지를 아무도 말해주지 않았다 —
//
//   ⑴ **그래서 오늘은 얼마를 들까.** 80kg 8회를 지난 세 판 내내 채웠는지, 아니면
//      지난번에 6회에서 멈췄는지가 화면에 없다. 올릴지 말지를 고르는 데 필요한
//      바로 그것이다. 기록에는 이미 다 들어 있는데 **셈을 아무 데서도 안 했다**
//   ⑵ **지난번에 실제로 한 것 전부.** 한 줄만 보인다 — 그날 80×8 · 80×8 · 75×7 로
//      내려갔고 드롭으로 52까지 갔던 것은 「기록」 탭으로 나가야 보인다
//
// ── 재는 규칙 ──
//
// **판(session)** 은 하루치다. 이 앱의 한 줄은 「운동 + 무게 + 세트수 + 횟수」라서
// (적는 단위를 바꾸면 5년치를 옮겨야 한다 — `TrainPage` 머리글) 한 날에 줄이 여럿일
// 수 있다: 슈퍼세트 · 드롭세트 · 무게를 내려 더 한 것.
//
// **대표 줄은 드롭세트를 뺀 것 중 가장 무거운 줄**이다. 드롭은 그 판에서 제일 가벼운
// 무게라 「내려갔다」로 읽힌다 — 지난번 채우기가 이미 그렇게 가리고 있다(2026-10-05).
// 드롭 줄만 있는 날은 **그 판을 셈에서 뺀다**(`skipped`) — 본세트를 다른 이름으로
// 적은 날이라 오늘 들 무게의 근거가 못 된다.
//
// **올리는 칸은 그 사람이 실제로 올라온 칸**이다. 바벨은 2.5kg(1.25kg 짝)이지만
// 덤벨은 2kg·2.5kg·5kg 로 갈리고 머신은 핀 한 칸이 제각각이다. 지난 판들의 무게
// 차이에서 **가장 작은 양수 차**를 쓰고, 없으면 2.5kg 으로 둔다. 20kg → 40kg 처럼
// 크게 뛴 것은 칸이 아니라 기구가 바뀐 것이라 10kg 에서 끊는다.
//
// **권하는 것일 뿐이다.** 등급도 점수도 아니다 — 이 앱은 몸에 등급을 안 매긴다
// (2026-08-25 에 정했다). 셈이 돌려주는 것은 「이런 흐름이었다」와 「그래서 이 수」이고,
// 화면은 그것을 **물음으로** 적고 사람이 안 따를 수 있게 둔다.
//
// ★ **쉰 시간을 「세트 사이」라고 말하지 않는다.** `pace.js` 가 그 말을 못 박아뒀다 —
// 우리가 아는 것은 **줄을 적은 시각**뿐이고, 「세트 사이 휴식 4분」은 재지 않은 것을
// 잰 척하는 것이다. 그래서 「첫 줄부터 마지막 줄까지」라고 적는다.
//
// 화면에서는 확인하기 어려운 셈이다 — 「세 판 연속 채웠다」를 눈으로 보려면 기록을
// 세 판 만들어야 한다. `npm run nextstep` 이 값으로 본다.
import { parseWeight, daysBetween } from './personalRecord';
// 조사는 **앱의 손**으로 붙인다 — 보간 뒤에 글자로 박으면 「…회을」이 나는 날이 온다
// (`npm run data` 가 그 자리를 잡는다)
import { particle } from './particle';
// 유산소 줄은 무게가 아니라 **시간 · 거리**다 (2026-11-05)
import { isCardioRow, cardioText } from './cardio';
import { WEIGHT_KG_MAX, REPS_MAX } from './limits';

/** 올리는 칸을 모를 때 쓰는 값 — 바에 꽂는 제일 작은 원판 짝(1.25kg × 2) */
export const DEFAULT_STEP = 2.5;
/** 칸이라고 볼 수 있는 범위. 이보다 크게 뛴 것은 기구가 바뀐 것이다 */
const STEP_MIN = 0.5;
const STEP_MAX = 10;
/** 올려볼 만하다고 말하려면 같은 무게로 이만큼은 채워야 한다 */
export const UP_AFTER = 3;
/** 거슬러 보는 판 수 */
const MAX_SESSIONS = 8;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const posInt = (v) => {
  const n = num(v);
  return n !== null && n > 0 ? Math.floor(n) : null;
};
const at = (r) => {
  const t = new Date(r?.created_at || 0).getTime();
  return Number.isFinite(t) && t > 0 ? t : null;
};

/**
 * 그 운동의 **판 목록**. 최신이 앞이다.
 *
 * 돌려주는 판 하나 —
 *   date     'YYYY-MM-DD' · days 오늘로부터 며칠 전
 *   rows     그날 그 운동의 줄 전부, **적은 차례**(오래된 것이 앞)
 *   kg       대표 줄의 무게 (맨몸이면 null) · reps 횟수 · sets 세트 수
 *   body     맨몸 판인가
 *   spanMs   첫 줄 ~ 마지막 줄 (줄이 둘 이상이고 시각을 읽을 수 있을 때만)
 *   skipped  대표 줄을 못 잡았다 (드롭 줄만 있는 날) — 셈에서 뺀다
 *
 * `before` 를 주면 **그 날과 그 뒤는 뺀다.** 「지난 판」과 「다음 한 걸음」이 그것을
 * 쓴다 — 아래 두 함수의 머리글에 까닭을 적어뒀다.
 */
export function sessionsOf(workouts, exercise, today = null, { max = MAX_SESSIONS, before = null } = {}) {
  const name = String(exercise ?? '').trim();
  if (!name) return [];
  const dates = Object.keys(workouts || {})
    // **앞날은 아직 한 것이 아니다** — 달력에서 앞날에 적을 수 있다 (`bodyHeat` 와 같은 자)
    .filter((d) => d && (!today || d <= today) && (!before || d < before))
    .sort()
    .reverse();

  const out = [];
  for (const date of dates) {
    const list = (workouts[date] || []).filter((w) => String(w?.exercise ?? '').trim() === name);
    if (!list.length) continue;

    // 적은 차례로 — 목록은 최신이 위라 그대로 그리면 세트가 거꾸로 읽힌다.
    // 시각을 못 읽는 줄(지하에서 적어 세운 줄)은 **차례를 흐트러뜨리지 않게** 뒤에 둔다
    const rows = [...list].sort((a, b) => {
      const ta = at(a);
      const tb = at(b);
      if (ta === null && tb === null) return 0;
      if (ta === null) return 1;
      if (tb === null) return -1;
      return ta - tb;
    });

    // 대표 줄 — **드롭을 뺀 것 중 가장 무거운 줄**. 다 맨몸이면 횟수가 가장 많은 줄
    const solid = rows.filter((w) => w?.link !== 'drop');
    const weighted = solid
      .map((w) => ({ w, kg: parseWeight(w?.weight) }))
      .filter((x) => x.kg !== null);
    let main = null;
    let kg = null;
    if (weighted.length) {
      const top = weighted.reduce((a, b) => (b.kg > a.kg ? b : a));
      main = top.w;
      kg = top.kg;
    } else if (solid.length) {
      main = solid.reduce((a, b) => ((posInt(b?.reps) || 0) > (posInt(a?.reps) || 0) ? b : a));
    }

    const stamps = rows.map(at).filter((t) => t !== null).sort((a, b) => a - b);
    out.push({
      date,
      days: today ? daysBetween(date, today) : null,
      rows,
      kg,
      reps: posInt(main?.reps),
      sets: posInt(main?.sets),
      body: main != null && kg === null,
      spanMs: stamps.length >= 2 ? stamps[stamps.length - 1] - stamps[0] : null,
      skipped: main === null,
    });
    if (out.length >= max) break;
  }
  return out;
}

/**
 * 올리는 칸. **그 사람이 실제로 올라온 칸**을 쓴다.
 *
 * 판들의 무게를 모아 인접한 값의 차 가운데 **가장 작은 양수**다. 전부 같은 무게면
 * 차가 없으니 기본값(2.5kg)이고, 크게 뛴 것은 기구가 바뀐 것이라 10kg 에서 끊는다.
 */
export function stepOf(sessions) {
  const kgs = [...new Set((sessions || []).map((s) => s?.kg).filter((k) => num(k) !== null && k > 0))]
    .sort((a, b) => a - b);
  let best = null;
  for (let i = 1; i < kgs.length; i += 1) {
    const d = Number((kgs[i] - kgs[i - 1]).toFixed(2));
    if (d >= STEP_MIN && d <= STEP_MAX && (best === null || d < best)) best = d;
  }
  return best ?? DEFAULT_STEP;
}

/**
 * **다음 한 걸음.** 오늘 얼마를 들까.
 *
 * 돌려주는 것 (권할 것이 없으면 `null` — 화면은 그 칸을 아예 안 그린다) —
 *   kind    'up'(올려볼 만하다) · 'same'(지난번과 같게) · 'retry'(못 채웠다 다시)
 *   kg      권하는 무게 (맨몸이면 null) · reps 횟수 · sets 세트 수
 *   from    지난 판의 무게·횟수 (무엇을 보고 셌는지)
 *   streak  같은 무게로 채운 판 수 · need 올리기까지 몇 판 더
 *   step    올린 칸 (`kind === 'up'` 일 때만)
 *   target  'retry' 에서 노렸던 횟수
 *   capped  테두리에 걸려 더 못 올렸다
 *
 * ── **적고 있는 날은 셈에서 뺀다** ── (2026-11-05, 붙인 자리에서 잡았다)
 *
 * `writing` 은 지금 적고 있는 날짜다(대개 오늘, 지난 날짜에 적을 때는 그 날).
 * 그 날을 섞어 세면 **오늘 한 세트를 적자마자** 「80kg 8회를 3판 채웠어요 —
 * 올려볼 자리예요」가 뜬다 —
 *
 *   · **오늘은 아직 안 끝났다.** 한 세트만 하고 멈출 수도 있는데 완료로 센다
 *     (11/04 에 부위 볼륨에서 「안 끝난 주는 늘 꺾여 보인다」로 배운 그 모양이다)
 *   · 더 나쁜 것은 그 권유가 **지금 적을 칸에** 뜬다는 것이다 — 세트 사이에
 *     「82.5kg 로 올리세요」로 읽힌다
 *
 * 그래서 **어제까지의 흐름**으로 오늘 할 것을 권한다.
 */
export function nextStep(workouts, exercise, today = null, writing = null) {
  const all = sessionsOf(workouts, exercise, today, { before: writing || today });
  const step = stepFrom(all);
  // ★ **뺀 판을 말해준다** (2026-11-11).
  //
  // 드롭 줄만 적은 날은 셈에서 빼는데(위 머리글 · 2026-10-05 에 정했다),
  // 여태 **아무 말도 안 했다.** 그래서 어제 드롭만 적은 사람은 「다음 한 걸음」이
  // **그 전 판**을 근거로 권하는데도 「어제 걸로 권했구나」로 읽는다 — 수는 맞지만
  // **무엇을 보고 권했는지가 거짓**이다. 그 한 줄이 이 앱의 약속이다.
  //
  // 가장 최근 판이 빠졌을 때만 말한다 — 석 달 전에 드롭만 한 날까지 들추면
  // 그 줄이 늘 떠 있어서 아무도 안 읽는다.
  if (step && all[0]?.skipped) step.skippedLast = all[0].date;
  return step;
}

/** 위 `nextStep` 의 몸통. 판 목록을 받아 권할 것을 만든다 (뺀 판은 여기서 거른다) */
function stepFrom(all) {
  const s = all.filter((x) => !x.skipped);
  if (!s.length) return null;

  const last = s[0];
  const prev = s[1] || null;
  if (last.reps === null) return null;   // 횟수를 못 읽으면 권할 수 없다

  // ── 맨몸 — 무게가 아니라 **횟수**로 권한다 ──
  if (last.body) {
    if (prev && prev.body && prev.reps !== null && last.reps < prev.reps) {
      return { kind: 'retry', kg: null, reps: last.reps, sets: last.sets, target: prev.reps,
        from: { kg: null, reps: last.reps, date: last.date }, streak: 1, need: 0, body: true };
    }
    let streak = 0;
    for (const x of s) {
      if (!x.body || x.reps === null || x.reps < last.reps) break;
      streak += 1;
    }
    if (streak >= UP_AFTER && last.reps < REPS_MAX) {
      return { kind: 'up', kg: null, reps: last.reps + 1, sets: last.sets, step: 1,
        from: { kg: null, reps: last.reps, date: last.date }, streak, need: 0, body: true };
    }
    return { kind: 'same', kg: null, reps: last.reps, sets: last.sets, body: true,
      from: { kg: null, reps: last.reps, date: last.date },
      streak, need: Math.max(0, UP_AFTER - streak), capped: last.reps >= REPS_MAX };
  }

  // ── 무게로 하는 운동 ──
  const from = { kg: last.kg, reps: last.reps, date: last.date };
  // **못 채웠다** — 같은 무게인데 지난번보다 횟수가 줄었다. 올릴 자리가 아니다
  if (prev && !prev.body && prev.kg === last.kg && prev.reps !== null && last.reps < prev.reps) {
    return { kind: 'retry', kg: last.kg, reps: last.reps, sets: last.sets, target: prev.reps,
      from, streak: 1, need: 0, body: false };
  }
  // 같은 무게로 그만큼(또는 더) 채운 판이 몇 판 이어졌나
  let streak = 0;
  for (const x of s) {
    if (x.body || x.kg !== last.kg || x.reps === null || x.reps < last.reps) break;
    streak += 1;
  }
  const step = stepOf(s);
  if (streak >= UP_AFTER) {
    const up = Number((last.kg + step).toFixed(2));
    // 테두리를 넘겨 권하지 않는다 — 칸이 막아 세울 값을 권하면 단추가 거짓이 된다
    if (up <= WEIGHT_KG_MAX) {
      return { kind: 'up', kg: up, reps: last.reps, sets: last.sets, step, from, streak, need: 0, body: false };
    }
    return { kind: 'same', kg: last.kg, reps: last.reps, sets: last.sets, from, streak, need: 0, body: false, capped: true };
  }
  return { kind: 'same', kg: last.kg, reps: last.reps, sets: last.sets, from,
    streak, need: Math.max(0, UP_AFTER - streak), body: false };
}

/**
 * **왜 이 수인가**를 한 줄로. 화면이 그대로 적는다.
 *
 * 말을 셈 자리에 두는 까닭: 이 말은 수와 **함께 틀린다.** 「세 판 채웠어요」라고
 * 적으면서 두 판만 셌으면 수가 맞아도 거짓이다 — 같은 자리에서 같이 본다
 * (`npm run nextstep`). **묻는 말투로 적는다** — 명령으로 적으면 등급을 매기는 꼴이 된다.
 */
/**
 * **뺀 판을 말해주는 한 토막** (없으면 빈 글).
 *
 * ── 왜 `stepReason` 과 갈라 두나 ── (2026-11-11, 꼴 쪽 요청)
 *
 * 처음에는 한 문장에 줄표로 이어 붙였다. 그런데 **두 가지 말**이다 —
 * 앞은 **왜 그 판을 안 봤나**(지난 일), 뒤는 **그래서 무엇을 권하나**(지금 할 일).
 * 줄표로 이으면 좁은 폰(접은 폴더블 236px)에서 **넉 줄짜리 한 덩이**가 되고,
 * 그 아래 「이대로 채우기」가 더 밀려 내려간다 — 꼴 쪽이 재서 보내준 수다.
 *
 * **말은 여기서 짓고 화면은 어디에 둘지만 정한다.** 그래서 글자를 화면에서 자르지
 * 않고 **토막을 둘로 주는 쪽**으로 갈랐다 — 화면에서 가르면 말의 주인이 둘이 된다.
 */
export function stepExcluded(step) {
  if (!step || !step.skippedLast) return '';
  return `${shortDate(step.skippedLast)} 판은 드롭세트 줄만 있어 근거에서 뺐어요`;
}

export function stepReason(step) {
  if (!step) return '';
  const unit = step.body ? '회' : 'kg';
  const was = step.body ? `${step.from.reps}회` : `${step.from.kg}kg ${step.from.reps}회`;
  if (step.kind === 'retry') {
    return `지난번 ${step.target}회를 노렸는데 ${step.from.reps}회에서 멈췄어요 — ` +
      (step.body ? '같은 횟수를 다시 노려볼까요?' : '같은 무게로 한 번 더 어떨까요?');
  }
  if (step.kind === 'up') {
    const much = step.body ? '한 회' : `한 칸(${step.step}${unit})`;
    return `${was}${particle(was, '을', '를')} ${step.streak}판 채웠어요 — ${much} 올려볼 자리예요.`;
  }
  if (step.capped) {
    return `${was}${particle(was, '을', '를')} ${step.streak}판 채웠어요 — 칸이 받는 가장 큰 값이라 더 올려 권하지 않아요.`;
  }
  if (step.streak <= 1) return `지난번 그대로예요 — ${was} (${shortDate(step.from.date)}).`;
  return `${was}${particle(was, '을', '를')} ${step.streak}판 채웠어요 — ${step.need}판 더 채우면 올려볼 자리예요.`;
}

/** 'YYYY-MM-DD' → '10/31' */
export const shortDate = (d) => String(d ?? '').slice(5).replace('-', '/');

/** 며칠 됐나 → 사람 말 (몸 지도와 같은 말을 쓴다) */
export function agoLabel(days) {
  if (days === null || days === undefined) return '';
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  return `${days}일 전`;
}

/** 걸린 시간 → '26분' · '1시간 5분'. 1분 아래는 말하지 않는다 */
export function spanLabel(ms) {
  const min = Math.round(num(ms) / 60000);
  if (!Number.isFinite(min) || min < 1) return null;
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}

/**
 * **지난 판** — 지난번에 실제로 한 것 전부.
 *
 * 돌려주는 것 (없으면 `null`) —
 *   date · days · ago   언제였나
 *   lines   `[{ kg, weightText, reps, sets, link }]` — 적은 차례. `link` 는 'super'·'drop'
 *   totalSets           그날 그 운동의 세트 합
 *   span                '26분' — **첫 줄부터 마지막 줄까지**. 못 재면 null
 *
 * ★ **적고 있는 날은 「지난 판」이 아니다** (2026-11-05). 안 빼면 오늘 한 세트를
 * 적은 뒤 **「지난 판 · 11/05 (오늘) · 1줄」**이 뜬다 — 이름과 다르고, 그 내용은
 * 바로 아래 오늘 목록에 이미 있다(같은 것을 두 번 그린다).
 */
export function lastSession(workouts, exercise, today = null, writing = null) {
  const s = sessionsOf(workouts, exercise, today, { max: 1, before: writing || today })[0];
  if (!s) return null;
  const lines = s.rows.map((w) => {
    const kg = parseWeight(w?.weight);
    const text = String(w?.weight ?? '').trim();
    // 유산소 줄은 **그 줄에 적힌 시간·거리**로 말한다 (무게 칸은 비어 있다).
    // 지어내 적어둔 옛 줄(1세트 1회)은 유산소 줄이 아니라 **옛 모양 그대로** 나간다
    if (isCardioRow(w)) {
      return {
        kg: null, cardio: true, weightText: cardioText(w),
        reps: null, sets: null,
        link: w?.link === 'super' || w?.link === 'drop' ? w.link : null,
      };
    }
    return {
      kg,
      cardio: false,
      // 무게 칸은 자유 입력이다 ('20kg 양쪽'). **적힌 그대로** 보여준다 —
      // 수만 꺼내 그리면 「양쪽」이 사라져 한쪽 무게로 읽힌다
      weightText: kg === null ? (text || '맨몸') : (/^\d+(\.\d+)?$/.test(text) ? `${text}kg` : text),
      reps: posInt(w?.reps),
      sets: posInt(w?.sets),
      link: w?.link === 'super' || w?.link === 'drop' ? w.link : null,
    };
  });
  return {
    date: s.date,
    days: s.days,
    ago: agoLabel(s.days),
    lines,
    totalSets: lines.reduce((n, l) => n + (l.sets || 0), 0),
    span: lines.length >= 2 ? spanLabel(s.spanMs) : null,
  };
}

/**
 * **지난번 줄** — 칸에 미리 채우고 화면에 「지난번 80kg × 8회 (10/31)」로 적는 그것.
 *
 * ── 왜 여기로 옮겼나 ── (2026-11-09)
 *
 * 이 셈은 `TrainPage` 안에 박혀 있었고, **날짜를 안 가리고 있었다.** 11/05 에 바로
 * 아래 두 줄(`nextStep` · `lastSession`)을 붙이면서 그 둘에는 `today` 와 적는 날을
 * 넘겼는데, **그 위의 「지난번」은 그대로 뒀다.** 그래서 같은 화면에서 셋이 서로
 * 다른 날을 보고 있었다 —
 *
 *   ⑴ **앞날 기록이 「지난번」이 된다.** 달력의 「적기」는 앞날을 막지 않는다(막을
 *      일도 아니다 — 내일 할 것을 미리 적어두는 사람이 있다). 다음 주 월요일에
 *      「벤치 100kg」을 적어두면 오늘 기록 화면이 **「지난번 100kg」**이라고 말하고
 *      **칸에도 100 이 채워진다.** 「지난번과 같게」 단추까지 그 수를 집는다.
 *      11/05 에 측정 · 인바디 · 앞날 목표에서 고친 것과 **같은 모양**이다
 *   ⑵ **지난 날짜에 적을 때 뒷날 것을 「지난번」이라 한다.** 어제 것을 뒤늦게
 *      적는데 오늘 기록이 「지난번」으로 뜬다 — 그것은 지난번이 아니라 **다음번**이다
 *
 * ★ **그 날 것은 뺀다고 하지 않았다.** `nextStep` 은 적는 날을 셈에서 빼지만(안 빼면
 * 오늘 한 세트를 적자마자 「3판 채웠어요」가 뜬다), 「지난번」은 **그 날 것을 쓰는 게
 * 맞다** — 벤치 80×8 을 한 세트 적고 둘째 세트를 적을 때 칸이 80 으로 채워지는 그것이
 * 이 자리의 쓸모다. 그래서 자른 선이 다르다(`<=` 와 `<`).
 *
 * **드롭세트 줄은 건너뛴다** — 그 판에서 제일 가벼운 무게라 다음에 들 무게가 아니다
 * (2026-10-05 에 정했다). 슈퍼세트는 제 무게로 한 멀쩡한 세트라 건너뛰지 않는다.
 *
 * @param writing 적고 있는 날 ('YYYY-MM-DD'). 그 날**까지** 본다
 */
export function lastRecordOf(workouts, exercise, today = null, writing = null) {
  const name = String(exercise ?? '').trim();
  if (!name) return null;
  // 선은 **둘 중 이른 쪽**이다. 적는 날이 앞날로 적혀 있어도(지난 줄을 고치려
  // 눌렀을 때 그럴 수 있다) 오늘을 넘겨 보지 않는다
  const cut = [today, writing].filter(Boolean).sort()[0] || null;
  const dates = Object.keys(workouts || {})
    .filter((d) => d && (!cut || d <= cut))
    .sort()
    .reverse();
  for (const date of dates) {
    const hit = (workouts[date] || [])
      .find((w) => String(w?.exercise ?? '').trim() === name && w?.link !== 'drop');
    if (hit) return { ...hit, date };
  }
  return null;
}

/**
 * **이 판은 몇 세트인가** — 「다음 세트」가 끝을 아는 데 쓰는 수.
 *
 * 지난 기록이 먼저고, 없으면 루틴에 적힌 것(`fallback`)이다. 둘 다 없으면 모르는
 * 것이고 그때는 「여기까지 기록」으로 끝낸다.
 *
 * **이 자리도 날짜를 안 가리고 있었다** (2026-11-09) — 앞날에 「벤치 5세트」를
 * 적어두면 오늘 판이 **5세트짜리로 세워졌다.** 세트 수가 적힌 줄을 찾을 때까지
 * 거슬러 가는 차례는 그대로 둔다(세트 없이 적힌 줄이 섞여 있을 수 있다).
 */
export function plannedSetsOf(workouts, exercise, today = null, writing = null, fallback = null) {
  const name = String(exercise ?? '').trim();
  const fb = posInt(fallback);
  if (!name) return fb;
  const cut = [today, writing].filter(Boolean).sort()[0] || null;
  const dates = Object.keys(workouts || {})
    .filter((d) => d && (!cut || d <= cut))
    .sort()
    .reverse();
  for (const date of dates) {
    const hit = (workouts[date] || [])
      .find((w) => String(w?.exercise ?? '').trim() === name && w?.link !== 'drop');
    const n = posInt(hit?.sets);
    if (n) return n;
  }
  return fb;
}
