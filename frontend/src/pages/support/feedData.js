// 손으로 적은 공지 + 커밋에서 자동으로 뽑은 것을 한 줄로 세운다.
// 홈페이지의 '최근 바뀐 것' 과 공지함이 같은 목록을 본다 — 두 곳이 어긋날 수 없다.
//
// ── 본문은 **펼칠 때** 받는다 ── (2026-10-16)
//
// 여태 여기서 `notices.json` 과 `changelog.json` 을 통째로 들였다. 그래서 고객센터를
// 한 번 여는 데 **묶인 조각 91KB(gzip 32KB)** 가 따라왔고, 그 무게의 거의 전부가
// 본문(`detail`)이다 — 공지 19,663자 + 커밋 14,578자. 그런데 고객센터에 오는 사람
// 대부분은 **한 줄도 안 펼친다.** (홈페이지는 10/6 에 `feedList.json` 으로 이미 갈랐다.
// 그때 「공지함은 그대로 전체를 받는다」고 적어뒀는데, 그 자리가 지금 여기다.)
//
//   src/data/feedIndex.json     전체 목록(본문 없이) — 묶음에 실린다
//   public/feed-detail.json     본문만 — **펼치거나 찾을 때** 한 번 받는다
//
// 둘 다 `scripts/gen-feed.mjs` 가 `notices.json` · `changelog.json` 에서 뽑는다.
// **손으로 적는 자리는 여전히 하나다.**
import { useEffect, useState } from 'react';
import FEED_INDEX from '../../data/feedIndex.json';

// 손으로 적는 notices.json 에서 date 나 id 를 빠뜨려도 화면이 죽지 않게 한다.
// 한 줄이 모자란 것과 목록 전체가 안 뜨는 것은 무게가 다르다.
export const fmtDate = d => (typeof d === 'string' && d.length >= 10 ? d.slice(5).replace('-', '. ') : '');

// 고정한 공지가 맨 위, 그 다음은 날짜 역순. 같은 날이면 공지를 먼저 —
// 커밋은 무슨 일이 있었는지를, 공지는 그게 무슨 뜻인지를 말한다
export const FEED = (FEED_INDEX.items || []).map((r, i) => ({
  key: r.key ?? `row-${i}`,
  date: r.date || '',
  label: r.notice ? '공지' : (r.label || ''),
  text: r.text,
  scope: r.scope || null,
  // **본문이 있는 줄인지만** 안다. 글 자체는 아직 없다 — 펼칠 때 받는다
  hasDetail: !!r.has,
  notice: !!r.notice,
  pinned: !!r.pinned,
})).sort((a, b) => {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return (a.notice === b.notice) ? 0 : (a.notice ? -1 : 1);
});

// 받아둔 본문. **한 번만 받는다** — 공지함에서 열 줄을 펼쳐도 왕복은 한 번이다
let details = null;
let pending = null;

/**
 * 본문을 받는다. 이미 있으면 그대로 돌려준다.
 *
 * **실패를 기억하지 않는다** — 신호가 없을 때 한 번 막혔다고 영영 안 받으면,
 * 신호가 돌아와도 「불러오지 못했어요」가 그대로 남는다.
 */
export function loadFeedDetails() {
  if (details) return Promise.resolve(details);
  if (!pending) {
    pending = fetch('/feed-detail.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { details = d && typeof d === 'object' ? d : {}; return details; })
      .catch((e) => { pending = null; throw e; });
  }
  return pending;
}

/**
 * 본문이 필요해지면(`want`) 받아서 돌려주는 고리.
 *
 * 돌려주는 것 — `{ details, failed, retry }`.
 * **아직 안 왔을 때와 못 받았을 때를 가른다**: 화면이 「불러오는 중」과
 * 「못 불러왔어요 · 다시」를 다르게 말해야 한다.
 */
export function useFeedDetails(want) {
  const [map, setMap] = useState(details);
  const [failed, setFailed] = useState(false);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!want || map) return undefined;
    let live = true;
    setFailed(false);
    loadFeedDetails()
      .then((d) => { if (live) setMap(d); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [want, map, tries]);

  return { details: map, failed, retry: () => setTries((n) => n + 1) };
}
