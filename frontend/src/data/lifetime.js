import { volumeOf } from './weeklyReport';

// 평생 누적 — **지금까지 들어올린 것 전부** (2026-11-16).
//
// ── 1월 1일에 0 으로 돌아갔다 ──
//
// 결산은 「오늘 12,480kg」을 말하고(`sessionSummary`), 기록의 벽은 **한 해**를 새긴다
// (`yearWall`). 그 둘뿐이라, 2년 쓴 사람이 1월 2일에 앱을 열면 **자기가 쌓은 것의
// 절반이 화면에서 사라진다.** 가장 오래 쓴 사람에게 가장 할 말이 없던 자리다.
//
// 재료는 전부 이미 있다 — 날짜별 기록과 `volumeOf` 하나다. 서버 칸을 안 늘린다.
//
// ── 톤으로 접는다 ──
//
// kg 으로 일곱 자리를 적으면(1,284,000kg) 아무도 안 읽는다. 다만 **접는 자리는
// 수에 따라 갈린다** — 1,500kg 을 「2톤」이라고 적으면 3분의 1이 지어낸 수가 된다.
// 그래서 열 톤 미만은 소수 한 자리를 남기고(1.5톤), 1톤 미만은 **kg 그대로** 둔다.
// 「0톤」을 크게 띄우는 일은 없다.
//
// ── 맨몸 · 유산소만 한 사람에게 0 을 띄우지 않는다 ──
//
// `volumeOf` 는 무게를 안 적은 세트를 못 센다(그 사람의 체중을 모른다). 풀업과
// 플랭크만 하는 사람의 누적은 그래서 0kg 인데, **0 을 크게 띄우면 열심히 한 사람에게
// 아무것도 아니라고 말하는 셈**이다. 결산이 이미 그렇게 갈라놨다 — 그 선을 그대로
// 따라 **세트 수**로 센다(`sessionSummary.js` 머리글).
//
// ── 「가져온 것 포함」은 적지 않는다 ── (주인 결정 자리였다)
//
// CSV 로 넣은 줄과 손으로 적은 줄은 **구분할 수 있는 값이 없다** — 가져오기는 기록을
// 그대로 넣을 뿐이고(`ImportCsv`), 어느 줄이 파일에서 왔는지 아무 데도 안 적힌다.
// 그러니 「가져온 것 포함」이라고 적으면 **우리가 아는 것처럼 말하는 것**이 된다.
// 큰 수 밑에 **첫 기록 날짜**를 적는 쪽을 고른다 — 20,000줄을 한 번에 올린 사람은
// 그 날짜를 보고 「아, 그때 넣은 거」를 스스로 안다. 지어내지 않고 말하는 길이다.
//
// 이 파일은 화면을 모른다 — 날짜별 기록과 오늘 하나만 받는다.

/** 1톤부터 톤으로 접는다. 그 아래는 kg 그대로. */
export const TON_FROM_KG = 1000;
/** 열 톤부터는 소수를 버린다 — 1,284.6톤을 적을 일이 없다. */
export const TON_ROUND_FROM = 10;

/**
 * 첫 기록부터 오늘까지 전부.
 *
 * workouts 는 { 'YYYY-MM-DD': [기록, ...] } (workoutStore 와 같다). today 는 'YYYY-MM-DD'.
 *
 * **앞날은 안 센다** — 달력에서 내일 할 것을 미리 적어두는 사람이 있고, 그 줄을
 * 누적에 넣으면 **아직 들지 않은 무게**가 톤에 들어간다 (11/09 에 기록의 벽에서
 * 쓸어낸 그 줄이다 · `yearWall.buildYear`).
 *
 * 돌려주는 것:
 *   kg, tons        들어올린 무게 (tons 는 접은 값)
 *   unit, value     화면이 **크게 적을 하나** — 'ton' · 'kg' · 'set'
 *   sets, rows      세트 수 · 기록 줄 수
 *   bodyweightSets  무게를 안 적은 세트 (톤에 안 든 것)
 *   days, first     운동한 날 · 첫 기록 날짜
 *   any             셀 것이 하나라도 있나 — 없으면 화면은 이 칸을 안 그린다
 */
export function buildLifetime(workouts, today) {
  let kg = 0;
  let sets = 0;
  let rows = 0;
  let bodyweightSets = 0;
  let days = 0;
  let first = null;

  Object.entries(workouts || {}).forEach(([date, list]) => {
    if (!date || !Array.isArray(list) || list.length === 0) return;
    if (today && date > today) return;            // 앞날은 아직 든 것이 아니다
    const v = volumeOf(list);
    kg += v.kg;
    bodyweightSets += v.bodyweightSets;
    sets += list.reduce((n, w) => n + (Number(w?.sets) || 0), 0);
    rows += list.length;
    days += 1;
    if (!first || date < first) first = date;
  });

  kg = Math.round(kg);
  // 열 톤 아래는 소수 한 자리를 남긴다 — 1,500kg 을 「2톤」으로 적지 않는다
  const raw = kg / 1000;
  const tons = raw >= TON_ROUND_FROM ? Math.round(raw) : Number(raw.toFixed(1));

  // 크게 적을 수 **하나**. 여러 개를 크게 적으면 무엇을 봐야 할지 모르게 된다
  let unit = 'set';
  let value = sets;
  if (kg >= TON_FROM_KG) { unit = 'ton'; value = tons; }
  else if (kg > 0) { unit = 'kg'; value = kg; }

  return {
    kg,
    tons,
    unit,
    value,
    sets,
    rows,
    bodyweightSets,
    days,
    first,
    any: days > 0 && (kg > 0 || sets > 0),
  };
}
