// **유산소가 쌓여온 길** (2026-11-09) — 주마다 들인 시간과 달린 거리.
//
// ── 왜 ──
//
// 11/05 에 유산소를 **시간·거리로** 적는 칸을 줬다(`data/cardio.js`). 그런데 적은
// 뒤에 **그것이 모이는 그림이 없었다** — 통계에는 운동 하나의 최고 무게(`liftTrend`)
// 와 부위 볼륨(`partVolume`)이 있고, 둘 다 머리글에 **「유산소는 뺐습니다」**라고
// 적어두고 있다. 매일 런닝머신만 걷는 사람에게 통계는 여전히 빈 화면이었다.
//
// ── 무엇을 그리나 ──
//
// 주마다 **시간(분)의 합**과 **거리(km)의 합**이다. 부위 볼륨과 같은 자로 센다 —
// 주는 월요일에 시작하고(`weekOf`), 창의 왼쪽 반쪽 주는 빼고(`firstFullWeek`),
// **이번 주는 선에 안 넣는다**(안 끝난 주는 늘 마지막이 꺾여 보인다).
// 그 셋을 **두 벌로 적지 않는다** — `partVolume` 에서 꺼내 쓴다.
//
// ── ★ 시간과 거리를 한 축에 겹치지 않는다 ──
//
// 「30분」과 「5.2km」를 한 그림에 올리면 거리 선은 바닥에 눌려 **평평해 보인다**.
// 단위가 다른 두 수를 한 축에 놓은 것이 11/05 에 오각형이 「체지방률 22」를 kg 으로
// 읽히게 한 그 모양이다. 그래서 **「시간 / 거리」 칩으로 갈라** 한 번에 하나만 그린다.
//
// ── 0 을 점으로 찍지 않는다 ──
//
// 안 한 주는 **점이 없다**(0분을 한 것이 아니다 — `LineChart` 가 칸을 끊는다).
// 거리 쪽은 한 걸음 더 간다: **런닝머신은 거리를 안 적어도 된다.** 40분만 적힌 주는
// 「0km 달린 주」가 아니므로 **거리 선에서는 그 주가 없다.** 그래서 걸러내는 자리를
// 자(metric)마다 따로 둔다 — 한 벌로 걸렀다가 시간만 적은 주가 거리 0 으로 찍히면,
// 열심히 걷고 온 사람에게 **바닥을 기는 선**을 보여주게 된다.
//
// 계산은 이 한 자리에 두고 화면(`components/CardioTrend.jsx`)은 그리기만 한다 —
// `npm run cardiotrend` 가 값으로 본다.
import { cardioOf, minuteLabel, kmLabel } from './cardio';
import { weekOf, firstFullWeek, weekLabel } from './partVolume';

/** 기간 칩 · 점 둘 — 위의 두 선과 **같은 것**이다 */
export { MIN_POINTS, SPANS } from './liftTrend';
export { weekLabel };

/**
 * 그릴 수 있는 두 자. `unit` 은 그림의 축에 적는 말이고, `sum` 은 주 안에서 더하는 값.
 *
 * **분과 km 를 같은 칸에 담지 않는다** — 위 머리글의 그 까닭이다.
 */
export const METRICS = [
  { key: 'min', label: '시간', unit: '분', series: '시간', fmt: (v) => minuteLabel(v) || `${v}분` },
  { key: 'km', label: '거리', unit: 'km', series: '거리', fmt: (v) => kmLabel(v) || `${v}km` },
];

/**
 * 주마다 유산소 시간·거리를 더한다.
 *
 * 한 주 안에 **값이 하나도 없는 자**는 `null` 로 남긴다 — 0 이 아니다.
 * (40분만 적은 주의 `km` 은 `null` 이고, 그 주는 거리 선에 **없다**)
 *
 * `days` 는 그 주에 **며칠 했나** — 선 아래 한 줄이 쓴다.
 * `rows` 는 이번 주를 뺀 것, `current` 는 이번 주 몫(없으면 null)이다.
 */
export function cardioTrend(workouts, { today = null, days = null } = {}) {
  const out = { rows: [], current: null };
  const thisWeek = today ? weekOf(today) : null;
  const from = today && days ? firstFullWeek(today, days) : null;

  const byWeek = new Map();
  for (const [date, list] of Object.entries(workouts || {})) {
    if (today && date > today) continue;          // **앞날 기록으로 선을 그리지 않는다**
    const wk = weekOf(date);
    if (!wk) continue;
    if (from && wk < from) continue;
    for (const r of list || []) {
      const { minutes, km } = cardioOf(r);
      if (minutes === null && km === null) continue;   // 유산소 줄이 아니다
      const slot = byWeek.get(wk) || { week: wk, min: null, km: null, dayset: new Set() };
      if (minutes !== null) slot.min = (slot.min || 0) + minutes;
      if (km !== null) slot.km = (slot.km || 0) + km;
      slot.dayset.add(date);
      byWeek.set(wk, slot);
    }
  }

  const list = [...byWeek.values()]
    .sort((a, b) => (a.week < b.week ? -1 : 1))
    .map((s) => ({
      week: s.week,
      // 소수 꼬리를 남기지 않는다 — 분은 정수로, km 은 10m 자리까지
      min: s.min === null ? null : Math.round(s.min),
      km: s.km === null ? null : Math.round(s.km * 100) / 100,
      days: s.dayset.size,
    }));

  out.rows = list.filter((s) => s.week !== thisWeek);
  out.current = list.find((s) => s.week === thisWeek) || null;
  return out;
}

/**
 * 한 자로 그릴 수 있는 주만 꺼낸다 — **그 자의 값이 있는 주**다.
 *
 * 이것이 이 파일의 핵심이다. 걸러내지 않으면 시간만 적은 주가 **거리 0** 으로 찍힌다.
 */
export function metricRows(rows, metric) {
  const key = metric === 'km' ? 'km' : 'min';
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => r && r[key] !== null && r[key] !== undefined)
    .map((r) => ({ week: r.week, value: r[key], days: r.days }));
}

/** 값이 둘 이상 있는 자만 칩으로 보여준다 (거리를 안 적는 사람에게 빈 칩을 주지 않는다) */
export function metricsWith(rows) {
  return METRICS.filter((m) => metricRows(rows, m.key).length > 0);
}

/**
 * 선을 한 줄로 읽어준다 — 「6개월 안 주 90분 → 150분 · +67%」.
 *
 * **올랐다고만 말하지 않는다** — 꺾였으면 꺾인 그대로 적는다(`volumeLine` 과 같은 선).
 * 세 배가 넘으면 「2.4배」로 적는다 — 「+900%」는 맞는 수인데도 고장처럼 읽힌다.
 */
export function cardioLine(rows, spanLabel, metric) {
  const m = METRICS.find((x) => x.key === metric) || METRICS[0];
  const list = metricRows(rows, m.key);
  if (list.length < 2) return null;
  const first = list[0].value;
  const last = list[list.length - 1].value;
  const head = `${spanLabel} 안 주 ${m.fmt(first)} → ${m.fmt(last)}`;
  if (!first) return { text: head, pct: null, dir: 0 };
  const pct = Math.round(((last - first) / first) * 100);
  if (pct === 0) return { text: `${head} · 그대로`, pct: 0, dir: 0 };
  const word = pct >= 300
    ? `${Math.round((last / first) * 10) / 10}배`
    : `${pct > 0 ? '+' : ''}${pct}%`;
  return { text: `${head} · ${word}`, pct, dir: pct > 0 ? 1 : -1 };
}

/** 가장 많이 한 주 (없으면 null) */
export function cardioPeak(rows, metric) {
  const list = metricRows(rows, metric === 'km' ? 'km' : 'min');
  if (!list.length) return null;
  let best = list[0];
  for (const r of list) if (r.value > best.value) best = r;
  return best;
}
