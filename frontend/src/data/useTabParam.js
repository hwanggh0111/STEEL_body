import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

// 갈래를 **주소에 남긴다** (2026-10-06).
//
// ── 왜 ──
//
// 갈래(탭 안의 탭)를 쓰는 화면이 셋이다 — 몸(인바디 · 재는 도구 · 견주기 · 체형 ·
// 회복), 기록(달력 · 기록의 벽 · 통계), 루틴(내 루틴 · 추천 · 프로그램 · 메모).
// 셋 다 `useState` 로 들고 있었다. 그래서 **갈래가 주소에 안 남았다.**
//
//   · **당겨서 새로고침하면 첫 갈래로 돌아간다** — 폰에서 흔히 하는 동작이다.
//     「몸 → 체형」을 보다가 당기면 인바디가 뜬다
//   · **링크를 만들 수 없다.** 「몸 → 회복」을 폰 홈 화면에 붙일 길이 없다
//   · 다른 화면이 갈래를 들려 보내는 길(`location.state`)은 **한 번만 산다** —
//     그 상태로 새로고침하면 사라진다
//
// 이 앱은 주소가 길을 들고 있어야 한다는 것을 이미 알고 있다 — 「운동」은
// `/train?q=` 로 받고(「로그인 화면을 거쳐도 남는 길이다」), 기구 목록은 그 주소로
// 운동을 들려 보낸다. **그 교훈이 갈래에는 안 와 있었다.**
//
// ── 뒤로 가기는 일부러 갈래를 안 되돌린다 ──
//
// `replace` 로 바꾼다. 갈래마다 히스토리를 쌓으면 「몸」에서 나가려고 **다섯 번**
// 눌러야 한다 — 폰에서 뒤로는 「이 화면을 나간다」는 뜻이다. 고치는 것은
// **새로고침 · 링크 · 바로가기**다.
//
// ── 들려 보낸 갈래도 그대로 받는다 ──
//
// 여태 `location.state.tab` 으로 받던 길을 **안 끊는다** — 홈 검색이 「1RM」을
// 그 길로 보낸다. 주소에 적힌 것이 없고 들고 온 것이 있으면 **주소로 옮긴다**
// (그러면 그 뒤로는 새로고침에도 산다).
//
// @param keys   쓸 수 있는 갈래 이름들. **이 목록에 없는 값은 안 받는다** —
//               주소는 누가 손으로 고칠 수 있는 자리고, 없는 갈래를 받으면 빈
//               화면이 뜬다
// @param first  아무것도 안 적혀 있을 때의 갈래
// ── 들고 온 갈래는 **주소보다 뒤에 온 것**이다 ──
//
// 처음 판은 「주소에 적혀 있으면 들고 온 것을 무시」였다. 그런데 그러면
// 2026-09-18 에 고쳐둔 것이 깨진다 — **이 화면에 서서 홈 검색으로 「1RM」을 다시
// 찾으면 같은 주소로 다시 온다.** 주소에 `t=shape` 가 적혀 있으면 들고 온
// `measure` 를 무시하게 되고, **무엇을 눌러도 아무 일도 안 일어난다.**
// (`npm run nav` 가 그것을 잡았다 — 「같은 자리에서 다시 찾아도 따라간다」.)
//
// 가르는 것은 `visit` 다. `location.key` 는 **같은 주소로 다시 올 때마다 바뀌는
// 값**이라, 그것이 바뀌었으면 「방금 들려 보냈다」는 뜻이다 — 그때는 주소를 덮는다.
// 새로고침은 `key` 가 그대로이므로 주소가 이긴다.
//
// @param brought 다른 화면이 들려 보낸 갈래 (`location.state?.tab`)
// @param visit   그 걸음의 표 (`location.key`). 주면 들고 온 것이 주소를 덮는다
export function useTabParam(keys, first, brought, visit) {
  const [params, setParams] = useSearchParams();
  const inUrl = params.get('t');
  const valid = (v) => !!v && keys.includes(v);

  // 주소에 적힌 것이 먼저다. 없으면 들고 온 것, 그것도 없으면 첫 갈래
  const tab = valid(inUrl) ? inUrl : valid(brought) ? brought : first;

  const setTab = useCallback((next) => {
    if (!valid(next)) return;
    const p = new URLSearchParams(params);
    // **첫 갈래는 주소에 안 적는다.** `/body` 와 `/body?t=inbody` 가 같은 화면인데
    // 주소가 둘이면 링크가 둘이 된다 — 공유된 주소마다 다르게 생긴다
    if (next === first) p.delete('t');
    else p.set('t', next);
    setParams(p, { replace: true });
  }, [params, setParams, keys, first]);

  // 들고 온 갈래를 **주소로 옮긴다.** 안 옮기면 그 상태로 새로고침할 때 사라진다.
  // `visit` 이 바뀌면 **주소에 적힌 것이 있어도 덮는다** (위 주석 참고)
  const seen = useRef(null);
  useEffect(() => {
    if (!valid(brought)) return;
    const fresh = visit !== undefined && seen.current !== visit;
    seen.current = visit;
    if (fresh || !valid(inUrl)) {
      if (brought !== tab) setTab(brought);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brought, visit, inUrl]);

  return [tab, setTab];
}
