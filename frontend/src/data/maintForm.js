// 점검 스케줄 하나를 **수정 폼에 올리고 다시 내리는 자** (2026-10-24).
//
// ── 왜 생겼나 ──
//
// 관리자 화면에서 날짜로 잡은 점검(긴급 · 서버 · 정기 셋 다 그렇다)의 **「수정」을
// 누르면 화면이 통째로 흰 화면이 됐다.**
//
//     Uncaught TypeError: Cannot read properties of undefined (reading 'includes')
//
// 까닭은 **같은 줄이 두 모양**이었다. 화면이 만들 때는 `days: []` 를 달아 보내는데,
// 서버(`routes/maintenance.js` 의 `clean`)는 날짜가 있으면 **`days` 칸을 아예 안
// 만든다** — 날짜짜리에 요일이 있을 이유가 없으니 맞는 판단이다. 그리고 저장하면
// 화면은 **서버가 돌려준 줄로 갈아끼운다**(`setSchedules(saved)`). 그래서 저장한
// 뒤부터 그 줄에는 `days` 가 없고, 요일 단추 일곱 개를 그리는 `form.days.includes(i)`
// 가 `undefined` 를 읽었다.
//
// ── 하나 더: 요일 단추가 거짓말을 했다 ──
//
// 날짜가 있는 줄은 `runsOn`(MaintenanceScreen)이 **날짜만 본다** — `days` 를 아예
// 안 읽는다. 그러니 날짜짜리의 수정 폼에 뜬 요일 일곱 개는 눌러도 아무 일이 없다.
// 「월·수·금」으로 고쳐놓고 나가도 그 점검은 여전히 그 하루만 돈다.
// 그래서 **날짜짜리에는 요일을 안 보여준다**(화면이 이 `repeats` 로 가른다).
//
// 모양을 맞추는 일을 화면 안에 적어두면 또 어긋난다. 값만 다루는 자리로 떼어
// `npm run alarm` 옆에서 돌려본다 (`scripts/check-maint.cjs`).

/** 새로 만드는 요일 반복 점검의 기본값 — 평일 새벽 4시 한 시간 */
export const NEW_FORM = {
  startHour: 4, startMin: 0, durationMin: 60,
  days: [1, 2, 3, 4, 5], reason: '정기 시스템 점검',
};

/** 이 줄은 요일로 되풀이되나 (아니면 날짜 하루짜리다) */
export function repeats(entry) {
  return !(entry && typeof entry.date === 'string' && entry.date);
}

/**
 * 저장돼 있는 줄 → 수정 폼.
 *
 * **없는 칸을 채워서 준다.** 폼은 입력이 늘 있다고 보고 그리므로, 여기서 모양을
 * 맞춰두지 않으면 서버가 돌려준 줄에서 화면이 터진다.
 */
export function formOf(entry) {
  const e = entry && typeof entry === 'object' ? entry : {};
  const int = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
  return {
    startHour: int(e.startHour, 0),
    startMin: int(e.startMin, 0),
    durationMin: int(e.durationMin, 60),
    days: Array.isArray(e.days) ? [...e.days] : [],
    reason: typeof e.reason === 'string' ? e.reason : '',
    // 날짜 · 종류는 **그대로 들고 간다** — 안 그러면 「10월 25일 하루」 짜리가
    // 수정 한 번에 「매일」 로 바뀐다
    ...(e.date ? { date: e.date } : {}),
    ...(e.type ? { type: e.type } : {}),
  };
}

/**
 * 수정 폼 → 저장할 줄.
 *
 * **날짜짜리에는 `days` 를 안 적는다.** 서버가 만드는 모양과 같아야 한다 —
 * 한쪽만 칸을 더 들고 있으면 저장 전후로 줄의 모양이 달라져서, 그 차이를 읽는
 * 자리가 또 터진다.
 */
export function entryOf(base, form) {
  const b = base && typeof base === 'object' ? base : {};
  const f = form && typeof form === 'object' ? form : {};
  const out = {
    ...b,
    startHour: Number(f.startHour),
    startMin: Number(f.startMin),
    durationMin: Number(f.durationMin),
    reason: f.reason,
  };
  if (repeats(out)) out.days = Array.isArray(f.days) ? f.days : [];
  else delete out.days;
  return out;
}
