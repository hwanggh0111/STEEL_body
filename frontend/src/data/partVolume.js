// **한 부위가 늘어온 길** (2026-11-04, 시안의 E안).
//
// ── 왜 ──
//
// 11/03 에 「한 운동이 늘어온 길」을 붙였다(`data/liftTrend.js`) — 벤치프레스가
// 반년 동안 70kg → 92.5kg 으로 온 선이다. 그런데 그것은 **운동 하나**만 본다.
//
//   · 벤치를 쉬고 체스트 프레스를 했으면 **선이 끊긴 것처럼** 보인다
//   · 벤치는 올랐는데 **가슴을 덜 하게 된 것**인지는 그 선으로 모른다
//
// 몸 지도(`bodyHeat`)는 부위별로 **얼마나 식었나**를 보여주고, 통계는 운동 하나의
// **최고 무게**를 보여준다. 그 사이가 비어 있었다 — **한 부위가 얼마나 늘었나.**
//
// ── 무엇을 그리나 ──
//
// **주마다 그 부위에 들인 총량**이다 — 무게 × 세트 × 횟수를 한 주 안에서 더한다.
// 흔히 「볼륨」이라 부르는 그것이고, 기구를 바꿔도 이어진다(그게 이 그림의 값이다).
//
// **맨몸과 유산소는 선에서 뺀다.** 무게가 없는 것을 1kg 으로 치면 지어내는 셈이다
// (`liftTrend` 가 1RM 환산을 거절한 것과 같은 선: 이 앱은 지어내지 않는다).
// 푸시업 40회는 횟수로 말해야 하는데 그것은 다른 그림이다 — **뺐다고 화면이 말한다.**
//
// **주는 월요일에 시작한다** — 홈의 주간 달력 · 주간 요약 · 목표와 같다
// (`data/weeklyReport.js` 의 `mondayOf`). 두 벌로 세지 않는다.
//
// **이번 주는 선에 안 넣는다.** 아직 안 끝난 주를 점으로 찍으면 **늘 마지막이
// 꺾여 보인다** — 화요일에 보면 이틀치가 한 주와 견주어진다. 대신 그 수를 따로
// 돌려주고 화면이 한 줄로 말한다(「이번 주는 아직 안 끝났어요」).
//
// 부위를 알아내는 자는 **몸 지도와 같은 하나**다(`bodyPartOf`) — 어제 넣은 별명
// (벤프 · 푸쉬업 · 턱걸이)이 여기로 그대로 들어온다. 계산은 이 한 자리에 두고
// 화면은 그리기만 한다 — `npm run volume` 이 값으로 본다.
import { bodyPartOf } from './bodyPart';
import { MAP_PARTS } from './bodyHeat';
import { parseWeight } from './personalRecord';
import { mondayOf } from './weeklyReport';
import { dateKey } from './dateKey';

/** 그릴 수 있는 부위 — 몸 지도의 여섯과 **같은 것**이다('기타'는 자리가 없다) */
export { MAP_PARTS };

/** 선을 그리려면 **점이 둘**은 있어야 한다 — `liftTrend` 와 같은 선 */
export { MIN_POINTS, SPANS } from './liftTrend';

/** 'YYYY-MM-DD' → Date. **한낮으로 만든다** (`goal.js` 와 같은 까닭 — 서머타임) */
function at(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

/** 'YYYY-MM-DD' 꼴인가. **이것부터 보지 않으면** 빈 글자가 1900년이 된다 —
 *  `''.split('-')` 는 `['']` 이고 `Number('')` 는 0 이라, `new Date(0, -1, 1)` 이
 *  멀쩡한 날짜로 나온다(NaN 이 아니다). 그 주가 선 맨 앞에 점으로 찍힌다 */
const isDayKey = (v) => /^\d{4}-\d{2}-\d{2}/.test(String(v || ''));

/** 그 날이 든 주의 **월요일 날짜 열쇠**. 묶는 열쇠가 이것이다 */
export function weekOf(date) {
  if (!isDayKey(date)) return null;
  const d = at(date);
  if (Number.isNaN(d.getTime())) return null;
  return dateKey(mondayOf(d));
}

/** 창 안에 온전히 들어오는 **첫 월요일**. 반쪽 주를 빼는 자리다 */
function firstFullWeek(today, days) {
  const startKey = dateKey(new Date(at(today).getTime() - days * 86400000));
  const monday = weekOf(startKey);
  if (!monday) return null;
  if (monday >= startKey) return monday;          // 창이 월요일에 딱 걸렸다
  const next = new Date(at(monday).getTime() + 7 * 86400000);
  return dateKey(next);
}

/** 한 줄의 볼륨 (kg). 무게가 없으면 null — **셀 수 없는 것은 안 센다** */
export function volumeOf(record) {
  const kg = parseWeight(record?.weight);
  if (kg === null) return null;
  const sets = Number(record?.sets);
  const reps = Number(record?.reps);
  if (!Number.isFinite(sets) || !Number.isFinite(reps)) return null;
  if (sets <= 0 || reps <= 0) return null;
  return kg * sets * reps;
}

/**
 * 그릴 수 있는 부위들 — **무게로 든 줄이 둘 이상의 주에** 있는 것만.
 *
 * 많이 한 순이 아니라 **몸 지도와 같은 차례**(가슴 · 등 · 어깨 · 하체 · 팔 · 코어)로
 * 준다. 고르는 줄의 차례가 지도와 다르면 같은 몸을 두 차례로 외우게 된다.
 */
export function volumeParts(workouts, today = null) {
  const weeks = new Map();        // 부위 → Set(주)
  for (const [date, list] of Object.entries(workouts || {})) {
    if (today && date > today) continue;          // 앞날은 아직 한 것이 아니다
    const wk = weekOf(date);
    if (!wk) continue;
    for (const r of list || []) {
      if (volumeOf(r) === null) continue;         // 맨몸 · 유산소는 선이 없다
      const part = bodyPartOf(r?.exercise);
      if (!MAP_PARTS.includes(part)) continue;    // '기타'는 지도에 자리가 없다
      if (!weeks.has(part)) weeks.set(part, new Set());
      weeks.get(part).add(wk);
    }
  }
  return MAP_PARTS.filter((p) => (weeks.get(p)?.size ?? 0) >= 2);
}

/**
 * 한 부위의 **주별 총 볼륨**.
 *
 * 돌려주는 것 —
 *   rows    `[{ week, kg, days }]` — 그 부위를 한 주만, 주 오름차순
 *   current `{ week, kg, days }` 또는 null — **이번 주**(선에 안 넣은 것)
 *
 * 안 한 주는 **점을 찍지 않는다**(0 을 넣지 않는다 — 0kg 을 든 것이 아니다).
 * `LineChart` 가 그 칸을 끊는다 — 이어버리면 안 한 주를 한 것처럼 보여준다.
 */
export function volumeTrend(workouts, part, { today = null, days = null } = {}) {
  const want = String(part || '').trim();
  const out = { rows: [], current: null };
  if (!want) return out;

  const thisWeek = today ? weekOf(today) : null;
  // ── **반쪽 주는 선에 넣지 않는다** ──
  //
  // 이번 주를 뺀 것과 같은 까닭이다(머리글). 기간의 **왼쪽 끝**도 주 가운데를 자른다 —
  // 「6개월」로 보면 맨 앞 주가 사흘치일 수 있고, 그 점은 **덜 한 주처럼** 보인다.
  // 그래서 창 안에 **온전히 들어오는 첫 월요일**부터 센다
  const from = today && days ? firstFullWeek(today, days) : null;

  const byWeek = new Map();
  for (const [date, list] of Object.entries(workouts || {})) {
    if (today && date > today) continue;
    const wk = weekOf(date);
    if (!wk) continue;
    if (from && wk < from) continue;
    for (const r of list || []) {
      const vol = volumeOf(r);
      if (vol === null) continue;
      if (bodyPartOf(r?.exercise) !== want) continue;
      const slot = byWeek.get(wk) || { week: wk, kg: 0, days: new Set() };
      slot.kg += vol;
      slot.days.add(date);
      byWeek.set(wk, slot);
    }
  }

  const list = [...byWeek.values()]
    .sort((a, b) => (a.week < b.week ? -1 : 1))
    // 소수 꼬리를 남기지 않는다 — 수만 kg 에 0.0000001 이 붙으면 축이 지저분해진다
    .map((s) => ({ week: s.week, kg: Math.round(s.kg), days: s.days.size }));

  out.rows = list.filter((s) => s.week !== thisWeek);
  out.current = list.find((s) => s.week === thisWeek) || null;
  return out;
}

/**
 * 그 선을 한 줄로 읽어준다 — 「6개월 안 주 12,400kg → 18,900kg · +52%」.
 *
 * **올랐다고만 말하지 않는다.** 꺾였으면 꺾인 그대로 적는다 — 그래프가 보여주는
 * 것과 글이 다른 말을 하면 글을 안 믿게 된다 (`liftTrend.trendLine` 과 같은 선).
 *
 * 볼륨은 수가 커서 **퍼센트로** 말한다(12,400 → 18,900 은 「+6,500」보다 「+52%」가
 * 읽힌다). 처음이 0 일 수는 없다 — 0 인 주는 점이 아니다.
 */
export function volumeLine(rows, spanLabel) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length < 2) return null;
  const first = list[0];
  const last = list[list.length - 1];
  const head = `${spanLabel} 안 주 ${first.kg.toLocaleString()}kg → ${last.kg.toLocaleString()}kg`;
  if (!first.kg) return { text: head, pct: null, dir: 0 };
  const pct = Math.round(((last.kg - first.kg) / first.kg) * 100);
  if (pct === 0) return { text: `${head} · 그대로`, pct: 0, dir: 0 };
  return { text: `${head} · ${pct > 0 ? '+' : ''}${pct}%`, pct, dir: pct > 0 ? 1 : -1 };
}

/** 가장 많이 들인 주. 점을 하나 찍어 짚어준다 (없으면 null) */
export function volumePeak(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return null;
  let best = list[0];
  for (const r of list) if (r.kg > best.kg) best = r;
  return best;
}

/** '2026-11-03' → '11월 3일 주'. 선 아래에 적는 말이다 */
export function weekLabel(week) {
  const d = at(week);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}월 ${d.getDate()}일 주`;
}
