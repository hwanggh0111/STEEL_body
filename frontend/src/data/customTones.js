import { CUSTOM_TONES_KEY } from './localKeys';

// 내가 만드는 알림 소리 (2026-09-22).
//
// ── 왜 파일을 안 받나 ──
//
// 「소리를 올릴 수 있게」가 첫 생각이지만, mp3 하나가 몇 백 KB 다. 이 앱의 알림음은
// **0바이트**다 — 소리 파일을 두지 않고 그 자리에서 만든다(`alertSound.js` 에 적힌
// 판단이다). 파일을 받기 시작하면 그 원칙이 무너지고, 남의 소리를 올리는 문제도 생긴다.
//
// 그래서 **만들 재료를 준다.** 높이 · 몇 번 · 빠르기 · 결을 고르면 그 조합으로 소리가
// 나온다. 고를 수 있는 가짓수는 3 × 4 × 3 × 3 = **108가지**다 —
// 「다양하게」에는 이만큼이면 된다.
//
// ── 어디에 남나 ──
//
// 브라우저에 남는다(`localKeys.js` 의 「기기의 것」 칸). 알림음은 **그 기기에서
// 어떻게 쓰는지**에 대한 취향이라 로그아웃해도 남긴다 — 휴식 타이머 설정과 같은 결이다.

/** 얼마나 높게. 사람이 「도」·「높은 도」로 아는 자리라 배수로 둔다. */
export const PITCHES = [
  { id: 'low', name: '낮게', freq: 440 },
  { id: 'mid', name: '보통', freq: 880 },
  { id: 'high', name: '높게', freq: 1320 },
];

/** 몇 번 울릴까. */
export const COUNTS = [1, 2, 3, 4];

/** 얼마나 빠르게 — 음 사이 간격(초). */
export const SPEEDS = [
  { id: 'fast', name: '빠르게', gap: 0.11 },
  { id: 'mid', name: '보통', gap: 0.18 },
  { id: 'slow', name: '느리게', gap: 0.3 },
];

/**
 * 어떤 결로.
 *
 * `type` 은 파형이다 — 같은 높이라도 결이 다르면 아주 다르게 들린다.
 * 셋은 이미 쓰고 있는 것들이다(맑게=sine, 날카롭게=square, 나무=triangle).
 */
export const SHAPES = [
  { id: 'soft', name: '맑게', type: 'sine', dur: 0.14, decay: true, peak: 0.6 },
  { id: 'sharp', name: '날카롭게', type: 'square', dur: 0.09, decay: false, peak: 0.5 },
  { id: 'wood', name: '나무처럼', type: 'triangle', dur: 0.07, decay: true, peak: 0.6 },
];

/** 이름은 짧게. 고르개에 들어가는 글자라 길면 줄이 무너진다. */
export const NAME_MAX = 6;

/** 몇 개까지 만들 수 있나. 목록이 길어지면 고르는 일이 일이 된다. */
export const MAX_TONES = 6;

const find = (list, id, fallback) => list.find((x) => String(x.id) === String(id)) || fallback;

/**
 * 고른 것들 → 실제로 울릴 음들.
 *
 * **마지막 음만 높이고 조금 길게 둔다.** 같은 음을 세 번 치면 「끝났나?」 싶은데,
 * 마지막이 올라가면 끝이라는 것이 들린다 — 기본 소리 「띵」이 그렇게 돼 있고,
 * 사람이 알림음에서 기대하는 결이다.
 */
export function notesOf(draft) {
  // **아무것도 안 줘도 안 터진다.** 풀어서 받으면(`{ pitch }`) `undefined` 에서
  // 그 자리가 터진다 — 부르는 쪽이 한 군데라도 빠뜨리면 소리 고르개가 통째로 안 나온다
  const { pitch, count, speed, shape } = draft || {};
  const p = find(PITCHES, pitch, PITCHES[1]);
  const sp = find(SPEEDS, speed, SPEEDS[1]);
  const sh = find(SHAPES, shape, SHAPES[0]);
  const n = COUNTS.includes(Number(count)) ? Number(count) : 3;

  const notes = [];
  for (let i = 0; i < n; i += 1) {
    const last = i === n - 1 && n > 1;
    notes.push({
      start: Math.round(i * sp.gap * 1000) / 1000,
      // 마지막은 5도 위(1.5배). 딱 떨어지는 배수라 어떤 높이에서도 어울린다
      freq: Math.round(last ? p.freq * 1.5 : p.freq),
      dur: last ? Math.round(sh.dur * 1.6 * 1000) / 1000 : sh.dur,
      type: sh.type,
      peak: sh.peak,
      ...(sh.decay ? { decay: true } : null),
    });
  }
  return notes;
}

/** 만든 소리 한 벌. `TONES` 와 같은 모양이라 재생하는 쪽이 구별할 필요가 없다. */
export function buildTone(draft) {
  const p = find(PITCHES, draft?.pitch, PITCHES[1]);
  const sh = find(SHAPES, draft?.shape, SHAPES[0]);
  const n = COUNTS.includes(Number(draft?.count)) ? Number(draft.count) : 3;
  const sp = find(SPEEDS, draft?.speed, SPEEDS[1]);
  return {
    id: String(draft?.id || `my-${Date.now()}`),
    name: String(draft?.name || '').trim().slice(0, NAME_MAX) || '내 소리',
    desc: `${p.name} · ${n}번 · ${sp.name} · ${sh.name}`,
    notes: notesOf(draft || {}),
    mine: true,          // 화면이 「지우기」를 붙일지 정하는 데 쓴다
    draft: {             // 다시 열어 고칠 수 있게 고른 것을 그대로 둔다
      pitch: p.id, count: n, speed: sp.id, shape: sh.id,
    },
  };
}

/**
 * 브라우저에 남겨둔 것을 읽는다.
 *
 * **저장한 모양을 그대로 믿지 않는다.** 앱을 고치면서 `SHAPES` 하나를 빼는 날이
 * 올 수 있는데, 그때 옛 값이 그대로 울리면 이상한 소리가 난다.
 * 읽을 때마다 **다시 만든다** — 없는 것을 고른 자리는 기본으로 돌아간다.
 */
export function loadTones() {
  try {
    const raw = localStorage.getItem(CUSTOM_TONES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list.slice(0, MAX_TONES).map((t) => buildTone({ ...t.draft, id: t.id, name: t.name }));
  } catch {
    return [];
  }
}

/** 저장한다. 돌려주는 것은 저장 뒤의 목록. */
export function saveTones(list) {
  const keep = (Array.isArray(list) ? list : []).slice(0, MAX_TONES).map((t) => ({
    id: t.id, name: t.name, draft: t.draft,
  }));
  try { localStorage.setItem(CUSTOM_TONES_KEY, JSON.stringify(keep)); } catch { /* 막아둔 브라우저 */ }
  return keep.map((t) => buildTone({ ...t.draft, id: t.id, name: t.name }));
}

/** 더 만들 수 있나. */
export function canAdd(list) {
  return (Array.isArray(list) ? list.length : 0) < MAX_TONES;
}
