import { volumeOf } from './weeklyReport';

// 1년 기록 벽 — **한 해를 금속판 열두 장에 각인한다.**
//
// 달력은 한 달씩만 보여준다. 그래서 「올해 내가 얼마나 했나」는 열두 번 넘겨봐야
// 겨우 짐작이 된다. 한 해를 한 화면에 깔면 그 질문에 한눈에 답이 된다 —
// 봄에 몰아 하고 여름에 비었다는 것 같은 건 넘겨보는 걸로는 절대 안 보인다.
//
// **깊이는 볼륨으로 판다.** 간 날/안 간 날 두 가지로만 칠하면 30분 몸 푼 날과
// 두 시간 조진 날이 같은 칸이 된다. 무겁게 든 날일수록 깊게 새겨야 벽이 말을 한다.
//
// 기준을 **그 해 안에서** 정하는 이유: 사람마다 드는 무게가 열 배씩 차이 난다.
// 절대값(예: 10톤 이상은 진하게)으로 자르면 어떤 사람의 벽은 통째로 밝고 어떤
// 사람의 벽은 통째로 어둡다. 자기 한 해의 가장 무거웠던 날을 100으로 놓고 나눈다.

const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

const pad = (n) => String(n).padStart(2, '0');

/** 그 해 그 달의 날 수. (2월을 손으로 세지 않으려고 0일을 쓴다) */
function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** 기록이 있는 해를 최신순으로. 없으면 빈 배열. */
export function yearsWithRecords(workouts) {
  const years = new Set();
  Object.entries(workouts || {}).forEach(([date, list]) => {
    if (!Array.isArray(list) || list.length === 0) return;
    const y = Number(String(date).slice(0, 4));
    if (Number.isFinite(y)) years.add(y);
  });
  return [...years].sort((a, b) => b - a);
}

/**
 * 한 해 치 벽.
 *
 * **맨몸만 한 날도 새겨진다.** volumeOf 는 무게를 안 적은 세트를 못 센다(체중을
 * 모르니까). 그 날을 0kg 으로 두면 운동한 날이 안 한 날과 똑같이 비어 보인다 —
 * 그래서 볼륨이 0 이어도 기록이 있으면 **제일 얕은 각인(1)** 은 준다.
 *
 * 돌려주는 것:
 *   months  [{ name, index, days: [{ date, day, kg, level }], count }]
 *   total   { days, kg, tons, longest, bestMonth }
 */
export function buildYear(workouts, year) {
  const y = Number(year);
  const byDate = {};
  let maxKg = 0;

  for (let m = 0; m < 12; m += 1) {
    const last = daysInMonth(y, m);
    for (let d = 1; d <= last; d += 1) {
      const date = `${y}-${pad(m + 1)}-${pad(d)}`;
      const list = (workouts || {})[date];
      if (!Array.isArray(list) || list.length === 0) continue;
      const { kg } = volumeOf(list);
      byDate[date] = kg;
      if (kg > maxKg) maxKg = kg;
    }
  }

  // 각인 깊이. 그 해 가장 무거웠던 날을 기준으로 삼분한다.
  // 무게를 한 번도 안 적은 해는 maxKg 가 0 이라 전부 얕은 각인이 된다 — 맞는 결과다
  const level = (kg) => {
    if (!maxKg) return 1;
    const r = kg / maxKg;
    if (r >= 0.66) return 3;
    if (r >= 0.33) return 2;
    return 1;
  };

  const months = MONTH_NAMES.map((name, m) => {
    const last = daysInMonth(y, m);
    const days = [];
    let count = 0;
    let kgSum = 0;
    for (let d = 1; d <= last; d += 1) {
      const date = `${y}-${pad(m + 1)}-${pad(d)}`;
      const has = Object.prototype.hasOwnProperty.call(byDate, date);
      const kg = has ? byDate[date] : 0;
      if (has) { count += 1; kgSum += kg; }
      days.push({ date, day: d, kg, level: has ? level(kg) : 0 });
    }
    return { name, index: m, days, count, kg: kgSum };
  });

  // 가장 길게 이어진 날. 날짜를 하나씩 세는 대신 그 해를 한 번만 훑는다
  let longest = 0;
  let run = 0;
  months.forEach((mo) => {
    mo.days.forEach((d) => {
      if (d.level > 0) { run += 1; if (run > longest) longest = run; }
      else run = 0;
    });
  });

  const days = months.reduce((n, mo) => n + mo.count, 0);
  const kg = months.reduce((n, mo) => n + mo.kg, 0);
  const bestMonth = months.reduce((best, mo) => (mo.count > (best?.count || 0) ? mo : best), null);

  return {
    year: y,
    months,
    total: {
      days,
      kg,
      tons: Math.round(kg / 1000),
      longest,
      bestMonth: bestMonth && bestMonth.count > 0 ? bestMonth : null,
    },
  };
}
