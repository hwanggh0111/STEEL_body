// 신호가 없을 때 적은 **그날 메모**를 잃지 않는다.
//
// 9/3 에 운동 기록에는 이것을 붙였고 메모는 남겨뒀다 — 「메모는 아직 오프라인이
// 아니다」라고 자주 묻는 것에도 적었다. 그런데 **메모야말로 헬스장에서 적는 말이다.**
// 「어깨가 안 좋아 가볍게」는 집에 와서 적는 것이 아니다. 같은 화면에서 세트는
// 담기고 메모는 「저장하지 못했어요」가 뜨면, 사람은 뭐가 되고 뭐가 안 되는지 모른다.
//
// 틀은 `data/offline.js` 와 같다 — 담아둔 것(cache) · 기다리는 줄(queue).
// **줄의 모양만 다르다.**
//
//   운동 기록은 하루에 여러 개다 → 줄이 **배열**이다 (적은 순서가 곧 올릴 순서)
//   그날 메모는 **하루 한 장**이다  → 줄이 **날짜로 찾는 것**이다
//
// 왜 이것이 중요한가. 신호가 없는 채로 한 메모를 세 번 고치면, 배열이면 세 개가
// 줄에 서고 신호가 돌아왔을 때 **세 번 올린다**(서버는 하루 한 장이라 덮어쓰기를
// 세 번 한다). 날짜로 찾으면 **마지막 것 하나만** 올라간다. 사람이 적은 마지막 글이
// 곧 그 날의 메모다.
//
// 이 파일에는 화면도 없다. 값만 받아 값을 돌려준다 — `npm run offline` 이 브라우저
// 없이 돌려본다. 브라우저에 담는 일은 맨 아래 몇 줄이 한다.

import { readLS, saveLS, removeLS } from './safeStorage';
import { NOTE_CACHE_KEY, NOTE_QUEUE_KEY } from './localKeys';

// 실패의 모양을 가르는 것(`isOfflineError`)은 운동 기록과 **똑같은 규칙**이다.
// 두 벌로 적으면 한쪽만 고치는 날이 온다. 저기 것을 그대로 쓴다
export { isOfflineError, isOnline } from './offline';

// 아직 안 올라간 메모의 id. 운동 기록의 `local-` 과 같은 뜻이다 —
// **지우기를 눌렀을 때 서버로 갈지 줄에서 뺄지**가 이 글자로 갈린다
export function localNoteId(date) {
  return 'local-note-' + date;
}

export function isLocalNoteId(id) {
  return typeof id === 'string' && id.startsWith('local-note-');
}

// ── 줄에 세운다 ──
//
// 같은 날짜에 또 적으면 **덮어쓴다.** 줄에 두 장이 서면 안 된다 (위 설명 참고).
export function queueSave(queue, date, body, now = Date.now()) {
  return {
    ...asQueue(queue),
    [date]: { op: 'save', body, at: new Date(now).toISOString(), failed: false, error: null },
  };
}

// 지우기를 줄에 세운다.
//
// **서버에 있는 것이냐가 갈림길이다.**
//   서버에 없다(아직 안 올라간 것) → 줄에서 빼면 끝이다. 서버로 보낼 것이 없다
//   서버에 있다                    → 지우기를 줄에 세운다. 안 그러면 신호가 돌아왔을 때
//                                    지운 메모가 되살아난다
export function queueDelete(queue, date, serverId, now = Date.now()) {
  const q = asQueue(queue);
  if (serverId === null || serverId === undefined || isLocalNoteId(serverId)) {
    return dropEntry(q, date);
  }
  return {
    ...q,
    [date]: { op: 'delete', id: serverId, at: new Date(now).toISOString(), failed: false, error: null },
  };
}

export function dropEntry(queue, date) {
  const q = asQueue(queue);
  if (!(date in q)) return q;
  const next = { ...q };
  delete next[date];
  return next;
}

// **못 올린 것을 버리지 않는다.** 표시만 해두고 화면에서 「다시 시도」와 「지우기」를 준다
export function markNoteFailed(queue, date, reason) {
  const q = asQueue(queue);
  if (!q[date]) return q;
  return { ...q, [date]: { ...q[date], failed: true, error: String(reason || '').slice(0, 200) } };
}

export function clearNoteFailed(queue) {
  const q = asQueue(queue);
  const next = {};
  for (const [date, e] of Object.entries(q)) next[date] = { ...e, failed: false, error: null };
  return next;
}

export function dropFailedNotes(queue) {
  const q = asQueue(queue);
  const next = {};
  for (const [date, e] of Object.entries(q)) if (!e.failed) next[date] = e;
  return next;
}

// ── 서버 것 + 기다리는 줄을 한 장으로 ──
//
// 화면은 **적은 순간 바로 보여야 한다.** 달력 칸에 안 나타나면 사람은 저장이 안 된
// 줄 알고 한 번 더 적는다.
export function mergeNotes(server, queue) {
  const base = server && typeof server === 'object' && !Array.isArray(server) ? server : {};
  const q = asQueue(queue);
  const merged = {};
  for (const [date, note] of Object.entries(base)) if (note) merged[date] = note;
  for (const [date, e] of Object.entries(q)) {
    if (e.op === 'delete') { delete merged[date]; continue; }
    merged[date] = {
      ...(merged[date] || {}),
      id: merged[date]?.id ?? localNoteId(date),
      date,
      body: e.body,
      pending: !e.failed,
      failed: !!e.failed,
      error: e.error || null,
    };
  }
  return merged;
}

// 화면 위쪽 한 줄(`OfflineBar`)은 운동 기록과 **한 줄로 같이** 센다. 신호가 없는데
// 띠가 두 개 뜨면 그것대로 어수선하다. 그래서 저기가 쓰는 배열 모양으로 바꿔준다
export function queueList(queue) {
  return Object.entries(asQueue(queue))
    .map(([date, e]) => ({ id: localNoteId(date), date, kind: 'note', ...e }))
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

function asQueue(queue) {
  return queue && typeof queue === 'object' && !Array.isArray(queue) ? queue : {};
}

// ── 브라우저에 담는 자리 ──

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

const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function readNoteQueue() {
  const q = readJson(NOTE_QUEUE_KEY, {});
  if (!q || typeof q !== 'object' || Array.isArray(q)) return {};
  const kept = {};
  for (const [date, e] of Object.entries(q)) {
    if (!isDate(date) || !e || typeof e !== 'object') continue;
    if (e.op === 'save' && typeof e.body === 'string') kept[date] = e;
    else if (e.op === 'delete' && e.id !== undefined && e.id !== null) kept[date] = e;
  }
  return kept;
}

export function saveNoteQueue(queue) {
  const q = asQueue(queue);
  if (Object.keys(q).length === 0) return removeLS(NOTE_QUEUE_KEY);
  return saveLS(NOTE_QUEUE_KEY, JSON.stringify(q));
}

export function readNoteCache() {
  const c = readJson(NOTE_CACHE_KEY, null);
  return c && typeof c === 'object' && !Array.isArray(c) ? c : null;
}

// **달을 넘길 때마다 그 달치만 받아온다.** 그래서 담아둘 때도 통째로 덮으면 안 된다 —
// 9월을 보다가 8월로 넘기면 9월이 담아둔 것에서 사라진다. 받아온 달만 갈아끼운다.
//
// 담는 것은 운동 기록과 같은 90일까지다. 몇 년치를 담으면 localStorage 가 찬다
export function saveNoteCache(notes, month, days = 90, today = new Date()) {
  const base = notes && typeof notes === 'object' && !Array.isArray(notes) ? notes : {};
  const prev = readNoteCache() || {};
  const limit = new Date(today.getTime() - days * 86400000).toISOString().slice(0, 10);
  const kept = {};
  // 받아온 달은 통째로 갈아끼운다 — 그 달에서 지워진 것이 남아 있으면 안 된다
  for (const [date, note] of Object.entries(prev)) {
    if (month && date.startsWith(month)) continue;
    if (date >= limit && note) kept[date] = note;
  }
  for (const [date, note] of Object.entries(base)) {
    if (date >= limit && note) kept[date] = note;
  }
  return saveLS(NOTE_CACHE_KEY, JSON.stringify(kept));
}

// 담아둔 것 중 그 달치만 꺼낸다 (못 받아왔을 때 이것으로 그린다)
export function cachedMonth(month) {
  const c = readNoteCache();
  if (!c) return null;
  const out = {};
  for (const [date, note] of Object.entries(c)) if (date.startsWith(month)) out[date] = note;
  return out;
}
