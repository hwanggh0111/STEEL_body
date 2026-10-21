import { useState, useRef, useEffect, useCallback } from 'react';
import { useToday } from './useToday';
import { dateKey } from './dateKey';

// 「어느 날 적는가」 칸 (2026-10-21).
//
// ── 무엇이 틀어져 있었나 ──
//
// 이 앱은 폰 홈 화면에 붙여 쓰는 PWA 라 **며칠씩 열려 있는다** — `useToday` 가
// 그래서 있는 것이고, 그 머리글에 이렇게 적혀 있다:
//
//   「기록 — 날짜 칸이 어제라 그대로 저장하면 어제 기록이 된다.
//     오늘 목록에 안 보이니 「저장이 안 됐다」로 읽힌다」
//
// **그 고침이 「운동」 화면에만 가 있었다**(9/18 의 `datePicked`). 인바디와 재는
// 도구 넷(전신 사이즈 · 체력 테스트 · 유연성 · 어깨)은 열 때의 날짜를 `useState`
// 로 붙잡고 있어서, **어젯밤에 열어둔 앱으로 오늘 아침에 적으면 어제로 들어갔다.**
// 「운동 가기 전에 몸무게를 잰다」가 이 앱을 여는 가장 흔한 때라 더 그렇다.
//
// 그리고 칸의 **아래 테두리(`min`)가 넷 중 하나(어깨)에만** 있었다. 거기 적어둔
// 까닭이 그대로 나머지에도 들어맞는다 — 「`max` 만 걸면 연도는 직접 칠 수 있다」
// (2026 대신 1026). 서버가 막아주지만 사람에게는 **까닭 없는 실패**로 보인다.
//
// ── 그래서 한 곳에 둔다 ──
//
// 다섯 군데에 같은 `ref` 를 흩어놓지 않는다. 이 앱이 거듭 당한 모양이 그것이다 —
// 「길이 둘인데 한쪽에만 적어둔다」. 고치는 자리를 하나로 둔다.
//
//   date   칸에 넣을 값
//   pick   **사람이 고른 날.** 그 뒤로는 자정을 넘겨도 안 건드린다 —
//          어제 것을 적는 중에 날짜가 오늘로 튀면 안 된다
//   hold   고친 기록의 날짜처럼 **코드가 들려준 날.** `pick` 과 같이 붙잡는다
//   reset  오늘로 돌아가고, 자정 따라가기를 다시 켠다 (적고 난 뒤 · 그만둘 때)
//   today  지금의 오늘 (`max` 에 쓴다)
//   MIN    아래 테두리. 칸마다 적지 않는다

/** 날짜 칸의 아래 테두리. 서버도 같은 벽을 본다 (`utils/dayRange.js`) */
export const MIN_RECORD_DAY = '2000-01-01';

export function useRecordDate() {
  const today = useToday();
  const [date, setDate] = useState(today);
  // 사람이 고른 날인가. `state` 가 아니라 `ref` 다 — 화면에 그릴 값이 아니라
  // 「자정을 따라갈지」만 가르는 값이라, 바뀔 때 다시 그릴 이유가 없다
  const picked = useRef(false);

  useEffect(() => {
    if (picked.current) return;
    setDate((prev) => (prev === today ? prev : today));
  }, [today]);

  // 빈 값으로 오면 무시한다 — 달력을 열었다 닫기만 해도 빈 값이 온다.
  // 그대로 받으면 날짜 없는 기록을 보내게 된다 (「운동」에서 겪은 것)
  const pick = useCallback((v) => {
    const next = String(v || '').trim();
    if (!next) return;
    picked.current = true;
    setDate(next);
  }, []);

  const hold = pick;

  const reset = useCallback(() => {
    picked.current = false;
    // 훅이 들고 있는 `today` 는 그 렌더의 값이라, 자정을 막 넘긴 순간에 부르면
    // 어제가 들어갈 수 있다 — 그 자리에서 다시 본다
    setDate(dateKey());
  }, []);

  return { date, pick, hold, reset, today, min: MIN_RECORD_DAY };
}

export default useRecordDate;
