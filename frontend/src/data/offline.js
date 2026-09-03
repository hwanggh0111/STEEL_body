// 신호가 없을 때 적은 것을 잃지 않는다.
//
// **헬스장은 지하가 많다.** 서비스워커가 껍데기를 담아둬서 앱은 열리는데, 적어서
// 저장을 누르면 「저장 실패」 토스트 하나가 뜨고 **방금 한 세트가 그대로 날아갔다.**
// 화면의 목록도 메모리에만 있어서, 신호가 없으면 지난 기록조차 안 보였다.
//
// 그래서 둘을 둔다.
//
//   담아둔 목록(cache) — 마지막으로 받아온 기록. 못 받아오면 이것으로 그린다
//   기다리는 줄(queue) — 아직 못 올린 기록. 신호가 돌아오면 순서대로 올린다
//
// **이 파일에는 화면도 저장소도 없다.** 값만 받아 값을 돌려준다 —
// 그래야 `npm run check` 가 브라우저 없이 돌려볼 수 있다.
// 브라우저에 실제로 담는 일은 아래 `readQueue`/`saveQueue` 몇 줄이 한다.

import { readLS, saveLS, removeLS } from './safeStorage';
import { WORKOUT_CACHE_KEY, WORKOUT_QUEUE_KEY } from './localKeys';

// ── 이 실패는 「신호가 없다」인가, 「서버가 안 받는다」인가 ──
//
// **둘을 가르는 것이 이 기능의 전부다.**
// 신호가 없어서 못 간 것은 나중에 그대로 다시 보내면 된다. 그런데 서버가 400 으로
// 「그렇게는 안 받는다」고 답한 것은 백 번 다시 보내도 400 이다 — 줄에 세워두면
// 영영 안 빠지는 줄이 된다.
//
// axios 는 **답을 받았으면** `err.response` 를 준다. 못 받았으면(끊김 · 시간 초과)
// 그 자리가 비어 있다. 그것이 우리가 아는 유일하고 확실한 구분이다.
export function isOfflineError(err) {
  if (!err) return false;
  if (err.response) return false;                 // 서버가 답했다 — 신호는 있었다
  if (err.code === 'ERR_CANCELED') return false;  // 우리가 취소한 것
  return true;
}

// 지금 신호가 있는가. `navigator.onLine` 은 **거짓말을 잘 한다**(와이파이에 붙어만
// 있어도 true 다). 그래서 이것만 믿고 막지 않는다 — 일단 보내보고, 실패의 모양으로
// 가른다. 이 값은 화면에 「신호 없음」을 띄울 때만 쓴다.
export function isOnline() {
  try {
    return typeof navigator === 'undefined' || navigator.onLine !== false;
  } catch {
    return true;
  }
}

// ── 기다리는 줄에 넣을 한 건 ──
//
// id 를 `local-` 로 시작하게 만든다. 화면과 store 가 **서버 것과 아직 안 올라간 것을
// 이 글자로 가른다** — 지우기를 누르면 서버에 DELETE 를 보낼지 줄에서 뺄지가 갈린다.
export function makeQueued(payload, now = Date.now(), seed = Math.random()) {
  return {
    id: 'local-' + now.toString(36) + '-' + Math.floor(seed * 1e6).toString(36),
    payload,
    at: new Date(now).toISOString(),
    failed: false,
    error: null,
  };
}

export function isLocalId(id) {
  return typeof id === 'string' && id.startsWith('local-');
}

// ── 담아둔 목록 + 기다리는 줄을 하나로 ──
//
// 화면은 **적은 순간 바로 보여야 한다.** 신호가 없다고 「저장했습니다」만 뜨고 목록에
// 안 나타나면, 사람은 저장이 안 된 줄 알고 한 번 더 적는다.
//
// 아직 못 올린 것은 `pending: true` 로 표시해 목록에 같이 그린다.
// 서버 것과 섞이지만 **날짜 안에서는 뒤에** 붙인다 — 방금 적은 것이 그 날의 마지막이다.
export function mergeQueue(workouts, queue) {
  const base = workouts && typeof workouts === 'object' && !Array.isArray(workouts) ? workouts : {};
  const list = Array.isArray(queue) ? queue : [];
  const merged = {};
  for (const [date, items] of Object.entries(base)) {
    merged[date] = Array.isArray(items) ? [...items] : [];
  }
  for (const q of list) {
    if (!q || !q.payload || !q.payload.date) continue;
    const date = q.payload.date;
    if (!merged[date]) merged[date] = [];
    merged[date].push({
      ...q.payload,
      id: q.id,
      created_at: q.at,
      pending: !q.failed,   // 올리는 중
      failed: !!q.failed,   // 서버가 안 받았다
      error: q.error || null,
    });
  }
  return merged;
}

// 줄에서 하나 뺀다 (올렸거나, 사람이 지웠거나)
export function dropFromQueue(queue, id) {
  return (Array.isArray(queue) ? queue : []).filter(q => q && q.id !== id);
}

// **못 올린 것을 줄에서 버리지 않는다.** 버리면 사람이 적은 것이 소리 없이 사라진다.
// 표시만 해두고 화면에서 「다시 시도」와 「지우기」를 준다
export function markFailed(queue, id, reason) {
  return (Array.isArray(queue) ? queue : []).map(q => (
    q && q.id === id ? { ...q, failed: true, error: String(reason || '').slice(0, 200) } : q
  ));
}

export function clearFailedMark(queue) {
  return (Array.isArray(queue) ? queue : []).map(q => (
    q && q.failed ? { ...q, failed: false, error: null } : q
  ));
}

// 줄에 있는 것을 고친다 (아직 안 올라갔으니 고치는 것은 줄에서 한다)
export function editInQueue(queue, id, payload) {
  return (Array.isArray(queue) ? queue : []).map(q => (
    q && q.id === id ? { ...q, payload: { ...q.payload, ...payload } } : q
  ));
}

// 화면 위쪽에 뭐라고 적을 것인가. 상태 넷을 한 곳에서 정한다 —
// 화면마다 조건을 따로 적으면 곧 서로 다른 말을 한다
export function offlineStatus({ online, queue }) {
  const list = Array.isArray(queue) ? queue : [];
  const failed = list.filter(q => q && q.failed).length;
  const waiting = list.length - failed;

  if (failed > 0) {
    return { kind: 'failed', count: failed,
      text: `${failed}개를 올리지 못했어요`, hint: '다시 시도하거나 지울 수 있어요' };
  }
  if (!online && waiting > 0) {
    return { kind: 'offline-waiting', count: waiting,
      text: `신호가 없어요 · 적어둔 ${waiting}개는 기기에 있어요`, hint: '연결되면 저절로 올라가요' };
  }
  if (!online) {
    return { kind: 'offline', count: 0,
      text: '신호가 없어요', hint: '적는 것은 그대로 됩니다. 연결되면 올라가요' };
  }
  if (waiting > 0) {
    return { kind: 'sending', count: waiting, text: `${waiting}개를 올리는 중이에요`, hint: null };
  }
  return null;   // 아무 일도 없으면 아무것도 안 띄운다
}

// ── 브라우저에 담는 자리 (여기서만 localStorage 를 만진다) ──

function readJson(key, fallback) {
  const raw = readLS(key);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch {
    // 깨진 값이 남아 있으면 **매번 같은 자리에서 걸린다.** 걷어내고 없던 것으로 본다
    removeLS(key);
    return fallback;
  }
}

export function readQueue() {
  const q = readJson(WORKOUT_QUEUE_KEY, []);
  return Array.isArray(q) ? q.filter(x => x && x.id && x.payload) : [];
}

export function saveQueue(queue) {
  const list = Array.isArray(queue) ? queue : [];
  if (list.length === 0) return removeLS(WORKOUT_QUEUE_KEY);
  return saveLS(WORKOUT_QUEUE_KEY, JSON.stringify(list));
}

export function readCache() {
  const c = readJson(WORKOUT_CACHE_KEY, null);
  return c && typeof c === 'object' && !Array.isArray(c) ? c : null;
}

// 담아두는 것은 **최근 것부터 90일까지**다. 몇 년치를 통째로 담으면 localStorage 가
// 찬다(대개 5MB). 신호가 없을 때 보려는 것은 최근이지 3년 전이 아니다
export function saveCache(workouts, days = 90, today = new Date()) {
  const base = workouts && typeof workouts === 'object' && !Array.isArray(workouts) ? workouts : {};
  const limit = new Date(today.getTime() - days * 86400000).toISOString().slice(0, 10);
  const kept = {};
  for (const [date, items] of Object.entries(base)) {
    if (date >= limit && Array.isArray(items) && items.length > 0) kept[date] = items;
  }
  return saveLS(WORKOUT_CACHE_KEY, JSON.stringify(kept));
}
