// 쉬는 동안 보여줄 것 (2026-10-01, 시안 A).
//
// 세트 사이 60~180초는 이 앱에서 사람이 폰을 들고 있는 거의 유일한 시간인데,
// 그 자리에 **남은 시간밖에 없었다.** 거기에 「다음에 들 것」을 적는다.
//
// ── 지어내지 않는다 ──
//
// 다음에 들 무게·횟수는 **예측이 아니다.** 방금 적은 그 값을 그대로 보여준다
// (「방금과 같이」). 무게를 올려 주겠다거나 몇 회를 하라는 말은 하지 않는다 —
// 그것은 이 앱이 안 하기로 한 일이다.
//
// 지난 번 이야기도 **적혀 있는 것만** 말한다. 날짜 · 몇 세트 · 가장 많이 한 횟수,
// 그리고 **몇 세트째에서 횟수가 줄었는지.** 그 셋은 기록에 그대로 있다.
//
// 이 파일은 화면을 모른다 — 값만 만든다. 그래야 눈으로 보기 어려운 것(지난 번이
// 둘 이상 있을 때 · 세트가 거꾸로 적혔을 때)을 검사에서 잡을 수 있다.

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// 한 줄이 이 운동인가. 이름은 앞뒤 공백만 털어 견준다 —
// 대소문자까지 섞으면 영어로 적은 사람의 「Bench」와 「bench」가 갈린다
const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/**
 * 그날 그 운동의 줄들을 **세트 번호 순으로** 돌려준다.
 *
 * 한 줄이 「운동 + 무게 + 세트수 + 횟수」라 같은 운동을 세 번 적으면 세 줄이고,
 * `sets` 에 **몇 세트째인지**가 들어 있다. 적힌 차례는 믿지 않는다 — 고치면
 * 뒤에 붙는다.
 */
function rowsOfDay(workouts, day, exercise) {
  const list = (workouts && workouts[day]) || [];
  return list
    .filter(w => w && same(w.exercise, exercise))
    .slice()
    .sort((a, b) => num(a.sets) - num(b.sets));
}

/**
 * 지난 번 이 운동을 한 날. **오늘은 빼고** 가장 가까운 날이다.
 *
 * 날짜는 `YYYY-MM-DD` 라 글자로 견주면 그대로 날짜 순이다.
 */
function lastDayOf(workouts, exercise, today) {
  let best = null;
  for (const day of Object.keys(workouts || {})) {
    if (day >= today) continue;              // 오늘과 앞날은 지난 번이 아니다
    if (rowsOfDay(workouts, day, exercise).length === 0) continue;
    if (best === null || day > best) best = day;
  }
  return best;
}

/**
 * 그날 **몇 세트째에서 횟수가 줄었나.**
 *
 * 가장 많이 한 횟수보다 적어지는 **첫 세트**를 찾는다. 끝까지 안 줄었으면 null 이고,
 * 그때는 화면이 그 말을 아예 안 한다 — 「안 줄었어요」는 적을 값이 아니다.
 */
function dropOf(rows) {
  if (rows.length < 2) return null;
  const top = Math.max(...rows.map(r => num(r.reps)));
  for (const r of rows) {
    if (num(r.reps) < top) return { set: num(r.sets), reps: num(r.reps) };
  }
  return null;
}

/**
 * 쉬는 동안 보여줄 것 한 벌.
 *
 * `exercise` 가 없거나 오늘 그 운동을 적은 적이 없으면 **null** 이다 —
 * 그때 화면은 지금까지처럼 시간만 보여준다. 모르는 자리를 채우지 않는다.
 */
export function restView(workouts, exercise, today) {
  if (!exercise || !today) return null;
  const mine = rowsOfDay(workouts, today, exercise);
  if (mine.length === 0) return null;

  const just = mine[mine.length - 1];       // 방금 적은 줄 = 세트 번호가 가장 큰 것
  const doneSets = num(just.sets);

  const lastDay = lastDayOf(workouts, exercise, today);
  const lastRows = lastDay ? rowsOfDay(workouts, lastDay, exercise) : [];
  const last = lastDay
    ? {
        date: lastDay,
        sets: lastRows.length ? Math.max(...lastRows.map(r => num(r.sets))) : 0,
        topReps: lastRows.length ? Math.max(...lastRows.map(r => num(r.reps))) : 0,
        weight: lastRows.length ? Math.max(...lastRows.map(r => num(r.weight))) : 0,
      }
    : null;

  // 칸을 몇 개 그릴까 — 지난 번만큼이 기준이고, 오늘 그보다 더 했으면 오늘에 맞춘다.
  // 지난 번이 없으면 오늘 한 만큼만 그린다 (「앞으로 몇 세트」를 지어내지 않는다)
  const planSets = Math.max(doneSets, last ? last.sets : 0);

  return {
    exercise: String(exercise).trim(),
    doneSets,
    nextSet: doneSets + 1,
    // 방금 든 것. **다음에 들 것을 점치는 값이 아니다**
    weight: num(just.weight),
    reps: num(just.reps),
    last,
    drop: dropOf(lastRows),
    planSets,
    // 지난 번만큼 다 했는가. 다 했으면 「다음 세트」 대신 그렇게 적는다
    done: last ? doneSets >= last.sets : false,
  };
}

export const _internals = { rowsOfDay, lastDayOf, dropOf };
