// 유산소 한 줄의 **시간과 거리**를 다듬는 자 (2026-11-05).
//
// ── 왜 생겼나 ──
//
// 이 앱의 한 줄은 「운동 + 무게 + 세트 + 횟수」다. 그래서 런닝머신을 적으려면
// **무게 · 세트 · 횟수를 지어내야 했다** — 기록 화면이 머리글에 그렇게 적어뒀고
// (「필수 칸에 맞춰 넘기고(세트와 횟수를 지어내야 했다)」), 사전은 달리기 설명에
// 아예 **「거리와 시간으로 적는다」**고 적어놓고도 그 칸을 주지 않았다.
//
// 지어낸 「1세트 1회」는 기록으로는 남지만 **셈에서는 전부 빠진다** — 볼륨은
// 맨몸·유산소를 빼고, 몸 지도는 여섯 부위에 자리가 없고, 결산의 든 무게에도 안 든다.
// 그래서 **매일 적는 사람에게 앱이 아무 말도 못 했다.**
//
// ── 어떻게 받나 ──
//
//   · 시간은 **분**, 거리는 **km**. 둘 중 **하나만 있어도 유산소 줄**이다 —
//     「5km 달렸다(시간은 안 봤다)」와 「30분 탔다(거리는 안 뜬다)」가 둘 다 있다.
//     한쪽을 필수로 걸면 그중 한 사람은 또 지어내야 한다
//   · 유산소 줄에는 **세트 · 횟수를 담지 않는다.** 「1세트 1회」를 대신 넣어두면
//     그것이 바로 없애려는 그 거짓이다. 읽는 쪽은 이미 `Number(w.sets) || 0` 으로
//     읽어서 없는 칸을 0 으로 본다
//   · **무게는 그대로 받는다** — 가중 걷기 · 파머스 워크는 무게가 있는 유산소다
//
// ── 테두리 ──
//
// 자유로 치는 숫자 칸은 **반드시 테두리를 물어본다**(10/28 의 자) — 그 값으로
// 화면이 말을 짓기 때문이다. 「999999분」 한 줄이 들어가면 주간 합이 「16,666시간」이
// 되고 그 뒤가 전부 틀린다(무게 999999 가 결산을 「2999만 kg」으로 만든 그 모양).
//
//   MINUTES_MAX · DISTANCE_KM_MAX → frontend/src/data/limits.js
//   (`npm run bounds` 가 양쪽 수를 제 손으로 들고 견준다)
//
// 10시간과 500km 는 **사람이 하루에 할 수 있는 것보다 넉넉히** 둔 선이다
// (울트라 마라톤이 100~160km, 24시간 달리기 세계 기록이 300km 대다).

/** 한 줄에 적을 수 있는 시간 (분) */
const MINUTES_MAX = 600;
/** 한 줄에 적을 수 있는 거리 (km) */
const DISTANCE_KM_MAX = 500;

const EMPTY = (v) => v === undefined || v === null || v === '';

/**
 * 시간 · 거리를 다듬는다.
 *
 * @returns {{ ok: true, cardio: boolean, minutes: number|null, distanceKm: number|null }}
 *          또는 `{ ok: false, why: string }`
 *
 * 빈 값은 **없는 것**이다(0 이 아니다) — 0 은 빠뜨린 것이 아니라 잘못 적은 것이라
 * 테두리에서 걸러 **까닭을 말해준다**(`POST /workouts` 가 세트·횟수에 쓰는 그 규칙).
 */
function normalizeCardio(minutes, distanceKm) {
  const noMin = EMPTY(minutes);
  const noDist = EMPTY(distanceKm);
  if (noMin && noDist) return { ok: true, cardio: false, minutes: null, distanceKm: null };

  let m = null;
  if (!noMin) {
    const n = Number(minutes);
    // 30.5분은 안 적는다 — 분이 가장 작은 칸이다
    if (!Number.isInteger(n) || n <= 0) {
      return { ok: false, why: '시간은 1 이상의 정수(분)로 적어주세요' };
    }
    if (n > MINUTES_MAX) {
      return { ok: false, why: `시간은 ${MINUTES_MAX}분 이하로 적어주세요` };
    }
    m = n;
  }

  let km = null;
  if (!noDist) {
    const n = Number(distanceKm);
    if (!Number.isFinite(n) || n <= 0) {
      return { ok: false, why: '거리는 0보다 큰 수(km)로 적어주세요' };
    }
    if (n > DISTANCE_KM_MAX) {
      return { ok: false, why: `거리는 ${DISTANCE_KM_MAX}km 이하로 적어주세요` };
    }
    // 10m 단위까지. 더 적어 보내도 그만큼만 담는다 (화면이 그 자리까지 그린다)
    km = Number(n.toFixed(2));
  }

  return { ok: true, cardio: true, minutes: m, distanceKm: km };
}

/** 담긴 줄이 유산소 줄인가 — **시간이나 거리가 적혀 있으면** 그렇다 */
function isCardioRow(row) {
  return row != null && (row.minutes != null || row.distance_km != null);
}

module.exports = { MINUTES_MAX, DISTANCE_KM_MAX, normalizeCardio, isCardioRow };
