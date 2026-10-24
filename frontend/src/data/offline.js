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
import { dateKey } from './dateKey';
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

// ── **「잠깐 쉬어라」는 거절이 아니다** ── (2026-10-24)
//
// 줄에 쌓인 것을 올릴 때 한 줄에 한 번씩 POST 한다. 그런데 전역 셈은 **분당 100**이다
// (`backend/src/config/security.js`) — 신호 없는 헬스장에서 한 판을 다 적으면 쉽게
// 수십 줄이고, 며칠 그러면 100 을 넘는다. 그러면 올리는 중간에 429 가 온다.
//
// 429 는 `err.response` 가 있으니 「신호 문제」가 아니고, 여태 **「서버가 받지
// 않았어요」로 표시**됐다. 표시된 줄은 다음 올리기에서 빠지므로(`!q.failed`)
// **사람이 「다시 시도」를 누를 때까지 영영 안 올라간다** — 고객센터 답변에는
// 「연결되면 저절로 올립니다」라고 적혀 있다.
//
// 서버가 한 말은 「**잠시 뒤에** 다시 해주세요」다. 그러면 멈추고 기다렸다 다시 하는
// 것이 맞다 — 그 줄에는 아무 잘못이 없다.
export function isTooFastError(err) {
  return err?.response?.status === 429;
}

/**
 * 얼마나 뒤에 다시 할까 (밀리초).
 *
 * 서버가 알려주면 그것을 쓴다 — aiGuard 는 `retryAfterSec` 를 몸통에 담고,
 * 전역 셈은 `Retry-After` 머리를 붙인다(`standardHeaders`). 둘 다 없으면 창 하나
 * (1분)를 기다린다. 너무 길게 기다리면 사람이 앱을 닫고 그 사이에 못 올린다
 */
export function retryAfterMs(err) {
  const body = Number(err?.response?.data?.retryAfterSec);
  const head = Number(err?.response?.headers?.['retry-after']);
  const sec = Number.isFinite(body) && body > 0 ? body
    : Number.isFinite(head) && head > 0 ? head : 60;
  return Math.min(Math.max(Math.ceil(sec), 1), 10 * 60) * 1000;
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
export function offlineStatus({ online, queue, unsaved = false, tooFastLeftSec = 0 }) {
  const list = Array.isArray(queue) ? queue : [];
  const failed = list.filter(q => q && q.failed).length;
  const waiting = list.length - failed;

  // ── **이 기기에도 담지 못했다** ── (2026-10-24)
  //
  // 제일 먼저 말한다. 다른 모든 줄은 「나중에 올라간다」는 뜻인데 이것만은
  // **앱을 닫으면 사라진다**는 뜻이다 (자리가 없거나 저장소가 막혀 있다).
  if (unsaved && list.length > 0) {
    return { kind: 'unsaved', count: list.length,
      text: `적어둔 ${list.length}개를 이 기기에 담지 못했어요`,
      hint: '앱을 닫으면 사라집니다 — 신호가 오면 바로 올려주세요' };
  }
  // 서버가 「잠시 뒤에」라고 했다 — **거절이 아니다.** 그 줄은 표시하지 않고 기다린다
  if (tooFastLeftSec > 0 && waiting > 0) {
    return { kind: 'too-fast', count: waiting,
      text: `서버가 잠깐 쉬라고 했어요 · 남은 ${waiting}개`,
      hint: `${tooFastLeftSec}초 뒤에 저절로 다시 올려요` };
  }
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

/**
 * 못 올린 줄을 브라우저에 담는다. **담았는지 돌려준다.**
 *
 * ── 자리가 없으면 **사본을 버려서라도 담는다** ── (2026-10-24)
 *
 * `localStorage` 는 대개 5MB 다. 이 앱은 거기에 **사진도** 담고(프로필 · 비교 사진은
 * base64 다) 90일치 기록 사본도 담는다. 차면 `setItem` 이 던지고, 여태 그 실패를
 * `safeStorage` 가 삼켰다 — **줄은 램에만 남고** 화면은 「이 기기에 적어뒀어요」라고
 * 말했다. 앱을 닫으면 헬스장에서 적은 것이 사라진다. 쿠키를 막아둔 브라우저에서는
 * 늘 그랬다.
 *
 * 둘의 값이 다르다 — **사본(`cache`)은 서버에서 다시 받으면 되고, 줄(`queue`)은
 * 사람이 손으로 적은 것이라 어디에도 없다.** 그래서 자리가 없으면 사본을 버린다.
 * 그래도 안 되면 `false` 를 돌려주고, **부르는 쪽이 사람에게 말한다.**
 */
export function saveQueue(queue) {
  const list = Array.isArray(queue) ? queue : [];
  if (list.length === 0) return removeLS(WORKOUT_QUEUE_KEY);
  const text = JSON.stringify(list);
  if (saveLS(WORKOUT_QUEUE_KEY, text)) return true;
  // 자리를 내준다 — 사본은 다시 받을 수 있다
  removeLS(WORKOUT_CACHE_KEY);
  return saveLS(WORKOUT_QUEUE_KEY, text);
}

export function readCache() {
  const c = readJson(WORKOUT_CACHE_KEY, null);
  return c && typeof c === 'object' && !Array.isArray(c) ? c : null;
}

// 담아두는 것은 **최근 것부터 90일까지**다. 몇 년치를 통째로 담으면 localStorage 가
// 찬다(대개 5MB). 신호가 없을 때 보려는 것은 최근이지 3년 전이 아니다
export function saveCache(workouts, days = 90, today = new Date()) {
  const base = workouts && typeof workouts === 'object' && !Array.isArray(workouts) ? workouts : {};
  // **그 기기의 날짜로 센다** (2026-09-19). `toISOString()` 은 UTC 라 한국에서는
  // 새벽 0~9시에 하루 덜 담는다 — `dateKey` 가 이 앱의 「그날」이다
  const limit = dateKey(new Date(today.getTime() - days * 86400000));
  const kept = {};
  for (const [date, items] of Object.entries(base)) {
    if (date >= limit && Array.isArray(items) && items.length > 0) kept[date] = items;
  }
  return saveLS(WORKOUT_CACHE_KEY, JSON.stringify(kept));
}
