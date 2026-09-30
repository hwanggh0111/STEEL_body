import { MAP_PARTS } from './bodyHeat';

// 아픈 곳 — **사람이 적은 것만 쓴다** (2026-09-30).
//
// 이 앱은 진단하지 않는다. 그런데 「어깨가 아프다」는 **그 사람이 적은 사실**이라 쓸 수
// 있다. 적어두면 그 부위를 **권하지 않는다.**
//
// ── 안 하는 것 ──
//
// 1. **낫는 기간을 말하지 않는다.** 「2주면 낫습니다」는 우리가 알 수 없는 것이다.
// 2. **병명도 원인도 짐작하지 않는다.** 마이크도 카메라도 모르는 일이고, 여기는
//    글자 몇 개만 들고 있다.
// 3. **아픔에 점수를 매기지 않는다.** 「통증 7」은 짐작을 숫자로 적는 것이다
//    (`shapeRead.js` · `repCount.js` 에 적어둔 선과 같다). 여기서 세는 것은 **날수**다.
// 4. **기록을 막지 않는다.** 아픈데도 하겠다면 그건 그 사람의 일이다 — 권하지 않을 뿐이다.
//    막으면 사람은 아픔을 안 적게 되고, 그러면 이 기능이 아무것도 모르게 된다.
//
// 이 파일은 화면도 저장소도 모른다. 목록과 날짜만 받는다 — `npm run sore` 가 값으로 본다.

/** 이만큼 지나면 「아직 아프신가요」를 묻는다. **묻기만 하고 안 지운다.** */
export const ASK_AGAIN_DAYS = 14;

/** 몇 칸까지. 부위가 여섯이라 그보다 많을 수가 없다. */
export const SORE_MAX = MAP_PARTS.length;

/** 'YYYY-MM-DD' 두 개 사이의 날수. 못 읽으면 `null`. */
export function daysApart(a, b) {
  if (!a || !b) return null;
  const ms = new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`);
  return Number.isFinite(ms) ? Math.round(ms / 86400000) : null;
}

const isPart = (p) => MAP_PARTS.includes(p);
const isDay = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

/** 담긴 것에서 쓸 수 있는 칸만. 깨진 것은 없는 것으로 본다. */
export function cleanSore(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : []).filter((e) => {
    if (!e || !isPart(e.part) || !isDay(e.date)) return false;
    if (seen.has(e.part)) return false;      // 한 부위는 한 칸이다
    seen.add(e.part);
    return true;
  }).map((e) => ({ part: e.part, date: e.date }));
}

/**
 * 아픔을 적는다.
 *
 * **이미 적혀 있으면 날짜를 덮지 않는다.** 덮으면 며칠째가 그때마다 1일로 돌아가고,
 * 「오래됐다」를 알 길이 없어진다 — 이 기능이 세는 것이 그 날수 하나다.
 *
 * 앞날은 안 받는다. 달력에서 앞날을 골라 적으면 「-3일째」가 된다.
 */
export function addSore(list, part, today) {
  const rows = cleanSore(list);
  if (!isPart(part) || !isDay(today)) return rows;
  if (rows.some((e) => e.part === part)) return rows;
  return [...rows, { part, date: today }].slice(-SORE_MAX);
}

/** 아픔을 지운다. 지우면 그 자리에서 되돌아간다 — 낫는 것을 우리가 정하지 않는다. */
export function removeSore(list, part) {
  return cleanSore(list).filter((e) => e.part !== part);
}

/** 그 부위가 아프다고 적혀 있나. */
export function isSore(list, part) {
  return cleanSore(list).some((e) => e.part === part);
}

/**
 * 화면에 낼 목록. **오래 아픈 것이 위로** 온다.
 *
 * `days` 는 적은 날을 1일째로 센다 — 오늘 적었으면 「1일째」다. 0일째라고 적으면
 * 사람은 안 적힌 것으로 읽는다.
 */
export function soreList(list, today) {
  return cleanSore(list)
    .map((e) => {
      const gone = daysApart(e.date, today);
      return {
        part: e.part,
        date: e.date,
        days: gone === null ? null : Math.max(1, gone + 1),
        ask: gone !== null && gone >= ASK_AGAIN_DAYS,
      };
    })
    .sort((a, b) => (b.days ?? 0) - (a.days ?? 0) || MAP_PARTS.indexOf(a.part) - MAP_PARTS.indexOf(b.part));
}

/** 한 칸을 말로. 「어깨 · 4일째」 */
export function soreLine(row) {
  if (!row) return null;
  if (row.days === null) return `${row.part} · 언제 적었는지 모르겠어요`;
  return `${row.part} · ${row.days}일째`;
}

/** 오래된 칸에 물을 말. 없으면 `null`. **묻기만 한다.** */
export function askLine(row) {
  if (!row || !row.ask) return null;
  return `${row.days}일째예요. 아직 아프신가요? 나았으면 지워주세요 — 저는 알 수 없어요.`;
}

/**
 * 오늘 무엇을 권할까. **아픈 곳을 뺀 것 중에서 가장 식은 곳** 둘까지.
 *
 * heat 는 `buildHeat` 가 준 것(`list` 가 식은 순이다). 아픈 곳만 빼고 그 차례를
 * 그대로 쓴다 — 식은 순을 여기서 다시 매기면 몸 지도와 다른 말을 하게 된다.
 *
 * 돌려주는 것: `{ picks, skipped }` — `picks` 는 권할 부위 이름들, `skipped` 는 뺀 것들.
 * **뺀 것을 같이 준다**: 왜 어깨가 안 보이는지 화면이 말해야 한다.
 */
export function restAdvice(list, heat, limit = 2) {
  const sore = cleanSore(list).map((e) => e.part);
  const order = (heat?.list || []).map((s) => s.part).filter((p) => MAP_PARTS.includes(p));
  const pool = order.length ? order : MAP_PARTS;
  const picks = pool.filter((p) => !sore.includes(p)).slice(0, limit);
  return { picks, skipped: pool.filter((p) => sore.includes(p)) };
}

/** 권하는 한 줄. 권할 것이 없으면 그것도 사실대로 말한다. */
export function adviceLine(advice) {
  if (!advice) return null;
  const { picks, skipped } = advice;
  if (picks.length === 0) return '여섯 부위가 다 아프다고 적혀 있어요. 오늘은 쉬는 것도 운동이에요.';
  const head = `${picks.join(' · ')}를 권해요`;
  return skipped.length ? `${head} — ${skipped.join(' · ')}는 빼뒀어요.` : head;
}
