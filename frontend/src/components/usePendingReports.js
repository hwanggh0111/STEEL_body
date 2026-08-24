import { useState, useEffect } from 'react';
import client from '../api/client';
import { isAdmin } from '../data/admin';

// 손볼 제보가 몇 건인지.
//
// 관리자가 화면을 열어봐야만 알 수 있던 것을 눈에 띄게 하려고 둔다.
// 메일 알림은 SMTP 를 설정해야 나가지만 이건 설정 없이도 바로 보인다.
//
// 가벼운 경로(`/reports/pending`)만 부른다 — 표시 하나 때문에 제보를 통째로
// 받아올 수는 없다. 관리자가 아니면 아예 부르지 않는다.
const PULL_MS = 3 * 60 * 1000;

export function usePendingReports() {
  const [count, setCount] = useState({ open: 0, abuse: 0 });

  useEffect(() => {
    if (!isAdmin()) return;
    let alive = true;
    const pull = () => {
      client.get('/reports/pending')
        .then(({ data }) => { if (alive) setCount({ open: data?.open || 0, abuse: data?.abuse || 0 }); })
        // 못 받아온 것 때문에 화면이 시끄러워지면 안 된다. 조용히 넘어간다
        .catch(() => {});
    };
    pull();
    const id = setInterval(pull, PULL_MS);
    // 다른 탭에서 답을 달고 돌아왔을 때 바로 맞춰준다
    const onWake = () => { if (!document.hidden) pull(); };
    document.addEventListener('visibilitychange', onWake);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onWake);
    };
  }, []);

  return { ...count, total: count.open + count.abuse };
}

export default usePendingReports;
