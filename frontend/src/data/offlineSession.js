// 신호가 없을 때 **진행표**를 잃지 않는다 (2026-11-04).
//
// ── 왜 ──
//
// 11/04 에 「지하에서 루틴으로 운동하면 기록이 한 줄도 안 적혔다」를 고쳤다. 기록은
// 줄에 서게 됐지만 **진행표는 서버에만 있다** — 지하에서는 칸이 한 칸도 안 넘어가서
// 여덟 칸 루틴이 끝까지 1/8 이고, 화면은 그 운동을 계속 묻는다. 사람은 저장이 안 된
// 줄 알고 또 적는다. 그래서 그 자리에 「신호가 없어 진행표는 안 넘어갔어요」를 띄워
// 두기만 했다 — **말만 하고 못 넘긴 것이다.**
//
// 이 앱이 스스로 적어둔 말이 「헬스장은 지하가 많다」다. 루틴은 지하에서 돌린다.
//
// ── 틀은 이미 두 벌 있다 ──
//
//   `data/offline.js`      운동 기록 줄 — 하루에 여러 개다 → **배열**(적은 순서가 올릴 순서)
//   `data/offlineNotes.js` 그날 메모 줄 — 하루 한 장이다   → **날짜로 찾는 것**
//
// 진행표는 **자리 번호로 찾는 것**이다. 한 칸을 세 번 눌러도(1 → 2 → 3세트) 서버에
// 보낼 것은 **마지막 하나**다. 배열로 쌓으면 신호가 돌아왔을 때 세 번 올리고, 그
// 셋은 같은 자리를 덮어쓰기만 한다. 메모와 같은 까닭이다.
//
// 한 칸에 두 가지가 쌓일 수 있다 —
//
//   setsDone  세트를 몇 개 눌렀나 (여러 번 바뀐다 → 마지막 것만)
//   state     그 칸을 끝냈나 · 넘겼나 (한 번이다)
//
// **둘을 한 칸에 같이 들고 있는다.** 올릴 때는 `setsDone` 을 먼저, `state` 를 나중에
// 보낸다 — 서버의 `state` 는 「칸을 넘긴다」라서, 넘긴 뒤에 세트 수를 보내면
// 「진행표가 바뀌었어요」(409)로 튕긴다.
//
// 이 파일에는 화면이 없다. 값만 받아 값을 돌려준다 — `npm run basement` 가 브라우저
// 없이 돌려본다. 브라우저에 담는 일은 맨 아래 몇 줄이 한다.
import { readLS, saveLS, removeLS } from './safeStorage';
import { SESSION_QUEUE_KEY, WORKOUT_CACHE_KEY } from './localKeys';

// 실패의 모양을 가르는 것은 운동 기록과 **똑같은 규칙**이다. 두 벌로 적으면
// 한쪽만 고치는 날이 온다 — 저기 것을 그대로 쓴다 (메모 쪽과 같은 결)
export { isOfflineError, isOnline } from './offline';

/** 줄의 모양을 지킨다. 깨진 것이 담겨 있어도 화면이 안 죽는다 */
const asQueue = (q) => (q && typeof q === 'object' && !Array.isArray(q) ? q : {});

/** 그 진행표의 것인가 — 루틴을 새로 시작하면 앞 줄은 버린다 (아래 `keepFor`) */
const asKey = (v) => (v === null || v === undefined ? '' : String(v));

/**
 * 세트 체크를 줄에 세운다. **같은 칸을 또 누르면 덮어쓴다.**
 *
 * `at` 은 올릴 차례를 위한 것이 아니다(자리 번호로 찾으므로 차례가 없다) —
 * **언제부터 못 올리고 있는지**를 화면이 말해주는 데 쓴다.
 */
export function queueSets(queue, index, setsDone, now = Date.now()) {
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0) return asQueue(queue);
  const q = asQueue(queue);
  const before = q[i] || {};
  return { ...q, [i]: { ...before, setsDone, at: new Date(now).toISOString() } };
}

/**
 * 칸을 끝냈거나 넘긴 것을 줄에 세운다.
 *
 * **`state` 는 되돌리지 않는다** — 한 번 넘긴 칸을 다시 todo 로 적는 길은 화면에
 * 없다. 그래서 덮어쓰는 것으로 둔다(같은 칸을 두 번 끝낼 수는 없다).
 */
export function queueState(queue, index, state, now = Date.now()) {
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0) return asQueue(queue);
  const q = asQueue(queue);
  const before = q[i] || {};
  return { ...q, [i]: { ...before, state, at: new Date(now).toISOString() } };
}

/** 올라간 칸을 줄에서 뺀다 */
export function dropIndex(queue, index) {
  const q = asQueue(queue);
  const i = String(index);
  if (!(i in q)) return q;
  const next = { ...q };
  delete next[i];
  return next;
}

/** 못 올린 칸에 까닭을 적어둔다 — 서버가 「안 된다」고 답한 것은 다시 보내도 같다 */
export function markSessionFailed(queue, index, reason) {
  const q = asQueue(queue);
  const i = String(index);
  if (!(i in q)) return q;
  return { ...q, [i]: { ...q[i], failed: true, error: reason || null } };
}

/** 올릴 수 있는 칸들 — 자리 번호 차례로. 표시된 것은 뺀다(사람이 누를 때까지) */
export function pendingIndexes(queue) {
  return Object.entries(asQueue(queue))
    .filter(([, v]) => v && !v.failed)
    .map(([k]) => Number(k))
    .filter((n) => Number.isInteger(n) && n >= 0)
    .sort((a, b) => a - b);
}

/** 올릴 것이 몇 칸인가 (머리의 「올릴 것 N」) */
export function pendingCount(queue) {
  return pendingIndexes(queue).length;
}

/**
 * 화면이 보는 진행표에 **줄을 얹는다.**
 *
 * `workoutStore` 의 `mergeQueue` 와 같은 자리다 — 적은 순간 바로 보여야 한다.
 * 신호가 없다고 눌린 세트가 화면에서 사라지면 사람은 또 누르고, 그 다음엔 앱을
 * 의심한다.
 *
 * **서버가 준 것을 바탕으로 깐다.** 줄은 그 위에 덮는 것이고, 올라가면 사라진다 —
 * 그 뒤에는 서버 것이 그대로 보인다(이 앱의 다른 자리와 같은 선: 서버가 답했으면
 * 서버가 진실이다).
 */
export function applyQueue(session, queue) {
  const q = asQueue(queue);
  if (!session || !Array.isArray(session.items) || Object.keys(q).length === 0) return session;
  const items = session.items.map((it, i) => {
    const up = q[i];
    if (!up) return it;
    const next = { ...it };
    if (up.setsDone !== undefined) next.setsDone = up.setsDone;
    if (up.state !== undefined) next.state = up.state;
    // 화면이 「아직 못 올렸다」를 그릴 수 있게 표시한다 (운동 줄의 `pending` 과 같다)
    next.pending = true;
    if (up.failed) next.failed = true;
    return next;
  });
  // **진행 수도 다시 센다.** 서버가 보낸 done/current 는 줄을 모른다 —
  // 그대로 두면 칸은 넘어갔는데 막대가 1/8 에 머문다(그것이 고치려던 바로 그 모습이다)
  const done = items.filter((i) => i.state !== 'todo').length;
  const completed = items.filter((i) => i.state === 'done').length;
  const skipped = items.filter((i) => i.state === 'skip').length;
  const current = items.findIndex((i) => i.state === 'todo');
  return { ...session, items, done, completed, skipped, current, total: items.length };
}

/**
 * 이 줄이 **그 진행표의 것인가.**
 *
 * 루틴을 새로 시작하면 자리 번호의 뜻이 달라진다 — 앞 루틴의 「3번 칸을 끝냈다」가
 * 새 루틴의 3번 칸에 얹히면 **하지도 않은 운동이 끝난 것**이 된다. 그래서 줄에
 * 어느 진행표의 것인지를 같이 담고, 다르면 버린다.
 */
export function keepFor(stored, startedAt) {
  const box = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  if (asKey(box.for) !== asKey(startedAt)) return {};
  return asQueue(box.queue);
}

// ── 브라우저에 담는 자리 (여기서만 localStorage 를 만진다) ──

/** 담아둔 줄. 지금 진행표의 것이 아니면 빈 것으로 본다 */
export function readSessionQueue(startedAt) {
  const raw = readLS(SESSION_QUEUE_KEY);
  if (!raw) return {};
  try {
    return keepFor(JSON.parse(raw), startedAt);
  } catch {
    // 깨진 값이 남아 있으면 매번 같은 자리에서 걸린다. 걷어내고 없던 것으로 본다
    removeLS(SESSION_QUEUE_KEY);
    return {};
  }
}

/**
 * 못 올린 칸을 브라우저에 담는다. **담았는지 돌려준다.**
 *
 * 자리가 없으면 **사본을 버려서라도 담는다** — 운동 줄(`saveQueue`)이 세운 규칙과
 * 같다. 사본(90일치 기록)은 서버에서 다시 받을 수 있고, 줄은 사람이 손으로 누른
 * 것이라 어디에도 없다. 그래도 안 되면 `false` 를 돌려주고 **부르는 쪽이 말한다.**
 */
export function saveSessionQueue(queue, startedAt) {
  const q = asQueue(queue);
  if (Object.keys(q).length === 0) return removeLS(SESSION_QUEUE_KEY);
  const text = JSON.stringify({ for: asKey(startedAt), queue: q });
  if (saveLS(SESSION_QUEUE_KEY, text)) return true;
  removeLS(WORKOUT_CACHE_KEY);
  return saveLS(SESSION_QUEUE_KEY, text);
}

/** 로그아웃·그만두기에서 부른다 */
export function clearSessionQueue() {
  return removeLS(SESSION_QUEUE_KEY);
}
