// **여유를 쓴다** — 적어둔 「몇 개 더 할 수 있었나」를 세어 사실로 한 줄 (2026-11-25 · 맵시).
//
// ── 무엇이 없었나 ──
//
// 세트마다 「몇 개 더 할 수 있었나요?」를 묻는다(`TrainPage` 의 여유 칸 · 11/18).
// 그런데 그 값으로 하는 일이 **꼬리표 하나**(「여유 3+」)뿐이었다. 묻기만 하고
// 안 쓰는 칸은 사람이 다음부터 안 적는다. 새로 받는 자료 없이 **이미 적힌 것을 센다**
// (시안 `/dev/sian/1124/` ①).
//
// ── 재는 규칙 ──
//
//   · **같은 이름 · 같은 무게.** 무게는 가장 최근 판의 대표 무게(`sessionsOf` 가
//     정한 그것 — 드롭을 뺀 가장 무거운 줄)다. 최근 판부터 거슬러 가다 **무게가
//     바뀌면 멈춘다** — 「그 사이 무게는 그대로」인 동안만 센다
//   · **「3개 이상」으로 적은 날만 센다.** 여유는 `0` · `1~2` · `3+` 세 칸이다
//     (`RIR_VALUES`). 시안은 「두 개 이상」이라 적었지만 `1~2` 는 하나일 수도 있다 —
//     **적지 않은 것을 적은 척하지 않는다.** 그래서 말도 「세 개 이상」이다
//   · 그 무게의 줄 가운데 **하나라도** `3+` 면 그 날을 센다. 드롭 줄은 안 본다
//     (그 판에서 제일 가벼운 무게라 같은 무게가 아니다)
//   · **적고 있는 날은 뺀다** — `nextStep` 과 같은 까닭이다(오늘은 아직 안 끝났다)
//   · **두 번 이상**일 때만 말한다. 한 번은 흐름이 아니다
//   · 맨몸 · 유산소는 안 센다 — 「같은 무게」가 없다
//
// ── **권하지 않는다** ──
//
// 「2.5kg 올리세요」가 아니다. 올릴지는 그날 몸이 정하고, 권하는 자리는 바로 위
// 「다음 한 걸음」이 따로 있다. 여기 말은 **적어둔 것을 센 사실**이고, 그래서
// 금색 옷(최고 기록 배너 · 권하는 카드의 금 테두리)도 입히지 않는다 — 축하가 아니다.
//
// 값으로 보는 자: `npm run rirroom` (`npm run check` 에도 들어 있다)
import { sessionsOf, shortDate } from './lastSets';
import { parseWeight } from './personalRecord';
import { RIR_VALUES } from './limits';

/** 「3개 이상」 — 여유 칸의 가장 큰 값 */
export const ROOM_RIR = RIR_VALUES[RIR_VALUES.length - 1];
/** 이만큼은 적혀 있어야 말한다 */
export const ROOM_MIN = 2;
/** 화면에 적는 날짜는 최근 이만큼까지 */
const SHOW_DATES = 3;

/**
 * 돌려주는 것 (말할 것이 없으면 `null` — 화면은 그 칸을 아예 안 그린다) —
 *   kg     그 무게
 *   count  그 무게에서 「3개 이상」을 적은 날 수
 *   dates  그 날들 'YYYY-MM-DD', 최신이 앞 (전부)
 */
export function rirRoom(workouts, exercise, today = null, writing = null) {
  const all = sessionsOf(workouts, exercise, today, { before: writing || today })
    .filter((s) => !s.skipped);
  const last = all[0];
  if (!last || last.body || last.kg === null) return null;

  const dates = [];
  for (const s of all) {
    if (s.body || s.kg !== last.kg) break;   // 무게가 바뀌면 거기서 멈춘다
    const roomy = s.rows.some((w) => w?.link !== 'drop'
      && parseWeight(w?.weight) === last.kg
      && String(w?.rir ?? '') === ROOM_RIR);
    if (roomy) dates.push(s.date);
  }
  if (dates.length < ROOM_MIN) return null;
  return { kg: last.kg, count: dates.length, dates };
}

/** 화면이 그대로 적는 두 토막. 「올리세요」는 어디에도 없다 */
export function rirRoomText(room) {
  if (!room) return { head: '', dates: '' };
  const shown = room.dates.slice(0, SHOW_DATES).map(shortDate).reverse().join(' · ');
  return {
    head: `${room.kg}kg 에서 「세 개 이상 더 할 수 있었다」고 적은 날이 ${room.count}번이에요.`,
    dates: room.count > SHOW_DATES
      ? `최근 ${shown} — 그 사이 무게는 그대로예요`
      : `${shown} — 그 사이 무게는 그대로예요`,
  };
}
