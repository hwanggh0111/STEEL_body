import { useState, useEffect } from 'react';
import { dateKey } from './dateKey';

// 오늘 날짜. **화면으로 돌아올 때마다 다시 본다.**
//
// 이 앱은 폰 홈 화면에 붙여 쓰는 PWA 라 **며칠씩 열려 있는다.** 그런데 화면은
// 무슨 일이 있어야 다시 그려지고, 밤새 아무 일도 안 일어난다. 그래서 어젯밤에
// 열어둔 화면을 오늘 아침에 다시 보면 **어제 날짜가 그대로** 적혀 있다.
//
//   - 홈 — 주간 달력의 「오늘」 칸이 어제에 있고, 「이번 주」가 지난주다
//   - 기록 — 날짜 칸이 어제라 그대로 저장하면 어제 기록이 된다.
//     오늘 목록에 안 보이니 「저장이 안 됐다」로 읽힌다
//   - 인바디 — 날짜 칸의 `max` 도 어제라 **오늘을 아예 고를 수 없다**
//
// 그리고 이 앱을 여는 시각이 대개 그때다 — 자고 일어나서, 운동 가기 전.
// 하필 제일 자주 겪는 자리다.
//
// 돌아왔을 때 한 번 본다. 날짜가 그대로면 아무것도 안 바뀐다.
//
// ── ★ **자정에 바로 넘긴다 — 1분을 기다리지 않는다** ── (2026-11-17)
//
// 주인이 「날짜 변경하는 게 잘 안 되던데」라고 했다. 보던 손은 **1분 자**와
// `visibilitychange` 둘뿐이었다 —
//
//   1. **자정이 지나도 최대 1분은 어제다.** 23:59:40 에 자가 돌면 다음은 00:00:40
//      이다. 그 사이에 「이번 주 운동」 띠와 「오늘」 칸은 **어제를 가리킨다.**
//      사람은 그 1분을 「안 바뀐다」로 읽는다 — 날짜를 눌러 바꿔보고도 그대로이니
//      고장으로 보인다. 그래서 **다음 자정에 정확히 한 번 더** 깨운다.
//   2. **`visibilitychange` 만으로는 돌아온 것을 못 본다.** 폰에서 앱으로 되돌아올
//      때 그 소식이 늘 오지는 않는다 — 안드로이드 웹뷰(Capacitor)와 iOS 의 홈
//      화면 앱은 `pageshow`(멈춰뒀던 화면을 되살릴 때) · `focus`(창을 다시 잡을 때)
//      로 오는 쪽이 있다. 셋을 **같은 손**에 묶는다. 날짜가 그대로면 아무 일도
//      안 일어나므로 더 봐서 해로울 것이 없다.
//
// 1분 자는 **그대로 둔다** — 기기 시계를 손으로 바꾸거나 시간대가 달라지는 경우는
// 자정 자가 못 잡는다(그 자는 「우리가 아는 오늘」의 끝에 걸려 있다). 셋은 서로의
// 빈자리를 메운다.
export function useToday() {
  const [today, setToday] = useState(dateKey);

  useEffect(() => {
    let 자정자 = null;

    const check = () => {
      if (document.hidden) return;
      setToday(prev => {
        const now = dateKey();
        return prev === now ? prev : now;
      });
    };

    // 다음 자정까지 남은 만큼만 잔다. 깨면 보고, 또 다음 자정에 건다.
    //
    // **1초를 더 준다** — 정확히 자정에 깨면 기기 시계가 아직 23:59:59.9 인 일이
    // 있다(타이머는 「그 뒤」를 보장할 뿐 「그 순간」을 못 맞춘다). 그러면 날짜가
    // 그대로라 아무 일도 안 하고, 다음 걸이도 **바로 지금**이 되어 자가 촘촘히
    // 돌 수 있다. 1초 뒤에 보면 그런 일이 없다.
    //
    // `setTimeout` 의 상한은 2^31-1ms(약 24.8일)다. 하루는 그 안이라 넘칠 일이
    // 없지만, 기기 시계가 뒤로 밀려 음수가 나오면 0 으로 눌러 다시 건다.
    const 자정에다시 = () => {
      const now = new Date();
      const 내일자정 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const 남은 = Math.max(0, 내일자정.getTime() - now.getTime()) + 1000;
      자정자 = setTimeout(() => { check(); 자정에다시(); }, 남은);
    };
    자정에다시();

    document.addEventListener('visibilitychange', check);
    // **되돌아오는 길은 하나가 아니다** (위 머리글 2번)
    window.addEventListener('pageshow', check);
    window.addEventListener('focus', check);
    // 화면을 안 가리고 밤을 새우는 경우도 있다 (거치대에 세워둔 폰).
    // 1분마다 보는 것은 부담이 안 되고, 날짜가 그대로면 다시 그리지도 않는다
    const timer = setInterval(check, 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('pageshow', check);
      window.removeEventListener('focus', check);
      clearInterval(timer);
      if (자정자) clearTimeout(자정자);
    };
  }, []);

  return today;
}

export default useToday;
