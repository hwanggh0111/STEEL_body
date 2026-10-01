import { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import { isAdmin } from '../data/admin';
import { readLS, saveLS } from '../data/safeStorage';

// 새로 쌓인 화면 오류가 몇 건인가 (2026-10-01).
//
// 「화면 오류」 칸을 만들었지만 **안 열어보면 또 쌓인다** — 이번에 한 달을 그랬다.
// 그래서 관리자 화면 머리에 숫자를 세운다.
//
// **제보와 같은 자리에 두지 않는다.** 제보는 사람이 답을 기다리는 일이고
// 이것은 아니다. 섞어 놓으면 제보의 급함이 묽어진다 — 줄을 나누고 색을 달리한다.
//
// **「새」만 센다.** 한 번 보고 나면 빠진다. 안 그러면 26 이라는 숫자가 영영
// 안 줄어들고, 그러면 숫자가 아무 말도 안 하게 된다.
//
// 어디까지 봤는지는 **이 기기에만** 적는다. 보는 사람이 하나뿐인 자리라
// 서버에 둘 만큼의 값이 아니다 — 기기를 바꾸면 한 번 다시 보게 되는 것이 전부다.
const SEEN_KEY = 'ironlog_errors_seen';
const PULL_MS = 3 * 60 * 1000;

export function readSeen() {
  return readLS(SEEN_KEY) || '';
}

/** 목록을 연 그 자리에서 「여기까지 봤다」를 적는다 */
export function markSeen(newest) {
  if (!newest) return;
  const before = readSeen();
  // 뒤로 가지 않는다 — 옛 줄을 눌러봤다고 이미 본 것이 다시 「새」가 되면 안 된다
  if (before && before >= newest) return;
  saveLS(SEEN_KEY, String(newest));
  // 머리의 숫자가 바로 줄어들게 알린다. 화면을 옮겨야 맞춰지면 「안 줄어든다」로 읽힌다
  try { window.dispatchEvent(new Event('ironlog:errors-seen')); } catch { /* 옛 브라우저 */ }
}

export function useNewClientErrors() {
  const [count, setCount] = useState(0);
  // 아직 안 받아온 0 과 정말로 0 건은 다르다 — 받아오기 전에는 아무 말도 안 한다
  const [loaded, setLoaded] = useState(false);

  const pull = useCallback(() => {
    if (!isAdmin()) return;
    client.get('/client-error/new', { params: { since: readSeen() } })
      .then(({ data }) => {
        setCount(Number(data?.count) || 0);
        setLoaded(true);
      })
      // 못 받아온 것 때문에 화면이 시끄러워지면 안 된다. 조용히 넘어간다
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAdmin()) return;
    pull();
    const id = setInterval(pull, PULL_MS);
    const onWake = () => { if (!document.hidden) pull(); };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('ironlog:errors-seen', pull);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('ironlog:errors-seen', pull);
    };
  }, [pull]);

  return { count, loaded };
}

export default useNewClientErrors;
