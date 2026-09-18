// 날짜가 **말이 되는 범위**에 있는가 (2026-09-18).
//
// 라우트들은 여태 모양만 봤다 — `/^\d{4}-\d{2}-\d{2}$/` 과 「달에 없는 날이 아닌가」.
// 그래서 `1900-01-01` 도 `9999-12-31` 도 그대로 들어왔다.
//
// **주소로 장난친 것만이 아니다.** 날짜 칸(`<input type="date">`)은 `max` 를 걸어도
// 사람이 연도를 직접 칠 수 있다 — 2026 을 치려다 1026 을 치는 일은 실제로 일어난다.
// 그리고 한 번 들어간 줄은 **되돌릴 자리가 마땅치 않다**:
//   · 1년 벽과 달력이 그 줄을 찾아 옛날로 내려간다
//   · 이어온 주는 첫 기록의 주부터 세는데, 그 첫 기록이 1900년이 된다
//     (520주에서 자르게 해뒀지만, 그건 터지지 않으려고 둔 뚜껑이지 맞는 값이 아니다)
//   · 기기에 담아두는 것은 90일치라, 옛 줄은 화면에서 잘 안 보이면서 계산에는 남는다
//
// **위쪽 테두리는 하루 넉넉하게 준다.** 서버의 오늘과 사람의 오늘이 다를 수 있다
// (시차 · 자정 무렵). 「어제 것을 오늘 적는다」는 이 앱이 일부러 열어둔 길이라
// 아래쪽은 넓게 두고, 앞쪽만 막는다.
//
// **계획은 다르다.** 달력에 담는 「할 것」은 앞날이 제자리다 — 그쪽은 앞으로 2년까지 본다.

// 이 앱보다 먼 과거는 기록이 아니라 잘못 친 것이다
const FLOOR = '2000-01-01';
// 계획으로 담아둘 수 있는 앞날 (2년)
const PLAN_AHEAD_DAYS = 730;

const shift = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/** 모양과 **달력에 실제로 있는 날**인지. `2026-02-30` 은 여기서 걸린다. */
function isRealDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/**
 * 기록으로 받을 수 있는 날인가 — 운동 · 인바디 · 측정.
 *
 * 지난 날은 넓게 받는다(옛 기록을 옮겨 적는 사람이 있다). 앞날은 하루만 준다.
 */
function isRecordDay(v) {
  return isRealDate(v) && v >= FLOOR && v <= shift(1);
}

/** 계획으로 받을 수 있는 날인가 — 앞날이 제자리다. */
function isPlanDay(v) {
  return isRealDate(v) && v >= FLOOR && v <= shift(PLAN_AHEAD_DAYS);
}

module.exports = { isRealDate, isRecordDay, isPlanDay, FLOOR, PLAN_AHEAD_DAYS };
