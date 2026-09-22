import { bodyPartOf } from './bodyPart';
import { MAP_PARTS } from './bodyHeat';

// 체형 읽기 — **01 단계: 사진 없이 「덜 한 곳」을 말한다** (2026-09-22).
//
// 계획은 `docs/SHAPE-READ-2026-09-19.md` 에 있다. 거기서 정한 차례의 첫 칸이다.
// 사진은 아직 안 쓴다. **있는 자료로 먼저 말이 되게 한다** — 사진이 없어도
// 쓸모가 있어야, 02 단계에서 사진이 붙을 때 얹을 자리가 생긴다.
//
// ── 무엇으로 「덜 했다」고 말하나 ──
//
// 세트 수는 **부위끼리 절대값으로 견줄 수 없다.** 하체 5세트와 팔 5세트는 같은
// 양이 아니다(`bodyHeat.js` 에 적어둔 판단을 여기서도 따른다). 그래서 둘을 겹쳐 본다.
//
//   1. 부위 사이   최근 8주 세트가 부위 중 꼴찌인가        ← 순위로만 쓴다
//   2. 자기 자신    최근 4주가 그 앞 4주보다 줄었나          ← 견줄 상대는 지난 달의 나
//
// **둘이 같은 곳을 가리킬 때만 단정한다.** 꼴찌라도 늘고 있으면 「적지만 늘고
// 있다」고만 적는다 — 가장 적은 부위는 누구에게나 반드시 하나 있고, 그것만으로
// 「덜 했다」고 하면 아무 말도 안 한 것이다.
//
// 인바디는 **셋째 목소리**다. 골격근이 어느 쪽으로 가는지가 같은 기간에 잡히면
// 「몸은 늘고 있는데 여기만 덜 했다」까지 말할 수 있다. 없으면 그 줄을 안 적는다.
//
// ── 안 하는 것 ──
//
// 점수 · 등급 · 「부족하다」 · 「정상/비정상」 · 또래 비교. 몸에 점수를 매기지
// 않는다. 근육량 · 체지방률을 여기서 지어내지 않는다 — 인바디 칸이 이미 갖고 있고,
// 우리가 아는 것은 **세트 수와 인바디 값뿐**이다. 줄마다 무엇이 근거인지 붙인다.

/** 여덟 주(오늘 포함). 넷씩 갈라 앞뒤로 견준다. */
export const WINDOW_DAYS = 56;
export const HALF_DAYS = 28;

/** 말을 시작할 만한 최소치. 이보다 적으면 **아무 말도 안 한다.** */
const MIN_SETS = 20;
const MIN_PARTS = 2;

/** 'YYYY-MM-DD' 에서 며칠 뒤로. */
function shiftBack(key, days) {
  const d = new Date(`${key}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() - days);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function daysApart(a, b) {
  if (!a || !b) return null;
  const ms = new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`);
  return Number.isFinite(ms) ? Math.round(ms / 86400000) : null;
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * 인바디에서 **같은 기간의 골격근 흐름**만 꺼낸다.
 *
 * 창(8주) 안에 값이 둘 이상 있어야 방향이 생긴다. 하나면 점 하나라 방향이 없고,
 * 창 밖의 것을 끌어오면 「8주 동안」이라 적고 실은 반년을 말하게 된다.
 * 그래서 **창 밖은 안 쓴다** — 없으면 그 줄을 안 적는 쪽을 고른다.
 */
export function muscleTrend(records, today, from) {
  const inWindow = (records || [])
    .filter((r) => r && r.date && r.date <= today && r.date >= from && num(r.muscle_kg) !== null)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (inWindow.length < 2) return null;

  const then = inWindow[0];
  const now = inWindow[inWindow.length - 1];
  const delta = Math.round((num(now.muscle_kg) - num(then.muscle_kg)) * 10) / 10;
  return {
    from: num(then.muscle_kg),
    to: num(now.muscle_kg),
    delta,
    days: daysApart(then.date, now.date),
    // 0.3kg 안쪽은 방향을 안 매긴다. 인바디는 그날 물만 마셔도 그만큼 흔들린다
    dir: delta >= 0.3 ? 'up' : delta <= -0.3 ? 'down' : 'flat',
  };
}

/**
 * 「덜 한 곳」 한 장.
 *
 * workouts 는 { 'YYYY-MM-DD': [기록, ...] } (workoutStore 와 같은 모양),
 * inbody 는 인바디 기록 배열, today 는 'YYYY-MM-DD'.
 *
 * 돌려주는 것:
 *   ready     말할 자료가 되나. false 면 화면은 lines 대신 `need` 를 낸다
 *   need      모자란 것 한 줄 (ready 가 false 일 때만)
 *   parts     부위별 { part, sets, recent, prev, delta, dir, share } — 적은 순
 *   least     8주 세트가 꼴찌인 부위 한 칸 (동률이면 최근 4주가 더 적은 쪽)
 *   verdict   'less' 단정 · 'rising' 적지만 늘고 있다 · null 아무 말 안 함
 *   muscle    같은 기간 골격근 흐름 (없으면 null)
 *   lines     [{ text, basis }] — basis 는 '기록' · '인바디' · '기록·인바디'
 */
export function buildShapeRead(workouts, inbody, today) {
  const from = today ? shiftBack(today, WINDOW_DAYS - 1) : null;
  const half = today ? shiftBack(today, HALF_DAYS - 1) : null;

  const byPart = {};
  MAP_PARTS.forEach((p) => {
    byPart[p] = { part: p, sets: 0, recent: 0, prev: 0, delta: 0, dir: 'flat', share: 0 };
  });

  Object.entries(workouts || {}).forEach(([date, list]) => {
    if (!date || !Array.isArray(list) || list.length === 0) return;
    // 앞날은 아직 한 것이 아니다. 달력에 미리 적어둔 것으로 「했다」가 되면 안 된다
    if (today && date > today) return;
    if (from && date < from) return;
    list.forEach((record) => {
      const slot = byPart[bodyPartOf(record?.exercise)];
      if (!slot) return;                      // '기타' — 어디를 셀지 모르는 것은 안 센다
      const sets = Number(record?.sets) || 0;
      slot.sets += sets;
      if (half && date >= half) slot.recent += sets; else slot.prev += sets;
    });
  });

  const total = MAP_PARTS.reduce((n, p) => n + byPart[p].sets, 0);
  MAP_PARTS.forEach((p) => {
    const s = byPart[p];
    s.delta = s.recent - s.prev;
    // 앞 넷째 주가 통째로 비어 있으면(시작한 지 얼마 안 됐다) 늘었다고 안 한다 —
    // 0 에서 늘어난 것은 「늘고 있다」가 아니라 **그냥 시작한 것**이다
    s.dir = s.prev === 0 ? 'new' : s.delta > 0 ? 'up' : s.delta < 0 ? 'down' : 'flat';
    s.share = total > 0 ? Math.round((s.sets / total) * 1000) / 10 : 0;
  });

  const parts = MAP_PARTS.map((p) => byPart[p]).sort((a, b) => {
    if (a.sets !== b.sets) return a.sets - b.sets;
    if (a.recent !== b.recent) return a.recent - b.recent;
    return MAP_PARTS.indexOf(a.part) - MAP_PARTS.indexOf(b.part);
  });

  const touched = MAP_PARTS.filter((p) => byPart[p].sets > 0).length;
  if (total < MIN_SETS || touched < MIN_PARTS) {
    return {
      ready: false,
      need: total === 0
        ? '아직 8주 안에 기록이 없어요. 몇 번 적히면 여기서 덜 한 곳을 말해줍니다.'
        : `기록이 조금 더 필요해요 (8주에 ${total}세트 · ${touched}부위).`,
      parts, least: null, verdict: null, muscle: null, lines: [],
      total, from, today,
    };
  }

  const least = parts[0];
  const muscle = muscleTrend(inbody, today, from);
  const lines = [];

  // 1. 부위 사이 — **순위로만 쓴다.** 세트 수 자체로 많고 적음을 말하지 않는다
  lines.push({
    basis: '기록',
    text: least.sets === 0
      ? `최근 8주에 ${least.part}는 한 번도 안 했어요.`
      : `최근 8주에 ${least.part}가 ${least.sets}세트로 부위 중 가장 적어요.`,
  });

  // 2. 자기 자신 — 견줄 상대는 지난 달의 나
  if (least.dir === 'down') {
    lines.push({ basis: '기록', text: `지난 4주에도 ${least.prev}→${least.recent}세트로 줄었어요.` });
  } else if (least.dir === 'up') {
    lines.push({ basis: '기록', text: `그래도 지난 4주엔 ${least.prev}→${least.recent}세트로 늘고 있어요.` });
  } else if (least.dir === 'new') {
    lines.push({ basis: '기록', text: `지난 4주에 ${least.recent}세트 — 앞 4주에는 없던 것이에요.` });
  } else {
    lines.push({ basis: '기록', text: `앞 4주와 지난 4주가 ${least.recent}세트로 같아요.` });
  }

  // 3. 인바디 — 같은 기간에 값이 둘 이상 있을 때만
  if (muscle) {
    const sign = muscle.delta > 0 ? '+' : '';
    lines.push({
      basis: '인바디',
      text: muscle.dir === 'flat'
        ? `같은 기간 골격근은 ${muscle.from}→${muscle.to}kg 으로 거의 그대로예요.`
        : `같은 기간 골격근은 ${muscle.days}일 동안 ${sign}${muscle.delta}kg 갔어요.`,
    });
  }

  // 4. 둘이 같은 곳을 가리킬 때만 단정한다
  let verdict = null;
  if (least.dir === 'up' || least.dir === 'new') {
    verdict = 'rising';
    lines.push({ basis: '기록', text: `${least.part}는 아직 적지만 늘고 있어요. 조금 더 두고 봐요.` });
  } else if (muscle && muscle.dir === 'up') {
    verdict = 'less';
    lines.push({ basis: '기록·인바디', text: `몸은 늘고 있는데 ${least.part}만 덜 했어요.` });
  } else {
    verdict = 'less';
    lines.push({ basis: '기록', text: `${least.part}가 덜 했어요.` });
  }

  // **가장 챙긴 곳**도 말한다. 「덜 한 곳」만 말하면 이 화면은 지적만 하는 자리가 된다 —
  // 9/19 에 「어디가 좋은지도」라고 한 것이 이것이다. 점수가 아니라 **순위**라서
  // 말할 수 있다(가장 많이 한 곳은 견줄 기준 없이도 자기 안에서 정해진다)
  const most = parts[parts.length - 1];

  return { ready: true, need: null, parts, least, most, verdict, muscle, lines, total, from, today };
}

// ── 03 단계: 사진 · 기록 · 인바디를 합친다 (2026-09-22) ──
//
// 9/19 에 정한 것: **셋이 같은 말을 할 때만 단정한다.** 사진만 그러고 기록은 아니면
// 「각도일 수 있어요」라고 적는다.
//
// 그런데 손대보니 **사진 한 장은 단정에 낄 수가 없었다.** 「어깨가 좁다」고 하려면
// 무엇과 견줘 좁은지가 있어야 하는데, 이 앱은 또래 · 이상적인 비율과 견주지 않기로
// 했다(그것이 말투 규칙의 첫 줄이다). 그래서 사진이 판단에 끼는 길은 하나뿐이다 —
// **지난 번의 나와 견주는 것.** 첫 장은 그 말을 할 수 없고, 못 한다고 적는다.
//
// 대신 사진이 **한 장으로도 말할 수 있는 것**이 있다: 좌우와 기울기다. 그건 바깥
// 기준이 아니라 **자기 몸 안에서** 재는 것이라 첫 장에도 말이 된다.

/** 비율이 이만큼 달라져야 「달라졌다」고 한다. 옷과 서 있는 자세가 그만큼 흔든다. */
const RATIO_SURE = 0.06;

/**
 * 셋을 합쳐 마지막 한 줄까지.
 *
 * read  `buildShapeRead` 가 준 것 (기록 · 인바디)
 * photo `buildRatios` 가 준 것 (오늘 사진) — 없으면 01 단계 그대로다
 * prev  지난 번 사진의 비율 — 없으면 사진은 숫자만 적고 판단에 안 낀다
 *
 * 돌려주는 것은 `{ lines, verdict, shoulderMove }` — 화면은 이것만 그린다.
 */
export function mergeShape(read, photo, prev) {
  const lines = [...(read?.lines || [])];
  if (!photo || !photo.ok) return { lines, verdict: read?.verdict || null, shoulderMove: null };

  // 사진이 오늘 처음이면 **견줄 것이 없다고 적는다.** 조용히 넘어가면 사진을
  // 올렸는데 아무 일도 안 일어난 것으로 보인다
  if (!prev || !prev.ok) {
    lines.push({
      basis: '사진',
      sure: false,
      text: '사진은 오늘이 처음이라 아직 견줄 것이 없어요. 다음에 같은 자리·같은 옷으로 찍으면 달라진 것을 말해줄 수 있어요.',
    });
    return { lines, verdict: read?.verdict || null, shoulderMove: null };
  }

  // ── 지난 번의 나와 견준다 ──
  let shoulderMove = null;
  if (photo.shoulderHip !== null && prev.shoulderHip !== null) {
    const d = Math.round((photo.shoulderHip - prev.shoulderHip) * 100) / 100;
    shoulderMove = Math.abs(d) < RATIO_SURE ? 'flat' : d > 0 ? 'up' : 'down';
    lines.push({
      basis: '사진',
      sure: photo.facing === 'front',
      text: shoulderMove === 'flat'
        ? `어깨:골반은 지난 번과 거의 같아요 (${prev.shoulderHip} → ${photo.shoulderHip}배).`
        : `어깨:골반이 ${prev.shoulderHip} → ${photo.shoulderHip}배로 ${d > 0 ? '넓어' : '좁아'}졌어요.`,
    });
  }

  // ── 셋이 같은 곳을 가리킬 때만 단정한다 ──
  //
  // 기록에서 어깨가 덜 했고, 사진에서도 어깨:골반이 줄었다면 그때는 단정한다.
  // 사진만 줄었고 기록은 아니면 **「각도일 수 있어요」**로 끝낸다
  let verdict = read?.verdict || null;
  const leastIsShoulder = read?.least?.part === '어깨';

  if (shoulderMove === 'down' && leastIsShoulder && read?.verdict === 'less') {
    verdict = 'sure';
    lines.push({ basis: '사진·기록', sure: true, text: '기록과 사진이 같은 곳을 가리켜요 — 어깨예요.' });
  } else if (shoulderMove === 'down' && !leastIsShoulder) {
    lines.push({
      basis: '사진',
      sure: false,
      text: '사진에서는 어깨가 좁아졌는데 기록은 그렇지 않아요. 각도일 수 있어요.',
    });
  }

  return { lines, verdict, shoulderMove };
}
