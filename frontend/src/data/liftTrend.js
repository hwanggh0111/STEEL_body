// **한 운동이 늘어온 길** (2026-11-03).
//
// ── 왜 ──
//
// 「기록 → 통계」가 보여주던 것은 **숫자 하나**였다 — 벤치프레스 92.5kg(최고 기록).
// 그런데 이 앱 홈페이지의 첫 줄이 **「무게는 늘었는데 무엇이 늘었는지는 아무도
// 안 알려준다」**다. 그 말의 운동 쪽 짝이 비어 있었다: **내 벤치가 반년 동안
// 어떻게 거기까지 왔는지**를 보여주는 자리가 없었다.
//
// 인바디는 그것을 이미 한다(체중 · 체지방 추이). 운동은 안 했다.
//
// ── 무엇을 그리나 ──
//
// **그 날 실제로 든 가장 무거운 무게**다. 1RM 으로 환산하지 않는다 —
// 환산은 **어림한 값**이고(`personalRecord.js` 의 「믿는 구간」 머리글),
// 이 앱은 **지어내지 않는다**는 약속을 적어뒀다. 최고 기록 카드가 1RM 으로 등수를
// 매기는 것과 다른 일이다: 거기는 **무엇이 제일 센 세트였나**를 고르는 자리고,
// 여기는 **무게가 어떻게 올라왔나**를 보여주는 자리다.
//
// **안 한 날은 점을 찍지 않는다.** 꺾은선이 그 칸을 끊는다(`LineChart` 가 그렇게
// 그린다) — 이어버리면 **안 한 날을 한 것처럼** 보여준다.
//
// **맨몸 운동은 선이 없다.** 무게가 없으니 그릴 값이 없다. 「푸시업이 늘었다」는
// 횟수로 말해야 하는데 그것은 다른 그림이다 — 섞어 그리면 둘 다 거짓이 된다.
// 그래서 **무게로 든 운동만** 고를 수 있게 한다.
//
// 계산은 여기 한 자리에 둔다. 화면은 그리기만 한다 — `npm run data` 가 값으로 본다.
import { parseWeight } from './personalRecord';

/** 그릴 수 있는 기간. 「길면 더 좋다」가 아니다 — 폰 폭에 점이 너무 많으면 뭉친다 */
export const SPANS = [
  { key: '3m', label: '3개월', days: 92 },
  { key: '6m', label: '6개월', days: 183 },
  { key: '1y', label: '1년', days: 366 },
];

/** 선을 그리려면 **점이 둘**은 있어야 한다. 하나면 「늘어온 길」이 아니다 */
export const MIN_POINTS = 2;

/** `today` 에서 `days` 일 전의 날짜 열쇠. 날짜 계산은 `Date` 에 맡긴다 */
function back(today, days) {
  const d = new Date(`${today}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() - days);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 그릴 수 있는 운동 이름들.
 *
 * **무게로 든 것**만, **서로 다른 날이 둘 이상**인 것만. 많이 한 순으로 준다 —
 * 고르는 줄의 맨 앞이 그 사람이 제일 자주 하는 운동이어야 한다.
 *
 * 앞날 기록은 안 센다 (`today` 를 주면 그 뒤를 버린다 — `bestRecords` 와 같은 규칙).
 */
export function liftNames(workouts, today = null, limit = 12) {
  const 날 = new Map();      // 이름 → Set(날짜)
  for (const [date, list] of Object.entries(workouts || {})) {
    if (today && date > today) continue;
    for (const w of list || []) {
      const name = (w?.exercise || '').trim();
      if (!name) continue;
      if (parseWeight(w?.weight) === null) continue;     // 맨몸 · 밴드는 선이 없다
      if (!날.has(name)) 날.set(name, new Set());
      날.get(name).add(date);
    }
  }
  return [...날.entries()]
    .filter(([, days]) => days.size >= MIN_POINTS)
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name]) => name);
}

/**
 * 한 운동의 날짜별 **최고 무게**.
 *
 * 돌려주는 것: `[{ date, kg }]` — **그 운동을 한 날만**, 날짜 오름차순.
 * 안 한 날은 아예 없다(0 을 넣지 않는다 — 0kg 을 든 것이 아니다).
 */
export function trendOf(workouts, exercise, { today = null, days = null } = {}) {
  const want = String(exercise || '').trim();
  if (!want) return [];
  const from = today && days ? back(today, days) : null;
  const top = new Map();
  for (const [date, list] of Object.entries(workouts || {})) {
    if (today && date > today) continue;
    if (from && date < from) continue;
    for (const w of list || []) {
      if ((w?.exercise || '').trim() !== want) continue;
      const kg = parseWeight(w?.weight);
      if (kg === null) continue;
      const cur = top.get(date);
      if (cur === undefined || kg > cur) top.set(date, kg);
    }
  }
  return [...top.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, kg]) => ({ date, kg }));
}

/**
 * 그 선을 한 줄로 읽어준다 — 「6개월 전 70kg → 92.5kg · +22.5」.
 *
 * **올랐다고만 말하지 않는다.** 꺾였으면 꺾인 그대로 적는다(「−5」) — 그래프가
 * 보여주는 것과 글이 다른 말을 하면 글을 믿지 않게 된다. 그대로면 「그대로」다.
 */
export function trendLine(points, spanLabel) {
  const rows = Array.isArray(points) ? points : [];
  if (rows.length < MIN_POINTS) return null;
  const first = rows[0];
  const last = rows[rows.length - 1];
  const diff = Math.round((last.kg - first.kg) * 10) / 10;
  const 몸 = `${spanLabel} 안 ${first.kg}kg → ${last.kg}kg`;
  if (diff === 0) return { text: `${몸} · 그대로`, diff, dir: 0 };
  return { text: `${몸} · ${diff > 0 ? '+' : ''}${diff}`, diff, dir: diff > 0 ? 1 : -1 };
}

/** 그 선에서 가장 무거웠던 날. 점을 하나 찍어 짚어준다 (없으면 `null`) */
export function peakOf(points) {
  const rows = Array.isArray(points) ? points : [];
  if (!rows.length) return null;
  let best = rows[0];
  for (const r of rows) if (r.kg > best.kg) best = r;
  return best;
}
