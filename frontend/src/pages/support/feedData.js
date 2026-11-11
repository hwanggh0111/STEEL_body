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

// ── ★★ **받을 판을 이름에 붙인다** ── (2026-11-09)
//
// 여태 `/feed-detail.json` 을 **그냥** 받았다. 그런데 이 둘은 **서로 다른 판으로
// 서빙된다** —
//
//   feedIndex.json (위에서 들인 것)  번들에 실린다. 이름에 해시가 박혀 배포하면
//                                    **즉시** 새것이 간다 (immutable)
//   /feed-detail.json                정적 파일. 이름이 안 바뀌어서 브라우저 HTTP
//                                    캐시가 **최장 이레** 묵은 것을 내준다
//                                    (라이브에서 받아 봤다 — `max-age=604800`)
//
// 그래서 배포 뒤 최장 이레 동안 **목록은 새것 · 본문은 옛것**이 된다. 새 줄에는
// 「본문이 있다」가 적혀 있는데 받아온 옛 본문에는 그 열쇠가 없어서, 눌러도
// **영영 「불러오는 중…」**이었다 (11/09 라이브 검사에서 공지 두 줄이 그랬다).
//
// 그래서 **그 본문의 판**(내용 해시, `gen-feed.mjs` 가 박는다)을 열쇠에 붙여 받는다 —
// 내용이 바뀌면 주소가 바뀌어 캐시가 **반드시 빗나가고**, 안 바뀌면 이레를 그대로
// 쓴다(헛된 왕복이 없다). 판이 없는 옛 묶음도 그냥 받는다 — 떨어지지 않는다
const DETAIL_URL = FEED_INDEX.detailVersion
  ? `/feed-detail.json?v=${FEED_INDEX.detailVersion}`
  : '/feed-detail.json';

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
    pending = fetch(DETAIL_URL)
      // ★ **`r.ok` 만 보면 HTML 을 JSON 으로 읽으려 든다** (2026-11-11)
      //
      // 서버의 폴백이 없는 주소에 `index.html` 을 **200 으로** 주던 일이 있었다.
      // 그러면 여기는 `ok` 를 통과하고 `r.json()` 에서 터져, 사람에게는 까닭 없이
      // 「못 불러왔어요」만 뜬다. 서버는 같은 날 404 로 끊게 고쳤지만, **받은 것이
      // JSON 인지 보는 것은 이쪽 일**이다 — 이 파일이 빠진 배포가 한 번이라도 나면
      // 그때 또 같은 자리에 선다.
      .then((r) => {
        const type = (r.headers.get('content-type') || '').toLowerCase();
        if (!r.ok) return Promise.reject(new Error(String(r.status)));
        if (!type.includes('json')) return Promise.reject(new Error('not-json'));
        return r.json();
      })
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
