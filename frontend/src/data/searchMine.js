// ── 찾기에서 내 기록도 · 이름이 갈린 운동 ── (2026-11-12, 시안 1112 C · D)
//
// 운동 찾기는 **사전만** 보여줬다. 그 사람이 스물세 번 한 데드리프트도 사전의 한
// 줄과 똑같이 나왔다 — 「마지막에 언제 · 얼마나」는 기록 화면으로 가야 알았다.
//
// ── C · 내 기록에서 ──
//
//   · 「23일」은 **날 수**다 — 줄 수를 세면 한 판에 다섯 줄 적는 사람이 부풀려진다
//   · 앞날 줄은 안 센다(아직 한 것이 아니다)
//   · 최고는 `bestRecords` 와 같은 자 — 무게가 있으면 「140kg × 3회」, 맨몸만이면 「25회」
//   · **많아야 둘** — 자판이 올라오면 화면이 반쯤 남는다. 사전 결과를 밀어내지 않는다
//   · 맞는 것이 없으면 칸을 아예 안 그린다(부르는 쪽이 `[]` 를 보고 안 그린다)
//
// ── D · 이름이 갈린 운동 ── (C 의 그 줄에 딸린 한 줄)
//
// 이름 열쇠가 앞뒤 공백만 걷는다(`personalRecord.js` · `lastSets.js`). 그래서 「벤치프레스」와
// 「벤치 프레스」는 **따로 센다** — 최고 기록도 · 다음 한 걸음도 따로다. 합치는 것은
// 서버 일괄 변경이라 이 시안에 없다. **알려주기만** 한다.
//
//   · 띄어쓰기 · 대소문자만 다른 것만 묶는다
//   · **사전에 둘 다 따로 있으면 진짜 다른 운동**이다 — 안 묶는다
//   · 줄 하나에 D 는 하나 — 갈린 이름이 둘 이상이면 「다른 이름 2개로도 6일」
//   · 「최대 둘」에 D 는 안 센다(그 줄의 딸린 줄이다). 묶인 이름은 따로 줄로 안 나온다
import { bestRecords } from './personalRecord';
import { hasExercise, searchExercises } from './exerciseDict';

export const MINE_MAX = 2;

const loose = (s) => String(s ?? '').replace(/\s+/g, '').toLowerCase();

// ── **셈은 기록이 바뀔 때 한 번, 거르기는 칠 때마다** ── (2026-11-12)
//
// 처음에는 칠 때마다 기록 전체를 훑고 최고 기록 표(`bestRecords`)까지 새로 셌다.
// 5년치면 3만 줄이고 그 표만 17ms 다(`TrainPage` 머리글) — **한 글자마다** 그것을 했다.
// 이름별로 묶는 것까지는 친 말과 상관이 없다. 그래서 갈랐다 —
//
//   `mineIndex(workouts, today)`  이름 무리 · 날 · 최고를 미리 세 둔다 (화면이 `useMemo`)
//   `mineQuery(index, query)`     친 말로 거르기만 한다 (무리 수만큼만 돈다)

/**
 * @param {Record<string, Array<object>>} workouts  날짜 → 그날 줄
 * @param {string|null} today  `YYYY-MM-DD`
 * @returns {Array<{ name: string, days: number, lastDate: string, looseNames: string[], names: string[],
 *   best: null | { kind: 'weighted'|'bodyweight', kg: number|null, reps: number },
 *   split: null | { names: string[], days: number, lastDate: string } }>}
 */
export function mineIndex(workouts, today = null) {
  // 이름마다 날 · 마지막 날
  const byName = new Map();
  for (const [date, list] of Object.entries(workouts || {})) {
    if (!date || (today && date > today)) continue;
    for (const w of list || []) {
      const name = String(w?.exercise ?? '').trim();
      if (!name) continue;
      let e = byName.get(name);
      if (!e) { e = { name, dates: new Set(), lastDate: '' }; byName.set(name, e); }
      e.dates.add(date);
      if (date > e.lastDate) e.lastDate = date;
    }
  }
  if (!byName.size) return [];

  // 띄어쓰기만 다른 이름끼리 묶는다. 사전에 따로 있는 이름은 제 무리를 따로 이룬다
  const groups = new Map();
  for (const e of byName.values()) {
    const key = loose(e.name) + (hasExercise(e.name) ? `::${e.name}` : '');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  // 사전에 있는 이름과 띄어쓰기만 다른 **사전에 없는** 이름은 그 사전 이름의 무리로 간다.
  // 사전 이름의 무리를 열쇠의 앞부분으로 한 번에 찾는다 (무리마다 전부를 훑지 않는다)
  const homesOf = new Map();
  for (const k of groups.keys()) {
    const i = k.indexOf('::');
    if (i < 0) continue;
    const head = k.slice(0, i);
    homesOf.set(head, [...(homesOf.get(head) || []), k]);
  }
  for (const [key, members] of [...groups]) {
    if (key.includes('::')) continue;
    const homes = homesOf.get(key) || [];
    if (homes.length === 1) { groups.get(homes[0]).push(...members); groups.delete(key); }
  }

  const best = bestRecords(workouts, today);
  // `bestRecords` 는 `이름::종류` → 최고 줄의 Map 이다 (운동 화면이 쓰는 그 표)
  const bestOf = (name) => {
    const w = best.get(`${name}::weighted`);
    if (w) return { kind: 'weighted', kg: w.kg, reps: w.reps };
    const b = best.get(`${name}::bodyweight`);
    return b && b.reps > 0 ? { kind: 'bodyweight', kg: null, reps: b.reps } : null;
  };

  const rows = [];
  for (const members of groups.values()) {
    // 대표 이름 — 날이 많은 쪽(같으면 사전에 있는 쪽, 그다음 최근)
    const sorted = [...members].sort((a, b) => (b.dates.size - a.dates.size)
      || (Number(hasExercise(b.name)) - Number(hasExercise(a.name)))
      || (a.lastDate < b.lastDate ? 1 : -1));
    const [main, ...rest] = sorted;
    const restDates = new Set(rest.flatMap((r) => [...r.dates]));
    rows.push({
      name: main.name,
      days: main.dates.size,
      lastDate: main.lastDate,
      names: members.map((m) => m.name),
      looseNames: members.map((m) => loose(m.name)),
      best: bestOf(main.name),
      split: rest.length ? {
        names: rest.map((r) => r.name),
        days: restDates.size,
        lastDate: rest.reduce((m, r) => (r.lastDate > m ? r.lastDate : m), ''),
      } : null,
    });
  }
  // 많이 한 것이 위 — 같으면 최근이 위. **미리 세워 두면** 거를 때 다시 안 세운다
  rows.sort((a, b) => (b.days - a.days) || (a.lastDate < b.lastDate ? 1 : -1));
  return rows;
}

/**
 * 친 말에 맞는 무리를 많아야 `MINE_MAX` 개. 글자로 맞거나(띄어쓰기 · 대소문자 무시)
 * 사전 찾기가 고른 이름이면 맞는다(초성 · 영어로 친 사람도 제 기록을 본다)
 */
export function mineQuery(index, query) {
  const q = loose(query);
  if (!q || !index?.length) return [];
  const dictHits = new Set(searchExercises(query).map((e) => e.ko));
  const out = [];
  for (const r of index) {
    if (r.looseNames.some((n) => n.includes(q)) || r.names.some((n) => dictHits.has(n))) {
      const { names, looseNames, ...row } = r;
      out.push(row);
      if (out.length >= MINE_MAX) break;
    }
  }
  return out;
}

/** 한 번에 — 검사와 한 번 쓰는 자리용. 화면은 `mineIndex` 를 `useMemo` 로 들고 `mineQuery` 를 부른다 */
export const mineFor = (workouts, query, today = null) => mineQuery(mineIndex(workouts, today), query);
