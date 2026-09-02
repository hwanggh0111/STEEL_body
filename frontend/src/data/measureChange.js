// 측정 도구가 같이 쓰는 계산 — **지난번과 견주면 얼마나 달라졌나.**
//
// 측정 도구 셋(전신 사이즈 · 체력 테스트 · 유연성)은 **적기만 하고 달라진 것을 안
// 말했다.** 푸시업 30개를 적으면 목록에 「푸시업 30개」로 쌓일 뿐, 지난번보다 늘었는지
// 줄었는지는 **사람이 위아래를 번갈아 보며 직접 빼야** 알 수 있었다.
// 인바디는 「얼마나 달라졌나」를, 기록은 「최고기록」을 말하는데 여기만 장부였다.
//
// **몸과 기록을 다르게 다룬다.**
//   · **전신 사이즈 · 유연성은 몸이다.** 8/25 에 「몸에 등급을 매기지 않는다」고 정했다 —
//     허리가 늘었다고 「나쁨」이라고 하지 않는다. **방향만** 말한다
//   · **체력 테스트는 기록이다.** 푸시업 34개는 30개보다 잘한 것이 맞다.
//     그래서 여기서만 **최고 기록**을 말한다 (기록 화면의 「최고기록」과 같은 결이다)

/**
 * 그 항목이 적힌 기록만 **최신 순으로.**
 *
 * 서버가 이미 날짜 내림차순으로 준다. 다만 **같은 날 두 번 잰 것**은 날짜가 같아서
 * 순서가 들어온 차례대로 남는다 — 아침에 재고 저녁에 또 재면 「지난번」이 아침 것이
 * 아니라 **저녁 것보다 먼저 들어온 아침 것**으로 잡힌다. 날짜가 같으면 나중에 적은
 * 것(id 가 큰 것)을 앞에 둔다.
 */
function withKey(records, key) {
  return (records || [])
    .filter((r) => r?.data?.[key] != null && r.data[key] !== '')
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.id || 0) - (a.id || 0));
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const dayStart = (s) => {
  const t = Date.parse(`${s}T00:00:00`);
  return Number.isFinite(t) ? t : null;
};

/**
 * 지난번과 견주면.
 *
 * @returns {{ last:number, prev:number|null, diff:number|null, days:number|null, date:string }|null}
 *   적은 적이 없으면 `null` — **화면은 그때 아무 줄도 안 그린다.**
 *   한 번만 적었으면 `prev` 가 `null` 이다 (견줄 것이 없다고 말한다)
 */
export function changeOf(records, key) {
  const rows = withKey(records, key);
  if (rows.length === 0) return null;
  const last = num(rows[0].data[key]);
  if (last === null) return null;
  const prevRow = rows[1] || null;
  const prev = prevRow ? num(prevRow.data[key]) : null;
  const d1 = dayStart(rows[0].date);
  const d0 = prevRow ? dayStart(prevRow.date) : null;
  return {
    last,
    prev,
    diff: prev === null ? null : Number((last - prev).toFixed(1)),
    days: d0 && d1 ? Math.round((d1 - d0) / 86400000) : null,
    date: rows[0].date,
  };
}

/**
 * 최고 기록. `better` 가 'down' 이면 **작을수록 좋은 것**이다 (1km 달리기).
 * **체력 테스트에서만 쓴다** — 몸에는 최고를 매기지 않는다.
 */
export function bestOf(records, key, better = 'up') {
  const rows = withKey(records, key);
  if (rows.length === 0) return null;
  let best = null;
  for (const r of rows) {
    const v = num(r.data[key]);
    if (v === null) continue;
    if (!best || (better === 'down' ? v < best.value : v > best.value)) {
      best = { value: v, date: r.date };
    }
  }
  return best;
}

/** 「+2.0cm」 · 「-1.5cm」 · 「그대로」 */
export function diffLabel(diff, unit = '') {
  if (diff === null || diff === undefined) return '';
  if (diff === 0) return '그대로';
  return `${diff > 0 ? '+' : ''}${diff}${unit}`;
}

/** 「3일 만에」 · 「2주 만에」. 며칠인지 모르면 빈 문자열 */
export function sinceLabel(days) {
  if (days === null || days === undefined) return '';
  if (days <= 0) return '같은 날';
  if (days < 14) return `${days}일 만에`;
  if (days < 60) return `${Math.round(days / 7)}주 만에`;
  return `${Math.round(days / 30)}개월 만에`;
}

// ── 초 ↔ 분:초 ──
//
// 1km 달리기를 **초로만** 받고 있었다. 안내 숫자가 `300`(=5분)이었다.
// 사람은 스톱워치를 「5분 12초」로 읽지 312로 읽지 않는다 — 적을 때도 볼 때도
// 머리로 나눠야 했다. **저장은 그대로 초로 한다**(이미 쌓인 기록이 초다).

/** 312 → '5:12'. 못 읽으면 빈 문자열 */
export function mmss(seconds) {
  const n = num(seconds);
  if (n === null || n < 0) return '';
  const m = Math.floor(n / 60);
  const s = Math.round(n % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** 분 · 초 두 칸 → 초. 둘 다 비어 있으면 `null` (안 적은 것이다) */
export function toSeconds(min, sec) {
  const m = String(min ?? '').trim();
  const s = String(sec ?? '').trim();
  if (!m && !s) return null;
  const total = (Number(m) || 0) * 60 + (Number(s) || 0);
  return Number.isFinite(total) && total > 0 ? total : null;
}
