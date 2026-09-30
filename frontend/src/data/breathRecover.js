// 회복 시간 — **숨이 가라앉는 데 몇 초 걸리나** (2026-09-30).
//
// 계획은 `docs/BREATH-RECOVER-2026-09-30.md`. 숨 듣기(`breathRest.js`)는 이미 숨을
// 듣고 쉬는 시간을 늘려주는데, 그 값을 **듣고 버렸다.** 여기서 남긴다.
//
// ── 이 앱이 아직 못 하던 말 ──
//
// 인바디는 몸 구성을, 체형은 비율을, 기록은 세트 수를 말한다. 셋 다 **「전보다 덜
// 힘든가」는 모른다.** 같은 동작 뒤에 숨이 가라앉는 데 걸리는 초가 줄었다면, 그것이
// 우리가 정직하게 말할 수 있는 **체력의 자취**다.
//
// ── 지키는 선 ──
//
// 1. **초만 남긴다.** 소리는 `useBreath` 가 크기만 읽고 버린다(녹음하지 않는다).
//    여기 쌓이는 것은 초 · 날짜 · 어느 동작이었나뿐이다.
// 2. **점수도 등급도 또래 비교도 없다.** 「30초 안에 들어와야 정상」 같은 말을 안 한다 —
//    바깥 기준과 견주지 않는 것이 이 앱의 첫 줄이다(`shapeRead.js` 와 같은 선).
// 3. **못 쟀으면 못 쟀다고 한다.** 빈 것을 0 으로 적지 않는다 — 0초는 「바로
//    가라앉았다」는 뜻이고 못 쟀다는 것과 다르다(9/22 에 인바디에서 물린 자리다).
//
// 이 파일은 마이크도 화면도 모른다. 숫자와 상태만 받는다 — `npm run recover` 가 값으로 본다.

/**
 * 가라앉은 채로 이만큼 버텨야 인정한다.
 *
 * 숨은 한 번 튀었다 내려온다. 처음 `calm` 이 스치는 순간을 적으면 **실제보다 늘
 * 빠르게 적힌다.** 버틴 것을 확인한 뒤, 적는 값은 **처음 가라앉은 시각**이다.
 */
export const CONFIRM_MS = 2000;

/** 이보다 오래 걸리면 안 적는다. 숨이 아니라 딴 일이 끼어든 것이다. */
export const MAX_WAIT_MS = 180000;

/** 이 안쪽 차이는 「거의 같아요」. 잠 · 물 한 모금에도 이만큼 흔들린다. */
export const SAME_SEC = 3;

/** 몇 개까지 들고 있나. 홈트 한 판에 여러 칸이 생기므로 넉넉히 둔다. */
export const RECOVER_MAX = 60;

// **`Number(null)` 은 `0` 이다.** 빈 것은 없는 것으로 둔다 (`breathRest.js` 와 같은 자)
const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * 견줄 열쇠. **판 · 동작 · 그 동작의 길이** 셋이다.
 *
 * 40초 버피 뒤의 회복과 20초 플랭크 뒤의 회복은 같은 것이 아니다. 길이를 빼면
 * 프로그램이 바뀌는 날 엉뚱한 것과 견주게 된다.
 */
export function recoverKey(program, exercise, duration) {
  const p = String(program || '').trim();
  const e = String(exercise || '').trim();
  const d = num(duration);
  if (!e || d === null) return null;
  return `${p}::${e}::${d}`;
}

/**
 * 재기 시작. 동작이 끝나고 **쉬는 시간이 열릴 때** 부른다.
 *
 * meta 는 { program, exercise, duration } — 견줄 열쇠를 만드는 데 쓴다.
 */
export function startRecover(at, meta) {
  const t = num(at);
  if (t === null) return null;
  return {
    startAt: t,
    key: recoverKey(meta?.program, meta?.exercise, meta?.duration),
    exercise: meta?.exercise ?? null,
    duration: num(meta?.duration),
    program: meta?.program ?? null,
    calmSince: null,      // 가라앉기 시작한 시각 (아직 버티는 중)
    seconds: null,        // 인정된 초
    why: null,            // 못 쟀으면 까닭
  };
}

/**
 * 숨 상태 한 번을 먹인다. **새 칸을 돌려준다**(원래 것을 안 고친다 — 검사가 값으로 본다).
 *
 * state 는 `breathState` 가 준 것 — 'calm' · 'mid' · 'high' · null.
 * `null` 은 **못 듣는 중**이라 가라앉은 것으로 치지 않는다(시끄러운 방에서 0초가 될 뻔했다).
 */
export function recoverTick(st, state, now) {
  if (!st || st.seconds !== null || st.why) return st;
  const t = num(now);
  if (t === null) return st;

  if (t - st.startAt > MAX_WAIT_MS) return { ...st, why: 'toolong' };

  if (state !== 'calm') {
    // 다시 올라왔으면 **버틴 것을 처음부터 다시 센다**
    return st.calmSince === null ? st : { ...st, calmSince: null };
  }
  if (st.calmSince === null) return { ...st, calmSince: t };
  if (t - st.calmSince < CONFIRM_MS) return st;

  // 버텼다. 적는 값은 **처음 가라앉은 시각**이다
  const sec = Math.round((st.calmSince - st.startAt) / 1000);
  return { ...st, seconds: Math.max(0, sec) };
}

/**
 * 쉬는 시간이 끝났다. 아직 못 쟀으면 **까닭을 적어 닫는다.**
 *
 * 조용히 버리면 켜둔 사람이 「왜 아무 말도 없나」 한다.
 */
export function endRecover(st) {
  if (!st || st.seconds !== null || st.why) return st;
  return { ...st, why: 'cut' };
}

/** 못 쟀을 때 화면에 적을 한 줄. 없으면 `null`. */
export function recoverWhy(why) {
  if (why === 'cut') return '가라앉기 전에 다음으로 넘어갔어요';
  if (why === 'toolong') return '너무 오래 걸려서 안 적었어요';
  return null;
}

/** 이력에 남길 것만. **소리도, 언제 몇이었는지도 안 남긴다.** */
export function slimRecover(entry) {
  if (!entry) return null;
  const sec = num(entry.seconds);
  if (sec === null || !entry.key || !entry.date) return null;
  return {
    date: entry.date,
    key: entry.key,
    exercise: entry.exercise ?? null,
    duration: num(entry.duration),
    seconds: sec,
  };
}

/**
 * 이력에 한 칸 더한다. 오래된 것이 앞, 새것이 뒤.
 *
 * **같은 날 같은 동작을 여러 번 하면 그대로 다 쌓는다** — 체형과 다른 점이다.
 * 홈트는 한 판에서 같은 동작을 두 번 하기도 하고, 그 둘의 회복이 다른 것 자체가
 * 읽을 거리다(뒤로 갈수록 느려진다). 대신 견줄 때는 **오늘 것을 뺀다**(`pickRecoverPrev`).
 */
export function pushRecover(list, entry) {
  const rows = Array.isArray(list) ? list.filter((e) => e && e.date && e.key) : [];
  const one = slimRecover(entry);
  if (!one) return rows.slice(-RECOVER_MAX);
  return [...rows, one].slice(-RECOVER_MAX);
}

/**
 * 견줄 상대 — **같은 열쇠의 지난 번.** 오늘 것은 안 쓴다.
 *
 * 오늘 것을 쓰면 같은 판 안의 앞 칸과 견주게 되는데, 그건 「체력이 늘었나」가 아니라
 * 「판이 뒤로 갈수록 힘든가」다. 다른 이야기라 섞지 않는다.
 */
export function pickRecoverPrev(list, key, today) {
  if (!key) return null;
  const rows = (Array.isArray(list) ? list : [])
    .filter((e) => e && e.key === key && num(e.seconds) !== null && (!today || e.date < today));
  return rows.length ? rows[rows.length - 1] : null;
}

/** 같은 열쇠로 여태 몇 번 쟀나 (오늘 것까지). 화면이 「N번째」를 적는다. */
export function recoverCount(list, key) {
  if (!key) return 0;
  return (Array.isArray(list) ? list : []).filter((e) => e && e.key === key).length;
}

/**
 * 한 줄로 옮긴다.
 *
 * now  방금 잰 칸 (`recoverTick` 이 닫아준 것 · 못 쟀으면 `why` 가 있다)
 * prev 견줄 상대 (`pickRecoverPrev`) — 없으면 **숫자만 적고 판단하지 않는다**
 *
 * 돌려주는 것: `{ text, basis: '숨', sure, delta }` · 적을 것이 없으면 `null`.
 * `sure` 가 false 면 화면이 「두고 봐요」를 붙인다 — 첫 번은 견줄 것이 없어서 그렇다.
 */
export function recoverLine(now, prev) {
  if (!now) return null;
  if (now.seconds === null) {
    const why = recoverWhy(now.why);
    return why ? { text: why, basis: '숨', sure: false, delta: null } : null;
  }
  const sec = now.seconds;
  const head = `숨이 가라앉는 데 ${sec}초 걸렸어요`;
  const before = prev ? num(prev.seconds) : null;
  if (before === null) {
    return {
      text: `${head}. 이 동작은 오늘이 처음이라 아직 견줄 것이 없어요.`,
      basis: '숨', sure: false, delta: null,
    };
  }
  const delta = sec - before;                    // 음수면 빨라진 것이다
  if (Math.abs(delta) <= SAME_SEC) {
    return {
      text: `${head}. 지난 번(${before}초)과 거의 같아요.`,
      basis: '숨', sure: true, delta,
    };
  }
  return {
    text: delta < 0
      ? `${head}. 지난 번보다 ${Math.abs(delta)}초 빨라졌어요 (${before} → ${sec}초).`
      : `${head}. 지난 번보다 ${delta}초 더 걸렸어요 (${before} → ${sec}초).`,
    basis: '숨', sure: true, delta,
  };
}

/**
 * 「지금 재보기」 한 줄.
 *
 * 판에서 동작을 하고 잰 것이 아니므로 **안 쌓고 안 견준다** — 견주는 값은 「같은 동작
 * 뒤」라는 조건이 붙어야 뜻이 있고(계획의 3번), 재보기에는 그 동작이 없다.
 *
 * 이미 가라앉아 있던 사람에게 「0초 걸렸어요」는 틀린 말은 아니지만 **읽히지 않는다.**
 * 숨이 찬 뒤에 눌러야 하는 것이라고 대신 적는다.
 */
export function tryLine(st) {
  if (!st) return null;
  if (st.seconds === null) return recoverWhy(st.why);
  if (st.seconds <= SAME_SEC) return '이미 가라앉아 있었어요 — 숨이 찬 뒤에 눌러보세요.';
  return `숨이 가라앉는 데 ${st.seconds}초 걸렸어요. 재보기라 안 쌓아둡니다.`;
}

/**
 * 쌓인 것을 **동작별로 묶는다** — 「회복」 갈래가 이것을 그린다.
 *
 * 한 칸에 하나: 그 동작의 **가장 최근 초**와 **그 앞의 초**, 여태 몇 번 쟀나.
 * 최근에 잰 것이 위로 온다.
 *
 * **평균도 최고 기록도 안 낸다.** 회복은 그날 잠 · 물 · 방 온도에 흔들려서, 평균은
 * 없는 정확함을 만들고 「최고 기록」은 몸에 등급을 매기는 쪽으로 간다(8/25 에 정한 선).
 * 우리가 말하는 것은 **마지막 것과 그 앞의 것** 둘뿐이다.
 */
export function recoverGroups(list) {
  const rows = (Array.isArray(list) ? list : [])
    .filter((e) => e && e.key && num(e.seconds) !== null && e.date);
  const by = new Map();
  rows.forEach((r) => {
    const got = by.get(r.key) || { key: r.key, exercise: r.exercise ?? null, duration: num(r.duration), rows: [] };
    got.rows.push(r);
    by.set(r.key, got);
  });
  return [...by.values()].map((g) => {
    const last = g.rows[g.rows.length - 1];
    const before = g.rows.length >= 2 ? g.rows[g.rows.length - 2] : null;
    return {
      key: g.key,
      exercise: g.exercise,
      duration: g.duration,
      count: g.rows.length,
      last,
      prev: before,
      // 음수면 빨라진 것이다. 견줄 것이 없으면 `null` — **0 으로 두지 않는다**
      delta: before ? last.seconds - before.seconds : null,
    };
  }).sort((a, b) => (a.last.date < b.last.date ? 1 : a.last.date > b.last.date ? -1 : 0));
}

/** 묶음 한 칸을 말로. 견줄 것이 없으면 **초만 적는다.** */
export function groupLine(g) {
  if (!g) return null;
  if (g.delta === null) return `${g.last.seconds}초 — 아직 한 번만 쟀어요`;
  if (Math.abs(g.delta) <= SAME_SEC) return `${g.last.seconds}초 — 그 앞(${g.prev.seconds}초)과 거의 같아요`;
  return g.delta < 0
    ? `${g.last.seconds}초 — 그 앞보다 ${Math.abs(g.delta)}초 빨라요 (${g.prev.seconds}초였어요)`
    : `${g.last.seconds}초 — 그 앞보다 ${g.delta}초 더 걸렸어요 (${g.prev.seconds}초였어요)`;
}

/**
 * 판 하나의 결산.
 *
 * rows 는 이 판에서 잰 칸들. **가장 오래 걸린 것 하나**와, 지난 번과 견줄 수 있는
 * 것들의 **차이 합**을 준다.
 *
 * 평균을 안 내는 까닭 — 판마다 동작 수가 다르고 못 잰 칸이 섞인다. 평균은 그것을
 * 감춰서 **없는 정확함**을 만든다. 「몇 칸을 쟀고 그중 몇이 빨라졌나」까지가 정직한 선이다.
 */
export function recoverSummary(rows, log, today) {
  const got = (rows || []).filter((r) => r && num(r.seconds) !== null && r.key);
  if (got.length === 0) return null;

  let slowest = got[0];
  got.forEach((r) => { if (r.seconds > slowest.seconds) slowest = r; });

  let faster = 0;
  let slower = 0;
  let compared = 0;
  got.forEach((r) => {
    const prev = pickRecoverPrev(log, r.key, today);
    const before = prev ? num(prev.seconds) : null;
    if (before === null) return;
    compared += 1;
    const d = r.seconds - before;
    if (d < -SAME_SEC) faster += 1;
    else if (d > SAME_SEC) slower += 1;
  });

  return { count: got.length, slowest, compared, faster, slower };
}

/** 결산 한 줄. 견줄 것이 없으면 **센 것만 말한다.** */
export function summaryLine(s) {
  if (!s) return null;
  const head = `숨이 가라앉는 데 걸린 시간을 ${s.count}칸 쟀어요`;
  if (s.compared === 0) return `${head}. 다음에 같은 동작을 하면 지난 번과 견줘 드려요.`;
  if (s.faster > 0 && s.slower === 0) return `${head}. 그중 ${s.faster}칸이 지난 번보다 빨라졌어요.`;
  if (s.slower > 0 && s.faster === 0) return `${head}. 그중 ${s.slower}칸이 지난 번보다 더 걸렸어요.`;
  if (s.faster > 0 && s.slower > 0) return `${head}. ${s.faster}칸은 빨라지고 ${s.slower}칸은 더 걸렸어요.`;
  return `${head}. 지난 번과 거의 같아요.`;
}
