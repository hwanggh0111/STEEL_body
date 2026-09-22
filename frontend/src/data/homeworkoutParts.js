import { MAP_PARTS } from './bodyHeat';

// 홈트 한 판이 **몸의 어디를 채우나** (2026-09-22).
//
// ── 왜 이름으로 안 맞히나 ──
//
// 부위를 맞히는 `bodyPartOf()` 가 이미 있다(몸 지도가 쓴다). 홈트 52개에 돌려보니
// **19개(37%)를 못 맞히고, 맞힌 것도 틀렸다** — 「노르딕 컬」을 **팔**이라 하고
// (「컬」을 이두로 읽는다), 「싱글 레그 카프레이즈」를 **어깨**라 한다(「레이즈」).
//
// 기구 이름은 규칙적이라 그 방식이 통한다(`랫풀다운` · `레그프레스`). **맨몸 동작은
// 그렇지 않다.** 그래서 `homeworkoutPrograms.js` 의 줄마다 부위를 **직접 적었다.**
//
// ── 왜 둘로 나누나 ──
//
// 맨몸은 한 부위가 아니다. 베어 크롤은 어깨와 코어로 몸을 들고 하체로 민다.
// 주 부위 하나만 칠하면 거짓말이고, 쓰는 곳을 다 칠하면 **온몸이 노래져서** 아무 말도
// 안 한 것이 된다. 그래서 `main`(주로 쓰는 곳)과 `sub`(곁들여)로 나눠 적고,
// 여기서 **무게를 다르게 센다.**
//
// 이 파일은 화면을 모른다 — 검사가 값으로 본다(`npm run homeparts`).

/** 곁들여 쓰는 곳은 **절반으로 센다.** 같이 세면 곁들인 것이 주된 것을 이긴다. */
export const SUB_WEIGHT = 0.5;

/** 몸 지도에 자리가 있는 부위인가. 오타 하나가 조용히 사라지는 것을 막는다. */
export function isMapPart(part) {
  return MAP_PARTS.includes(part);
}

/**
 * 동작 하나가 쓰는 곳.
 *
 * 적어둔 것이 없으면 **빈 것을 준다** — 지어내지 않는다. 화면은 그 동작에
 * 아무 부위도 안 그린다(적는 것을 잊은 자리가 그대로 보여야 검사가 잡는다).
 */
export function partsOf(exercise) {
  const main = (exercise?.main || []).filter(isMapPart);
  const sub = (exercise?.sub || []).filter(isMapPart);
  return { main, sub };
}

/**
 * 판을 **여기까지 했을 때** 부위별로 얼마나 쌓였나.
 *
 * list  프로그램의 동작 배열
 * done  몇 개를 끝냈나 (0 이면 아직 아무것도 안 한 것)
 *
 * 돌려주는 것:
 *   byPart   부위 → { part, main, sub, score } — main 은 주로 쓴 횟수, sub 는 곁들인 횟수
 *   order    많이 쌓인 순 (같으면 몸 지도와 같은 차례)
 *   max      제일 큰 score (막대를 그릴 기준 — **부위끼리만 견준다**)
 *   touched  한 번이라도 건드린 부위 이름들
 *   untouched 이 판에서 **한 번도 안 건드린** 부위들. 화면은 여기를 칠하지 않고
 *             점선으로만 두른다 (몸 지도가 식은 곳에 쓰는 그 규칙)
 *   done     실제로 센 동작 수
 */
export function buildPump(list, done) {
  const rows = Array.isArray(list) ? list : [];
  // 앞서 간 것만 센다. **아직 안 한 동작으로 몸이 채워지면 그림이 거짓말을 한다** —
  // 몸 지도가 앞날 기록을 안 세는 것과 같은 이유다
  const upto = Math.max(0, Math.min(rows.length, Number(done) || 0));

  const byPart = {};
  MAP_PARTS.forEach((p) => { byPart[p] = { part: p, main: 0, sub: 0, score: 0 }; });

  for (let i = 0; i < upto; i += 1) {
    const { main, sub } = partsOf(rows[i]);
    main.forEach((p) => { byPart[p].main += 1; byPart[p].score += 1; });
    sub.forEach((p) => { byPart[p].sub += 1; byPart[p].score += SUB_WEIGHT; });
  }

  const order = MAP_PARTS.map((p) => byPart[p]).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return MAP_PARTS.indexOf(a.part) - MAP_PARTS.indexOf(b.part);
  });

  const touched = MAP_PARTS.filter((p) => byPart[p].score > 0);
  return {
    byPart,
    order,
    max: order.length ? order[0].score : 0,
    touched,
    untouched: MAP_PARTS.filter((p) => byPart[p].score === 0),
    done: upto,
  };
}

/**
 * 판 전체가 **어디를 채우는 판인가** (고르기 전에 보는 것).
 *
 * `buildPump` 에 전부를 넘긴 것과 같다. 이름을 따로 두는 것은 부르는 자리에서
 * 「여기까지」와 「전부」가 헷갈리지 않게 하려는 것뿐이다.
 */
export function programPump(list) {
  return buildPump(list, (list || []).length);
}

/**
 * 몸 지도(`bodyHeat`)가 읽을 수 있는 줄로 바꾼다.
 *
 * 홈트는 여태 **몸 지도와 따로 놀았다.** 판을 다 해도 지도는 아무것도 몰랐다 —
 * 「기능성운동 - 기능성(특수부대식)」 한 줄로 넘어갔고, 지도는 그 이름을 못 읽어
 * **'기타'** 로 봤다(어느 부위도 안 칠해진다).
 *
 * ── 왜 **부위별로 묶나** ──
 *
 * 동작마다 한 줄이면 판 하나에 열두 줄이 쌓인다. 기록 화면은 그날 한 것을 읽는
 * 자리인데, 열두 줄이 들어오면 헬스장에서 적은 서너 줄이 묻힌다.
 * 그래서 **부위로 묶는다** — 「기능성(특수부대식) · 하체」 5세트처럼.
 * 지도는 이름 끝의 부위를 읽는다(`bodyPart.js` 의 `taggedPart`).
 *
 * ── 왜 **주로 쓴 곳만** 세나 ──
 *
 * 곁들여 쓴 것까지 「했다」고 적으면, 베어 크롤 한 번으로 하체까지 한 것이 된다.
 * 지도는 「마지막으로 언제 건드렸나」를 말하는 자리다 — 곁들인 것으로 부위가
 * 달아오르면 **오늘 할 곳을 잘못 가리킨다.** 주로 쓴 것만 적는다.
 *
 * 세트는 **그 부위를 주로 쓴 동작 수**다. 시간을 세트로 지어내지 않는다 —
 * 한 동작을 한 번 한 것이 1세트다.
 */
export function toRecords(list, done, program) {
  const rows = Array.isArray(list) ? list : [];
  const upto = Math.max(0, Math.min(rows.length, Number(done) || 0));

  const count = {};
  const seconds = {};
  for (let i = 0; i < upto; i += 1) {
    const ex = rows[i];
    partsOf(ex).main.forEach((p) => {
      count[p] = (count[p] || 0) + 1;
      seconds[p] = (seconds[p] || 0) + (Number(ex?.duration) || 0);
    });
  }

  const name = String(program || '홈트').trim();
  // 몸 지도의 차례를 따른다 — 부를 때마다 순서가 바뀌면 같은 판이 다르게 쌓인다
  return MAP_PARTS.filter((p) => count[p] > 0).map((p) => ({
    exercise: `${name} · ${p}`,
    weight: '',                 // 맨몸이다. 0 을 적으면 「0kg 로 들었다」가 된다
    sets: count[p],
    // 초를 횟수로 옮기지 않는다. 45초 버틴 것을 「45회」라고 적으면 거짓말이 된다
    reps: 1,
  }));
}
