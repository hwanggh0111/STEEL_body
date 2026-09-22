// 숨을 듣고 **쉬는 시간을 늘려준다** (2026-09-22).
//
// 쉬는 15초가 끝나면 다음 동작이 시작된다. 숨이 가라앉았든 아니든 똑같이 15초다 —
// 프로그 점프를 하고 난 사람과 스쿼트 홀드를 하고 난 사람에게 같은 시간을 준다.
//
// ── 마이크가 아는 것과 모르는 것 ──
//
// 마이크는 **공기 진동**만 듣는다. 「얼마나 힘든지」는 몸 안의 일이라 못 듣는다.
// 숨소리를 듣고 「강도 72」라고 적으면 그건 **짐작을 숫자로 적는 것**이고,
// 이 앱이 체형에서 거절한 바로 그것이다(`shapeRead.js` 에 적어둔 선과 같다).
//
// 그래서 듣는 것은 **소리 크기 하나**다. 그것도 절대값은 뜻이 없다 — 폰마다,
// 방마다 기본 소음이 다르다. **그 사람의 그날 기준선과 견줄 때만** 뜻이 생긴다.
//
// ── 그래서 무엇을 하나 ──
//
// 점수를 띄우지 않는다. **휴식을 몇 초 더 준다.** 틀려도 손해가 「조금 더 쉬었다」
// 뿐이라, 이 계산이 틀릴 때 **안전한 쪽으로 틀린다.** 그리고 「그냥 시작」은 늘 있다.
//
// 이 파일은 마이크를 다루지 않는다 — 숫자만 받아서 판단한다(`npm run breath` 가 본다).
// 마이크는 `useBreath.js` 가 만진다.

/** 시작할 때 조용한 값을 재는 시간. 이만큼은 아무 판단도 안 한다. */
export const CALIBRATE_MS = 3000;

/**
 * 알림 소리를 흘려보내는 시간.
 *
 * 단계가 바뀔 때 앱이 소리를 낸다(`beepDone`). **그 소리를 마이크가 같이 듣는다** —
 * 안 버리면 앱이 제 소리를 듣고 「숨이 찼다」고 한다.
 */
export const BEEP_BLIND_MS = 1000;

/** 얼마나 더 줄 수 있나. 더 늘리면 판이 안 끝난다. */
export const MAX_EXTRA = 15;

/**
 * 기준선 위로 이만큼 올라와 있으면 숨이 올라온 것으로 본다 (배수).
 *
 * 소리 크기는 곱으로 움직인다(두 배 시끄러운 것이 +1 이 아니다). 그래서 뺄셈이
 * 아니라 **나눗셈으로** 본다 — 기준선이 조용한 방에서도 시끄러운 방에서도 같은 뜻이 된다.
 */
export const RATIO_UP = 2.2;     // 이 위는 아직 숨이 차 있다
export const RATIO_MID = 1.5;    // 이 위는 올라와 있다
// 1.5 아래는 가라앉은 것으로 본다. 숨소리는 옷 스치는 소리보다 작아서, 여기를
// 더 낮추면 **뒤척이기만 해도** 시간을 늘려주게 된다

/**
 * 기준선이 이것보다 시끄러우면 **아예 안 쓴다.**
 *
 * 음악이나 TV 가 켜져 있으면 기준선 자체가 높아서 숨이 묻힌다. 그때는 조용히 끈다 —
 * **틀린 값으로 시간을 조절하지 않는다.** 화면에는 「숨이 안 잡혀요」 한 줄만 적는다.
 */
export const TOO_LOUD = 0.12;

// **`Number(null)` 은 `0` 이다** (2026-09-22 에 물렸다).
//
// 빈 칸을 `0` 으로 읽으면 「안 적은 것」과 「0 이라고 적은 것」이 같아진다.
// 인바디는 골격근을 안 적으면 `null` 을 넣는데(앱이 「체중만 적어도 된다」고 권한다),
// 그것이 0kg 으로 끼어들어 **「골격근이 33kg 줄었어요」**가 됐다.
// 빈 것은 **없는 것**으로 둔다.
const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * 잰 값들에서 기준선을 뽑는다.
 *
 * **평균이 아니라 중앙값**이다. 재는 3초 동안 문이 한 번 닫히면 평균은 통째로
 * 끌려 올라가고, 그 뒤로는 어떤 숨도 「조용하다」가 된다.
 */
export function baselineOf(samples) {
  const xs = (samples || []).map(num).filter((v) => v !== null && v >= 0).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

/**
 * 지금 숨이 어느 쪽인가.
 *
 * level  지금 소리 크기 (0~1 쯤. 마이크가 준 것을 그대로)
 * base   기준선 (`baselineOf`)
 *
 * 돌려주는 것: 'calm' 가라앉음 · 'mid' 올라와 있음 · 'high' 아직 차 있음 · null 못 잼
 */
export function breathState(level, base, th) {
  const v = num(level);
  const b = num(base);
  if (v === null || b === null || b <= 0) return null;
  // 예민도는 **설정함이 정한다** (2026-09-22). 안 넘기면 여기 적힌 기본값 —
  // 규칙을 바꾼 것이 아니라, 고를 수 있게 한 것이다
  const midTh = Number(th?.mid) > 0 ? Number(th.mid) : RATIO_MID;
  const upTh = Number(th?.up) > 0 ? Number(th.up) : RATIO_UP;
  // 기준선이 너무 조용하면(무음에 가까우면) 나눗셈이 폭발한다 — 바닥을 깐다.
  // **둘째 자리에서 끊는다**: 0.044 / 0.02 가 2.1999999999999997 로 나와서
  // 2.2 를 안 넘는다(부동소수점). 경계가 흔들리면 같은 숨이 어떤 날은 5초,
  // 어떤 날은 10초가 된다
  const ratio = Math.round((v / Math.max(b, 0.004)) * 100) / 100;
  if (ratio >= upTh) return 'high';
  if (ratio >= midTh) return 'mid';
  return 'calm';
}

/**
 * 몇 초를 더 줄까.
 *
 * state  `breathState` 가 준 것
 * given  이 휴식에서 **이미 더 준 초** — 한 번 더 줄 때마다 쌓인다
 *
 * 한 번에 5초씩만 늘린다. 20초를 한꺼번에 주면 사람은 「고장났나」 한다.
 * `MAX_EXTRA` 에서 멈춘다 — 숨이 안 가라앉는 날도 판은 끝나야 한다.
 */
export function extraFor(state, given = 0, max) {
  const used = Math.max(0, Number(given) || 0);
  // 최대치도 **설정함이 정한다.** 안 넘기면 여기 적힌 기본값
  const cap = Number(max) > 0 ? Number(max) : MAX_EXTRA;
  const room = cap - used;
  if (room <= 0) return 0;
  if (state === 'high') return Math.min(10, room);
  if (state === 'mid') return Math.min(5, room);
  return 0;
}

/** 화면에 적을 한 줄. 숫자도 점수도 안 적는다. */
export function breathLabel(state) {
  if (state === 'high') return '숨이 아직 차 있어요';
  if (state === 'mid') return '숨이 아직 올라있어요';
  if (state === 'calm') return '숨이 가라앉았어요';
  return null;
}

/**
 * 이 판에서 **숨이 제일 찼던 동작** 차례.
 *
 * marks 는 [{ index, name, peak }] — 동작마다 그 동안의 가장 큰 값.
 * base 로 나눠서 **자기 안에서만** 견준다.
 *
 * **점수가 아니라 순위다.** 「이 동작이 강도 8」이 아니라 「이 판에서는 이것이
 * 제일 숨찼다」까지가 우리가 말할 수 있는 선이다. 부위를 옆에 적되
 * **「하체가 뜨겁다」고는 하지 않는다** — 숨이 찬 것과 근육이 타는 것은 다른 일이고,
 * 마이크는 앞의 것만 듣는다.
 */
export function hardestOf(marks, base, limit = 3) {
  const b = num(base);
  if (b === null || b <= 0) return [];
  return (marks || [])
    .map((m) => ({ ...m, ratio: Math.round((num(m?.peak) / Math.max(b, 0.004)) * 100) / 100 }))
    .filter((m) => Number.isFinite(m.ratio) && m.ratio >= RATIO_MID)
    .sort((a, b2) => b2.ratio - a.ratio)
    .slice(0, limit);
}

/**
 * 이 기준선으로 숨을 들을 수 있나.
 *
 * 못 들으면 **왜 못 듣는지**를 같이 준다 — 화면이 「숨이 안 잡혀요」 뒤에 까닭을
 * 붙인다. 조용히 아무 일도 안 하면 켜둔 사람이 고장으로 읽는다.
 */
export function usable(base) {
  const b = num(base);
  if (b === null) return { ok: false, why: '마이크에서 아무 소리도 안 들어와요' };
  if (b > TOO_LOUD) return { ok: false, why: '주변이 시끄러워서 숨이 묻혀요 (음악을 줄이면 잡혀요)' };
  return { ok: true, why: null };
}
