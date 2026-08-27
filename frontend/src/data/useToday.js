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
export function useToday() {
  const [today, setToday] = useState(dateKey);

  useEffect(() => {
    const check = () => {
      if (document.hidden) return;
      setToday(prev => {
        const now = dateKey();
        return prev === now ? prev : now;
      });
    };
    document.addEventListener('visibilitychange', check);
    // 화면을 안 가리고 밤을 새우는 경우도 있다 (거치대에 세워둔 폰).
    // 1분마다 보는 것은 부담이 안 되고, 날짜가 그대로면 다시 그리지도 않는다
    const timer = setInterval(check, 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', check);
      clearInterval(timer);
    };
  }, []);

  return today;
}

export default useToday;
